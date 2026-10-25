/* Cartographie (CARTO-01, 02, 03, 04, 11, 12, 13, 14, 15, 18) : objets filtrés par droits, cartes, If-Match et 412,
   versions (20 au plus), lecture seule, temps réel, journal d'audit, reprise du module legacy « maps ». */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ChangeEvent } from '@suivi/shared';
import { type MapLayout } from '@suivi/shared/carto';
import { deepEqual, type Json, type JsonObject } from '@suivi/shared/legacy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { createDatabase } from './pg.js';
import { createTestApp, fixturePath, login, makeUser, REPO, type Agent, type TestApp } from './helpers.js';

let t: TestApp;
let rssi: Agent, contrib: Agent, lecteur: Agent, sansFournisseurs: Agent, admin: Agent;
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const DONNEES = JSON.parse(readFileSync(path.join(REPO, 'tests/fixtures/carto-donnees.json'), 'utf8')) as JsonObject;

const LAYOUT: MapLayout = {
  nodes: {
    isms: { x: 0, y: 0, w: 300, h: 116, label: '' },
    'process:PRR-001': { x: 0, y: 200, w: 200, h: 96, label: 'Concevoir les projets' },
  },
  edges: [{ id: 'e1', s: 'isms', t: 'process:PRR-001', type: 'related_to' }],
  hide: {},
  ignored: {},
};

async function importer(a: Agent, data: JsonObject) {
  const buf = Buffer.from(JSON.stringify(data));
  const r = await a.req('POST', `/api/admin/import/apply?mode=merge&sha256=${sha(buf)}`, {
    body: buf,
    headers: { 'x-file-name': 'carto.json' },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { batch: number };
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'rssi', 'rssi'));
  contrib = await login(t, await makeUser(t, 'contrib', 'contributeur'));
  lecteur = await login(t, await makeUser(t, 'lecteur', 'lecteur'));
  // Rôle personnalisé : cartographie et pilotage, sans les fournisseurs.
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_carto', 'Carto sans fournisseurs', '{cartographie:lire,pilotage:lire,conformite:lire}')",
  );
  sansFournisseurs = await login(t, await makeUser(t, 'sansfour', 'r_carto'));
  // Données fictives de la recette (processus, parties intéressées, fournisseurs…).
  const base = JSON.parse(readFileSync(fixturePath, 'utf8')) as JsonObject;
  const { maps: _maps, ...sansCartes } = base;
  const { _commentaire: _c, ...donnees } = DONNEES;
  await importer(admin, { ...sansCartes, ...donnees });
});
afterAll(() => t.close());

describe('objets de la plateforme (CARTO-02, CARTO-01)', () => {
  it('objets normalisés, relations dérivables, fiche détaillée sans données brutes', async () => {
    const r = await lecteur.get('/api/carto/objects');
    expect(r.statusCode, r.body).toBe(200);
    const { objects, organisation, hiddenModules } = r.json() as {
      objects: { ref: string; type: string; details?: Record<string, unknown> }[];
      organisation: string;
      hiddenModules: string[];
    };
    expect(organisation).toBeTruthy();
    expect(hiddenModules).toEqual([]);
    expect(objects.filter((o) => o.type === 'supplier')).toHaveLength(8);
    expect(objects.find((o) => o.ref === 'process:PRR-001')!.details!.indicators).toHaveLength(2);
    expect(r.body).not.toContain('"data"');
  });
  it('sans fournisseurs:lire, aucun fournisseur n’est envoyé (boîtes « Objet non accessible »)', async () => {
    const r = (await sansFournisseurs.get('/api/carto/objects')).json() as {
      objects: { ref: string }[];
      hiddenModules: string[];
    };
    expect(r.objects.some((o) => o.ref.startsWith('sup:'))).toBe(false);
    expect(r.objects.some((o) => o.ref.startsWith('process:'))).toBe(true);
    expect(r.hiddenModules).toEqual(['fournisseurs']);
    const isms = r.objects.find((o) => o.ref === 'isms') as unknown as { details: { counts: { label: string }[] } };
    expect(isms.details.counts.map((c) => c.label)).not.toContain('Fournisseurs');
  });
  it('sans cartographie:lire : refus', async () => {
    await t.svc.db.q("INSERT INTO roles(id, name, permissions) VALUES ('r_pil', 'Pilotage seul', '{pilotage:lire}')");
    const a = await login(t, await makeUser(t, 'pilotage', 'r_pil'));
    expect((await a.get('/api/carto/objects')).statusCode).toBe(403);
    expect((await a.get('/api/carto/maps')).statusCode).toBe(403);
  });
});

