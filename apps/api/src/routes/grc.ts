import { z } from 'zod';
import {
  CalendrierBody,
  EvaluationExigenceCorps,
  GRC_KINDS,
  GrcObjectBody,
  GrcRef,
  SmsiCreate,
  SmsiMember,
  SmsiUpdate,
  LibraryCopyBody,
  LibraryMappingBody,
  LibraryRequirementBody,
  RapprochementDecision,
  SupplierBody,
  SupplierCriterionBody,
  SupplierEvaluationBody,
  SupplierFollowUpBody,
  SupplierUpdateBody,
  LinkBody,
  methodTemplate,
} from '@suivi/shared';
import type { Session } from '../auth.js';
import { cartesPerimetres } from '../grc/cartes.js';
import { dashboard } from '../grc/dashboard.js';
import { etudeEbios, registreRisques } from '../grc/registre-risques.js';
import { report } from '../grc/report.js';
import { sources } from '../grc/sources.js';
import { route } from '../http/route.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
const base = { tags: ['SMSI GRC'], access: 'metier' as const };
const scope = z.object({ smsi: z.uuid() });
const object = scope.extend({ id: z.uuid() });
const supplierParam = z.object({ id: z.string().min(1).max(200) });
const criterionParam = z.object({ id: z.uuid() });
const publication = z
  .object({
    definition: z.unknown(),
    previewId: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.string().trim().min(10).max(1000),
    confirm: z.literal('PUBLIER'),
  })
  .strict();
const evaluation = z
  .object({
    ratings: z.unknown(),
    rationale: z.string().trim().min(10).max(10000),
    decision: z.enum(['draft', 'approved']),
  })
  .strict();
