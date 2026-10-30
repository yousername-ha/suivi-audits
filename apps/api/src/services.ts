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
import { investMapper } from './historique/tables/invest.js';
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

export function createServices(cfg: Config, log: Logger) {
  const db = new Db(cfg.db, log);
  const vault = new Vault(cfg.masterKey);
  const bus = new Bus(cfg.db, log);
  const legacy = new LegacyStore(cfg, db);
  // Modules repris dans des tables (ADR 0007) : /legacy les affiche, le serveur refuse leurs modifications.
  legacy.register(mapsMapper);
  legacy.register(investMapper);
  for (const spec of COLLECTIONS) legacy.register(collectionMapper(spec));
  for (const spec of GROUPES) legacy.register(groupeMapper(spec));
  for (const spec of CARTES) legacy.register(carteMapper(spec));
  for (const spec of COLLECTIONS_COEUR) legacy.register(collectionMapper(spec));
  legacy.register(ecartsNatifsMapper);
  legacy.registerBatch(reglagesMapper(CLES_REGLAGES));
  const settings = new Settings(cfg, db, legacy);
  const businessPolicies = new BusinessPolicies(db);
  const modules = new Modules(cfg.db, db);
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
    modules,
    updates: new Updates(cfg, db, settings, alertes),
    remiseAVide: new RemiseAVide(db),
    backups: new Backups(cfg, db, alertes),
    operations: new Operations(cfg, db, vault, alertes),
    walls: new Walls(cfg, db),
    journalTechnique: new JournalTechnique(db, log),
    typesProcessus: new TypesProcessus(db),
    calendriers: new CalendriersPlateforme(db),
    conservation: new Conservation(db),
    courriel: new Courriel(db, vault),
    notificationsMetier,
    auth,
    motsDePasse,
    webauthn,
    cleSecours: new CleSecours(db, cfg),
    adresseSite: new AdresseSiteService(db, cfg),
    alertesSecurite,
    bus,
    presence: new Presence(db, bus),
    legacy,
    limits: {
      global: limiter(cfg.rateLimitPerMinute, 60e3),
      courrielTest: limiter(5, 10 * 60e3),
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
    },
  };
}
export type Services = ReturnType<typeof createServices>;
