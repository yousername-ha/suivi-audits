/* Une occurrence validée (OK, KO ou NA) apparaît comme telle dans les vues de tâches, n'est plus « en retard » dans les
   compteurs et n'est plus rappelée ; une réouverture la remet en jeu. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe('occurrences validées : vues, retards et rappels', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string, serieId: string, occurrences: string[];
  const rid = () => crypto.randomUUID();
  const retards = async () => (await admin.get(`/api/grc/${A}/tasks/dashboard`)).json().summary.overdue as number;
  const rappels = async (id: string) =>
    (await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int n FROM grc_notifications WHERE object_id=$1 AND kind='task_due'",
      [id],
    ))!.n;

  beforeAll(async () => {
    t = await createTestApp();
    const u = await makeUser(t, 'ovv_admin', 'admin');
    admin = await login(t, u);
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre vues', scope: 'V', timezone: 'Europe/Paris' })).json()
      .id;
    // Une série hebdomadaire démarrée il y a trois semaines : trois occurrences dont les échéances sont passées.
    const s = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'task_series',
      name: 'Série des vues',
      data: {
        description: '',
        ownerId: u.id,
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
    serieId = s.json().id;
    await t.svc.grc.tasks.tick(new Date());
    occurrences = (
      await t.svc.db.q<{ id: string }>(
        "SELECT id FROM grc_objects WHERE data->>'seriesId'=$1 ORDER BY data->>'dueAt'",
        [serieId],
      )
    ).rows.map((r) => r.id);
    expect(occurrences).toHaveLength(3);
  });
  afterAll(async () => t.close());

  it('une occurrence validée n’est plus en retard, ni rappelée, et la liste porte sa validation', async () => {
    expect(await retards()).toBe(3);
    const rappelsAvant = await rappels(occurrences[0]!);
    expect(rappelsAvant).toBeGreaterThan(0);
    const ok = await admin.post(`/api/grc/${A}/objects/${occurrences[0]}/validations`, {
      requestId: rid(),
      result: 'ok',
    });
    expect(ok.statusCode, ok.body).toBe(201);
    expect(await retards()).toBe(2);
    // Rien de neuf à rappeler pour l'occurrence validée : une nouvelle échéance de rappel ne la concerne plus.
    await t.svc.db.q("UPDATE grc_notifications SET due_key='ancienne' WHERE object_id=$1", [occurrences[0]]);
    await t.svc.grc.tasks.tick(new Date());
    expect(await rappels(occurrences[0]!)).toBe(rappelsAvant);
    // Les vues liste et fenêtre portent la validation ; une occurrence non validée n'en a pas.
    const liste = (await admin.get(`/api/grc/${A}/tasks`)).json().items as {
      id: string;
      validation: { result: string; by: string } | null;
    }[];
    expect(liste.find((x) => x.id === occurrences[0])!.validation).toMatchObject({ result: 'ok', by: 'ovv_admin' });
    expect(liste.find((x) => x.id === occurrences[1])!.validation).toBeNull();
    const fenetre = (
      await admin.get(`/api/grc/${A}/tasks/window?from=${jour(-60)}T00:00:00Z&to=${jour(60)}T00:00:00Z`)
    ).json().items as { id: string; validation: unknown }[];
    expect(fenetre.find((x) => x.id === occurrences[0])!.validation).toMatchObject({ result: 'ok' });
  });

  it('un KO ou un NA sort aussi du retard ; une réouverture le remet', async () => {
    const ko = await admin.post(`/api/grc/${A}/objects/${occurrences[1]}/validations`, {
      requestId: rid(),
      result: 'ko',
      comment: 'Contrôle non réalisé faute de ressource.',
    });
    expect(ko.statusCode, ko.body).toBe(201);
    const na = await admin.post(`/api/grc/${A}/objects/${occurrences[2]}/validations`, {
      requestId: rid(),
      result: 'na',
      comment: 'Sans objet cette semaine-là.',
    });
    expect(na.statusCode, na.body).toBe(201);
    expect(await retards()).toBe(0);
    const re = await admin.post(`/api/grc/${A}/objects/${occurrences[1]}/validations/reouverture`, {
      requestId: rid(),
      reason: 'Le contrôle doit être refait.',
    });
    expect(re.statusCode, re.body).toBe(201);
    expect(await retards()).toBe(1);
    const liste = (await admin.get(`/api/grc/${A}/tasks`)).json().items as { id: string; validation: unknown }[];
    expect(liste.find((x) => x.id === occurrences[1])!.validation).toBeNull();
  });

  it('les compteurs du tableau de bord et des cartes ne comptent pas les occurrences validées', async () => {
    const cartes = (await admin.get('/api/grc/perimetres/synthese')).json().cartes as {
      id: string;
      compteurs: { recurrentes: { occurrences: { ouverts: number; enRetard: number } } };
    }[];
    const carte = cartes.find((c) => c.id === A)!;
    expect(carte.compteurs.recurrentes.occurrences).toEqual({ ouverts: 1, enRetard: 1 });
  });
});
