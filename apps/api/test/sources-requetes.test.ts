/* Requêtes du sélecteur de références (conversion Kysely, ADR 0062) : fiches filtrées par type demandé (liste vide :
   aucune fiche), versions de documents, exigences des référentiels de la bibliothèque rattachés (couple référentiel,
   version). Données fictives : aucun texte normatif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, scope: string, libA: string, libB: string, docId: string;
const definition = (identifier: string, ids: string[]): FrameworkDefinition => ({
  name: `Référentiel ${identifier}`,
  identifier,
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-27',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
  requirements: ids.map((id) => ({
    id,
    domain: 'gouvernance',
    title: `Revue ${id}`,
    description: 'Fictif',
    applicability: 'Tout',
    measureRefs: [],
  })),
});
async function publier(def: FrameworkDefinition, id: string | null, expected: number) {
  const p = await a.post('/api/library/frameworks/preview', { id, definition: def });
  const r = await a.post(
    '/api/library/frameworks/publish',
    { id, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': `"${expected}"` },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}
type Item = { ref: string; name: string; kind: string };
const chercher = async (cibles?: string) =>
  (
    await a.get(`/api/grc/${scope}/sources?search=Revue${cibles ? '&cibles=' + encodeURIComponent(cibles) : ''}`)
  ).json() as { items: Item[]; truncated: boolean };

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'src_admin', 'admin'));
  scope = (
    await a.post('/api/grc/smsis', { name: 'Périmètre sources', scope: 'Recette', timezone: 'Europe/Paris' })
  ).json().id;
  for (const name of ['Revue des accès', 'Revue annuelle', 'Autre mesure'])
    expect((await a.post(`/api/grc/${scope}/objects`, { kind: 'measure', name, data: {} })).statusCode).toBe(200);
  // Référentiel A rattaché en v1 ; référentiel B publié deux fois, rattaché en v2.
  libA = await publier(definition('SRC-A', ['A-1']), null, 0);
  libB = await publier(definition('SRC-B', ['B-1']), null, 0);
  await publier(definition('SRC-B', ['B-1', 'B-2']), libB, 1);
  for (const [lib, version] of [
    [libA, 1],
    [libB, 2],
  ] as const)
    expect(
      (await a.put(`/api/grc/${scope}/framework-attachments/${lib}`, { version, confirm: 'RATTACHER' })).statusCode,
    ).toBe(200);
  docId = (await t.svc.db.one<{ id: string }>(
    "INSERT INTO documents(title, current_version, created_by, updated_by) VALUES ('Revue documentaire', 2, 'src_admin', 'src_admin') RETURNING id",
  ))!.id;
  for (const v of [1, 2])
    await t.svc.db.q(
      `INSERT INTO document_versions(document_id, version, filename, mime, size, sha256, key_id, iv, auth_tag, content, uploaded_by)
       VALUES ($1,$2,'revue.txt','text/plain',1,'0','cle',$3,$3,$3,'src_admin')`,
      [docId, v, Buffer.from('x')],
    );
});
afterAll(() => t.close());

describe('sélecteur de références', () => {
  it('fiches, documents et exigences rattachées, selon les types demandés', async () => {
    const tout = await chercher();
    const fiches = tout.items.filter((i) => i.ref.startsWith('object:'));
    expect(fiches.map((i) => [i.name, i.kind])).toEqual([
      ['Revue annuelle', 'measure'],
      ['Revue des accès', 'measure'],
    ]);
    expect(tout.items.filter((i) => i.kind === 'evidence')).toEqual([
      { ref: `document:${docId}:2`, name: 'Revue documentaire · preuve v2', kind: 'evidence' },
      { ref: `document:${docId}:1`, name: 'Revue documentaire · preuve v1', kind: 'evidence' },
    ]);
    expect(
      tout.items
        .filter((i) => i.kind === 'requirement')
        .map((i) => i.ref)
        .sort(),
    ).toEqual([`requirement:${libA}:1:A-1`, `requirement:${libB}:2:B-1`, `requirement:${libB}:2:B-2`].sort());

    // Type d'objet demandé : seules ces fiches, ni documents ni exigences.
    expect((await chercher('object:measure')).items.map((i) => i.name)).toEqual(['Revue annuelle', 'Revue des accès']);
    expect((await chercher('object:evidence')).items).toEqual([]);
    // Aucun type d'objet demandé dans la liste : aucune fiche.
    expect((await chercher('document')).items.map((i) => i.kind)).toEqual(['evidence', 'evidence']);
    expect(
      (await chercher('requirement')).items.every((i) => i.kind === 'requirement' && i.ref.startsWith('requirement:')),
    ).toBe(true);
    // Document supprimé : plus proposé.
    await t.svc.db.q('UPDATE documents SET deleted_at=now() WHERE id=$1', [docId]);
    expect((await chercher('document')).items).toEqual([]);
  });
});
