/* Primitives cryptographiques : mots de passe (scrypt), jetons, TOTP (RFC 6238), chiffrement AES-256-GCM.
   Formats strictement identiques à la v2 (app/src/security.js) : une base v2 reste lisible sans conversion. */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (
  pw: string,
  salt: Buffer,
  len: number,
  opts: crypto.ScryptOptions,
) => Promise<Buffer>;
const SCRYPT = { N: 2 ** 16, r: 8, p: 2, maxmem: 128 * 1024 * 1024 }; // 64 Mio, paramètres OWASP

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${h.toString('base64')}`;
}
export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  const parts = String(stored || '').split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
  const [, N, r, p, s, h] = parts as [string, string, string, string, string, string];
  const exp = Buffer.from(h, 'base64');
  const got = await scrypt(String(pw).normalize('NFKC'), Buffer.from(s, 'base64'), exp.length, {
    N: +N,
    r: +r,
    p: +p,
    maxmem: 256 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(exp, got);
}
let DUMMY: string | null = null;
/** Vérification factice : temps de réponse identique quand le compte n'existe pas. */
export async function dummyVerify(pw: string): Promise<false> {
  DUMMY ??= await hashPassword('x');
  await verifyPassword(pw, DUMMY);
  return false;
}

/* ---------------------------------------------------------------- Poivre (ADR 0072) */
const SCRYPT_POIVRE = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
/** Clé de 32 octets dérivée du poivre (forme canonique) et d'un sel propre à chaque définition. */
export async function deriverClePoivre(poivre: string, sel: Buffer): Promise<Buffer> {
  return scrypt(poivre.normalize('NFKC'), sel, 32, SCRYPT_POIVRE);
}
export const idClePoivre = (cle: Buffer) => sha256hex(cle).slice(0, 16);
/** Empreinte scrypt chiffrée : iv (12) | étiquette (16) | contenu, liée au compte par les données authentifiées. */
export function chiffrerEmpreinte(cle: Buffer, userId: string, empreinteScrypt: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv);
  c.setAAD(Buffer.from('mdp:' + userId));
  const contenu = Buffer.concat([c.update(empreinteScrypt, 'utf8'), c.final()]);
  return `poivre$${idClePoivre(cle)}$${Buffer.concat([iv, c.getAuthTag(), contenu]).toString('base64')}`;
}
/** Identifiant de clé porté par une empreinte poivrée, ou null si l'empreinte n'en est pas une. */
export function idCleEmpreinte(stockee: string | null | undefined): string | null {
  const parts = String(stockee || '').split('$');
  return parts[0] === 'poivre' && parts.length === 3 ? (parts[1] as string) : null;
}
/** Empreinte scrypt en clair, ou null : mauvaise clé, autre compte, contenu altéré (l'authentification GCM échoue). */
export function ouvrirEmpreinte(cle: Buffer, userId: string, stockee: string): string | null {
  const parts = stockee.split('$');
  if (parts[0] !== 'poivre' || parts.length !== 3 || parts[1] !== idClePoivre(cle)) return null;
  try {
    const b = Buffer.from(parts[2] as string, 'base64');
    if (b.length < 28 + 1) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', cle, b.subarray(0, 12), { authTagLength: 16 });
    d.setAAD(Buffer.from('mdp:' + userId));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export const token = (n = 32) => crypto.randomBytes(n).toString('base64url');
/** Octets hachables : chaîne ou vue sur un tampon (Buffer, Uint8Array…). */
type Octets = string | NodeJS.ArrayBufferView;
export const sha256 = (b: Octets) => crypto.createHash('sha256').update(b).digest();
export const sha256hex = (b: Octets) => crypto.createHash('sha256').update(b).digest('hex');
export function safeEqual(a: unknown, b: unknown): boolean {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function tempPassword(len = 20): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '-_.!+='];
  const all = sets.join('');
  const c = sets.map((x) => x[crypto.randomInt(x.length)] as string);
  while (c.length < len) c.push(all[crypto.randomInt(all.length)] as string);
  for (let i = c.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [c[i], c[j]] = [c[j] as string, c[i] as string];
  }
  return c.join('');
}

/* ---------------------------------------------------------------- TOTP */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf: Buffer): string {
  let bits = 0,
    val = 0,
    out = '';
  for (const b of buf) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const out: number[] = [];
  let bits = 0,
    val = 0;
  for (const ch of clean) {
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function hotp(key: Buffer, counter: number): string {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(c).digest();
  const o = (h[h.length - 1] as number) & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
/** Renvoie le pas temporel accepté (fenêtre ±1) ou 0. Le pas doit être > lastStep (anti-rejeu). */
export function verifyTotp(key: Buffer, code: string, lastStep = 0, now = Date.now()): number {
  if (!/^\d{6}$/.test(String(code || ''))) return 0;
  const cur = Math.floor(now / 30000);
  for (const s of [cur, cur - 1, cur + 1]) if (s > lastStep && safeEqual(hotp(key, s), code)) return s;
  return 0;
}

/* ---------------------------------------------------------------- AES-256-GCM */
export interface Sealed {
  iv: Buffer;
  tag: Buffer;
  content: Buffer;
  keyId: string;
}
export class Vault {
  readonly keyId: string;
  readonly #key: Buffer;
  constructor(b64: string) {
    const k = Buffer.from(String(b64 || ''), 'base64');
    if (k.length !== 32) throw new Error('Clé maître absente ou invalide (doc_master_key : 32 octets en base64).');
    this.#key = k;
    this.keyId = sha256hex(k).slice(0, 16);
  }
  encrypt(plain: Buffer, aad = ''): Sealed {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this.#key, iv);
    if (aad) c.setAAD(Buffer.from(aad));
    const content = Buffer.concat([c.update(plain), c.final()]);
    return { iv, tag: c.getAuthTag(), content, keyId: this.keyId };
  }
  decrypt({ iv, tag, content, keyId }: Sealed, aad = ''): Buffer {
    if (keyId && keyId !== this.keyId)
      throw new Error('Clé de chiffrement différente de celle utilisée pour ce contenu.');
    // Étiquette de 16 octets exigée explicitement : une étiquette tronquée affaiblirait l'authentification (CWE-354).
    const d = crypto.createDecipheriv('aes-256-gcm', this.#key, iv, { authTagLength: 16 });
    if (aad) d.setAAD(Buffer.from(aad));
    d.setAuthTag(tag);
    return Buffer.concat([d.update(content), d.final()]);
  }
  /** Petits secrets (TOTP) : iv|tag|contenu dans un seul bytea. */
  sealSmall(buf: Buffer, aad: string): Buffer {
    const e = this.encrypt(buf, aad);
    return Buffer.concat([e.iv, e.tag, e.content]);
  }
  openSmall(b: Buffer, aad: string): Buffer {
    return this.decrypt({ iv: b.subarray(0, 12), tag: b.subarray(12, 28), content: b.subarray(28), keyId: '' }, aad);
  }
}
