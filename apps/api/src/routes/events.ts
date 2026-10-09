/* Flux temps réel (Server-Sent Events) et présence. */
import { canReceive, PresenceBody, type ChangeEvent } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { BASE_HEADERS, CSP_STRICT } from '../http/security.js';

const PING_MS = 25_000;
const RECHECK_MS = 60_000;

export const eventRoutes = [
  route({
    method: 'GET',
    url: '/api/events',
    summary: 'Flux SSE : changements (entité, id, version, auteur), présence ; filtré selon le rôle',
    tags: ['Temps réel'],
    access: 'auth',
    handler: async ({ svc, s, req, reply }) => {
      const sess = s as Session;
      const granted = (await svc.auth.loadByHash(sess.sid, false))!.user.rights;
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        ...BASE_HEADERS,
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
      // Le navigateur se reconnecte seul après 3 s ; à la reconnexion, le client recharge ses données.
      res.write('retry: 3000\n\n');
      send('hello', {
        user: sess.user.username,
        roles: sess.user.roles,
        presence: svc.presence.visibleTo(sess.user.rights),
      });

      const onChange = (e: ChangeEvent) => {
        void svc.modules
          .rights(granted, true)
          .then((rights) => {
            if (canReceive(rights, e.entity)) send('change', e);
          })
          .catch(() => close());
      };
      const onPresence = () => {
        void svc.modules
          .rights(granted, true)
          .then((rights) => send('presence', svc.presence.visibleTo(rights)))
          .catch(() => close());
      };
      svc.bus.on('change', onChange);
      svc.presence.on('update', onPresence);

      const ping = setInterval(() => open && res.write(`: ping ${Date.now()}\n\n`), PING_MS);
      // Revalidation périodique : une session fermée ou expirée, ou des droits modifiés, coupent le flux.
      const recheck = setInterval(() => {
        svc.auth
          .loadByHash(sess.sid, false)
          .then((cur) => {
            if (!cur || cur.user.rights.list().join() !== granted.list().join() || svc.auth.stage(cur) !== 'ok') {
              send('logout', { reason: 'session' });
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
        svc.presence.off('update', onPresence);
        res.end();
      };
      req.raw.on('close', close);
      res.on('error', close);
      return reply;
    },
  }),
  route({
    method: 'GET',
    url: '/api/presence',
    summary: 'Présence courante (qui consulte ou modifie quoi)',
    tags: ['Temps réel'],
    access: 'auth',
    handler: async ({ svc, s }) => svc.presence.visibleTo((s as Session).user.rights),
  }),
  route({
    method: 'POST',
    url: '/api/presence',
    summary: 'Déclaration de présence (renouvelée toutes les 20 s par l’interface)',
    tags: ['Temps réel'],
    access: 'auth',
    body: PresenceBody,
    handler: async ({ svc, s, body }) => {
      const sess = s as Session;
      if (!svc.limits.presence(body.client)) throw new HttpError(429, 'Trop de requêtes.');
      if (body.resource.startsWith('documents')) await svc.modules.assert('documents');
      if (body.resource.startsWith('carto')) await svc.modules.assert('cartographie');
      if (body.resource.startsWith('admin') && !sess.user.rights.can('administration', 'lire'))
        throw new HttpError(403, 'Réservé à l’administration.');
      await svc.presence.publish('set', {
        client: body.client,
        username: sess.user.username,
        name: sess.user.displayName || sess.user.username,
        resource: body.resource,
        mode: body.mode,
        since: new Date().toISOString(),
      });
      return undefined;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/presence/:client',
    summary: 'Fin de présence (fermeture de l’onglet)',
    tags: ['Temps réel'],
    access: 'auth',
    params: z.object({ client: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }),
    handler: async ({ svc, s, params }) => {
      const sess = s as Session;
      const mine = svc.presence.list().find((e) => e.client === params.client);
      if (mine && mine.username !== sess.user.username) throw new HttpError(403, 'Présence d’un autre utilisateur.');
      if (mine) await svc.presence.publish('leave', mine);
      return undefined;
    },
  }),
];
