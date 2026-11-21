/* Services partagés par les routes (injectés : chaque test construit les siens avec sa propre base). */
import { NESSUS_BORNES } from '@suivi/shared';
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
import { ContactsCriseComptes } from './contacts-crise-comptes.js';
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
import { VeilleReglementaire } from './veille-reglementaire.js';
import { PurgeJournaux } from './vulnerabilites/purge-journaux.js';
import { FaillesDetectees } from './vulnerabilites/failles.js';
import { SynchronisationTenable } from './vulnerabilites/tenable.js';
import { ImportNessus } from './vulnerabilites/import-nessus.js';
import { AnnuaireAd } from './vulnerabilites/annuaire-ad.js';
import { ImportSilene } from './vulnerabilites/import-silene.js';
import { SurfaceSilene } from './vulnerabilites/surface-silene.js';
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
import { PerimetresVulnerabilites } from './vulnerabilites/perimetres.js';
import { FichesFailles } from './vulnerabilites/fiches.js';
import { DelaisVulnerabilites } from './vulnerabilites/delais.js';
import { TendancesVulnerabilites } from './vulnerabilites/tendances.js';
import { CorrectifsVulnerabilites } from './vulnerabilites/correctifs.js';
import { RechercheVulnerabilites } from './vulnerabilites/recherche.js';
import { RapportVulnerabilites } from './vulnerabilites/rapport.js';
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
  const historique = new Historique(grc, settings);
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
  /* Lot SI1 : surface externe importée de Silène (ANSSI), réunie avec AlgoLightHouse dans la liste « Actifs ». */
  const sileneSurface = new SurfaceSilene(db, grc);
  surfaceExterne.silene = sileneSurface;
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
  /* Lot N1 : import d'un scan Nessus, rangé par le chemin d'écriture de Tenable ; chaque lot est un passage complet pour ses
     machines, suivi des mêmes traitements qu'une synchronisation reçue. */
  const importNessus = new ImportNessus(db, integrations, tenable);
  importNessus.apresImport = async (k, c, id) => {
    await suivi.apresSynchronisation(k, c, id, true);
    await liaisonsMachines.recalculer(k, c);
    await alertesVulnerabilites.evaluer('import-nessus', { k, c });
  };
  // Lot N2 : après la suppression d'une instance d'import, liaisons et alertes réévaluées dans la même transaction.
  importNessus.apresSuppression = async (k, c) => {
    await liaisonsMachines.recalculer(k, c);
    await alertesVulnerabilites.evaluer('suppression-import-nessus', { k, c });
  };
  veille.apresReception = (source) => alertesVulnerabilites.evaluer(`collecte-${source}`);
  rapprochements.apresBascules = (k, c, produit, bascules) => suivi.apresRapprochement(k, c, produit, bascules);
  const failles = new FaillesDetectees(db, grc, reglagePriorite);
  /* V30 : les machines nommées dans une action suivent le rang des machines. */
  suivi.rangs = (user) => failles.machinesRangees(user);
  /* Lot S1 : délais de correction et exceptions à échéance (évaluation au tic de l'API, mesure des corrections). */
  const delais = new DelaisVulnerabilites(
    db,
    reglagePriorite,
    modules,
    alertesVulnerabilites,
    suivi,
    notificationsMetier,
  );
  suivi.delaiObjet = (k, nature, id) => delais.delaiObjet(k, nature, id);
  /* Assistant (V25, V28) : service de lecture du module, repères des machines et masque de sortie, avec la liste de mots à
     ne pas masquer (V31). */
  const motsNonMasques = new MotsNonMasquesVulnerabilites(db);
  /* Lot PC1 : vue d'ensemble ; lot ASSISTANT-V1 : ses cibles servent aussi à l'outil failles_prioritaires de l'assistant. */
  const vueEnsemble = new VueEnsembleVulnerabilites(db, alertesVulnerabilites, surfaceExterne);
  const assistantVulnerabilites = new AssistantVulnerabilites(
    db,
    failles,
    suivi,
    reglagePriorite,
    motsNonMasques,
    vueEnsemble,
    surfaceExterne,
  );
  assistant.vulnerabilites = assistantVulnerabilites;
  /* Lot S2 : instantanés quotidiens de la situation (tic de l'API), tendances et rapport de pilotage (textes passés au
     masque des machines en mode strict). */
  const tendances = new TendancesVulnerabilites(db, alertesVulnerabilites, modules);
  const rapport = new RapportVulnerabilites(
    db,
    cfg.orgName,
    tendances,
    alertesVulnerabilites,
    delais,
    veille,
    tenable,
    surfaceExterne,
    (user) => assistantVulnerabilites.masque(user, null),
  );
  const produitsSurveilles = new ProduitsSurveilles(db, grc, rapprochements, surfaceExterne);
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
    /** Contacts de crise issus des comptes (ADR 0107) : fiche de l'administrateur, mise à jour par la personne. */
    contactsCrise: new ContactsCriseComptes(db, grc),
    /** Veille réglementaire (ADR 0110) : publications de sources officielles (file traitée par l'exécutant), qualification
        par le rôle RSSI ou DPO. */
    veilleReglementaire: new VeilleReglementaire(db, flux, mandataire),
    /** Module Vulnérabilités (ADR 0100) : produits surveillés, veille sur les sources publiques (file traitée par l'exécutant),
        failles et machines lues dans Tenable (synchronisation par l'exécutant, lecture par périmètre). */
    vulnerabilites: {
      produits: produitsSurveilles,
      veille,
      tenable,
      /** Lot N1 : import de scans Nessus (connecteur « nessus-fichier »), lancé depuis la carte « Intégrations ». */
      importNessus,
      /** Lot SI1 : import du rapport Silène (connecteur « silene-fichier »), lancé depuis la carte « Intégrations », et
          lecture de ce qu'il a importé (note, constats, actifs, liaison au périmètre). */
      importSilene: new ImportSilene(db, integrations),
      silene: sileneSurface,
      /** Lot AD-1 : rapport de l'Active Directory (ADS de l'ANSSI) importé depuis la page « Active Directory » du module ;
          noms des objets lus point par point (route à part), consultation tracée. */
      annuaire: new AnnuaireAd(db),
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
      vueEnsemble,
      /** Lot PC4 : fiche illustrée d'une faille (vecteur traduit, schéma, recommandations par source), lecture seule. */
      fiches: new FichesFailles(db, failles, surfaceExterne, reglagePriorite),
      /** Lot S1 : délais de correction (réglés avec les seuils de priorité), exceptions à échéance, mesure des corrections. */
      delais,
      /** Lot PC3 : onglet « Périmètres » (cartes par périmètre lu, détail par ligne ou au global), lecture seule. */
      perimetres: new PerimetresVulnerabilites(db, failles, reglagePriorite),
      /** Lot S2 : instantanés quotidiens (tic de l'API) et tendances, lecture seule. */
      tendances,
      /** Lot S2 : rapport de pilotage (page imprimable, CSV), production tracée au journal. */
      rapport,
      /** Lot S3 : vue « Correctifs » (failles regroupées par texte de solution de Tenable), lecture seule. */
      correctifs: new CorrectifsVulnerabilites(db, reglagePriorite),
      /** Lot R1 : barre de recherche globale du module (CVE, machines, actifs exposés, applications), lecture seule. */
      recherche: new RechercheVulnerabilites(db, failles, surfaceExterne, produitsSurveilles),
      /** Lot PRIO-1 : purge du journal des collectes et des exécutions des connecteurs au-delà de 90 jours (tic de l'API). */
      purgeJournaux: new PurgeJournaux(db, veille),
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
      /** Lot N1 : imports de scans Nessus commencés (trente fichiers par heure et par personne depuis le lot N2 :
          NESSUS_BORNES.importsParHeure) et lots envoyés (six cents par dix minutes et par personne : un import de dix
          mille machines tient en cinquante lots au moins). Lot SI1 : les imports de rapports Silène comptent dans les mêmes
          limites (fichiers commencés, tous imports confondus). */
      importNessus: limiter(NESSUS_BORNES.importsParHeure, 60 * 60e3),
      importNessusLot: limiter(600, 10 * 60e3),
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
      /** Chiffres ouverts d'un tableau de bord (ADR 0109) : soixante calculs par minute et par compte. */
      tableauChiffres: limiter(60, 60e3),
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
