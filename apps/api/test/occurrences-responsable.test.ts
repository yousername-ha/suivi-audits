/* Occurrences d'une série : le responsable (personne, groupe ou fonction) de la série est repris par chaque occurrence
   générée par l'automate. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

describe('occurrences : responsable de la série', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string, groupe: string, fonction: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'occ_admin', 'admin'));
    const membre = await makeUser(t, 'occ_membre', 'rw');
    A = (
      await admin.post('/api/grc/smsis', { name: 'Périmètre occurrences', scope: 'x', timezone: 'Europe/Paris' })
    ).json().id;
    expect((await admin.put(`/api/grc/${A}/members`, { userId: membre.id, write: false })).statusCode).toBe(204);
    groupe = (await t.svc.db.one<{ id: string }>(
      "INSERT INTO groups(name) VALUES ('Groupe occurrences') RETURNING id",
    ))!.id;
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [membre.id, groupe]);
    fonction = (
      await admin.post('/api/admin/fonctions', { name: 'Responsable occurrences', members: [membre.id] })
    ).json().id;
  });
  afterAll(async () => t.close());

  const serie = (name: string, responsable: unknown) => ({
    kind: 'task_series',
    name,
    data: {
      description: '',
      ownerId: null,
      responsable,
      category: 'action',
      priority: 'normal',
      refs: [],
      recurrence: {
        start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        time: '09:00',
        timezone: 'Europe/Paris',
        unit: 'week',
        interval: 1,
        until: null,
        count: 2,
        reminderDays: 7,
        active: true,
      },
    },
  });

  it.each([
    ['groupe', () => ({ type: 'groupe', id: groupe })],
    ['fonction', () => ({ type: 'fonction', id: fonction })],
  ])('une série confiée à un %s le reste pour ses occurrences', async (_nom, ref) => {
    const r = await admin.post(`/api/grc/${A}/objects`, serie(`Série ${_nom}`, ref()));
    expect(r.statusCode, r.body).toBe(200);
    await t.svc.grc.tasks.tick(new Date(Date.now() + 7 * 86400000));
    const occurrences = (
      await t.svc.db.q<{ responsable: unknown; owner: string | null }>(
        `SELECT data->'responsable' AS responsable, data->>'ownerId' AS owner FROM grc_objects WHERE kind='action' AND smsi_id=$1 AND data->>'seriesId'=$2`,
        [A, r.json().id],
      )
    ).rows;
    expect(occurrences.length).toBeGreaterThan(0);
    for (const o of occurrences) {
      expect(o.responsable).toEqual(ref());
      expect(o.owner).toBeNull();
    }
  });
});
