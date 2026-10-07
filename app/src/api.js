'use strict';
/* Routes de l'API. Chaque route : [méthode, motif, gestionnaire, options]. */
const cfg = require('./config');
const db = require('./db');
const sec = require('./security');
const files = require('./files');
const auth = require('./auth');
const log = require('./log');
const { HttpError, json, readJson, readBody, limiter, CSP_FILE } = require('./http');

const VERSION = require('../package.json').version;
const loginByIp = limiter(20, 15 * 60e3);
const loginByUser = limiter(10, 15 * 60e3);
const mfaBySession = limiter(8, 10 * 60e3);
const setupByIp = limiter(10, 15 * 60e3);

const str = (v, max = 500) => (v == null ? '' : String(v)).trim().slice(0, max);
const strArr = (v, maxItems = 50, max = 80) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map((x) => str(x, max)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, maxItems);
const UUID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const USERNAME_RE = /^[a-zA-Z0-9._@-]{2,64}$/;
const ROLES = ['admin', 'rw', 'ro'];
const CLASSIF = ['public', 'interne', 'restreint', 'confidentiel'];

function meOut(s) {
  return { stage: auth.accessStage(s), csrf: s ? s.csrf : null, user: s ? s.user : null, mfaRequired: cfg.mfaRequired,
    passwordMinLength: cfg.passwordMinLength, appName: cfg.appName, orgName: cfg.orgName, version: VERSION };
}
const tempPassword = () => sec.tempPassword();
function checkPassword(pw, username) {
  const p = sec.passwordProblems(pw, cfg.passwordMinLength, [username]);
  if (p.length) throw new HttpError(422, 'Mot de passe trop faible : ' + p.join(', ') + '.');
}

/* ================================================================ Authentification */
async function login(c) {
  const b = await readJson(c.req);
  const username = str(b.username, 64);
  if (!loginByIp(c.ip) || !loginByUser(username.toLowerCase())) {
    await db.audit({ username }, c.ip, 'auth.rate_limited');
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  }
  const r = await auth.checkLogin(username, String(b.password || ''));
  if (!r.ok) {
    await db.audit(r.user ? { id: r.user.id, username: r.user.username } : { username }, c.ip, 'auth.login_failed', '', { reason: r.reason });
    if (r.reason === 'locked' || r.reason === 'locked_now') throw new HttpError(423, 'Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard ou contactez un administrateur.');
    throw new HttpError(401, 'Identifiant ou mot de passe incorrect.');
  }
  if (c.s) await auth.destroySession(c.s.sid);
  await auth.createSession(c.req, c.res, r.user, false);
  await db.audit({ id: r.user.id, username: r.user.username }, c.ip, 'auth.password_ok');
  const s = { user: { totpEnabled: r.user.totp_enabled, mustChangePassword: r.user.must_change_password }, mfaOk: false };
  json(c.res, 200, { stage: auth.accessStage(s) });
}
async function mfa(c) {
  if (!c.s) throw new HttpError(401, 'Session expirée.');
  if (!mfaBySession(c.s.sid.toString('hex'))) throw new HttpError(429, 'Trop de tentatives. Reconnectez-vous.');
  const b = await readJson(c.req);
  if (!(await auth.checkTotp(c.s.user.id, str(b.code, 6)))) {
    await db.audit(c.s.user, c.ip, 'auth.mfa_failed');
    throw new HttpError(401, 'Code incorrect ou déjà utilisé.');
  }
  // Rotation de la session après élévation (prévention de la fixation de session).
  await auth.destroySession(c.s.sid);
  await auth.createSession(c.req, c.res, { id: c.s.user.id }, true);
  await db.audit(c.s.user, c.ip, 'auth.login');
  json(c.res, 200, { stage: auth.accessStage({ ...c.s, mfaOk: true }) });
}
async function logout(c) {
  if (c.s) { await auth.destroySession(c.s.sid); await db.audit(c.s.user, c.ip, 'auth.logout'); }
  auth.clearSessionCookie(c.req, c.res);
  json(c.res, 204);
}

