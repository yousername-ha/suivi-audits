/* Module Vulnérabilités (ADR 0100) : produits surveillés (lot V1), veille sur les sources publiques (lots V2 et V3), failles
   et machines lues dans Tenable Security Center (lot V5). Toute route passe par route() : session complète et double
   authentification, activation du module « vulnerabilites », droit exigé, CSRF et origine sur les écritures. La veille se
   lit avec `lire` ; « Collecter maintenant » demande `administrer`. Son flux s'ouvre par la route commune des flux
   (« Activer la veille », administrateur, validation explicite). Failles et machines : lecture à travers les droits du
   périmètre de chaque machine (service FaillesDetectees) ; rôle et périmètre avec `modifier` et l'écriture sur le
   périmètre ; « Synchroniser maintenant » relève du module Intégrations (routes/integrations.ts).
   Lot V4a : fiche d'un produit (rapprochements, machines reliées lisibles), produit relié à une machine (`modifier`,
   If-Match sur la fiche du produit, machine lue par son périmètre), décision sur une proposition (`modifier`, If-Match sur
   le rapprochement), suggestions d'identifiant CPE (`modifier`, données de la veille seulement), failles déclarées (`lire`),
   seuils de priorité (lecture `lire`, écriture `administrer` avec If-Match).
   Lot V4b : fiche d'une faille déclarée (`lire`) ; suivi d'un constat ou d'une faille déclarée (lecture `lire` ; état,
   refus de la proposition « corrigée », création, lien et retrait d'une action avec `modifier` et If-Match sur la version du
   suivi). Le service exige en plus de lire toutes les machines touchées ; créer une action exige le droit du module des
   actions et l'écriture sur le périmètre choisi (service du registre).
   Lot V4c : annulation d'une confirmation ou d'un rejet de rapprochement (`modifier`, If-Match sur le rapprochement, note
   facultative ; V24).
   V31 : liste de mots à ne pas masquer par le masque des machines de l'assistant (lecture, effet d'un mot et écriture avec
   `administrer`, écriture avec If-Match). */
