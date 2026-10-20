/* Import Tenacy (écarts de l'onglet « Gaps »). Le navigateur lit le classeur et envoie les lignes ; la simulation ne
   modifie rien, l'application refuse des lignes différentes de celles simulées (empreinte). */
import { TenacyApplication, TenacyBody } from '@suivi/shared';
import type { Session } from '../auth.js';
import { route } from '../http/route.js';
import { ImportTenacy } from '../tenacy.js';

const base = { tags: ['Import Tenacy'], access: 'import_export:modifier' as const };

export const tenacyRoutes = [
  route({
    ...base,
    method: 'POST',
    url: '/api/admin/import/tenacy/simulate',
    summary: 'Simulation de l’import Tenacy : écarts et actions créés ou mis à jour, AUCUNE écriture',
    body: TenacyBody,
    bodyLimit: () => 16 * 1024 * 1024,
    handler: async ({ svc, s, body }) => new ImportTenacy(svc.grc).simuler((s as Session).user, body),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/admin/import/tenacy/apply',
    summary: 'Application de l’import Tenacy simulé (une transaction, journal d’audit, temps réel)',
    body: TenacyApplication,
    bodyLimit: () => 16 * 1024 * 1024,
    status: 201,
    handler: async ({ svc, s, ip, body }) =>
      new ImportTenacy(svc.grc).appliquer((s as Session).user, ip, body, body.empreinte),
  }),
];
