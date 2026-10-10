import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

const definition = z.record(z.string(), z.unknown());
export const businessPolicyRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/business-policy',
    summary: 'Configuration de l’environnement et version immuable',
    tags: ['Configuration'],
    access: 'administration:lire',
    handler: async ({ svc, reply }) => {
      const current = await svc.businessPolicies.current();
      setEtag(reply, current.version);
      return current;
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/business-policy/history',
    summary: 'Cent dernières publications de configuration (sans contenu métier)',
    tags: ['Configuration'],
    access: 'administration:lire',
    handler: async ({ svc }) => svc.businessPolicies.history(),
  }),
  route({
    method: 'GET',
    url: '/api/admin/business-policy/versions/:version',
    summary: 'Consulter une définition passée immuable',
    tags: ['Configuration'],
    access: 'administration:lire',
    params: z.object({ version: z.coerce.number().int().min(1).max(2147483647) }),
    handler: async ({ svc, params }) => svc.businessPolicies.version(params.version),
  }),
  route({
    method: 'POST',
    url: '/api/admin/business-policy/preview',
    summary: 'Valider et simuler un brouillon sans aucune écriture',
    tags: ['Configuration'],
    access: 'administration:administrer',
    body: z.object({ definition }).strict(),
    handler: async ({ svc, body }) => svc.businessPolicies.preview(body.definition),
  }),
  route({
    method: 'PUT',
    url: '/api/admin/business-policy',
    summary: 'Publier une nouvelle version prévisualisée, avec audit transactionnel',
    tags: ['Configuration'],
    access: 'administration:administrer',
    body: z
      .object({
        definition,
        previewId: z.string().regex(/^[a-f0-9]{64}$/),
        reason: z.string().trim().min(5).max(1000),
        confirm: z.literal('PUBLIER'),
      })
      .strict(),
    handler: async ({ svc, req, body, s, ip, reply }) => {
      const result = await svc.businessPolicies.publish(
        body.definition,
        requireIfMatch(req),
        body.previewId,
        body.reason,
        (s as Session).user,
        ip,
      );
      setEtag(reply, result.version);
      return result;
    },
  }),
];
