/* Configuration : variables d'environnement (fichier .env) et secrets (volume « secrets », générés par le service init). */
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Env = Record<string, string | undefined>;

const bool = (v: string | undefined, d: boolean) => (v == null || v === '' ? d : /^(1|true|yes|oui)$/i.test(v));
const int = (v: string | undefined, d: number) => (v == null || v === '' ? d : parseInt(v, 10));

/** TRUST_PROXY : booléen (true = tous les relais, false = aucun), nombre de relais de confiance (1 à 10), ou liste d'adresses et
    de CIDR séparés par des virgules. Une valeur mal formée arrête le démarrage au lieu d'être interprétée au hasard. */
export function trustProxy(v: string | undefined): boolean | number | string[] {
  const t = (v ?? '').trim();
  if (/^(|false|no|non|0)$/i.test(t)) return false;
  if (/^(true|yes|oui)$/i.test(t)) return true;
  if (/^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 10) return Number(t);
  const liste = t.split(',').map((x) => x.trim());
  const valide = (x: string) => {
    const [adresse = '', masque, ...reste] = x.split('/');
    const version = isIP(adresse);
    if (!version || reste.length) return false;
    if (masque === undefined) return true;
    return /^\d{1,3}$/.test(masque) && Number(masque) <= (version === 4 ? 32 : 128);
  };
  if (!liste.every(valide)) {
    throw new Error(
      "TRUST_PROXY invalide : attendu true, false, un nombre de relais (1 à 10) ou une liste d'adresses ou de CIDR.",
    );
  }
  return liste;
}

/** Partie dépendante de la relying party WebAuthn (ADR 0079). `disponible` faux : les clés de sécurité ne sont pas proposées. */
export interface ConfigWebauthn {
  disponible: boolean;
  raison: string | null;
  rpId: string | null;
  rpName: string;
  origines: string[];
  /** env : RP_ID ou RP_ORIGINS renseignés ; adresse_site : déduite de PUBLIC_URL (SITE_ADDRESS) ; aucune. */
  source: 'env' | 'adresse_site' | 'aucune';
}

const NOM_DOMAINE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** RP_ID, RP_NAME, RP_ORIGINS. Sans RP_ID ni RP_ORIGINS, la configuration est déduite de PUBLIC_URL ; si elle n'est pas
    utilisable (adresse IP, HTTP), les clés sont simplement désactivées. Une configuration explicite incohérente arrête le
    démarrage (fail closed) : nom de domaine invalide, origine non HTTPS (HTTP seulement pour localhost hors production),
    origine hors du domaine de la relying party, chemin dans une origine. */
export function configWebauthn(env: Env, publicUrl: string, appName: string): ConfigWebauthn {
  const production = env.NODE_ENV === 'production';
  const explicite = !!(env.RP_ID?.trim() || env.RP_ORIGINS?.trim());
  const rpName = (env.RP_NAME || '').trim().slice(0, 64) || appName;
  let rpId = (env.RP_ID || '').trim();
  if (!rpId && publicUrl) {
    try {
      rpId = new URL(publicUrl).hostname;
    } catch {
      rpId = '';
    }
  }
  const origines = (env.RP_ORIGINS?.trim() ? env.RP_ORIGINS.split(',') : publicUrl ? [publicUrl] : [])
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const source: ConfigWebauthn['source'] = explicite ? 'env' : publicUrl ? 'adresse_site' : 'aucune';
  const probleme = ((): string | null => {
    if (!rpId) return 'aucune adresse de site ni RP_ID';
    if (rpId !== rpId.toLowerCase() || !NOM_DOMAINE.test(rpId) || isIP(rpId))
      return `RP_ID « ${rpId} » n'est pas un nom de domaine (une adresse IP ne convient pas)`;
    if (origines.length === 0) return 'aucune origine (RP_ORIGINS)';
    for (const o of origines) {
      let u: URL;
      try {
        u = new URL(o);
      } catch {
        return `origine « ${o} » illisible`;
      }
      if (u.origin !== o) return `origine « ${o} » : schéma, hôte et port seulement, sans chemin`;
      const local = u.hostname === 'localhost';
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local && !production))
        return `origine « ${o} » : HTTPS obligatoire${local ? ' en production' : ''}`;
      if (u.hostname !== rpId && !u.hostname.endsWith('.' + rpId))
        return `origine « ${o} » hors du domaine de la relying party « ${rpId} »`;
    }
    return null;
  })();
  if (probleme && explicite) throw new Error(`Configuration WebAuthn invalide : ${probleme}.`);
  return {
    disponible: !probleme,
    raison: probleme,
    rpId: probleme ? null : rpId,
    rpName,
    origines: probleme ? [] : origines,
    source,
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
/** Racine de l'application (contient seed/ et migrations/). */
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
  const publicUrl = (env.PUBLIC_URL || '').replace(/\/+$/, '');
  const appName = env.APP_NAME || 'Suivi des audits SMSI';
  return {
    port: int(env.PORT, 8080),
    host: env.HOST || '0.0.0.0',
    trustProxy: trustProxy(env.TRUST_PROXY),
    publicUrl,
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
    /** Requêtes par minute et par adresse IP, toutes routes confondues (protection contre l'épuisement). */
    rateLimitPerMinute: int(env.RATE_LIMIT_PER_MINUTE, 1200),
    maxStateMb: int(env.MAX_STATE_MB, 20),
    maxUploadMb: int(env.MAX_UPLOAD_MB, 50),
    maxImportMb: int(env.MAX_IMPORT_MB, 50),
    stateHistoryKeep: int(env.STATE_HISTORY_KEEP, 1000),
    clamav: env.CLAMAV_HOST
      ? { host: env.CLAMAV_HOST, port: int(env.CLAMAV_PORT, 3310), required: bool(env.CLAMAV_REQUIRED, true) }
      : null,
    appName,
    /** Clés de sécurité FIDO2 / WebAuthn (ADR 0079). */
    webauthn: configWebauthn(env, publicUrl, appName),
    orgName: env.ORG_NAME || 'Mon organisation',
    seedFile: env.SEED_FILE || path.join(APP_ROOT, 'seed', 'state.json'),
    /** Rapports d'exploitation (DATA_DIR/etat sur le serveur, monté en lecture seule) : mises à jour, sauvegardes. */
    etatDir: env.ETAT_DIR || '/etat',
    /** Emplacement des données sur le serveur (DATA_DIR), affiché dans Administration > Système. */
    dataDirHote: env.DATA_DIR_HOTE || '',
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
