/* Outils de test : application isolée (base dédiée), client HTTP avec cookies, origine et jeton CSRF, comptes prêts. */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/log.js';
import { hashPassword, hotp } from '../src/security/crypto.js';
import { createServices, type Services } from '../src/services.js';
import { prepareDatabase } from '../src/startup.js';
import { APP_ROLE, APP_ROLE_PASSWORD, createDatabase, dropDatabase, PG } from './pg.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '../../..');
export const ORIGIN = 'https://suivi.test';
export const PASSWORD = 'Mot-de-passe-2026!';

export interface TestApp {
  app: FastifyInstance;
  svc: Services;
  dbName: string;
  close(): Promise<void>;
}

export async function createTestApp(
  env: Record<string, string> = {},
  opts: { migrate?: boolean; dbName?: string } = {},
): Promise<TestApp> {
  const dbName = opts.dbName ?? (await createDatabase());
  const cfg = loadConfig({
    DB_HOST: PG.host,
    DB_PORT: String(PG.port),
    DB_NAME: dbName,
    DB_USER: APP_ROLE,
    DB_PASSWORD: APP_ROLE_PASSWORD,
    DOC_MASTER_KEY: crypto.randomBytes(32).toString('base64'),
    SECRETS_DIR: '/nonexistent',
    TRUST_PROXY: '1',
    PUBLIC_URL: ORIGIN,
    SEED_FILE: path.join(REPO, 'apps/api/seed/state.json'),
    APP_VERSION: '3.0.0-test',
    ...env,
  });
  const svc = createServices(cfg, createLogger(process.env.TEST_LOG_LEVEL || 'silent'));
  if (opts.migrate !== false) await prepareDatabase(svc, { issueToken: false });
  const app = await buildApp(svc);
  await app.ready();
  return {
    app,
    svc,
    dbName,
    async close() {
      await app.close();
      svc.presence.stop();
      await svc.bus.stop();
      await svc.db.end();
      await dropDatabase(dbName);
    },
  };
}

/** Client HTTP de test : conserve les cookies, envoie l'origine et le jeton CSRF comme un navigateur. */
export class Agent {
  cookies = new Map<string, string>();
  csrf: string | null = null;
  constructor(
    readonly t: TestApp,
    readonly origin: string | null = ORIGIN,
  ) {}

