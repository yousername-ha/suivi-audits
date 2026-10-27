import { MODULE_REGISTRY, ModuleIntent } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

export const moduleRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/modules/history',
    summary: 'Historique immuable des changements d’activation',
    tags: ['Modules'],
    access: 'administration:lire',
    handler: async ({ svc }) =>
      svc.db.k
        .selectFrom('audit_log')
        .select(['id', 'ts as created_at', 'username', 'details'])
        .where('action', '=', 'modules.update')
        .orderBy('id', 'desc')
        .limit(200)
        .execute(),
  }),
  route({
    method: 'GET',
    url: '/api/modules',
    summary: 'Registre et activation des modules',
    tags: ['Modules'],
    access: 'auth',
    handler: async ({ svc, reply }) => {
      const state = await svc.modules.state();
      setEtag(reply, state.version);
      return { ...state, registry: MODULE_REGISTRY };
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/modules/preview',
    summary: 'Prévisualiser les conséquences (aucune écriture)',
    tags: ['Modules'],
    access: 'administration:administrer',
    body: ModuleIntent,
    moduleConfiguration: true,
    handler: async ({ svc, body }) => svc.modules.preview(await svc.modules.state(true), body),
  }),
  route({
    method: 'PUT',
    url: '/api/admin/modules',
    summary: 'Confirmer une activation ou désactivation prévisualisée',
    tags: ['Modules'],
    access: 'administration:administrer',
    moduleConfiguration: true,
    body: z
      .object({ intent: ModuleIntent, previewId: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.literal('VALIDER') })
      .strict(),
    handler: async ({ svc, s, req, ip, body, reply }) => {
      const next = await svc.modules.apply(body.intent, requireIfMatch(req), body.previewId, (s as Session).user, ip);
      setEtag(reply, next.version);
      return next;
    },
  }),
];
