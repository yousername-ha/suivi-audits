/* Module Intégrations (ADR 0076), socle des connecteurs réseau. Toute route passe par route() : session complète et double
   authentification, activation du module « integrations », droit exigé, CSRF et origine sur les écritures. Lire :
   catalogue, instances, exécutions, état de l'exécutant ; administrer : créer, configurer, activer, secrets ; modifier :
   lancer « Tester la connexion ». Aucune route ne renvoie un secret : seul « défini / non défini » sort. */
import {
  catalogueIntegrations,
  IntegrationActivation,
  IntegrationCreation,
  IntegrationModification,
  IntegrationSecrets,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';

const tags = ['Intégrations'];
const id = z.object({ id: z.uuid() });

export const integrationsRoutes = [
  route({
    method: 'GET',
    url: '/api/integrations/catalogue',
    summary:
      'Types de connecteur connus (catalogue en code) : portée, secrets attendus, flux, points d’accès de lecture',
    tags,
    access: 'integrations:lire',
    handler: async () => catalogueIntegrations(),
  }),
  route({
    method: 'GET',
    url: '/api/integrations/etat',
    summary: 'État de l’exécutant d’exploitation (signal de vie) et des flux vers l’extérieur des connecteurs',
    tags,
    access: 'integrations:lire',
    handler: async ({ svc }) => svc.integrations.etat(),
  }),
  route({
    method: 'GET',
    url: '/api/integrations/instances',
    summary: 'Instances de connecteur, avec l’état de leurs secrets (défini ou non) et leur dernière exécution',
    tags,
    access: 'integrations:lire',
    handler: async ({ svc }) => svc.integrations.lister(),
  }),
  route({
    method: 'GET',
    url: '/api/integrations/instances/:id',
    summary: 'Une instance de connecteur (ETag : version)',
    tags,
    access: 'integrations:lire',
    params: id,
    handler: async ({ svc, params, reply }) => {
      const i = await svc.integrations.lire(params.id);
      setEtag(reply, i.version);
      return i;
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances',
    summary: 'Créer une instance de connecteur (inactive, sans secret) ; configuration validée par le schéma du type',
    tags,
    access: 'integrations:administrer',
    body: IntegrationCreation,
    status: 201,
    handler: async ({ svc, s, body, ip, reply }) => {
      const i = await svc.integrations.creer(body, (s as Session).user, ip);
      setEtag(reply, i.version);
      return i;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/integrations/instances/:id',
    summary:
      'Modifier le nom ou la configuration (If-Match) ; changer l’adresse ou l’autorité de certification supprime les secrets',
    tags,
    access: 'integrations:administrer',
    params: id,
    body: IntegrationModification,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const i = await svc.integrations.modifier(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, i.version);
      return i;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/integrations/instances/:id/activation',
    summary:
      'Activer (ouvre le flux du type, validation explicite fluxConfirme par un administrateur) ou désactiver (If-Match)',
    tags,
    access: 'integrations:administrer',
    params: id,
    body: IntegrationActivation,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const i = await svc.integrations.activer(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, i.version);
      return i;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/integrations/instances/:id/secrets',
    summary: 'Définir un ou plusieurs secrets (écriture seule, scellés, jamais relus ni journalisés)',
    tags,
    access: 'integrations:administrer',
    params: id,
    body: IntegrationSecrets,
    handler: async ({ svc, s, params, body, ip }) => {
      await svc.integrations.definirSecrets(
        params.id,
        body as Record<string, string | undefined>,
        (s as Session).user,
        ip,
      );
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/integrations/instances/:id/secrets/:champ',
    summary: 'Retirer un secret',
    tags,
    access: 'integrations:administrer',
    params: z.object({ id: z.uuid(), champ: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,39}$/) }),
    handler: async ({ svc, s, params, ip }) => {
      await svc.integrations.retirerSecret(params.id, params.champ, (s as Session).user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances/:id/tester',
    summary: 'Tester la connexion : inscrit une exécution en file, traitée par l’exécutant d’exploitation',
    tags,
    access: 'integrations:modifier',
    params: id,
    status: 201,
    handler: async ({ svc, s, params, ip }) => {
      const sess = s as Session;
      if (!svc.limits.integrationTest(sess.user.id))
        throw new HttpError(429, 'Trop de tests de connexion. Réessayez dans une minute.');
      return svc.integrations.demanderTest(params.id, sess.user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances/:id/synchroniser',
    summary:
      'Synchroniser maintenant (Tenable : failles et machines ; AlgoLightHouse : surface externe) : inscrit une exécution en file ; module Vulnérabilités actif exigé',
    tags,
    access: 'integrations:modifier',
    params: id,
    status: 201,
    handler: async ({ svc, s, params, ip }) => {
      const sess = s as Session;
      // Les données reçues sont rangées par le module Vulnérabilités : désactivé, rien n'est inscrit.
      await svc.modules.assert('vulnerabilites');
      if (!svc.limits.integrationSynchro(sess.user.id))
        throw new HttpError(429, 'Trop de demandes de synchronisation. Réessayez dans une heure.');
      return svc.integrations.demander(params.id, 'synchroniser', sess.user, ip);
    },
  }),
  route({
    method: 'GET',
    url: '/api/integrations/instances/:id/executions',
    summary: 'Dernières exécutions d’une instance (vingt au plus)',
    tags,
    access: 'integrations:lire',
    params: id,
    handler: async ({ svc, params }) => svc.integrations.executions(params.id),
  }),
  route({
    method: 'GET',
    url: '/api/integrations/executions/:id',
    summary: 'Une exécution (suivi d’un test en cours)',
    tags,
    access: 'integrations:lire',
    params: id,
    handler: async ({ svc, params }) => svc.integrations.execution(params.id),
  }),
];
