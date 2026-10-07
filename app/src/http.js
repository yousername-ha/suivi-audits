'use strict';
const cfg = require('./config');

class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }

// CSP stricte pour les pages de l'application (aucun script en ligne).
const CSP_STRICT = ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
  "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
// CSP de l'outil de suivi (fichier unique historique : scripts et styles en ligne nécessaires, aucune origine externe).
const CSP_APP = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self' data:", "connect-src 'self'", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
// Fichiers téléchargés : jamais interprétés dans l'origine de l'application.
const CSP_FILE = "default-src 'none'; sandbox";

function baseHeaders(res, csp) {
  res.setHeader('Content-Security-Policy', csp || CSP_STRICT);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}

function json(res, status, obj, headers) {
  const body = obj === undefined ? '' : JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(headers || {}) });
  res.end(status === 204 ? undefined : body);
}
function text(res, status, body, type, headers) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...(headers || {}) });
  res.end(body);
}
function redirect(res, loc) { res.writeHead(302, { Location: loc, 'Cache-Control': 'no-store' }); res.end(); }

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const len = parseInt(req.headers['content-length'] || '0', 10);
    if (len > maxBytes) { req.resume(); return reject(new HttpError(413, 'Contenu trop volumineux.')); }
    const chunks = []; let n = 0; let done = false;
    req.on('data', (c) => {
      if (done) return;
      n += c.length;
      if (n > maxBytes) { done = true; req.resume(); reject(new HttpError(413, 'Contenu trop volumineux.')); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}
async function readJson(req, maxBytes = 256 * 1024) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON attendu.');
  const b = await readBody(req, maxBytes);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch (e) { throw new HttpError(400, 'JSON invalide.'); }
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    const k = part.slice(0, i).trim(); if (!(k in out)) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function clientIp(req) {
  if (cfg.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}
function isHttps(req) {
  if (req.socket.encrypted) return true;
  return cfg.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

// Contrôle d'origine pour toute requête modifiante (défense CSRF en complément du jeton).
function sameOrigin(req) {
  const o = req.headers.origin || req.headers.referer;
  if (!o) return req.headers['sec-fetch-site'] ? req.headers['sec-fetch-site'] === 'same-origin' : true;
  let u; try { u = new URL(o); } catch (e) { return false; }
  const host = (cfg.trustProxy && req.headers['x-forwarded-host']) || req.headers.host;
  if (cfg.publicUrl) { try { if (new URL(cfg.publicUrl).host === u.host) return true; } catch (e) {} }
  return u.host === String(host || '').split(',')[0].trim();
}

/** Limiteur simple à fenêtre glissante (mémoire). */
function limiter(max, windowMs) {
  const m = new Map();
  setInterval(() => { const t = Date.now(); for (const [k, v] of m) if (v.reset < t) m.delete(k); }, windowMs).unref();
  return (key) => {
    const t = Date.now(); let v = m.get(key);
    if (!v || v.reset < t) { v = { n: 0, reset: t + windowMs }; m.set(key, v); }
    v.n++;
    return v.n <= max;
  };
}

module.exports = { HttpError, CSP_STRICT, CSP_APP, CSP_FILE, baseHeaders, json, text, redirect, readBody, readJson, parseCookies, clientIp, isHttps, sameOrigin, limiter };
