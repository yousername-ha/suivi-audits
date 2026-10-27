import { SBOM_COMPOSANTS, UpdateReceipt, UpdateReceiptSummary, UpdateRequest, UpdateState } from '@suivi/shared';
import { z } from 'zod';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';

const ReceiptParams = z.object({ id: z.string().uuid() }).strict();
const SbomParams = z.object({ id: z.string().uuid(), composant: z.enum(SBOM_COMPOSANTS) }).strict();

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
    summary: 'Installer la publication disponible après confirmation et code de double authentification',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: UpdateRequest,
    status: 202,
    handler: async ({ svc, s, ip, body }) => {
      const user = s!.user;
      await svc.updates.assertAdmin(user);
      if (!svc.limits.updateMfaByUser(user.id))
        throw new HttpError(429, 'Trop de codes refusés. Réessayez dans quinze minutes.');
      // Le créneau est contrôlé avant le code : un refus horaire ne consomme pas le code saisi.
      await svc.updates.assertWindow();
      if (!(await svc.auth.checkTotp(user.id, body.code))) {
        await svc.db.audit(user, ip, 'update.install.mfa_failed', '', { target: body.version });
        throw new HttpError(401, 'Code de double authentification incorrect ou déjà utilisé.', {
          reason: 'mfa_failed',
        });
      }
      return svc.updates.request(user, ip, body);
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/updates/receipts',
    summary: 'Reçus des dernières installations (preuve de changement)',
    tags: ['Administration'],
    access: 'administration:administrer',
    response: z.array(UpdateReceiptSummary),
    handler: async ({ svc, s }) => {
      await svc.updates.assertAdmin(s!.user);
      return svc.updates.receipts();
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/updates/receipts/:id',
    summary: 'Télécharger le reçu d’une installation (JSON)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: ReceiptParams,
    response: UpdateReceipt,
    handler: async ({ svc, s, ip, params, reply }) => {
      await svc.updates.assertAdmin(s!.user);
      const receipt = svc.updates.receipt(params.id);
      await svc.db.audit(s!.user, ip, 'update.receipt.downloaded', receipt.id);
      reply.header('Content-Disposition', `attachment; filename="recu-mise-a-jour-${receipt.vers}-${receipt.id}.json"`);
      reply.header('Cache-Control', 'no-store');
      return receipt;
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/updates/receipts/:id/sbom/:composant',
    summary: 'Télécharger le SBOM CycloneDX vérifié d’un composant installé',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: SbomParams,
    handler: async ({ svc, s, ip, params, reply }) => {
      await svc.updates.assertAdmin(s!.user);
      const { vers, contenu } = svc.updates.sbom(params.id, params.composant);
      await svc.db.audit(s!.user, ip, 'update.sbom.downloaded', params.id, { composant: params.composant });
      reply.header('Content-Type', 'application/vnd.cyclonedx+json');
      reply.header(
        'Content-Disposition',
        `attachment; filename="sbom-suivi-audits-${params.composant}-${vers}.cdx.json"`,
      );
      reply.header('Cache-Control', 'no-store');
      return reply.send(contenu);
    },
  }),
];
