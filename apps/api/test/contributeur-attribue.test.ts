/* Contributeur par « Attribuer à » (ADR 0092, lot 2) : la personne désignée sur une action, une tâche récurrente ou un
   registre (en personne ou par un groupe) lit et renseigne, sans droit de module ni accès au périmètre ; elle crée dans un
   registre qui lui est attribué et gère ce qu'elle a créé ; elle ne modifie pas ce qu'un pilote a créé. Données fictives. */
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

const donnees = (extra: Record<string, unknown> = {}) => ({
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
});
const etag = (r: LightMyRequestResponse) => String(r.headers.etag);
const refuse = (statut: number) => expect([403, 404]).toContain(statut);

let t: TestApp, admin: Agent;
let seulUser: TestUser, seul: Agent, equipeUser: TestUser, equipe: Agent, planUser: TestUser, plan: Agent, tiers: Agent;
let P: string, registre: string, autreRegistre: string, groupe: string;
let attribuee: string, auGroupe: string, libre: string, ailleurs: string;
const objet = (id: string) => `/api/grc/${P}/objects/${id}`;
const creer = async (name: string, extra: Record<string, unknown> = {}, reg = registre) => {
  const r = await admin.post(`/api/grc/${P}/objects`, { kind: 'action', name, data: donnees(extra), registreId: reg });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
};
const mes = async (a: Agent) =>
  (
    (await a.get('/api/registres/mes-elements')).json() as {
      items: { element: { id: string }; peut: { contribuer: boolean; gerer: boolean } }[];
    }
  ).items;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ca_admin', 'admin'));
  // Aucun rôle global, aucun accès au périmètre : seuls les éléments attribués leur sont ouverts.
  seulUser = await makeUser(t, 'ca_seul', null);
  equipeUser = await makeUser(t, 'ca_equipe', null);
  planUser = await makeUser(t, 'ca_plan', null);
  P = (await admin.post('/api/grc/smsis', { name: 'Périmètre attribué', scope: 'A', timezone: 'Europe/Paris' })).json()
    .id;
  groupe = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Équipe fictive') RETURNING id"))!.id;
  await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [equipeUser.id, groupe]);
  const reg = async (name: string, extra: Record<string, unknown> = {}) => {
    const r = await admin.post('/api/registres', { kind: 'plan_actions', name, referenceId: P, ...extra });
    expect(r.statusCode, r.body).toBe(201);
    return r.json().id as string;
  };
  registre = await reg('Plan attribué', { responsable: { type: 'utilisateur', id: planUser.id } });
  autreRegistre = await reg('Plan non attribué');
  attribuee = await creer('Action attribuée à une personne', { ownerId: seulUser.id });
  auGroupe = await creer(
    'Action attribuée à un groupe',
    { responsable: { type: 'groupe', id: groupe } },
    autreRegistre,
  );
  libre = await creer('Action sans attribution', {}, autreRegistre);
  ailleurs = await creer('Action du plan attribué, créée par un pilote');
  seul = await login(t, seulUser);
  equipe = await login(t, equipeUser);
  plan = await login(t, planUser);
  tiers = await login(t, await makeUser(t, 'ca_tiers', null));
});
afterAll(() => t.close());

