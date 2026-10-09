/* Lot A : RBAC, MFA et CSRF communs via route(), aucune exécution HTTP. */
import { BackupPolicyIn, BackupPolicyOut, ExploitationOut, OperationIn, OperationOut } from '@suivi/shared';
import { z } from 'zod';
import { route } from '../http/route.js';
import { requireIfMatch } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';

export const operationRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/exploitation',
    summary: 'Catalogue, politique, TLS et journal durable des opérations',
    tags: ['Administration'],
    access: 'administration:lire',
    response: ExploitationOut,
    handler: async ({ svc }) => svc.operations.list(),
  }),
  route({
    method: 'PUT',
    url: '/api/admin/exploitation/politique',
    summary: 'Configurer planification UTC et rétention (If-Match)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: BackupPolicyIn,
    response: BackupPolicyOut,
    handler: async ({ svc, s, ip, req, body }) => svc.operations.setPolicy(body, requireIfMatch(req), s!.user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/admin/exploitation/operations',
    summary: 'Demander vérification, restauration confirmée ou changement TLS',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: OperationIn,
    response: OperationOut,
    status: 202,
    handler: async ({ svc, s, ip, req, body }) => {
      if (body.kind === 'tls_install' && req.protocol !== 'https')
        throw new HttpError(422, 'Une connexion HTTPS est requise pour transmettre une clé privée.');
      return svc.operations.request(body, s!.user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/exploitation/operations/:id/annuler',
    summary: 'Annuler une opération en attente (If-Match)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: z.object({ id: z.string().uuid() }),
    body: z.object({}).strict(),
    response: OperationOut,
    handler: async ({ svc, s, ip, req, params }) => svc.operations.cancel(params.id, requireIfMatch(req), s!.user, ip),
  }),
];
