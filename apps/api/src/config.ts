/* Configuration : variables d'environnement (fichier .env) et secrets (volume « secrets », générés par le service init). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Env = Record<string, string | undefined>;

const bool = (v: string | undefined, d: boolean) => (v == null || v === '' ? d : /^(1|true|yes|oui)$/i.test(v));
const int = (v: string | undefined, d: number) => (v == null || v === '' ? d : parseInt(v, 10));

const here = path.dirname(fileURLToPath(import.meta.url));
/** Racine de l'application (contient seed/ et, dans l'image, legacy/). */
export const APP_ROOT = path.resolve(here, '..');

export function loadConfig(env: Env = process.env) {
  const secretsDir = env.SECRETS_DIR || '/run/secrets';
  const secret = (name: string, envName: string) => {
    if (env[envName]) return env[envName] as string;
    try {
      return readFileSync(path.join(secretsDir, name), 'utf8').trim();
    } catch {
      return '';
    }
  };
  return {
    port: int(env.PORT, 8080),
    host: env.HOST || '0.0.0.0',
    trustProxy: bool(env.TRUST_PROXY, false),
    publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
    cookieSecure: (env.COOKIE_SECURE || 'auto').toLowerCase() as 'auto' | 'true' | 'false',
    logLevel: env.LOG_LEVEL || 'info',
    db: {
      host: env.DB_HOST || 'db',
      port: int(env.DB_PORT, 5432),
      database: env.DB_NAME || 'suivi',
      user: env.DB_USER || 'suivi_app',
      password: secret('db_app_password', 'DB_PASSWORD'),
      ssl: bool(env.DB_SSL, false) ? { rejectUnauthorized: bool(env.DB_SSL_VERIFY, true) } : false,
      max: int(env.DB_POOL_MAX, 10),
    },
    masterKey: secret('doc_master_key', 'DOC_MASTER_KEY'),
    session: { idleMinutes: int(env.SESSION_IDLE_MINUTES, 30), maxHours: int(env.SESSION_MAX_HOURS, 10) },
    mfaRequired: bool(env.MFA_REQUIRED, true),
    passwordMinLength: int(env.PASSWORD_MIN_LENGTH, 12),
    lockout: { threshold: int(env.LOCKOUT_THRESHOLD, 5), minutes: int(env.LOCKOUT_MINUTES, 15) },
    maxStateMb: int(env.MAX_STATE_MB, 20),
    maxUploadMb: int(env.MAX_UPLOAD_MB, 50),
    maxImportMb: int(env.MAX_IMPORT_MB, 50),
    stateHistoryKeep: int(env.STATE_HISTORY_KEEP, 1000),
    clamav: env.CLAMAV_HOST
      ? { host: env.CLAMAV_HOST, port: int(env.CLAMAV_PORT, 3310), required: bool(env.CLAMAV_REQUIRED, true) }
      : null,
    appName: env.APP_NAME || 'Suivi des audits SMSI',
    orgName: env.ORG_NAME || "GCS Normand'e-Santé",
    /** Dossier de l'outil historique servi sous /legacy (app/public dans le dépôt). */
    legacyDir: env.LEGACY_DIR || path.join(APP_ROOT, 'legacy'),
    seedFile: env.SEED_FILE || path.join(APP_ROOT, 'seed', 'state.json'),
    version: env.APP_VERSION || readVersion(),
  };
}
export type Config = ReturnType<typeof loadConfig>;

function readVersion(): string {
  try {
    return (JSON.parse(readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}
