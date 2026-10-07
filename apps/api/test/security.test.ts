import { hotp } from '../src/security/crypto.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, createTestApp, login, makeUser, nextCode, PASSWORD, type TestApp, type TestUser } from './helpers.js';

let t: TestApp;
let admin: TestUser, rw: TestUser, ro: TestUser;

beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'admin', 'admin');
  rw = await makeUser(t, 'redacteur', 'rw');
  ro = await makeUser(t, 'lecteur', 'ro');
});
afterAll(() => t.close());

describe('en-têtes et cookies', () => {
  it('pose les en-têtes de sécurité et une CSP stricte', async () => {
    const r = await new Agent(t).get('/api/auth/me');
    expect(r.headers['content-security-policy']).toMatch(/default-src 'self'.*script-src 'self'(?!.*unsafe)/);
    expect(r.headers['content-security-policy']).not.toMatch(/unsafe-inline/);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-frame-options']).toBe('DENY');
    expect(r.headers['strict-transport-security']).toMatch(/max-age=31536000/);
  });

  it('cookie de session __Host-, Secure, HttpOnly, SameSite=Strict', async () => {
    const a = new Agent(t);
    const r = await a.post('/api/auth/login', { username: 'admin', password: PASSWORD });
    const c = String(r.headers['set-cookie']);
    expect(c).toMatch(/^__Host-suivi_sid=/);
    expect(c).toMatch(/; Path=\//);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/SameSite=Strict/);
    expect(c).toMatch(/Secure/);
    expect(c).not.toMatch(/Domain=/);
  });
});

describe('double authentification', () => {
  it('le mot de passe seul ne donne pas accès (étape mfa)', async () => {
    const a = new Agent(t);
    const r = await a.post('/api/auth/login', { username: 'redacteur', password: PASSWORD });
    expect(r.json()).toEqual({ stage: 'mfa' });
    const docs = await a.get('/api/documents');
    expect(docs.statusCode).toBe(403);
    expect(docs.json().stage).toBe('mfa');
  });

  it('refuse un code faux, puis le rejeu d’un code déjà utilisé', async () => {
    const a = new Agent(t);
    await a.post('/api/auth/login', { username: 'redacteur', password: PASSWORD });
    await a.me();
    expect((await a.post('/api/auth/mfa', { code: '000000' })).statusCode).toBe(401);
    const code = await nextCode(t, rw);
    const ok = await a.post('/api/auth/mfa', { code });
    expect(ok.statusCode).toBe(200);
    // Seconde session : le même code est refusé (anti-rejeu).
    const b = new Agent(t);
    await b.post('/api/auth/login', { username: 'redacteur', password: PASSWORD });
    await b.me();
    expect((await b.post('/api/auth/mfa', { code })).statusCode).toBe(401);
    t.svc.limits.loginByUser.reset();
  });

  it('change la session après le second facteur (anti-fixation)', async () => {
    const a = new Agent(t);
    await a.post('/api/auth/login', { username: 'lecteur', password: PASSWORD });
    const before = [...a.cookies.values()][0];
    await a.me();
    await a.post('/api/auth/mfa', { code: await nextCode(t, ro) });
    const after = [...a.cookies.values()][0];
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    expect((await a.me()).stage).toBe('ok');
  });

  it('impose l’enrôlement TOTP quand il n’est pas encore configuré', async () => {
    const u = await makeUser(t, 'nouveau', 'rw', { totp: false });
    const a = new Agent(t);
    expect((await a.post('/api/auth/login', { username: u.username, password: PASSWORD })).json()).toEqual({
      stage: 'enroll',
    });
    await a.me();
    expect((await a.get('/api/documents')).statusCode).toBe(403);
    const begin = await a.post('/api/account/totp/begin', {});
    const { secret } = begin.json() as { secret: string };
    const { base32Decode } = await import('../src/security/crypto.js');
    const code = hotp(base32Decode(secret), Math.floor(Date.now() / 30000));
    const conf = await a.post('/api/account/totp/confirm', { code });
    expect(conf.json()).toEqual({ stage: 'ok' });
    await a.me();
    expect((await a.get('/api/documents')).statusCode).toBe(200);
  });
});

describe('protection CSRF et contrôle d’origine', () => {
  it('refuse une requête modifiante sans jeton CSRF', async () => {
    const a = await login(t, rw);
    const r = await a.req('POST', '/api/links', { json: { url: 'https://exemple.invalid' }, csrf: false });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/CSRF/);
  });

  it('refuse un jeton CSRF d’une autre session', async () => {
    const a = await login(t, rw);
    const b = await login(t, admin);
    const r = await a.req('POST', '/api/links', {
      json: { url: 'https://exemple.invalid' },
      headers: { 'x-csrf-token': b.csrf! },
    });
    expect(r.statusCode).toBe(403);
  });

  it('refuse une origine étrangère, même avec le bon jeton', async () => {
    const a = await login(t, rw);
    const r = await a.req('POST', '/api/links', {
      json: { url: 'https://exemple.invalid' },
      headers: { origin: 'https://attaquant.example' },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/Origine/);
  });

  it('refuse une requête modifiante sans session', async () => {
    const r = await new Agent(t).post('/api/links', { url: 'https://exemple.invalid' });
    expect(r.statusCode).toBe(401);
  });

  it('accepte la même requête légitime', async () => {
    const a = await login(t, rw);
    expect((await a.post('/api/links', { url: 'https://exemple.invalid/ok' })).statusCode).toBe(201);
  });
});

describe('rôles', () => {
  it('lecture seule : consultation possible, aucune écriture', async () => {
    const a = await login(t, ro);
    expect((await a.get('/api/documents')).statusCode).toBe(200);
    expect((await a.post('/api/links', { url: 'https://exemple.invalid' })).statusCode).toBe(403);
    expect(
      (await a.req('POST', '/api/documents', { body: Buffer.from('x'), headers: { 'x-file-name': 'a.txt' } }))
        .statusCode,
    ).toBe(403);
    expect((await a.get('/api/documents?trash=1')).statusCode).toBe(403);
    expect((await a.get('/api/admin/users')).statusCode).toBe(403);
  });

  it('lecture et écriture : pas d’administration', async () => {
    const a = await login(t, rw);
    expect((await a.get('/api/admin/users')).statusCode).toBe(403);
    expect((await a.get('/api/admin/audit')).statusCode).toBe(403);
    expect((await a.get('/api/admin/export/legacy')).statusCode).toBe(403);
  });

  it('administrateur : accès à l’administration', async () => {
    const a = await login(t, admin);
    expect((await a.get('/api/admin/users')).statusCode).toBe(200);
  });

  it('un administrateur ne peut pas modifier ses propres droits', async () => {
    const a = await login(t, admin);
    const u = await a.get(`/api/admin/users/${admin.id}`);
    const r = await a.patch(
      `/api/admin/users/${admin.id}`,
      { roles: [{ roleId: 'contributeur' }] },
      { 'if-match': u.headers.etag as string },
    );
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/propres droits/);
  });
});

