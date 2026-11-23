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
   `administrer`, écriture avec If-Match).
   Lot ALH1 : surface externe lue dans AlgoLightHouse (alertes, actifs, technologies) avec `lire`, à travers les droits du
   périmètre de la plateforme relié à chaque périmètre ALH (non relié : `administrer`) ; liste et liaison des périmètres ALH
   avec `administrer`, If-Match, écriture sur le périmètre actuel et le périmètre visé.
   Lot ALH2 : fiche d'une alerte (défauts et résolutions de l'éditeur, CVE avec leur priorité) avec `lire`, mêmes droits que
   la liste ; tri des alertes et des technologies par priorité.
   Lot V4d : liste et liaison des dépôts de Tenable à un périmètre (périmètre hérité par les machines du dépôt sans
   périmètre indiqué à la main) avec `administrer`, If-Match, écriture sur le périmètre actuel et le périmètre visé.
   Lot ALH3 : actif exposé relié aux machines internes. Fiche des liaisons d'un actif, liste des propositions et actifs
   reliés à une machine avec `lire` (actif et machine lisibles tous deux) ; confirmer, rejeter, relier à la main et délier
   avec `modifier`, If-Match sur la version des liaisons de l'actif, écriture sur le périmètre de l'actif et sur le
   périmètre effectif de la machine (service LiaisonsMachines).
   Lot ALH5 : liaison en masse par motif à joker, avec `modifier` : aperçu obligatoire (rien n'est écrit), puis application
   des seules paires de l'aperçu validé (empreinte), chacune revérifiée ; une entrée de journal par opération.
   Lot V6 : alertes décidées par la plateforme. Liste, fiche et fenêtre d'alerte critique avec `lire` (priorité et faits pour
   tous, nombres limités à ce que la personne lit, aucun nom) ; prise en compte réservée au rôle « RSSI » de la plateforme
   (lot V6b, décision B du 18/11/2026 : 403 pour tout autre compte, administrateur compris), If-Match sur la version de
   l'alerte. Les décisions qui changent les faits (produit, rapprochement, état de suivi, liaison d'un actif, seuil) font
   réévaluer les alertes après leur propre transaction ; l'évaluation ne fait jamais échouer la décision.
   Lot PC1 : vue d'ensemble (poste de commandement) avec `lire`, lecture seule, sans journal : niveau d'alerte, priorités et
   failles suivies les mêmes pour tous ; nombres de machines et d'actifs limités à ce que la personne lit, aucun nom.
   Lot PC2 : parc des machines par zone de rôle avec `lire`, lecture seule, sans journal : seules les machines lisibles sont
   listées ou comptées ; marques et priorité les mêmes pour tous.
   Lot PC3 : périmètres (cartes et détail d'un périmètre) avec `lire`, lecture seule, sans journal : seuls les périmètres,
   machines et actifs lus ; carte « Sans périmètre » pour l'administration du module ; un périmètre illisible répond 404.
   Lot PC4 : fiche illustrée d'une faille (recommandations par source, vecteur d'attaque traduit, schéma, en-tête) avec
   `lire`, lecture seule, sans journal : constat, faille déclarée et alerte d'AlgoLightHouse lus par leur fiche existante
   (404 pour l'illisible ou l'inconnu) ; CVE de la veille ; priorité et marques les mêmes pour tous, nombres lus seulement.
   Lot S1 : délais de correction (avec les seuils de priorité, `administrer`, If-Match) et exceptions ; onglet « Délais et
   exceptions » avec `lire` (mesure des corrections, exceptions des failles lues), lecture seule, sans journal ; accorder,
   prolonger ou lever une exception réservé au rôle RSSI par le service du suivi.
   Lot S2 : tendances (instantanés quotidiens) avec `lire`, lecture seule, sans journal : toute la plateforme (nombres de
   failles communs à tous), un périmètre lu (404 sinon) ou « sans périmètre » (`administrer`). Rapport de pilotage avec
   `lire` (option prudente, à confirmer) : JSON pour la page imprimable, ou CSV ; sa production est tracée au journal
   (période, portée, format), sans contenu ; aucun nom de machine, de domaine ni d'adresse.
   Lot S3 : vue « Correctifs » (groupes par texte de solution de Tenable, et détail d'un groupe) avec `lire`, lecture seule,
   sans journal : priorité et nombres de failles communs à tous ; machines nommées et comptées selon les droits. Filtre
   « fin de support » des constats, des machines et du parc.
   Lot R1 : barre de recherche globale (CVE de la veille et détectées, machines, actifs exposés, applications) avec `lire`,
   lecture seule, sans journal, aucun appel sortant ; machines et actifs lus par les droits de leurs listes ; nombres de
   machines et d'actifs limités à ce que la personne lit ; la recherche des machines de la liste couvre aussi l'adresse IP
   (préfixe) et le système.
   Lot F1 : fréquence des collectes automatiques de chaque source de la veille (`administrer`, If-Match sur la version de la
   source, liste fermée de la source, 422 hors liste, EPSS fixe, journal `vulnerabilites.veille.frequence`) ; celle d'un
   connecteur se règle par la modification de l'instance (module Intégrations, `integrations:administrer`).
   Lot AD-1 : rapport de l'Active Directory (ADS de l'ANSSI) ; lecture en nombres avec `lire`, noms d'un point par une route
   à part, avec `lire` aussi (droit « Analyste » branché sur l'accès au module ; consultation tracée, sans les noms), import (limite horaire partagée) et suppression (If-Match)
   avec `administrer`.
   Lot CPE-1 : saisie assistée par le dictionnaire CPE de la NVD (liste locale, versions d'un produit, saisie en cours) avec
   `modifier` ; état de la source avec `lire` ; réglage et copie complète avec `administrer`, If-Match, journal.
   Lot CVE-INC : compléments de la fiche d'une CVE, ouverture de la fiche d'une CVE inconnue et consultation de cve.org et
   NVD avec `lire` (limites horaires par personne) ; sources facultatives lues avec `lire`, réglées avec `administrer`.
   Lot GRP-MACHINES : groupes de machines lus avec `lire` (machines lues seulement, drapeau hors lecture sans nombre) ;
   créés, modifiés, supprimés et garnis avec `modifier` (le droit qui modifie les machines), If-Match, journal ; fournisseur
   rattaché avec, en plus, `fournisseurs:lire` ; groupes d'un fournisseur avec `lire` et `fournisseurs:lire`. Filtre par
   groupe de la liste et du parc des machines (`groupe`). */
import {
  ADS_BORNES,
  CveParams,
  RechercheAnnonces,
  ReglageSourceAnnonce,
  SourceAnnonceParams,
  IdentifiantPointAdsParams,
  ImportAds,
  MESSAGE_LIMITE_IMPORTS,
  RechercheGlobaleReponse,
  RechercheGlobaleVulnerabilites,
  CleCorrectif,
  RechercheCorrectifs,
  RechercheAlertesVulnerabilites,
  RechercheDelais,
  RechercheRapport,
  RechercheTendances,
  ApplicationLiaisonMasse,
  DemandeLiaisonMasse,
  AffectationMachine,
  AnnulationRapprochement,
  AffectationMachines,
  CorpsDeliaisonMachine,
  CorpsLiaisonMachine,
  DecisionLiaisonMachine,
  RechercheLiaisonsMachines,
  ChangementEtatSuivi,
  CreationActionSuivi,
  DecisionRapprochement,
  LienActionSuivi,
  NatureSuivi,
  RefusPropositionSuivi,
  DemandeCollecte,
  FrequenceVeilleBody,
  SourceVeille,
  EffetMotQuery,
  LiaisonDepotTenable,
  LiaisonPerimetreAlh,
  FicheActifSileneRequete,
  RechercheConstatsSilene,
  RechercheActifsAlh,
  RechercheAlertesAlh,
  RechercheTechnologiesAlh,
  RechercheDeclarees,
  ReglageMasque,
  SaisieReglagePriorite,
  SuggestionsCpeQuery,
  IdentiteProduitCpe,
  RechercheProduitsCpe,
  ReglageDictionnaireCpe,
  type ProduitSurveilleDto,
  RechercheAvis,
  RechercheFailles,
  ProduitSurveilleBody,
  ProduitSurveillePatch,
  ProduitsSurveillesQuery,
  RechercheConstats,
  RechercheMachines,
  RechercheParc,
  IdPerimetreVue,
  ParamsFicheFaille,
  BilanMembresGroupe,
  GroupeMachines,
  GroupeMachinesBody,
  GroupeMachinesPatch,
  GroupesDuFournisseur,
  ListeGroupesMachines,
  MembresGroupeBody,
  PageMachinesGroupe,
  ParamsGroupesFournisseur,
  RechercheMachinesGroupe,
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
    url: '/api/vulnerabilites/recherche',
    summary:
      'Recherche globale du module (lot R1), saisie de 2 à 200 caractères : CVE de la veille locale ou détectées (état : détectée, déclarée, exposée sur ce que la personne lit, présente hors de sa lecture sans nombre, ou non détectée sur le parc ; identifiant bien formé inconnu signalé, sans appel sortant), machines internes (nom, adresse IP, système), actifs exposés (nom de domaine, adresse IP), applications (produits surveillés, technologies d’AlgoLightHouse, contrôles de Tenable) ; 8 résultats au plus par groupe et nombre total ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheGlobaleVulnerabilites,
    response: RechercheGlobaleReponse,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.recherche.chercher((s as Session).user, query.q),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/vue-ensemble',
    summary:
      'Vue d’ensemble du module (poste de commandement) : niveau d’alerte de 1 à 4, tuiles, failles suivies par secteur et priorité (bornées par case, totaux toujours rendus), journal des traces existantes ; priorités et niveau les mêmes pour tous, nombres de machines et d’actifs limités à ce que la personne lit, aucun nom ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, s }) => svc.vulnerabilites.vueEnsemble.lire((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/delais',
    summary:
      'Délais de correction et exceptions (lot S1) : délais cibles par priorité, mesure des corrections sur la période (délai moyen et médian par priorité, part dans les délais ; les mêmes nombres pour tous, sans nom), exceptions en cours et échues des failles que la personne lit ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheDelais,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.delais.lire((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/tendances',
    summary:
      'Tendances (lot S2) : instantanés quotidiens de la situation, jour par jour sur 30 jours ou semaine après semaine (13, 26 ou 52 semaines), pour toute la plateforme (nombres de failles communs à tous, ni total de machines ni d’actifs), un périmètre lu ou « sans périmètre » (administration) ; indicateur de tendance ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheTendances,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.tendances.lire((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/rapport',
    summary:
      'Rapport de pilotage (lot S2) d’un mois ou d’une période libre, pour toute la plateforme ou un périmètre lu : niveau d’alerte et son évolution, failles critiques, délais de correction, dépassements, exceptions, tendances, alertes critiques, état des sources ; JSON (page imprimable) ou CSV ; aucun nom de machine, de domaine ni d’adresse ; production tracée au journal',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheRapport,
    handler: async ({ svc, s, query, ip, reply }) => {
      const { rapport, csv } = await svc.vulnerabilites.rapport.produire((s as Session).user, ip, query);
      if (csv === null) return rapport;
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="rapport-vulnerabilites-${rapport.du}-${rapport.au}.csv"`);
      return reply.send(csv);
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/alertes',
    summary:
      'Alertes du module (critiques : P1, faille exploitée présente ; simples : P2 exploitable sur un actif exposé directement sur Internet), filtrées par état et niveau ; nombres limités à ce que la personne lit, aucun nom ; dit si la personne peut prendre une alerte en compte (rôle RSSI)',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheAlertesVulnerabilites,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.alertes.lister((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/alertes/fenetre',
    summary:
      'Fenêtre d’alerte critique : alertes critiques ouvertes non prises en compte, la plus récente en tête (bornées), et si la personne peut les prendre en compte (rôle RSSI)',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, s }) => svc.vulnerabilites.alertes.fenetre((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/alertes/:id',
    summary: 'Fiche d’une alerte (ETag : version de l’alerte)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params, reply }) => {
      const a = await svc.vulnerabilites.alertes.lire((s as Session).user, params.id);
      setEtag(reply, a.version);
      return a;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/alertes/:id/prise-en-compte',
    summary:
      'Prendre une alerte en compte, pour tout le monde (If-Match : version de l’alerte) ; réservé au rôle RSSI de la plateforme (403 sinon, administrateur compris) ; tracé au journal ; la fenêtre d’alerte critique disparaît',
    tags,
    // Lecture du module comme garde de route (module actif, session, CSRF) ; le rôle RSSI est exigé par le service.
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params, req, ip, reply }) => {
      const a = await svc.vulnerabilites.alertes.prendreEnCompte(
        params.id,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, a.version);
      return a;
    },
  }),
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
      await svc.vulnerabilites.alertes.evaluer('produit-cree');
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
      await svc.vulnerabilites.alertes.evaluer('produit-modifie');
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
      await svc.vulnerabilites.alertes.evaluer('produit-supprime');
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
    handler: async ({ svc, s, query }) => svc.vulnerabilites.veille.failles(query, (s as Session).user),
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
    method: 'PUT',
    url: '/api/vulnerabilites/veille/sources/:source/frequence',
    summary:
      'Veille (lot F1) : régler la fréquence des collectes automatiques d’une source, en heures, dans la liste fermée de la source (NVD : deux heures au moins ; EPSS : fixe) ; If-Match : version de la source ; 422 hors liste',
    tags,
    access: 'vulnerabilites:administrer',
    params: z.object({ source: SourceVeille }),
    body: FrequenceVeilleBody,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.veille.reglerFrequence(
        params.source,
        body.frequenceHeures,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, r.version);
      return r;
    },
  }),
  /* Lot CVE-INC : CVE inconnue de la veille et sources facultatives. Lecture et consultation avec `lire` (la fiche d'une CVE
     se lit avec ce droit ; seule la CVE sort, sur le clic de la personne, dans la limite horaire) ; réglage des sources
     facultatives avec `administrer`, If-Match, journal. */
  route({
    method: 'GET',
    url: '/api/vulnerabilites/cves/:cve/complements',
    summary:
      'CVE : compléments de sa fiche (consultation de cve.org et NVD, contrôles Tenable qui la citent, annonces des sources facultatives), lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    params: CveParams,
    handler: async ({ svc, params }) =>
      svc.vulnerabilites.cveInconnues.complements(
        params.cve,
        !(await svc.modules.state()).disabled.includes('integrations'),
      ),
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/cves/:cve/ouverture',
    summary:
      'CVE inconnue de la veille : ouverture de sa fiche (veille active de l’exécutant ; recherche des contrôles Tenable qui la citent si une intégration Security Center est active et son flux ouvert, sans clic, pas avant 24 heures)',
    tags,
    access: 'vulnerabilites:lire',
    params: CveParams,
    handler: async ({ svc, s, params }) => {
      const sess = s as Session;
      return svc.vulnerabilites.cveInconnues.ouvrir(
        params.cve,
        !(await svc.modules.state()).disabled.includes('integrations'),
        () => svc.limits.cveTenable(sess.user.id),
      );
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/cves/:cve/consultation',
    summary:
      'CVE inconnue de la veille : consulter cve.org et NVD (sur clic ; demande traitée par l’exécutant ; pas avant 24 heures pour une même CVE, vingt nouvelles consultations par heure et par personne)',
    tags,
    access: 'vulnerabilites:lire',
    params: CveParams,
    handler: async ({ svc, s, params, ip }) => {
      const sess = s as Session;
      return svc.vulnerabilites.cveInconnues.demander(params.cve, sess.user, ip, () =>
        svc.limits.cveConsultation(sess.user.id),
      );
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/veille/annonces/sources',
    summary:
      'Veille : sources facultatives (préavis de Cloudflare Radar, résumés de tldrcve) — activation, fréquence, dernière collecte',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc }) => svc.vulnerabilites.annonces.etat(),
  }),
  route({
    method: 'PATCH',
    url: '/api/vulnerabilites/veille/annonces/sources/:source',
    summary:
      'Veille : activer ou désactiver une source facultative, régler sa fréquence (minutes, liste fermée de la source) ; If-Match : version de la source',
    tags,
    access: 'vulnerabilites:administrer',
    params: SourceAnnonceParams,
    body: ReglageSourceAnnonce,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.annonces.regler(
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
    method: 'GET',
    url: '/api/vulnerabilites/veille/annonces',
    summary:
      'Veille : annonces d’une source facultative, paginées (préavis non remplacés, résumés de tldrcve), avec les faits de la plateforme',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheAnnonces,
    handler: async ({ svc, query }) => svc.vulnerabilites.annonces.liste(query),
  }),
  /* Lot CPE-1 : saisie assistée par le dictionnaire CPE de la NVD. Liste locale et versions avec `modifier` (droit qui
     protège le formulaire d'un produit surveillé), aucun appel extérieur ici ; état de la source avec `lire` ; réglage,
     copie complète demandée ou supprimée avec `administrer`, If-Match, journal. */
  route({
    method: 'POST',
    url: '/api/vulnerabilites/cpe/saisie',
    summary:
      'Dictionnaire CPE : ouverture du formulaire d’un produit surveillé (note la saisie en cours, deux minutes) et ce qu’il peut proposer',
    tags,
    access: 'vulnerabilites:modifier',
    handler: async ({ svc }) => svc.vulnerabilites.dictionnaireCpe.ouvrirSaisie(),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/cpe/produits',
    summary:
      'Dictionnaire CPE : produits de la liste locale qui contiennent le terme (2 à 100 caractères, sans casse ni accent), 20 au plus',
    tags,
    access: 'vulnerabilites:modifier',
    query: RechercheProduitsCpe,
    handler: async ({ svc, query }) => svc.vulnerabilites.dictionnaireCpe.rechercher(query.q),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/cpe/versions',
    summary:
      'Dictionnaire CPE : versions connues d’un produit de la liste locale (copie complète, cache de la NVD, veille), sans nouvelle demande',
    tags,
    access: 'vulnerabilites:modifier',
    query: IdentiteProduitCpe,
    handler: async ({ svc, s, query }) =>
      svc.vulnerabilites.dictionnaireCpe.versions(query, (s as Session).user, false),
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/cpe/versions',
    summary:
      'Dictionnaire CPE : versions d’un produit ; sans réponse fraîche, inscrit une demande à la NVD traitée par l’exécutant (une par produit, trente par heure et par personne)',
    tags,
    access: 'vulnerabilites:modifier',
    body: IdentiteProduitCpe,
    handler: async ({ svc, s, body }) => {
      const sess = s as Session;
      return svc.vulnerabilites.dictionnaireCpe.versions(body, sess.user, true, () =>
        svc.limits.cpeVersions(sess.user.id),
      );
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/cpe/dictionnaire',
    summary:
      'Dictionnaire CPE : état de la source (activation, fréquence, chargement par lots, dernière mise à jour, copie complète)',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, reply }) => {
      const e = await svc.vulnerabilites.dictionnaireCpe.etat();
      setEtag(reply, e.version);
      return e;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/vulnerabilites/cpe/dictionnaire',
    summary:
      'Dictionnaire CPE : activer ou désactiver la source, régler la fréquence des nouveautés (24 ou 168 heures) ; If-Match',
    tags,
    access: 'vulnerabilites:administrer',
    body: ReglageDictionnaireCpe,
    handler: async ({ svc, s, body, req, ip, reply }) => {
      const e = await svc.vulnerabilites.dictionnaireCpe.regler(body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, e.version);
      return e;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/cpe/dictionnaire/copie',
    summary:
      'Dictionnaire CPE : copier le dictionnaire complet (produits et versions, par lots) sur le serveur ; If-Match',
    tags,
    access: 'vulnerabilites:administrer',
    handler: async ({ svc, s, req, ip, reply }) => {
      const e = await svc.vulnerabilites.dictionnaireCpe.demanderCopie(requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, e.version);
      return e;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/vulnerabilites/cpe/dictionnaire/copie',
    summary: 'Dictionnaire CPE : supprimer la copie complète (place libérée) ; If-Match',
    tags,
    access: 'vulnerabilites:administrer',
    handler: async ({ svc, s, req, ip, reply }) => {
      const e = await svc.vulnerabilites.dictionnaireCpe.supprimerCopie(requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, e.version);
      return e;
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
    url: '/api/vulnerabilites/imports/etat',
    summary:
      'Failles détectées : état des imports de scans Nessus de chaque instance « Nessus, import de fichier » (dernier import et son bilan chiffré)',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc }) => svc.vulnerabilites.importNessus.etat(),
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
    url: '/api/vulnerabilites/correctifs',
    summary:
      'Correctifs (lot S3) : failles détectées par Tenable encore à traiter, regroupées par texte de solution (anglais, tel quel), triées par gain (priorité, puis nombre de failles corrigées) ; priorité, marques, délai, état du correctif et nombres de failles communs à tous, machines lues seulement ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheCorrectifs,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.correctifs.lister((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/correctifs/:cle',
    summary:
      'Détail d’un correctif (lot S3) : ses failles (fiche ouverte seulement si une de leurs machines est lue) et les machines concernées que la personne lit ; groupe inconnu : 404 ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    params: z.object({ cle: CleCorrectif }),
    handler: async ({ svc, s, params }) => svc.vulnerabilites.correctifs.detail((s as Session).user, params.cle),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/fiches/:nature/:id',
    summary:
      'Fiche illustrée d’une faille (constat, faille déclarée, CVE de la veille, alerte AlgoLightHouse) : priorité et marques, vecteurs CVSS publiés, recommandations par source, présence lue',
    tags,
    access: 'vulnerabilites:lire',
    params: ParamsFicheFaille,
    handler: async ({ svc, s, params }) =>
      svc.vulnerabilites.fiches.fiche((s as Session).user, params.nature, params.id),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines',
    summary:
      'Machines lisibles (périmètre, ou administration du module pour celles sans périmètre) ; recherche par nom, filtres rôle et périmètre, catégorie minimale de criticité (ACR) et d’exposition (AES) selon Tenable (une machine sans valeur ne répond à aucun de ces filtres) ; constats présents par gravité',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheMachines,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.failles.machines((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines/parc',
    summary:
      'Parc des machines lisibles par zone de rôle (front, back applicatif, base de données, rôle non indiqué), dans l’ordre du rang, avec leurs marques (priorité la plus haute, zero-day, exploitable) ; mêmes filtres que la liste ; 250 machines au plus par zone, totaux de chaque zone rendus ; aucune machine illisible comptée ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheParc,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.failles.parc((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines/perimetres',
    summary:
      'Périmètres lus, du plus critique au moins critique : machines lues, priorité la plus haute, failles présentes par gravité, machines zero-day et exploitables, actifs exposés rattachés ; carte « Sans périmètre » pour l’administration du module ; aucun total de ce qui est illisible ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, s }) => svc.vulnerabilites.perimetres.lister((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines/perimetres/:id',
    summary:
      'Détail d’un périmètre lu (ou « aucun » : machines sans périmètre, administration du module) : sa carte, ses machines par zone de rôle dans l’ordre du rang (250 au plus par zone), actifs exposés lisibles reliés par une liaison confirmée (3 nommés au plus par machine) ; périmètre illisible : 404 ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    params: z.object({ id: IdPerimetreVue }),
    handler: async ({ svc, s, params }) => svc.vulnerabilites.perimetres.detail((s as Session).user, params.id),
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
    url: '/api/vulnerabilites/groupes',
    summary:
      'Groupes de machines (lot GRP-MACHINES), par nom : nom, description, fournisseur rattaché (nom lu dans le registre, ou « supprimé »), nombre de machines que la personne lit et drapeau « d’autres machines hors de votre lecture », sans nombre ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    response: ListeGroupesMachines,
    handler: async ({ svc, s }) => svc.vulnerabilites.groupes.lister((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/groupes/:id',
    summary: 'Un groupe de machines (ETag : version du groupe)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    response: GroupeMachines,
    handler: async ({ svc, s, params, reply }) => {
      const g = await svc.vulnerabilites.groupes.lire((s as Session).user, params.id);
      setEtag(reply, g.version);
      return g;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/groupes/:id/machines',
    summary:
      'Fenêtre d’un groupe : machines que la personne lit, membres ou non (`membres` : oui ou non), recherche par nom (partiel) ou adresse IP (début), par nom, 25 par page ; autres groupes de chaque machine ; identifiants de toutes les machines trouvées (500 au plus) pour « Tout cocher » (ETag : version du groupe) ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    query: RechercheMachinesGroupe,
    response: PageMachinesGroupe,
    handler: async ({ svc, s, params, query, reply }) => {
      const p = await svc.vulnerabilites.groupes.machines((s as Session).user, params.id, query);
      setEtag(reply, p.groupe.version);
      return p;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/groupes',
    summary:
      'Créer un groupe de machines : nom unique à la casse près, description, fournisseur facultatif (droit de lire les fournisseurs exigé, fournisseur présent au registre), machines lues par la personne (500 au plus) ; journalisé',
    tags,
    access: 'vulnerabilites:modifier',
    body: GroupeMachinesBody,
    status: 201,
    response: GroupeMachines,
    handler: async ({ svc, s, body, ip, reply }) => {
      const g = await svc.vulnerabilites.groupes.creer(body, (s as Session).user, ip);
      setEtag(reply, g.version);
      return g;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/vulnerabilites/groupes/:id',
    summary:
      'Renommer, décrire un groupe ou changer son fournisseur (If-Match : version du groupe) ; changer le fournisseur exige aussi le droit de lire les fournisseurs ; journalisé',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: GroupeMachinesPatch,
    response: GroupeMachines,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const g = await svc.vulnerabilites.groupes.modifier(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, g.version);
      return g;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/vulnerabilites/groupes/:id',
    summary:
      'Supprimer un groupe de machines (If-Match : version du groupe) ; refusé (409) s’il compte des machines hors de la lecture de la personne ; les machines restent ; journalisé',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    handler: async ({ svc, s, params, req, ip }) => {
      await svc.vulnerabilites.groupes.supprimer(params.id, requireIfMatch(req), (s as Session).user, ip);
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/groupes/:id/machines',
    summary:
      'Ajouter et retirer des machines d’un groupe en lot (500 au plus), tout ou rien ; chaque machine doit être lue par la personne (sinon 404) ; If-Match : version du groupe, qui augmente si quelque chose change ; journalisé',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: MembresGroupeBody,
    response: BilanMembresGroupe,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const b = await svc.vulnerabilites.groupes.membres(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, b.groupe.version);
      return b;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/fournisseurs/:id/groupes',
    summary:
      'Groupes de machines rattachés à un fournisseur (fiche du fournisseur) : nom, description, nombre de machines lues, drapeau hors lecture, failles critiques ouvertes comptées sur les seules machines lues ; aucun détail de machine ; exige aussi le droit de lire les fournisseurs (403) ; fournisseur absent du registre : 404 ; lecture seule',
    tags,
    access: 'vulnerabilites:lire',
    params: ParamsGroupesFournisseur,
    response: GroupesDuFournisseur,
    handler: async ({ svc, s, params }) => svc.vulnerabilites.groupes.duFournisseur((s as Session).user, params.id),
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
      'Rôle et périmètre d’une machine (If-Match) ; écriture exigée sur le périmètre effectif actuel et le périmètre visé ; retirer le périmètre indiqué à la main rend celui du dépôt Tenable relié (sans dépôt relié : administrer)',
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
    method: 'GET',
    url: '/api/vulnerabilites/depots',
    summary:
      'Dépôts de Tenable et leur liaison à un périmètre de la plateforme, hérité par leurs machines sans périmètre indiqué à la main (administration du module)',
    tags,
    access: 'vulnerabilites:administrer',
    handler: async ({ svc }) => svc.vulnerabilites.depots.lister(),
  }),
  route({
    method: 'PUT',
    url: '/api/vulnerabilites/depots/:id',
    summary:
      'Relier (ou délier) un dépôt de Tenable à un périmètre de la plateforme (If-Match) ; écriture exigée sur le périmètre actuel et le périmètre visé',
    tags,
    access: 'vulnerabilites:administrer',
    params: id,
    body: LiaisonDepotTenable,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.depots.lier(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, r.version);
      return r;
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
      await svc.vulnerabilites.alertes.evaluer('rapprochement-decide');
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
      await svc.vulnerabilites.alertes.evaluer('rapprochement-annule');
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
      'Changer l’état d’une faille (If-Match : version du suivi) ; note obligatoire pour « risque accepté » et « non concernée » ; toutes les machines touchées doivent être lisibles. Lot S1 : accorder, prolonger ou lever une exception (risque accepté) est réservé au rôle RSSI de la plateforme (403 sinon, administrateur compris) et exige une justification, une mesure compensatoire et une échéance d’au plus douze mois',
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
      await svc.vulnerabilites.alertes.evaluer('suivi-etat');
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
    url: '/api/vulnerabilites/surface/etat',
    summary:
      'Surface externe : état de la synchronisation de chaque instance AlgoLightHouse (dernière exécution, dernière complète)',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, s }) => svc.vulnerabilites.surfaceExterne.etat((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/alertes',
    summary:
      'Alertes AlgoLightHouse lisibles (périmètre relié, ou administration du module pour un périmètre non relié), avec leur priorité ; recherche par titre, cible ou CVE ; filtres type, criticité, statut ; tri par priorité',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheAlertesAlh,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.surfaceExterne.alertes((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/alertes/:id',
    summary:
      'Fiche d’une alerte AlgoLightHouse lisible : CVE avec leur priorité et leurs sources, défauts et résolutions recommandés par l’éditeur (texte simple)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params }) => svc.vulnerabilites.surfaceExterne.alerte((s as Session).user, params.id),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/actifs',
    summary:
      'Actifs exposés lisibles, liste commune à AlgoLightHouse et à Silène (lot SI1 : un actif par adresse IP ou nom de domaine, avec ce que chaque source en dit) ; recherche par adresse ou domaine ; filtre par type',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheActifsAlh,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.surfaceExterne.actifs((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/silene',
    summary:
      'Note Silène de chaque instance lisible (note, sous-note réseau, nombres par famille, date du rapport, évolution, historique) et état de son dernier import',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, s }) => svc.vulnerabilites.silene.notes((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/silene/constats',
    summary:
      'Constats Silène lisibles et présents, par contrôle (classe, points, hôtes concernés) ; recherche par contrôle, identifiant ou adresse',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheConstatsSilene,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.silene.constats((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/silene/constats/:id',
    summary:
      'Fiche d’un constat Silène lisible : détail par hôte (port, protocole, service, produit, nom, type, échéance)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params }) => svc.vulnerabilites.silene.constat((s as Session).user, params.id),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/silene/actif',
    summary:
      'Ce que Silène dit d’un actif lisible (adresse IP ou nom de domaine) : ports ouverts, noms, produits, constats',
    tags,
    access: 'vulnerabilites:lire',
    query: FicheActifSileneRequete,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.silene.ficheActif((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/silene/perimetres',
    summary: 'Instances Silène et le périmètre de la plateforme relié à chacune (non relié : administration seulement)',
    tags,
    access: 'vulnerabilites:administrer',
    handler: async ({ svc }) => svc.vulnerabilites.silene.perimetres(),
  }),
  route({
    method: 'PUT',
    url: '/api/vulnerabilites/surface/silene/perimetres/:id',
    summary:
      'Relier (ou délier) une instance Silène à un périmètre de la plateforme (If-Match, 0 si jamais reliée) ; écriture exigée sur le périmètre actuel et le périmètre visé',
    tags,
    access: 'vulnerabilites:administrer',
    params: id,
    body: LiaisonPerimetreAlh,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.silene.lier(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/carte',
    summary:
      'Carte « Lignes d’approche » de la surface externe, deux sources (AlgoLightHouse, Silène) : actifs lisibles et présents, domaine parent, alertes ouvertes lisibles avec leur priorité, machines internes reliées lisibles, ports ouverts et constats Silène des hôtes ; bornée, déjà filtrée par les droits',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc, s }) => svc.vulnerabilites.surfaceExterne.carte((s as Session).user),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/technologies',
    summary:
      'Technologies AlgoLightHouse détectées sur des actifs lisibles, versions et CVE (score, EPSS, preuve, exploitation selon l’éditeur, priorité), produits surveillés rapprochés ; tri par priorité',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheTechnologiesAlh,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.surfaceExterne.technologies((s as Session).user, query),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/perimetres',
    summary: 'Périmètres AlgoLightHouse et leur liaison à un périmètre de la plateforme (administration du module)',
    tags,
    access: 'vulnerabilites:administrer',
    handler: async ({ svc }) => svc.vulnerabilites.surfaceExterne.perimetres(),
  }),
  route({
    method: 'PUT',
    url: '/api/vulnerabilites/surface/perimetres/:id',
    summary:
      'Relier (ou délier) un périmètre AlgoLightHouse à un périmètre de la plateforme (If-Match) ; écriture exigée sur le périmètre actuel et le périmètre visé',
    tags,
    access: 'vulnerabilites:administrer',
    params: id,
    body: LiaisonPerimetreAlh,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.surfaceExterne.lier(
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
    url: '/api/vulnerabilites/surface/actifs/:id/machines',
    summary:
      'Machines internes reliées à un actif exposé lisible, propositions à décider et rejets (machines lisibles seulement ; ETag : version des liaisons de l’actif)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params, reply }) => {
      const f = await svc.vulnerabilites.liaisonsMachines.fiche((s as Session).user, params.id);
      setEtag(reply, f.versionLiaisons);
      return f;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/surface/actifs/:id/machines',
    summary:
      'Relier à la main un actif exposé à une machine interne lisible (If-Match : version des liaisons de l’actif) ; écriture exigée sur le périmètre de l’actif et sur celui de la machine',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: CorpsLiaisonMachine,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const f = await svc.vulnerabilites.liaisonsMachines.relier(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      await svc.vulnerabilites.alertes.evaluer('liaison-manuelle');
      setEtag(reply, f.versionLiaisons);
      return f;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/surface/liaisons',
    summary:
      'Liaisons entre actifs exposés et machines internes d’un statut (par défaut : propositions à décider), actif et machine lisibles',
    tags,
    access: 'vulnerabilites:lire',
    query: RechercheLiaisonsMachines,
    handler: async ({ svc, s, query }) => svc.vulnerabilites.liaisonsMachines.lister((s as Session).user, query),
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/surface/liaisons/masse/apercu',
    summary:
      'Aperçu d’une liaison en masse par motif à joker « * » (actifs lisibles et présents, machines lisibles ; 200 paires au plus, sinon 422 avec le nombre) ; rien n’est écrit',
    tags,
    access: 'vulnerabilites:modifier',
    body: DemandeLiaisonMasse,
    handler: async ({ svc, s, body }) => svc.vulnerabilites.liaisonsMachines.apercuMasse((s as Session).user, body),
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/surface/liaisons/masse',
    summary:
      'Relier en masse les paires d’un aperçu validé (empreinte) ; chaque paire est revérifiée (droits, version des liaisons de l’actif, plafond), sinon écartée et comptée',
    tags,
    access: 'vulnerabilites:modifier',
    body: ApplicationLiaisonMasse,
    handler: async ({ svc, s, body, ip }) => {
      const r = await svc.vulnerabilites.liaisonsMachines.appliquerMasse((s as Session).user, body, ip);
      await svc.vulnerabilites.alertes.evaluer('liaison-masse');
      return r;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/surface/liaisons/:id/decision',
    summary:
      'Confirmer ou rejeter une proposition de liaison (If-Match : version des liaisons de l’actif) ; écriture exigée sur le périmètre de l’actif et sur celui de la machine',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: DecisionLiaisonMachine,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const f = await svc.vulnerabilites.liaisonsMachines.decider(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      await svc.vulnerabilites.alertes.evaluer('liaison-decidee');
      setEtag(reply, f.versionLiaisons);
      return f;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/surface/liaisons/:id/deliaison',
    summary:
      'Délier une machine interne d’un actif exposé (If-Match : version des liaisons de l’actif) ; elle n’est pas reproposée à données égales',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: CorpsDeliaisonMachine,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const f = await svc.vulnerabilites.liaisonsMachines.delier(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      await svc.vulnerabilites.alertes.evaluer('liaison-deliee');
      setEtag(reply, f.versionLiaisons);
      return f;
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/machines/:id/surface',
    summary: 'Actifs exposés sur Internet lisibles reliés à une machine lisible (« exposée sur Internet par … »)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, s, params }) =>
      svc.vulnerabilites.liaisonsMachines.deMachine((s as Session).user, params.id),
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
    summary:
      'Régler les seuils de la grille de priorité et les délais cibles de correction par priorité (lot S1) : seuil, délais, ou les deux, le reste est gardé (If-Match : version du réglage)',
    tags,
    access: 'vulnerabilites:administrer',
    body: SaisieReglagePriorite,
    handler: async ({ svc, s, body, req, ip, reply }) => {
      const r = await svc.vulnerabilites.priorite.ecrire(body, requireIfMatch(req), (s as Session).user, ip);
      await svc.vulnerabilites.alertes.evaluer('seuil-priorite');
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
  // Lot AD-1 : rapport de l'Active Directory (ADS de l'ANSSI). Lecture en nombres avec `lire` ; noms d'un point par une route
  // à part, avec `lire` (décision du RSSI du 20/11/2026), consultation tracée ; import et suppression avec `administrer`.
  route({
    method: 'GET',
    url: '/api/vulnerabilites/annuaire',
    summary:
      'Rapport de l’Active Directory : note globale et son évolution, progression par niveau, points ouverts (nombre d’objets et variation), corrigés depuis l’import précédent ; nombres seulement, jamais de nom',
    tags,
    access: 'vulnerabilites:lire',
    handler: async ({ svc }) => svc.vulnerabilites.annuaire.lire(),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/annuaire/points/:identifiant/noms',
    summary:
      'Noms des objets d’un point de contrôle (dernier import, apparus et corrigés depuis le précédent)  : route à part, chaque consultation tracée au journal sans les noms',
    tags,
    access: 'vulnerabilites:lire',
    params: IdentifiantPointAdsParams,
    handler: async ({ svc, s, params, ip }) =>
      svc.vulnerabilites.annuaire.noms(params.identifiant, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/annuaire/imports',
    summary:
      'Importer le rapport de l’Active Directory (extrait en liste blanche lu dans le navigateur, revalidé) ; noms des imports plus anciens que les deux derniers effacés',
    tags,
    access: 'vulnerabilites:administrer',
    body: ImportAds,
    bodyLimit: ADS_BORNES.corps,
    status: 201,
    handler: async ({ svc, s, body, ip }) => {
      const sess = s as Session;
      // Même limite que les imports Nessus et Silène : fichiers commencés par heure et par personne, tous imports confondus.
      if (!svc.limits.importNessus(sess.user.id)) throw new HttpError(429, MESSAGE_LIMITE_IMPORTS);
      const bilan = await svc.vulnerabilites.annuaire.importer(body, sess.user, ip);
      // Transaction validée : statistiques des tables qui grossissent, sans jamais faire échouer la réponse.
      await svc.vulnerabilites.annuaire.apresValidation();
      return bilan;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/vulnerabilites/annuaire/imports/:id',
    summary:
      'Supprimer un import du rapport de l’Active Directory, ses points et ses noms (If-Match : version de l’import)',
    tags,
    access: 'vulnerabilites:administrer',
    params: id,
    handler: async ({ svc, s, params, req, ip }) =>
      svc.vulnerabilites.annuaire.supprimer(params.id, requireIfMatch(req), (s as Session).user, ip),
  }),
];
