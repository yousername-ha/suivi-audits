/* Connexion unique SAML 2.0 (ADR 0114 ; décisions du RSSI du 25/11/2026) : boutons de la page de connexion, départ vers le
   fournisseur (HTTP-Redirect), adresse de retour (HTTP-POST, seule route dont le POST vient d'une autre origine),
   ré-authentification par le fournisseur (ForceAuthn), administration des fournisseurs et de leurs métadonnées. La
   déconnexion reste locale (pas de déconnexion unique : elle exigerait des cadres, interdits par frame-ancestors 'none'). */
import {
  ConnexionUniqueOut,
  FournisseurSsoBody,
  FournisseurSsoOut,
  ImportMetadonneesBody,
  OptionsConnexionSsoOut,
  ReauthSsoBody,
  ReauthSsoOut,
  SSO_BORNES,
  Uuid,
  codeEchecSso,
} from '@suivi/shared';
import type { FastifyReply } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { retourInterne } from '../connexion-unique/index.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route, URL_ACS_SAML } from '../http/route.js';
import { CSP_FILE, setBaseHeaders } from '../http/security.js';

const IdParams = z.object({ id: Uuid });
const Vide = z.object({}).strict();

/** Redirection 303 (après un POST) ou 302, vers un chemin interne ou l'adresse du fournisseur. */
const rediriger = (reply: FastifyReply, url: string, code: 302 | 303) =>
  reply.code(code).header('Location', url).send();

