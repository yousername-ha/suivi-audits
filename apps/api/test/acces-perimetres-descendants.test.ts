/* Accès aux périmètres hiérarchiques (BUG-051, ADR 0092 qui amende l'ADR 0039) : un compte rattaché à un périmètre
   enfant ne voit que ce périmètre ; rattaché au parent, il voit le parent et ses descendants ; un compte sans
   rattachement garde les périmètres ouverts à toute l'organisation. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const RACINE = '00000000-0000-4000-8000-000000000001';
let t: TestApp, admin: Agent, parent: string, enfant: string, petitEnfant: string, frere: string;
let seulEnfant: Agent, duParent: Agent, enLecture: Agent, libre: Agent, nu: Agent;

async function creer(nom: string, parentId: string | null) {
  const r = await admin.post('/api/grc/smsis', {
    name: nom,
    scope: 'Recette BUG-051',
    timezone: 'Europe/Paris',
    ...(parentId ? { parentId } : {}),
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}
const fiche = (a: Agent, smsi: string, nom: string) =>
  a.post(`/api/grc/${smsi}/objects`, { kind: 'stakeholder', name: nom, data: {} });

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'p51_admin', 'admin'));
  parent = await creer('Parent fictif', null);
  enfant = await creer('Enfant fictif', parent);
  petitEnfant = await creer('Petit-enfant fictif', enfant);
  frere = await creer('Frère fictif', parent);
  const comptes = {
    enfant: await makeUser(t, 'p51_enfant', 'rw', { rattache: false }),
    parent: await makeUser(t, 'p51_parent', 'rw', { rattache: false }),
    lecture: await makeUser(t, 'p51_lecture', 'rw', { rattache: false }),
    libre: await makeUser(t, 'p51_libre', 'rw'),
    nu: await makeUser(t, 'p51_nu', 'rw', { rattache: false }),
  };
  for (const [u, smsi, write] of [
    [comptes.enfant, enfant, true],
    [comptes.parent, parent, true],
    [comptes.lecture, parent, false],
  ] as const) {
    const r = await admin.put(`/api/grc/${smsi}/members`, { userId: u.id, write });
    expect(r.statusCode, r.body).toBeLessThan(300);
  }
  seulEnfant = await login(t, comptes.enfant);
  duParent = await login(t, comptes.parent);
  enLecture = await login(t, comptes.lecture);
  libre = await login(t, comptes.libre);
  nu = await login(t, comptes.nu);
});
afterAll(() => t.close());

describe('compte rattaché à un périmètre enfant', () => {
  it('lit et écrit dans son périmètre et dans ses descendants', async () => {
    expect((await fiche(seulEnfant, enfant, 'Fiche de l’enfant')).statusCode).toBe(200);
    expect((await seulEnfant.get(`/api/grc/${petitEnfant}/objects?kind=stakeholder`)).statusCode).toBe(200);
    expect((await fiche(seulEnfant, petitEnfant, 'Fiche du petit-enfant')).statusCode).toBe(200);
  });
  it('ne voit ni le parent (racine comprise), ni un périmètre voisin', async () => {
    for (const autre of [RACINE, parent, frere]) {
      expect((await seulEnfant.get(`/api/grc/${autre}/objects?kind=stakeholder`)).statusCode).toBe(404);
      expect((await fiche(seulEnfant, autre, 'Fiche hors périmètre')).statusCode).toBe(404);
    }
    const liste = (await seulEnfant.get('/api/grc/smsis')).json() as { id: string }[];
    expect(liste.map((s) => s.id).sort()).toEqual([enfant, petitEnfant].sort());
  });
});

describe('compte rattaché au périmètre parent', () => {
  it('voit le parent et ses enfants, et y écrit quand son rattachement le permet', async () => {
    for (const smsi of [parent, enfant, petitEnfant, frere])
      expect((await duParent.get(`/api/grc/${smsi}/objects?kind=stakeholder`)).statusCode).toBe(200);
    expect((await fiche(duParent, petitEnfant, 'Fiche écrite depuis le parent')).statusCode).toBe(200);
    expect((await duParent.get(`/api/grc/${RACINE}/objects?kind=stakeholder`)).statusCode).toBe(404);
  });
  it('rattaché en lecture seule : lit les enfants, n’y écrit pas', async () => {
    expect((await enLecture.get(`/api/grc/${enfant}/objects?kind=stakeholder`)).statusCode).toBe(200);
    expect((await fiche(enLecture, enfant, 'Écriture refusée')).statusCode).toBe(403);
  });
});

describe('compte sans rattachement et administrateur', () => {
  it('un compte sans aucun rattachement ne voit aucun périmètre', async () => {
    expect((await nu.get('/api/grc/smsis')).json()).toEqual([]);
    expect((await nu.get(`/api/grc/${RACINE}/objects?kind=stakeholder`)).statusCode).toBe(404);
  });
  it('le compte rattaché à la racine y reste, sans voir les périmètres restreints', async () => {
    expect((await libre.get(`/api/grc/${RACINE}/objects?kind=stakeholder`)).statusCode).toBe(200);
    expect((await libre.get(`/api/grc/${enfant}/objects?kind=stakeholder`)).statusCode).toBe(404);
  });
  it('l’administrateur voit tous les périmètres', async () => {
    const ids = ((await admin.get('/api/grc/smsis')).json() as { id: string }[]).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([RACINE, parent, enfant, petitEnfant, frere]));
  });
});
