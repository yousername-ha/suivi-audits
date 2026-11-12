/* Assistant RSSI intégré (ADR 0086, lot A1). Utiliser l'assistant demande le droit dédié « assistant:lire » ; le régler,
   « assistant:administrer ». Aucune route ne renvoie la clé du modèle. */
import {
  AvisRondeBody,
  CleModeleBody,
  DecisionMethodeBody,
  NouvelleMethodeBody,
  LancerRondeBody,
  MessageAssistantBody,
  NouvelleConversationBody,
  NouvelleMissionBody,
  ProfilAssistantQuery,
  ReglagesAssistantBody,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';

const id = z.object({ id: z.uuid() });
const tags = ['Assistant'];

export const assistantRoutes = [
  route({
    method: 'GET',
    url: '/api/assistant/etat',
    summary:
      'État de l’assistant pour la personne : prêt ou non, fournisseur du modèle, profils et périmètres lisibles',
    tags,
    access: 'assistant:lire',
    handler: async ({ svc, s }) => svc.assistant.etat((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/assistant/reglages',
    summary: 'Réglages de l’assistant (modèle, profils, périmètres) ; la clé n’est jamais renvoyée',
    tags,
    access: 'assistant:administrer',
    handler: async ({ svc }) => svc.assistant.reglages(),
  }),
  route({
    method: 'PUT',
    url: '/api/assistant/reglages',
    summary: 'Enregistrer les réglages de l’assistant (version attendue obligatoire)',
    tags,
    access: 'assistant:administrer',
    body: ReglagesAssistantBody,
    handler: async ({ svc, s, body, ip }) => svc.assistant.modifierReglages(body, (s as Session).user, ip),
  }),
  route({
    method: 'PUT',
    url: '/api/assistant/reglages/cle',
    summary: 'Enregistrer la clé du modèle (scellée, écriture seule)',
    tags,
    access: 'assistant:administrer',
    body: CleModeleBody,
    handler: async ({ svc, s, body, ip }) => svc.assistant.definirCle(body.cle, (s as Session).user, ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/assistant/reglages/cle',
    summary: 'Retirer la clé du modèle',
    tags,
    access: 'assistant:administrer',
    handler: async ({ svc, s, ip }) => svc.assistant.retirerCle((s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/reglages/test',
    summary: 'Tester l’appel au modèle réglé (aucune donnée métier envoyée)',
    tags,
    access: 'assistant:administrer',
    handler: async ({ svc, s, ip }) => {
      const user = (s as Session).user;
      if (!svc.limits.assistantTestByUser(user.id)) throw new HttpError(429, 'Trop de tests. Réessayez plus tard.');
      return svc.assistant.tester(user, ip);
    },
  }),
  route({
    method: 'GET',
    url: '/api/assistant/conversations',
    summary: 'Conversations de la personne avec l’assistant',
    tags,
    access: 'assistant:lire',
    handler: async ({ svc, s }) => svc.assistant.conversations((s as Session).user),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/conversations',
    summary: 'Ouvrir une conversation avec un profil de l’assistant',
    tags,
    access: 'assistant:lire',
    body: NouvelleConversationBody,
    status: 201,
    handler: async ({ svc, s, body }) => svc.assistant.creer(body.profil, (s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/assistant/conversations/:id',
    summary: 'Messages d’une conversation (celle d’une autre personne est introuvable)',
    tags,
    access: 'assistant:lire',
    params: id,
    handler: async ({ svc, s, params }) => svc.assistant.detail(params.id, (s as Session).user),
  }),
  route({
    method: 'DELETE',
    url: '/api/assistant/conversations/:id',
    summary: 'Supprimer une conversation',
    tags,
    access: 'assistant:lire',
    params: id,
    handler: async ({ svc, s, params, ip }) => svc.assistant.supprimer(params.id, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/conversations/:id/messages',
    summary: 'Poser une question : la réponse se prépare en tâche de fond, le fil est rendu « en cours »',
    tags,
    access: 'assistant:lire',
    params: id,
    body: MessageAssistantBody,
    status: 202,
    handler: async ({ svc, s, params, body, ip }) => {
      const user = (s as Session).user;
      if (!svc.limits.assistantByUser(user.id))
        throw new HttpError(429, 'Trop de questions en peu de temps. Réessayez dans quelques minutes.');
      return svc.assistant.envoyer(params.id, body.texte, user, ip);
    },
  }),
  /* ---------------------------------------------------------------- Autonomie (lot A3) */
  route({
    method: 'GET',
    url: '/api/assistant/rondes',
    summary: 'Rondes autonomes : celles dont la personne est le référent, toutes pour un administrateur de l’assistant',
    tags,
    access: 'assistant:lire',
    query: ProfilAssistantQuery,
    handler: async ({ svc, s, query }) => svc.assistantRondes.liste((s as Session).user, query.profil),
  }),
  route({
    method: 'GET',
    url: '/api/assistant/rondes/:id',
    summary: 'Rapport d’une ronde (réservé à son référent et aux administrateurs de l’assistant)',
    tags,
    access: 'assistant:lire',
    params: id,
    handler: async ({ svc, s, params }) => svc.assistantRondes.detail(params.id, (s as Session).user),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/rondes',
    summary: 'Lancer une ronde tout de suite : elle tourne en tâche de fond, une seule à la fois',
    tags,
    access: 'assistant:administrer',
    body: LancerRondeBody,
    status: 202,
    handler: async ({ svc, s, body, ip }) => {
      const user = (s as Session).user;
      if (!svc.limits.assistantRondeByUser(user.id))
        throw new HttpError(429, 'Trop de rondes demandées. Réessayez plus tard.');
      return svc.assistantRondes.lancer(body.profil, user, ip);
    },
  }),
  route({
    method: 'GET',
    url: '/api/assistant/referents',
    summary: 'Comptes qui peuvent être référents d’un profil (actifs, autorisés à utiliser l’assistant)',
    tags,
    access: 'assistant:administrer',
    handler: async ({ svc }) => svc.assistantRondes.referentsPossibles(),
  }),
  route({
    method: 'GET',
    url: '/api/assistant/missions',
    summary: 'Missions confiées à l’assistant',
    tags,
    access: 'assistant:administrer',
    handler: async ({ svc }) => svc.assistantRondes.missions(),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/missions',
    summary: 'Confier une mission à un profil de l’assistant',
    tags,
    access: 'assistant:administrer',
    body: NouvelleMissionBody,
    status: 201,
    handler: async ({ svc, s, body, ip }) =>
      svc.assistantRondes.creerMission(body.profil, body.consigne, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/missions/:id/cloture',
    summary: 'Clore une mission : l’assistant ne la reprend plus',
    tags,
    access: 'assistant:administrer',
    params: id,
    handler: async ({ svc, s, params, ip }) => svc.assistantRondes.cloreMission(params.id, (s as Session).user, ip),
  }),
  route({
    method: 'GET',
    url: '/api/assistant/memoire',
    summary: 'Notes de mémoire de l’assistant, par profil',
    tags,
    access: 'assistant:administrer',
    query: ProfilAssistantQuery,
    handler: async ({ svc, query }) => svc.assistantRondes.memoire(query.profil),
  }),
  route({
    method: 'DELETE',
    url: '/api/assistant/memoire/:id',
    summary: 'Supprimer une note de mémoire de l’assistant',
    tags,
    access: 'assistant:administrer',
    params: id,
    handler: async ({ svc, s, params, ip }) => svc.assistantRondes.oublier(params.id, (s as Session).user, ip),
  }),
  /* ---------------------------------------------------------------- Amélioration avec l'usage */
  route({
    method: 'PUT',
    url: '/api/assistant/rondes/:id/avis',
    summary: 'Dire si une ronde était utile, avec un motif relu par l’assistant aux rondes suivantes',
    tags,
    access: 'assistant:lire',
    params: id,
    body: AvisRondeBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.assistantRondes.avisRonde(params.id, body, (s as Session).user, ip),
  }),
  route({
    method: 'GET',
    url: '/api/assistant/methodes',
    summary: 'Fiches de méthode de l’assistant : proposées, validées, refusées',
    tags,
    access: 'assistant:administrer',
    handler: async ({ svc }) => svc.assistantRondes.methodes(),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/methodes',
    summary: 'Rédiger une fiche de méthode (validée d’office)',
    tags,
    access: 'assistant:administrer',
    body: NouvelleMethodeBody,
    status: 201,
    handler: async ({ svc, s, body, ip }) => svc.assistantRondes.creerMethode(body, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/assistant/methodes/:id/decision',
    summary: 'Valider (en corrigeant au besoin) ou refuser une fiche de méthode',
    tags,
    access: 'assistant:administrer',
    params: id,
    body: DecisionMethodeBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.assistantRondes.deciderMethode(params.id, body, (s as Session).user, ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/assistant/methodes/:id',
    summary: 'Supprimer une fiche de méthode',
    tags,
    access: 'assistant:administrer',
    params: id,
    handler: async ({ svc, s, params, ip }) => svc.assistantRondes.supprimerMethode(params.id, (s as Session).user, ip),
  }),
  route({
    method: 'GET',
    url: '/api/assistant/mesures',
    summary: 'Chiffres des six derniers mois : rondes, rappels, avis, fiches de méthode',
    tags,
    access: 'assistant:administrer',
    handler: async ({ svc }) => svc.assistantRondes.mesures(),
  }),
];
