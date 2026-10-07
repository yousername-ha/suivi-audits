/* Services partagés par les routes (injectés : chaque test construit les siens avec sa propre base). */
import type { Logger } from 'pino';
import { Auth } from './auth.js';
import type { Config } from './config.js';
import { Db } from './db/db.js';
import { limiter } from './http/security.js';
import { LegacyStore } from './legacy/store.js';
import { Bus, Presence } from './realtime.js';
import { Vault } from './security/crypto.js';

export function createServices(cfg: Config, log: Logger) {
  const db = new Db(cfg.db, log);
  const vault = new Vault(cfg.masterKey);
  const bus = new Bus(cfg.db, log);
  return {
    cfg,
    log,
    db,
    vault,
    auth: new Auth(cfg, db, vault),
    bus,
    presence: new Presence(db, bus),
    legacy: new LegacyStore(cfg, db),
    limits: {
      loginByIp: limiter(20, 15 * 60e3),
      loginByUser: limiter(10, 15 * 60e3),
      mfaBySession: limiter(8, 10 * 60e3),
      setupByIp: limiter(10, 15 * 60e3),
      presence: limiter(30, 60e3),
    },
  };
}
export type Services = ReturnType<typeof createServices>;