describe('cartes : création, If-Match, 412, lecture seule (CARTO-03, CARTO-04, CARTO-07)', () => {
  let id = '';
  it('le lecteur ne peut rien écrire (403), le contributeur crée la carte', async () => {
    expect((await lecteur.post('/api/carto/maps', { view: 'context', layout: LAYOUT })).statusCode).toBe(403);
    const r = await contrib.post('/api/carto/maps', { view: 'context', layout: LAYOUT });
    expect(r.statusCode, r.body).toBe(201);
    id = r.json().id;
    expect(r.headers.etag).toBe('"1"');
    expect(r.json()).toMatchObject({ view: 'context', name: 'Carte du contexte', version: 1, created_by: 'contrib' });
    expect((await contrib.post('/api/carto/maps', { view: 'context', layout: LAYOUT })).statusCode).toBe(409);
    expect((await lecteur.get('/api/carto/maps')).json()).toHaveLength(1);
  });
  it('valide la disposition (relation vers un objet absent, bornes)', async () => {
    const bad = { ...LAYOUT, edges: [{ id: 'x', s: 'isms', t: 'scope', type: 'related_to' }] };
    expect((await contrib.put(`/api/carto/maps/${id}`, { layout: bad }, { 'if-match': '"1"' })).statusCode).toBe(422);
    const big = { ...LAYOUT, nodes: { isms: { x: 0, y: 0, w: 10, h: 10, label: '' } }, edges: [] };
    expect((await contrib.put(`/api/carto/maps/${id}`, { layout: big }, { 'if-match': '"1"' })).statusCode).toBe(422);
  });
  it('enregistrement : If-Match obligatoire, 412 avec l’auteur, « Écraser » journalisé', async () => {
    const moved = structuredClone(LAYOUT);
    moved.nodes.isms!.x = 60;
    moved.nodes.isms!.y = 40;
    expect((await contrib.put(`/api/carto/maps/${id}`, { layout: moved })).statusCode).toBe(428);
    const ok = await contrib.put(`/api/carto/maps/${id}`, { layout: moved }, { 'if-match': '"1"' });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().version).toBe(2);
    expect(ok.json().layout.nodes.isms).toMatchObject({ x: 60, y: 40 });
    // Seconde session, version périmée : 412 avec l'auteur et la version courante.
    const late = await rssi.put(`/api/carto/maps/${id}`, { layout: LAYOUT }, { 'if-match': '"1"' });
    expect(late.statusCode).toBe(412);
    expect(late.json().error).toMatch(/modifié par contrib/);
    expect(late.json().current).toMatchObject({ version: 2, updated_by: 'contrib' });
    const over = await rssi.put(`/api/carto/maps/${id}`, { layout: LAYOUT, overwrite: true }, { 'if-match': '"2"' });
    expect(over.statusCode).toBe(200);
    const audit = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action LIKE 'carto.%' ORDER BY id",
    );
    expect(audit.rows.map((x) => x.action)).toEqual(['carto.map_create', 'carto.map_save', 'carto.map_overwrite']);
  });
  it('versions : figer, lister, restaurer (If-Match), 20 au plus, suppression réservée', async () => {
    const v1 = await contrib.post(`/api/carto/maps/${id}/versions`, { label: 'Revue de direction' });
    expect(v1.statusCode, v1.body).toBe(201);
    const map = (await contrib.get(`/api/carto/maps/${id}`)).json();
    const moved = structuredClone(map.layout as MapLayout);
    moved.nodes.isms!.x = 999;
    const saved = await contrib.put(`/api/carto/maps/${id}`, { layout: moved }, { 'if-match': `"${map.version}"` });
    expect(saved.statusCode).toBe(200);
    const restored = await contrib.post(
      `/api/carto/maps/${id}/versions/${v1.json().id}/restore`,
      {},
      {
        'if-match': `"${saved.json().version}"`,
      },
    );
    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.json().layout).toEqual(map.layout);
    for (let i = 0; i < 20; i++) await contrib.post(`/api/carto/maps/${id}/versions`, { label: `V${i}` });
    const list = (await lecteur.get(`/api/carto/maps/${id}/versions`)).json() as { id: string; label: string }[];
    expect(list).toHaveLength(20);
    expect(list.map((v) => v.label)).not.toContain('Revue de direction');
    expect(list[0]!.label).toBe('V19');
    expect((await contrib.del(`/api/carto/maps/${id}/versions/${list[0]!.id}`)).statusCode).toBe(403);
    expect((await rssi.del(`/api/carto/maps/${id}/versions/${list[0]!.id}`)).statusCode).toBe(204);
  });
  it('nature d’un enjeu (CARTO-12) : stockée dans les réglages de la carte de contexte', async () => {
    const objs = (await rssi.get('/api/carto/objects')).json().objects as { ref: string; type: string }[];
    const enjeu = objs.find((o) => o.type === 'external_issue')!;
    const r = await contrib.put('/api/carto/settings/issue-kind', { ref: enjeu.ref, kind: 'int' });
    expect(r.statusCode, r.body).toBe(200);
    const after = (await rssi.get('/api/carto/objects')).json().objects as { ref: string; type: string }[];
    expect(after.find((o) => o.ref === enjeu.ref)!.type).toBe('internal_issue');
    await contrib.put('/api/carto/settings/issue-kind', { ref: enjeu.ref, kind: null });
    const back = (await rssi.get('/api/carto/objects')).json().objects as { ref: string; type: string }[];
    expect(back.find((o) => o.ref === enjeu.ref)!.type).toBe('external_issue');
    expect((await lecteur.put('/api/carto/settings/issue-kind', { ref: enjeu.ref, kind: 'int' })).statusCode).toBe(403);
  });
  it('export journalisé (CARTO-13), lecteur compris ; temps réel « maps »', async () => {
    expect((await lecteur.post('/api/carto/exports', { view: 'context', format: 'png' })).statusCode).toBe(204);
    const row = await t.svc.db.one<{ username: string; details: { format: string } }>(
      "SELECT username, details FROM audit_log WHERE action = 'carto.export' ORDER BY id DESC LIMIT 1",
    );
    expect(row).toMatchObject({ username: 'lecteur', details: { format: 'png' } });
    await t.svc.bus.start();
    const ev = new Promise<ChangeEvent>((res) =>
      t.svc.bus.once('change', (e: ChangeEvent) => e.entity === 'maps' && res(e)),
    );
    const map = (await contrib.get(`/api/carto/maps/${id}`)).json();
    await contrib.put(`/api/carto/maps/${id}`, { layout: map.layout }, { 'if-match': `"${map.version}"` });
    expect(await ev).toMatchObject({ entity: 'maps', id, version: map.version + 1, author: 'contrib' });
  });
  it('suppression réservée à cartographie:supprimer', async () => {
    expect((await contrib.del(`/api/carto/maps/${id}`)).statusCode).toBe(403);
    expect((await rssi.del(`/api/carto/maps/${id}`)).statusCode).toBe(204);
    expect((await lecteur.get('/api/carto/maps')).json()).toEqual([]);
  });
});

