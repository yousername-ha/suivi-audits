/* Services partagés par les routes (injectés : chaque test construit les siens avec sa propre base). */
import type { Logger } from 'pino';
import { Auth } from './auth.js';
import { Backups } from './backups.js';
import { AlertesExploitation } from './alertes-exploitation.js';
import { AlertesSecurite } from './alertes-securite.js';
import { RemiseAVide } from './remise-a-vide.js';
import { Updates } from './updates.js';
import { Modules } from './modules.js';
import { Operations } from './operations.js';
import type { Config } from './config.js';
import { Db } from './db/db.js';
import { limiter } from './http/security.js';
import { mapsMapper } from './carto/maps.js';
import { carteMapper, collectionMapper, groupeMapper } from './historique/tables/collection.js';
import { COLLECTIONS } from './historique/tables/collections.js';
import { COLLECTIONS_COEUR, CLES_REGLAGES } from './historique/tables/coeur.js';
import { ecartsNatifsMapper } from './historique/ecarts-natifs.js';
import { CARTES, GROUPES } from './historique/tables/groupes.js';
import { reglagesMapper } from './historique/tables/reglages.js';
import { LegacyStore } from './legacy/store.js';
import { Bus, Presence } from './realtime.js';
import { Vault } from './security/crypto.js';
import { Settings } from './settings.js';
import { ConfigGrc } from './config-grc.js';
import { BusinessPolicies } from './business-policy.js';
import { Grc } from './grc/core.js';
import { Walls } from './walls.js';
import { Historique } from './historique/index.js';
import { JournalTechnique } from './journal-technique.js';
import { CalendriersPlateforme } from './calendriers-plateforme.js';
import { Conservation } from './conservation.js';
import { Courriel } from './courriel.js';
import { MotsDePasse } from './mots-de-passe.js';
import { CleSecours } from './cle-secours.js';
import { AdresseSiteService } from './adresse-site.js';
import { NotificationsMetier } from './notifications-metier.js';
import { TypesProcessus } from './types-processus.js';
import { Webauthn } from './webauthn.js';
import { Assistant } from './assistant/index.js';
import { DocumentsAssistant } from './assistant/documents.js';
import { RondesAssistant } from './assistant/rondes.js';
import { RelaisModele, type TransportModele } from './assistant/modele.js';
import { FluxExternes } from './flux-externes.js';
import { ProduitsSurveilles } from './vulnerabilites/produits.js';
import { VeilleVulnerabilites } from './vulnerabilites/veille.js';
import { FaillesDetectees } from './vulnerabilites/failles.js';
import { SynchronisationTenable } from './vulnerabilites/tenable.js';
import { DepotsTenable } from './vulnerabilites/depots.js';
import { SurfaceExterneAlh } from './vulnerabilites/surface-externe.js';
import { LiaisonsMachines } from './vulnerabilites/liaisons-machines.js';
import { MotsNonMasquesVulnerabilites } from './vulnerabilites/mots-non-masques.js';
import { ReglagePrioriteVulnerabilites } from './vulnerabilites/priorite.js';
import { Rapprochements } from './vulnerabilites/rapprochements.js';
import { SuiviFailles } from './vulnerabilites/suivi.js';
import { AssistantVulnerabilites } from './vulnerabilites/assistant.js';
import { AlertesVulnerabilites } from './vulnerabilites/alertes.js';
import { VueEnsembleVulnerabilites } from './vulnerabilites/vue-ensemble.js';
import { Integrations } from './integrations/index.js';
import { Mandataire } from './mandataire.js';

