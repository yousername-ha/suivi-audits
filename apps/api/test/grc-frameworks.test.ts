import crypto from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { methodTemplate, type FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';
let t: TestApp, a: Agent, reader: Agent, scope: string, sourceId: string, targetId: string, mappingId: string;
const root = () => `/api/grc/${scope}`;
const definition = (identifier: string): FrameworkDefinition => ({
  name: identifier,
  identifier,
  source: {
    organisation: 'Organisation fictive',
    document: 'PSSI de recette',
    url: 'https://example.invalid/pssi',
    version: '1',
    date: '2026-10-10',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'governance', label: 'Gouvernance' }],
  requirements: [
    {
      id: 'REQ1',
      domain: 'governance',
      title: 'Revue de recette',
      description: 'Exemple fictif',
      applicability: 'Périmètre de test',
      measureRefs: [],
    },
  ],
});
const mapping = () => ({
  source: { frameworkId: sourceId, version: 1, requirementId: 'REQ1' },
  target: { frameworkId: targetId, version: 1, requirementId: 'REQ1' },
  type: 'partial',
  justification: 'Couverture partielle des critères documentés',
  coverage: 50,
  origin: 'ai',
  status: 'proposed',
  sourceUrl: 'https://example.invalid/source',
  reviewNote: '',
});
async function framework(identifier: string) {
  const d = definition(identifier),
    p = await a.post(root() + '/frameworks/preview', { id: null, definition: d });
  const r = await a.post(
    root() + '/frameworks/publish',
    {
      id: null,
      definition: d,
      previewId: p.json().previewId,
      reason: 'Référentiel fictif revu pour la recette',
      confirm: 'PUBLIER',
    },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id;
}
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'grcf_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'grcf_reader', 'ro'));
  scope = (
    await a.post('/api/grc/smsis', { name: 'Référentiels de test', scope: 'Recette isolée', timezone: 'Europe/Paris' })
  ).json().id;
  sourceId = await framework('PSSI-SOURCE');
  targetId = await framework('ISO9001-FICTIF');
});
afterAll(async () => t.close());
it('une proposition IA ne contribue pas à la couverture avant revue humaine', async () => {
  const r = await a.post(root() + '/objects', { kind: 'mapping', name: 'Proposition IA', data: mapping() });
  expect(r.statusCode, r.body).toBe(200);
  mappingId = r.json().id;
  const dashboard = await a.get(root() + '/dashboard');
  expect(dashboard.json().sections.frameworks.find((f: { id: string }) => f.id === targetId).mapped).toBe(0);
  expect(
    (
      await a.post(root() + '/objects', {
        kind: 'mapping',
        name: 'Auto validation',
        data: { ...mapping(), status: 'validated' },
      })
    ).statusCode,
  ).toBe(422);
});
it('une validation est versionnée, justifiée et réservée au droit serveur', async () => {
  expect(
    (
      await reader.post(
        root() + `/mappings/${mappingId}/validate`,
        { note: 'Revue documentée de la correspondance', confirm: 'VALIDER' },
        { 'if-match': '"1"' },
      )
    ).statusCode,
  ).toBe(403);
  const r = await a.post(
    root() + `/mappings/${mappingId}/validate`,
    { note: 'Critères de couverture examinés par un responsable', confirm: 'VALIDER' },
    { 'if-match': '"1"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  expect(r.json().data.validatedBy).toBe('grcf_admin');
  expect(r.json().data.status).toBe('validated');
  expect((await a.get(root() + `/objects/${mappingId}/history`)).json()).toHaveLength(2);
  expect(
    (await a.get(root() + '/dashboard')).json().sections.frameworks.find((f: { id: string }) => f.id === targetId)
      .mapped,
  ).toBe(1);
});
it('rejette les versions ou exigences inexistantes et préserve les anciennes publications', async () => {
  expect(
    (
      await a.post(root() + '/objects', {
        kind: 'mapping',
        name: 'Version absente',
        data: { ...mapping(), target: { ...mapping().target, version: 99 } },
      })
    ).statusCode,
  ).toBe(404);
  expect(
    (
      await a.post(root() + '/objects', {
        kind: 'mapping',
        name: 'Exigence absente',
        data: { ...mapping(), target: { ...mapping().target, requirementId: 'ABSENT' } },
      })
    ).statusCode,
  ).toBe(422);
  const r = await a.put(root() + `/frameworks/${targetId}/activation`, { enabled: false }, { 'if-match': '"1"' });
  expect(r.statusCode, r.body).toBe(200);
  expect((await a.get(root() + `/frameworks/${targetId}/versions/1`)).json().definition.requirements).toHaveLength(1);
  expect(
    (await a.get(root() + '/dashboard')).json().sections.frameworks.some((f: { id: string }) => f.id === targetId),
  ).toBe(false);
});
it('importe atomiquement après simulation et refuse contenu altéré, doublons et validation importée', async () => {
  const data = { definition: definition('IMPORT-RECETTE'), mappings: [mapping()] };
  const p = await a.post(root() + '/import/preview', { data });
  expect(p.statusCode, p.body).toBe(200);
  expect(
    (
      await a.post(root() + '/import/commit', {
        data: { ...data, definition: definition('ALTERATION') },
        previewId: p.json().previewId,
        confirm: 'IMPORTER',
      })
    ).statusCode,
  ).toBe(409);
  const r = await a.post(root() + '/import/commit', { data, previewId: p.json().previewId, confirm: 'IMPORTER' });
  expect(r.statusCode, r.body).toBe(200);
  expect((await a.post(root() + '/import/preview', { data })).json().canImport).toBe(false);
  expect(
    (
      await a.post(root() + '/import/preview', {
        data: { definition: definition('INVALIDE'), mappings: [{ ...mapping(), status: 'validated' }] },
      })
    ).statusCode,
  ).toBe(422);
  expect(
    (await a.get(root() + '/objects?kind=framework')).json().items.map((o: { name: string }) => o.name),
  ).not.toContain('ALTERATION');
});
it('suspend une série sur un référentiel désactivé et reprend sans doublon après réactivation', async () => {
  const series = await a.post(root() + '/objects', {
    kind: 'task_series',
    name: 'Revue du référentiel',
    data: {
      description: 'Contrôle périodique',
      ownerId: null,
      category: 'action',
      priority: 'normal',
      refs: [`requirement:${targetId}:1:REQ1`],
      recurrence: {
        start: '2026-10-01',
        time: '09:00',
        timezone: 'Europe/Paris',
        unit: 'month',
        interval: 1,
        until: null,
        count: 1,
        reminderDays: 7,
        active: true,
      },
    },
  });
  expect(series.statusCode, series.body).toBe(200);
  await t.svc.grc.tasks.tick(new Date('2026-11-02'));
  expect((await a.get(root() + `/series/${series.json().id}/occurrences`)).json()).toHaveLength(0);
  const current = (await a.get(root() + '/objects/' + targetId)).json();
  expect(
    (
      await a.put(
        root() + `/frameworks/${targetId}/activation`,
        { enabled: true },
        { 'if-match': `"${current.version}"` },
      )
    ).statusCode,
  ).toBe(200);
  await t.svc.grc.tasks.tick(new Date('2026-11-02'));
  await t.svc.grc.tasks.tick(new Date('2026-11-02'));
  expect((await a.get(root() + `/series/${series.json().id}/occurrences`)).json()).toHaveLength(1);
});
it('borne les projections et pagine un registre de 10 000 risques sans lecture par fiche', async () => {
  const methodId = crypto.randomUUID(),
    d = methodTemplate('custom');
  await t.svc.db.q(
    'INSERT INTO grc_method_versions(method_id,smsi_id,version,definition,reason,created_by) VALUES($1,$2,1,$3,$4,$5)',
    [methodId, scope, d, 'Fixture de performance', 'recette'],
  );
  await t.svc.db.q(
    `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by) SELECT $1,'risk','pilotage','Risque volume '||i,jsonb_build_object('methodId',$2::text,'methodVersion',1,'domain','information','entity','A','scope','Recette','strategy','reduce','reviewAt','2027-01-01','stages','{}'::jsonb),'recette','recette' FROM generate_series(1,10000) i`,
    [scope, methodId],
  );
  const calls = vi.spyOn(t.svc.db, 'q');
  try {
    const map = await a.get(root() + '/risk-map?limit=50');
    expect(map.statusCode, map.body).toBe(200);
    expect(map.json().total).toBe(10000);
    expect(map.json().items).toHaveLength(50);
    expect(map.json().truncated).toBe(true);
    expect(calls.mock.calls.length).toBeLessThan(30);
    const page = await a.get(root() + '/objects?kind=risk');
    expect(page.json().items).toHaveLength(50);
    expect(page.json().nextOffset).toBe(50);
    expect(page.json().total).toBe(10000);
    expect((await a.get(root() + '/risk-map?limit=1001')).statusCode).toBe(422);
  } finally {
    calls.mockRestore();
  }
});
