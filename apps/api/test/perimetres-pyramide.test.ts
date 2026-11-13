/* Pyramide des périmètres (ADR 0092, lot 1, migration 060) : l'accès donné sur un périmètre vaut pour ses descendants,
   jamais pour ses parents ni pour ses voisins. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

const action = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'action',
  name,
  data: {
    description: '',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
    ...extra,
  },
});

let t: TestApp, admin: Agent;
let piloteUser: TestUser, pilote: Agent, lecteurUser: TestUser, lecteur: Agent, localUser: TestUser, local: Agent;
// Groupe > Établissement > Service ; « Voisin » est un autre enfant du groupe ; « Ailleurs » est hors de l'arbre.
let groupe: string, etablissement: string, service: string, voisin: string, ailleurs: string;

const p = async (name: string, parentId: string | null = null) =>
  (await admin.post('/api/grc/smsis', { name, scope: name, timezone: 'Europe/Paris', parentId })).json().id as string;
const visibles = async (a: Agent) => ((await a.get('/api/grc/smsis')).json() as { id: string }[]).map((s) => s.id);
const membres = async (id: string) =>
  (await admin.get(`/api/grc/${id}/members`)).json() as { userId: string; write: boolean; herite: boolean }[];

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'pyr_admin', 'admin'));
  piloteUser = await makeUser(t, 'pyr_pilote', 'rw');
  lecteurUser = await makeUser(t, 'pyr_lecteur', 'rw');
  localUser = await makeUser(t, 'pyr_local', 'rw');
  groupe = await p('Groupe fictif');
  etablissement = await p('Établissement fictif', groupe);
  service = await p('Service fictif', etablissement);
  voisin = await p('Voisin fictif', groupe);
  ailleurs = await p('Ailleurs fictif');
  // Le pilote est désigné sur l'établissement, le lecteur aussi (lecture seule), le compte local sur le seul service.
  const designer = (id: string, u: TestUser, write: boolean) =>
    admin.put(`/api/grc/${id}/members`, { userId: u.id, write });
  expect((await designer(etablissement, piloteUser, true)).statusCode).toBe(204);
  expect((await designer(etablissement, lecteurUser, false)).statusCode).toBe(204);
  expect((await designer(service, localUser, true)).statusCode).toBe(204);
  pilote = await login(t, piloteUser);
  lecteur = await login(t, lecteurUser);
  local = await login(t, localUser);
});
afterAll(() => t.close());

describe('pyramide des périmètres', () => {
  it('le pilote d’un périmètre voit et modifie ses descendants, pas ses parents ni ses voisins', async () => {
    const vus = await visibles(pilote);
    expect(vus).toEqual(expect.arrayContaining([etablissement, service]));
    for (const id of [groupe, voisin, ailleurs]) expect(vus).not.toContain(id);
    const cree = await pilote.post(`/api/grc/${service}/objects`, action('Action du pilote dans le service'));
    expect(cree.statusCode, cree.body).toBe(200);
    expect((await pilote.get(`/api/grc/${service}/objects?kind=action`)).json().total).toBe(1);
    for (const id of [groupe, voisin, ailleurs]) {
      expect((await pilote.get(`/api/grc/${id}/objects?kind=action`)).statusCode).toBe(404);
      expect((await pilote.post(`/api/grc/${id}/objects`, action('Refusée'))).statusCode).toBe(404);
    }
  });

  it('un accès en lecture seule descend en lecture seule', async () => {
    expect(await visibles(lecteur)).toEqual(expect.arrayContaining([etablissement, service]));
    expect((await lecteur.get(`/api/grc/${service}/objects?kind=action`)).statusCode).toBe(200);
    expect((await lecteur.post(`/api/grc/${service}/objects`, action('Refusée'))).statusCode).toBe(403);
  });

  it('un accès donné sur un enfant ne remonte pas', async () => {
    const vus = await visibles(local);
    expect(vus).toContain(service);
    for (const id of [groupe, etablissement, voisin]) expect(vus).not.toContain(id);
    expect((await local.get(`/api/grc/${etablissement}/objects?kind=action`)).statusCode).toBe(404);
  });

  it('le niveau le plus élevé de la chaîne l’emporte', async () => {
    // Lecture sur le service, écriture héritée de l'établissement : le pilote écrit toujours dans le service.
    expect((await admin.put(`/api/grc/${service}/members`, { userId: piloteUser.id, write: false })).statusCode).toBe(
      204,
    );
    pilote = await login(t, piloteUser);
    expect((await pilote.post(`/api/grc/${service}/objects`, action('Écriture héritée'))).statusCode).toBe(200);
    const m = await membres(service);
    expect(m.filter((x) => x.userId === piloteUser.id)).toEqual([
      expect.objectContaining({ write: false, herite: false }),
      expect.objectContaining({ write: true, herite: true }),
    ]);
    expect((await admin.req('DELETE', `/api/grc/${service}/members/${piloteUser.id}`)).statusCode).toBe(204);
    pilote = await login(t, piloteUser);
  });

  it('la liste des membres distingue les accès hérités, et un compte hérité peut être responsable', async () => {
    const m = await membres(service);
    expect(m.find((x) => x.userId === localUser.id)).toMatchObject({ write: true, herite: false });
    expect(m.find((x) => x.userId === piloteUser.id)).toMatchObject({ write: true, herite: true });
    expect(m.find((x) => x.userId === lecteurUser.id)).toMatchObject({ write: false, herite: true });
    expect((await membres(etablissement)).every((x) => !x.herite)).toBe(true);
    const r = await admin.post(
      `/api/grc/${service}/objects`,
      action('Portée par le pilote', { ownerId: piloteUser.id }),
    );
    expect(r.statusCode, r.body).toBe(200);
    // Une action s'attribue à tout compte actif : la désignation lui ouvre l'élément (lot 2), pas le périmètre.
    const autreUser = await makeUser(t, 'pyr_autre', null);
    const confiee = await admin.post(`/api/grc/${service}/objects`, action('Confiée', { ownerId: autreUser.id }));
    expect(confiee.statusCode, confiee.body).toBe(200);
    const autre = await login(t, autreUser);
    expect((await autre.get(`/api/grc/${service}/objects/${confiee.json().id}`)).statusCode).toBe(200);
    expect((await autre.get(`/api/grc/${service}/objects/${r.json().id}`)).statusCode).toBe(404);
  });

  it('déplacer un périmètre hors de la branche retire l’accès hérité ; le retirer au parent aussi', async () => {
    const lu = (await admin.get('/api/grc/smsis')).json() as { id: string; version: number }[];
    const v = lu.find((s) => s.id === service)!.version;
    const r = await admin.patch(
      `/api/grc/smsis/${service}`,
      {
        name: 'Service fictif',
        scope: 'Service fictif',
        timezone: 'Europe/Paris',
        parentId: voisin,
        confirm: 'ENREGISTRER',
      },
      { 'if-match': `"${v}"` },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(await visibles(pilote)).not.toContain(service);
    expect((await pilote.get(`/api/grc/${service}/objects?kind=action`)).statusCode).toBe(404);
    expect(await visibles(local)).toContain(service);
    expect((await admin.req('DELETE', `/api/grc/${etablissement}/members/${piloteUser.id}`)).statusCode).toBe(204);
    pilote = await login(t, piloteUser);
    expect(await visibles(pilote)).not.toContain(etablissement);
  });
});