import {
  AffectationMachine,
  AnnulationRapprochement,
  AffectationMachines,
  ChangementEtatSuivi,
  CreationActionSuivi,
  DecisionRapprochement,
  LienActionSuivi,
  NatureSuivi,
  RefusPropositionSuivi,
  DemandeCollecte,
  EffetMotQuery,
  RechercheDeclarees,
  ReglageMasque,
  ReglagePriorite,
  SuggestionsCpeQuery,
  type ProduitSurveilleDto,
  RechercheAvis,
  RechercheFailles,
  ProduitSurveilleBody,
  ProduitSurveillePatch,
  ProduitsSurveillesQuery,
  RechercheConstats,
  RechercheMachines,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';

const tags = ['Vulnérabilités'];
const id = z.object({ id: z.uuid() });
const lienMachine = z.object({ id: z.uuid(), machineId: z.uuid() });
const CorpsLien = z.object({ machineId: z.uuid() }).strict();
const suivi = z.object({ nature: NatureSuivi, id: z.uuid() });
const lienAction = z.object({ nature: NatureSuivi, id: z.uuid(), actionId: z.uuid() });

export const vulnerabilitesRoutes = [
  route({
    method: 'GET',
    url: '/api/vulnerabilites/produits',
    summary: 'Produits surveillés du registre de l’organisation, éventuellement filtrés par famille',
    tags,
    access: 'vulnerabilites:lire',
    query: ProduitsSurveillesQuery,
    handler: async ({ svc, query }) => svc.vulnerabilites.produits.lister(query.famille),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/produits/:id',
    summary: 'Fiche d’un produit surveillé (ETag : version de la fiche)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, params, reply }) => {
      const p: ProduitSurveilleDto = await svc.vulnerabilites.produits.lire(params.id);
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/produits',
    summary: 'Ajouter un produit surveillé (origine « saisie ») ; doublon éditeur, produit et version refusé',
    tags,
    access: 'vulnerabilites:modifier',
    body: ProduitSurveilleBody,
    status: 201,
    handler: async ({ svc, s, body, ip, reply }) => {
      const p = await svc.vulnerabilites.produits.creer(body, (s as Session).user, ip);
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/vulnerabilites/produits/:id',
    summary: 'Modifier un produit surveillé (If-Match : version attendue)',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: ProduitSurveillePatch,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const p = await svc.vulnerabilites.produits.modifier(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/vulnerabilites/produits/:id',
    summary: 'Supprimer un produit surveillé (If-Match : version attendue)',
    tags,
    access: 'vulnerabilites:supprimer',
    params: id,
    handler: async ({ svc, s, params, req, ip }) => {
      await svc.vulnerabilites.produits.supprimer(params.id, requireIfMatch(req), (s as Session).user, ip);
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/responsables',
    summary: 'Responsables désignables pour un produit surveillé : personnes actives, groupes et fonctions',
    tags,
    access: 'vulnerabilites:modifier',
    handler: async ({ svc }) => svc.vulnerabilites.produits.responsables(),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/veille/etat',
    summary:
      'Veille : état du flux, de l’exécutant et de chaque source (dernière collecte réussie, erreur, retard, dernière collecte)',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc }) => svc.vulnerabilites.veille.etat(),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/veille/avis',
    summary:
      'Veille : alertes et avis du CERT-FR et du CERT Santé, paginés ; recherche par CVE citée, identifiant ou titre',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheAvis,
    handler: async ({ svc, query }) => svc.vulnerabilites.veille.avis(query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/veille/failles',
    summary:
      'Veille : failles (CVE) connues, paginées ; `kev=oui` pour le catalogue des failles exploitées ; recherche par CVE, éditeur, produit ou nom',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheFailles,
    handler: async ({ svc, query }) => svc.vulnerabilites.veille.failles(query),
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/veille/collectes',
    summary:
      'Collecter maintenant : inscrit une collecte par source (ou pour la source donnée), traitée par l’exécutant ; flux ouvert exigé',
    tags,
    access: 'vulnerabilites:administrer',
    body: DemandeCollecte,
    status: 201,
    handler: async ({ svc, s, body, ip }) => {
      const sess = s as Session;
      if (!svc.limits.veilleCollecte(sess.user.id))
        throw new HttpError(429, 'Trop de demandes de collecte. Réessayez dans une heure.');
      return svc.vulnerabilites.veille.demander(body.source, sess.user, ip);
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/synchronisation',
    summary:
      'Failles détectées : état de la synchronisation de chaque instance Tenable (dernière exécution, dernière complète, inventaire)',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc }) => svc.vulnerabilites.tenable.etat(),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/constats',
    summary:
      'Failles détectées par Tenable (un constat par contrôle), présentes sur au moins une machine lisible ; recherche par CVE, numéro ou nom du contrôle ; filtres gravité, exploité, exploitable, non maintenu',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheConstats,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.failles.constats((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/constats/:id',
    summary: 'Fiche d’un constat : CVE (catalogue KEV), correctif, vecteur CVSS, machines lisibles regroupées par rôle',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params }) => svc.vulnerabilites.failles.constat((s as Session).user, params.id),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines',
    summary:
      'Machines lisibles (périmètre, ou administration du module pour celles sans périmètre) ; recherche par nom, filtres rôle et périmètre ; constats présents par gravité',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheMachines,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.failles.machines((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines/:id',
    summary: 'Une machine lisible (ETag : version du rôle et du périmètre)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params, reply }) => {
      const m = await svc.vulnerabilites.failles.machine((s as Session).user, params.id);
      setEtag(reply, m.version);
      return m;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/perimetres',
    summary: 'Périmètres où la personne peut écrire : choix admis pour rattacher une machine',
    tags,
    access: 'vulnerabilites:modifier',
    handler: async ({ svc, s }) => svc.vulnerabilites.failles.perimetresAffectables((s as Session).user),
  }),
  route({
    method: 'PATCH',
    url: '/api/vulnerabilites/machines/:id',
    summary:
      'Rôle et périmètre d’une machine (If-Match) ; écriture exigée sur le périmètre actuel et le périmètre visé ; retirer le périmètre demande administrer',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: AffectationMachine,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const m = await svc.vulnerabilites.failles.affecter(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, m.version);
      return m;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/machines/affectation',
    summary:
      'Rôle ou périmètre de plusieurs machines (200 au plus), tout ou rien ; chaque machine porte sa version attendue',
    tags,
    access: 'vulnerabilites:modifier',
    body: AffectationMachines,
    handler: async ({ svc, s, body, ip }) => svc.vulnerabilites.failles.affecterEnMasse(body, (s as Session).user, ip),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/produits/:id/fiche',
    summary:
      'Fiche d’un produit surveillé : identité CPE, machines reliées lisibles, rapprochements avec la veille (sauf retirés) et leur priorité',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params, reply }) => {
      const f = await svc.vulnerabilites.produits.fiche((s as Session).user, params.id);
      setEtag(reply, f.produit.version);
      return f;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/produits/:id/machines',
    summary:
      'Relier le produit à une machine lisible (If-Match : version du produit) ; une machine non lisible répond comme inconnue',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: CorpsLien,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const p = await svc.vulnerabilites.produits.relier(
        params.id,
        body.machineId,
        true,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/vulnerabilites/produits/:id/machines/:machineId',
    summary: 'Délier le produit d’une machine lisible (If-Match : version du produit)',
    tags,
    access: 'vulnerabilites:modifier',
    params: lienMachine,
    handler: async ({ svc, s, params, req, ip, reply }) => {
      const p = await svc.vulnerabilites.produits.relier(
        params.id,
        params.machineId,
        false,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines/:id/produits',
    summary: 'Produits surveillés reliés à une machine lisible',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params }) => svc.vulnerabilites.produits.deMachine((s as Session).user, params.id),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/identites-cpe',
    summary:
      'Couples éditeur et produit déjà connus de la veille qui ressemblent au nom saisi (aucun appel réseau), pour l’identifiant CPE d’un produit',
    tags,
    access: 'vulnerabilites:modifier',
    query: SuggestionsCpeQuery,
    handler: async ({ svc, query }) => svc.vulnerabilites.rapprochements.suggestions(query),
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/rapprochements/:id/decision',
    summary: 'Confirmer ou rejeter un rapprochement proposé, avec une note (If-Match : version du rapprochement)',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: DecisionRapprochement,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.rapprochements.decider(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/rapprochements/:id/annulation',
    summary:
      'Annuler la confirmation ou le rejet d’un rapprochement, note facultative (If-Match : version du rapprochement) ; il est recalculé par la règle',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: AnnulationRapprochement,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.rapprochements.annuler(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/declarees',
    summary:
      'Failles déclarées : CVE rattachées à un produit relié à des machines lisibles, hors machines où Tenable les détecte ; priorité calculée',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheDeclarees,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.failles.declarees((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/declarees/:id',
    summary:
      'Fiche d’une faille déclarée (rapprochement) : description de NVD, action exigée du catalogue KEV, machines lisibles reliées au produit, priorité et suivi',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params }) => svc.vulnerabilites.failles.declaree((s as Session).user, params.id),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/suivis/:nature/:id',
    summary:
      'Suivi d’un constat ou d’une faille déclarée : état, proposition « corrigée », historique, actions liées (détail des seules actions lisibles) ; ETag : version du suivi',
    tags,
    access: 'vulnerabilites:lire',
    params: suivi,
    handler: async ({ svc, s, params, reply }) => {
      const r = await svc.vulnerabilites.suivi.lire((s as Session).user, params.nature, params.id);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/suivis/:nature/:id/etat',
    summary:
      'Changer l’état d’une faille (If-Match : version du suivi) ; note obligatoire pour « risque accepté » et « non concernée » ; toutes les machines touchées doivent être lisibles',
    tags,
    access: 'vulnerabilites:modifier',
    params: suivi,
    body: ChangementEtatSuivi,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.suivi.changerEtat(
        params.nature,
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/suivis/:nature/:id/refus',
    summary: 'Refuser la proposition « corrigée » avec une note ; l’état ne change pas (If-Match : version du suivi)',
    tags,
    access: 'vulnerabilites:modifier',
    params: suivi,
    body: RefusPropositionSuivi,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.suivi.refuserProposition(
        params.nature,
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/suivis/:nature/:id/actions',
    summary:
      'Créer une action du registre existant liée à la faille, sous l’identité et avec les droits de la personne (droit du module des actions, écriture sur le périmètre) ; If-Match : version du suivi',
    tags,
    access: 'vulnerabilites:modifier',
    params: suivi,
    body: CreationActionSuivi,
    status: 201,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.suivi.creerAction(
        params.nature,
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/suivis/:nature/:id/liens',
    summary: 'Relier une action existante que la personne peut lire (If-Match : version du suivi)',
    tags,
    access: 'vulnerabilites:modifier',
    params: suivi,
    body: LienActionSuivi,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.suivi.relierAction(
        params.nature,
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/vulnerabilites/suivis/:nature/:id/liens/:actionId',
    summary:
      'Délier une action que la personne peut lire ; l’état de la faille ne change pas (If-Match : version du suivi)',
    tags,
    access: 'vulnerabilites:modifier',
    params: lienAction,
    handler: async ({ svc, s, params, req, ip, reply }) => {
      const r = await svc.vulnerabilites.suivi.delierAction(
        params.nature,
        params.id,
        params.actionId,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/priorite/reglage',
    summary: 'Seuils de la grille de priorité (ETag : version du réglage)',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, reply }) => {
      const r = await svc.vulnerabilites.priorite.lire();
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/vulnerabilites/priorite/reglage',
    summary: 'Régler les seuils de la grille de priorité (If-Match : version du réglage)',
    tags,
    access: 'vulnerabilites:administrer',
    body: ReglagePriorite,
    handler: async ({ svc, s, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.priorite.ecrire(body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/masque/reglage',
    summary:
      'Mots à ne pas masquer par le masque des machines de l’assistant, avec ce que chaque mot laisse sortir (ETag : version du réglage)',
    tags,
    access: 'vulnerabilites:administrer',
    handler: async ({ svc, s, reply }) => {
      const r = await svc.vulnerabilites.masque.lire((s as Session).user);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/masque/effet',
    summary: 'Ce qu’un mot laisserait sortir : machines de l’inventaire dont il est le nom court ou le nom entier',
    tags,
    access: 'vulnerabilites:administrer',
    query: EffetMotQuery,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.masque.effet((s as Session).user, query.mot),
  }),
  route({
    method: 'PUT',
    url: '/api/vulnerabilites/masque/reglage',
    summary: 'Régler la liste des mots à ne pas masquer (If-Match : version du réglage)',
    tags,
    access: 'vulnerabilites:administrer',
    body: ReglageMasque,
    handler: async ({ svc, s, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.masque.ecrire(body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, r.version);
      return r;
    },
  }),
];
