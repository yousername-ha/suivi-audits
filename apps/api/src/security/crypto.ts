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

export function passwordProblems(pw: unknown, minLen: number, ctx: string[] = []): string[] {
  const p: string[] = [];
  const s = typeof pw === 'string' ? pw : '';
  if (s.length < minLen) p.push(`au moins ${minLen} caractères`);
  if (s.length > 256) p.push('256 caractères au maximum');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  if (classes < 3) p.push('au moins 3 types de caractères parmi minuscules, majuscules, chiffres, symboles');
  for (const c of ctx)
    if (c && c.length >= 3 && s.toLowerCase().includes(c.toLowerCase())) p.push("ne pas contenir l'identifiant");
  return p;
}

export const token = (n = 32) => crypto.randomBytes(n).toString('base64url');
export const sha256 = (b: crypto.BinaryLike) => crypto.createHash('sha256').update(b).digest();
export const sha256hex = (b: crypto.BinaryLike) => crypto.createHash('sha256').update(b).digest('hex');
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
    const d = crypto.createDecipheriv('aes-256-gcm', this.#key, iv);
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
