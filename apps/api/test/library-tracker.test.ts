/* Import des référentiels de l'outil de suivi dans la bibliothèque (ADR 0033) : simulation sans écriture, confirmation
   explicite, aucune donnée inventée. L'état de départ est le jeu de données du dépôt (intitulés seulement). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LibraryFrameworkDefinition } from '@suivi/shared';
import { trackerCandidates } from '../src/grc/library-tracker.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const seed = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../seed/state.json'), 'utf8')) as Record<
  string,
  unknown
>;

describe('transformation de l’état de l’outil de suivi', () => {
  const candidats = trackerCandidates(seed);
  it('produit ISO 27001:2022, HDS et le référentiel de la liste, tous valides pour la bibliothèque', () => {
    expect(candidats.map((c) => c.definition.identifier)).toEqual(['iso-27001-2022', 'hds', 'recyf-2.5']);
    for (const c of candidats)
      expect(() => LibraryFrameworkDefinition.parse(c.definition), c.definition.name).not.toThrow();
  });
  it('reprend les 33 clauses et les 93 mesures de l’Annexe A, avec les seuls intitulés', () => {
    const iso = candidats[0]!.definition;
    expect(iso.requirements).toHaveLength(33 + 93);
    expect(iso.requirements.every((r) => r.description === '' && r.applicability === '')).toBe(true);
    expect(iso.requirements.find((r) => r.id === 'A.5.1')?.title).toBe("Politiques de sécurité de l'information");
    expect(iso.requirements.find((r) => r.id === '9.3.2')).toBeTruthy();
  });
  it('ne présente aucune source comme vérifiée ou normative et signale les intitulés tronqués', () => {
    for (const c of candidats) {
      expect(c.definition.source).toMatchObject({ normative: false, status: 'unverified', verifiedAt: '' });
    }
    expect(candidats[1]!.definition.requirements).toHaveLength(31);
    expect(candidats[1]!.notes.join(' ')).toMatch(/31 intitulé\(s\) sont tronqués/);
  });
  it('reprend les 152 exigences du ReCyF avec leur texte, sans les données d’évaluation du périmètre', () => {
    const r = candidats[2]!.definition;
    expect(r.requirements).toHaveLength(152);
    expect(r.requirements[0]!.description.length).toBeGreaterThan(50);
    expect(JSON.stringify(r)).not.toMatch(/"comment"|"self"|"maps"/);
    expect(r.domains).toHaveLength(20);
  });
  it('est vide sans référentiel dans l’état', () => {
    expect(trackerCandidates({})).toEqual([]);
    expect(trackerCandidates({ frameworks: [{ id: 'x', requirements: [{ id: '1' }] }] })).toEqual([]);
  });
});

describe('API d’import', () => {
  let t: TestApp, a: Agent, reader: Agent;
  beforeAll(async () => {
    t = await createTestApp();
    a = await login(t, await makeUser(t, 'trk_admin', 'admin'));
    reader = await login(t, await makeUser(t, 'trk_reader', 'ro'));
    await t.svc.db.q(
      `INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, $1, 'x', 'test')
       ON CONFLICT (id) DO UPDATE SET data = $1`,
      [JSON.stringify(seed)],
    );
  });
  afterAll(async () => t.close());
  it('refuse la lecture seule', async () => {
    expect((await reader.get('/api/library/tracker-import')).statusCode).toBe(403);
  });
  it('simule sans rien écrire, puis importe après confirmation, une seule fois', async () => {
    const avant = (await a.get('/api/library/frameworks')).json().length;
    const sim = (await a.get('/api/library/tracker-import')).json() as {
      definition: { identifier: string };
      previewId: string;
      duplicate: boolean;
      notes: string[];
    }[];
    expect(sim.map((x) => x.definition.identifier)).toEqual(['iso-27001-2022', 'hds', 'recyf-2.5']);
    expect((await a.get('/api/library/frameworks')).json()).toHaveLength(avant);
    const iso = sim.find((s) => s.definition.identifier === 'iso-27001-2022')!;
    expect(iso.duplicate).toBe(false);
    const sans = await a.post('/api/library/tracker-import', {
      identifier: iso.definition.identifier,
      previewId: iso.previewId,
    });
    expect(sans.statusCode).toBe(422);
    expect(
      (
        await a.post('/api/library/tracker-import', {
          identifier: 'inconnu',
          previewId: iso.previewId,
          confirm: 'IMPORTER',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await a.post('/api/library/tracker-import', {
          identifier: iso.definition.identifier,
          previewId: 'a'.repeat(64),
          confirm: 'IMPORTER',
        })
      ).statusCode,
    ).toBe(422);
    const ok = await a.post('/api/library/tracker-import', {
      identifier: iso.definition.identifier,
      previewId: iso.previewId,
      confirm: 'IMPORTER',
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await a.get('/api/library/frameworks')).json()).toHaveLength(avant + 1);
    const apres = (await a.get('/api/library/tracker-import')).json() as typeof sim;
    expect(apres.find((s) => s.definition.identifier === 'iso-27001-2022')!.duplicate).toBe(true);
    const encore = await a.post('/api/library/tracker-import', {
      identifier: iso.definition.identifier,
      previewId: iso.previewId,
      confirm: 'IMPORTER',
    });
    expect(encore.statusCode).toBe(409);
  });
});
