/* Affichage : préférences par personne, écrans muraux (administration et activation), données de la vue /mur. */
import {
  computeSynthese,
  legacyKeyModule,
  Preferences,
  Synthese,
  Uuid,
  WallCreateBody,
  WallOut,
  type Rights,
} from '@suivi/shared';
import type { JsonObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import { z } from 'zod';
import type { Session, SessionUser } from '../auth.js';
import { CSP_STRICT } from '../http/security.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import type { Services } from '../services.js';
import type { WallSession } from '../walls.js';
import { tableauDeBordNatif } from '../tableau-de-bord.js';
import { redactLegacy } from './suivi.js';

const PING_MS = 25_000;
const RECHECK_MS = 60_000;

/** Synthèse : sections du suivi du SMSI (état filtré selon les droits) et sections des fiches de registre, pour une
    personne (`user`) ou un écran mural (sans personne : périmètre commun, registres non restreints). */
export async function synthese(svc: Services, rights: Rights, user: SessionUser | null = null): Promise<Synthese> {
  rights = await svc.modules.rights(rights, true);
  const st = await svc.legacy.recompose();
  const data = redactLegacy((st?.data ?? {}) as JsonObject, rights);
  const aujourdHui = new Date();
  const base = computeSynthese(data, {
    organisation: svc.settings.get('general').orgName,
    aujourdHui,
    lisible: (k) => {
      const m = legacyKeyModule(k);
      return !!m && rights.can(m, 'lire');
    },
  });
  const natif = await tableauDeBordNatif(svc.grc, rights, user, {
    aujourdHui,
    joursEcheance: svc.settings.get('notifications').echeancesJours || 30,
  });
  return { ...base, ...natif };
}

const viewerRights = (s: Session | null, wall: WallSession | null) => (wall ? wall.rights : (s as Session).user.rights);

export const affichageRoutes = [
  /* ---------------------------------------------------------------- Préférences (compte personnel) */
  route({
    method: 'GET',
    url: '/api/account/preferences',
    summary: 'Préférences d’affichage (taille, densité, thème, colonnes), communes à tous les appareils',
    tags: ['Compte'],
    access: 'auth',
    response: Preferences,
    handler: async ({ s }) => (s as Session).user.preferences,
  }),
  route({
    method: 'PUT',
    url: '/api/account/preferences',
    summary: 'Enregistrement des préférences d’affichage',
    tags: ['Compte'],
    access: 'auth',
    body: Preferences,
    response: Preferences,
    handler: async ({ svc, s, body }) => {
      const sess = s as Session;
      await svc.db.k
        .updateTable('users')
        .set({ preferences: JSON.stringify(body) })
        .where('id', '=', sess.user.id)
        .execute();
      return body;
    },
  }),

  /* ---------------------------------------------------------------- Écrans muraux (administration) */
  route({
    method: 'GET',
    url: '/api/admin/murs',
    summary: 'Écrans muraux',
    tags: ['Écrans muraux'],
    access: 'administration:lire',
    response: z.array(WallOut),
    handler: async ({ svc }) =>
      svc.db.k
        .selectFrom('wall_screens')
        .select([
          'id',
          'name',
          'modules',
          'activated_at',
          'activation_expires',
          'expires_at',
          'revoked_at',
          'last_seen_at',
          'created_by',
          'created_at',
          'version',
        ])
        .orderBy(sql`revoked_at IS NOT NULL`)
        .orderBy('created_at', 'desc')
        .execute(),
  }),
  route({
    method: 'POST',
    url: '/api/admin/murs',
    summary: 'Création d’un écran mural : lien d’activation à usage unique (24 h), affiché une seule fois',
    tags: ['Écrans muraux'],
    access: 'administration:administrer',
    body: WallCreateBody,
    status: 201,
    response: z.object({ id: z.string(), lien: z.string(), code: z.string() }),
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const { id, code } = await svc.walls.create(body.nom, body.modules, body.jours, sess.user.username);
      await svc.db.audit(sess.user, ip, 'admin.wall_create', body.nom, { modules: body.modules, jours: body.jours });
      // Code dans le fragment (#) : jamais envoyé au serveur ni journalisé par le frontal.
      return { id, code, lien: `${svc.cfg.publicUrl}/mur/activer#${code}` };
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/murs/:id',
    summary: 'Révocation d’un écran mural (effet immédiat)',
    tags: ['Écrans muraux'],
    access: 'administration:administrer',
    params: z.object({ id: Uuid }),
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const name = await svc.walls.revoke(params.id, sess.user.username);
      if (!name) throw new HttpError(404, 'Écran introuvable ou déjà révoqué.');
      await svc.db.audit(sess.user, ip, 'admin.wall_revoke', name);
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Vue /mur */
  route({
    method: 'POST',
    url: '/api/mur/activer',
    summary: 'Activation d’un écran mural avec son code (pose le cookie de l’écran)',
    tags: ['Écrans muraux'],
    access: 'public',
    csrf: false,
    body: z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/, 'Code d’activation invalide.') }),
    response: z.object({ nom: z.string() }),
    handler: async ({ svc, req, reply, ip, body }) => {
      if (!svc.limits.wallActivation(ip)) throw new HttpError(429, 'Trop de tentatives. Réessayez dans 15 minutes.');
      const name = await svc.walls.activate(req, reply, body.code);
      await svc.db.audit(
        { username: 'écran mural' },
        ip,
        name ? 'wall.activated' : 'wall.activation_failed',
        name ?? '',
      );
      if (!name) throw new HttpError(401, 'Code d’activation invalide, expiré ou déjà utilisé.');
      return { nom: name };
    },
  }),
  route({
    method: 'GET',
    url: '/api/mur/synthese',
    summary: 'Synthèse affichée par le tableau de bord et l’écran mural (lecture seule, selon les droits)',
    tags: ['Écrans muraux'],
    access: 'mur',
    response: Synthese.extend({ ecran: z.string().nullable() }),
    handler: async ({ svc, s, wall }) => ({
      ...(await synthese(svc, viewerRights(s, wall), wall ? null : (s as Session).user)),
      ecran: wall ? wall.name : null,
    }),
  }),
  route({
    method: 'GET',
    url: '/api/mur/events',
    summary: 'Flux temps réel de l’écran mural (mises à jour des données métier uniquement)',
    tags: ['Écrans muraux'],
    access: 'mur',
    handler: async ({ svc, s, wall, req, reply }) => {
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'Content-Security-Policy': CSP_STRICT,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      let open = true;
      const send = (event: string, data: unknown) => {
        if (open) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      res.write('retry: 5000\n\n');
      send('hello', { ecran: wall?.name ?? null });
      const onChange = (e: { entity: string }) => {
        if (e.entity === 'legacy_state' || e.entity === 'settings' || e.entity === 'module_activation')
          send('change', { entity: e.entity });
      };
      svc.bus.on('change', onChange);
      const ping = setInterval(() => open && res.write(`: ping ${Date.now()}\n\n`), PING_MS);
      // Écran révoqué ou session fermée : le flux s'arrête et l'écran affiche l'avertissement.
      const recheck = setInterval(() => {
        const still = wall
          ? svc.walls.load(req).then((w) => !!w)
          : svc.auth.loadByHash((s as Session).sid, false).then((x) => !!x);
        still
          .then((ok) => {
            if (!ok) {
              send('logout', { reason: 'revoque' });
              close();
            }
          })
          .catch(() => {});
      }, RECHECK_MS);
      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(ping);
        clearInterval(recheck);
        svc.bus.off('change', onChange);
        res.end();
      };
      req.raw.on('close', close);
      res.on('error', close);
      return reply;
    },
  }),
];
