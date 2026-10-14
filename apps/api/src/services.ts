/* Services partagés par les routes (injectés : chaque test construit les siens avec sa propre base). */
import type { Logger } from 'pino';
import { Auth } from './auth.js';
import { Backups } from './backups.js';
import { Updates } from './updates.js';
import { Modules } from './modules.js';
import { Operations } from './operations.js';
import type { Config } from './config.js';
import { Db } from './db/db.js';
import { limiter } from './http/security.js';
import { mapsMapper } from './carto/maps.js';
import { LegacyStore } from './legacy/store.js';
import { Bus, Presence } from './realtime.js';
import { Vault } from './security/crypto.js';
import { Settings } from './settings.js';
import { ConfigGrc } from './config-grc.js';
import { Environment } from './environment.js';
import { RiskAssessments } from './risk-assessments.js';
import { BusinessPolicies } from './business-policy.js';
import { Grc } from './grc/core.js';
import { Walls } from './walls.js';

export function createServices(cfg: Config, log: Logger) {
  const db = new Db(cfg.db, log);
  const vault = new Vault(cfg.masterKey);
  const bus = new Bus(cfg.db, log);
  const legacy = new LegacyStore(cfg, db);
  // Modules repris dans des tables (ADR 0007) : /legacy les affiche, le serveur refuse leurs modifications.
  legacy.register(mapsMapper);
  const settings = new Settings(cfg, db, legacy);
  const environment = new Environment(db);
  const businessPolicies = new BusinessPolicies(db);
  const modules = new Modules(cfg.db, db);
  const grc = new Grc(db, legacy, businessPolicies, modules);
  const configGrc = new ConfigGrc(db, grc);
  grc.methodBindings = configGrc;
  return {
    cfg,
    log,
    db,
    vault,
    settings,
    environment,
    businessPolicies,
    grc,
    configGrc,
    riskAssessments: new RiskAssessments(db, legacy, environment),
    modules,
    updates: new Updates(cfg, db),
    backups: new Backups(cfg, db),
    operations: new Operations(cfg, db, vault),
    walls: new Walls(cfg, db),
    auth: new Auth(cfg, db, vault, () => settings.get('securite')),
    bus,
    presence: new Presence(db, bus),
    legacy,
    limits: {
      global: limiter(cfg.rateLimitPerMinute, 60e3),
      loginByIp: limiter(20, 15 * 60e3),
      loginByUser: limiter(10, 15 * 60e3),
      mfaBySession: limiter(8, 10 * 60e3),
      setupByIp: limiter(10, 15 * 60e3),
      presence: limiter(30, 60e3),
      wallActivation: limiter(10, 15 * 60e3),
    },
  };
}
export type Services = ReturnType<typeof createServices>;
