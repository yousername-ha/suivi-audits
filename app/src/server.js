'use strict';
/* Suivi des audits SMSI ISO 27001 / HDS — serveur applicatif. */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const cfg = require('./config');
const db = require('./db');
const sec = require('./security');
const auth = require('./auth');
const log = require('./log');
const routes = require('./api');
const H = require('./http');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');   // outil de suivi (fichier unique) + bibliothèques
const WEB = path.join(ROOT, 'web');         // pages de connexion, administration, documents
const ROUTES = routes.map(([m, re, h, o]) => [new RegExp('^' + m + '$'), re, h, o]);

/* ---------------------------------------------------------------- Page de l'outil de suivi */
function buildAppIndex() {
  let h = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  h = h.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
  h = h.replace(/<script([^>]*)src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[^"]*\/xlsx\.full\.min\.js"/, '<script$1src="/lib/xlsx.full.min.js"');
  h = h.replace("const LIB_MODE='cdn';", "const LIB_MODE='local';");
  h = h.replace(/(local:')lib\//g, '$1/lib/');
  const tag = '\n<!--SUIVI-CFG--><script src="/assets/shim.js"></script>';
  h = /<meta charset="utf-8">/i.test(h) ? h.replace(/<meta charset="utf-8">/i, (m) => m + tag) : h.replace(/<head>/i, (m) => m + tag);
  return h;
}
const APP_INDEX = buildAppIndex();

const PAGES = { '/login': 'login.html', '/setup': 'setup.html', '/account': 'account.html', '/admin': 'admin.html', '/documents': 'documents.html' };
const PAGE_CACHE = {};
for (const [k, f] of Object.entries(PAGES)) PAGE_CACHE[k] = fs.readFileSync(path.join(WEB, f));

const MIME = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
async function serveStatic(res, base, rel) {
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base + path.sep)) return false;
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) return false;
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'public, max-age=3600' });
    fs.createReadStream(file).pipe(res);
    return true;
  } catch (e) { return false; }
}

/* ---------------------------------------------------------------- Traitement des requêtes */
async function handle(req, res) {
  const url = new URL(req.url, 'http://local');
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { return H.text(res, 400, 'Requête invalide.'); }
  H.baseHeaders(res);
  if (cfg.cookieSecure !== 'false' && H.isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  if (p === '/healthz') return H.text(res, 200, 'ok');
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && p.startsWith('/assets/') && await serveStatic(res, path.join(WEB, 'assets'), p.slice(8))) return;
  if (req.method === 'GET' && p.startsWith('/lib/') && await serveStatic(res, path.join(PUBLIC, 'lib'), p.slice(5))) return;

  const ip = H.clientIp(req);
  const s = await auth.loadSession(req);
  const stage = auth.accessStage(s);

  // Pages HTML
  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    if (stage !== 'ok') return H.redirect(res, '/login');
    if (s.user.role === 'ro' && !/(^|&)lecture\b/.test(url.search.slice(1))) return H.redirect(res, '/?lecture');
    const cfgJs = JSON.stringify({ user: s.user.username, name: s.user.displayName, role: s.user.role, csrf: s.csrf }).replace(/</g, '\\u003c');
    res.setHeader('Content-Security-Policy', H.CSP_APP);
    return H.text(res, 200, APP_INDEX.replace('<!--SUIVI-CFG-->', `<script>window.__SUIVI=${cfgJs};</script>`), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && PAGES[p]) {
    // Installation : tant qu'aucun administrateur n'existe (même si le jeton a expiré), ou jeton de secours en cours.
    if (p === '/setup' && (await auth.adminExists()) && !(await auth.setupPending())) return H.redirect(res, '/login');
    if (['/account', '/admin', '/documents'].includes(p) && stage !== 'ok') return H.redirect(res, '/login?next=' + encodeURIComponent(p));
    if (p === '/admin' && s.user.role !== 'admin') return H.redirect(res, '/');
    return H.text(res, 200, PAGE_CACHE[p], 'text/html; charset=utf-8');
  }

  // API
  for (const [mre, pre, h, o] of ROUTES) {
    if (!mre.test(req.method)) continue;
    const m = pre.exec(p); if (!m) continue;
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (!H.sameOrigin(req)) return H.json(res, 403, { error: 'Origine refusée.' });
      if (o.csrf !== false) {
        if (!s) return H.json(res, 401, { error: 'Session expirée. Reconnectez-vous.', stage: 'anon' });
        if (!sec.safeEqual(req.headers['x-csrf-token'] || '', s.csrf)) return H.json(res, 403, { error: 'Jeton CSRF invalide. Rechargez la page.' });
      }
    }
    return h({ req, res, s, ip, url, params: m.slice(1) });
  }
  return H.json(res, 404, { error: 'Introuvable.' });
}

/* ---------------------------------------------------------------- Démarrage */
async function seedState() {
  const has = await db.one('SELECT 1 FROM app_state WHERE id=1');
  if (has) return;
  try {
    const buf = fs.readFileSync(path.join(ROOT, 'seed', 'state.json'));
    const obj = JSON.parse(buf.toString('utf8'));
    if (!routes.validState(obj)) throw new Error('structure inattendue');
    await routes.saveState(obj, sec.sha256hex(buf), null, null, 'Données initiales');
    log.info('state seeded');
  } catch (e) { log.warn('no initial state', { err: e.message }); }
}

async function main() {
  sec.initKey(cfg.masterKey);
  if (!cfg.db.password) log.warn('no database password configured (db_app_password)');
  await db.waitReady();
  await db.migrate();
  await seedState();
  if (!(await auth.adminExists())) await auth.issueSetupToken('first_start');

  const srv = http.createServer((req, res) => handle(req, res).catch((e) => {
    if (e instanceof H.HttpError) { if (!res.headersSent) H.json(res, e.status, { error: e.message, ...(e.extra || {}) }); return; }
    log.error('request failed', { err: e.stack || String(e), path: req.url });
    if (!res.headersSent) H.json(res, 500, { error: 'Erreur interne.' }); else res.destroy();
  }));
  srv.requestTimeout = 120e3; srv.headersTimeout = 20e3; srv.keepAliveTimeout = 5e3;
  srv.listen(cfg.port, () => log.info('listening', { port: cfg.port, mfaRequired: cfg.mfaRequired, clamav: !!cfg.clamav, keyId: sec.keyId() }));
  const stop = () => { log.info('shutting down'); srv.close(() => db.pool.end().finally(() => process.exit(0))); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
main().catch((e) => { log.error('fatal', { err: e.stack || String(e) }); process.exit(1); });
