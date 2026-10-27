/* Requêtes des correspondances de la bibliothèque (conversion Kysely, ADR 0062) : forme renvoyée (extrémités regroupées,
   dates), filtres de la liste (référentiel, statut, aucun), versions successives et instantanés de l'historique.
   Données fictives : aucun texte normatif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, fa: string, fb: string, fc: string;
const definition = (identifier: string, ids: string[]): FrameworkDefinition => ({
  name: `Référentiel ${identifier}`,
  identifier,
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-26',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
  requirements: ids.map((id) => ({
    id,
    domain: 'gouvernance',
    title: `Exigence ${id}`,
    description: 'Fictif',
    applicability: 'Tout',
    measureRefs: [],
  })),
});
async function publier(identifier: string, ids: string[]) {
  const def = definition(identifier, ids);
  const p = await a.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await a.post(
    '/api/library/frameworks/publish',
    { id: null, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}
const req = (fw: string, id: string) => ({ frameworkId: fw, version: 1, requirementId: id });
const corps = (s: unknown, tg: unknown, type: string, coverage: number) => ({
  source: s,
  target: tg,
  type,
  justification: 'Correspondance fictive de recette',
  coverage,
  origin: 'human',
  sourceUrl: 'https://example.invalid/correspondance',
});
type Correspondance = {
  id: string;
  source: { frameworkId: string; version: number; requirementId: string };
  target: { frameworkId: string; version: number; requirementId: string };
  status: string;
  version: number;
  type: string;
  coverage: number;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
  validatedBy: string | null;
  validatedAt: string | null;
};
const lister = async (q = '') => (await a.get(`/api/library/mappings${q}`)).json() as Correspondance[];
const ids = (l: Correspondance[]) => l.map((m) => m.id).sort();

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'map_admin', 'admin'));
  fa = await publier('MAP-A', ['A-1', 'A-2']);
  fb = await publier('MAP-B', ['B-1', 'B-2']);
  fc = await publier('MAP-C', ['C-1']);
});
afterAll(() => t.close());

describe('correspondances de la bibliothèque', () => {
  it('renvoie la forme attendue, filtre la liste et historise chaque version', async () => {
    const r1 = await a.post('/api/library/mappings', corps(req(fa, 'A-1'), req(fb, 'B-1'), 'equivalent', 100));
    expect(r1.statusCode, r1.body).toBe(200);
    const m1 = r1.json() as Correspondance;
    expect(m1).toMatchObject({
      source: { frameworkId: fa, version: 1, requirementId: 'A-1' },
      target: { frameworkId: fb, version: 1, requirementId: 'B-1' },
      status: 'proposed',
      version: 1,
      reviewNote: '',
      validatedBy: null,
      validatedAt: null,
    });
    expect(Object.keys(m1).sort()).toEqual(
      [
        'id',
        'source',
        'target',
        'type',
        'justification',
        'coverage',
        'origin',
        'status',
        'sourceUrl',
        'reviewNote',
        'version',
        'createdBy',
        'createdAt',
        'updatedBy',
        'updatedAt',
        'validatedBy',
        'validatedAt',
      ].sort(),
    );
    expect(new Date(m1.createdAt).toISOString()).toBe(m1.createdAt);

    const m2 = (await a.post('/api/library/mappings', corps(req(fb, 'B-2'), req(fc, 'C-1'), 'partial', 30))).json();
    // Doublon refusé tant que la première n'est pas retirée.
    expect(
      (await a.post('/api/library/mappings', corps(req(fa, 'A-1'), req(fb, 'B-1'), 'partial', 10))).statusCode,
    ).toBe(409);

    // Modification d'une proposition : nouvelle version, champs écrits.
    const u = await a.put(`/api/library/mappings/${m1.id}`, corps(req(fa, 'A-2'), req(fb, 'B-1'), 'partial', 40), {
      'if-match': '"1"',
    });
    expect(u.statusCode, u.body).toBe(200);
    expect(u.json()).toMatchObject({
      source: { requirementId: 'A-2' },
      type: 'partial',
      coverage: 40,
      version: 2,
      status: 'proposed',
    });
    // Validation : statut, note, auteur et date de validation.
    const v = await a.post(
      `/api/library/mappings/${m1.id}/validate`,
      { note: 'Examinée par le responsable', confirm: 'VALIDER' },
      { 'if-match': '"2"' },
    );
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json()).toMatchObject({
      status: 'validated',
      reviewNote: 'Examinée par le responsable',
      validatedBy: 'map_admin',
      version: 3,
    });
    expect(typeof v.json().validatedAt).toBe('string');
    expect(
      (
        await a.put(`/api/library/mappings/${m1.id}`, corps(req(fa, 'A-1'), req(fb, 'B-1'), 'partial', 1), {
          'if-match': '"3"',
        })
      ).statusCode,
    ).toBe(409);
    // Retrait de la seconde.
    const w = await a.post(
      `/api/library/mappings/${m2.id}/withdraw`,
      { note: 'Retirée en recette', confirm: 'RETIRER' },
      { 'if-match': '"1"' },
    );
    expect(w.statusCode, w.body).toBe(200);
    expect(w.json()).toMatchObject({
      status: 'withdrawn',
      reviewNote: 'Retirée en recette',
      version: 2,
      validatedBy: null,
    });

    // Filtres de la liste.
    expect(ids(await lister())).toEqual([m1.id, m2.id].sort());
    expect(ids(await lister(`?frameworkId=${fa}`))).toEqual([m1.id]);
    expect(ids(await lister(`?frameworkId=${fb}`))).toEqual([m1.id, m2.id].sort());
    expect(ids(await lister(`?frameworkId=${fc}`))).toEqual([m2.id]);
    expect(ids(await lister('?status=validated'))).toEqual([m1.id]);
    expect(ids(await lister('?status=withdrawn'))).toEqual([m2.id]);
    expect(ids(await lister(`?frameworkId=${fc}&status=validated`))).toEqual([]);
    // Tri : la plus récemment modifiée d'abord.
    expect((await lister()).map((m) => m.id)).toEqual([m2.id, m1.id]);

    // Historique : un instantané complet par version, dans l'ordre.
    const h = await t.svc.db.q<{ version: number; reason: string; snapshot: Correspondance; created_by: string }>(
      'SELECT version,reason,snapshot,created_by FROM lib_mapping_history WHERE mapping_id=$1 ORDER BY version',
      [m1.id],
    );
    expect(h.rows.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(h.rows.map((r) => r.snapshot.status)).toEqual(['proposed', 'proposed', 'validated']);
    expect(h.rows[1]!.snapshot.source).toEqual({ frameworkId: fa, version: 1, requirementId: 'A-2' });
    expect(h.rows[2]!.snapshot).toEqual(v.json());
    expect(h.rows.every((r) => r.created_by === 'map_admin' && r.reason.length > 0)).toBe(true);
  });
});
