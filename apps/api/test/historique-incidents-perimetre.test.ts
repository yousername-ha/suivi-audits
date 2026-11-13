/* Incidents, RETEX et cellules de crise rattachés à un périmètre (BUG-044) : un compte non rattaché au périmètre d'un
   incident ne le lit pas et ne le modifie pas ; un compte rattaché au parent le voit. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

const COMMUN = '00000000-0000-4000-8000-000000000001';
let t: TestApp, admin: Agent, membre: Agent, autre: Agent, libre: Agent, parentMembre: Agent;
let enfant: string, idInc: string, idCommun: string;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ip_admin', 'admin'));
  const s = (await admin.get('/api/suivi/etat')).json();
  s.incidents = [];
  s.crisis = { scenarios: [] };
  await seedState(t, s);
  const parent = (
    await admin.post('/api/grc/smsis', { name: 'Parent fictif', scope: 'P', timezone: 'Europe/Paris' })
  ).json().id;
  enfant = (
    await admin.post('/api/grc/smsis', {
      name: 'Hébergement fictif',
      scope: 'H',
      timezone: 'Europe/Paris',
      parentId: parent,
    })
  ).json().id;
  const comptes = {
    membre: await makeUser(t, 'ip_membre', 'rw'),
    autre: await makeUser(t, 'ip_autre', 'rw'),
    libre: await makeUser(t, 'ip_libre', 'rw'),
    parent: await makeUser(t, 'ip_parent', 'rw'),
  };
  expect((await admin.put(`/api/grc/${enfant}/members`, { userId: comptes.membre.id, write: true })).statusCode).toBe(
    204,
  );
  expect((await admin.put(`/api/grc/${parent}/members`, { userId: comptes.parent.id, write: true })).statusCode).toBe(
    204,
  );
  const autrePerimetre = (
    await admin.post('/api/grc/smsis', { name: 'Autre fictif', scope: 'A', timezone: 'Europe/Paris' })
  ).json().id;
  expect(
    (await admin.put(`/api/grc/${autrePerimetre}/members`, { userId: comptes.autre.id, write: true })).statusCode,
  ).toBe(204);
  membre = await login(t, comptes.membre);
  autre = await login(t, comptes.autre);
  libre = await login(t, comptes.libre);
  parentMembre = await login(t, comptes.parent);
});
afterAll(() => t.close());

describe('incidents par périmètre', () => {
  it('un incident créé sous un périmètre y est rattaché ; le compte rattaché à un autre périmètre ne le lit pas', async () => {
    const c = await membre.post('/api/incidents', { title: 'Coupure du lien fictive', smsi: enfant });
    expect(c.statusCode, c.body).toBe(201);
    idInc = c.json().id;
    expect(c.json().smsi).toBe(enfant);
    const vueMembre = (await membre.get('/api/incidents')).json();
    expect(vueMembre.incidents.map((i: { id: string }) => i.id)).toContain(idInc);
    const vueAutre = (await autre.get('/api/incidents')).json();
    expect(vueAutre.incidents.map((i: { id: string }) => i.id)).not.toContain(idInc);
    expect((await autre.get(`/api/incidents?smsi=${enfant}`)).statusCode).toBe(404);
  });
  it('le compte rattaché au parent le voit ; le compte libre (périmètre commun) ne le voit pas', async () => {
    expect(
      ((await parentMembre.get('/api/incidents')).json().incidents as { id: string }[]).map((i) => i.id),
    ).toContain(idInc);
    expect(((await libre.get('/api/incidents')).json().incidents as { id: string }[]).map((i) => i.id)).not.toContain(
      idInc,
    );
  });
  it('un compte hors périmètre ne modifie, ne supprime et ne touche pas au RETEX (404)', async () => {
    expect((await autre.patch(`/api/incidents/${idInc}`, { title: 'Détourné' })).statusCode).toBe(404);
    expect(
      (await autre.post(`/api/incidents/${idInc}/retex`, { ts: '2026-10-12T09:00', type: 'Analyse', titre: 'x' }))
        .statusCode,
    ).toBe(404);
    expect((await autre.post(`/api/incidents/${idInc}/retex/ouverture`, {})).statusCode).toBe(404);
    expect((await autre.del(`/api/incidents/${idInc}`)).statusCode).toBe(403); // pas le droit de supprimer
    expect((await admin.get('/api/incidents')).json().incidents.find((i: { id: string }) => i.id === idInc).title).toBe(
      'Coupure du lien fictive',
    );
  });
  it('création refusée dans un périmètre inaccessible ; sans périmètre, l’incident va au périmètre commun', async () => {
    expect((await autre.post('/api/incidents', { title: 'x', smsi: enfant })).statusCode).toBe(404);
    const c = await libre.post('/api/incidents', { title: 'Incident commun fictif' });
    expect(c.statusCode, c.body).toBe(201);
    idCommun = c.json().id;
    expect(c.json().smsi).toBe(COMMUN);
    expect(((await membre.get('/api/incidents')).json().incidents as { id: string }[]).map((i) => i.id)).not.toContain(
      idCommun,
    );
  });
  it('les incidents saisis avant le périmètre restent au périmètre commun', async () => {
    const s = (await admin.get('/api/suivi/etat')).json();
    s.incidents = [
      ...s.incidents,
      { id: 'INC-2025-900', title: 'Ancien incident fictif', kind: 'Incident', status: 'Nouveau' },
    ];
    await seedState(t, s);
    expect(((await libre.get('/api/incidents')).json().incidents as { id: string }[]).map((i) => i.id)).toContain(
      'INC-2025-900',
    );
    expect(((await membre.get('/api/incidents')).json().incidents as { id: string }[]).map((i) => i.id)).not.toContain(
      'INC-2025-900',
    );
  });
});

describe('cellules de crise par périmètre', () => {
  let cellule: string;
  it('une cellule ouverte sous un périmètre n’est pas montrée ni modifiable hors de ce périmètre', async () => {
    const c = await membre.post('/api/crise/cellules', { mode: 'Réel', title: 'Crise fictive', smsi: enfant });
    expect(c.statusCode, c.body).toBe(201);
    cellule = c.json().id;
    const vue = async (a: Agent) =>
      ((await a.get('/api/crise')).json().etat.cells as { id: string }[]).map((x) => x.id);
    expect(await vue(membre)).toContain(cellule);
    expect(await vue(parentMembre)).toContain(cellule);
    expect(await vue(autre)).not.toContain(cellule);
    expect(
      (await autre.post(`/api/crise/cellules/${cellule}/entrees`, { type: 'Information', author: 'x', text: 'y' }))
        .statusCode,
    ).toBe(404);
    expect(
      (await membre.post(`/api/crise/cellules/${cellule}/entrees`, { type: 'Information', author: 'x', text: 'y' }))
        .statusCode,
    ).toBeLessThan(300);
  });
});
