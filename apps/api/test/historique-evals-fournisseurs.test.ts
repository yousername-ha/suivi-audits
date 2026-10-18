/* Reprise des évaluations de sécurité des fournisseurs par le clausier (clé `supEvals`) : écritures natives sous verrou,
   points applicables selon les chapitres cochés, note indicative, action des écarts avec le droit des écarts. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent, sansEcarts: Agent;
const etat = async () => (await admin.get('/api/suivi/etat')).json();
let ev = '';

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ec_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'ec_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'ec_writer', 'rw'));
  sansEcarts = await login(t, await makeUser(t, 'ec_sans_ecarts', null, { modules: ['fournisseurs'] }));
  const cur = await admin.get('/api/suivi/etat');
  const s = cur.json();
  s.suppliers = [{ id: 'SUP-1', name: 'Fournisseur fictif', hds: 'Oui', mfa: 'Oui', sso: 'SAML' }];
  s.items = [
    { id: 'A-5.19', ref: 'A', num: '5.19', title: 'Exigence fictive', group: 'G', depth: 0, afnor: {}, interne: {} },
  ];
  s.findings = [];
  s.supEvals = [{ id: 'EVAL-ancienne', supplier: 'SUP-1', cases: [], ans: {}, inconnu: { x: 1 } }];
  await seedState(t, s);
});
afterAll(() => t.close());

describe('évaluations par le clausier', () => {
  it('liste les évaluations notées, les fournisseurs et la source du clausier', async () => {
    const r = await reader.get('/api/evaluations-clausier');
    expect(r.statusCode).toBe(200);
    expect(r.json().clausier.source).toContain('CC BY-NC-SA 4.0');
    expect(r.json().fournisseurs[0]).toMatchObject({ id: 'SUP-1', mfa: 'Oui', sso: 'SAML', certificats: 'À fournir' });
    expect(r.json().evaluations[0]).toMatchObject({ id: 'EVAL-ancienne', score: { pc: null, note: '–', done: 0 } });
    expect(r.json().evaluations[0].score.n).toBeGreaterThan(50);
    expect(
      (await (await login(t, await makeUser(t, 'ec_sans', null))).get('/api/evaluations-clausier')).statusCode,
    ).toBe(403);
  });
  it('crée une évaluation avec les valeurs de l’outil historique', async () => {
    expect((await reader.post('/api/evaluations-clausier', {})).statusCode).toBe(403);
    expect((await writer.post('/api/evaluations-clausier', { supplier: 'X' })).statusCode).toBe(422);
    const r = await writer.post('/api/evaluations-clausier', {});
    expect(r.statusCode, r.body).toBe(201);
    ev = r.json().id;
    expect(r.json()).toMatchObject({ supplier: 'SUP-1', cases: ['rgpd'], product: '' });
    expect((await etat()).supEvals.find((x: { id: string }) => x.id === ev).grid).toBe('2026');
  });
  it('les chapitres cochés ajoutent des points', async () => {
    const avant = (await writer.get(`/api/evaluations-clausier/${ev}`)).json();
    const r = await writer.patch(`/api/evaluations-clausier/${ev}`, {
      cases: ['rgpd', 'cloud', 'ia'],
      product: 'Produit fictif',
      date: '2026-10-14',
    });
    expect(r.statusCode, r.body).toBe(200);
    const apres = (await writer.get(`/api/evaluations-clausier/${ev}`)).json();
    expect(apres.points.length).toBeGreaterThan(avant.points.length);
    expect(apres.points.some((p: { chapitre: string }) => p.chapitre === '12.3')).toBe(true);
    expect(apres.points.every((p: { id: string }) => !['O-3.6', 'O-3.9'].includes(p.id))).toBe(true);
    expect((await writer.patch(`/api/evaluations-clausier/${ev}`, { cases: ['inconnu'] })).statusCode).toBe(422);
    expect((await writer.patch(`/api/evaluations-clausier/${ev}`, { supplier: 'X' })).statusCode).toBe(422);
  });
  it('enregistre l’état et la réponse d’un point, la note suit', async () => {
    const pts = (await writer.get(`/api/evaluations-clausier/${ev}`)).json().points as { id: string }[];
    const [a, b, c] = pts;
    expect(
      (await writer.put(`/api/evaluations-clausier/${ev}/points/${a!.id}`, { st: 'Conforme', c: 'Preuve fictive' }))
        .statusCode,
    ).toBe(200);
    expect((await writer.put(`/api/evaluations-clausier/${ev}/points/${b!.id}`, { st: 'Partiel' })).statusCode).toBe(
      200,
    );
    const r = await writer.put(`/api/evaluations-clausier/${ev}/points/${c!.id}`, { st: 'Non conforme' });
    expect(r.json().score).toMatchObject({ done: 3, pc: 50, note: 'D', nc: 1, pa: 1 });
    expect((await etat()).supEvals.find((x: { id: string }) => x.id === ev).ans[a!.id]).toEqual({
      st: 'Conforme',
      c: 'Preuve fictive',
    });
    expect((await writer.put(`/api/evaluations-clausier/${ev}/points/O-99.9`, { st: 'Conforme' })).statusCode).toBe(
      404,
    );
    expect((await writer.put(`/api/evaluations-clausier/${ev}/points/${a!.id}`, { st: 'Autre' })).statusCode).toBe(422);
  });
  it('crée l’action des écarts avec le droit des écarts, une tâche par point', async () => {
    expect((await sansEcarts.post(`/api/evaluations-clausier/${ev}/action`)).statusCode).toBe(403);
    const r = await writer.post(`/api/evaluations-clausier/${ev}/action`);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ action: 'FOU-01', taches: 2 });
    const f = (await etat()).findings[0];
    expect(f).toMatchObject({ id: 'FOU-01', source: 'Fournisseur', type: 'PP', comment: ev, items: ['A-5.19'] });
    expect(f.tasks).toHaveLength(2);
    expect(f.tasks[0].t).toMatch(/^Clausier O-/);
    expect((await writer.post('/api/evaluations-clausier/EVAL-ancienne/action')).statusCode).toBe(409);
  });
  it('conserve les champs inconnus et supprime une évaluation', async () => {
    expect(
      (await writer.patch('/api/evaluations-clausier/EVAL-ancienne', { evaluator: 'Évaluateur fictif' })).statusCode,
    ).toBe(200);
    expect((await etat()).supEvals[0]).toMatchObject({ evaluator: 'Évaluateur fictif', inconnu: { x: 1 } });
    expect((await writer.del(`/api/evaluations-clausier/${ev}`)).statusCode).toBe(200);
    expect((await writer.del(`/api/evaluations-clausier/${ev}`)).statusCode).toBe(404);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>(
      "SELECT DISTINCT action FROM audit_log WHERE action LIKE 'sup-eval.%'",
    );
    expect(new Set(rows.rows.map((x) => x.action))).toEqual(
      new Set([
        'sup-eval.created',
        'sup-eval.updated',
        'sup-eval.answered',
        'sup-eval.action-created',
        'sup-eval.deleted',
      ]),
    );
  });
});
