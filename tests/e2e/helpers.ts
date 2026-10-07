/* Outils des tests de bout en bout : TOTP, jeton d'installation, surveillance des violations de CSP, appels API. */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';

export const PASSWORD = 'E2e-Mot-de-passe-2026!';

/** Commande qui affiche un nouveau jeton (par défaut sur la pile locale). */
export function setupToken(): string {
  const cmd = process.env.E2E_TOKEN_CMD || 'docker compose exec -T app setup-token';
  const out = execSync(cmd, { cwd: process.env.E2E_STACK_DIR || '../..', encoding: 'utf8' });
  const m = /[A-Z2-9]{5}(-[A-Z2-9]{5}){3}/.exec(out);
  if (!m) throw new Error(`Jeton introuvable dans la sortie de « ${cmd} »`);
  return m[0];
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Decode(s: string): Buffer {
  const out: number[] = [];
  let bits = 0,
    val = 0;
  for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totp(secret: string, offset = 0): string {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(c).digest();
  const o = h[h.length - 1]! & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

/** Code TOTP jamais encore utilisé pour ce secret (le serveur refuse le rejeu d'un pas déjà accepté) ;
    attend la fenêtre suivante si nécessaire. */
const lastStep = new Map<string, number>();
export async function freshTotp(secret: string): Promise<string> {
  for (;;) {
    const cur = Math.floor(Date.now() / 30000);
    const step = Math.max(cur - 1, (lastStep.get(secret) ?? 0) + 1);
    if (step <= cur + 1) {
      lastStep.set(secret, step);
      return totp(secret, step - cur);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
export const markTotpUsed = (secret: string, offset = 0) =>
  lastStep.set(secret, Math.max(lastStep.get(secret) ?? 0, Math.floor(Date.now() / 30000) + offset));

/** Enregistre toute violation de CSP et toute erreur JavaScript de la page. */
export function watchPage(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to (apply|execute|load)/i.test(m.text())) problems.push(`CSP : ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`JS : ${e.message}`));
  return problems;
}

/** Session API (même cookie que le navigateur du contexte) : connexion complète avec TOTP. */
export async function apiLogin(req: APIRequestContext, username: string, password: string, secret: string) {
  const r = await req.post('/api/auth/login', { data: { username, password } });
  if (!r.ok()) throw new Error(`connexion ${username} : ${r.status()} ${await r.text()}`);
  for (let i = 0; i < 3; i++) {
    const csrf = (await (await req.get('/api/auth/me')).json()).csrf as string;
    const m = await req.post('/api/auth/mfa', { data: { code: await freshTotp(secret) }, headers: { 'x-csrf-token': csrf } });
    if (m.ok()) return (await (await req.get('/api/auth/me')).json()).csrf as string;
  }
  throw new Error(`double authentification refusée pour ${username}`);
}

export async function csrfOf(req: APIRequestContext): Promise<string> {
  return (await (await req.get('/api/auth/me')).json()).csrf as string;
}
