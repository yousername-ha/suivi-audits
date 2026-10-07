'use strict';
const fs = require('node:fs');
const path = require('node:path');

const E = process.env;
const SECRETS_DIR = E.SECRETS_DIR || '/run/secrets';

function secret(name, envName) {
  if (envName && E[envName]) return E[envName];
  try { return fs.readFileSync(path.join(SECRETS_DIR, name), 'utf8').trim(); } catch (e) { return ''; }
}
const bool = (v, d) => (v == null || v === '' ? d : /^(1|true|yes|oui)$/i.test(v));
const int = (v, d) => (v == null || v === '' ? d : parseInt(v, 10));

module.exports = {
  port: int(E.PORT, 8080),
  trustProxy: bool(E.TRUST_PROXY, false),
  publicUrl: (E.PUBLIC_URL || '').replace(/\/+$/, ''),
  cookieSecure: (E.COOKIE_SECURE || 'auto').toLowerCase(),   // auto | true | false
  db: {
    host: E.DB_HOST || 'db',
    port: int(E.DB_PORT, 5432),
    database: E.DB_NAME || 'suivi',
    user: E.DB_USER || 'suivi_app',
    password: secret('db_app_password', 'DB_PASSWORD'),
    ssl: bool(E.DB_SSL, false) ? { rejectUnauthorized: bool(E.DB_SSL_VERIFY, true) } : false,
    max: int(E.DB_POOL_MAX, 10),
  },
  masterKey: secret('doc_master_key', 'DOC_MASTER_KEY'),   // base64, 32 octets
  session: {
    idleMinutes: int(E.SESSION_IDLE_MINUTES, 30),
    maxHours: int(E.SESSION_MAX_HOURS, 10),
  },
  mfaRequired: bool(E.MFA_REQUIRED, true),
  passwordMinLength: int(E.PASSWORD_MIN_LENGTH, 12),
  lockout: { threshold: int(E.LOCKOUT_THRESHOLD, 5), minutes: int(E.LOCKOUT_MINUTES, 15) },
  maxStateMb: int(E.MAX_STATE_MB, 20),
  maxUploadMb: int(E.MAX_UPLOAD_MB, 50),
  stateHistoryKeep: int(E.STATE_HISTORY_KEEP, 1000),
  clamav: E.CLAMAV_HOST ? { host: E.CLAMAV_HOST, port: int(E.CLAMAV_PORT, 3310), required: bool(E.CLAMAV_REQUIRED, true) } : null,
  appName: E.APP_NAME || 'Suivi des audits SMSI',
  orgName: E.ORG_NAME || "GCS Normand'e-Santé",
};