describe('construire de zéro : créer et renommer depuis la carte (CARTO-15, CARTO-18)', () => {
  type Obj = { ref: string; type: string; name: string; src?: { k: string }[] };
  const objets = async (a: Agent) => (await a.get('/api/carto/objects')).json().objects as Obj[];
  const etat = async () => (await t.svc.legacy.recompose())!.data as Record<string, Record<string, unknown>[]>;
  // Les enjeux créés ici vivent dans une carte de contexte « vide » : retirée pour les tests de reprise suivants.
  afterAll(() => t.svc.db.q('DELETE FROM maps'));

  it('partie intéressée créée dans son module, journalisée, visible en temps réel', async () => {
    await t.svc.bus.start();
    const ev = new Promise<ChangeEvent>((res) =>
      t.svc.bus.once('change', (e: ChangeEvent) => e.entity === 'legacy_state' && res(e)),
    );
    const r = await contrib.post('/api/carto/objects', {
      type: 'stakeholder',
      name: 'Autorité de contrôle (fictive)',
      nature: 'Externe',
    });
    expect(r.statusCode, r.body).toBe(201);
    const { ref } = r.json() as { ref: string };
    expect(ref).toMatch(/^pi:PI-/);
    expect(await ev).toMatchObject({ entity: 'legacy_state' });
    const pi = (await etat()).interested!.find((x) => 'pi:' + x.id === ref)!;
    expect(pi).toMatchObject({ name: 'Autorité de contrôle (fictive)', type: 'Externe', cat: 'Autre' });
    expect((await objets(lecteur)).find((o) => o.ref === ref)).toMatchObject({ type: 'stakeholder' });
    const row = await t.svc.db.one<{ username: string; target: string; details: { type: string } }>(
      "SELECT username, target, details FROM audit_log WHERE action = 'carto.object_create' ORDER BY id DESC LIMIT 1",
    );
    expect(row).toMatchObject({ username: 'contrib', target: ref, details: { type: 'stakeholder' } });
  });

  it('double contrôle des droits : cartographie:modifier et la permission du module d’origine', async () => {
    expect((await lecteur.post('/api/carto/objects', { type: 'site', name: 'Site fictif' })).statusCode).toBe(403);
    await t.svc.db.q(
      "INSERT INTO roles(id, name, permissions) VALUES ('r_carto_mod', 'Carto et pilotage', '{cartographie:lire,cartographie:modifier,pilotage:lire,pilotage:modifier,fournisseurs:lire}')",
    );
    const a = await login(t, await makeUser(t, 'cartomod', 'r_carto_mod'));
    const r = await a.post('/api/carto/objects', { type: 'supplier', name: 'Fournisseur fictif refusé' });
    expect(r.statusCode).toBe(403);
    expect(r.json().permission).toBe('fournisseurs:modifier');
    expect((await a.post('/api/carto/objects', { type: 'site', name: 'Site fictif' })).statusCode).toBe(201);
    expect((await a.post('/api/carto/objects', { type: 'site', name: 'site FICTIF' })).statusCode).toBe(409);
    expect((await a.post('/api/carto/objects', { type: 'site', name: '' })).statusCode).toBe(422);
  });

  it('fournisseur, application, processus et sous-processus au format de l’outil historique', async () => {
    const f = await rssi.post('/api/carto/objects', { type: 'supplier', name: 'Hébergeur fictif', hds: true });
    expect(f.statusCode, f.body).toBe(201);
    const app = await rssi.post('/api/carto/objects', {
      type: 'application',
      name: 'Application fictive',
      supplier: 'Hébergeur fictif',
    });
    expect(app.statusCode, app.body).toBe(201);
    const p = await rssi.post('/api/carto/objects', { type: 'process', name: 'Processus fictif', family: 'Support' });
    const sp = await rssi.post('/api/carto/objects', {
      type: 'subprocess',
      name: 'Étape fictive',
      parent: (p.json().ref as string).slice('process:'.length),
    });
    expect(sp.statusCode, sp.body).toBe(201);
    const o = await objets(rssi);
    expect(o.find((x) => x.ref === app.json().ref)).toMatchObject({ supRef: f.json().ref });
    expect(o.find((x) => x.ref === sp.json().ref)).toMatchObject({ type: 'subprocess', family: 'Support' });
    const sup = (await etat()).suppliers!.find((x) => 'sup:' + x.id === f.json().ref)!;
    expect((sup.controls as { id: string }[]).map((c) => c.id)).toContain('hds');
  });

  it('enjeu : rangé dans les réglages de la carte de contexte, sans doublon', async () => {
    const r = await contrib.post('/api/carto/objects', { type: 'issue', name: 'Menace fictive créée', kind: 'ext' });
    expect(r.statusCode, r.body).toBe(201);
    const enjeu = (await objets(rssi)).find((o) => o.ref === r.json().ref)!;
    expect(enjeu).toMatchObject({ type: 'external_issue', src: [{ k: 'map' }] });
    expect(
      (await contrib.post('/api/carto/objects', { type: 'issue', name: 'menace fictive créée', kind: 'int' }))
        .statusCode,
    ).toBe(409);
    const derive = (await objets(rssi)).find((o) => o.type === 'internal_issue' && o.src?.[0]?.k !== 'map')!;
    expect(
      (await contrib.post('/api/carto/objects', { type: 'issue', name: derive.name, kind: 'int' })).statusCode,
    ).toBe(409);
    const m = await t.svc.db.one<{ settings: { issues: unknown[] } }>(
      "SELECT settings FROM maps WHERE view = 'context'",
    );
    expect(m!.settings.issues).toEqual([{ label: 'Menace fictive créée', kind: 'ext' }]);
    expect((await lecteur.get('/api/carto/maps')).json()).toEqual([]);
  });

  it('renommer : module d’origine modifié et journalisé ; objets repérés par leur libellé refusés', async () => {
    const objs = await objets(rssi);
    const proc = objs.find((o) => o.ref === 'process:PRR-001')!;
    const r = await contrib.put('/api/carto/objects/name', { ref: proc.ref, name: 'Concevoir (renommé, fictif)' });
    expect(r.statusCode, r.body).toBe(200);
    expect((await objets(rssi)).find((o) => o.ref === proc.ref)!.name).toBe('Concevoir (renommé, fictif)');
    const row = await t.svc.db.one<{ details: { old: string } }>(
      "SELECT details FROM audit_log WHERE action = 'carto.object_rename' ORDER BY id DESC LIMIT 1",
    );
    expect(row!.details.old).toBe(proc.name);
    await contrib.put('/api/carto/objects/name', { ref: proc.ref, name: proc.name });
    const site = objs.find((o) => o.type === 'site')!;
    expect((await contrib.put('/api/carto/objects/name', { ref: site.ref, name: 'x' })).statusCode).toBe(422);
    expect((await contrib.put('/api/carto/objects/name', { ref: 'pi:inexistant', name: 'x' })).statusCode).toBe(404);
    expect((await lecteur.put('/api/carto/objects/name', { ref: proc.ref, name: 'x' })).statusCode).toBe(403);
    expect((await sansFournisseurs.put('/api/carto/objects/name', { ref: proc.ref, name: 'x' })).statusCode).toBe(403);
  });
});