/* ================================================================ Installation */
async function setupStatus(c) { json(c.res, 200, { needed: await auth.setupPending(), adminExists: await auth.adminExists() }); }
async function setup(c) {
  if (!setupByIp(c.ip)) throw new HttpError(429, 'Trop de tentatives.');
  const b = await readJson(c.req);
  const username = str(b.username, 64);
  if (!USERNAME_RE.test(username)) throw new HttpError(422, 'Identifiant invalide (2 à 64 caractères : lettres, chiffres, . _ - @).');
  checkPassword(b.password, username);
  const hash = await sec.hashPassword(b.password);
  const user = await db.tx(async (t) => {
    const r = await t.query("SELECT value FROM settings WHERE key = 'setup_token' FOR UPDATE");
    const recovery = r.rows[0] && r.rows[0].value.reason === 'recovery';
    if (!(await auth.consumeSetupToken(b.token, t))) return null;
    if (!recovery && (await t.query("SELECT 1 FROM users WHERE role='admin'")).rowCount) throw new HttpError(409, 'Un administrateur existe déjà.');
    const u = await t.query('INSERT INTO users(username, display_name, email, role, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [username, str(b.displayName, 120) || username, str(b.email, 200), 'admin', hash]);
    return u.rows[0];
  }).catch((e) => { if (e.code === '23505') throw new HttpError(409, 'Cet identifiant existe déjà.'); throw e; });
  if (!user) { await db.audit({ username }, c.ip, 'setup.failed'); throw new HttpError(401, "Jeton d'installation invalide ou expiré."); }
  await db.audit({ id: user.id, username }, c.ip, 'setup.admin_created');
  await auth.createSession(c.req, c.res, user, false);
  json(c.res, 201, { stage: auth.accessStage({ user: { totpEnabled: false }, mfaOk: false }) });
}

/* ================================================================ Compte */
async function changePassword(c) {
  const st = auth.accessStage(c.s);
  if (!['ok', 'password'].includes(st)) throw new HttpError(403, 'Authentification incomplète.');
  const b = await readJson(c.req);
  const u = await db.one('SELECT username, password_hash FROM users WHERE id=$1', [c.s.user.id]);
  if (!(await sec.verifyPassword(String(b.current || ''), u.password_hash))) { await db.audit(c.s.user, c.ip, 'account.password_failed'); throw new HttpError(401, 'Mot de passe actuel incorrect.'); }
  checkPassword(b.next, u.username);
  if (await sec.verifyPassword(b.next, u.password_hash)) throw new HttpError(422, "Le nouveau mot de passe doit être différent de l'actuel.");
  await db.q('UPDATE users SET password_hash=$2, must_change_password=false, password_changed_at=now(), updated_at=now() WHERE id=$1', [c.s.user.id, await sec.hashPassword(b.next)]);
  await auth.destroyUserSessions(c.s.user.id, c.s.sid);
  await db.audit(c.s.user, c.ip, 'account.password_changed');
  json(c.res, 200, { stage: auth.accessStage({ ...c.s, user: { ...c.s.user, mustChangePassword: false } }) });
}
async function totpBegin(c) {
  const st = auth.accessStage(c.s);
  if (!['ok', 'enroll'].includes(st)) throw new HttpError(403, 'Authentification incomplète.');
  if (st === 'ok' && c.s.user.totpEnabled) {
    const b = await readJson(c.req);
    const u = await db.one('SELECT password_hash FROM users WHERE id=$1', [c.s.user.id]);
    if (!(await sec.verifyPassword(String(b.password || ''), u.password_hash))) throw new HttpError(401, 'Mot de passe incorrect.');
  }
  const key = require('node:crypto').randomBytes(20);
  await db.q('UPDATE users SET totp_pending=$2 WHERE id=$1', [c.s.user.id, sec.sealSmall(key, 'totp:' + c.s.user.id)]);
  const secret = sec.base32(key);
  const label = encodeURIComponent(`${cfg.appName}:${c.s.user.username}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(cfg.orgName)}&algorithm=SHA1&digits=6&period=30`;
  json(c.res, 200, { secret, uri });
}
async function totpConfirm(c) {
  const st = auth.accessStage(c.s);
  if (!['ok', 'enroll'].includes(st)) throw new HttpError(403, 'Authentification incomplète.');
  const b = await readJson(c.req);
  const u = await db.one('SELECT totp_pending FROM users WHERE id=$1', [c.s.user.id]);
  if (!u || !u.totp_pending) throw new HttpError(409, "Aucun enrôlement en cours.");
  const key = sec.openSmall(u.totp_pending, 'totp:' + c.s.user.id);
  const step = sec.verifyTotp(key, str(b.code, 6), 0);
  if (!step) throw new HttpError(401, "Code incorrect. Vérifiez l'heure du téléphone et réessayez.");
  await db.q('UPDATE users SET totp_secret=totp_pending, totp_pending=NULL, totp_enabled=true, totp_last_step=$2, updated_at=now() WHERE id=$1', [c.s.user.id, step]);
  await auth.destroyUserSessions(c.s.user.id, c.s.sid);
  await auth.destroySession(c.s.sid);
  await auth.createSession(c.req, c.res, { id: c.s.user.id }, true);
  await db.audit(c.s.user, c.ip, 'account.mfa_enrolled');
  json(c.res, 200, { stage: auth.accessStage({ ...c.s, mfaOk: true, user: { ...c.s.user, totpEnabled: true } }) });
}
async function totpDisable(c) {
  auth.requireRole(c.s, 'any');
  if (cfg.mfaRequired) throw new HttpError(403, "La double authentification est obligatoire sur ce serveur.");
  const b = await readJson(c.req);
  const u = await db.one('SELECT password_hash FROM users WHERE id=$1', [c.s.user.id]);
  if (!(await sec.verifyPassword(String(b.password || ''), u.password_hash))) throw new HttpError(401, 'Mot de passe incorrect.');
  await db.q('UPDATE users SET totp_secret=NULL, totp_pending=NULL, totp_enabled=false WHERE id=$1', [c.s.user.id]);
  await db.audit(c.s.user, c.ip, 'account.mfa_disabled');
  json(c.res, 204);
}
async function mySessions(c) {
  auth.requireRole(c.s, 'any');
  const r = await db.q('SELECT encode(id_hash,\'hex\') AS id, ip::text, user_agent, created_at, last_seen_at FROM sessions WHERE user_id=$1 ORDER BY last_seen_at DESC', [c.s.user.id]);
  json(c.res, 200, r.rows.map((x) => ({ ...x, current: x.id === c.s.sid.toString('hex') })));
}
async function revokeOtherSessions(c) {
  auth.requireRole(c.s, 'any');
  await auth.destroyUserSessions(c.s.user.id, c.s.sid);
  await db.audit(c.s.user, c.ip, 'account.sessions_revoked');
  json(c.res, 204);
}

/* ================================================================ Données de suivi */
const validState = (o) => o && typeof o === 'object' && !Array.isArray(o) && o.v === 1 && Array.isArray(o.items) && Array.isArray(o.findings) && Array.isArray(o.years);

async function getState(c) {
  auth.requireRole(c.s, 'any');
  const r = await db.one('SELECT version, data::text AS data FROM app_state WHERE id=1');
  if (!r) throw new HttpError(404, 'Aucune donnée.');
  const body = Buffer.from(r.data);
  c.res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store', ETag: `"v${r.version}"` });
  c.res.end(c.req.method === 'HEAD' ? undefined : body);
}
async function putState(c) {
  auth.requireRole(c.s, 'rw');
  const buf = await readBody(c.req, cfg.maxStateMb * 1024 * 1024);
  let obj; try { obj = JSON.parse(buf.toString('utf8')); } catch (e) { throw new HttpError(400, 'JSON invalide.'); }
  if (!validState(obj)) throw new HttpError(422, 'Structure de données inattendue.');
  const m = /^"v(\d+)"$/.exec(String(c.req.headers['if-match'] || ''));
  const expected = m ? parseInt(m[1], 10) : null;
  const sha = sec.sha256hex(buf);
  const r = await saveState(obj, sha, c.s.user, expected, '');
  if (r.conflict) return json(c.res, 412, { error: 'conflict', by: r.by, at: r.at, version: r.version });
  await db.audit(c.s.user, c.ip, 'state.write', `v${r.version}`, { bytes: buf.length, sha256: sha, forced: expected == null, items: obj.items.length, findings: obj.findings.length });
  json(c.res, 204, undefined, { ETag: `"v${r.version}"` });
}
/** Enregistre une nouvelle version. Historique : un instantané par utilisateur et par tranche de 10 minutes. */
async function saveState(obj, sha, user, expected, note) {
  return db.tx(async (t) => {
    const cur = (await t.query('SELECT version, updated_by, updated_at FROM app_state WHERE id=1 FOR UPDATE')).rows[0];
    if (cur && expected != null && expected !== cur.version) return { conflict: true, by: cur.updated_by, at: cur.updated_at, version: cur.version };
    const version = cur ? cur.version + 1 : 1;
    const by = user ? user.username : 'système';
    if (cur) await t.query('UPDATE app_state SET version=$1, data=$2, sha256=$3, updated_at=now(), updated_by=$4 WHERE id=1', [version, obj, sha, by]);
    else await t.query('INSERT INTO app_state(id, version, data, sha256, updated_by) VALUES (1,$1,$2,$3,$4)', [version, obj, sha, by]);
    const last = (await t.query('SELECT version, updated_by, updated_at, note FROM state_history ORDER BY version DESC LIMIT 1')).rows[0];
    if (!note && last && !last.note && last.updated_by === by && Date.now() - new Date(last.updated_at).getTime() < 10 * 60e3 && last.version === version - 1) {
      await t.query('DELETE FROM state_history WHERE version=$1', [last.version]);
    }
    await t.query('INSERT INTO state_history(version, data, sha256, updated_at, updated_by, note) VALUES ($1,$2,$3,now(),$4,$5)', [version, obj, sha, by, note || '']);
    await t.query('DELETE FROM state_history WHERE version IN (SELECT version FROM state_history ORDER BY version DESC OFFSET $1)', [cfg.stateHistoryKeep]);
    return { version };
  });
}

/* ================================================================ Référentiels pour les rattachements */
async function refs(c) {
  auth.requireRole(c.s, 'any');
  const r = await db.one('SELECT data FROM app_state WHERE id=1');
  const d = (r && r.data) || {};
  const code = (it) => (it.ref === 'A' ? 'A.' + it.num : it.ref === 'HDS' ? 'HDS ' + it.num : it.num);
  const out = [];
  for (const it of d.items || []) out.push({ ref: code(it), label: it.title || '', kind: 'Mesure ' + (it.ref === 'A' ? 'Annexe A' : it.ref === 'HDS' ? 'HDS' : 'ISO 27001') });
  for (const f of d.findings || []) out.push({ ref: f.id, label: f.text || '', kind: `Écart ${f.source || ''} ${f.year || ''}`.trim() });
  for (const p of d.processes || []) out.push({ ref: p.id, label: p.name || '', kind: 'Processus' });
  for (const s of d.suppliers || []) out.push({ ref: s.id, label: s.name || '', kind: 'Fournisseur' });
  for (const o of d.objectives || []) if (o && o.id) out.push({ ref: o.id, label: o.name || o.title || '', kind: 'Objectif' });
  json(c.res, 200, out);
}

/* ================================================================ Documents */
function docMeta(b) {
  const m = {};
  if ('title' in b) m.title = str(b.title, 200);
  if ('description' in b) m.description = str(b.description, 4000);
  if ('category' in b) m.category = str(b.category, 80);
  if ('refs' in b) m.refs = strArr(b.refs, 100, 60);
  if ('tags' in b) m.tags = strArr(b.tags, 30, 40);
  if ('classification' in b) { if (!CLASSIF.includes(b.classification)) throw new HttpError(422, 'Classification invalide.'); m.classification = b.classification; }
  return m;
}
const DOC_SELECT = `SELECT d.id, d.title, d.description, d.category, d.refs, d.tags, d.classification, d.current_version,
  d.created_by, d.created_at, d.updated_by, d.updated_at, d.deleted_at, d.deleted_by,
  v.filename, v.mime, v.size, v.sha256, v.scan_status, v.uploaded_by, v.uploaded_at
  FROM documents d LEFT JOIN document_versions v ON v.document_id = d.id AND v.version = d.current_version`;

async function listDocs(c) {
  auth.requireRole(c.s, 'any');
  const p = c.url.searchParams; const where = []; const args = [];
  where.push(p.get('trash') === '1' ? 'd.deleted_at IS NOT NULL' : 'd.deleted_at IS NULL');
  if (p.get('ref')) { args.push(p.get('ref')); where.push(`$${args.length} = ANY(d.refs)`); }
  if (p.get('category')) { args.push(p.get('category')); where.push(`d.category = $${args.length}`); }
  if (p.get('q')) {
    args.push('%' + p.get('q').replace(/[\\%_]/g, '\\$&') + '%');
    where.push(`(d.title ILIKE $${args.length} OR d.description ILIKE $${args.length} OR v.filename ILIKE $${args.length} OR array_to_string(d.refs,' ') ILIKE $${args.length} OR array_to_string(d.tags,' ') ILIKE $${args.length})`);
  }
  const r = await db.q(`${DOC_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.updated_at DESC LIMIT 1000`, args);
  json(c.res, 200, r.rows);
}
async function getDoc(c) {
  auth.requireRole(c.s, 'any');
  const d = await db.one(`${DOC_SELECT} WHERE d.id = $1`, [c.params[0]]);
  if (!d) throw new HttpError(404, 'Document introuvable.');
  const v = await db.q('SELECT version, filename, mime, size, sha256, scan_status, uploaded_by, uploaded_at, comment FROM document_versions WHERE document_id=$1 ORDER BY version DESC', [d.id]);
  json(c.res, 200, { ...d, versions: v.rows });
}
async function receiveFile(c) {
  const raw = c.req.headers['x-file-name'];
  if (!raw) throw new HttpError(400, 'Nom de fichier manquant.');
  let name; try { name = decodeURIComponent(String(raw)); } catch (e) { throw new HttpError(400, 'Nom de fichier invalide.'); }
  const buf = await readBody(c.req, cfg.maxUploadMb * 1024 * 1024);
  let info; try { info = files.validate(name, buf); } catch (e) { throw new HttpError(422, e.message); }
  let scan; try { scan = await files.scan(buf); } catch (e) {
    await db.audit(c.s.user, c.ip, e.infected ? 'document.malware_blocked' : 'document.scan_unavailable', info.filename, { message: e.message });
    throw new HttpError(422, e.message);
  }
  return { ...info, buf, scan, sha: sec.sha256hex(buf) };
}
async function insertVersion(t, docId, version, f, user, comment) {
  const e = sec.encrypt(f.buf, `doc:${docId}:${version}`);
  await t.query(`INSERT INTO document_versions(document_id, version, filename, mime, size, sha256, key_id, iv, auth_tag, content, scan_status, uploaded_by, comment)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [docId, version, f.filename, f.mime, f.buf.length, f.sha, e.keyId, e.iv, e.tag, e.content, f.scan, user.username, comment || '']);
}
async function createDoc(c) {
  auth.requireRole(c.s, 'rw');
  let meta = {};
  try { meta = docMeta(JSON.parse(decodeURIComponent(String(c.req.headers['x-meta'] || '%7B%7D')))); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Métadonnées invalides.'); }
  const f = await receiveFile(c);
  const by = c.s.user.username;
  const doc = await db.tx(async (t) => {
    const d = (await t.query(`INSERT INTO documents(title, description, category, refs, tags, classification, current_version, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,1,$7,$7) RETURNING id`, [meta.title || f.filename.replace(/\.[^.]+$/, ''), meta.description || '', meta.category || '', meta.refs || [], meta.tags || [], meta.classification || 'interne', by])).rows[0];
    await insertVersion(t, d.id, 1, f, c.s.user, '');
    return d;
  });
  await db.audit(c.s.user, c.ip, 'document.create', doc.id, { filename: f.filename, size: f.buf.length, sha256: f.sha, scan: f.scan });
  json(c.res, 201, await db.one(`${DOC_SELECT} WHERE d.id=$1`, [doc.id]));
}
async function addVersion(c) {
  auth.requireRole(c.s, 'rw');
  const id = c.params[0];
  const f = await receiveFile(c);
  let comment = ''; try { comment = str(decodeURIComponent(String(c.req.headers['x-comment'] || '')), 500); } catch (e) {}
  const v = await db.tx(async (t) => {
    const d = (await t.query('SELECT current_version, deleted_at FROM documents WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!d || d.deleted_at) throw new HttpError(404, 'Document introuvable.');
    const nv = d.current_version + 1;
    await insertVersion(t, id, nv, f, c.s.user, comment);
    await t.query('UPDATE documents SET current_version=$2, updated_by=$3, updated_at=now() WHERE id=$1', [id, nv, c.s.user.username]);
    return nv;
  });
  await db.audit(c.s.user, c.ip, 'document.version', id, { version: v, filename: f.filename, sha256: f.sha, scan: f.scan });
  json(c.res, 201, { version: v });
}
async function patchDoc(c) {
  auth.requireRole(c.s, 'rw');
  const m = docMeta(await readJson(c.req));
  const keys = Object.keys(m); if (!keys.length) return json(c.res, 204);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const r = await db.q(`UPDATE documents SET ${sets}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, [c.params[0], ...keys.map((k) => m[k]), c.s.user.username]);
  if (!r.rowCount) throw new HttpError(404, 'Document introuvable.');
  await db.audit(c.s.user, c.ip, 'document.update', c.params[0], { fields: keys });
  json(c.res, 204);
}
async function deleteDoc(c) {
  const purge = c.url.searchParams.get('purge') === '1';
  auth.requireRole(c.s, purge ? 'admin' : 'rw');
  const r = purge ? await db.q('DELETE FROM documents WHERE id=$1 AND deleted_at IS NOT NULL', [c.params[0]])
    : await db.q('UPDATE documents SET deleted_at=now(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL', [c.params[0], c.s.user.username]);
  if (!r.rowCount) throw new HttpError(404, purge ? 'Seul un document déjà dans la corbeille peut être supprimé définitivement.' : 'Document introuvable.');
  await db.audit(c.s.user, c.ip, purge ? 'document.purge' : 'document.delete', c.params[0]);
  json(c.res, 204);
}
async function restoreDoc(c) {
  auth.requireRole(c.s, 'rw');
  const r = await db.q('UPDATE documents SET deleted_at=NULL, deleted_by=NULL, updated_by=$2, updated_at=now() WHERE id=$1 AND deleted_at IS NOT NULL', [c.params[0], c.s.user.username]);
  if (!r.rowCount) throw new HttpError(404, 'Document introuvable.');
  await db.audit(c.s.user, c.ip, 'document.restore', c.params[0]);
  json(c.res, 204);
}
async function downloadDoc(c) {
  auth.requireRole(c.s, 'any');
  const id = c.params[0];
  const vq = c.url.searchParams.get('v');
  const row = await db.one(`SELECT v.*, d.deleted_at FROM documents d JOIN document_versions v ON v.document_id=d.id
    AND v.version = COALESCE($2::int, d.current_version) WHERE d.id=$1`, [id, vq && /^\d+$/.test(vq) ? parseInt(vq, 10) : null]);
  if (!row || (row.deleted_at && c.s.user.role === 'ro')) throw new HttpError(404, 'Document introuvable.');
  let plain;
  try { plain = sec.decrypt({ iv: row.iv, tag: row.auth_tag, content: row.content, keyId: row.key_id }, `doc:${id}:${row.version}`); }
  catch (e) { log.error('document decrypt failed', { id, version: row.version, err: e.message }); throw new HttpError(500, 'Le document ne peut pas être déchiffré (clé maître différente ?).'); }
  if (sec.sha256hex(plain) !== row.sha256) throw new HttpError(500, "Échec du contrôle d'intégrité du document.");
  await db.audit(c.s.user, c.ip, 'document.download', id, { version: row.version });
  const inline = c.url.searchParams.get('inline') === '1' && /^(application\/pdf|image\/(png|jpeg|gif)|text\/plain)$/.test(row.mime);
  const ascii = row.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  c.res.setHeader('Content-Security-Policy', CSP_FILE);
  c.res.writeHead(200, {
    'Content-Type': row.mime, 'Content-Length': plain.length, 'Cache-Control': 'private, no-store',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    'X-Document-SHA256': row.sha256,
  });
  c.res.end(plain);
}
async function docCategories(c) {
  auth.requireRole(c.s, 'any');
  const r = await db.q(`SELECT DISTINCT category FROM (SELECT category FROM documents WHERE deleted_at IS NULL UNION SELECT category FROM links WHERE deleted_at IS NULL) x WHERE category <> '' ORDER BY 1`);
  json(c.res, 200, r.rows.map((x) => x.category));
}

/* ================================================================ Liens */
function linkUrl(u) {
  u = str(u, 2000);
  if (/^\\\\[^\\]+\\/.test(u)) return u;                      // chemin réseau \\serveur\partage
  if (/^[a-z]:\\/i.test(u)) return u;                         // lecteur réseau
  try { const x = new URL(u); if (['http:', 'https:', 'file:'].includes(x.protocol)) return x.href; } catch (e) {}
  throw new HttpError(422, 'Adresse invalide : http(s)://…, file://… ou \\\\serveur\\partage\\…');
}
function linkMeta(b, partial) {
  const m = {};
  if (!partial || 'title' in b) m.title = str(b.title, 200);
  if (!partial || 'url' in b) m.url = linkUrl(b.url);
  for (const k of ['description', 'category']) if (!partial || k in b) m[k] = str(b[k], k === 'description' ? 4000 : 80);
  if (!partial || 'refs' in b) m.refs = strArr(b.refs, 100, 60);
  if (!partial || 'tags' in b) m.tags = strArr(b.tags, 30, 40);
  if (!partial && !m.title) m.title = m.url;
  return m;
}
async function listLinks(c) {
  auth.requireRole(c.s, 'any');
  const p = c.url.searchParams; const where = ['deleted_at IS NULL']; const args = [];
  if (p.get('ref')) { args.push(p.get('ref')); where.push(`$${args.length} = ANY(refs)`); }
  if (p.get('category')) { args.push(p.get('category')); where.push(`category = $${args.length}`); }
  if (p.get('q')) { args.push('%' + p.get('q').replace(/[\\%_]/g, '\\$&') + '%'); where.push(`(title ILIKE $${args.length} OR url ILIKE $${args.length} OR description ILIKE $${args.length} OR array_to_string(refs,' ') ILIKE $${args.length} OR array_to_string(tags,' ') ILIKE $${args.length})`); }
  const r = await db.q(`SELECT * FROM links WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 1000`, args);
  json(c.res, 200, r.rows);
}
async function createLink(c) {
  auth.requireRole(c.s, 'rw');
  const m = linkMeta(await readJson(c.req), false);
  const r = await db.one('INSERT INTO links(title,url,description,category,refs,tags,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *',
    [m.title, m.url, m.description, m.category, m.refs, m.tags, c.s.user.username]);
  await db.audit(c.s.user, c.ip, 'link.create', r.id, { url: m.url });
  json(c.res, 201, r);
}
async function patchLink(c) {
  auth.requireRole(c.s, 'rw');
  const m = linkMeta(await readJson(c.req), true);
  const keys = Object.keys(m); if (!keys.length) return json(c.res, 204);
  const r = await db.q(`UPDATE links SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(', ')}, updated_by=$${keys.length + 2}, updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,
    [c.params[0], ...keys.map((k) => m[k]), c.s.user.username]);
  if (!r.rowCount) throw new HttpError(404, 'Lien introuvable.');
  await db.audit(c.s.user, c.ip, 'link.update', c.params[0], { fields: keys });
  json(c.res, 204);
}
async function deleteLink(c) {
  auth.requireRole(c.s, 'rw');
  const r = await db.q('UPDATE links SET deleted_at=now(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL', [c.params[0], c.s.user.username]);
  if (!r.rowCount) throw new HttpError(404, 'Lien introuvable.');
  await db.audit(c.s.user, c.ip, 'link.delete', c.params[0]);
  json(c.res, 204);
}

/* ================================================================ Administration */
const USER_COLS = `id, username, display_name, email, role, disabled, totp_enabled, must_change_password, failed_logins, locked_until, last_login_at, created_at,
  (SELECT count(*) FROM sessions s WHERE s.user_id = users.id AND s.expires_at > now())::int AS sessions`;
async function listUsers(c) { auth.requireRole(c.s, 'admin'); json(c.res, 200, (await db.q(`SELECT ${USER_COLS} FROM users ORDER BY lower(username)`)).rows); }
async function createUser(c) {
  auth.requireRole(c.s, 'admin');
  const b = await readJson(c.req);
  const username = str(b.username, 64);
  if (!USERNAME_RE.test(username)) throw new HttpError(422, 'Identifiant invalide (2 à 64 caractères : lettres, chiffres, . _ - @).');
  if (!ROLES.includes(b.role)) throw new HttpError(422, 'Rôle invalide.');
  const pw = tempPassword();
  const u = await db.one('INSERT INTO users(username, display_name, email, role, password_hash, must_change_password) VALUES ($1,$2,$3,$4,$5,true) RETURNING id',
    [username, str(b.displayName, 120) || username, str(b.email, 200), b.role, await sec.hashPassword(pw)])
    .catch((e) => { if (e.code === '23505') throw new HttpError(409, 'Cet identifiant existe déjà.'); throw e; });
  await db.audit(c.s.user, c.ip, 'admin.user_create', username, { role: b.role });
  json(c.res, 201, { id: u.id, temporaryPassword: pw });
}
async function lastAdminGuard(id, change) {
  const u = await db.one('SELECT role, disabled FROM users WHERE id=$1', [id]);
  if (!u) throw new HttpError(404, 'Compte introuvable.');
  const stillAdmin = change.delete ? false : (change.role || u.role) === 'admin' && !(change.disabled ?? u.disabled);
  if (u.role === 'admin' && !u.disabled && !stillAdmin) {
    const n = (await db.one("SELECT count(*)::int AS n FROM users WHERE role='admin' AND NOT disabled")).n;
    if (n <= 1) throw new HttpError(409, 'Impossible : ce compte est le dernier administrateur actif.');
  }
  return u;
}
async function patchUser(c) {
  auth.requireRole(c.s, 'admin');
  const id = c.params[0]; const b = await readJson(c.req); const m = {};
  if ('displayName' in b) m.display_name = str(b.displayName, 120);
  if ('email' in b) m.email = str(b.email, 200);
  if ('role' in b) { if (!ROLES.includes(b.role)) throw new HttpError(422, 'Rôle invalide.'); m.role = b.role; }
  if ('disabled' in b) m.disabled = !!b.disabled;
  if (b.unlock) { m.failed_logins = 0; m.locked_until = null; }
  await lastAdminGuard(id, { role: m.role, disabled: m.disabled });
  const keys = Object.keys(m); if (!keys.length) return json(c.res, 204);
  await db.q(`UPDATE users SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(', ')}, updated_at=now() WHERE id=$1`, [id, ...keys.map((k) => m[k])]);
  if (m.disabled || m.role) await auth.destroyUserSessions(id);
  await db.audit(c.s.user, c.ip, 'admin.user_update', id, { ...m });
  json(c.res, 204);
}
async function resetUserPassword(c) {
  auth.requireRole(c.s, 'admin');
  const pw = tempPassword();
  const r = await db.q('UPDATE users SET password_hash=$2, must_change_password=true, failed_logins=0, locked_until=NULL, updated_at=now() WHERE id=$1', [c.params[0], await sec.hashPassword(pw)]);
  if (!r.rowCount) throw new HttpError(404, 'Compte introuvable.');
  await auth.destroyUserSessions(c.params[0]);
  await db.audit(c.s.user, c.ip, 'admin.user_password_reset', c.params[0]);
  json(c.res, 200, { temporaryPassword: pw });
}
async function resetUserMfa(c) {
  auth.requireRole(c.s, 'admin');
  const r = await db.q('UPDATE users SET totp_secret=NULL, totp_pending=NULL, totp_enabled=false, updated_at=now() WHERE id=$1', [c.params[0]]);
  if (!r.rowCount) throw new HttpError(404, 'Compte introuvable.');
  await auth.destroyUserSessions(c.params[0]);
  await db.audit(c.s.user, c.ip, 'admin.user_mfa_reset', c.params[0]);
  json(c.res, 204);
}
async function deleteUser(c) {
  auth.requireRole(c.s, 'admin');
  if (c.params[0] === c.s.user.id) throw new HttpError(409, 'Vous ne pouvez pas supprimer votre propre compte.');
  await lastAdminGuard(c.params[0], { delete: true });
  const u = await db.one('DELETE FROM users WHERE id=$1 RETURNING username', [c.params[0]]);
  await db.audit(c.s.user, c.ip, 'admin.user_delete', u ? u.username : c.params[0]);
  json(c.res, 204);
}
async function listAllSessions(c) {
  auth.requireRole(c.s, 'admin');
  const r = await db.q(`SELECT encode(s.id_hash,'hex') AS id, u.username, s.ip::text, s.user_agent, s.mfa_ok, s.created_at, s.last_seen_at
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at > now() ORDER BY s.last_seen_at DESC`);
  json(c.res, 200, r.rows.map((x) => ({ ...x, current: x.id === c.s.sid.toString('hex') })));
}
async function revokeSession(c) {
  auth.requireRole(c.s, 'admin');
  await db.q("DELETE FROM sessions WHERE id_hash = decode($1,'hex')", [c.params[0]]);
  await db.audit(c.s.user, c.ip, 'admin.session_revoke', c.params[0].slice(0, 12));
  json(c.res, 204);
}
async function auditLog(c) {
  auth.requireRole(c.s, 'admin');
  const p = c.url.searchParams; const where = []; const args = [];
  if (p.get('before')) { args.push(parseInt(p.get('before'), 10)); where.push(`id < $${args.length}`); }
  if (p.get('q')) { args.push('%' + p.get('q').replace(/[\\%_]/g, '\\$&') + '%'); where.push(`(username ILIKE $${args.length} OR action ILIKE $${args.length} OR target ILIKE $${args.length} OR ip::text ILIKE $${args.length})`); }
  const limit = Math.min(500, parseInt(p.get('limit') || '200', 10) || 200);
  const r = await db.q(`SELECT id, ts, username, ip::text, action, target, details FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limit}`, args);
  json(c.res, 200, r.rows);
}
async function listVersions(c) {
  auth.requireRole(c.s, 'admin');
  const r = await db.q(`SELECT version, updated_at, updated_by, note, sha256, pg_column_size(data) AS bytes,
    jsonb_array_length(data->'items') AS items, jsonb_array_length(data->'findings') AS findings FROM state_history ORDER BY version DESC LIMIT 500`);
  json(c.res, 200, r.rows);
}
async function getVersion(c) {
  auth.requireRole(c.s, 'admin');
  const r = await db.one('SELECT data::text AS data FROM state_history WHERE version=$1', [parseInt(c.params[0], 10)]);
  if (!r) throw new HttpError(404, 'Version introuvable.');
  c.res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="suivi-audits-v${c.params[0]}.json"` });
  c.res.end(r.data);
}
async function restoreVersion(c) {
  auth.requireRole(c.s, 'admin');
  const v = parseInt(c.params[0], 10);
  const r = await db.one('SELECT data, sha256 FROM state_history WHERE version=$1', [v]);
  if (!r) throw new HttpError(404, 'Version introuvable.');
  const out = await saveState(r.data, r.sha256, c.s.user, null, `Restauration de la version ${v}`);
  await db.audit(c.s.user, c.ip, 'admin.state_restore', `v${v}`, { newVersion: out.version });
  json(c.res, 200, { version: out.version });
}
async function sysInfo(c) {
  auth.requireRole(c.s, 'admin');
  const pg = await db.one('SHOW server_version');
  const size = await db.one('SELECT pg_size_pretty(pg_database_size(current_database())) AS s');
  const st = await db.one('SELECT version, updated_at, updated_by FROM app_state WHERE id=1');
  const counts = await db.one(`SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM documents WHERE deleted_at IS NULL)::int AS documents,
    (SELECT count(*) FROM links WHERE deleted_at IS NULL)::int AS links, (SELECT count(*) FROM state_history)::int AS versions, (SELECT count(*) FROM audit_log)::int AS audit`);
  json(c.res, 200, { app: VERSION, node: process.version, postgres: pg.server_version, dbSize: size.s, state: st, counts, keyId: sec.keyId(),
    clamav: cfg.clamav ? `${cfg.clamav.host}:${cfg.clamav.port}${cfg.clamav.required ? ' (obligatoire)' : ''}` : 'désactivé', mfaRequired: cfg.mfaRequired,
    session: cfg.session, maxUploadMb: cfg.maxUploadMb });
}

