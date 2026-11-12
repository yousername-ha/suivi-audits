/* Le registre des usages d'un élément de configuration (usages, impact, compteurs) ne nomme, n'identifie ni ne compte les
   consommateurs d'un périmètre que la personne ne peut pas consulter. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const base = '/api/config-grc';
let t: TestApp, rssi: Agent, etranger: Agent;
let echelle = '',
  matrice = '';

const niveaux = (ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase(), description: 'Niveau ' + id }));
const echelleDef = (name: string, ids: string[], category = 'severity') => ({
  name,
  category,
  nature: 'qualitative',
  levels: niveaux(ids),
});
const publier = async (a: Agent, id: string, reason = 'Publication de contrôle') => {
  const p = (await a.post(`${base}/items/${id}/preview`)).json();
  const etag = (await a.get(`${base}/items/${id}`)).headers.etag as string;
  const r = await a.post(
    `${base}/items/${id}/publish`,
    { previewId: p.previewId, reason, confirm: 'PUBLIER' },
    { 'if-match': etag },
  );
  expect(r.statusCode, r.body).toBe(200);
};
const creerPublie = async (a: Agent, kind: string, key: string, definition: unknown, extra = {}) => {
  const r = await a.post(`${base}/items`, { kind, key, definition, ...extra });
  expect(r.statusCode, r.body).toBe(201);
  const id = (r.json() as { id: string }).id;
  await publier(a, id);
  return id;
};

beforeAll(async () => {
  t = await createTestApp();
  rssi = await login(t, await makeUser(t, 'cu_rssi', 'rssi'));
  etranger = await login(t, await makeUser(t, 'cu_etranger', 'rssi'));
  const smsi = (
    await rssi.post('/api/grc/smsis', { name: 'Périmètre fictif restreint', scope: 'Test', timezone: 'Europe/Paris' })
  ).json().id as string;
  echelle = await creerPublie(rssi, 'scale', 'org_g', echelleDef('Gravité', ['g1', 'g2']));
  const vrais = await creerPublie(rssi, 'scale', 'org_v', echelleDef('Vraisemblance', ['v1', 'v2'], 'likelihood'));
  const res = await creerPublie(rssi, 'scale', 'org_n', echelleDef('Niveaux', ['bas', 'haut'], 'criticality'));
  const cellules = [
    ['g1', 'v1', 'bas'],
    ['g1', 'v2', 'bas'],
    ['g2', 'v1', 'bas'],
    ['g2', 'v2', 'haut'],
  ].map(([row, column, result]) => ({ row, column, result }));
  // Matrice propre au périmètre, qui épingle l'échelle d'organisation.
  matrice = await creerPublie(
    rssi,
    'matrix',
    'smsi_matrice',
    {
      name: 'Matrice du périmètre',
      category: 'risk',
      rows: { scale: { item: echelle, version: 1 }, label: 'Gravité' },
      columns: { scale: { item: vrais, version: 1 }, label: 'Vraisemblance' },
      result: { scale: { item: res, version: 1 } },
      cells: cellules,
    },
    { scope: 'smsi', smsiId: smsi },
  );
});
afterAll(() => t.close());

describe('usages d’une échelle d’organisation épinglée dans un périmètre restreint', () => {
  it('témoin : un membre du périmètre voit le consommateur', async () => {
    const u = (await rssi.get(`${base}/items/${echelle}/usages`)).json() as { consumerId: string }[];
    expect(u.map((x) => x.consumerId)).toContain(matrice);
    expect((await rssi.get(`${base}/items/${echelle}`)).json().usages).toBe(1);
    const liste = (await rssi.get(`${base}/items`)).json() as { id: string; usages: number }[];
    expect(liste.find((x) => x.id === echelle)!.usages).toBe(1);
  });

  it('un lecteur extérieur au périmètre ne reçoit ni le consommateur, ni son identifiant, ni son libellé', async () => {
    const r = await etranger.get(`${base}/items/${echelle}/usages`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual([]);
    expect(r.body).not.toContain(matrice);
    expect(r.body).not.toContain('smsi_matrice');
  });

  it('les compteurs de la fiche et de la liste ne comptent pas les consommateurs invisibles', async () => {
    expect((await etranger.get(`${base}/items/${echelle}`)).json().usages).toBe(0);
    const liste = (await etranger.get(`${base}/items`)).json() as { id: string; usages: number }[];
    expect(liste.find((x) => x.id === echelle)!.usages).toBe(0);
  });

  it('l’étude d’impact n’identifie pas les consommateurs invisibles', async () => {
    const id = echelle;
    // Une version 2 de l'échelle (niveau supplémentaire) permet de comparer 1 → 2.
    const etag = (await rssi.get(`${base}/items/${id}`)).headers.etag as string;
    const sauve = await rssi.put(
      `${base}/items/${id}/draft`,
      { definition: echelleDef('Gravité', ['g1', 'g2', 'g3']) },
      { 'if-match': etag },
    );
    expect(sauve.statusCode, sauve.body).toBeLessThan(300);
    await publier(rssi, id, 'Troisième niveau de gravité');
    const chez = await etranger.get(`${base}/items/${id}/impact?from=1&to=2`);
    expect(chez.statusCode, chez.body).toBe(200);
    expect(chez.json().consumers).toEqual([]);
    expect(chez.json().consumersCount).toBe(0);
    expect(chez.body).not.toContain(matrice);
    const membre = await rssi.get(`${base}/items/${id}/impact?from=1&to=2`);
    expect(membre.json().consumersCount).toBe(1);
  });
});
