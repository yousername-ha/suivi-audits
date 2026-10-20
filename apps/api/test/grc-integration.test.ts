import crypto from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { methodTemplate, type RiskMethod, type RiskData } from '@suivi/shared';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser, seedState } from './helpers.js';
let t: TestApp, a: Agent, reader: Agent, smsi: string, owner: string, ownerUser: TestUser;
const root = () => `/api/grc/${smsi}`;
const task = (name: string, ownerId: string | null = null) => ({
  kind: 'action',
  name,
  data: {
    description: '',
    status: 'todo',
    ownerId,
    startAt: null,
    dueAt: '2026-10-12T09:00:00Z',
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});
async function publish(definition: RiskMethod, id: string | null = null, version = 0) {
  const p = await a.post(root() + '/methods/preview', { id, definition });
  expect(p.statusCode, p.body).toBe(200);
  const result = await a.post(
    root() + '/methods/publish',
    {
      id,
      definition,
      previewId: p.json().previewId,
      reason: 'Politique validée pour la recette intégrée',
      confirm: 'PUBLIER',
    },
    { 'if-match': `"${version}"` },
  );
  expect(result.statusCode, result.body).toBe(200);
  return result.json();
}
const risk = (methodId: string, methodVersion = 1): { kind: 'risk'; name: string; data: RiskData } => ({
  kind: 'risk',
  name: 'Risque intégré',
  data: {
    description: 'Analyse de recette',
    code: 'RI',
    ownerId: null,
    methodId,
    methodVersion,
    domain: 'information',
    entity: 'Entité A',
    scope: 'Hébergement',
    strategy: 'reduce',
    acceptanceReason: '',
    reviewAt: '2026-10-12',
    stages: {},
  },
});
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'grci_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'grci_reader', 'ro'));
  const u = await makeUser(t, 'grci_owner', 'rw');
  owner = u.id;
  ownerUser = u;
  const s = await a.post('/api/grc/smsis', {
    name: 'Recette intégrée',
    scope: 'Périmètre protégé',
    timezone: 'Europe/Paris',
  });
  smsi = s.json().id;
  await a.put(root() + '/members', { userId: owner, write: true });
});
afterAll(async () => t.close());
for (const family of ['ebios_rm', 'iso27005', 'mehari', 'custom'] as const) {
  it(`évalue et cartographie ${family} selon sa propre politique`, async () => {
    const definition = methodTemplate(family),
      method = await publish(definition);
    const r = await a.post(root() + '/objects', risk(method.methodId));
    expect(r.statusCode, r.body).toBe(200);
    const rating = {
      dimensions: { severity: 'impact_2' },
      likelihood: 'likelihood_2',
      level: definition.calculation.kind === 'judgement' ? 'low' : null,
      inputs: {},
    };
    const body = {
      ratings: { gross: rating, residual: rating },
      rationale: 'Critères et justification conservés',
      decision: 'draft',
    };
    const preview = await a.post(root() + `/risks/${r.json().id}/preview`, body);
    expect(preview.statusCode, preview.body).toBe(200);
    const saved = await a.post(
      root() + `/risks/${r.json().id}/evaluate`,
      { ...body, previewId: preview.json().previewId, requestId: crypto.randomUUID(), confirm: 'ENREGISTRER' },
      { 'if-match': '"1"' },
    );
    expect(saved.statusCode, saved.body).toBe(200);
    const map = await a.get(root() + '/risk-map?methodId=' + method.methodId);
    expect(map.statusCode, map.body).toBe(200);
    expect(map.json().items).toHaveLength(1);
    expect(map.json().items[0].method.family).toBe(family);
    expect(map.json().items[0].assessment.result.residual.score).toBeNull();
    expect(map.json().items[0].assessment.result.residual.level).toBe(family === 'ebios_rm' ? 'medium' : 'low');
  });
}
it('projette les liens de formulaires EBIOS sans double saisie, avec filtres et facettes', async () => {
  const method = await publish(methodTemplate('ebios_rm'));
  const asset = await a.post(root() + '/objects', {
    kind: 'support_asset',
    name: 'Serveur métier',
    data: { description: '', securityDomain: 'Disponibilité', refs: [] },
  });
  const process = await a.post(root() + '/objects', {
    kind: 'process',
    name: 'Parcours patient',
    data: { description: '', refs: ['object:' + asset.json().id] },
  });
  const input = risk(method.methodId);
  input.data.stages = {
    stage_1: {
      status: 'draft',
      values: { support_assets: ['object:' + asset.json().id], business_values: ['object:' + process.json().id] },
      comment: '',
    },
  };
  const r = await a.post(root() + '/objects', input);
  expect(r.statusCode, r.body).toBe(200);
  const map = await a.get(root() + '/risk-map?relatedRef=' + encodeURIComponent('object:' + asset.json().id));
  expect(map.statusCode, map.body).toBe(200);
  expect(map.json().items.map((o: { id: string }) => o.id)).toContain(r.json().id);
  expect(map.json().facets[r.json().id].asset).toContain('Serveur métier');
  const backlinks = await a.get(root() + '/links?ref=' + encodeURIComponent('object:' + asset.json().id));
  expect(backlinks.statusCode, backlinks.body).toBe(200);
  expect(
    backlinks
      .json()
      .some((l: { derived: boolean; other: { ref: string } }) => l.derived && l.other.ref === 'object:' + r.json().id),
  ).toBe(true);
  expect(map.json().facets[r.json().id].process).toContain('Parcours patient');
  expect(map.json().facets[r.json().id].security_domain).toContain('Disponibilité');
  expect((await t.svc.db.q('SELECT id FROM grc_links WHERE smsi_id=$1', [smsi])).rowCount).toBe(0);
});
it('conserve les anciennes fiches et méthodes dans la projection datée', async () => {
  const d = methodTemplate('custom'),
    m = await publish(d),
    input = risk(m.methodId);
  const r = await a.post(root() + '/objects', input),
    at = new Date(Date.now() + 1).toISOString();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const edited = await a.put(
    root() + '/objects/' + r.json().id,
    { ...input, name: 'Nouveau nom de risque' },
    { 'if-match': '"1"' },
  );
  expect(edited.statusCode, edited.body).toBe(200);
  const current = await a.get(root() + '/risk-map?methodId=' + m.methodId);
  const historical = await a.get(root() + '/risk-map?methodId=' + m.methodId + '&at=' + encodeURIComponent(at));
  expect(historical.statusCode, historical.body).toBe(200);
  expect(current.json().items[0].name).toBe('Nouveau nom de risque');
  expect(historical.json().items[0].name).toBe('Risque intégré');
  expect(historical.json().items[0].version).toBe(1);
  d.name = 'Nouvelle politique';
  await publish(d, m.methodId, 1);
  expect((await a.get(root() + '/objects/' + r.json().id)).json().data.methodVersion).toBe(1);
});
it('les tâches de traitement et leur réalisation ne recalculent aucune décision de risque', async () => {
  const m = await publish(methodTemplate('custom')),
    input = risk(m.methodId),
    r = await a.post(root() + '/objects', input);
  const treatment = await a.post(root() + '/objects', {
    kind: 'treatment',
    name: 'Durcissement',
    data: { description: '', refs: ['object:' + r.json().id] },
  });
  const before = (await a.get(root() + `/risks/${r.json().id}/evaluations`)).json();
  const action = await a.post(root() + `/treatments/${treatment.json().id}/action`, {
    name: 'Réaliser le durcissement',
    ownerId: null,
    dueAt: null,
  });
  expect(action.statusCode, action.body).toBe(200);
  const o = action.json();
  await a.put(
    root() + '/objects/' + o.id,
    { kind: 'action', name: o.name, data: { ...o.data, status: 'progress' } },
    { 'if-match': '"1"' },
  );
  const done = await a.put(
    root() + '/objects/' + o.id,
    {
      kind: 'action',
      name: o.name,
      data: { ...o.data, status: 'done', justification: 'Mesure vérifiée et preuve disponible' },
    },
    { 'if-match': '"2"' },
  );
  expect(done.statusCode, done.body).toBe(200);
  expect((await a.get(root() + `/risks/${r.json().id}/evaluations`)).json()).toEqual(before);
  expect((await a.get(root() + '/objects/' + r.json().id)).json().version).toBe(1);
});
it('rappelle les échéances une seule fois et masque les notifications après révocation', async () => {
  const m = await publish(methodTemplate('custom')),
    r = risk(m.methodId);
  r.data.ownerId = owner;
  expect((await a.post(root() + '/objects', r)).statusCode).toBe(200);
  expect((await a.post(root() + '/objects', task('Rappel contrôlé', owner))).statusCode).toBe(200);
  await t.svc.grc.tasks.tick(new Date('2026-10-10T00:00:00Z'));
  await t.svc.grc.tasks.tick(new Date('2026-10-10T00:00:00Z'));
  const u = await login(t, ownerUser);
  const n = await u.get('/api/grc/notifications');
  expect(n.statusCode, n.body).toBe(200);
  expect(n.json()).toHaveLength(2);
  await a.del(root() + '/members/' + owner);
  const renewed = await login(t, ownerUser);
  expect((await renewed.get('/api/grc/notifications')).json()).toEqual([]);
});
it('bloque responsables expirés, catégories inconnues, références hors périmètre et exports non autorisés', async () => {
  await t.svc.db.q('UPDATE users SET expires_at=$2 WHERE id=$1', [owner, new Date('2000-01-01')]);
  expect((await a.post(root() + '/objects', task('Compte expiré', owner))).statusCode).toBe(422);
  expect(
    (await a.post(root() + '/objects', { kind: 'control', name: 'Type inconnu', data: { category: 'inconnu' } }))
      .statusCode,
  ).toBe(422);
  expect(
    (
      await a.post(root() + '/objects', {
        kind: 'treatment',
        name: 'Référence étrangère',
        data: { refs: ['object:' + crypto.randomUUID()] },
      })
    ).statusCode,
  ).toBe(404);
  expect((await reader.get(`/api/grc/${DEFAULT_SMSI}/export/authorize?kind=risks`)).statusCode).toBe(403);
  expect((await reader.get(`/api/grc/${DEFAULT_SMSI}/report`)).statusCode).toBe(403);
});
it('présente et réalise les actions historiques dans leur source, sans perdre les extras', async () => {
  const current = await a.get('/api/suivi/etat'),
    state = current.json();
  state.recurring = [
    {
      id: 'grc-historique',
      title: 'Tâche récurrente v2 à conserver',
      owner: 'Métier',
      start: '2026-10-12',
      n: 1,
      u: 'm',
      unknownExtra: { keep: true },
    },
  ];
  await seedState(t, state);
  const base = `/api/grc/${DEFAULT_SMSI}`,
    list = await a.get(base + '/tasks');
  const legacy = list.json().items.find((o: { name: string }) => o.name === 'Tâche récurrente v2 à conserver');
  expect(legacy).toBeTruthy();
  const summary = await a.get(base + '/tasks/dashboard');
  expect(summary.json().summary.total).toBeGreaterThanOrEqual(1);
  const done = await a.post(
    '/api/grc/legacy-tasks/complete',
    {
      ref: legacy.id,
      sourceSha: legacy.data.sourceSha,
      date: '2026-10-10',
      comment: 'Réalisation documentée de la tâche v2',
      proof: 'PV de revue',
      confirm: 'REALISER',
    },
    { 'if-match': `"${legacy.version}"` },
  );
  expect(done.statusCode, done.body).toBe(200);
  const source = (await a.get('/api/suivi/etat')).json().recurring[0];
  expect(source.unknownExtra).toEqual({ keep: true });
  expect(source.history[0]).toMatchObject({ date: '2026-10-10', by: expect.any(String) });
  expect(source.last).toBe('2026-10-10');
  expect((await t.svc.db.q("SELECT id FROM grc_objects WHERE legacy_id='grc-historique'", [])).rowCount).toBe(0);
});
