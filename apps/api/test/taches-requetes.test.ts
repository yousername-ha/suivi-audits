/* Requêtes des tâches (conversion Kysely, ADR 0062) : bornes et ordre de la fenêtre, compteurs par statut, pagination des
   occurrences d'une série, lecture des rappels limitée à leur destinataire. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OCCURRENCE_VALIDEE, occurrenceValidee } from '../src/grc/cartes.js';
import { type Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const action = (name: string, status: string, dueAt: string | null) => ({
  kind: 'action',
  name,
  data: {
    description: '',
    status,
    ownerId: null,
    startAt: null,
    dueAt,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});

describe('tâches : requêtes', () => {
  let t: TestApp;
  let admin: Agent, autre: Agent;
  let uAdmin: TestUser, uAutre: TestUser;
  let A: string, B: string;
  const ids = new Map<string, string>();

  beforeAll(async () => {
    t = await createTestApp();
    uAdmin = await makeUser(t, 'tr_admin', 'admin');
    uAutre = await makeUser(t, 'tr_autre', 'admin');
    admin = await login(t, uAdmin);
    autre = await login(t, uAutre);
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre tâches', scope: 'T', timezone: 'Europe/Paris' })).json()
      .id;
    B = (await admin.post('/api/grc/smsis', { name: 'Autre périmètre', scope: 'U', timezone: 'Europe/Paris' })).json()
      .id;
    for (const [nom, statut, echeance, smsi] of [
      ['Avant', 'todo', '2030-01-01T09:00:00.000Z', A],
      ['Début', 'todo', '2030-02-01T00:00:00.000Z', A],
      ['Milieu', 'progress', '2030-02-15T09:00:00.000Z', A],
      ['Fin', 'todo', '2030-02-28T00:00:00.000Z', A],
      ['Après', 'todo', '2030-03-01T09:00:00.000Z', A],
      ['Sans échéance', 'progress', null, A],
      ['Ailleurs', 'todo', '2030-02-10T09:00:00.000Z', B],
    ] as const) {
      const r = await admin.post(`/api/grc/${smsi}/objects`, action(nom, statut, echeance));
      expect(r.statusCode, r.body).toBe(200);
      ids.set(nom, r.json().id);
    }
  });
  afterAll(async () => t.close());

  it('fenêtre : bornes incluses, sans échéance en dernier, autre périmètre exclu', async () => {
    const r = await admin.get(`/api/grc/${A}/tasks/window?from=2030-02-01T00:00:00.000Z&to=2030-02-28T00:00:00.000Z`);
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json().items as { name: string }[]).map((o) => o.name)).toEqual([
      'Début',
      'Milieu',
      'Fin',
      'Sans échéance',
    ]);
  });

  it('tableau de bord : compteurs par statut du seul périmètre', async () => {
    const r = (await admin.get(`/api/grc/${A}/tasks/dashboard`)).json();
    expect(r.summary).toMatchObject({ total: 6, closed: 0, unassigned: 6 });
    const parStatut = Object.fromEntries(
      (r.byStatus as { status: string; count: number }[]).map((s) => [s.status, s.count]),
    );
    expect(parStatut).toEqual({ todo: 4, progress: 2 });
  });

  it('occurrences : pagination par créneau, de la plus récente à la plus ancienne', async () => {
    const s = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'task_series',
      name: 'Série paginée',
      data: {
        description: '',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: jour(-21),
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'week',
          interval: 1,
          until: null,
          count: 3,
          reminderDays: 7,
          active: true,
        },
      },
    });
    expect(s.statusCode, s.body).toBe(200);
    await t.svc.grc.tasks.tick(new Date());
    const toutes = (await admin.get(`/api/grc/${A}/series/${s.json().id}/occurrences`)).json() as { slot: string }[];
    expect(toutes).toHaveLength(3);
    expect(toutes.map((o) => o.slot)).toEqual([...toutes.map((o) => o.slot)].sort().reverse());
    const suite = (
      await admin.get(`/api/grc/${A}/series/${s.json().id}/occurrences?before=${encodeURIComponent(toutes[0]!.slot)}`)
    ).json() as { slot: string }[];
    expect(suite.map((o) => o.slot)).toEqual(toutes.slice(1).map((o) => o.slot));
  });

  it('rappels : seul le destinataire marque le sien comme lu ; un rappel hors application n’est pas listé', async () => {
    const objet = ids.get('Milieu')!;
    const inserer = async (user: string, cle: string, canal = true) =>
      (await t.svc.db.one<{ id: string }>(
        `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message,canal_application)
         VALUES($1,$2,$3,'task_due',$4,'Échéance','Une action arrive à échéance.',$5) RETURNING id`,
        [A, objet, user, cle, canal],
      ))!.id;
    const mien = await inserer(uAdmin.id, 'k1');
    const sien = await inserer(uAutre.id, 'k2');
    await inserer(uAdmin.id, 'k3', false);
    const liste = (await admin.get('/api/grc/notifications')).json() as { id: string; readAt: string | null }[];
    expect(liste.map((n) => n.id)).toEqual([mien]);
    expect(liste[0]!.readAt).toBeNull();
    expect((await admin.put(`/api/grc/notifications/${mien}/read`, {})).statusCode).toBe(200);
    expect((await admin.put(`/api/grc/notifications/${sien}/read`, {})).statusCode).toBe(200);
    expect((await admin.get('/api/grc/notifications')).json()[0].readAt).not.toBeNull();
    expect((await autre.get('/api/grc/notifications')).json()).toMatchObject([{ id: sien, readAt: null }]);
  });

  it('le fragment Kysely « occurrence validée » reste identique au fragment SQL', () => {
    const compile = occurrenceValidee.compile(t.svc.db.k);
    expect(compile.sql).toBe(OCCURRENCE_VALIDEE);
    expect(compile.parameters).toEqual([]);
  });
});
