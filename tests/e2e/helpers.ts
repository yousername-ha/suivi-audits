/* Outils des tests de bout en bout : TOTP, jeton d'installation, surveillance des violations de CSP, appels API. */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';

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
    const m = await req.post('/api/auth/mfa', {
      data: { code: await freshTotp(secret) },
      headers: { 'x-csrf-token': csrf },
    });
    if (m.ok()) return (await (await req.get('/api/auth/me')).json()).csrf as string;
  }
  throw new Error(`double authentification refusée pour ${username}`);
}

export async function csrfOf(req: APIRequestContext): Promise<string> {
  return (await (await req.get('/api/auth/me')).json()).csrf as string;
}

/** Compte administrateur créé par le parcours d'installation, réutilisé par les autres fichiers de tests. */
const ADMIN_FILE = path.join(os.tmpdir(), 'suivi-e2e-admin.json');
export const saveAdmin = (username: string, secret: string) =>
  writeFileSync(ADMIN_FILE, JSON.stringify({ username, secret }), { mode: 0o600 });
export const loadAdmin = (): { username: string; secret: string } => JSON.parse(readFileSync(ADMIN_FILE, 'utf8'));

/** Session administrateur partagée par les fichiers de tests : chaque connexion compte dans la limite par adresse
    (20 par quart d'heure), la suite complète la dépasserait. Rouverte seulement si elle n'est plus valide. */
const SESSION_FILE = path.join(os.tmpdir(), 'suivi-e2e-admin-session.json');
export async function sessionAdmin(
  browser: Browser,
): Promise<{ state: Awaited<ReturnType<BrowserContext['storageState']>>; csrf: string }> {
  if (existsSync(SESSION_FILE)) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, storageState: SESSION_FILE });
    const me = await (await ctx.request.get('/api/auth/me')).json();
    const state = await ctx.storageState();
    await ctx.close();
    if (me.stage === 'ok') return { state, csrf: me.csrf as string };
  }
  const admin = loadAdmin();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const csrf = await apiLogin(ctx.request, admin.username, PASSWORD, admin.secret);
  const state = await ctx.storageState({ path: SESSION_FILE });
  await ctx.close();
  return { state, csrf };
}

/** Écrit l'état historique souhaité (ADR 0040) : les modules repris dans des tables passent par l'import « Remplacer un
    module » (seule voie d'écriture hors écrans natifs), le reste par l'écriture directe de /legacy. */
export async function ecrireEtat(req: APIRequestContext, csrf: string, souhaite: Record<string, unknown>) {
  const modules = (await (await req.get('/api/legacy/modules')).json()) as { key: string; takenOver: boolean }[];
  const repris = modules.filter((m) => m.takenOver).map((m) => m.key);
  const lire = async () => {
    const r = await req.get('/api/legacy/state');
    return { data: (await r.json()) as Record<string, unknown>, etag: r.headers().etag! };
  };
  const avant = (await lire()).data;
  const delta = repris.filter(
    (k) => k in souhaite && JSON.stringify(souhaite[k] ?? null) !== JSON.stringify(avant[k] ?? null),
  );
  for (const k of delta) {
    const courant = (await lire()).data;
    // Le fichier ne contient que le socle de l'état et le module remplacé : les autres modules repris n'y figurent pas.
    // Socle de l'état (listes et objets vidés, scalaires conservés) : en mode « remplacer », seul le module visé est lu.
    const socle = Object.fromEntries(
      Object.entries(courant).map(([cle, v]) => [cle, Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : v]),
    );
    const fichier = Buffer.from(JSON.stringify({ ...socle, [k]: souhaite[k] }));
    const entetes = { 'x-csrf-token': csrf, 'content-type': 'application/octet-stream', 'x-file-name': 'etat.json' };
    const sim = await req.post(`/api/admin/import/simulate?mode=replace&module=${k}`, {
      data: fichier,
      headers: entetes,
    });
    if (!sim.ok()) throw new Error(`Simulation de l’import « ${k} » : ${sim.status()} ${await sim.text()}`);
    const sha = ((await sim.json()) as { sha256: string }).sha256;
    const app = await req.post(`/api/admin/import/apply?mode=replace&module=${k}&confirm=${k}&sha256=${sha}`, {
      data: fichier,
      headers: entetes,
    });
    if (!app.ok()) throw new Error(`Import « ${k} » : ${app.status()} ${await app.text()}`);
  }
  const { data, etag } = await lire();
  const reste = { ...souhaite };
  for (const k of repris) reste[k] = data[k];
  const put = await req.put('/api/legacy/state', { data: reste, headers: { 'if-match': etag, 'x-csrf-token': csrf } });
  if (put.status() !== 204) throw new Error(`Écriture de l’état : ${put.status()} ${await put.text()}`);
}