describe('contributeur par « Attribuer à »', () => {
  it('un compte sans accès au périmètre peut être désigné : la désignation lui ouvre l’élément', async () => {
    const r = await seul.get(objet(attribuee));
    expect(r.statusCode, r.body).toBe(200);
    const acces = (await seul.get(`/api/registres/elements/${attribuee}/acces`)).json();
    expect(acces).toMatchObject({
      role: 'contributeur',
      peut: { lire: true, contribuer: true, gerer: false },
      peutAttribuer: false,
    });
  });

  it('la personne désignée renseigne l’avancement mais ne modifie ni n’archive ce qu’un pilote a créé', async () => {
    const lu = await seul.get(objet(attribuee));
    const ok = await seul.req('POST', `${objet(attribuee)}/contribution`, {
      json: { status: 'progress' },
      headers: { 'if-match': etag(lu) },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().data.status).toBe('progress');
    const modif = await seul.put(
      objet(attribuee),
      { kind: 'action', name: 'Renommée', data: donnees({ ownerId: seulUser.id, status: 'progress' }) },
      { 'if-match': etag(ok) },
    );
    expect(modif.statusCode).toBe(403);
    expect((await seul.req('DELETE', objet(attribuee), { headers: { 'if-match': etag(ok) } })).statusCode).toBe(403);
    // Ni droits à distribuer, ni changement de registre.
    refuse(
      (
        await seul.put(`/api/droits/objet/${attribuee}`, {
          subjectType: 'utilisateur',
          subjectId: equipeUser.id,
          role: 'lecteur',
        })
      ).statusCode,
    );
  });

  it('elle ne voit rien d’autre : ni les autres éléments, ni les registres, ni le périmètre', async () => {
    for (const id of [auGroupe, libre, ailleurs]) expect((await seul.get(objet(id))).statusCode).toBe(404);
    expect((await seul.get(`/api/registres/${registre}`)).statusCode).toBe(404);
    expect((await seul.get(`/api/registres/${registre}/elements`)).statusCode).toBe(404);
    expect((await seul.get('/api/registres')).json().items).toEqual([]);
    refuse((await seul.get(`/api/grc/${P}/objects?kind=action`)).statusCode);
    refuse((await seul.get('/api/grc/smsis')).statusCode);
    expect((await mes(seul)).map((x) => x.element.id)).toEqual([attribuee]);
    // Un compte à qui rien n'est attribué ne voit rien.
    expect(await mes(tiers)).toEqual([]);
    for (const id of [attribuee, auGroupe, libre]) expect((await tiers.get(objet(id))).statusCode).toBe(404);
  });

  it('attribution à un groupe : chaque membre contribue ; retiré du groupe, il perd l’accès', async () => {
    expect((await equipe.get(objet(auGroupe))).statusCode).toBe(200);
    expect(await mes(equipe)).toEqual([
      expect.objectContaining({
        element: expect.objectContaining({ id: auGroupe }),
        peut: { contribuer: true, gerer: false },
      }),
    ]);
    expect((await equipe.get(objet(libre))).statusCode).toBe(404);
    await t.svc.db.q('DELETE FROM user_groups WHERE user_id=$1', [equipeUser.id]);
    expect((await equipe.get(objet(auGroupe))).statusCode).toBe(404);
    expect(await mes(equipe)).toEqual([]);
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [equipeUser.id, groupe]);
  });

  it('registre attribué : la personne lit et renseigne tout le registre, sans le gérer', async () => {
    const r = await plan.get(`/api/registres/${registre}`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      role: 'contributeur',
      peut: { lire: true, contribuer: true, gerer: false },
      peutAttribuer: false,
      peutCreer: true,
    });
    expect(((await plan.get('/api/registres')).json().items as { id: string }[]).map((x) => x.id)).toEqual([registre]);
    expect((await plan.get(objet(ailleurs))).statusCode).toBe(200);
    expect((await plan.get(objet(libre))).statusCode).toBe(404);
    expect(
      (
        await plan.req('PATCH', `/api/registres/${registre}`, {
          json: { name: 'Renommé', description: '', restreint: false },
          headers: { 'if-match': etag(r) },
        })
      ).statusCode,
    ).toBe(403);
    const lu = await plan.get(objet(ailleurs));
    const modif = await plan.put(
      objet(ailleurs),
      { kind: 'action', name: 'Renommée', data: donnees() },
      { 'if-match': etag(lu) },
    );
    expect(modif.statusCode).toBe(403);
  });

  it('elle crée dans le registre attribué et gère ce qu’elle a créé, pas ailleurs', async () => {
    const cree = await plan.post(`/api/grc/${P}/objects`, {
      kind: 'action',
      name: 'Action créée par le contributeur',
      data: donnees(),
      registreId: registre,
    });
    expect(cree.statusCode, cree.body).toBe(200);
    const id = cree.json().id as string;
    const acces = (await plan.get(`/api/registres/elements/${id}/acces`)).json();
    expect(acces).toMatchObject({ role: 'gestionnaire', peut: { gerer: true }, peutAttribuer: false });
    const modif = await plan.put(
      objet(id),
      {
        kind: 'action',
        name: 'Action renommée par son créateur',
        data: donnees({ dueAt: '2027-01-15T09:00:00.000Z' }),
      },
      { 'if-match': etag(cree) },
    );
    expect(modif.statusCode, modif.body).toBe(200);
    expect(modif.json().name).toBe('Action renommée par son créateur');
    expect((await mes(plan)).find((x) => x.element.id === id)?.peut).toEqual({ contribuer: true, gerer: true });
    expect((await mes(plan)).find((x) => x.element.id === ailleurs)?.peut).toEqual({ contribuer: true, gerer: false });
    // Pas de création hors du registre attribué : ni dans un autre registre, ni sans registre (registre par défaut).
    for (const registreId of [autreRegistre, undefined])
      refuse(
        (await plan.post(`/api/grc/${P}/objects`, { kind: 'action', name: 'Refusée', data: donnees(), registreId }))
          .statusCode,
      );
    // Le pilote garde la main sur ce que le contributeur a créé.
    const parAdmin = await admin.get(objet(id));
    expect(parAdmin.statusCode).toBe(200);
  });

  it('retirer l’attribution retire l’accès, y compris à ce que la personne avait créé', async () => {
    const lu = await admin.get(objet(attribuee));
    const r = await admin.put(
      objet(attribuee),
      { kind: 'action', name: 'Action attribuée à une personne', data: donnees({ status: 'progress' }) },
      { 'if-match': etag(lu) },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect((await seul.get(objet(attribuee))).statusCode).toBe(404);
    expect(await mes(seul)).toEqual([]);
    const reg = await admin.get(`/api/registres/${registre}`);
    const maj = await admin.req('PATCH', `/api/registres/${registre}`, {
      json: { name: 'Plan attribué', description: '', restreint: false, responsable: null },
      headers: { 'if-match': etag(reg) },
    });
    expect(maj.statusCode, maj.body).toBe(200);
    expect((await plan.get(`/api/registres/${registre}`)).statusCode).toBe(404);
    expect(await mes(plan)).toEqual([]);
  });

  it('un registre de tâches récurrentes s’attribue aussi ; dates et statut restent réservés aux plans', async () => {
    const ok = await admin.post('/api/registres', {
      kind: 'recurrences',
      name: 'Récurrences attribuées',
      referenceId: P,
      responsable: { type: 'groupe', id: groupe },
    });
    expect(ok.statusCode, ok.body).toBe(201);
    expect((await equipe.get(`/api/registres/${ok.json().id}`)).json()).toMatchObject({ peutCreer: true });
    const ko = await admin.post('/api/registres', {
      kind: 'recurrences',
      name: 'Récurrences datées',
      referenceId: P,
      dateDebut: '2026-01-01',
    });
    expect(ko.statusCode).toBe(422);
  });
});
