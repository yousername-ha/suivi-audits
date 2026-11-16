/* Module Vulnérabilités (ADR 0100) : produits surveillés (lot V1), veille sur les sources publiques (lots V2 et V3), failles
   et machines lues dans Tenable Security Center (lot V5). Toute route passe par route() : session complète et double
   authentification, activation du module « vulnerabilites », droit exigé, CSRF et origine sur les écritures. La veille se
   lit avec `lire` ; « Collecter maintenant » demande `administrer`. Son flux s'ouvre par la route commune des flux
   (« Activer la veille », administrateur, validation explicite). Failles et machines : lecture à travers les droits du
   périmètre de chaque machine (service FaillesDetectees) ; rôle et périmètre avec `modifier` et l'écriture sur le
   périmètre ; « Synchroniser maintenant » relève du module Intégrations (routes/integrations.ts). */
import {
  AffectationMachine,
  AffectationMachines,
  DemandeCollecte,
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
];
