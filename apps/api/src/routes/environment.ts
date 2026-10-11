import { EnvironmentVersion, RiskExample } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

const definition = z.record(z.string(), z.unknown());
export const environmentRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/environment',
    summary: 'Configuration de l’environnement et version immuable',
    tags: ['Configuration'],
    access: 'administration:lire',
    response: EnvironmentVersion,
    handler: async ({ svc, reply }) => {
      const current = await svc.environment.current();
      setEtag(reply, current.version);
      return current;
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/environment/history',
    summary: 'Cent dernières publications de configuration (sans contenu métier)',
    tags: ['Configuration'],
    access: 'administration:lire',
    handler: async ({ svc }) => svc.environment.history(),
  }),
  route({
    method: 'GET',
    url: '/api/admin/environment/versions/:version',
    summary: 'Consulter une définition passée immuable',
    tags: ['Configuration'],
    access: 'administration:lire',
    params: z.object({ version: z.coerce.number().int().min(1).max(2147483647) }),
    response: EnvironmentVersion,
    handler: async ({ svc, params }) => svc.environment.version(params.version),
  }),
  route({
    method: 'POST',
    url: '/api/admin/environment/preview',
    summary: 'Valider et simuler un brouillon sans aucune écriture',
    tags: ['Configuration'],
    access: 'administration:administrer',
    body: z.object({ definition, example: RiskExample }).strict(),
    handler: async ({ svc, body }) => svc.environment.preview(body.definition, body.example),
  }),
  route({
    method: 'PUT',
    url: '/api/admin/environment',
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
    response: EnvironmentVersion,
    handler: async ({ svc, req, body, s, ip, reply }) => {
      const result = await svc.environment.publish(
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
