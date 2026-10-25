/* Calendriers de plateforme (décision 4, migration 039) : jours fériés légaux calculés, import iCalendar, aperçu avant écriture,
   rejeu sans doublon, journal immuable avec provenance, droits, rappel de la mise à jour annuelle et reprise des jours par une
   série de tâches. Données fictives. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent, ecrivain: Agent, smsi: string, feries: string, autre: string;
const base = '/api/calendriers-plateforme';
const ics = (...jours: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...jours.map(
      (d) => `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${d.replaceAll('-', '')}\r\nSUMMARY:Fermeture\r\nEND:VEVENT`,
    ),
    'END:VCALENDAR',
  ].join('\r\n');

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cal_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'cal_ro', 'ro'));
  const rw = await makeUser(t, 'cal_rw', 'rw');
  smsi = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre calendriers', scope: 'C', timezone: 'Europe/Paris' })
  ).json().id;
  expect((await admin.put(`/api/grc/${smsi}/members`, { userId: rw.id, write: true })).statusCode).toBe(204);
  ecrivain = await login(t, rw);
});
afterAll(() => t.close());

describe('calendriers de plateforme', () => {
  it('crée un calendrier de jours fériés et un autre calendrier, refuse un nom en double, réservé à l’administration', async () => {
    expect((await ecrivain.post(base, { name: 'Interdit', kind: 'feries' })).statusCode).toBe(403);
    const f = await admin.post(base, { name: 'Jours fériés français', kind: 'feries' });
    expect(f.statusCode, f.body).toBe(201);
    feries = f.json().id;
    expect(f.json().missingYears.length).toBeGreaterThan(0);
    const a = await admin.post(base, { name: 'Fermetures de l’organisation', kind: 'autre' });
    expect(a.statusCode, a.body).toBe(201);
    autre = a.json().id;
    expect(a.json().missingYears).toEqual([]);
    expect((await admin.post(base, { name: 'jours FÉRIÉS français', kind: 'feries' })).statusCode).toBe(409);
    expect((await lecteur.get(base)).statusCode).toBe(200);
  });

  it('génère les onze jours fériés d’une année : aperçu sans écriture, ajout, rejeu sans doublon', async () => {
    const apercu = await admin.post(`${base}/${feries}/feries`, { year: 2026 });
    expect(apercu.statusCode, apercu.body).toBe(200);
    expect(apercu.json()).toMatchObject({ applied: false, errors: [] });
    expect(apercu.json().added).toHaveLength(11);
    expect((await admin.get(`${base}/${feries}/jours`)).json()).toEqual([]);

    const ok = await admin.post(`${base}/${feries}/feries`, { year: 2026, apercu: false });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().applied).toBe(true);
    const jours = (await lecteur.get(`${base}/${feries}/jours?annee=2026`)).json() as {
      date: string;
      origin: string;
    }[];
    expect(jours).toHaveLength(11);
    expect(jours.map((j) => j.date)).toContain('2026-05-14');
    expect(jours.every((j) => j.origin === 'calcul')).toBe(true);

    const rejeu = await admin.post(`${base}/${feries}/feries`, { year: 2026, apercu: false });
    expect(rejeu.json()).toMatchObject({ applied: false, added: [] });
    expect(rejeu.json().alreadyPresent).toHaveLength(11);
    const journal = (await admin.get(`${base}/${feries}/journal`)).json() as { operation: string; daysAdded: number }[];
    expect(journal.map((j) => j.operation)).toEqual(['generer', 'creer']);
    expect(journal[0]!.daysAdded).toBe(11);
  });

  it('refuse la génération légale sur un calendrier « autre » et une année hors plage', async () => {
    expect((await admin.post(`${base}/${autre}/feries`, { year: 2026 })).statusCode).toBe(422);
    expect((await admin.post(`${base}/${feries}/feries`, { year: 1200 })).statusCode).toBe(422);
  });

  it('importe un calendrier iCalendar : erreurs signalées avec leur ligne, tout ou rien, rejeu sans doublon', async () => {
    const mauvais = ics('2026-12-24') + '\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260231\r\nEND:VEVENT';
    const apercuMauvais = (await admin.post(`${base}/${autre}/ical`, { ics: mauvais })).json();
    expect(apercuMauvais.errors.length).toBeGreaterThan(0);
    const refus = await admin.post(`${base}/${autre}/ical`, { ics: mauvais, apercu: false });
    expect(refus.statusCode).toBe(422);
    expect((await admin.get(`${base}/${autre}/jours`)).json()).toEqual([]);

    const bon = ics('2026-12-24', '2026-12-31');
    const ok = await admin.post(`${base}/${autre}/ical`, { ics: bon, filename: 'fermetures.ics', apercu: false });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().applied).toBe(true);
    expect((await admin.get(`${base}/${autre}/jours`)).json().map((j: { date: string }) => j.date)).toEqual([
      '2026-12-24',
      '2026-12-31',
    ]);
    expect((await admin.post(`${base}/${autre}/ical`, { ics: bon, apercu: false })).json().applied).toBe(false);
    const journal = (await admin.get(`${base}/${autre}/journal`)).json() as { provenance: string }[];
    expect(journal[0]!.provenance).toContain('fermetures.ics');
  });

  it('signale les années à mettre à jour et les années couvertes', async () => {
    const cal = (
      (await lecteur.get(base)).json() as {
        id: string;
        years: { year: number; days: number }[];
        missingYears: number[];
      }[]
    ).find((c) => c.id === feries)!;
    expect(cal.years).toEqual([{ year: 2026, days: 11 }]);
    const maintenant = new Date().getUTCFullYear();
    expect(cal.missingYears.includes(maintenant)).toBe(maintenant !== 2026);
  });

  it('retire une année avec un motif, refuse sans motif, et ne supprime qu’un calendrier vide', async () => {
    expect((await admin.post(`${base}/${autre}/annees/2026/retrait`, { reason: 'ok' })).statusCode).toBe(422);
    expect((await admin.req('DELETE', `${base}/${autre}`)).statusCode).toBe(409);
    const r = await admin.post(`${base}/${autre}/annees/2026/retrait`, {
      reason: 'Fermetures remplacées par un autre fichier',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().removed).toBe(2);
    expect((await admin.post(`${base}/${autre}/annees/2026/retrait`, { reason: 'Encore une fois' })).statusCode).toBe(
      404,
    );
    expect((await admin.req('DELETE', `${base}/${autre}`)).statusCode).toBe(204);
    await expect(t.svc.db.q('UPDATE calendriers_plateforme_journal SET reason=$1', ['modifié'])).rejects.toThrow();
    const actions = (
      await t.svc.db.q<{ action: string }>(
        "SELECT action FROM audit_log WHERE action LIKE 'admin.calendrier_%' ORDER BY id",
      )
    ).rows.map((x) => x.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'admin.calendrier_cree',
        'admin.calendrier_genere',
        'admin.calendrier_importe',
        'admin.calendrier_annee_retiree',
        'admin.calendrier_supprime',
      ]),
    );
  });
});

describe('reprise par une série de tâches', () => {
  let serie: string, version: number;
  const importer = (corps: Record<string, unknown>, v?: number) =>
    ecrivain.post(
      `/api/grc/${smsi}/series/${serie}/calendrier`,
      corps,
      v === undefined ? {} : { 'if-match': `"${v}"` },
    );
  beforeAll(async () => {
    const s = await admin.post(`/api/grc/${smsi}/objects`, {
      kind: 'task_series',
      name: 'Série avec fériés',
      data: {
        description: 'Contrôle',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: '2026-01-05',
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'week',
          interval: 1,
          until: null,
          count: 4,
          reminderDays: 7,
          active: true,
        },
      },
    });
    expect(s.statusCode, s.body).toBe(200);
    serie = s.json().id;
    version = s.json().version;
  });

  it('prévisualise puis copie les jours d’une année du calendrier de plateforme dans les jours exclus', async () => {
    const apercu = await importer({ calendrier: feries, annee: 2026, apercu: true });
    expect(apercu.statusCode, apercu.body).toBe(200);
    expect(apercu.json()).toMatchObject({ applique: false, erreurs: [] });
    expect(apercu.json().nouveaux).toHaveLength(11);
    expect((await importer({ calendrier: feries, annee: 2026, apercu: false })).statusCode).toBe(428);
    const ok = await importer({ calendrier: feries, annee: 2026, apercu: false }, version);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().applique).toBe(true);
    const relu = (await admin.get(`/api/grc/${smsi}/objects/${serie}`)).json();
    expect(relu.data.recurrence.excludedDays).toHaveLength(11);
    const rejeu = await importer({ calendrier: feries, annee: 2026, apercu: false }, relu.version);
    expect(rejeu.json()).toMatchObject({ applique: false, nouveaux: [] });
  });

  it('refuse un calendrier inconnu, une année sans jour et un corps ambigu', async () => {
    expect((await importer({ calendrier: randomUUID(), apercu: true })).statusCode).toBe(404);
    expect((await importer({ calendrier: feries, annee: 2031, apercu: true })).statusCode).toBe(422);
    expect((await importer({ calendrier: feries, ics: ics('2026-12-24'), apercu: true })).statusCode).toBe(422);
    expect((await importer({ annee: 2026, ics: ics('2026-12-24'), apercu: true })).statusCode).toBe(422);
  });
});
