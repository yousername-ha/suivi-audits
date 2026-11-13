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
    membre: await makeUser(t, 'ip_membre', 'rw', { rattache: false }),
    autre: await makeUser(t, 'ip_autre', 'rw', { rattache: false }),
    libre: await makeUser(t, 'ip_libre', 'rw'),
    parent: await makeUser(t, 'ip_parent', 'rw', { rattache: false }),
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

describe('contacts et scénarios de crise par périmètre', () => {
  it('un contact et un scénario d’un périmètre ne sont ni lus ni modifiés hors de ce périmètre', async () => {
    const contact = await membre.post('/api/crise/contacts', { smsi: enfant });
    expect(contact.statusCode, contact.body).toBe(201);
    const rang = Number(contact.json().id);
    expect((await membre.patch(`/api/crise/contacts/${rang}`, { name: 'Contact fictif de l’enfant' })).statusCode).toBe(
      200,
    );
    const scenario = await membre.post('/api/crise/scenarios', { smsi: enfant });
    expect(scenario.statusCode, scenario.body).toBe(201);
    const idScn = scenario.json().id as string;
    const vue = async (a: Agent) =>
      (await a.get('/api/crise')).json().etat as {
        contacts: { name: string; rang: number }[];
        scenarios: { id: string }[];
      };
    expect((await vue(membre)).contacts.map((c) => c.name)).toContain('Contact fictif de l’enfant');
    expect((await vue(membre)).scenarios.map((x) => x.id)).toContain(idScn);
    expect((await vue(parentMembre)).contacts.map((c) => c.name)).toContain('Contact fictif de l’enfant');
    expect((await vue(autre)).contacts.map((c) => c.name)).not.toContain('Contact fictif de l’enfant');
    expect((await vue(autre)).scenarios.map((x) => x.id)).not.toContain(idScn);
    // Hors périmètre : 404, ni modification, ni suppression, ni action de scénario.
    expect((await autre.patch(`/api/crise/contacts/${rang}`, { name: 'Détourné' })).statusCode).toBe(404);
    expect((await autre.patch(`/api/crise/scenarios/${idScn}`, { title: 'Détourné' })).statusCode).toBe(404);
    expect((await autre.post(`/api/crise/scenarios/${idScn}/actions`)).statusCode).toBe(404);
    expect((await autre.post('/api/crise/contacts', { smsi: enfant })).statusCode).toBe(404);
    // Le rang reste valable même quand la vue n'affiche qu'une partie des contacts.
    const autreContact = await libre.post('/api/crise/contacts', {});
    expect(autreContact.statusCode, autreContact.body).toBe(201);
    expect((await vue(libre)).contacts.some((c) => c.rang === Number(autreContact.json().id))).toBe(true);
  });
});

describe('exercices de continuité et cellule de crise (BUG-066)', () => {
  it('un exercice saisi à l’écran est proposé à l’ouverture d’une cellule et s’y rattache', async () => {
    const ex = await admin.post(`/api/grc/${COMMUN}/objects`, {
      kind: 'continuity_exercise',
      name: 'Exercice fictif de bascule',
      data: { plannedAt: '2026-12-01' },
    });
    expect(ex.statusCode, ex.body).toBe(200);
    const ref = `object:${ex.json().id}`;
    const vue = (await libre.get('/api/crise')).json() as { exercices: { id: string; title: string }[] };
    expect(vue.exercices).toContainEqual({ id: ref, title: 'Exercice fictif de bascule' });
    const cellule = await libre.post('/api/crise/cellules', {
      mode: 'Exercice',
      title: 'Exercice de bascule',
      plan: ref,
    });
    expect(cellule.statusCode, cellule.body).toBe(201);
    // « Plans du SMSI » compte l'exercice saisi à l'écran (BUG-066).
    const synthese = (await libre.get('/api/mur/synthese')).json();
    const exo = synthese.plans.types.find((x: { type: string }) => x.type === 'exo');
    expect(exo.realises + exo.enRetard + exo.aVenir).toBeGreaterThanOrEqual(1);
    // À la clôture, la fiche est à compléter par une personne : la synthèse est proposée, aucun résultat n'est inventé.
    const cloture = await libre.post(`/api/crise/cellules/${cellule.json().id}/cloture`, { author: 'Test' });
    expect(cloture.statusCode, cloture.body).toBeLessThan(300);
    expect(cloture.json().exercice).toMatchObject({ ref });
    expect(cloture.json().exercice.synthese).toBeTruthy();
    const apres = (await admin.get(`/api/grc/${COMMUN}/objects/${ex.json().id}`)).json();
    expect(apres.data.status).not.toBe('done');
    expect(
      (
        await libre.post('/api/crise/cellules', {
          mode: 'Exercice',
          plan: 'object:11111111-1111-4111-8111-111111111111',
        })
      ).statusCode,
    ).toBe(422);
  });
});

describe('plans d’audit et annuels par périmètre (BUG-062)', () => {
  it('une action créée sous un périmètre y reste : invisible et intouchable depuis un autre périmètre', async () => {
    const c = await membre.post('/api/plans', { type: 'audit', smsi: enfant });
    expect(c.statusCode, c.body).toBe(201);
    const id = c.json().id as string;
    expect(c.json().smsi).toBe(enfant);
    const mienne = (await membre.get(`/api/plans?smsi=${enfant}`)).json();
    expect(mienne.plans.map((p: { id: string }) => p.id)).toContain(id);
    expect((await autre.get(`/api/plans?smsi=${enfant}`)).statusCode).toBe(404);
    const vueAutre = (await autre.get('/api/plans')).json();
    expect(vueAutre.plans.map((p: { id: string }) => p.id)).not.toContain(id);
    expect((await autre.post('/api/plans', { type: 'audit', smsi: enfant })).statusCode).toBe(404);
    expect((await autre.patch(`/api/plans/${id}`, { title: 'Détourné' })).statusCode).toBe(404);
    expect((await admin.del(`/api/plans/${id}`)).statusCode).toBe(200);
  });
});
