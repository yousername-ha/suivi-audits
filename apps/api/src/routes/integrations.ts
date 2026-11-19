/* Module Intégrations (ADR 0076), socle des connecteurs réseau. Toute route passe par route() : session complète et double
   authentification, activation du module « integrations », droit exigé, CSRF et origine sur les écritures. Lire :
   catalogue, instances, exécutions, état de l'exécutant ; administrer : créer, configurer, activer, secrets ; modifier :
   lancer « Tester la connexion ». Aucune route ne renvoie un secret : seul « défini / non défini » sort.
   Lot N1 (ADR 0100) : import d'un scan Nessus (connecteur « nessus-fichier ») en trois temps, début, lots de machines
   entières, fin, avec le droit d'administrer les intégrations ; le module Vulnérabilités, qui range les données, doit être
   actif. Le corps d'un lot est un extrait en JSON, revalidé champ par champ ; aucune route ne reçoit de XML.
   Lot N2 : suppression d'une instance « Nessus, import de fichier » et de tout ce qu'elle a importé (If-Match, même droit),
   avec son aperçu chiffré ; refus net pour tout autre type (aucune suppression de Security Center ni d'AlgoLightHouse).
   Lot SI1 : import du rapport Silène (connecteur « silene-fichier ») par le même protocole (début, lots d'hôtes et de
   constats, fin ; mêmes droits, même limite d'imports) sous `…/silene/imports`, et suppression de son instance avec ce
   qu'elle a importé par les mêmes routes de suppression. */
