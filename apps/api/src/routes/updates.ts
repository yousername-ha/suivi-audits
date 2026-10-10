import { UpdateRequest, UpdateState } from '@suivi/shared';
import { z } from 'zod';
import { route } from '../http/route.js';

export const updateRoutes = [
  route({
    method: 'GET',
    url: '/api/updates',
    summary: 'Disponibilité des mises à jour pour tous les comptes',
    tags: ['Système'],
    access: 'auth',
    response: UpdateState,
    handler: async ({ svc }) => svc.updates.state(),
  }),
  route({
    method: 'POST',
    url: '/api/admin/updates/check',
    summary: 'Vérifier manuellement les publications GitHub',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: z.object({}).strict(),
    status: 202,
    handler: async ({ svc, s, ip }) => svc.updates.request(s!.user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/admin/updates/install',
    summary: 'Installer la publication disponible après confirmation',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: UpdateRequest,
    status: 202,
    handler: async ({ svc, s, ip, body }) => svc.updates.request(s!.user, ip, body),
  }),
];
