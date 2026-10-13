/* Bibliothèque de référentiels de l'organisation (ADR 0031, lot M2) : publication hors périmètre par versions
   immuables, rattachement à plusieurs périmètres, résolution des références, détachement protégé et promotion
   explicite d'un référentiel de périmètre. Données fictives : aucun texte normatif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, reader: Agent, scopeA: string, scopeB: string, libId: string, measureId: string;
const definition = (identifier: string, titre = 'Revue de recette'): FrameworkDefinition => ({
  name: `Référentiel ${identifier}`,
  identifier,
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-10-13',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'governance', label: 'Gouvernance' }],
  requirements: [
    { id: '4.1', domain: 'governance', title: titre, description: 'Fictif', applicability: 'Tout', measureRefs: [] },
    {
      id: '4.2',
      domain: 'governance',
      title: 'Deuxième exigence',
      description: 'Fictif',
      applicability: 'Tout',
      measureRefs: [],
    },
  ],
});
async function publier(def: unknown, id: string | null, expected: number) {
  const p = await a.post('/api/library/frameworks/preview', { id, definition: def });
  expect(p.statusCode, p.body).toBe(200);
  return a.post(
    '/api/library/frameworks/publish',
    {
      id,
      definition: def,
      previewId: p.json().previewId,
      reason: 'Publication fictive de recette',
      confirm: 'PUBLIER',
    },
    { 'if-match': `"${expected}"` },
  );
}
const attacher = (smsi: string, version: number, agent = a) =>
  agent.put(`/api/grc/${smsi}/framework-attachments/${libId}`, { version, confirm: 'RATTACHER' });
const lier = (smsi: string, version: number) =>
  a.post(`/api/grc/${smsi}/links`, {
    source: 'object:' + measureId,
    target: `requirement:${libId}:${version}:4.1`,
    type: 'implements',
    note: 'Lien de recette',
  });

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'lib_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'lib_reader', 'ro'));
  scopeA = (
    await a.post('/api/grc/smsis', { name: 'Périmètre A', scope: 'Recette', nature: 'SMSI', timezone: 'Europe/Paris' })
  ).json().id;
  scopeB = (
    await a.post('/api/grc/smsis', { name: 'Périmètre B', scope: 'Recette', nature: 'SMQ', timezone: 'Europe/Paris' })
  ).json().id;
  const m = await a.post(`/api/grc/${scopeA}/objects`, { kind: 'measure', name: 'Mesure fictive', data: {} });
  expect(m.statusCode, m.body).toBe(200);
  measureId = m.json().id;
});
afterAll(() => t.close());

describe('publication dans la bibliothèque', () => {
  it('publie un référentiel hors de tout périmètre, par version immuable', async () => {
    const r = await publier(definition('LIB-FICTIF'), null, 0);
    expect(r.statusCode, r.body).toBe(200);
    libId = r.json().id;
    expect(r.json()).toMatchObject({ identifier: 'LIB-FICTIF', version: 1 });
    const liste = (await a.get('/api/library/frameworks')).json();
    expect(liste.find((f: { id: string }) => f.id === libId)).toMatchObject({ requirements: 2, scopes: 0, version: 1 });
  });

  it('refuse un identifiant déjà pris, un lien vers une mesure et un lecteur', async () => {
    const p = await a.post('/api/library/frameworks/preview', { id: null, definition: definition('LIB-FICTIF') });
    expect(p.json()).toMatchObject({ duplicate: true, canPublish: false });
    expect((await publier(definition('LIB-FICTIF'), null, 0)).statusCode).toBe(409);
    const avecLien = definition('LIB-AVEC-LIEN');
    avecLien.requirements[0]!.measureRefs = ['object:' + measureId];
    expect((await a.post('/api/library/frameworks/preview', { id: null, definition: avecLien })).statusCode).toBe(422);
    expect((await reader.get('/api/library/frameworks')).statusCode).toBe(200);
    const refus = await reader.post('/api/library/frameworks/preview', {
      id: null,
      definition: definition('LIB-LECTEUR'),
    });
    expect(refus.statusCode).toBe(403);
  });

  it('crée une version 2 sans toucher à la version 1, sur version attendue et identifiant stable', async () => {
    const preview = await a.post('/api/library/frameworks/preview', {
      id: libId,
      definition: definition('LIB-FICTIF', 'Titre révisé'),
    });
    const perimee = await a.post(
      '/api/library/frameworks/publish',
      {
        id: libId,
        definition: definition('LIB-FICTIF', 'Titre révisé'),
        previewId: preview.json().previewId,
        reason: 'Publication fictive de recette',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"5"' },
    );
    expect(perimee.statusCode).toBe(412);
    expect(
      (await a.post('/api/library/frameworks/preview', { id: libId, definition: definition('AUTRE-IDENTIFIANT') }))
        .statusCode,
    ).toBe(422);
    const r = await publier(definition('LIB-FICTIF', 'Titre révisé'), libId, 1);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().version).toBe(2);
    const v1 = (await a.get(`/api/library/frameworks/${libId}/versions/1`)).json();
    const v2 = (await a.get(`/api/library/frameworks/${libId}/versions/2`)).json();
    expect(v1.definition.requirements[0].title).toBe('Revue de recette');
    expect(v2.definition.requirements[0].title).toBe('Titre révisé');
    await expect(
      t.svc.db.q('UPDATE lib_framework_versions SET reason=$1 WHERE framework_id=$2 AND version=1', ['x', libId]),
    ).rejects.toThrow();
  });
});

describe('rattachement aux périmètres', () => {
  it('refuse un lien vers un référentiel non rattaché, puis le résout une fois rattaché', async () => {
    expect((await lier(scopeA, 1)).statusCode).toBeGreaterThanOrEqual(400);
    expect((await attacher(scopeA, 9)).statusCode).toBe(404);
    expect((await attacher(scopeA, 1, reader)).statusCode).toBe(403);
    const r = await attacher(scopeA, 1);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()[0]).toMatchObject({ frameworkId: libId, version: 1, latestVersion: 2, enabled: true });
    const lien = await lier(scopeA, 1);
    expect(lien.statusCode, lien.body).toBe(200);
  });

  it('rattache le même référentiel à un second périmètre, sur une autre version', async () => {
    const r = await attacher(scopeB, 2);
    expect(r.statusCode, r.body).toBe(200);
    expect((await a.get(`/api/grc/${scopeB}/framework-attachments`)).json()[0]).toMatchObject({ version: 2 });
    expect((await a.get('/api/library/frameworks')).json().find((f: { id: string }) => f.id === libId).scopes).toBe(2);
    expect(
      (await a.get(`/api/grc/${scopeB}/frameworks/${libId}/versions/2`)).json().definition.requirements,
    ).toHaveLength(2);
  });

  it('propose les exigences des référentiels rattachés et actifs à la recherche de liens', async () => {
    const trouve = async () =>
      JSON.stringify((await a.get(`/api/grc/${scopeA}/sources?search=${encodeURIComponent('Revue')}`)).json());
    expect(await trouve()).toContain(`requirement:${libId}:1:4.1`);
    expect(
      (await a.put(`/api/grc/${scopeA}/framework-attachments/${libId}/activation`, { enabled: false })).statusCode,
    ).toBe(200);
    expect(await trouve()).not.toContain(`requirement:${libId}:1:4.1`);
    await a.put(`/api/grc/${scopeA}/framework-attachments/${libId}/activation`, { enabled: true });
  });

  it('refuse de détacher un référentiel utilisé, l’autorise une fois le lien retiré', async () => {
    const refus = await a.del(`/api/grc/${scopeA}/framework-attachments/${libId}`);
    expect(refus.statusCode).toBe(409);
    expect(refus.json().message ?? refus.body).toMatch(/1 lien/);
    const liens = (await a.get(`/api/grc/${scopeA}/links?ref=${encodeURIComponent('object:' + measureId)}`)).json();
    expect((await a.del(`/api/grc/${scopeA}/links/${liens[0].id}`)).statusCode).toBe(204);
    expect((await a.del(`/api/grc/${scopeA}/framework-attachments/${libId}`)).statusCode).toBe(200);
    expect((await a.get(`/api/grc/${scopeA}/framework-attachments`)).json()).toEqual([]);
    expect((await a.get(`/api/grc/${scopeB}/framework-attachments`)).json()).toHaveLength(1);
  });
});

describe('promotion d’un référentiel de périmètre', () => {
  let sourceId: string;
  const avecMesure = () => {
    const d = definition('PROMU-FICTIF');
    d.requirements[0]!.measureRefs = ['object:' + measureId];
    return d;
  };
  it('simule sans rien écrire, puis copie la version dans la bibliothèque et la rattache', async () => {
    const p = await a.post(`/api/grc/${scopeA}/frameworks/preview`, { id: null, definition: avecMesure() });
    const pub = await a.post(
      `/api/grc/${scopeA}/frameworks/publish`,
      {
        id: null,
        definition: avecMesure(),
        previewId: p.json().previewId,
        reason: 'Référentiel de périmètre fictif',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"0"' },
    );
    expect(pub.statusCode, pub.body).toBe(200);
    sourceId = pub.json().id;
    const avant = (await a.get('/api/library/frameworks')).json().length;
    const sim = await a.post(`/api/grc/${scopeA}/frameworks/${sourceId}/promotion/preview`);
    expect(sim.statusCode, sim.body).toBe(200);
    expect(sim.json()).toMatchObject({ canPromote: true, droppedMeasureRefs: 1, requirements: 2 });
    expect((await a.get('/api/library/frameworks')).json().length).toBe(avant);
    expect(
      (
        await a.post(`/api/grc/${scopeA}/frameworks/${sourceId}/promotion`, {
          previewId: 'f'.repeat(64),
          confirm: 'PROMOUVOIR',
        })
      ).statusCode,
    ).toBe(409);
    const r = await a.post(`/api/grc/${scopeA}/frameworks/${sourceId}/promotion`, {
      previewId: sim.json().previewId,
      confirm: 'PROMOUVOIR',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ version: 1, droppedMeasureRefs: 1 });
    const copie = (await a.get(`/api/library/frameworks/${r.json().libraryFrameworkId}/versions/1`)).json();
    expect(copie.definition.requirements.every((q: { measureRefs: unknown[] }) => q.measureRefs.length === 0)).toBe(
      true,
    );
    expect((await a.get(`/api/grc/${scopeA}/framework-attachments`)).json()[0].frameworkId).toBe(
      r.json().libraryFrameworkId,
    );
    // L'original reste intact et utilisable.
    expect(
      (await a.get(`/api/grc/${scopeA}/frameworks/${sourceId}/versions/1`)).json().definition.requirements[0]
        .measureRefs,
    ).toHaveLength(1);
  });

  it('refuse une seconde promotion de la même version', async () => {
    const sim = await a.post(`/api/grc/${scopeA}/frameworks/${sourceId}/promotion/preview`);
    expect(sim.json()).toMatchObject({ canPromote: false, alreadyPromoted: true });
  });

  it('réserve la promotion aux droits de conformité et de Pilotage', async () => {
    expect((await reader.post(`/api/grc/${scopeA}/frameworks/${sourceId}/promotion/preview`)).statusCode).toBe(403);
  });
});
