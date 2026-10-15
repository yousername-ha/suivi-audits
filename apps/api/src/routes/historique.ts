/* Modules de l'outil de suivi historique repris dans la nouvelle interface (sans copie, voir historique/registre.ts).
   Les droits sont ceux du module concerné ; les actions qui touchent un autre module exigent aussi son droit. */
import { ActionPlanCreation, ActionPlanModification, DecalagePlan } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { route } from '../http/route.js';

const tags = ['Outil de suivi (reprise)'];
const user = (s: unknown) => (s as Session).user;
const idPlan = z.object({ id: z.string().trim().min(1).max(80) });

export const historiqueRoutes = [
  route({
    method: 'GET',
    url: '/api/plans',
    summary: 'Plans du SMSI (formation, sensibilisation, audit interne, exercices) et tâches récurrentes du calendrier',
    tags,
    access: 'pilotage:lire' as const,
    handler: async ({ svc, s }) => svc.historique.plans.vue(user(s)),
  }),
  route({
    method: 'POST',
    url: '/api/plans',
    summary: 'Ajouter une action à un plan',
    tags,
    access: 'pilotage:modifier' as const,
    status: 201,
    body: ActionPlanCreation,
    handler: async ({ svc, s, body, ip }) => svc.historique.plans.creer(body, user(s), ip),
  }),
  route({
    method: 'PATCH',
    url: '/api/plans/:id',
    summary: 'Modifier une action de plan (les champs absents de la requête sont conservés)',
    tags,
    access: 'pilotage:modifier' as const,
    params: idPlan,
    body: ActionPlanModification,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.plans.modifier(params.id, body, user(s), ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/plans/:id',
    summary: 'Supprimer une action de plan',
    tags,
    access: 'pilotage:modifier' as const,
    params: idPlan,
    handler: async ({ svc, s, params, ip }) => svc.historique.plans.supprimer(params.id, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/plans/:id/decalage',
    summary: 'Décaler les dates d’une action (planning annuel)',
    tags,
    access: 'pilotage:modifier' as const,
    params: idPlan,
    body: DecalagePlan,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.plans.decaler(params.id, body, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/plans/:id/couverture',
    summary: 'Reporter un audit réalisé dans la couverture du cycle (audit interne)',
    tags,
    access: 'pilotage:modifier' as const,
    params: idPlan,
    handler: async ({ svc, s, params, ip }) => svc.historique.plans.reporterCouverture(params.id, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/plans/:id/indicateur',
    summary: 'Enregistrer le taux d’une sensibilisation réalisée dans son indicateur',
    tags,
    access: 'pilotage:modifier' as const,
    params: idPlan,
    handler: async ({ svc, s, params, ip }) => svc.historique.plans.enregistrerIndicateur(params.id, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/plans/:id/ecart',
    summary: 'Créer une action dans le registre des écarts à partir d’un exercice',
    tags,
    access: 'pilotage:modifier' as const,
    params: idPlan,
    handler: async ({ svc, s, params, ip }) => svc.historique.plans.creerEcart(params.id, user(s), ip),
  }),
];
