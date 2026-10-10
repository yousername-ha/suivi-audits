import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { calculateRisk, environmentDefaults } from '@suivi/shared';
import { createTestApp, login, makeUser, Agent, PASSWORD, type TestApp } from './helpers.js';
let t: TestApp, admin: Agent;
const url = '/api/admin/environment';
const example = { impact: 'impact_5', probability: 'probability_4', maturity: 'maturity_1' };
beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'environment_admin', 'admin'));
});
afterAll(() => t.close());
const changed = (name: string) => ({ ...environmentDefaults(), name });
const preview = async (definition = changed('Configuration révisée')) =>
  (await admin.post(`${url}/preview`, { definition, example })).json();
const publish = async (definition: unknown, p: { version: number; previewId: string }) =>
  admin.put(
    url,
    { definition, previewId: p.previewId, reason: 'Revue de la méthode de risque', confirm: 'PUBLIER' },
    { 'if-match': `"${p.version}"` },
  );
describe('configuration immuable et publication administrative', () => {
  it('initialise une seule fois sans toucher au socle ni à ses paramètres existants', async () => {
    const before = await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1');
    await t.svc.environment.initialize();
    await t.svc.environment.initialize();
    const r = await admin.get(url);
    expect(r.statusCode).toBe(200);
    expect(r.headers.etag).toBe('"1"');
    expect(r.json().definition).toEqual(environmentDefaults());
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM environment_versions'))!.n).toBe(1);
    expect(await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1')).toEqual(before);
  });
  it('prévisualise sans écriture et détecte une définition identique malgré l’ordre JSONB', async () => {
    const p = await preview(environmentDefaults());
    expect(p.changed).toBe(false);
    expect(p.calculation).toMatchObject({ initial: 20, residual: 16 });
    expect((await publish(environmentDefaults(), p)).statusCode).toBe(422);
    expect((await admin.get(`${url}/history`)).json()).toHaveLength(1);
  });
  it('publication confirmée, audit atomique et versions passées consultables', async () => {
    const before = (await admin.get(`${url}/versions/1`)).json();
    const d = changed('Méthode organisationnelle révisée');
    d.calculation.method = 'sum';
    const legacyBefore = await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1');
    const p = await preview(d);
    expect(p.changed).toBe(true);
    const r = await publish(d, p);
    expect(r.statusCode).toBe(200);
    expect(r.json().version).toBe(2);
    expect((await admin.get(`${url}/versions/1`)).json()).toEqual(before);
    expect(calculateRisk(before.definition, example).residual).toBe(16);
    expect(calculateRisk(r.json().definition, example).residual).toBe(7.2);
    expect(await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1')).toEqual(legacyBefore);
    const audit = await t.svc.db.one<{ details: { version: number; previousVersion: number } }>(
      "SELECT details FROM audit_log WHERE action='environment.publish' ORDER BY id DESC LIMIT 1",
    );
    expect(audit!.details).toMatchObject({ version: 2, previousVersion: 1 });
    expect((await admin.get(`${url}/versions/9999`)).statusCode).toBe(404);
  });
  it('refuse confirmation manquante, empreinte altérée, ancien ETag et absence de précondition', async () => {
    const d = changed('Méthode candidate'),
      p = await preview(d);
    expect(
      (
        await admin.put(
          url,
          { definition: d, previewId: p.previewId, reason: 'raison', confirm: 'NON' },
          { 'if-match': `"${p.version}"` },
        )
      ).statusCode,
    ).toBe(422);
    expect((await publish({ ...d, name: 'Changement après simulation' }, p)).statusCode).toBe(422);
    expect(
      (await admin.put(url, { definition: d, previewId: p.previewId, reason: 'raison', confirm: 'PUBLIER' }))
        .statusCode,
    ).toBe(428);
    expect((await publish(d, { ...p, version: 1 })).statusCode).toBe(412);
  });
  it('deux publications concurrentes ne peuvent pas remplacer leurs modifications', async () => {
    const a = changed('Publication concurrente A'),
      b = changed('Publication concurrente B');
    const pa = await preview(a),
      pb = await preview(b);
    const results = await Promise.all([publish(a, pa), publish(b, pb)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 412]);
    expect((await admin.get(url)).json().version).toBe(3);
  });
  it('une reprise de version ancienne crée une nouvelle version sans réécrire le passé', async () => {
    const initial = (await admin.get(`${url}/versions/1`)).json();
    const p = await preview(initial.definition);
    expect((await publish(initial.definition, p)).json().version).toBe(4);
    expect((await admin.get(`${url}/versions/1`)).json()).toEqual(initial);
    await expect(t.svc.db.q("UPDATE environment_versions SET reason='altérée' WHERE version=1")).rejects.toThrow();
    await expect(t.svc.db.q('DELETE FROM environment_versions WHERE version=2')).rejects.toThrow();
    await expect(t.svc.db.q('TRUNCATE environment_versions CASCADE')).rejects.toThrow();
  });
  it('une défaillance d’audit annule aussi la version et le pointeur courant', async () => {
    const d = changed('Publication à annuler'),
      p = await preview(d);
    const audit = vi.spyOn(t.svc.db, 'audit').mockRejectedValueOnce(new Error('audit indisponible'));
    try {
      expect((await publish(d, p)).statusCode).toBe(500);
    } finally {
      audit.mockRestore();
    }
    expect((await admin.get(url)).json().version).toBe(4);
    expect((await admin.get(`${url}/versions/5`)).statusCode).toBe(404);
  });
  it('permissions, MFA, origine et CSRF sont contrôlés côté serveur', async () => {
    await t.svc.db.q(
      "INSERT INTO roles(id,name,permissions) VALUES ('environment_read','Consultation configuration','{administration:lire}')",
    );
    const reader = await login(t, await makeUser(t, 'environment_reader', 'environment_read'));
    expect((await reader.get(url)).statusCode).toBe(200);
    expect((await reader.post(`${url}/preview`, { definition: changed('Refus'), example })).statusCode).toBe(403);
    const nonadmin = await login(t, await makeUser(t, 'environment_plain', 'lecteur'));
    expect((await nonadmin.get(url)).statusCode).toBe(403);
    const noCsrf = new Agent(t);
    noCsrf.cookies = new Map(admin.cookies);
    expect((await noCsrf.post(`${url}/preview`, { definition: changed('Refus'), example })).statusCode).toBe(403);
    const foreign = new Agent(t, 'https://foreign.invalid');
    foreign.cookies = new Map(admin.cookies);
    foreign.csrf = admin.csrf;
    expect((await foreign.post(`${url}/preview`, { definition: changed('Refus'), example })).statusCode).toBe(403);
    await makeUser(t, 'environment_pending', 'admin');
    const pending = new Agent(t);
    await pending.post('/api/auth/login', { username: 'environment_pending', password: PASSWORD });
    expect((await pending.get(url)).statusCode).toBe(403);
  });
  it('rejette règles arbitraires et matrice incomplète, sans publication', async () => {
    const d = changed('Refus');
    expect(
      (
        await admin.post(`${url}/preview`, {
          definition: { ...d, calculation: { ...d.calculation, method: 'eval' } },
          example,
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (
        await admin.post(`${url}/preview`, {
          definition: { ...d, calculation: { ...d.calculation, method: 'matrix' } },
          example,
        })
      ).statusCode,
    ).toBe(422);
    expect((await admin.get(url)).json().version).toBe(4);
  });
});
