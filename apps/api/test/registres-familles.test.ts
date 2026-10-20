/* R01 : un registre porté par plusieurs périmètres est hérité sans sélecteur propre, pour chaque famille (actions, écarts,
   tâches récurrentes). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

describe('registre multi-périmètre, par famille', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string, B: string;
  const registre = async (kind: string, nom: string) =>
    (await admin.post('/api/registres', { kind, name: nom, referenceId: A, perimetres: [B] })).json().id as string;
  const dansB = async () =>
    ((await admin.get(`/api/registres/elements?perimetre=${B}`)).json() as { items: { id: string; kind: string }[] })
      .items;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'fam_admin', 'admin'));
    const p = async (n: string) =>
      (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris' })).json().id as string;
    [A, B] = [await p('Périmètre famille A'), await p('Périmètre famille B')];
  });
  afterAll(async () => t.close());

  it('un écart créé dans un registre d’écarts A/B se retrouve sous B sans sélecteur de périmètre', async () => {
    const reg = await registre('ecarts', 'Écarts A/B');
    const e = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'nonconformity',
      name: 'Écart partagé',
      registreId: reg,
      data: { cause: 'Cause de recette' },
    });
    expect(e.statusCode, e.body).toBe(200);
    expect((await dansB()).map((o) => o.id)).toContain(e.json().id);
  });

  it('une série créée dans un registre de récurrences A/B se retrouve sous B, avec ses occurrences', async () => {
    const reg = await registre('recurrences', 'Récurrences A/B');
    const s = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'task_series',
      name: 'Série partagée',
      registreId: reg,
      data: {
        description: '',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
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
    expect(s.statusCode, s.body).toBe(200);
    await t.svc.grc.tasks.tick(new Date(Date.now() + 86400000));
    const ids = (await dansB()).map((o) => o.id);
    expect(ids).toContain(s.json().id);
    const occ = await t.svc.db.one<{ id: string }>("SELECT id FROM grc_objects WHERE data->>'seriesId'=$1", [
      s.json().id,
    ]);
    expect(ids).toContain(occ!.id);
  });

  it('un registre d’une autre famille est refusé pour l’élément', async () => {
    const reg = await registre('ecarts', 'Écarts seulement');
    const r = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'task_series',
      name: 'Série au mauvais registre',
      registreId: reg,
      data: {
        description: '',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: '2030-01-01',
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
    expect(r.statusCode).toBe(422);
  });
});
