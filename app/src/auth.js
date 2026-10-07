'use strict';
/* Sessions, authentification (mot de passe + TOTP), jeton d'installation initiale. */
const cfg = require('./config');
const db = require('./db');
const sec = require('./security');
const log = require('./log');
const setupToken = require('./setup-token');
const { HttpError, parseCookies, isHttps, clientIp } = require('./http');

const COOKIE_SECURE = '__Host-suivi_sid';
const COOKIE_PLAIN = 'suivi_sid';

function cookieName(req) {
  const secure = cfg.cookieSecure === 'true' || (cfg.cookieSecure === 'auto' && isHttps(req));
  return { name: secure ? COOKIE_SECURE : COOKIE_PLAIN, secure };
}
function setSessionCookie(req, res, tok) {
  const { name, secure } = cookieName(req);
  res.setHeader('Set-Cookie', `${name}=${tok}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
}
function clearSessionCookie(req, res) {
  const { name, secure } = cookieName(req);
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}

async function createSession(req, res, user, mfaOk) {
  const tok = sec.token(32);
  const csrf = sec.token(24);
  const exp = new Date(Date.now() + cfg.session.maxHours * 3600e3);
  await db.q('INSERT INTO sessions(id_hash, user_id, csrf, mfa_ok, ip, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [sec.sha256(tok), user.id, csrf, !!mfaOk, clientIp(req) || null, String(req.headers['user-agent'] || '').slice(0, 300), exp]);
  setSessionCookie(req, res, tok);
  return csrf;
}

/** Charge la session de la requête. Renvoie { sid, user, csrf, mfaOk } ou null. */
async function loadSession(req) {
  const c = parseCookies(req);
  const tok = c[COOKIE_SECURE] || c[COOKIE_PLAIN];
  if (!tok || tok.length > 100) return null;
  const h = sec.sha256(tok);
  const r = await db.one(`
    SELECT s.id_hash, s.csrf, s.mfa_ok, s.last_seen_at, s.expires_at,
           u.id, u.username, u.display_name, u.role, u.disabled, u.totp_enabled, u.must_change_password
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id_hash = $1 AND s.expires_at > now()
      AND s.last_seen_at > now() - make_interval(mins => $2)`, [h, cfg.session.idleMinutes]);
  if (!r || r.disabled) return null;
  // Glissement de l'expiration d'inactivité (au plus une écriture par minute).
  if (Date.now() - new Date(r.last_seen_at).getTime() > 60e3) db.q('UPDATE sessions SET last_seen_at = now() WHERE id_hash = $1', [h]).catch(() => {});
  return {
    sid: h, csrf: r.csrf, mfaOk: r.mfa_ok,
    user: { id: r.id, username: r.username, displayName: r.display_name, role: r.role, totpEnabled: r.totp_enabled, mustChangePassword: r.must_change_password },
  };
}

/** État d'accès : 'ok' | 'mfa' (code TOTP à saisir) | 'enroll' (TOTP à configurer) | 'password' (changement imposé). */
function accessStage(s) {
  if (!s) return 'anon';
  if (s.user.totpEnabled && !s.mfaOk) return 'mfa';
  if (!s.user.totpEnabled && cfg.mfaRequired) return 'enroll';
  if (s.user.mustChangePassword) return 'password';
  return 'ok';
}

async function destroySession(sid) { await db.q('DELETE FROM sessions WHERE id_hash = $1', [sid]); }
async function destroyUserSessions(userId, exceptSid) {
  await db.q('DELETE FROM sessions WHERE user_id = $1 AND ($2::bytea IS NULL OR id_hash <> $2)', [userId, exceptSid || null]);
}
setInterval(() => { db.q('DELETE FROM sessions WHERE expires_at < now() OR last_seen_at < now() - make_interval(mins => $1)', [cfg.session.idleMinutes]).catch(() => {}); }, 10 * 60e3).unref();

/* ---------------- Mot de passe ---------------- */
async function checkLogin(username, password) {
  const u = await db.one('SELECT * FROM users WHERE lower(username) = lower($1)', [String(username || '').slice(0, 64)]);
  if (!u) { await sec.dummyVerify(password); return { ok: false, reason: 'unknown' }; }
  if (u.locked_until && new Date(u.locked_until) > new Date()) { await sec.dummyVerify(password); return { ok: false, reason: 'locked', user: u }; }
  const ok = await sec.verifyPassword(password, u.password_hash);
  if (!ok) {
    const n = u.failed_logins + 1;
    const lock = n >= cfg.lockout.threshold ? new Date(Date.now() + cfg.lockout.minutes * 60e3 * Math.min(8, 2 ** (n - cfg.lockout.threshold))) : null;
    await db.q('UPDATE users SET failed_logins = $2, locked_until = COALESCE($3, locked_until) WHERE id = $1', [u.id, n, lock]);
    return { ok: false, reason: lock ? 'locked_now' : 'bad_password', user: u };
  }
  if (u.disabled) return { ok: false, reason: 'disabled', user: u };
  await db.q('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [u.id]);
  return { ok: true, user: u };
}

/* ---------------- TOTP ---------------- */
async function checkTotp(userId, code) {
  const u = await db.one('SELECT id, totp_secret, totp_last_step FROM users WHERE id = $1', [userId]);
  if (!u || !u.totp_secret) return false;
  const key = sec.openSmall(u.totp_secret, 'totp:' + u.id);
  const step = sec.verifyTotp(key, code, Number(u.totp_last_step));
  if (!step) return false;
  const r = await db.q('UPDATE users SET totp_last_step = $2 WHERE id = $1 AND totp_last_step < $2', [u.id, step]);
  return r.rowCount === 1;
}

/* ---------------- Jeton d'installation ---------------- */
async function adminExists() { return !!(await db.one("SELECT 1 FROM users WHERE role = 'admin' AND NOT disabled LIMIT 1")); }

const fmtExpiry = (iso) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'short' }) + ' UTC';

/** Émet un nouveau jeton (le précédent est annulé), le journalise dans l'audit et l'affiche sur la sortie standard. */
async function issueSetupToken(reason) {
  const tok = setupToken.generate();
  const rec = await setupToken.makeRecord(tok, reason);
  await db.q(`INSERT INTO settings(key, value) VALUES ('setup_token', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [rec]);
  await db.audit(null, null, 'setup.token_issued', '', { reason, expires: rec.expires });
  const line = '='.repeat(72);
  process.stdout.write(`\n${line}\n  JETON D'INSTALLATION (usage unique, valable 24 h)\n\n    ${tok}\n\n` +
    `  Expire le : ${fmtExpiry(rec.expires)}\n` +
    `  Ouvrir ${cfg.publicUrl || 'https://<serveur>'}/setup et le saisir pour créer le compte administrateur.\n` +
    `  Nouveau jeton (annule le précédent) : docker compose exec app setup-token\n${line}\n\n`);
  return { token: tok, expires: rec.expires };
}
/** Vérifie et consomme le jeton dans la transaction « client ». Renvoie { status, reason }. */
async function consumeSetupToken(tok, client) {
  const r = await client.query("SELECT value FROM settings WHERE key = 'setup_token' FOR UPDATE");
  const rec = r.rows[0] && r.rows[0].value;
  const status = await setupToken.check(tok, rec);
  if (status === 'ok') {
    await client.query("UPDATE settings SET value = value || jsonb_build_object('usedAt', now()), updated_at = now() WHERE key = 'setup_token'");
  }
  return { status, reason: rec && rec.reason };
}
async function setupRecord() {
  const r = await db.one("SELECT value FROM settings WHERE key = 'setup_token'");
  return r && r.value;
}
async function setupPending() { return setupToken.pending(await setupRecord()); }

/** Middleware d'autorisation. need: 'any' (session complète) | 'rw' | 'admin'. */
function requireRole(s, need) {
  if (!s) throw new HttpError(401, 'Authentification requise.');
  const st = accessStage(s);
  if (st !== 'ok') throw new HttpError(403, 'Authentification incomplète.', { stage: st });
  if (need === 'rw' && !['rw', 'admin'].includes(s.user.role)) throw new HttpError(403, 'Droits insuffisants (lecture seule).');
  if (need === 'admin' && s.user.role !== 'admin') throw new HttpError(403, 'Réservé aux administrateurs.');
}

module.exports = { createSession, loadSession, accessStage, destroySession, destroyUserSessions, clearSessionCookie,
  checkLogin, checkTotp, adminExists, issueSetupToken, consumeSetupToken, setupPending, requireRole, log };
