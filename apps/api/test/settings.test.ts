/* Page Paramètres : sections, versions, permissions, politique de sécurité appliquée, cycle d'audit, logo. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, PASSWORD, type Agent, type TestApp } from './helpers.js';

let t: TestApp;
let A: Agent;
beforeAll(async () => {
  t = await createTestApp();
  A = await login(t, await makeUser(t, 'admin', 'admin'));
});
afterAll(() => t.close());

const section = async (a: Agent, s: string) => {
  const r = await a.get(`/api/settings/${s}`);
  return { ...r.json(), etag: r.headers.etag as string };
};

describe('paramètres', () => {
  it('huit sections, valeurs par défaut issues de la configuration', async () => {
    const r = await A.get('/api/settings');
    expect(r.statusCode).toBe(200);
    expect(r.json().map((x: { section: string }) => x.section)).toEqual([
      'general',
      'cycle',
      'referentiels',
      'apparence',
      'notifications',
      'import_export',
      'sauvegardes',
      'securite',
    ]);
    const g = await section(A, 'general');
    expect(g.values.appName).toBe('Suivi des audits SMSI');
    expect(g.version).toBe(0);
    expect(g.canWrite).toBe(true);
    const ref = await section(A, 'referentiels');
    expect(ref.info.referentiels[1].exigences).toBeGreaterThan(90); // Annexe A
  });

  it('enregistrement par section avec contrôle de version, appliqué immédiatement et journalisé', async () => {
    const g = await section(A, 'general');
    const body = { ...g.values, orgName: 'Organisation de test' };
    const r = await A.put('/api/settings/general', body, { 'if-match': g.etag });
    expect(r.statusCode).toBe(200);
    expect(r.json().version).toBe(1);
    expect((await A.get('/api/auth/me')).json().orgName).toBe('Organisation de test');
    // Même version qu'avant : quelqu'un a enregistré entre-temps.
    const stale = await A.put('/api/settings/general', body, { 'if-match': g.etag });
    expect(stale.statusCode).toBe(412);
    expect(stale.json().current.version).toBe(1);
    const log = await t.svc.db.one<{ details: { before: { orgName: string }; after: { orgName: string } } }>(
      "SELECT details FROM audit_log WHERE action = 'settings.update' ORDER BY id DESC LIMIT 1",
    );
    expect(log!.details.before.orgName).not.toBe('Organisation de test');
    expect(log!.details.after.orgName).toBe('Organisation de test');
    // Validation.
    const bad = await A.put('/api/settings/general', { ...body, email: 'pas-une-adresse' }, { 'if-match': '"1"' });
    expect(bad.statusCode).toBe(422);
  });

  it('style global : « sage » par défaut, partagé par tous les comptes, réservé à la permission d’écriture', async () => {
    const reader = await login(t, await makeUser(t, 'style_reader', 'ro'));
    expect((await reader.get('/api/auth/me')).json().appearance.style).toBe('sage');
    const s = await section(A, 'apparence');
    expect(s.values.style).toBe('sage');
    const clair = await A.put('/api/settings/apparence', { ...s.values, style: 'clair' }, { 'if-match': s.etag });
    expect(clair.statusCode, clair.body).toBe(200);
    expect((await reader.get('/api/auth/me')).json().appearance.style).toBe('clair');
    const invalide = await A.put('/api/settings/apparence', { ...s.values, style: 'rose' }, { 'if-match': '"1"' });
    expect(invalide.statusCode).toBe(422);
    const refus = await reader.put('/api/settings/apparence', { ...s.values, style: 'sage' }, { 'if-match': '"1"' });
    expect(refus.statusCode).toBe(403);
    expect((await reader.get('/api/auth/me')).json().appearance.style).toBe('clair');
    // Un ancien enregistrement sans style reste lisible : « sage ».
    await t.svc.db.q(
      "UPDATE settings SET value = jsonb_set(value, '{values}', (value->'values') - 'style') WHERE key = 'section:apparence'",
    );
    await t.svc.settings.load();
    expect(t.svc.settings.get('apparence').style).toBe('sage');
  });

  it('politique de sécurité : bornes non négociables, appliquée aux mots de passe', async () => {
    const s = await section(A, 'securite');
    expect(
      (await A.put('/api/settings/securite', { ...s.values, passwordMinLength: 8 }, { 'if-match': s.etag })).statusCode,
    ).toBe(422);
    expect(
      (await A.put('/api/settings/securite', { ...s.values, mfaRequired: false }, { 'if-match': s.etag })).statusCode,
    ).toBe(422);
    const ok = await A.put('/api/settings/securite', { ...s.values, passwordMinLength: 16 }, { 'if-match': s.etag });
    expect(ok.statusCode).toBe(200);
    expect((await A.get('/api/auth/me')).json().passwordMinLength).toBe(16);
    const r = await A.post('/api/account/password', { current: PASSWORD, next: 'Court-mais-12ch' });
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toMatch(/16 caractères/);
  });

  it('permissions : lecture « parametres:lire », sécurité réservée à « parametres:administrer »', async () => {
    await t.svc.db.q(
      "INSERT INTO roles(id, name, permissions) VALUES ('r_param', 'Paramètres', '{parametres:lire,parametres:modifier}')",
    );
    const p = await login(t, await makeUser(t, 'param', 'r_param'));
    const s = await section(p, 'securite');
    expect(s.canWrite).toBe(false);
    expect((await p.put('/api/settings/securite', s.values, { 'if-match': s.etag })).statusCode).toBe(403);
    const n = await section(p, 'notifications');
    expect((await p.put('/api/settings/notifications', n.values, { 'if-match': n.etag })).statusCode).toBe(200);
    // Le cycle d'audit écrit dans le module audit : il faut aussi audit:modifier.
    const c = await section(p, 'cycle');
    expect(c.canWrite).toBe(false);
    expect((await p.put('/api/settings/cycle', c.values, { 'if-match': c.etag })).statusCode).toBe(403);
    const l = await login(t, await makeUser(t, 'lect', 'lecteur'));
    expect((await l.get('/api/settings')).statusCode).toBe(403);
  });

  it('cycle d’audit : enregistré dans l’état de l’outil historique', async () => {
    const c = await section(A, 'cycle');
    const r = await A.put(
      '/api/settings/cycle',
      { ...c.values, years: [2026, 2027, 2028], nextYear: 2027, nextDate: '2027-03-15' },
      { 'if-match': c.etag },
    );
    expect(r.statusCode).toBe(200);
    const st = (await A.get('/api/legacy/state')).json();
    expect(st.years).toEqual([2026, 2027, 2028]);
    expect(st.nextDate).toBe('2027-03-15');
  });

  it('logo : PNG ou JPEG uniquement, servi publiquement', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    expect((await A.req('PUT', '/api/settings/logo', { body: Buffer.from('<svg/>') })).statusCode).toBe(422);
    expect((await A.req('PUT', '/api/settings/logo', { body: png })).statusCode).toBe(204);
    const r = await t.app.inject({ method: 'GET', url: '/api/settings/logo' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect((await section(A, 'general')).info.logo).toBe(true);
  });
});
