/* Veille réglementaire (ADR 0110, lot VR-1). Toute route passe par route() : session complète et double authentification,
   activation du module « veille_reglementaire », droit exigé, CSRF et origine sur les écritures. Lecture (synthèse,
   publications, état des sources, droits de la personne) avec `lire` OU le droit réservé `veille_reglementaire:dpo`, qui
   ouvre le module à lui seul (liste de permissions de route(), l'une suffit) ; qualification avec l'un des deux et, selon le
   domaine de la publication, le rôle RSSI (sécurité) ou le droit « DPO » (données personnelles) ; 403 sinon,
   administrateur compris ; If-Match sur la version ; réglage d'une source (activation, fréquence ; If-Match), mots-clés des filtres d'EUR-Lex et du Journal officiel (If-Match) et
   « Collecter maintenant » avec `administrer`.
   Le flux s'ouvre par la route commune des flux (« Activer la veille réglementaire », administrateur, validation
   explicite). */
import {
  DemandeCollecteReglementaire,
  LECTURE_VEILLE_REGLEMENTAIRE,
  MotsClesEurLexBody,
  QualificationBody,
  RecherchePublications,
  ReglageSourceReglementaire,
  SourceReglementaire,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';

const tags = ['Veille réglementaire'];
const base = '/api/veille-reglementaire';

export const veilleReglementaireRoutes = [
  route({
    method: 'GET',
    url: `${base}/synthese`,
    summary:
      'Veille réglementaire : nombre de publications par statut (au total et par domaine), dernière collecte réussie, sources activées en erreur',
    tags,
    access: LECTURE_VEILLE_REGLEMENTAIRE,
    handler: async ({ svc }) => svc.veilleReglementaire.synthese(),
  }),
  route({
    method: 'GET',
    url: `${base}/publications`,
    summary:
      'Veille réglementaire : publications, les plus récentes d’abord, filtrées par statut, domaine et source, recherche dans le titre et le résumé ; 25 par page',
    tags,
    access: LECTURE_VEILLE_REGLEMENTAIRE,
    query: RecherchePublications,
    handler: async ({ svc, query }) => svc.veilleReglementaire.publications(query),
  }),
  route({
    method: 'GET',
    url: `${base}/publications/:id`,
    summary: 'Veille réglementaire : une publication et sa qualification',
    tags,
    access: LECTURE_VEILLE_REGLEMENTAIRE,
    params: z.object({ id: z.uuid() }),
    handler: async ({ svc, params, reply }) => {
      const p = await svc.veilleReglementaire.publication(params.id);
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'PATCH',
    url: `${base}/publications/:id`,
    summary:
      'Veille réglementaire : qualifier une publication (sans objet, à suivre, impactant) ; rôle RSSI pour le domaine sécurité, droit réservé « DPO » (veille_reglementaire:dpo) pour les données personnelles, même pour un administrateur ; If-Match : version de la publication',
    tags,
    access: LECTURE_VEILLE_REGLEMENTAIRE,
    params: z.object({ id: z.uuid() }),
    body: QualificationBody,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const p = await svc.veilleReglementaire.qualifier(
        params.id,
        body.statut,
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
    url: `${base}/sources`,
    summary:
      'Veille réglementaire : état du flux, de l’exécutant et de chaque source (activée, fréquence, dernière collecte réussie, erreur, retard, prochaine collecte)',
    tags,
    access: LECTURE_VEILLE_REGLEMENTAIRE,
    handler: async ({ svc }) => svc.veilleReglementaire.etat(),
  }),
  route({
    method: 'GET',
    url: `${base}/droits`,
    summary:
      'Veille réglementaire : ce que la personne peut faire (administrer les sources, qualifier chaque domaine), pour l’affichage seulement',
    tags,
    access: LECTURE_VEILLE_REGLEMENTAIRE,
    handler: async ({ svc, s }) => svc.veilleReglementaire.droits((s as Session).user),
  }),
  route({
    method: 'PATCH',
    url: `${base}/sources/:source`,
    summary:
      'Veille réglementaire : activer ou désactiver une source, régler sa fréquence (4, 12, 24 ou 168 heures) ; If-Match : version de la source ; 422 hors liste ou source sans collecteur',
    tags,
    access: 'veille_reglementaire:administrer',
    params: z.object({ source: SourceReglementaire }),
    body: ReglageSourceReglementaire,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.veilleReglementaire.reglerSource(
        params.source,
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
    method: 'PUT',
    url: `${base}/sources/:source/mots-cles`,
    summary:
      'Veille réglementaire : régler les mots-clés du filtre d’EUR-Lex ou du Journal officiel (legifrance), chacun sa liste (1 à 60 mots de 2 à 60 caractères, chacun avec son domaine ; null : liste par défaut de la source) ; If-Match : version de la source ; 422 pour une autre source',
    tags,
    access: 'veille_reglementaire:administrer',
    params: z.object({ source: SourceReglementaire }),
    body: MotsClesEurLexBody,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.veilleReglementaire.reglerMotsCles(
        params.source,
        body.motsCles,
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
    url: `${base}/collectes`,
    summary:
      'Veille réglementaire : « Collecter maintenant » une source activée, ou toutes ; refusé si le flux est fermé ou l’exécutant absent',
    tags,
    access: 'veille_reglementaire:administrer',
    body: DemandeCollecteReglementaire,
    status: 201,
    handler: async ({ svc, s, body, ip }) => {
      const sess = s as Session;
      if (!svc.limits.veilleCollecte(`reglementaire:${sess.user.id}`))
        throw new HttpError(429, 'Trop de demandes de collecte. Réessayez dans une heure.');
      return svc.veilleReglementaire.demander(body.source, sess.user, ip);
    },
  }),
];
