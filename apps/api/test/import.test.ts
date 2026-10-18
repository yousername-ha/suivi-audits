import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonical, migrateToSchema15, type Json, type JsonObject } from '@suivi/shared/legacy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '../src/db/db.js';
import { createTestApp, fixturePath, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp;
let admin: TestUser, rw: TestUser;
let a: Agent;
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const fixtureBuf = () => readFileSync(fixturePath);
const fixture = (): JsonObject => JSON.parse(readFileSync(fixturePath, 'utf8'));

const simulate = (buf: Buffer, q: string) =>
  a.req('POST', `/api/admin/import/simulate?${q}`, { body: buf, headers: { 'x-file-name': 'fixture.json' } });
const apply = (buf: Buffer, q: string) =>
  a.req('POST', `/api/admin/import/apply?${q}&sha256=${sha(buf)}`, {
    body: buf,
    headers: { 'x-file-name': 'fixture.json' },
  });

/** Empreinte complète de la base : toutes les tables, ligne par ligne. */
async function dbFingerprint(): Promise<string> {
  const tables = (
    await t.svc.db.q<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")
  ).rows.map((r) => r.tablename);
  const parts: string[] = [];
  for (const tb of tables) {
    const r = await t.svc.db.q<{ h: string | null; n: string }>(
      `SELECT md5(string_agg(x::text, '|' ORDER BY x::text)) AS h, count(*)::text AS n FROM "${tb}" x`,
    );
    parts.push(`${tb}:${r.rows[0]!.n}:${r.rows[0]!.h}`);
  }
  const seqs = await t.svc.db.q<{ s: string }>(
    "SELECT string_agg(sequencename || '=' || coalesce(last_value::text,'∅'), ',' ORDER BY sequencename) AS s FROM pg_sequences",
  );
  return parts.join('\n') + '\n' + seqs.rows[0]!.s;
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'admin', 'admin');
  rw = await makeUser(t, 'redacteur', 'rw');
  a = await login(t, admin);
});
afterAll(() => t.close());

describe('import legacy : validation et simulation', () => {
  it('la simulation n’écrit RIEN en base (toutes tables et séquences comparées)', async () => {
    const before = await dbFingerprint();
    for (const q of ['mode=init', 'mode=merge', 'mode=replace&module=findings']) {
      const r = await simulate(fixtureBuf(), q);
      expect(r.statusCode, r.body).toBe(200);
    }
    expect(await simulate(Buffer.from('{"schema": 12}'), 'mode=merge').then((r) => r.statusCode)).toBe(422);
    expect(await dbFingerprint()).toBe(before);
  });

  it('rapport par module : créations, références cassées, chemins inconnus', async () => {
    const r = (await simulate(fixtureBuf(), 'mode=init')).json();
    expect(r.sha256).toBe(sha(fixtureBuf()));
    expect(r.report.sourceSchema).toBe(14);
    const findings = r.report.modules.find((m: { module: string }) => m.module === 'findings');
    expect(findings.label).toBe('Écarts et actions');
    expect(findings.collections[0]).toMatchObject({ path: '$.findings', created: 2 });
    expect(r.report.unknownPaths).toEqual(['$.suppliers[].MFA-001']);
    expect(r.report.brokenRefs.length).toBeGreaterThan(0);
  });

  it('refuse un fichier au schéma 13 ou antérieur avec un message clair', async () => {
    const f = fixture();
    f.schema = 13;
    const r = await simulate(Buffer.from(JSON.stringify(f)), 'mode=merge');
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toMatch(/schéma 13, trop ancien.*réexportez/);
  });

  it('refuse un fichier qui n’est pas du JSON, ou une enveloppe altérée', async () => {
    expect((await simulate(Buffer.from('<html>'), 'mode=merge')).json().error).toMatch(/JSON valide/);
    const data = migrateToSchema15(fixture());
    const env = {
      format: 'suivi-audits-legacy',
      formatVersion: 1,
      schema: 15,
      exportedAt: 'x',
      appVersion: 'x',
      sha256: '0'.repeat(64),
      data,
    };
    expect((await simulate(Buffer.from(JSON.stringify(env)), 'mode=merge')).json().error).toMatch(/empreinte/);
  });

  it('réservé aux administrateurs', async () => {
    const w = await login(t, rw);
    expect((await w.req('POST', '/api/admin/import/simulate?mode=merge', { body: fixtureBuf() })).statusCode).toBe(403);
  });
});

