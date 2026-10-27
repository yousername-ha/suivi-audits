/* Requêtes des imports legacy (conversion Kysely, ADR 0062) : historique (colonnes résumées, total du rapport), détail,
   lot inconnu, état stocké après application et annulation. Données de la fixture anonymisée. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, fixturePath, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent;
const buf = () => readFileSync(fixturePath);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const RESUME = [
  'id',
  'created_at',
  'created_by',
  'filename',
  'size',
  'sha256',
  'source_schema',
  'envelope',
  'mode',
  'module',
  'modules',
  'totals',
  'state_version_before',
  'state_version_after',
  'status',
  'undone_at',
  'undone_by',
  'version',
];

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'imp_admin', 'admin'));
});
afterAll(() => t.close());

describe('imports legacy', () => {
  it('historique, détail, état stocké et annulation', async () => {
    const r = await a.req('POST', `/api/admin/import/apply?mode=init&sha256=${sha(buf())}`, {
      body: buf(),
      headers: { 'x-file-name': 'fixture.json' },
    });
    expect(r.statusCode, r.body).toBe(201);
    const { batch, stateVersion, report } = r.json() as { batch: number; stateVersion: number; report: unknown };

    const brut = await t.svc.db.one<{
      state_version_after: number;
      before_state: { values: object; absent: string[] };
      after_state: { values: object };
      report: unknown;
    }>('SELECT state_version_after, before_state, after_state, report FROM import_batches WHERE id=$1', [batch]);
    expect(brut!.state_version_after).toBe(stateVersion);
    expect(brut!.report).toEqual(report);
    expect(Array.isArray(brut!.before_state.absent)).toBe(true);
    expect(Object.keys(brut!.after_state.values).length).toBeGreaterThan(0);

    const liste = (await a.get('/api/admin/import')).json() as Record<string, unknown>[];
    expect(liste).toHaveLength(1);
    expect(Object.keys(liste[0]!).sort()).toEqual([...RESUME].sort());
    expect(liste[0]).toMatchObject({
      id: batch,
      created_by: 'imp_admin',
      filename: 'fixture.json',
      size: buf().length,
      sha256: sha(buf()),
      mode: 'init',
      module: null,
      state_version_after: stateVersion,
      status: 'applied',
      undone_at: null,
      undone_by: null,
      version: 1,
      totals: (report as { totals: unknown }).totals,
    });

    const detail = await a.get(`/api/admin/import/${batch}`);
    expect(detail.statusCode).toBe(200);
    expect(Object.keys(detail.json()).sort()).toEqual([...RESUME, 'report'].sort());
    expect(detail.json().report).toEqual(report);
    expect((await a.get(`/api/admin/import/${batch + 100}`)).statusCode).toBe(404);
    expect((await a.get(`/api/admin/import/${batch + 100}/file`)).statusCode).toBe(404);
    expect((await a.post(`/api/admin/import/${batch + 100}/undo`)).statusCode).toBe(404);

    const u = await a.post(`/api/admin/import/${batch}/undo`);
    expect(u.statusCode, u.body).toBe(200);
    const apres = (await a.get('/api/admin/import')).json() as Record<string, unknown>[];
    expect(apres[0]).toMatchObject({ status: 'undone', undone_by: 'imp_admin', version: 2 });
    expect(typeof apres[0]!.undone_at).toBe('string');

    // Deuxième import : l'historique est trié du plus récent au plus ancien.
    const r2 = await a.req('POST', `/api/admin/import/apply?mode=init&sha256=${sha(buf())}`, {
      body: buf(),
      headers: { 'x-file-name': 'fixture.json' },
    });
    expect(r2.statusCode, r2.body).toBe(201);
    expect(((await a.get('/api/admin/import')).json() as { id: number }[]).map((x) => x.id)).toEqual([
      r2.json().batch,
      batch,
    ]);
  });
});
