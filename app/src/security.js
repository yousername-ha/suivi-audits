'use strict';
/* Primitives cryptographiques : mots de passe (scrypt), jetons, TOTP (RFC 6238), chiffrement AES-256-GCM. */
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const SCRYPT = { N: 2 ** 16, r: 8, p: 2, maxmem: 128 * 1024 * 1024 };  // 64 Mio, paramètres OWASP

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${h.toString('base64')}`;
}
async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
  const [, N, r, p, s, h] = parts;
  const exp = Buffer.from(h, 'base64');
  const got = await scrypt(String(pw).normalize('NFKC'), Buffer.from(s, 'base64'), exp.length, { N: +N, r: +r, p: +p, maxmem: 256 * 1024 * 1024 });
  return crypto.timingSafeEqual(exp, got);
}
// Empreinte factice : temps de réponse identique quand le compte n'existe pas.
let DUMMY = null;
async function dummyVerify(pw) { if (!DUMMY) DUMMY = await hashPassword('x'); await verifyPassword(pw, DUMMY); return false; }

function passwordProblems(pw, minLen, ctx = []) {
  const p = [];
  if (typeof pw !== 'string' || pw.length < minLen) p.push(`au moins ${minLen} caractères`);
  if (pw && pw.length > 256) p.push('256 caractères au maximum');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw || '')).length;
  if (classes < 3) p.push('au moins 3 types de caractères parmi minuscules, majuscules, chiffres, symboles');
  for (const c of ctx) if (c && c.length >= 3 && String(pw || '').toLowerCase().includes(c.toLowerCase())) p.push("ne pas contenir l'identifiant");
  return p;
}

const token = (n = 32) => crypto.randomBytes(n).toString('base64url');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();
const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------------- TOTP ---------------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function hotp(key, counter) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(c).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
/** Renvoie le pas temporel accepté (fenêtre ±1) ou 0. Le pas doit être > lastStep (anti-rejeu). */
function verifyTotp(key, code, lastStep = 0) {
  if (!/^\d{6}$/.test(String(code || ''))) return 0;
  const now = Math.floor(Date.now() / 30000);
  for (const s of [now, now - 1, now + 1]) if (s > lastStep && safeEqual(hotp(key, s), code)) return s;
  return 0;
}

/* ---------------- Chiffrement AES-256-GCM ---------------- */
let KEY = null, KEY_ID = '';
function initKey(b64) {
  const k = Buffer.from(String(b64 || ''), 'base64');
  if (k.length !== 32) throw new Error('Clé maître absente ou invalide (doc_master_key : 32 octets en base64).');
  KEY = k; KEY_ID = sha256hex(k).slice(0, 16);
}
function encrypt(plain, aad = '') {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const content = Buffer.concat([c.update(plain), c.final()]);
  return { iv, tag: c.getAuthTag(), content, keyId: KEY_ID };
}
function decrypt({ iv, tag, content, keyId }, aad = '') {
  if (keyId && keyId !== KEY_ID) throw new Error('Clé de chiffrement différente de celle utilisée pour ce contenu.');
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(content), d.final()]);
}
// Petits secrets (TOTP) : iv|tag|contenu dans un seul bytea.
function sealSmall(buf, aad) { const e = encrypt(buf, aad); return Buffer.concat([e.iv, e.tag, e.content]); }
function openSmall(b, aad) { return decrypt({ iv: b.subarray(0, 12), tag: b.subarray(12, 28), content: b.subarray(28) }, aad); }

function tempPassword(len = 20) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '-_.!+='];
  const all = sets.join('');
  const c = sets.map((x) => x[crypto.randomInt(x.length)]);
  while (c.length < len) c.push(all[crypto.randomInt(all.length)]);
  for (let i = c.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
  return c.join('');
}

module.exports = { tempPassword, hashPassword, verifyPassword, dummyVerify, passwordProblems, token, sha256, sha256hex, safeEqual,
  base32, hotp, verifyTotp, initKey, encrypt, decrypt, sealSmall, openSmall, keyId: () => KEY_ID };