/* ================================================================ Table de routage */
// csrf: false uniquement pour les routes sans session préalable (connexion, installation).
const R = (m, p, h, o = {}) => [m, new RegExp('^' + p + '$'), h, o];
module.exports = [
  R('GET', '/api/auth/me', async (c) => json(c.res, 200, meOut(c.s))),
  R('POST', '/api/auth/login', login, { csrf: false }),
  R('POST', '/api/auth/mfa', mfa),
  R('POST', '/api/auth/logout', logout),
  R('GET', '/api/setup', setupStatus),
  R('POST', '/api/setup', setup, { csrf: false }),

  R('POST', '/api/account/password', changePassword),
  R('POST', '/api/account/totp/begin', totpBegin),
  R('POST', '/api/account/totp/confirm', totpConfirm),
  R('POST', '/api/account/totp/disable', totpDisable),
  R('GET', '/api/account/sessions', mySessions),
  R('POST', '/api/account/sessions/revoke-others', revokeOtherSessions),

  R('(GET|HEAD)', '/(?:api/state|data/state\\.json)', getState),
  R('PUT', '/api/state', putState),
  R('GET', '/api/refs', refs),

  R('GET', '/api/documents', listDocs),
  R('GET', '/api/documents/categories', docCategories),
  R('POST', '/api/documents', createDoc),
  R('GET', `/api/documents/${UUID}`, getDoc),
  R('PATCH', `/api/documents/${UUID}`, patchDoc),
  R('DELETE', `/api/documents/${UUID}`, deleteDoc),
  R('POST', `/api/documents/${UUID}/restore`, restoreDoc),
  R('POST', `/api/documents/${UUID}/versions`, addVersion),
  R('GET', `/api/documents/${UUID}/download`, downloadDoc),
  R('GET', `/d/${UUID}`, downloadDoc),

  R('GET', '/api/links', listLinks),
  R('POST', '/api/links', createLink),
  R('PATCH', `/api/links/${UUID}`, patchLink),
  R('DELETE', `/api/links/${UUID}`, deleteLink),

  R('GET', '/api/admin/users', listUsers),
  R('POST', '/api/admin/users', createUser),
  R('PATCH', `/api/admin/users/${UUID}`, patchUser),
  R('DELETE', `/api/admin/users/${UUID}`, deleteUser),
  R('POST', `/api/admin/users/${UUID}/reset-password`, resetUserPassword),
  R('POST', `/api/admin/users/${UUID}/reset-mfa`, resetUserMfa),
  R('GET', '/api/admin/sessions', listAllSessions),
  R('DELETE', '/api/admin/sessions/([0-9a-f]{64})', revokeSession),
  R('GET', '/api/admin/audit', auditLog),
  R('GET', '/api/admin/versions', listVersions),
  R('GET', '/api/admin/versions/(\\d+)', getVersion),
  R('POST', '/api/admin/versions/(\\d+)/restore', restoreVersion),
  R('GET', '/api/admin/info', sysInfo),
];
module.exports.saveState = saveState;
module.exports.validState = validState;
