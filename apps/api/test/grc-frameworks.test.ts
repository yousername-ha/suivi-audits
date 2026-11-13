import crypto from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { methodTemplate, type FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';
let t: TestApp, a: Agent, scope: string, targetId: string;
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
  scope = (
    await a.post('/api/grc/smsis', { name: 'Référentiels de test', scope: 'Recette isolée', timezone: 'Europe/Paris' })
  ).json().id;
  targetId = await framework('ISO9001-FICTIF');
});
afterAll(async () => t.close());
it('les correspondances entre référentiels n’existent plus : plus de fiche « mapping », plus de route de validation', async () => {
  // ADR 0089, lot 3 : le type de fiche est inconnu, les routes de correspondances et de rapprochements ont disparu.
  const r = await a.post(root() + '/objects', {
    kind: 'mapping',
    name: 'Correspondance',
    data: { type: 'partial', status: 'proposed' },
  });
  expect(r.statusCode, r.body).toBe(422);
  expect((await a.get(root() + '/objects?kind=mapping')).statusCode).toBe(422);
  expect(
    (
      await a.post(
        root() + '/mappings/00000000-0000-4000-8000-000000000001/validate',
        { note: 'Revue documentée de la correspondance', confirm: 'VALIDER' },
        { 'if-match': '"1"' },
      )
    ).statusCode,
  ).toBe(404);
  expect((await a.get(root() + '/rapprochements')).statusCode).toBe(404);
  expect((await a.get('/api/library/mappings')).statusCode).toBe(404);
  // Le tableau de bord ne porte plus de décompte de correspondances.
  const f = (await a.get(root() + '/dashboard'))
    .json()
    .sections.frameworks.find((x: { id: string }) => x.id === targetId);
  expect(f).toBeDefined();
  expect(f).not.toHaveProperty('mapped');
});
it('préserve les anciennes publications quand le référentiel est désactivé', async () => {
  const r = await a.put(root() + `/frameworks/${targetId}/activation`, { enabled: false }, { 'if-match': '"1"' });
  expect(r.statusCode, r.body).toBe(200);
  expect((await a.get(root() + `/frameworks/${targetId}/versions/1`)).json().definition.requirements).toHaveLength(1);
  expect(
    (await a.get(root() + '/dashboard')).json().sections.frameworks.some((f: { id: string }) => f.id === targetId),
  ).toBe(false);
});
it('importe atomiquement après simulation et refuse contenu altéré et doublons', async () => {
  const data = { definition: definition('IMPORT-RECETTE') };
  const p = await a.post(root() + '/import/preview', { data });
  expect(p.statusCode, p.body).toBe(200);
  expect(p.json()).not.toHaveProperty('mappings');
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
  // Un fichier qui porterait encore des correspondances est refusé : le format ne les prévoit plus.
  expect(
    (
      await a.post(root() + '/import/preview', {
        data: { definition: definition('INVALIDE'), mappings: [{ type: 'partial' }] },
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
