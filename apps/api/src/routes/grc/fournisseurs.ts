import { z } from 'zod';
import {
  SupplierBody,
  SupplierCriterionBody,
  SupplierEvaluationBody,
  SupplierFollowUpBody,
  SupplierUpdateBody,
} from '@suivi/shared';
import type { Session } from '../../auth.js';
import { route } from '../../http/route.js';
import { requireIfMatch } from '../../http/concurrency.js';
import { base, scope, supplierParam, criterionParam } from './commun.js';

export const fournisseursRoutes = [
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
];