export const grcRoutes = [
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/tasks',
    summary: 'Liste paginée des actions natives et historiques sans duplication',
    params: scope,
    query: z.object({
      search: z.string().max(200).default(''),
      offset: z.coerce.number().int().min(0).max(1000000).default(0),
      status: z.string().max(64).optional(),
      ownerId: z.uuid().optional(),
    }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.list(params.smsi, (s as Session).user, query.search, query.offset, {
        status: query.status,
        ownerId: query.ownerId,
      }),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/method',
    summary: 'Choisir la version méthodologique par défaut du SMSI, sans recalculer le registre',
    params: scope,
    body: z.object({ methodId: z.uuid(), version: z.number().int().positive(), confirm: z.literal('CHOISIR') }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.selectMethod(params.smsi, body.methodId, body.version, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/member-candidates',
    summary: 'Comptes actifs proposés pour les membres du périmètre',
    params: scope,
    handler: async ({ svc, s, params }) => {
      const u = (s as Session).user;
      await svc.grc.permission(u, 'pilotage', 'administrer');
      await svc.grc.access(params.smsi, u, true);
      return (
        await svc.db.q(
          'SELECT id,username,display_name AS "displayName" FROM users WHERE NOT disabled AND (expires_at IS NULL OR expires_at>now()) ORDER BY username LIMIT 1000',
        )
      ).rows;
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/dashboard',
    summary: 'Tableau de bord SMSI selon les référentiels activés, la politique et les droits',
    params: scope,
    handler: async ({ svc, s, params }) => dashboard(svc.grc, params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/frameworks/:id/history',
    summary: 'Publications versionnées des exigences',
    params: object,
    handler: async ({ svc, s, params }) => {
      await svc.grc.object(params.smsi, params.id, (s as Session).user);
      return (
        await svc.db.q(
          'SELECT version,definition,reason,created_by AS "createdBy",created_at AS "createdAt" FROM grc_framework_versions WHERE framework_id=$1 ORDER BY version DESC LIMIT 100',
          [params.id],
        )
      ).rows;
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/report',
    summary: 'Rapport comité SMSI et audit, filtré par les droits',
    params: scope,
    handler: async ({ svc, s, params, ip }) => report(svc.grc, params.smsi, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/policy',
    summary: 'Adopter explicitement une politique métier compatible',
    params: scope,
    body: z.object({ version: z.number().int().positive(), confirm: z.literal('ADOPTER') }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.adoptPolicy(params.smsi, body.version, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/export/authorize',
    summary: 'Autoriser et tracer un export du périmètre',
    params: scope,
    query: z.object({ kind: z.enum(['risks', 'frameworks', 'tasks']) }),
    handler: async ({ svc, s, params, query, ip }) => {
      const u = (s as Session).user;
      await svc.grc.access(params.smsi, u);
      await svc.grc.permission(u, 'import_export', 'exporter');
      await svc.grc.permission(
        u,
        query.kind === 'risks' ? 'pilotage' : query.kind === 'tasks' ? 'ecarts' : 'conformite',
        'lire',
      );
      await svc.grc.permission(
        u,
        query.kind === 'risks' ? 'cartographie' : query.kind === 'tasks' ? 'ecarts' : 'conformite',
        'exporter',
      );
      await svc.db.audit(u, ip, 'grc.export', params.smsi, { kind: query.kind });
      return { ok: true };
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/sources',
    summary: 'Sélectionner un objet ou une version de preuve existants',
    params: scope,
    query: z.object({
      search: z.string().max(200).default(''),
      /** Cibles d'un champ typé (« object:<type> », « legacy:<clé> », « requirement » ou « document » (versions de documents), séparées par des virgules). */
      cibles: z
        .string()
        .max(500)
        .regex(
          /^((object|legacy):[a-z_]{2,40}|requirement|document)(,((object|legacy):[a-z_]{2,40}|requirement|document))*$/,
        )
        .optional(),
    }),
    handler: async ({ svc, s, params, query }) =>
      sources(svc.grc, params.smsi, (s as Session).user, query.search, query.cibles?.split(',')),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/legacy-tasks/complete',
    summary: 'Réaliser une action historique sans créer de copie',
    body: z.object({
      ref: GrcRef,
      sourceSha: z.string().regex(/^[a-f0-9]{64}$/),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      comment: z.string().trim().min(10).max(5000),
      proof: z.string().max(5000),
      confirm: z.literal('REALISER'),
    }),
    handler: async ({ svc, s, body, req, ip }) =>
      svc.grc.legacyTasks.complete(
        body.ref,
        requireIfMatch(req),
        body.sourceSha,
        { date: body.date, comment: body.comment, proof: body.proof },
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/smsis',
    summary: 'SMSI accessibles',
    handler: async ({ svc, s }) => svc.grc.listSmsis((s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/perimetres/synthese',
    summary: 'Cartes de périmètres : compteurs de synthèse par périmètre accessible (null : indisponible)',
    access: 'auth',
    handler: async ({ svc, s }) => cartesPerimetres(svc.grc, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/smsis',
    summary: 'Créer un périmètre SMSI restreint',
    body: SmsiCreate,
    handler: async ({ svc, s, body, ip }) => svc.grc.createSmsi(body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'PATCH',
    url: '/api/grc/smsis/:smsi',
    summary: 'Modifier le nom, le texte, la nature et le fuseau d’un périmètre',
    params: scope,
    body: SmsiUpdate,
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.updateSmsi(params.smsi, body, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/members',
    summary: 'Membres du SMSI',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.members(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/members',
    summary: 'Attribuer un accès au SMSI',
    params: scope,
    body: SmsiMember,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.setMember(params.smsi, body.userId, body.write, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/members/:id',
    summary: 'Révoquer un accès au SMSI',
    params: object,
    handler: async ({ svc, s, params, ip }) => svc.grc.setMember(params.smsi, params.id, null, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/policy',
    summary: 'Politique métier épinglée au SMSI',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.policy(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/owners',
    summary: 'Responsables autorisés',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.owners(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/objects',
    summary: 'Registre paginé sans duplication',
    params: scope,
    query: z
      .object({
        kind: z.enum(GRC_KINDS),
        search: z.string().max(200).default(''),
        offset: z.coerce.number().int().min(0).max(1000000).default(0),
        status: z.string().max(64).optional(),
        ownerId: z.uuid().optional(),
        domain: z.string().max(120).optional(),
        scope: z.string().max(200).optional(),
        relatedRef: GrcRef.optional(),
        entity: z.string().max(200).optional(),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) => {
      const { kind, search, offset, ...filters } = query;
      return svc.grc.listObjects(params.smsi, (s as Session).user, kind, search, offset, filters);
    },
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/objects',
    summary: 'Créer une fiche liée au SMSI',
    params: scope,
    body: GrcObjectBody,
    handler: async ({ svc, s, params, body, ip, reply }) => {
      const o = await svc.grc.createObject(params.smsi, body, (s as Session).user, ip);
      setEtag(reply, o.version);
      return o;
    },
  }),
  route({
    ...base,
    // Session complète : un droit de lecture attribué sur un registre (ADR 0043) suffit sans droit de module ; le service
    // refuse (403) tout objet qui n'est ni dans un registre accessible ni lisible par les droits de module et périmètres.
    access: 'auth',
    method: 'GET',
    url: '/api/grc/:smsi/objects/:id',
    summary: 'Consulter une fiche',
    params: object,
    handler: async ({ svc, s, params, reply }) => {
      const o = await svc.grc.object(params.smsi, params.id, (s as Session).user);
      setEtag(reply, o.version);
      return o;
    },
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/objects/:id',
    summary: 'Modifier avec contrôle de concurrence',
    params: object,
    body: GrcObjectBody,
    handler: async ({ svc, s, params, body, ip, req, reply }) => {
      const o = await svc.grc.updateObject(params.smsi, params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, o.version);
      return o;
    },
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/objects/:id',
    summary: 'Archiver sans supprimer les décisions',
    params: object,
    handler: async ({ svc, s, params, ip, req }) =>
      svc.grc.archive(params.smsi, params.id, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/objects/:id/history',
    summary: 'Historique immuable des fiches',
    params: object,
    query: z.object({ before: z.coerce.number().int().positive().default(2147483647) }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.history(params.smsi, params.id, (s as Session).user, query.before),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/links',
    summary: 'Relations bidirectionnelles filtrées par les droits',
    params: scope,
    query: z.object({ ref: GrcRef }),
    handler: async ({ svc, s, params, query }) => svc.grc.links(params.smsi, query.ref, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/links',
    summary: 'Lier deux objets existants',
    params: scope,
    body: LinkBody.extend({ source: GrcRef }),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.link(params.smsi, body.source, body.target, body.type, body.note, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/links/:id',
    summary: 'Retirer une relation',
    params: object,
    handler: async ({ svc, s, params, ip }) => svc.grc.unlink(params.smsi, params.id, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/tasks/window',
    summary: 'Actions synchronisées pour calendrier et planning',
    params: scope,
    query: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).refine((q) => q.from <= q.to),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.window(params.smsi, (s as Session).user, query.from, query.to),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/tasks/dashboard',
    summary: 'Indicateurs d’actions selon le workflow du SMSI',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.tasks.dashboard(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/series/:id/occurrences',
    summary: 'Occurrences uniques et historique de récurrence',
    params: object,
    query: z.object({ before: z.string().max(200).optional() }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.occurrences(params.smsi, params.id, (s as Session).user, query.before),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/series/:id/prochaine',
    summary: 'Occurrence suivante à traiter (la plus ancienne non validée dont la fenêtre est ouverte)',
    params: object,
    query: z.object({ apres: z.uuid().optional() }).strict(),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.prochaine(params.smsi, params.id, (s as Session).user, query.apres),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/occurrences/prochaine',
    summary:
      'Occurrence suivante à traiter dans la liste courante de la personne (ordre conservé, toutes séries confondues)',
    params: scope,
    query: z
      .object({
        apres: z.uuid(),
        liste: z
          .string()
          .max(40_000)
          .regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(,[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})*$/),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.prochaineDansListe(params.smsi, query.liste.split(','), query.apres, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/series/:id/calendrier',
    summary: 'Importer un calendrier iCalendar dans les jours exclus d’une série (aperçu, puis import tout ou rien)',
    params: object,
    body: CalendrierBody,
    handler: async ({ svc, s, params, body, ip, req }) =>
      svc.grc.tasks.importerCalendrier(
        params.smsi,
        params.id,
        body,
        body.apercu ? 0 : requireIfMatch(req),
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/notifications',
    summary: 'Rappels personnels respectant les accès SMSI',
    handler: async ({ svc, s }) => svc.grc.tasks.notifications((s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/notifications/:id/read',
    summary: 'Marquer un rappel comme lu',
    params: z.object({ id: z.uuid() }),
    handler: async ({ svc, s, params }) => svc.grc.tasks.read(params.id, (s as Session).user),
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
    method: 'POST',
    url: '/api/grc/:smsi/mappings/:id/validate',
    summary: 'Décision humaine sur une correspondance',
    params: object,
    body: z.object({ note: z.string().trim().min(10).max(5000), confirm: z.literal('VALIDER') }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.frameworks.validate(params.smsi, params.id, requireIfMatch(req), body.note, (s as Session).user, ip),
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
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/frameworks/:id/copy',
    summary: 'Créer une copie personnalisable d’un référentiel de la bibliothèque',
    params: z.object({ id: z.uuid() }),
    body: LibraryCopyBody,
    handler: async ({ svc, s, params, body, ip }) => svc.grc.library.copy(params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/frameworks/:id/requirements',
    summary: 'Ajouter ou modifier une exigence dans une copie (une version source est verrouillée)',
    params: z.object({ id: z.uuid() }),
    body: LibraryRequirementBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.library.upsertRequirement(params.id, body, (s as Session).user, ip),
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
    url: '/api/library/mappings',
    summary: 'Correspondances organisationnelles entre exigences de la bibliothèque',
    query: z.object({
      frameworkId: z.uuid().optional(),
      status: z.enum(['proposed', 'validated', 'withdrawn']).optional(),
    }),
    handler: async ({ svc, s, query }) => svc.grc.libraryMappings.list((s as Session).user, query),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'POST',
    url: '/api/library/mappings',
    summary: 'Proposer une correspondance entre deux exigences de la bibliothèque',
    body: LibraryMappingBody,
    handler: async ({ svc, s, body, ip }) => svc.grc.libraryMappings.create(body, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'conformite:modifier' as const,
    method: 'PUT',
    url: '/api/library/mappings/:id',
    summary: 'Modifier une correspondance proposée',
    params: z.object({ id: z.uuid() }),
    body: LibraryMappingBody,
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.libraryMappings.update(params.id, body, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'conformite:administrer' as const,
    method: 'POST',
    url: '/api/library/mappings/:id/validate',
    summary: 'Décision humaine : valider une correspondance pour toute l’organisation',
    params: z.object({ id: z.uuid() }),
    body: z.object({ note: z.string().trim().min(10).max(5000), confirm: z.literal('VALIDER') }).strict(),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.libraryMappings.validate(params.id, requireIfMatch(req), body.note, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'conformite:administrer' as const,
    method: 'POST',
    url: '/api/library/mappings/:id/withdraw',
    summary: 'Retirer une correspondance',
    params: z.object({ id: z.uuid() }),
    body: z.object({ note: z.string().trim().min(10).max(5000), confirm: z.literal('RETIRER') }).strict(),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.libraryMappings.withdraw(params.id, requireIfMatch(req), body.note, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'fournisseurs:lire' as const,
    method: 'GET',
    url: '/api/suppliers',
    summary: 'Fournisseurs de l’organisation avec leur évaluation courante',
    handler: async ({ svc, s }) => svc.grc.suppliers.list((s as Session).user),
  }),
  route({
    ...base,
    access: 'fournisseurs:modifier' as const,
    method: 'POST',
    url: '/api/suppliers',
    summary: 'Ajouter un fournisseur au registre de l’organisation',
    body: SupplierBody,
    handler: async ({ svc, s, body, ip }) => svc.grc.suppliers.create(body, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'fournisseurs:modifier' as const,
    method: 'PATCH',
    url: '/api/suppliers/:id',
    summary: 'Modifier un fournisseur du registre (MFA, SSO, criticité, HDS, certificats, contrôles…)',
    params: z.object({ id: z.string().min(1).max(60) }),
    body: SupplierUpdateBody,
    handler: async ({ svc, s, params, body, ip }) => svc.grc.suppliers.update(params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'fournisseurs:lire' as const,
    method: 'GET',
    url: '/api/suppliers/criteria',
    summary: 'Critères d’évaluation des fournisseurs définis par l’organisme',
    query: z.object({ archived: z.enum(['true', 'false']).default('false') }),
    handler: async ({ svc, s, query }) => svc.grc.suppliers.criteria((s as Session).user, query.archived === 'true'),
  }),
  route({
    ...base,
    access: 'fournisseurs:administrer' as const,
    method: 'POST',
    url: '/api/suppliers/criteria',
    summary: 'Définir un critère d’évaluation des fournisseurs',
    body: SupplierCriterionBody,
    handler: async ({ svc, s, body, ip }) => svc.grc.suppliers.createCriterion(body, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'fournisseurs:administrer' as const,
    method: 'PUT',
    url: '/api/suppliers/criteria/:id',
    summary: 'Modifier un critère (nouvelle version, instantané conservé)',
    params: criterionParam,
    body: SupplierCriterionBody,
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.suppliers.updateCriterion(params.id, body, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'fournisseurs:administrer' as const,
    method: 'POST',
    url: '/api/suppliers/criteria/:id/archive',
    summary: 'Retirer un critère des nouvelles évaluations',
    params: criterionParam,
    body: z.object({ reason: z.string().trim().min(5).max(2000), confirm: z.literal('RETIRER') }).strict(),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.suppliers.archiveCriterion(params.id, requireIfMatch(req), body.reason, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'fournisseurs:lire' as const,
    method: 'GET',
    url: '/api/suppliers/:id/evaluations',
    summary: 'Évaluations d’un fournisseur (la plus récente est la courante)',
    params: supplierParam,
    handler: async ({ svc, s, params }) => svc.grc.suppliers.evaluations(params.id, (s as Session).user),
  }),
  route({
    ...base,
    access: 'fournisseurs:modifier' as const,
    method: 'POST',
    url: '/api/suppliers/:id/evaluations',
    summary: 'Enregistrer une évaluation immuable, indépendante des périmètres',
    params: supplierParam,
    body: SupplierEvaluationBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.suppliers.evaluate(params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    access: 'fournisseurs:modifier' as const,
    method: 'POST',
    url: '/api/suppliers/:id/evaluations/:evaluationId/follow-up',
    summary: 'Créer, dans un périmètre choisi, une action ou une série de réévaluation à la suite d’une évaluation',
    params: supplierParam.extend({ evaluationId: z.uuid() }),
    body: SupplierFollowUpBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.suppliers.followUp(params.id, params.evaluationId, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/suppliers',
    summary: 'Fournisseurs rattachés au périmètre et leur évaluation courante (lecture, sans copie)',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.suppliers.forScope(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/suppliers/:supplierId',
    summary: 'Rattacher un fournisseur au périmètre (sans donnée d’évaluation)',
    params: scope.extend({ supplierId: z.string().min(1).max(200) }),
    handler: async ({ svc, s, params, ip }) =>
      svc.grc.suppliers.attach(params.smsi, params.supplierId, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/suppliers/:supplierId',
    summary: 'Retirer le rattachement (le fournisseur et ses évaluations sont conservés)',
    params: scope.extend({ supplierId: z.string().min(1).max(200) }),
    handler: async ({ svc, s, params, ip }) =>
      svc.grc.suppliers.detach(params.smsi, params.supplierId, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/rapprochements',
    summary: 'Propositions de rapprochement entre référentiels du périmètre',
    params: scope,
    query: z.object({
      status: z.enum(['pending', 'confirmed', 'rejected', 'withdrawn']).optional(),
      frameworkId: z.uuid().optional(),
    }),
    handler: async ({ svc, s, params, query }) => svc.grc.rapprochements.list(params.smsi, (s as Session).user, query),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/rapprochements/summary',
    summary: 'Nombre de rapprochements à valider',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.rapprochements.summary(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/rapprochements/sync',
    summary: 'Actualiser les propositions de rapprochement',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.rapprochements.refresh(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/rapprochements/decision',
    summary: 'Confirmer ou rejeter des rapprochements',
    params: scope,
    body: RapprochementDecision,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.rapprochements.decide(params.smsi, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/couverture',
    summary: 'Vue commune : couverture des exigences par référentiel rattaché',
    params: scope,
    query: z.object({ frameworkId: z.uuid().optional() }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.rapprochements.coverage(params.smsi, (s as Session).user, query.frameworkId),
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
    summary: 'Référentiels de la bibliothèque rattachés au périmètre',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.library.attachments(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/framework-attachments/:id',
    summary: 'Rattacher une version d’un référentiel de la bibliothèque au périmètre',
    params: object,
    body: z.object({ version: z.number().int().positive(), confirm: z.literal('RATTACHER') }).strict(),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.library.attach(params.smsi, params.id, body.version, (s as Session).user, ip),
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
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/studies/:id/configuration-migration',
    summary:
      'Étude d’impact du passage d’une étude aux versions les plus récentes de sa configuration (aucune écriture)',
    params: object,
    handler: async ({ svc, s, params }) => svc.grc.studyConfig.preview(params.smsi, params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/studies/:id/configuration-migration',
    summary:
      'Migrer explicitement une étude vers les versions récentes de sa configuration (If-Match : version de l’étude)',
    params: object,
    body: z
      .object({
        previewId: z.string().regex(/^[a-f0-9]{64}$/),
        reason: z.string().trim().min(10).max(1000),
        confirm: z.literal('MIGRER'),
      })
      .strict(),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.studyConfig.apply(
        params.smsi,
        params.id,
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
    url: '/api/grc/methods/templates/:family',
    summary: 'Modèle méthodologique organisationnel à adapter',
    params: z.object({ family: z.enum(['ebios_rm', 'iso27005', 'mehari', 'custom']) }),
    handler: async ({ params }) => methodTemplate(params.family),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/methods',
    summary: 'Méthodes publiées du SMSI',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.risks.methods(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/methods/:id/history',
    summary: 'Versions immuables de la politique d’appréciation',
    params: object,
    handler: async ({ svc, s, params }) => svc.grc.risks.methodHistory(params.smsi, params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/methods/preview',
    summary: 'Valider une politique méthodologique complète',
    params: scope,
    body: z.object({ id: z.uuid().nullable(), definition: z.unknown() }),
    handler: async ({ svc, s, params, body }) =>
      svc.grc.risks.previewMethod(params.smsi, body.id, body.definition, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/methods/publish',
    summary: 'Publier sans recalculer les décisions précédentes',
    params: scope,
    body: publication.extend({ id: z.uuid().nullable() }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.risks.publishMethod(
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
    method: 'POST',
    url: '/api/grc/:smsi/risks/:id/preview',
    summary: 'Calcul selon la méthode exacte sans écriture',
    params: object,
    body: evaluation,
    handler: async ({ svc, s, params, body }) =>
      svc.grc.risks.preview(params.smsi, params.id, body.ratings, body.rationale, body.decision, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/risks/:id/evaluate',
    summary: 'Enregistrer une appréciation brute et résiduelle immuable',
    params: object,
    body: evaluation.extend({
      previewId: z.string().regex(/^[a-f0-9]{64}$/),
      requestId: z.uuid(),
      confirm: z.literal('ENREGISTRER'),
    }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.risks.evaluate(
        params.smsi,
        params.id,
        body.ratings,
        body.rationale,
        body.decision,
        requireIfMatch(req),
        body.previewId,
        body.requestId,
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/risks/:id/evaluations',
    summary: 'Historique des appréciations et décisions',
    params: object,
    query: z.object({ before: z.coerce.number().int().positive().default(2147483647) }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.risks.history(params.smsi, params.id, (s as Session).user, query.before),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/treatments/:id/action',
    summary: 'Générer une action sans modifier le résiduel',
    params: object,
    body: z.object({
      name: z.string().trim().min(1).max(200),
      dueAt: z.iso.datetime().nullable(),
      ownerId: z.uuid().nullable(),
      registreId: z.uuid().nullable().optional(),
    }),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.risks.treatmentAction(
        params.smsi,
        params.id,
        body.name,
        body.dueAt,
        body.ownerId,
        (s as Session).user,
        ip,
        body.registreId ?? null,
      ),
  }),
  route({
    tags: ['SMSI GRC'],
    access: 'pilotage:lire',
    method: 'GET',
    url: '/api/grc/:smsi/risks/register',
    summary: 'Registre des risques : niveaux, option de traitement, acceptation, revue (lot U3)',
    params: scope,
    query: z
      .object({
        demarche: z.enum(['ebios_rm', 'iso27005', 'mehari', 'custom']).optional(),
        strategie: z.enum(['reduce', 'accept', 'transfer', 'avoid', 'treated']).optional(),
        acceptation: z.enum(['sans_objet', 'a_decider', 'acceptee', 'refusee', 'echue']).optional(),
        enRetard: z.enum(['1']).optional(),
        etude: z.uuid().optional(),
        recherche: z.string().max(200).optional(),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) =>
      registreRisques(svc.grc, params.smsi, (s as Session).user, { ...query, enRetard: query.enRetard === '1' }),
  }),
  route({
    tags: ['SMSI GRC'],
    access: 'pilotage:lire',
    method: 'GET',
    url: '/api/grc/:smsi/risk-studies/:id',
    summary: 'Étude EBIOS RM par atelier : objets rattachés, calculs, validations (lot U3)',
    params: object,
    handler: async ({ svc, s, params }) => etudeEbios(svc.grc, params.smsi, params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/risk-map',
    summary: 'Projection cartographique du registre selon chaque méthode',
    params: scope,
    query: z
      .object({
        basis: z.enum(['gross', 'residual']).optional(),
        methodId: z.uuid().optional(),
        domain: z.string().max(120).optional(),
        scope: z.string().max(200).optional(),
        relatedRef: GrcRef.optional(),
        entity: z.string().max(200).optional(),
        strategy: z.enum(['reduce', 'accept', 'transfer', 'avoid', 'treated']).optional(),
        at: z.iso.datetime().optional(),
        compareAt: z.iso.datetime().optional(),
        search: z.string().max(200).optional(),
        limit: z.coerce.number().int().min(1).max(1000).optional(),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) => svc.grc.risks.projection(params.smsi, (s as Session).user, query),
  }),
];
