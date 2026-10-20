/* Responsables personne / groupe / fonction (migration 031) : validation serveur, une seule désignation, rappels envoyés
   aux membres, fonctions archivées. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

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

describe('responsables typés', () => {
  let t: TestApp;
  let admin: Agent, simple: Agent;
  let S: string, u1: string, u2: string, groupe: string, groupeVide: string, fonction: string, fonctionVide: string;
  const creer = (extra: Record<string, unknown>, agent = admin) =>
    agent.post(`/api/grc/${S}/objects`, { kind: 'action', name: 'Action de recette', data: donnees(extra) });

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'resp_admin', 'admin'));
    simple = await login(t, await makeUser(t, 'resp_simple', 'rw'));
    u1 = (await makeUser(t, 'resp_u1', 'rw')).id;
    u2 = (await makeUser(t, 'resp_u2', 'rw')).id;
    S = (await admin.post('/api/grc/smsis', { name: 'Périmètre R', scope: 'R', timezone: 'Europe/Paris' })).json().id;
    for (const u of [u1, u2])
      expect((await admin.put(`/api/grc/${S}/members`, { userId: u, write: true })).statusCode).toBe(204);
    groupe = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Équipe qualité') RETURNING id"))!
      .id;
    groupeVide = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Équipe vide') RETURNING id"))!
      .id;
    await t.svc.db.q('INSERT INTO user_groups(user_id,group_id) VALUES ($1,$2)', [u1, groupe]);
    const f = await admin.post('/api/admin/fonctions', { name: 'RSSI', description: 'Sécurité', members: [u1, u2] });
    expect(f.statusCode, f.body).toBe(201);
    fonction = f.json().id;
    fonctionVide = (await admin.post('/api/admin/fonctions', { name: 'DPO', members: [] })).json().id;
  });
  afterAll(async () => t.close());

  it('gère l’annuaire des fonctions : administrateurs seulement, nom unique, titulaires contrôlés', async () => {
    expect((await simple.post('/api/admin/fonctions', { name: 'Autre', members: [] })).statusCode).toBe(403);
    expect((await admin.post('/api/admin/fonctions', { name: 'rssi', members: [] })).statusCode).toBe(409);
    expect(
      (await admin.post('/api/admin/fonctions', { name: 'Inconnu', members: ['00000000-0000-4000-8000-0000000000aa'] }))
        .statusCode,
    ).toBe(422);
    const liste = (await admin.get('/api/admin/fonctions')).json();
    expect(liste.find((x: { id: string }) => x.id === fonction).members).toHaveLength(2);
  });

  it('propose personnes, groupes et fonctions qui comptent du monde', async () => {
    const r = (await admin.get(`/api/grc/${S}/responsables`)).json();
    expect(r.groupes.find((g: { id: string }) => g.id === groupe).membres).toBe(1);
    expect(r.groupes.find((g: { id: string }) => g.id === groupeVide).membres).toBe(0);
    expect(r.fonctions.find((x: { id: string }) => x.id === fonction).membres).toBe(2);
    expect(r.utilisateurs.map((u: { id: string }) => u.id)).toEqual(expect.arrayContaining([u1, u2]));
  });

  it('valide la désignation : une seule, cible existante, au moins une personne active', async () => {
    const parGroupe = await creer({ responsable: { type: 'groupe', id: groupe } });
    expect(parGroupe.statusCode, parGroupe.body).toBe(200);
    expect(parGroupe.json().data.ownerId).toBeNull();
    expect(parGroupe.json().data.responsable).toEqual({ type: 'groupe', id: groupe });
    expect((await creer({ responsable: { type: 'fonction', id: fonction } })).statusCode).toBe(200);
    const parPersonne = await creer({ responsable: { type: 'utilisateur', id: u1 } });
    expect(parPersonne.json().data.ownerId).toBe(u1); // ownerId reprend la personne désignée
    // Refus : cible vide, inconnue, ou deux désignations.
    expect((await creer({ responsable: { type: 'groupe', id: groupeVide } })).statusCode).toBe(422);
    expect((await creer({ responsable: { type: 'fonction', id: fonctionVide } })).statusCode).toBe(422);
    expect(
      (await creer({ responsable: { type: 'fonction', id: '00000000-0000-4000-8000-0000000000aa' } })).statusCode,
    ).toBe(422);
    expect((await creer({ ownerId: u2, responsable: { type: 'groupe', id: groupe } })).statusCode).toBe(422);
    expect((await creer({ ownerId: u2, responsable: { type: 'utilisateur', id: u1 } })).statusCode).toBe(422);
    // Un type inconnu est refusé par le schéma.
    expect((await creer({ responsable: { type: 'equipe', id: groupe } })).statusCode).toBe(422);
  });

  it('une série accepte aussi un groupe ou une fonction', async () => {
    const r = await admin.post(`/api/grc/${S}/objects`, {
      kind: 'task_series',
      name: 'Série responsable',
      data: {
        description: '',
        ownerId: null,
        responsable: { type: 'fonction', id: fonction },
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: '2026-10-01',
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'month',
          interval: 1,
          until: null,
          count: 1,
          reminderDays: 7,
          active: true,
        },
      },
    });
    expect(r.statusCode, r.body).toBe(200);
  });

  it('les rappels vont aux personnes de la fonction ou du groupe ; une action à groupe n’est pas « sans responsable »', async () => {
    const bientot = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const a = await creer({ dueAt: bientot, responsable: { type: 'fonction', id: fonction } });
    expect(a.statusCode, a.body).toBe(200);
    await t.svc.grc.tasks.tick(new Date());
    const destinataires = (
      await t.svc.db.q<{ user_id: string }>('SELECT user_id FROM grc_notifications WHERE object_id=$1', [a.json().id])
    ).rows.map((r) => r.user_id);
    expect(destinataires.sort()).toEqual([u1, u2].sort());
    const tableau = (await admin.get(`/api/grc/${S}/tasks/dashboard`)).json();
    const sans = await creer({});
    expect(sans.statusCode).toBe(200);
    const apres = (await admin.get(`/api/grc/${S}/tasks/dashboard`)).json();
    expect(apres.summary.unassigned).toBe(tableau.summary.unassigned + 1);
    expect(tableau.summary.unassigned).toBe(1); // seule l'action sans désignation du test précédent
  });

  it('une fonction archivée n’est plus proposée et ne peut plus être désignée', async () => {
    const jetable = (await admin.post('/api/admin/fonctions', { name: 'Éphémère', members: [u1] })).json().id;
    const a = await creer({ responsable: { type: 'fonction', id: jetable } });
    expect(a.statusCode).toBe(200);
    expect((await admin.del(`/api/admin/fonctions/${jetable}`)).statusCode).toBe(204);
    const r = (await admin.get(`/api/grc/${S}/responsables`)).json();
    expect(r.fonctions.map((x: { id: string }) => x.id)).not.toContain(jetable);
    expect((await creer({ responsable: { type: 'fonction', id: jetable } })).statusCode).toBe(422);
    // La fiche existante reste lisible.
    expect((await admin.get(`/api/grc/${S}/objects/${a.json().id}`)).statusCode).toBe(200);
  });
});
