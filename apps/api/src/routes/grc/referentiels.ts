import { z } from 'zod';
import { EvaluationExigenceCorps, LibraryRequirementBody, PlanEcartsCorps } from '@suivi/shared';
import type { Session } from '../../auth.js';
import { route } from '../../http/route.js';
import { requireIfMatch } from '../../http/concurrency.js';
import { base, scope, object, publication } from './commun.js';

export const referentielsRoutes = [
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/frameworks/:id/history',
    summary: 'Publications versionnées des exigences',
    params: object,
    handler: async ({ svc, s, params }) => {
      await svc.grc.object(params.smsi, params.id, (s as Session).user);
      return svc.db.k
        .selectFrom('grc_framework_versions')
        .select(['version', 'definition', 'reason', 'created_by as createdBy', 'created_at as createdAt'])
        .where('framework_id', '=', params.id)
        .orderBy('version', 'desc')
        .limit(100)
        .execute();
    },
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/frameworks/preview',
    summary: 'Simuler une publication de référentiel',
    bodyLimit: 8 * 1024 * 1024,
    params: scope,
    body: z.object({ id: z.uuid().nullable(), definition: z.unknown() }).strict(),
    handler: async ({ svc, s, params, body }) =>
      svc.grc.frameworks.preview(params.smsi, body.id, body.definition, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/frameworks/publish',
    summary: 'Publier un référentiel et ses exigences versionnées',
    bodyLimit: 8 * 1024 * 1024,
    params: scope,
    body: publication.extend({ id: z.uuid().nullable() }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.frameworks.publish(
        params.smsi,
        body.id,
        body.definition,
        requireIfMatch(req),
        body.previewId,
        body.reason,
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/frameworks/:id/versions/:version',
    summary: 'Exigences de la version exacte d’un référentiel',
    params: object.extend({ version: z.coerce.number().int().positive() }),
    handler: async ({ svc, s, params }) =>
      svc.grc.frameworks.version(params.smsi, params.id, params.version, (s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/frameworks/:id/activation',
    summary: 'Activer un référentiel sans imposer ISO ou HDS',
    params: object,
    body: z.object({ enabled: z.boolean() }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.frameworks.activate(params.smsi, params.id, body.enabled, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'conformite:lire' as const,
    method: 'GET',
    url: '/api/library/frameworks',
    summary: 'Référentiels de la bibliothèque de l’organisation',
    handler: async ({ svc, s }) => svc.grc.library.list((s as Session).user),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'GET',
    url: '/api/library/tracker-import',
    summary: 'Référentiels de l’outil de suivi importables dans la bibliothèque (simulation, aucune écriture)',
    handler: async ({ svc, s }) => svc.grc.library.trackerPreview((s as Session).user),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/tracker-import',
    summary: 'Importer un référentiel de l’outil de suivi dans la bibliothèque',
    body: z
      .object({
        identifier: z.string().min(1).max(100),
        previewId: z.string().regex(/^[a-f0-9]{64}$/),
        confirm: z.literal('IMPORTER'),
      })
      .strict(),
    handler: async ({ svc, s, body, ip }) =>
      svc.grc.library.trackerImport(body.identifier, body.previewId, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/standards/adopt',
    summary: 'Rendre un standard de l’outil de suivi disponible dans la bibliothèque (version source verrouillée)',
    body: z.object({ identifier: z.string().min(1).max(100) }).strict(),
    handler: async ({ svc, s, body, ip }) => svc.grc.library.adoptStandard(body.identifier, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'conformite:lire' as const,
    method: 'GET',
    url: '/api/library/frameworks/:id/versions/:version',
    summary: 'Exigences de la version exacte d’un référentiel de la bibliothèque',
    params: z.object({ id: z.uuid(), version: z.coerce.number().int().positive() }),
    handler: async ({ svc, s, params }) => svc.grc.library.version(params.id, params.version, (s as Session).user),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/frameworks/preview',
    summary: 'Simuler la publication d’un référentiel dans la bibliothèque',
    bodyLimit: 8 * 1024 * 1024,
    body: z.object({ id: z.uuid().nullable(), definition: z.unknown() }).strict(),
    handler: async ({ svc, s, body }) => svc.grc.library.preview(body.id, body.definition, (s as Session).user),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/frameworks/publish',
    summary: 'Publier un référentiel ou une nouvelle version dans la bibliothèque',
    bodyLimit: 8 * 1024 * 1024,
    body: publication.extend({ id: z.uuid().nullable() }),
    handler: async ({ svc, s, body, req, ip }) =>
      svc.grc.library.publish(
        body.id,
        body.definition,
        requireIfMatch(req),
        body.previewId,
        body.reason,
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    access: 'conformite:lire' as const,
    method: 'GET',
    url: '/api/library/ia-kit',
    summary: 'Dernier kit IA importé : version, annexes de veille (statut juridique à revérifier)',
    handler: async ({ svc, s }) => svc.grc.kitIa.dernier((s as Session).user),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/ia-kit/preview',
    bodyLimit: 4 * 1024 * 1024,
    summary: 'Aperçu de l’import du kit IA (lecture seule : contrôles, correspondances résolues, annexes)',
    body: z.object({ kit: z.unknown() }).strict(),
    handler: async ({ svc, s, body }) => svc.grc.kitIa.apercu(body.kit, (s as Session).user),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/ia-kit/import',
    bodyLimit: 4 * 1024 * 1024,
    summary: 'Importer le kit IA : référentiel de la bibliothèque et annexes de veille (idempotent)',
    body: z
      .object({
        kit: z.unknown(),
        previewId: z.string().min(1).max(200),
        reason: z.string().trim().min(10).max(2000),
        confirm: z.literal('IMPORTER'),
      })
      .strict(),
    handler: async ({ svc, s, body, ip }) =>
      svc.grc.kitIa.importer(body.kit, body.previewId, body.reason, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/couverture',
    summary: 'Vue commune : couverture des exigences par référentiel rattaché',
    params: scope,
    query: z.object({ frameworkId: z.uuid().optional() }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.couverture.coverage(params.smsi, (s as Session).user, query.frameworkId),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/plan-ecarts',
    summary: 'Aperçu du plan d’action des écarts d’un référentiel (lecture seule)',
    params: scope,
    query: z.object({ frameworkId: z.uuid() }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.planEcarts.apercu(params.smsi, query.frameworkId, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/plan-ecarts',
    summary: 'Créer les actions manquantes pour des exigences en écart (idempotent)',
    params: scope,
    status: 201,
    body: PlanEcartsCorps,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.planEcarts.creer(params.smsi, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/exigences/:frameworkId/:requirementId/evaluations',
    summary:
      'Historique des évaluations d’une exigence dans le périmètre (versions immuables, la plus récente d’abord)',
    params: scope.extend({ frameworkId: z.uuid(), requirementId: z.string().min(1).max(200) }),
    handler: async ({ svc, s, params }) =>
      svc.grc.evaluations.historique(params.smsi, params.frameworkId, params.requirementId, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/exigences/:frameworkId/:requirementId/evaluations',
    summary:
      'Enregistrer une nouvelle version de l’évaluation d’une exigence (applicabilité, mise en œuvre, test, validation métier)',
    params: scope.extend({ frameworkId: z.uuid(), requirementId: z.string().min(1).max(200) }),
    status: 201,
    body: EvaluationExigenceCorps,
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.evaluations.evaluer(
        params.smsi,
        params.frameworkId,
        params.requirementId,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/framework-attachments',
    summary: 'Référentiels du périmètre : copies propres et copies héritées, avec leur statut',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.library.attachments(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/framework-attachments/:id',
    summary:
      'Attribuer un référentiel de la bibliothèque au périmètre (copie propre au périmètre, en préparation par défaut), ' +
      'ou reprendre une autre édition de la bibliothèque dans sa copie',
    params: object,
    body: z
      .object({
        version: z.number().int().positive(),
        statut: z.enum(['preparation', 'applique']).optional(),
        confirm: z.literal('RATTACHER'),
      })
      .strict(),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.library.attach(params.smsi, params.id, body.version, (s as Session).user, ip, body.statut),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/framework-attachments/:id/statut',
    summary: 'Appliquer la copie du périmètre (suivi de conformité) ou la repasser en préparation',
    params: object,
    body: z.object({ statut: z.enum(['preparation', 'applique']), confirm: z.literal('APPLIQUER') }).strict(),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.library.setStatus(params.smsi, params.id, body.statut, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/framework-copies/:id',
    summary: 'Copie du référentiel dans le périmètre : exigences, statut et historique des versions',
    params: object,
    query: z.object({ version: z.coerce.number().int().positive().optional() }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.copies.lire(params.smsi, params.id, (s as Session).user, query.version),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/framework-copies/:id',
    summary: 'Renommer la copie du référentiel dans le périmètre',
    params: object,
    body: z
      .object({
        name: z.string().trim().min(1).max(200),
        expectedVersion: z.number().int().positive(),
      })
      .strict(),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.copies.renommer(params.smsi, params.id, body.name, body.expectedVersion, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/framework-copies/:id/requirements',
    summary: 'Ajouter ou modifier une exigence dans la copie du référentiel du périmètre',
    params: object,
    body: LibraryRequirementBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.copies.enregistrerExigence(params.smsi, params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/framework-copies/:id/requirements/:requirementId',
    summary: 'Retirer une exigence de la copie du référentiel du périmètre (version attendue en If-Match)',
    params: object.extend({ requirementId: z.string().min(1).max(200) }),
    handler: async ({ svc, s, params, req, ip }) =>
      svc.grc.copies.retirerExigence(
        params.smsi,
        params.id,
        params.requirementId,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/framework-attachments/:id/activation',
    summary: 'Activer ou désactiver un référentiel rattaché',
    params: object,
    body: z.object({ enabled: z.boolean() }).strict(),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.library.setEnabled(params.smsi, params.id, body.enabled, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/framework-attachments/:id',
    summary: 'Détacher un référentiel de la bibliothèque du périmètre',
    params: object,
    handler: async ({ svc, s, params, ip }) => svc.grc.library.detach(params.smsi, params.id, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/frameworks/:id/promotion/preview',
    summary: 'Simuler la promotion d’un référentiel du périmètre vers la bibliothèque',
    params: object,
    handler: async ({ svc, s, params }) =>
      svc.grc.library.promotionPreview(params.smsi, params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/frameworks/:id/promotion',
    summary: 'Promouvoir un référentiel du périmètre dans la bibliothèque',
    params: object,
    body: z.object({ previewId: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.literal('PROMOUVOIR') }).strict(),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.library.promote(params.smsi, params.id, body.previewId, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/import/preview',
    summary: 'Simulation locale d’importation',
    params: scope,
    body: z.object({ data: z.unknown() }),
    bodyLimit: 8 * 1024 * 1024,
    handler: async ({ svc, s, params, body }) =>
      svc.grc.frameworks.importPreview(params.smsi, body.data, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/import/commit',
    summary: 'Importation atomique confirmée par un humain',
    params: scope,
    body: z
      .object({ data: z.unknown(), previewId: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.literal('IMPORTER') })
      .strict(),
    bodyLimit: 8 * 1024 * 1024,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.frameworks.import(params.smsi, body.data, body.previewId, (s as Session).user, ip),
  }),
];
