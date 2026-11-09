import { z } from 'zod';
import { GrcRef, methodTemplate } from '@suivi/shared';
import type { Session } from '../../auth.js';
import { bibliothequeSources, etudeEbios, registreRisques } from '../../grc/registre-risques.js';
import { route } from '../../http/route.js';
import { requireIfMatch } from '../../http/concurrency.js';
import { base, scope, object, publication, evaluation } from './commun.js';

export const risquesRoutes = [
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
        ecart: z.enum(['1']).optional(),
        etude: z.uuid().optional(),
        recherche: z.string().max(200).optional(),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) =>
      registreRisques(svc.grc, params.smsi, (s as Session).user, {
        ...query,
        enRetard: query.enRetard === '1',
        ecart: query.ecart === '1',
      }),
  }),
  route({
    tags: ['SMSI GRC'],
    access: 'pilotage:lire',
    method: 'GET',
    url: '/api/grc/:smsi/risk-library',
    summary: 'Bibliothèque partagée des sources de risque du périmètre, avec leur usage par les études (décision 10)',
    params: scope,
    handler: async ({ svc, s, params }) => bibliothequeSources(svc.grc, params.smsi, (s as Session).user),
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