import {
  catalogueIntegrations,
  DebutImportNessus,
  DebutImportSilene,
  FinImportSilene,
  LotImportSilene,
  SILENE_BORNES,
  TYPE_SILENE_FICHIER,
  FinImportNessus,
  LotImportNessus,
  MESSAGE_LIMITE_IMPORTS,
  NESSUS_BORNES,
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
const importId = z.object({ id: z.uuid(), execution: z.uuid() });

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
    method: 'POST',
    url: '/api/integrations/instances/:id/imports',
    summary:
      'Nessus, import de fichier : commencer un import (machines et détections annoncées, éléments écartés comptés par le navigateur) ; gravités retenues fixées d’après la configuration de l’instance ; module Vulnérabilités actif exigé',
    tags,
    access: 'integrations:administrer',
    params: id,
    body: DebutImportNessus,
    status: 201,
    handler: async ({ svc, s, params, body, ip }) => {
      const sess = s as Session;
      await svc.modules.assert('vulnerabilites');
      if (!svc.limits.importNessus(sess.user.id)) throw new HttpError(429, MESSAGE_LIMITE_IMPORTS);
      return svc.vulnerabilites.importNessus.debuter(params.id, body, sess.user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances/:id/imports/:execution/lots',
    summary:
      'Nessus, import de fichier : un lot de machines entières et des contrôles qu’elles portent (JSON revalidé champ par champ) ; chaque lot est un passage complet pour ses machines',
    tags,
    access: 'integrations:administrer',
    params: importId,
    body: LotImportNessus,
    bodyLimit: NESSUS_BORNES.corpsLot,
    handler: async ({ svc, s, params, body, ip }) => {
      const sess = s as Session;
      await svc.modules.assert('vulnerabilites');
      if (!svc.limits.importNessusLot(sess.user.id))
        throw new HttpError(429, 'Trop de lots envoyés. Réessayez dans quelques minutes.');
      return svc.vulnerabilites.importNessus.lot(params.id, params.execution, body, sess.user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances/:id/imports/:execution/fin',
    summary:
      'Nessus, import de fichier : terminer l’import (reçu si toutes les machines annoncées sont rangées, sinon en échec ; les machines rangées le restent)',
    tags,
    access: 'integrations:administrer',
    params: importId,
    body: FinImportNessus,
    handler: async ({ svc, s, params, ip }) => {
      await svc.modules.assert('vulnerabilites');
      const bilan = await svc.vulnerabilites.importNessus.terminer(
        params.id,
        params.execution,
        (s as Session).user,
        ip,
      );
      // Transaction validée : statistiques des tables réécrites, sans jamais faire échouer la réponse.
      await svc.vulnerabilites.importNessus.apresValidation();
      return bilan;
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances/:id/silene/imports',
    summary:
      'Silène, import de fichier : commencer un import (synthèse du rapport, périmètre déclaré, hôtes et constats annoncés, éléments écartés comptés par le navigateur) ; module Vulnérabilités actif exigé',
    tags,
    access: 'integrations:administrer',
    params: id,
    body: DebutImportSilene,
    bodyLimit: SILENE_BORNES.corpsDebut,
    status: 201,
    handler: async ({ svc, s, params, body, ip }) => {
      const sess = s as Session;
      await svc.modules.assert('vulnerabilites');
      // Même limite que l'import Nessus : fichiers commencés par heure et par personne, tous imports confondus.
      if (!svc.limits.importNessus(sess.user.id)) throw new HttpError(429, MESSAGE_LIMITE_IMPORTS);
      return svc.vulnerabilites.importSilene.debuter(params.id, body, sess.user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances/:id/silene/imports/:execution/lots',
    summary:
      'Silène, import de fichier : un lot d’hôtes (adresse, noms, ports ouverts, produits, contrôles) et de constats (contrôle, classe, points, hôtes, lignes), JSON revalidé champ par champ',
    tags,
    access: 'integrations:administrer',
    params: importId,
    body: LotImportSilene,
    bodyLimit: SILENE_BORNES.corpsLot,
    handler: async ({ svc, s, params, body, ip }) => {
      const sess = s as Session;
      await svc.modules.assert('vulnerabilites');
      if (!svc.limits.importNessusLot(sess.user.id))
        throw new HttpError(429, 'Trop de lots envoyés. Réessayez dans quelques minutes.');
      return svc.vulnerabilites.importSilene.lot(params.id, params.execution, body, sess.user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/integrations/instances/:id/silene/imports/:execution/fin',
    summary:
      'Silène, import de fichier : terminer l’import (complet : il fait foi, ce qui n’est plus dans le rapport n’est plus présent ; sinon en échec, le rapport précédent reste celui qui fait foi)',
    tags,
    access: 'integrations:administrer',
    params: importId,
    body: FinImportSilene,
    handler: async ({ svc, s, params, ip }) => {
      await svc.modules.assert('vulnerabilites');
      const bilan = await svc.vulnerabilites.importSilene.terminer(
        params.id,
        params.execution,
        (s as Session).user,
        ip,
      );
      // Transaction validée : statistiques des tables réécrites, sans jamais faire échouer la réponse.
      await svc.vulnerabilites.importSilene.apresValidation();
      return bilan;
    },
  }),
  route({
    method: 'GET',
    url: '/api/integrations/instances/:id/suppression',
    summary:
      'Nessus ou Silène, import de fichier : ce que la suppression de l’instance ferait disparaître (Nessus : machines, failles, détections, imports ; Silène : hôtes, constats, imports) ; autre type refusé',
    tags,
    access: 'integrations:administrer',
    params: id,
    handler: async ({ svc, params }) => {
      await svc.modules.assert('vulnerabilites');
      if ((await svc.integrations.lire(params.id)).type === TYPE_SILENE_FICHIER)
        return svc.vulnerabilites.importSilene.apercuSuppression(params.id);
      return svc.vulnerabilites.importNessus.apercuSuppression(params.id);
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/integrations/instances/:id',
    summary:
      'Nessus ou Silène, import de fichier seulement : supprimer l’instance et tout ce qu’elle a importé (If-Match) ; tout autre type est refusé (422)',
    tags,
    access: 'integrations:administrer',
    params: id,
    handler: async ({ svc, s, params, req, ip }) => {
      const attendue = requireIfMatch(req);
      await svc.modules.assert('vulnerabilites');
      const type = (await svc.integrations.lire(params.id)).type;
      if (type === TYPE_SILENE_FICHIER)
        return svc.vulnerabilites.importSilene.supprimer(params.id, attendue, (s as Session).user, ip);
      // Nessus, et refus net (422) de tout autre type par le service de l'import Nessus.
      return svc.vulnerabilites.importNessus.supprimer(params.id, attendue, (s as Session).user, ip);
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