describe('verrouillage après échecs', () => {
  it('verrouille après 5 échecs, même avec le bon mot de passe ensuite', async () => {
    const u = await makeUser(t, 'cible', 'rw');
    const a = new Agent(t);
    for (let i = 0; i < 4; i++)
      expect((await a.post('/api/auth/login', { username: u.username, password: 'mauvais' })).statusCode).toBe(401);
    expect((await a.post('/api/auth/login', { username: u.username, password: 'mauvais' })).statusCode).toBe(423);
    expect((await a.post('/api/auth/login', { username: u.username, password: PASSWORD })).statusCode).toBe(423);
    t.svc.limits.loginByUser.reset();
    t.svc.limits.loginByIp.reset();
  });

  it('limite le débit des tentatives par compte', async () => {
    const a = new Agent(t);
    let last = 0;
    for (let i = 0; i < 11; i++)
      last = (await a.post('/api/auth/login', { username: 'inconnu', password: 'x' })).statusCode;
    expect(last).toBe(429);
    t.svc.limits.loginByUser.reset();
    t.svc.limits.loginByIp.reset();
  });
});

describe('jeton d’installation', () => {
  it('format XXXXX-XXXXX-XXXXX-XXXXX, usage unique, erreurs explicites', async () => {
    const t2 = await createTestApp();
    try {
      const out: string[] = [];
      const first = await t2.svc.auth.issueSetupToken('first_start', (s) => out.push(s));
      expect(first.token).toMatch(/^[A-HJKMNP-Z2-9]{5}(-[A-HJKMNP-Z2-9]{5}){3}$/);
      expect(out.join('')).toMatch(/JETON D'INSTALLATION[\s\S]*Expire le[\s\S]*docker compose exec app setup-token/);
      const { token } = await t2.svc.auth.issueSetupToken('cli', () => {});
      const a = new Agent(t2);
      expect((await a.get('/setup-inexistant')).statusCode).toBe(404);
      const body = (tok: string, username = 'chef') => ({ token: tok, username, password: PASSWORD });
      const old = await a.post('/api/setup', body(first.token));
      expect(old.statusCode).toBe(401);
      expect(old.json().reason).toBe('invalid');
      const loose = token.toLowerCase().replace(/-/g, ' ');
      expect((await a.post('/api/setup', body(loose))).statusCode).toBe(201);
      const again = await new Agent(t2).post('/api/setup', body(token, 'autre'));
      expect(again.statusCode).toBe(409);
      expect(again.json().reason).toBe('used');
      expect(
        (await t2.svc.db.one<{ v: string }>("SELECT value::text AS v FROM settings WHERE key='setup_token'"))!.v,
      ).not.toContain(token);
    } finally {
      await t2.close();
    }
  });

  it('jeton expiré : 410 avec un message clair', async () => {
    const t2 = await createTestApp();
    try {
      const { token } = await t2.svc.auth.issueSetupToken('cli', () => {});
      await t2.svc.db.q(
        "UPDATE settings SET value = jsonb_set(value, '{expires}', '\"2020-01-01T00:00:00Z\"') WHERE key='setup_token'",
      );
      const r = await new Agent(t2).post('/api/setup', { token, username: 'chef', password: PASSWORD });
      expect(r.statusCode).toBe(410);
      expect(r.json().error).toMatch(/expiré.*setup-token/);
      expect((await new Agent(t2).get('/api/setup')).json()).toMatchObject({
        needed: true,
        pending: false,
        adminExists: false,
      });
    } finally {
      await t2.close();
    }
  });
});

describe('journal d’audit', () => {
  it('est en ajout seul (modification et suppression refusées par la base)', async () => {
    await expect(t.svc.db.q('DELETE FROM audit_log')).rejects.toThrow(/ajout seul/);
    await expect(t.svc.db.q("UPDATE audit_log SET action='x'")).rejects.toThrow(/ajout seul/);
  });

  it('trace les connexions et les échecs', async () => {
    const r = await t.svc.db.q<{ action: string }>("SELECT DISTINCT action FROM audit_log WHERE action LIKE 'auth.%'");
    const actions = r.rows.map((x) => x.action);
    expect(actions).toEqual(
      expect.arrayContaining(['auth.login', 'auth.login_failed', 'auth.mfa_failed', 'auth.password_ok']),
    );
  });

  it('export CSV réservé aux administrateurs, neutralise les formules', async () => {
    await t.svc.db.audit({ username: '=CMD()' }, null, 'test.csv');
    const a = await login(t, admin);
    const r = await a.get('/api/admin/audit?format=csv');
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.body).toContain(`"'=CMD()"`);
  });
});

describe('OpenAPI', () => {
  it('décrit les routes avec leur niveau d’accès', async () => {
    const a = await login(t, rw);
    const doc = (await a.get('/api/openapi.json')).json();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/api/documents/{id}'].patch['x-access']).toBe('documents:modifier');
    expect(doc.paths['/api/admin/import/simulate'].post['x-access']).toBe('import_export:modifier');
    expect(doc.paths['/api/admin/roles/{id}'].patch['x-access']).toBe('administration:administrer');
    expect(doc.paths['/api/auth/login'].post.requestBody).toBeTruthy();
  });
});
