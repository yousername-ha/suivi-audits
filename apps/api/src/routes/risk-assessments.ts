import { AssessmentIntent, AssessmentPublication, RiskAssessment } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';
const Params = z.object({ sourceId: z.string().min(1).max(120) });
export const riskAssessmentRoutes = [
  route({
    method: 'GET',
    url: '/api/ia/evaluations',
    summary: 'Scénarios IA existants et dernières décisions (sources retirées conservées)',
    tags: ['Évaluations IA'],
    access: 'ia:lire',
    query: z.object({
      search: z.string().max(200).default(''),
      offset: z.coerce.number().int().min(0).max(1000000).default(0),
    }),
    handler: async ({ svc, query }) => svc.riskAssessments.list(query.search, query.offset),
  }),
  route({
    method: 'GET',
    url: '/api/ia/evaluations/configurations',
    summary: 'Configurations publiées utilisables par une évaluation IA',
    tags: ['Évaluations IA'],
    access: 'ia:lire',
    handler: async ({ svc }) => svc.riskAssessments.configurations(),
  }),
  route({
    method: 'GET',
    url: '/api/ia/evaluations/:sourceId',
    summary: 'Scénario, méthode historique courante et configuration choisie explicitement',
    tags: ['Évaluations IA'],
    access: 'ia:lire',
    params: Params,
    query: z.object({ configurationVersion: z.coerce.number().int().min(1).max(2147483647).optional() }),
    handler: async ({ svc, params, query, reply }) => {
      const detail = await svc.riskAssessments.detail(params.sourceId, query.configurationVersion);
      setEtag(reply, detail.revision);
      return detail;
    },
  }),
  route({
    method: 'GET',
    url: '/api/ia/evaluations/:sourceId/history',
    summary: 'Décisions IA immuables, paginées par révision',
    tags: ['Évaluations IA'],
    access: 'ia:lire',
    params: Params,
    query: z.object({
      before: z.coerce.number().int().min(1).max(2147483647).default(2147483647),
      limit: z.coerce.number().int().min(1).max(50).default(25),
    }),
    handler: async ({ svc, params, query }) => svc.riskAssessments.history(params.sourceId, query.before, query.limit),
  }),
  route({
    method: 'POST',
    url: '/api/ia/evaluations/:sourceId/preview',
    summary: 'Simuler une décision sur une source et une version précises, sans écriture',
    tags: ['Évaluations IA'],
    access: 'ia:modifier',
    params: Params,
    body: AssessmentIntent,
    handler: async ({ svc, params, body }) => svc.riskAssessments.preview(params.sourceId, body),
  }),
  route({
    method: 'POST',
    url: '/api/ia/evaluations/:sourceId/assessments',
    summary: 'Enregistrer une décision confirmée avec instantané, résultat serveur et audit atomique',
    tags: ['Évaluations IA'],
    access: 'ia:modifier',
    params: Params,
    body: AssessmentPublication,
    response: RiskAssessment,
    handler: async ({ svc, params, body, s, req, ip, reply }) => {
      const result = await svc.riskAssessments.publish(
        params.sourceId,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, result.revision);
      return result;
    },
  }),
  route({
    method: 'GET',
    url: '/api/ia/evaluations/:sourceId/export',
    summary: 'Export JSON des décisions et configurations exactes (maximum 1 000 décisions)',
    tags: ['Évaluations IA'],
    access: 'ia:exporter',
    params: Params,
    handler: async ({ svc, params, s, reply, ip }) => {
      await svc.modules.assert('import_export');
      svc.auth.requirePermission(s as Session, 'import_export:exporter');
      const out = await svc.riskAssessments.export(params.sourceId);
      await svc.db.audit((s as Session).user, ip, 'risk.assessment.exported', params.sourceId, {
        count: out.assessments.length,
      });
      reply.header('Content-Disposition', 'attachment; filename="evaluations-ia.json"');
      return out;
    },
  }),
];