export const connexionUniqueRoutes = [
  /* ---------------------------------------------------------------- Connexion */
  route({
    method: 'GET',
    url: '/api/auth/sso/fournisseurs',
    summary: 'Connexion unique : fournisseurs d’identité proposés sur la page de connexion',
    tags: ['Authentification'],
    access: 'public',
    response: OptionsConnexionSsoOut,
    handler: async ({ svc }) => svc.connexionUnique.optionsConnexion(),
  }),
  route({
    method: 'GET',
    url: '/api/auth/sso/:id/connexion',
    summary: 'Connexion unique : départ vers le fournisseur (demande HTTP-Redirect, usage unique, 5 minutes)',
    tags: ['Authentification'],
    access: 'public',
    params: IdParams,
    query: z.object({ retour: z.string().max(500).optional() }).strict(),
    handler: async ({ svc, reply, ip, params, query }) => {
      if (!svc.limits.ssoByIp(ip)) throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
      const retour = retourInterne(query.retour);
      if (!retour)
        throw new HttpError(400, 'Chemin de retour refusé : un chemin interne à l’application est attendu.', {
          reason: 'retour',
        });
      let url: string;
      try {
        url = await svc.connexionUnique.demarrer(params.id, { but: 'connexion', retour });
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return rediriger(reply, '/login?sso=indisponible', 302);
        throw e;
      }
      return rediriger(reply, url, 302);
    },
  }),
  route({
    method: 'POST',
    url: URL_ACS_SAML,
    summary:
      'Connexion unique : adresse de retour (ACS, HTTP-POST du fournisseur) ; session ouverte puis redirection 303',
    tags: ['Authentification'],
    access: 'public',
    csrf: false,
    origineExterne: 'acs-saml',
    params: IdParams,
    bodyLimit: SSO_BORNES.corpsAcs,
    body: z.object({
      SAMLResponse: z.string().min(1).max(SSO_BORNES.corpsAcs),
      RelayState: z.string().max(200).optional(),
    }),
    handler: async ({ svc, req, reply, ip, params, body }) => {
      if (!svc.limits.ssoByIp(ip)) {
        await svc.db.audit(null, ip, 'auth.rate_limited', '', { sso: true });
        return rediriger(reply, '/login?sso=refus', 303);
      }
      const r = await svc.connexionUnique.valider(params.id, body.SAMLResponse);
      if (!r.ok) {
        await svc.db.audit(
          r.compte ?? (r.identifiant ? { username: r.identifiant.slice(0, 64) } : null),
          ip,
          'auth.sso_refus',
          '',
          {
            fournisseur: params.id,
            libelle: r.fournisseur,
            motif: r.motif,
            but: r.but,
            ...(r.identifiant ? { identifiant: r.identifiant.slice(0, 200) } : {}),
            ...(r.detail ? { detail: r.detail } : {}),
          },
        );
        // Refus pour double authentification absente ou signature invalide : alerte de sécurité (ADR 0074).
        if (r.motif === 'mfa_absente' || r.motif === 'signature' || r.motif === 'algorithme')
          await svc.connexionUnique.alerter([
            {
              type: r.motif === 'mfa_absente' ? 'refus_mfa' : 'refus_signature',
              fournisseurId: params.id,
              fournisseur: r.fournisseur ?? 'fournisseur inconnu',
              identifiant: r.compte?.username ?? r.identifiant,
              detail: r.motif,
            },
          ]);
        // Ré-authentification refusée : retour à la page de départ, qui demande toujours la confirmation.
        if (r.but === 'reauth' && r.retour) return rediriger(reply, r.retour, 303);
        return rediriger(reply, `/login?sso=${codeEchecSso(r.motif)}`, 303);
      }
      const qui = { id: r.userId, username: r.username };
      if (r.but === 'reauth') {
        const m = await svc.db.k
          .updateTable('sessions')
          .set({ reauth_at: sql<Date>`now()` })
          .where('id_hash', '=', r.sessionHash!)
          .where('user_id', '=', r.userId)
          .where('par_sso', '=', true)
          .executeTakeFirst();
        await svc.db.audit(qui, ip, 'auth.sso_reauth', '', {
          fournisseur: params.id,
          libelle: r.fournisseur,
          resultat: Number(m.numUpdatedRows) ? 'succes' : 'session_close',
        });
        return rediriger(reply, r.retour, 303);
      }
      // Session complète (double authentification prouvée par le fournisseur) ; le cookie SameSite=Strict, posé sur cette
      // réponse, accompagne les appels de l'interface (même origine) après la redirection.
      await svc.auth.create(req, reply, r.userId, true, undefined, { sso: true });
      await svc.db.k
        .updateTable('users')
        .set({ last_login_at: sql<Date>`now()`, failed_logins: 0, locked_until: null })
        .where('id', '=', r.userId)
        .execute();
      await svc.db.audit(qui, ip, 'auth.sso_succes', '', { fournisseur: params.id, libelle: r.fournisseur });
      return rediriger(reply, r.retour, 303);
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/reauth/sso',
    summary:
      'Ré-authentification d’un compte « connexion unique » : adresse du fournisseur (ForceAuthn), valable 5 minutes',
    tags: ['Compte'],
    access: 'session',
    body: ReauthSsoBody,
    response: ReauthSsoOut,
    handler: async ({ svc, s, body }) => {
      const sess = s as Session;
      if (svc.auth.stage(sess) !== 'ok') throw new HttpError(403, 'Authentification incomplète.');
      if (!sess.user.sso)
        throw new HttpError(
          409,
          'Ce compte se connecte localement : confirmez avec le mot de passe et le second facteur.',
          {
            reason: 'local',
          },
        );
      const retour = retourInterne(body.retour);
      if (!retour) throw new HttpError(400, 'Chemin de retour refusé.', { reason: 'retour' });
      const u = await svc.db.k
        .selectFrom('users')
        .select('sso_fournisseur_id')
        .where('id', '=', sess.user.id)
        .executeTakeFirstOrThrow();
      const url = await svc.connexionUnique.demarrer(u.sso_fournisseur_id!, {
        but: 'reauth',
        retour,
        userId: sess.user.id,
        sessionHash: sess.sid,
      });
      return { url };
    },
  }),

  /* ---------------------------------------------------------------- Administration */
  route({
    method: 'GET',
    url: '/api/admin/sso',
    summary: 'Connexion unique : service (entityID, certificat) et fournisseurs d’identité',
    tags: ['Administration'],
    access: 'administration:lire',
    response: ConnexionUniqueOut,
    handler: async ({ svc }) => ({ sp: svc.connexionUnique.sp(), fournisseurs: await svc.connexionUnique.lister() }),
  }),
  route({
    method: 'POST',
    url: '/api/admin/sso/fournisseurs',
    summary:
      'Connexion unique : nouveau fournisseur (une adresse de métadonnées ouvre le flux « sso-saml » après validation)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: FournisseurSsoBody,
    status: 201,
    response: FournisseurSsoOut,
    handler: async ({ svc, s, ip, reply, body }) => {
      const sess = s as Session;
      const id = await svc.db.tx((c, k) => svc.connexionUnique.creer(c, k, body, sess.user, ip), sess.user.username);
      const f = (await svc.connexionUnique.un(id))!;
      setEtag(reply, f.version);
      return f;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/sso/fournisseurs/:id',
    summary:
      'Connexion unique : modifier un fournisseur (If-Match ; adresse de métadonnées nouvelle : validation du flux)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: IdParams,
    body: FournisseurSsoBody,
    response: FournisseurSsoOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const attendue = requireIfMatch(req);
      await svc.db.tx(
        (c, k) => svc.connexionUnique.modifier(c, k, params.id, body, attendue, sess.user, ip),
        sess.user.username,
      );
      const f = (await svc.connexionUnique.un(params.id))!;
      setEtag(reply, f.version);
      return f;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/sso/fournisseurs/:id',
    summary: 'Connexion unique : supprimer un fournisseur sans compte rattaché',
    tags: ['Administration'],
    access: 'administration:supprimer',
    params: IdParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      await svc.db.tx((c, k) => svc.connexionUnique.supprimer(c, k, params.id, sess.user, ip), sess.user.username);
      return undefined;
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/sso/fournisseurs/:id/metadonnees',
    summary: 'Connexion unique : import manuel du fichier de métadonnées du fournisseur (secours, flux fermé)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: IdParams,
    body: ImportMetadonneesBody,
    bodyLimit: SSO_BORNES.metadonnees * 2,
    response: FournisseurSsoOut,
    handler: async ({ svc, s, ip, params, body }) => svc.connexionUnique.importer(params.id, body.xml, s!.user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/admin/sso/fournisseurs/:id/relire',
    summary: 'Connexion unique : relire les métadonnées au prochain passage de l’exécutant (flux ouvert)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: IdParams,
    body: Vide,
    status: 202,
    handler: async ({ svc, s, ip, params }) => {
      await svc.connexionUnique.demanderRelecture(params.id, s!.user, ip);
      return { demandee: true };
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/sso/fournisseurs/:id/metadonnees-sp',
    summary: 'Connexion unique : métadonnées du service pour ce fournisseur (fichier XML à importer chez lui)',
    tags: ['Administration'],
    access: 'administration:lire',
    params: IdParams,
    handler: async ({ svc, reply, params }) => {
      if (!(await svc.connexionUnique.existe(params.id))) throw new HttpError(404, 'Fournisseur introuvable.');
      const xml = svc.connexionUnique.metadonneesSp(params.id);
      setBaseHeaders(reply, CSP_FILE);
      return reply
        .header('Content-Type', 'application/samlmetadata+xml; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="metadonnees-service-suivi.xml"')
        .send(xml);
    },
  }),
];
