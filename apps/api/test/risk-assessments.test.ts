import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { environmentDefaults, type AssessmentIntent } from '@suivi/shared';
import { Agent, createTestApp, login, makeUser, PASSWORD, type TestApp } from './helpers.js';
let t: TestApp, admin: Agent;
const root = '/api/ia/evaluations',
  id = 'B2-QA-IA',
  path = `${root}/${id}`;
const source = {
  id,
  domain: 'Recette',
  scenario: 'Source conservée',
  app: 'Applicable',
  c: 5,
  i: 4,
  a: 3,
  audit: 2,
  patient: 1,
  prob: 4,
  maturity: 1,
  effort: 3,
  dscp: 'Oui',
  unknown: { deep: ['b', 'a'] },
};
const ratings = { impact: 'impact_5', probability: 'probability_4', maturity: 'maturity_1' };
async function sources(evals: unknown[]) {
  const state = (await admin.get('/api/legacy/state')).json();
  const r = await admin.put(
    '/api/legacy/state',
    { ...state, ai: { ...state.ai, evals } },
    { 'if-match': (await admin.get('/api/legacy/state')).headers.etag as string },
  );
  expect(r.statusCode).toBe(204);
}
async function intent(): Promise<AssessmentIntent> {
  const d = (await admin.get(path)).json();
  return { sourceSha: d.sourceSha, configurationVersion: 1, ratings };
}
async function candidate() {
  const i = await intent();
  const r = await admin.post(`${path}/preview`, i);
  expect(r.statusCode).toBe(200);
  const p = r.json();
  return {
    body: {
      requestId: crypto.randomUUID(),
      intent: i,
      previewId: p.previewId,
      rationale: 'Revue explicite du scénario',
      confirm: 'ENREGISTRER',
    },
    revision: p.revision,
  };
}
const publish = (c: Awaited<ReturnType<typeof candidate>>, agent = admin) =>
  agent.post(`${path}/assessments`, c.body, { 'if-match': `"${c.revision}"` });
beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'assessment_admin', 'admin'));
  await sources([source]);
});
afterAll(() => t.close());
describe('décisions IA immuables liées à une source existante', () => {
  it('simule sans écriture puis conserve source, méthode, résultat et audit sans modifier le registre', async () => {
    const before = await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1');
    const c = await candidate();
    expect((await admin.get(`${path}/history`)).json().items).toEqual([]);
    const r = await publish(c);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      sourceId: id,
      revision: 1,
      sourceSnapshot: source,
      configuration: { version: 1 },
      ratings,
      result: { initial: 20, residual: 16 },
      createdBy: 'assessment_admin',
    });
    expect(await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1')).toEqual(before);
    expect(await t.svc.db.one("SELECT action FROM audit_log WHERE action='risk.assessment.created'")).toBeTruthy();
    expect(
      (await admin.get(root)).json().items.find((x: { id: string }) => x.id === id).lastAssessment.sourceSnapshot,
    ).toBeUndefined();
  });
  it('réessaie une demande identique sans créer de doublon ; interdit sa réutilisation', async () => {
    const c = await candidate();
    const first = await publish(c),
      again = await publish(c);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    const otherAuthor = await login(t, await makeUser(t, 'assessment_other_author', 'admin'));
    expect((await publish(c, otherAuthor)).statusCode).toBe(409);
    const other = { ...c, body: { ...c.body, rationale: 'Autre justification' } };
    expect((await publish(other)).statusCode).toBe(409);
    expect((await admin.get(`${path}/history`)).json().items).toHaveLength(2);
  });
  it('les publications concurrentes ne peuvent pas écraser une décision', async () => {
    const a = await candidate(),
      b = await candidate();
    const out = await Promise.all([publish(a), publish(b)]);
    expect(out.map((r) => r.statusCode).sort()).toEqual([200, 412]);
  });
  it('rejette précondition absente, résultat injecté, simulation altérée et niveaux étrangers', async () => {
    const c = await candidate();
    expect((await admin.post(`${path}/assessments`, c.body)).statusCode).toBe(428);
    expect(
      (
        await admin.post(
          `${path}/assessments`,
          { ...c.body, result: { residual: 0 } },
          { 'if-match': `"${c.revision}"` },
        )
      ).statusCode,
    ).toBe(422);
    expect((await publish({ ...c, body: { ...c.body, previewId: 'a'.repeat(64) } })).statusCode).toBe(422);
    expect(
      (await admin.post(`${path}/preview`, { ...c.body.intent, ratings: { ...ratings, impact: 'absent' } })).statusCode,
    ).toBe(422);
  });
  it('détecte toute modification source, y compris ordre des tableaux et clés inconnues', async () => {
    const c = await candidate();
    await sources([{ ...source, unknown: { deep: ['a', 'b'] } }]);
    expect((await publish(c)).statusCode).toBe(412);
    const newer = await candidate();
    await sources([{ ...source, unknown: JSON.parse('{"deep":["a","b"],"extra":{"marker":true}}') }]);
    expect((await publish(newer)).statusCode).toBe(412);
    await sources([source]);
  });
  it('un changement de configuration ne recalcule pas le passé et permet une version ancienne explicite', async () => {
    const previous = (await admin.get(`${path}/history`)).json();
    const definition = {
      ...environmentDefaults(),
      name: 'Calcul par somme',
      calculation: { method: 'sum', ceiling: 25, cells: [] },
    };
    const p = (await admin.post('/api/admin/environment/preview', { definition, example: ratings })).json();
    expect(
      (
        await admin.put(
          '/api/admin/environment',
          { definition, previewId: p.previewId, reason: 'Revue de la méthode', confirm: 'PUBLIER' },
          { 'if-match': `"${p.version}"` },
        )
      ).statusCode,
    ).toBe(200);
    expect((await admin.get(`${path}/history`)).json()).toEqual(previous);
    const c = await candidate();
    expect((await publish(c)).json().configuration.version).toBe(1);
    const i = { ...(await intent()), configurationVersion: 2 };
    expect((await admin.post(`${path}/preview`, i)).json().result.residual).toBe(7.2);
  });
  it('une défaillance d’audit annule aussi la décision', async () => {
    const c = await candidate(),
      before = (await admin.get(`${path}/history`)).json();
    const spy = vi.spyOn(t.svc.db, 'audit').mockRejectedValueOnce(new Error('audit indisponible'));
    try {
      expect((await publish(c)).statusCode).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect((await admin.get(`${path}/history`)).json()).toEqual(before);
    expect((await publish(c)).statusCode).toBe(200);
  });
  it('conserve les historiques et exports après retrait de la source ; décisions non modifiables', async () => {
    const before = (await admin.get(`${path}/history`)).json();
    await sources([]);
    expect((await admin.get(`${path}/history`)).json()).toEqual(before);
    expect((await admin.get(path)).json()).toMatchObject({ source: null, sourceSha: null });
    expect((await admin.get(`${path}/export`)).json().assessments).toEqual(before.items);
    expect((await admin.get(root)).json().items.find((x: { id: string }) => x.id === id).sourcePresent).toBe(false);
    await expect(t.svc.db.q("UPDATE risk_assessments SET rationale='modification interdite'")).rejects.toThrow();
    await expect(t.svc.db.q('DELETE FROM risk_assessments')).rejects.toThrow();
    await expect(t.svc.db.q('TRUNCATE risk_assessments')).rejects.toThrow();
    await sources([source]);
  });
  it('refuse source absente, ambiguë, conditionnelle ou trop volumineuse ; historique paginé', async () => {
    const c = await candidate();
    await sources([]);
    expect((await publish(c)).statusCode).toBe(404);
    await sources([source, { ...source, scenario: 'Doublon' }]);
    expect((await admin.post(`${path}/preview`, c.body.intent)).statusCode).toBe(409);
    expect((await admin.get(path)).json().ambiguous).toBe(true);
    await sources([{ ...source, app: 'Conditionnel à confirmer' }]);
    expect((await admin.post(`${path}/preview`, await intent())).statusCode).toBe(409);
    await sources([{ ...source, large: 'x'.repeat(270000) }]);
    expect((await admin.post(`${path}/preview`, await intent())).statusCode).toBe(413);
    await sources([source]);
    const first = (await admin.get(`${path}/history?limit=2`)).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextBefore).toBeGreaterThan(0);
    const next = (await admin.get(`${path}/history?limit=2&before=${first.nextBefore}`)).json();
    expect(next.items.every((x: { revision: number }) => x.revision < first.nextBefore)).toBe(true);
    expect((await admin.get(`${root}/absent/history`)).statusCode).toBe(404);
  });
  it('désactiver IA ferme ses commandes ; désactiver import/export ferme l’export sans effacer les décisions', async () => {
    const before = (await admin.get(`${path}/history`)).json();
    const c = await candidate();
    await t.svc.db.q("UPDATE module_activation SET disabled=ARRAY['ia'],version=version+1 WHERE id=1");
    try {
      expect((await admin.get(path)).statusCode).toBe(409);
      expect((await publish(c)).statusCode).toBe(409);
      expect((await admin.get(`${path}/export`)).statusCode).toBe(409);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled='{}',version=version+1 WHERE id=1");
    }
    expect((await admin.get(`${path}/history`)).json()).toEqual(before);
    await t.svc.db.q("UPDATE module_activation SET disabled=ARRAY['import_export'],version=version+1 WHERE id=1");
    try {
      expect((await admin.get(path)).statusCode).toBe(200);
      expect((await admin.get(`${path}/export`)).statusCode).toBe(409);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled='{}',version=version+1 WHERE id=1");
    }
  });
  it('permissions, MFA, CSRF et origine sont vérifiés sur le serveur', async () => {
    await t.svc.db.q(
      "INSERT INTO roles(id,name,permissions) VALUES ('ia_read','Lecture IA','{ia:lire}'),('ia_export','Export IA seul','{ia:lire,ia:exporter}')",
    );
    const reader = await login(t, await makeUser(t, 'assessment_reader', 'ia_read'));
    expect((await reader.get(path)).statusCode).toBe(200);
    expect((await reader.get(`${root}/configurations`)).statusCode).toBe(200);
    expect((await reader.get('/api/admin/environment')).statusCode).toBe(403);
    const c = await candidate();
    expect((await publish(c, reader)).statusCode).toBe(403);
    expect((await reader.post(`${path}/preview`, c.body.intent)).statusCode).toBe(403);
    expect((await reader.get(`${path}/export`)).statusCode).toBe(403);
    const exporter = await login(t, await makeUser(t, 'assessment_exporter', 'ia_export'));
    expect((await exporter.get(`${path}/export`)).statusCode).toBe(403);
    const noCsrf = new Agent(t);
    noCsrf.cookies = new Map(admin.cookies);
    expect((await publish(c, noCsrf)).statusCode).toBe(403);
    const foreign = new Agent(t, 'https://foreign.invalid');
    foreign.cookies = new Map(admin.cookies);
    foreign.csrf = admin.csrf;
    expect((await publish(c, foreign)).statusCode).toBe(403);
    await makeUser(t, 'assessment_pending', 'admin');
    const pending = new Agent(t);
    await pending.post('/api/auth/login', { username: 'assessment_pending', password: PASSWORD });
    expect((await pending.get(path)).statusCode).toBe(403);
    const denied = await login(t, await makeUser(t, 'assessment_plain', 'lecteur'));
    // Le rôle lecteur général peut consulter IA ; aucune commande de modification.
    expect((await denied.post(`${path}/preview`, c.body.intent)).statusCode).toBe(403);
  });
});