describe('import legacy : application, aller-retour, annulation', () => {
  let batch = 0;

  it('refuse d’appliquer un fichier différent de celui qui a été simulé', async () => {
    const r = await a.req('POST', `/api/admin/import/apply?mode=init&sha256=${'a'.repeat(64)}`, { body: fixtureBuf() });
    expect(r.statusCode).toBe(409);
  });

  it('Initialiser : transaction, fichier brut chiffré, sauvegarde préalable, journal d’audit', async () => {
    const versionBefore = (await t.svc.db.one<{ version: number }>('SELECT version FROM app_state'))!.version;
    const r = await apply(fixtureBuf(), 'mode=init');
    expect(r.statusCode, r.body).toBe(201);
    batch = r.json().batch;
    const b = await t.svc.db.one<{ raw_content: Buffer; sha256: string; status: string; modules: string[] }>(
      'SELECT * FROM import_batches WHERE id=$1',
      [batch],
    );
    expect(b!.status).toBe('applied');
    expect(b!.sha256).toBe(sha(fixtureBuf()));
    expect(b!.raw_content.includes(Buffer.from('"findings"'))).toBe(false); // chiffré
    expect(b!.modules).toContain('findings');
    const saved = await t.svc.db.one<{ note: string }>('SELECT note FROM state_history WHERE version=$1', [
      versionBefore,
    ]);
    // La version d'avant l'import reste dans l'historique avec une note (jamais fusionnée ni purgée par l'import).
    expect(['Données initiales', `Sauvegarde avant l'import n°${batch}`]).toContain(saved!.note);
    const audit = await t.svc.db.one('SELECT 1 FROM audit_log WHERE action=$1 AND target=$2', [
      'import.apply',
      `import:${batch}`,
    ]);
    expect(audit).toBeTruthy();
    const file = await a.get(`/api/admin/import/${batch}/file`);
    expect(file.rawPayload.equals(fixtureBuf())).toBe(true);
  });

  it('aller-retour : import puis réexport identique après normalisation (schéma 15)', async () => {
    const r = await a.get('/api/admin/export/legacy');
    expect(r.statusCode).toBe(200);
    const env = r.json();
    expect(env).toMatchObject({ format: 'suivi-audits-legacy', formatVersion: 1, schema: 15 });
    expect(env.sha256).toBe(sha(JSON.stringify(env.data)));
    expect(canonical(env.data as Json)).toEqual(canonical(migrateToSchema15(fixture())));
    // L'enveloppe exportée se réimporte sans aucun changement.
    const again = (await simulate(Buffer.from(JSON.stringify(env)), 'mode=merge')).json();
    expect(again.report.affected).toEqual([]);
    expect(again.report.totals.created + again.report.totals.updated + again.report.totals.deleted).toBe(0);
  });

  it('Initialiser est refusé sur une base qui contient des données', async () => {
    const r = await simulate(fixtureBuf(), 'mode=init');
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toMatch(/base vide/);
  });

  it('Fusionner, puis Remplacer un module avec confirmation renforcée', async () => {
    const f = migrateToSchema15(fixture());
    (f.findings as JsonObject[])[0]!.status = 'Clos';
    (f.findings as JsonObject[]).push({ id: 'ID-900', source: 'Interne', year: 2026, text: 'Nouvel écart' });
    const buf = Buffer.from(JSON.stringify(f));
    const m = await apply(buf, 'mode=merge');
    expect(m.statusCode, m.body).toBe(201);
    expect(m.json().report.affected).toEqual(['findings']);
    expect(
      m.json().report.modules.find((x: { module: string }) => x.module === 'findings').collections[0],
    ).toMatchObject({ created: 1, updated: 1, deleted: 0 });
    const g = migrateToSchema15(fixture());
    (g.findings as JsonObject[]).splice(1);
    const gbuf = Buffer.from(JSON.stringify(g));
    expect((await apply(gbuf, 'mode=replace&module=findings')).statusCode).toBe(422); // sans confirmation
    const rep = await apply(gbuf, 'mode=replace&module=findings&confirm=findings');
    expect(rep.statusCode, rep.body).toBe(201);
    expect(rep.json().report.modules[0].collections[0].deleted).toBe(2);
    const st = (await a.get('/api/legacy/state')).json();
    expect(st.findings).toHaveLength(1);
  });

  it('annulation : refusée si le module a été modifié depuis, possible sinon', async () => {
    const list = (await a.get('/api/admin/import')).json() as { id: number; mode: string }[];
    const last = list[0]!;
    expect(last.mode).toBe('replace');
    // L'import précédent (fusion) a été suivi d'un remplacement du même module : annulation refusée.
    const prev = list[1]!;
    const ko = await a.post(`/api/admin/import/${prev.id}/undo`);
    expect(ko.statusCode).toBe(409);
    expect(ko.json().modules).toEqual(['findings']);
    // Le dernier peut être annulé : le module retrouve son contenu d'avant.
    const ok = await a.post(`/api/admin/import/${last.id}/undo`);
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await a.get('/api/legacy/state')).json().findings).toHaveLength(3);
    expect((await a.post(`/api/admin/import/${last.id}/undo`)).statusCode).toBe(409);
  });
});

