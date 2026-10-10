import { afterAll, beforeAll, expect, it } from 'vitest';
import { businessDefaults, methodTemplate } from '@suivi/shared';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';
import { DEFAULT_SMSI } from '../src/grc/core.js';
let t: TestApp, a: Agent, r: Agent, w: Agent, scope: string, writerId: string;
const root = () => '/api/grc/' + scope;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'grcs_admin', 'admin'));
  r = await login(t, await makeUser(t, 'grcs_reader', 'ro'));
  const writer = await makeUser(t, 'grcs_writer', 'rw');
  writerId = writer.id;
  w = await login(t, writer);
  scope = (await a.post('/api/grc/smsis', { name: 'SMSI protégé', scope: 'Test', timezone: 'Europe/Paris' })).json().id;
});
afterAll(async () => t.close());
const task = (name: string, dependencies: string[] = []) => ({
  kind: 'action',
  name,
  data: {
    description: '',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies,
  },
});
it('bloque CSRF, écriture lecteur et accès hors périmètre', async () => {
  expect((await a.req('POST', root() + '/objects', { json: task('CSRF'), csrf: false })).statusCode).toBe(403);
  expect((await r.post(`/api/grc/${DEFAULT_SMSI}/objects`, task('Lecteur'))).statusCode).toBe(403);
  expect((await w.post(root() + '/objects', task('Hors périmètre'))).statusCode).toBe(404);
});
it('un rôle personnalisé appelé Administrateur ne donne aucun contournement', async () => {
  await t.svc.db.q(
    `INSERT INTO roles(id,name,permissions) VALUES('faux_admin','Administrateur de périmètre',ARRAY['pilotage:lire'])`,
  );
  const account = await makeUser(t, 'grcs_fake', 'faux_admin');
  const u = await login(t, account);
  const session = (await t.svc.db.one<{ id_hash: Buffer }>('SELECT id_hash FROM sessions WHERE user_id=$1', [
    account.id,
  ]))!;
  const loaded = (await t.svc.auth.loadByHash(session.id_hash, false))!;
  await expect(t.svc.grc.access(scope, { ...loaded.user, roles: ['Administrateur'] })).rejects.toThrow();
  expect((await u.get(root() + '/objects?kind=risk')).statusCode).toBe(404);
});
it('cumule les droits métier et l’appartenance au périmètre', async () => {
  expect((await a.put(root() + '/members', { userId: writerId, write: false })).statusCode).toBe(204);
  const current = await login(t, { ...(await makeUser(t, 'grcs_readonly', 'rw')) });
  const u = (await t.svc.db.one<{ id: string }>(`SELECT id FROM users WHERE username='grcs_readonly'`))!.id;
  await a.put(root() + '/members', { userId: u, write: false });
  expect((await t.svc.db.q('SELECT id_hash FROM sessions WHERE user_id=$1', [u])).rowCount).toBe(0);
  expect((await current.get(root() + '/objects?kind=action')).statusCode).toBe(401);
});
it('rejette les cycles transitifs et les origines de récurrence forgées', async () => {
  const first = await a.post(root() + '/objects', task('A')),
    id = first.json().id;
  const second = await a.post(root() + '/objects', task('B', [id]));
  expect(second.statusCode, second.body).toBe(200);
  expect(
    (await a.put(root() + `/objects/${id}`, task('A', [second.json().id]), { 'if-match': '"1"' })).statusCode,
  ).toBe(409);
  expect(
    (
      await a.post(root() + '/objects', {
        ...task('Forge'),
        data: { ...task('Forge').data, seriesId: id, occurrenceKey: 'faux' },
      })
    ).statusCode,
  ).toBe(422);
});
it('simule sans écriture et bloque la publication falsifiée ou obsolète', async () => {
  const definition = methodTemplate('custom');
  const p = await a.post(root() + '/methods/preview', { id: null, definition });
  expect((await a.get(root() + '/methods')).json()).toHaveLength(0);
  expect(
    (
      await a.post(
        root() + '/methods/publish',
        {
          id: null,
          definition: { ...definition, name: 'Altération' },
          previewId: p.json().previewId,
          reason: 'Justification de la politique',
          confirm: 'PUBLIER',
        },
        { 'if-match': '"0"' },
      )
    ).statusCode,
  ).toBe(422);
});
it('une politique globale ne change pas implicitement les SMSI existants', async () => {
  const definition = businessDefaults();
  definition.name = 'Nouvelle nomenclature';
  const p = await a.post('/api/admin/business-policy/preview', { definition });
  expect(p.statusCode, p.body).toBe(200);
  const published = await a.put(
    '/api/admin/business-policy',
    { definition, previewId: p.json().previewId, reason: 'Publication distincte et explicite', confirm: 'PUBLIER' },
    { 'if-match': '"1"' },
  );
  expect(published.statusCode, published.body).toBe(200);
  expect((await a.get(root() + '/policy')).json().version).toBe(1);
  const s = (await a.get('/api/grc/smsis')).json().find((s: { id: string }) => s.id === scope);
  expect(
    (await a.put(root() + '/policy', { version: 2, confirm: 'ADOPTER' }, { 'if-match': `"${s.version}"` })).statusCode,
  ).toBe(200);
  expect((await a.get(root() + '/policy')).json().version).toBe(2);
});
it('refuse de supprimer des catégories utilisées lors de l’adoption', async () => {
  const d = businessDefaults();
  d.name = 'Suppression incompatible';
  d.catalogues.actionCategories = [{ id: 'nouvelle', label: 'Nouvelle' }];
  const p = await a.post('/api/admin/business-policy/preview', { definition: d });
  await a.put(
    '/api/admin/business-policy',
    { definition: d, previewId: p.json().previewId, reason: 'Essai de compatibilité des objets', confirm: 'PUBLIER' },
    { 'if-match': '"2"' },
  );
  const s = (await a.get('/api/grc/smsis')).json().find((s: { id: string }) => s.id === scope);
  expect(
    (await a.put(root() + '/policy', { version: 3, confirm: 'ADOPTER' }, { 'if-match': `"${s.version}"` })).statusCode,
  ).toBe(409);
});
it('les tables de publication et d’occurrence refusent aussi TRUNCATE', async () => {
  for (const table of [
    'business_policy_versions',
    'grc_method_versions',
    'grc_framework_versions',
    'grc_risk_evaluations',
    'grc_occurrences',
  ])
    await expect(t.svc.db.q('TRUNCATE ' + table + ' CASCADE')).rejects.toThrow();
});
