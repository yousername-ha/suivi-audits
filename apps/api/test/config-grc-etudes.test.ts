/* Liaison d'une étude EBIOS RM au catalogue de configuration (ADR 0038) : la matrice de pertinence est épinglée à une
   version précise, vérifiée par le serveur, et l'étude est enregistrée comme usage « analyse » de cette version. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, smsi: string, matrice: { item: string; version: number }, echelle: string, autre: string;
const cfg = '/api/config-grc';
const root = () => `/api/grc/${smsi}`;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'cfge_admin', 'admin'));
  smsi = (await a.post('/api/grc/smsis', { name: 'Périmètre études', scope: 'Test', timezone: 'Europe/Paris' })).json()
    .id;
  const adopt = await a.post(`${cfg}/templates/ebios-pertinence-sr-ov/adopt`, {});
  expect(adopt.statusCode, adopt.body).toBe(201);
  const items = adopt.json() as { id: string; kind: string; key: string; currentVersion: number }[];
  const m = items.find((i) => i.kind === 'matrix')!;
  matrice = { item: m.id, version: m.currentVersion };
  echelle = items.find((i) => i.kind === 'scale')!.id;
  const c = await a.post(`${cfg}/items`, {
    kind: 'matrix',
    key: 'matrice_iso_seule',
    definition: {
      name: 'Matrice réservée à ISO',
      category: 'risk',
      appliesTo: ['iso27005'],
      rows: { scale: { item: echelle, version: 1 }, label: 'L' },
      columns: { scale: { item: echelle, version: 1 }, label: 'C' },
      result: { scale: { item: echelle, version: 1 } },
      cells: [],
    },
  });
  expect(c.statusCode, c.body).toBe(201);
  autre = c.json().id;
});
afterAll(() => t.close());

const etude = (configuration: unknown, name = 'Étude fictive') =>
  a.post(root() + '/objects', { kind: 'risk_study', name, data: { objective: 'Recette', configuration } });
const usages = async (id: string) =>
  (await a.get(`${cfg}/items/${id}/usages`)).json() as { consumerKind: string; consumerId: string }[];

describe('étude liée à une matrice de pertinence', () => {
  it('épingle la matrice, enregistre l’usage « analyse » et garde l’étude sans liaison inchangée', async () => {
    const sans = await etude(null, 'Sans liaison');
    expect(sans.statusCode, sans.body).toBe(200);
    const r = await etude({ relevanceMatrix: matrice });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data.configuration.relevanceMatrix).toEqual(matrice);
    const u = (await usages(matrice.item)).filter((x) => x.consumerKind === 'analysis');
    expect(u.map((x) => x.consumerId)).toContain(r.json().id);
    expect(u.map((x) => x.consumerId)).not.toContain(sans.json().id);
  });

  it('refuse une référence inconnue, un élément d’un autre type et une famille incompatible', async () => {
    const inconnue = await etude({ relevanceMatrix: { item: '00000000-0000-4000-8000-00000000beef', version: 1 } });
    expect(inconnue.statusCode).toBe(422);
    const mauvaisType = await etude({ relevanceMatrix: { item: echelle, version: 1 } });
    expect(mauvaisType.statusCode).toBe(422);
    expect(mauvaisType.body).toMatch(/type attendu/);
    // Brouillon jamais publié : pas de version à épingler.
    const brouillon = await etude({ relevanceMatrix: { item: autre, version: 1 } });
    expect(brouillon.statusCode).toBe(422);
  });

  it('refuse un champ inconnu dans la liaison et accepte les niveaux du couple sur les échelles épinglées', async () => {
    expect((await etude({ relevanceMatrix: matrice, extra: 1 })).statusCode).toBe(422);
    const e = await etude({ relevanceMatrix: matrice }, 'Étude des couples');
    const couple = await a.post(root() + '/objects', {
      kind: 'sr_ov',
      name: 'Couple fictif',
      data: {
        studyRef: 'object:' + e.json().id,
        resourcesLevel: 'niveau_2',
        motivationLevel: 'niveau_3',
        relevanceLevel: 'moyenne',
      },
    });
    expect(couple.statusCode, couple.body).toBe(200);
    expect(couple.json().data.relevanceLevel).toBe('moyenne');
  });

  it('archiver la matrice interdit une nouvelle liaison mais pas la modification d’une étude déjà liée', async () => {
    const liee = await etude({ relevanceMatrix: matrice }, 'Étude déjà liée');
    expect((await a.post(`${cfg}/items/${matrice.item}/archive`)).statusCode).toBe(200);
    const nouvelle = await etude({ relevanceMatrix: matrice }, 'Nouvelle liaison');
    expect(nouvelle.statusCode).toBe(422);
    expect(nouvelle.body).toMatch(/archivé/);
    const maj = await a.put(
      root() + '/objects/' + liee.json().id,
      { kind: 'risk_study', name: 'Étude déjà liée', data: { ...liee.json().data, objective: 'Objet mis à jour' } },
      { 'if-match': `"${liee.json().version}"` },
    );
    expect(maj.statusCode, maj.body).toBe(200);
  });
});
