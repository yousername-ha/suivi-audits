/* Reprise des plans de l'outil de suivi (clé `plans`) : lecture et écriture natives sous verrou, sans copie, champs
   inconnus conservés, actions croisées (couverture du cycle, indicateur, registre des écarts). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const etat = async () => (await admin.get('/api/suivi/etat')).json();
const poser = async (modifier: (s: Record<string, unknown>) => void) => {
  const cur = await admin.get('/api/suivi/etat');
  const s = cur.json();
  modifier(s);
  await seedState(t, s);
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'plans_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'plans_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'plans_writer', 'rw'));
  await poser((s) => {
    s.years = [2026];
    s.items = [
      { id: 'A-5.29', ref: 'A', num: '5.29', title: 'Mesure fictive 1', group: 'A-5', interne: {}, afnor: {} },
      {
        id: 'A-5.30',
        ref: 'A',
        num: '5.30',
        title: 'Mesure fictive 2',
        group: 'A-5',
        interne: { '2026': 'X' },
        afnor: {},
      },
      { id: 'A-5.31', ref: 'A', num: '5.31', title: 'Mesure fictive 3', group: 'A-5', interne: {}, afnor: {} },
    ];
    s.indicators = [
      { id: 'IND-S1', name: 'Taux de sensibilisation', dir: '≥', target: 0.9, values: [] },
      { id: 'IND-S2', name: 'Réussite au phishing', dir: '≥', target: 0.8, values: [] },
      { id: 'IND-S3', name: 'Sensibilisation calculée', dir: '≥', target: 0.5, calc: 'x', values: [] },
      { id: 'IND-X', name: 'Autre indicateur', values: [] },
    ];
    s.findings = [];
    s.recurring = [{ id: 'R-1', title: 'Revue trimestrielle fictive', n: 3, u: 'm', start: '2026-01-15', history: [] }];
    s.plans = [
      {
        id: 'PL-FOR-009',
        type: 'formation',
        title: 'Séance existante',
        start: '2026-02-02',
        status: 'Planifié',
        inconnu: { garder: true },
      },
      { id: 'PL-ZZZ-001', type: 'autre', title: 'Type inconnu' },
    ];
  });
});
afterAll(() => t.close());

describe('lecture', () => {
  it('liste les plans reconnus, les tâches récurrentes, les années, les indicateurs de sensibilisation et les mesures', async () => {
    const r = await reader.get('/api/plans');
    expect(r.statusCode).toBe(200);
    const v = r.json();
    expect(v.plans.map((p: { id: string }) => p.id)).toEqual(['PL-FOR-009']);
    expect(v.recurrences[0]).toMatchObject({ id: 'R-1', n: 3, u: 'm', active: true });
    expect(v.annees).toEqual([2026]);
    expect(v.indicateurs.map((i: { id: string }) => i.id)).toEqual(['IND-S1', 'IND-S2', 'IND-S3']);
    expect(v.indicateurs.find((i: { id: string }) => i.id === 'IND-S3').auto).toBe(true);
    expect(v.mesures[0]).toMatchObject({ id: 'A-5.29', code: 'A.5.29', ref: 'A' });
  });
  it('est refusée sans le droit de lecture du pilotage', async () => {
    const sans = await login(t, await makeUser(t, 'plans_sans', null));
    expect((await sans.get('/api/plans')).statusCode).toBe(403);
  });
});

describe('écriture', () => {
  it('refuse la création à un lecteur, la valide et attribue le premier identifiant libre', async () => {
    expect((await reader.post('/api/plans', { type: 'formation' })).statusCode).toBe(403);
    expect((await writer.post('/api/plans', { type: 'autre' })).statusCode).toBe(422);
    expect((await writer.post('/api/plans', { type: 'formation', inconnu: 1 })).statusCode).toBe(422);
    const a = await writer.post('/api/plans', {
      type: 'formation',
      title: 'Accueil des arrivants',
      start: '2026-03-10',
    });
    expect(a.statusCode, a.body).toBe(201);
    expect(a.json()).toMatchObject({
      id: 'PL-FOR-001',
      status: 'Planifié',
      kind: 'Présentiel',
      title: 'Accueil des arrivants',
    });
    const b = await writer.post('/api/plans', { type: 'formation' });
    expect(b.json().id).toBe('PL-FOR-002');
    expect((await writer.post('/api/plans', { type: 'sensi' })).json().id).toBe('PL-SEN-001');
  });
  it('modifie les champs fournis et conserve les autres, y compris ceux que l’écran ne connaît pas', async () => {
    const r = await writer.patch('/api/plans/PL-FOR-009', { title: 'Séance renommée', owner: 'Responsable fictif' });
    expect(r.statusCode, r.body).toBe(200);
    const brut = (await etat()).plans.find((p: { id: string }) => p.id === 'PL-FOR-009');
    expect(brut).toMatchObject({
      title: 'Séance renommée',
      owner: 'Responsable fictif',
      start: '2026-02-02',
      inconnu: { garder: true },
    });
    expect((await writer.patch('/api/plans/PL-FOR-009', { status: 'Autre' })).statusCode).toBe(422);
    expect((await writer.patch('/api/plans/PL-FOR-009', { start: '10/03/2026' })).statusCode).toBe(422);
    expect((await writer.patch('/api/plans/PL-FOR-404', { title: 'x' })).statusCode).toBe(404);
    expect((await writer.patch('/api/plans/PL-ZZZ-001', { title: 'x' })).statusCode).toBe(422);
  });
  it('laisse intactes les autres clés de l’état et le type inconnu', async () => {
    const s = await etat();
    expect(s.plans.some((p: { id: string }) => p.id === 'PL-ZZZ-001')).toBe(true);
    expect(s.items).toHaveLength(3);
    expect(s.years).toEqual([2026]);
  });
  it('décale les dates (début, et fin si elle existe) et refuse une action sans date', async () => {
    await writer.patch('/api/plans/PL-FOR-001', { end: '2026-03-12' });
    const r = await writer.post('/api/plans/PL-FOR-001/decalage', { jours: 25 });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ start: '2026-04-04', end: '2026-04-06' });
    expect((await writer.post('/api/plans/PL-FOR-002/decalage', { jours: 3 })).statusCode).toBe(422);
    expect((await writer.post('/api/plans/PL-FOR-001/decalage', { jours: 1.5 })).statusCode).toBe(422);
    expect((await reader.post('/api/plans/PL-FOR-001/decalage', { jours: 1 })).statusCode).toBe(403);
  });
  it('supprime une action sans toucher aux autres', async () => {
    expect((await reader.del('/api/plans/PL-FOR-002')).statusCode).toBe(403);
    expect((await admin.del('/api/plans/PL-FOR-002')).statusCode).toBe(200);
    expect((await admin.del('/api/plans/PL-FOR-002')).statusCode).toBe(404);
    const ids = (await reader.get('/api/plans')).json().plans.map((p: { id: string }) => p.id);
    expect(ids).toContain('PL-FOR-001');
    expect(ids).not.toContain('PL-FOR-002');
  });
});

describe('actions croisées', () => {
  it('reporte un audit réalisé dans la couverture du cycle, une seule fois par mesure', async () => {
    const p = (
      await writer.post('/api/plans', {
        type: 'audit',
        title: 'Audit fictif',
        start: '2026-05-04',
        items: ['A-5.29', 'A-5.30'],
      })
    ).json();
    expect((await writer.post(`/api/plans/${p.id}/couverture`)).statusCode).toBe(409);
    await writer.patch(`/api/plans/${p.id}`, { status: 'Réalisé', done: '2026-06-01' });
    const r = await writer.post(`/api/plans/${p.id}/couverture`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().marquees).toBe(1);
    const items = (await etat()).items;
    expect(items.find((m: { id: string }) => m.id === 'A-5.29').interne).toEqual({ '2026': 'X' });
    expect(items.find((m: { id: string }) => m.id === 'A-5.31').interne).toEqual({});
    expect((await writer.post(`/api/plans/${p.id}/couverture`)).json().marquees).toBe(0);
    await writer.patch(`/api/plans/${p.id}`, { done: '2031-01-01' });
    expect((await writer.post(`/api/plans/${p.id}/couverture`)).statusCode).toBe(422);
    expect((await writer.post('/api/plans/PL-FOR-001/couverture')).statusCode).toBe(422);
  });
  it('enregistre le taux d’une sensibilisation réalisée dans son indicateur (participation, ou réussite pour le phishing)', async () => {
    const p = (
      await writer.post('/api/plans', {
        type: 'sensi',
        title: 'Campagne fictive',
        start: '2026-04-01',
        indicator: 'IND-S1',
        participation: '85',
        success: '70',
      })
    ).json();
    expect((await writer.post(`/api/plans/${p.id}/indicateur`)).statusCode).toBe(409);
    await writer.patch(`/api/plans/${p.id}`, { status: 'Réalisé', done: '2026-04-20' });
    const r = await writer.post(`/api/plans/${p.id}/indicateur`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().valeur).toBe(0.85);
    const ind = (await etat()).indicators.find((i: { id: string }) => i.id === 'IND-S1');
    expect(ind.values).toHaveLength(1);
    expect(ind.values[0]).toMatchObject({ date: '2026-04-20', v: 0.85, note: `${p.id} — Campagne fictive` });
    expect((await reader.get('/api/plans')).json().plans.find((x: { id: string }) => x.id === p.id).pushedAt).not.toBe(
      '',
    );
    await writer.patch(`/api/plans/${p.id}`, { indicator: 'IND-S2' });
    expect((await writer.post(`/api/plans/${p.id}/indicateur`)).json().valeur).toBe(0.7);
    await writer.patch(`/api/plans/${p.id}`, { indicator: 'IND-S3' });
    expect((await writer.post(`/api/plans/${p.id}/indicateur`)).statusCode).toBe(422);
    await writer.patch(`/api/plans/${p.id}`, { indicator: 'IND-ABSENT' });
    expect((await writer.post(`/api/plans/${p.id}/indicateur`)).statusCode).toBe(404);
  });
  it('crée une action du registre des écarts à partir d’un exercice, avec numéro libre et mesures existantes', async () => {
    const p = (
      await writer.post('/api/plans', {
        type: 'exo',
        title: 'Exercice fictif',
        start: '2026-09-01',
        owner: 'Pilote fictif',
        retex: 'Retour fictif',
      })
    ).json();
    const r = await writer.post(`/api/plans/${p.id}/ecart`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().ecart).toBe('EXO-01');
    const f = (await etat()).findings.find((x: { id: string }) => x.id === 'EXO-01');
    expect(f).toMatchObject({ type: 'PP', status: 'Ouvert', desc: 'Retour fictif', items: ['A-5.29', 'A-5.30'] });
    expect((await writer.post(`/api/plans/${p.id}/ecart`)).json().ecart).toBe('EXO-02');
    expect((await reader.get('/api/plans')).json().plans.find((x: { id: string }) => x.id === p.id).findings).toEqual([
      'EXO-01',
      'EXO-02',
    ]);
    expect((await writer.post('/api/plans/PL-FOR-001/ecart')).statusCode).toBe(422);
  });
});

describe('journal', () => {
  it('journalise chaque modification', async () => {
    const rows = await t.svc.db.q<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'plan.%'");
    const actions = new Set(rows.rows.map((r) => r.action));
    for (const a of [
      'plan.created',
      'plan.updated',
      'plan.deleted',
      'plan.shifted',
      'plan.coverage-synced',
      'plan.indicator-pushed',
      'plan.finding-created',
    ])
      expect(actions.has(a), a).toBe(true);
  });
});