  async req(
    method: InjectOptions['method'],
    url: string,
    opts: { json?: unknown; body?: Buffer | string; headers?: Record<string, string>; csrf?: boolean } = {},
  ) {
    const headers: Record<string, string> = {
      'x-forwarded-proto': 'https',
      host: 'suivi.test',
      ...(opts.headers ?? {}),
    };
    if (this.origin && !['GET', 'HEAD'].includes(String(method))) headers.origin ??= this.origin;
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (this.csrf && opts.csrf !== false && !['GET', 'HEAD'].includes(String(method)))
      headers['x-csrf-token'] ??= this.csrf;
    let payload: string | Buffer | undefined;
    if (opts.json !== undefined) {
      payload = JSON.stringify(opts.json);
      headers['content-type'] = 'application/json';
    } else if (opts.body !== undefined) {
      payload = opts.body;
      headers['content-type'] ??= 'application/octet-stream';
    }
    const res = await this.t.app.inject({ method, url, headers, payload });
    this.absorb(res);
    return res;
  }
  absorb(res: LightMyRequestResponse) {
    const sc = res.headers['set-cookie'];
    for (const c of Array.isArray(sc) ? sc : sc ? [sc] : []) {
      const [kv] = c.split(';');
      const i = kv!.indexOf('=');
      const k = kv!.slice(0, i);
      const v = kv!.slice(i + 1);
      if (!v || /Max-Age=0/.test(c)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }
  get = (url: string, headers?: Record<string, string>) => this.req('GET', url, { headers });
  post = (url: string, json?: unknown, headers?: Record<string, string>) =>
    this.req('POST', url, { json: json ?? {}, headers });
  put = (url: string, json?: unknown, headers?: Record<string, string>) => this.req('PUT', url, { json, headers });
  patch = (url: string, json?: unknown, headers?: Record<string, string>) => this.req('PATCH', url, { json, headers });
  del = (url: string, headers?: Record<string, string>) => this.req('DELETE', url, { headers });

  async me() {
    const r = await this.get('/api/auth/me');
    const j = r.json() as { csrf: string | null; stage: string; permissions: string[] };
    this.csrf = j.csrf;
    return j;
  }
}

export interface TestUser {
  id: string;
  username: string;
  role: string;
  key: Buffer;
}

/** Raccourcis des rôles v2 (même correspondance que la migration 003). */
const V2: Record<string, string> = { admin: 'administrateur', rw: 'contributeur', ro: 'lecteur' };

/** Crée un compte avec TOTP déjà activé (mot de passe PASSWORD). « role » : rôle v2 (admin, rw, ro), identifiant
    de rôle (prédéfini ou personnalisé) ou null (aucun rôle direct). */
export async function makeUser(
  t: TestApp,
  username: string,
  role: string | null,
  o: { totp?: boolean; mustChange?: boolean; modules?: string[]; expiresAt?: Date | null } = {},
): Promise<TestUser> {
  const key = crypto.randomBytes(20);
  const r = await t.svc.db.one<{ id: string }>(
    'INSERT INTO users(username, display_name, password_hash, must_change_password, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [username, `Nom ${username}`, await hashPassword(PASSWORD), !!o.mustChange, o.expiresAt ?? null],
  );
  const id = r!.id;
  if (role)
    await t.svc.db.q('INSERT INTO user_roles(user_id, role_id, modules) VALUES ($1, $2, $3)', [
      id,
      V2[role] ?? role,
      o.modules ?? null,
    ]);
  if (o.totp !== false) {
    await t.svc.db.q('UPDATE users SET totp_secret=$2, totp_enabled=true WHERE id=$1', [
      id,
      t.svc.vault.sealSmall(key, 'totp:' + id),
    ]);
  }
  return { id, username, role: role ?? '', key };
}

/** Code TOTP valide et non encore utilisé (anti-rejeu : pas strictement supérieur au dernier accepté). */
export async function nextCode(t: TestApp, u: TestUser): Promise<string> {
  const last = Number(
    (await t.svc.db.one<{ s: string }>('SELECT totp_last_step::text AS s FROM users WHERE id=$1', [u.id]))!.s,
  );
  const cur = Math.floor(Date.now() / 30000);
  // Pas courant d'abord (milieu de la fenêtre acceptée par le serveur) : choisir le pas précédent exposait le test à un
  // rejet quand l'horloge franchit la limite entre la génération du code et sa vérification, sur un exécuteur chargé.
  const step = [cur, cur + 1, cur - 1].find((s) => s > last);
  if (step === undefined) {
    // Fenêtre épuisée (trois connexions dans la même minute) : on remet le compteur à zéro, réservé aux tests.
    await t.svc.db.q('UPDATE users SET totp_last_step=0 WHERE id=$1', [u.id]);
    return hotp(u.key, cur - 1);
  }
  return hotp(u.key, step);
}

/** Connexion complète (mot de passe puis TOTP). */
export async function login(t: TestApp, u: TestUser): Promise<Agent> {
  const a = new Agent(t);
  const r1 = await a.post('/api/auth/login', { username: u.username, password: PASSWORD });
  if (r1.statusCode !== 200) throw new Error(`login ${u.username}: ${r1.statusCode} ${r1.body}`);
  await a.me();
  const r2 = await a.post('/api/auth/mfa', { code: await nextCode(t, u) });
  if (r2.statusCode !== 200) throw new Error(`mfa ${u.username}: ${r2.statusCode} ${r2.body}`);
  await a.me();
  t.svc.limits.loginByIp.reset();
  t.svc.limits.loginByUser.reset();
  return a;
}

export const fixturePath = path.join(REPO, 'tests/fixtures/legacy-fixture.json');

/** Crée un écart natif dans le périmètre commun (ce que le module Audit lit comme constat de l'ancien format). */
export async function ecartCommun(
  a: Agent,
  o: {
    name: string;
    classification?: 'majeure' | 'mineure' | 'point_sensible';
    source?: 'AFNOR' | 'Interne';
    items?: string[];
    dueAt?: string;
    findingType?: 'observation' | 'nonconformity' | 'opportunity';
  },
) {
  const r = await a.post('/api/grc/00000000-0000-4000-8000-000000000001/objects', {
    kind: 'nonconformity',
    name: o.name,
    data: {
      findingType: o.findingType ?? 'nonconformity',
      classification: o.classification ?? '',
      source: o.source ?? '',
      refs: (o.items ?? []).map((i) => 'legacy:items:' + i),
      dueAt: o.dueAt ?? '',
    },
  });
  if (r.statusCode >= 300) throw new Error(`écart commun : ${r.statusCode} ${r.body}`);
  return r.json() as { id: string; version: number };
}

/** Amorce l'état historique d'un test : les modules repris vont dans leurs tables, le reste dans app_state (ADR 0040). */
export async function seedState(t: TestApp, etat: Record<string, unknown>) {
  await t.svc.db.tx(async (c) => {
    await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
    const r = await t.svc.legacy.nativeWrite(c, etat as never, null, null, 'amorçage de test', {
      retirerAbsents: true,
    });
    if (r.conflict) throw new Error('amorçage de test : conflit de version');
  }, 'test');
}