describe('reprise du module legacy « maps » (CARTO-14)', () => {
  it('import de la fixture : cartes dans les tables, /legacy en lecture seule, export identique', async () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as JsonObject;
    const sim = await admin.req('POST', '/api/admin/import/simulate?mode=merge', {
      body: Buffer.from(JSON.stringify(fixture)),
      headers: { 'x-file-name': 'fixture.json' },
    });
    expect(sim.json().report.affected).toContain('maps');
    expect(sim.json().report.unknownPaths).not.toContainEqual(expect.stringMatching(/^\$\.maps/));
    const { batch } = await importer(admin, fixture);
    const rows = await t.svc.db.q<{ view: string; n: number }>(
      'SELECT m.view, (SELECT count(*)::int FROM map_versions v WHERE v.map_id = m.id) AS n FROM maps m ORDER BY 1',
    );
    expect(rows.rows).toEqual([
      { view: 'context', n: 1 },
      { view: 'process', n: 0 },
    ]);
    expect((await t.svc.db.one<{ has: boolean }>("SELECT data ? 'maps' AS has FROM app_state"))!.has).toBe(false);
    // Recomposition et export : S.maps à l'identique.
    const st = await admin.get('/api/suivi/etat');
    expect(deepEqual(st.json().maps as Json, fixture.maps as Json)).toBe(true);
    const exp = await admin.get('/api/admin/export/legacy');
    expect(exp.statusCode).toBe(200);
    const exported = JSON.parse(exp.body) as JsonObject;
    const data = (exported.data ?? exported) as JsonObject;
    expect(deepEqual(data.maps as Json, fixture.maps as Json)).toBe(true);
    // Annulation de l'import : cartes retirées (elles n'existaient pas avant).
    const undo = await admin.post(`/api/admin/import/${batch}/undo`);
    expect(undo.statusCode, undo.body).toBe(200);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM maps'))!.n).toBe(0);
    expect('maps' in (await admin.get('/api/suivi/etat')).json()).toBe(false);
  });
  it('lecteur sans cartographie:lire : la clé « maps » est masquée dans /legacy', async () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as JsonObject;
    await importer(admin, fixture);
    await t.svc.db.q("INSERT INTO roles(id, name, permissions) VALUES ('r_audit', 'Audit seul', '{audit:lire}')");
    const a = await login(t, await makeUser(t, 'auditseul', 'r_audit'));
    expect((await a.get('/api/suivi/etat')).json().maps).toEqual({});
  });
  it('notes, cadres libres et enjeux créés sur la carte : aller-retour à l’identique (CARTO-15, CARTO-19)', async () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as JsonObject;
    const maps = structuredClone(fixture.maps) as JsonObject;
    const ctx = maps.context as JsonObject;
    (ctx.nodes as JsonObject)['note:n1'] = { x: 40, y: -200, w: 220, h: 110, label: 'Note fictive' };
    ctx.free = { 'note:n1': { text: 'Note fictive', tint: 'orange' } };
    maps.issues = [{ label: 'Enjeu fictif créé sur la carte', kind: 'ext', desc: 'Exemple fictif' }];
    await importer(admin, { ...fixture, maps });
    expect(deepEqual((await admin.get('/api/suivi/etat')).json().maps as Json, maps as Json)).toBe(true);
    const carte = ((await rssi.get('/api/carto/maps')).json() as { view: string; layout: MapLayout }[]).find(
      (m) => m.view === 'context',
    )!;
    expect(carte.layout.free).toEqual({ 'note:n1': { text: 'Note fictive', tint: 'orange' } });
    const objs = (await rssi.get('/api/carto/objects')).json().objects as { name: string; type: string }[];
    expect(objs).toContainEqual(
      expect.objectContaining({ name: 'Enjeu fictif créé sur la carte', type: 'external_issue' }),
    );
  });
});