describe('transition : modules repris et /legacy', () => {
  it('/legacy affiche l’état recomposé et refuse les écritures sur un module repris', async () => {
    // Module « swots » repris par un mapper de test (table dédiée), comme le feront les phases 1 à 3.
    await t.svc.db.q('CREATE TABLE test_swots (id text PRIMARY KEY, data jsonb NOT NULL)');
    await t.svc.db.q('INSERT INTO test_swots VALUES (\'SW-1\', \'{"id":"SW-1","process":"Achats"}\')');
    t.svc.legacy.register({
      key: 'swots',
      read: async (c: Client) =>
        (await c.query<{ data: Json }>('SELECT data FROM test_swots ORDER BY id')).rows.map((r) => r.data),
      write: async (c: Client, v: Json) => {
        await c.query('DELETE FROM test_swots');
        for (const e of v as JsonObject[]) await c.query('INSERT INTO test_swots VALUES ($1,$2)', [e.id, e]);
      },
    });
    try {
      const w = await login(t, rw);
      const st = await w.get('/api/legacy/state');
      const data = st.json();
      expect(data.swots).toEqual([{ id: 'SW-1', process: 'Achats' }]);
      const modules = (await w.get('/api/legacy/modules')).json() as { key: string; takenOver: boolean }[];
      expect(modules.find((m) => m.key === 'swots')?.takenOver).toBe(true);

      // Écriture qui ne touche pas au module repris : acceptée, et le module n'est pas copié dans app_state.
      data.source = 'Audit de test';
      const ok = await w.put('/api/legacy/state', data, { 'if-match': st.headers.etag as string });
      expect(ok.statusCode, ok.body).toBe(204);
      expect((await t.svc.db.one<{ has: boolean }>("SELECT data ? 'swots' AS has FROM app_state"))!.has).toBe(false);

      // Écriture qui modifie le module repris : refusée avec le message attendu.
      data.swots = [{ id: 'SW-1', process: 'Modifié depuis legacy' }];
      const ko = await w.put('/api/legacy/state', data, { 'if-match': ok.headers.etag as string });
      expect(ko.statusCode).toBe(409);
      expect(ko.json().error).toMatch(/^Module géré dans la nouvelle interface : Analyses SWOT/);
      expect(ko.json().modules).toEqual(['swots']);

      // La page /legacy reçoit la liste des modules repris (affichage « Module géré dans la nouvelle interface »).
      const page = await w.get('/legacy/');
      expect(page.statusCode).toBe(200);
      for (const cle of ['accessReviews', 'appGaps', 'incidents', 'invest', 'maps', 'plans', 'swots', 'supEvals'])
        expect(page.body, cle).toContain(`{"key":"${cle}","label":`);
      expect(page.headers['content-security-policy']).toMatch(/unsafe-inline/);
    } finally {
      t.svc.legacy.unregister('swots');
    }
  });

  it('/legacy exige une session complète et sert ses bibliothèques locales', async () => {
    const anon = await t.app.inject({ method: 'GET', url: '/legacy/', headers: { 'x-forwarded-proto': 'https' } });
    expect(anon.statusCode).toBe(302);
    expect(anon.headers.location).toBe('/login?next=%2Flegacy%2F');
    const lib = await t.app.inject({ method: 'GET', url: '/legacy/lib/jszip.min.js' });
    expect(lib.statusCode).toBe(200);
    expect((await t.app.inject({ method: 'GET', url: '/legacy/lib/..%2Findex.html' })).statusCode).not.toBe(200);
  });
});