export function createServices(cfg: Config, log: Logger, options: { modele?: TransportModele } = {}) {
  const db = new Db(cfg.db, log);
  /** Flux vers l'extérieur (ADR 0097) : état voulu et appliqué, relu en base à chaque usage. */
  const flux = new FluxExternes(db);
  const vault = new Vault(cfg.masterKey);
  const bus = new Bus(cfg.db, log);
  const legacy = new LegacyStore(cfg, db);
  // Modules repris dans des tables (ADR 0007) : /legacy les affiche, le serveur refuse leurs modifications.
  legacy.register(mapsMapper);
  for (const spec of COLLECTIONS) legacy.register(collectionMapper(spec));
  for (const spec of GROUPES) legacy.register(groupeMapper(spec));
  for (const spec of CARTES) legacy.register(carteMapper(spec));
  for (const spec of COLLECTIONS_COEUR) legacy.register(collectionMapper(spec));
  legacy.register(ecartsNatifsMapper);
  legacy.registerBatch(reglagesMapper(CLES_REGLAGES));
  const settings = new Settings(cfg, db, legacy);
  const businessPolicies = new BusinessPolicies(db);
  const modules = new Modules(cfg.db, db, flux);
  const grc = new Grc(db, legacy, businessPolicies, modules);
  const configGrc = new ConfigGrc(db, grc);
  grc.methodBindings = configGrc;
  const notificationsMetier = new NotificationsMetier(db, settings, cfg.publicUrl);
  grc.notificationsMetier = notificationsMetier;
  const historique = new Historique(grc);
  const alertes = new AlertesExploitation(settings, cfg.publicUrl);
  const alertesSecurite = new AlertesSecurite(db, settings, cfg.publicUrl);
  const motsDePasse = new MotsDePasse(db, vault);
  const auth = new Auth(cfg, db, vault, () => settings.get('securite'), motsDePasse);
  auth.surVerrouillage = (e) => alertesSecurite.verrouillage(e);
  const webauthn = new Webauthn(cfg, db, vault);
  auth.exigenceCle = (u) => webauthn.exigence(u);
  webauthn.surAlerte = (e) => alertesSecurite.cleSecurite(e);
  const modele = options.modele ?? new RelaisModele(cfg.assistantRelais);
  const assistant = new Assistant(db, vault, grc, modele, log, flux);
  const assistantRondes = new RondesAssistant(db, grc, assistant, modele, log);
  assistant.rondes = assistantRondes;
  const assistantDocuments = new DocumentsAssistant(db, vault, assistant, log, flux);
  assistant.documents = assistantDocuments;
  assistant.organisation = historique;
  /* Connecteurs (ADR 0076) ; la synchronisation de Tenable range ses lots dans le module Vulnérabilités (ADR 0100, lot V5). */
  const integrations = new Integrations(db, vault, flux);
  const tenable = new SynchronisationTenable(db, flux, integrations);
  integrations.enLots['tenable:synchroniser'] = tenable;
  /** Mandataire sortant de l'établissement (ADR 0101, lot P1) : réglage système, mot de passe scellé. Remis aussi à
      l'exécutant pour les connecteurs sur Internet (AlgoLightHouse, lot ALH1), jamais pour Tenable. */
  const mandataire = new Mandataire(db, vault);
  integrations.mandataire = mandataire;
  /* Vulnérabilités, lot V4a : seuils de priorité, rapprochements recalculés après chaque collecte NVD réussie. */
  const reglagePriorite = new ReglagePrioriteVulnerabilites(db);
  /* Surface externe lue dans AlgoLightHouse (ADR 0100, lot ALH1), rangée dans le module Vulnérabilités ; priorité de ses CVE
     par la grille commune (lot ALH2). */
  const surfaceExterne = new SurfaceExterneAlh(db, flux, integrations, grc, reglagePriorite);
  integrations.enLots['algolighthouse:synchroniser'] = surfaceExterne;
  const rapprochements = new Rapprochements(db, reglagePriorite);
  const veille = new VeilleVulnerabilites(db, flux, mandataire);
  /* Lot ALH2 : la veille dit sur combien d'actifs exposés lisibles une CVE est vue. */
  veille.surface = surfaceExterne;
  veille.apresCollecte = () => rapprochements.recalculerTout();
  /* Lot V4b : suivi des failles, prévenu par la synchronisation de Tenable et par le recalcul des rapprochements. */
  const suivi = new SuiviFailles(db, grc);
  /* Lot ALH3 : actifs exposés reliés aux machines internes ; propositions recalculées à la fin de chaque synchronisation
     reçue d'AlgoLightHouse ou de Tenable, dans sa transaction. */
  const liaisonsMachines = new LiaisonsMachines(db, grc);
  /* Lot V6 : alertes décidées par la plateforme, évaluées à la fin de chaque synchronisation reçue (dans sa transaction, sous
     un point de sauvegarde), de chaque collecte reçue de la veille et après les décisions qui changent les faits. */
  const alertesVulnerabilites = new AlertesVulnerabilites(
    db,
    reglagePriorite,
    modules,
    surfaceExterne,
    notificationsMetier,
  );
  surfaceExterne.apresSynchronisation = async (k, c) => {
    await liaisonsMachines.recalculer(k, c);
    await alertesVulnerabilites.evaluer('synchronisation-algolighthouse', { k, c });
  };
  tenable.apresSynchronisation = async (k, c, id, complete) => {
    await suivi.apresSynchronisation(k, c, id, complete);
    await liaisonsMachines.recalculer(k, c);
    await alertesVulnerabilites.evaluer('synchronisation-tenable', { k, c });
  };
  veille.apresReception = (source) => alertesVulnerabilites.evaluer(`collecte-${source}`);
  rapprochements.apresBascules = (k, c, produit, bascules) => suivi.apresRapprochement(k, c, produit, bascules);
  const failles = new FaillesDetectees(db, grc, reglagePriorite);
  /* V30 : les machines nommées dans une action suivent le rang des machines. */
  suivi.rangs = (user) => failles.machinesRangees(user);
  /* Assistant (V25, V28) : service de lecture du module, repères des machines et masque de sortie, avec la liste de mots à
     ne pas masquer (V31). */
  const motsNonMasques = new MotsNonMasquesVulnerabilites(db);
  assistant.vulnerabilites = new AssistantVulnerabilites(
    db,
    failles,
    suivi,
    reglagePriorite,
    motsNonMasques,
    surfaceExterne,
  );
  return {
    cfg,
    log,
    db,
    vault,
    settings,
    businessPolicies,
    grc,
    configGrc,
    historique,
    /** Module Vulnérabilités (ADR 0100) : produits surveillés, veille sur les sources publiques (file traitée par l'exécutant),
        failles et machines lues dans Tenable (synchronisation par l'exécutant, lecture par périmètre). */
    vulnerabilites: {
      produits: new ProduitsSurveilles(db, grc, rapprochements, surfaceExterne),
      veille,
      tenable,
      /** Lot V4d : dépôts de Tenable reliés à un périmètre (périmètre hérité par leurs machines). */
      depots: new DepotsTenable(db, grc),
      surfaceExterne,
      /** Lot ALH3 : actifs exposés (AlgoLightHouse) reliés aux machines internes (Tenable). */
      liaisonsMachines,
      failles,
      rapprochements,
      priorite: reglagePriorite,
      masque: motsNonMasques,
      suivi,
      /** Lot V6 : alertes (évaluation par règle, fenêtre d'alerte critique, prise en compte, notifications). */
      alertes: alertesVulnerabilites,
      /** Lot PC1 : vue d'ensemble (poste de commandement), lecture seule, niveau d'alerte et priorités communs à tous. */
      vueEnsemble: new VueEnsembleVulnerabilites(db, alertesVulnerabilites, surfaceExterne),
    },
    modules,
    flux,
    mandataire,
    updates: new Updates(cfg, db, settings, alertes, flux),
    remiseAVide: new RemiseAVide(db),
    backups: new Backups(cfg, db, alertes),
    operations: new Operations(cfg, db, vault, alertes, flux),
    walls: new Walls(cfg, db),
    journalTechnique: new JournalTechnique(db, log),
    typesProcessus: new TypesProcessus(db),
    calendriers: new CalendriersPlateforme(db),
    conservation: new Conservation(db),
    courriel: new Courriel(db, vault, flux),
    /** Module Intégrations (ADR 0076) : connecteurs, secrets scellés, file des exécutions traitée par l'exécutant. */
    integrations,
    notificationsMetier,
    auth,
    motsDePasse,
    webauthn,
    cleSecours: new CleSecours(db, cfg),
    adresseSite: new AdresseSiteService(db, cfg),
    alertesSecurite,
    /** Assistant RSSI (ADR 0086) : le transport du modèle est remplaçable (tests sans réseau). */
    assistant,
    /** Rondes autonomes de l'assistant (lot A3) : lancées par le tic de l'API ou à la demande. */
    assistantRondes,
    /** Texte et index de recherche des documents, pour l'assistant (lot A4). */
    assistantDocuments,
    bus,
    presence: new Presence(db, bus),
    legacy,
    limits: {
      global: limiter(cfg.rateLimitPerMinute, 60e3),
      courrielTest: limiter(5, 10 * 60e3),
      integrationTest: limiter(10, 60e3),
      /** « Synchroniser maintenant » (Tenable) : six demandes par heure et par personne. */
      integrationSynchro: limiter(6, 60 * 60e3),
      /** « Collecter maintenant » de la veille : quatre demandes par heure et par personne (les sources sont publiques). */
      veilleCollecte: limiter(4, 60 * 60e3),
      loginByIp: limiter(20, 15 * 60e3),
      loginByUser: limiter(10, 15 * 60e3),
      mfaBySession: limiter(8, 10 * 60e3),
      mfaByUser: limiter(10, 15 * 60e3),
      motDePasseByUser: limiter(5, 15 * 60e3),
      updateMfaByUser: limiter(5, 15 * 60e3),
      poivreByUser: limiter(5, 60 * 60e3),
      cleSecoursByUser: limiter(5, 60 * 60e3),
      adresseSiteByUser: limiter(5, 60 * 60e3),
      setupByIp: limiter(10, 15 * 60e3),
      presence: limiter(30, 60e3),
      wallActivation: limiter(10, 15 * 60e3),
      /* Clés de sécurité (ADR 0079) : options et vérifications, par session et par compte. */
      webauthnBySession: limiter(10, 10 * 60e3),
      webauthnByUser: limiter(20, 15 * 60e3),
      webauthnGestionByUser: limiter(30, 15 * 60e3),
      codeRecuperationByUser: limiter(5, 15 * 60e3),
      /* Assistant RSSI (ADR 0086) : questions et tests du modèle, par compte. */
      assistantByUser: limiter(30, 10 * 60e3),
      assistantTestByUser: limiter(5, 10 * 60e3),
      assistantRondeByUser: limiter(20, 60 * 60e3),
    },
  };
}
export type Services = ReturnType<typeof createServices>;