describe('migration 005 : reprise des cartes de la bêta déjà dessinées (CARTO-14)', () => {
  it('copie S.maps d’app_state dans les tables, à l’identique', async () => {
    const dbName = await createDatabase();
    const t2 = await createTestApp({}, { migrate: false, dbName });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'carto-'));
      for (const f of ['001_init.sql', '002_v3_fondations.sql', '003_droits.sql', '004_affichage_et_ecrans_muraux.sql'])
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t2.svc.db.migrate(avant);
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as JsonObject;
      await t2.svc.db.q("INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, $1, 'x', 'v2')", [
        fixture,
      ]);
      expect(await t2.svc.db.migrate()).toEqual([
        '005_cartographie.sql',
        '006_sauvegardes.sql',
        '007_exploitation.sql',
        '008_activation_modules.sql',
        '009_mises_a_jour.sql',
        '010_configuration_environnement.sql',
        '011_evaluations_versionnees.sql',
        '012_catalogues_metier.sql',
        '013_socle_smsi_grc.sql',
        '014_automatisation_smsi.sql',
        '015_pilotage_decisions.sql',
        '016_risques_acceptation.sql',
        '017_perimetres_nature.sql',
        '018_bibliotheque_referentiels.sql',
        '019_correspondances_rapprochements.sql',
        '020_fournisseurs_organisation.sql',
        '021_catalogue_configuration.sql',
        '022_hierarchie_perimetres.sql',
        '023_investissements_tables.sql',
        '024_collections_suivi_tables.sql',
        '025_cles_multi_listes_tables.sql',
        '026_coeur_suivi_tables.sql',
        '027_evaluations_exigences.sql',
        '028_sous_listes_en_tables.sql',
        '029_registres_droits_ressources.sql',
        '030_validations_occurrences.sql',
        '031_fonctions_responsables.sql',
        '032_plans_actions_conteneurs.sql',
        '033_retrait_constats_historiques.sql',
        '034_journal_technique.sql',
        '035_types_processus.sql',
        '036_contributions_elements.sql',
        '037_retrait_environnement.sql',
        '038_parcours_associations.sql',
        '039_calendriers_plateforme.sql',
        '040_courriel_jobs.sql',
        '041_tls_modes.sql',
        '042_kit_ia.sql',
      ]);
      const st = await t2.svc.legacy.recompose();
      expect(deepEqual(st!.data.maps as Json, fixture.maps as Json)).toBe(true);
      const n = await t2.svc.db.one<{ maps: number; versions: number }>(
        'SELECT (SELECT count(*)::int FROM maps) AS maps, (SELECT count(*)::int FROM map_versions) AS versions',
      );
      expect(n).toEqual({ maps: 2, versions: 1 });
    } finally {
      await t2.close();
    }
  });
});
