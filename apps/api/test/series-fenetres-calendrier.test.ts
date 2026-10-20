/* Fenêtres de réalisation, jours exclus, import iCalendar et enchaînement des occurrences (lot D, R11, R12, R14).
   Données fictives ; les dates sont calculées à partir d'aujourd'hui pour que la fenêtre réponde à l'horloge réelle. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const jour = (decalage: number) => new Date(Date.now() + decalage * 86400000).toISOString().slice(0, 10);
const recurrence = (extra: Record<string, unknown>) => ({
  start: jour(-14),
  time: '09:00',
  timezone: 'Europe/Paris',
  unit: 'week',
  interval: 1,
  until: null,
  count: 4,
  reminderDays: 7,
  active: true,
  ...extra,
});
const serie = (name: string, extra: Record<string, unknown>) => ({
  kind: 'task_series',
  name,
  data: {
    description: 'Contrôle périodique',
    ownerId: null,
    category: 'action',
    priority: 'normal',
    refs: [],
    recurrence: recurrence(extra),
  },
});
const ics = (...evenements: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...evenements, 'END:VCALENDAR'].join('\r\n');
const ferie = (d: string, nom: string) =>
  `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${d.replaceAll('-', '')}\r\nSUMMARY:${nom}\r\nEND:VEVENT`;

describe('fenêtres, jours exclus et calendriers', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string;
  let sFenetre: { id: string; version: number };
  let occurrences: { actionId: string; fenetre: { etat: string } | null; validation: { etat: string } }[];
  const rid = () => crypto.randomUUID();
  const valider = (id: string, data: Record<string, unknown> = {}) =>
    admin.post(`/api/grc/${A}/objects/${id}/validations`, { requestId: rid(), result: 'ok', comment: '', ...data });
  const lire = async (id: string) =>
    (await admin.get(`/api/grc/${A}/series/${id}/occurrences`)).json() as typeof occurrences;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'fen_admin', 'admin'));
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre F', scope: 'F', timezone: 'Europe/Paris' })).json().id;
    const s = await admin.post(
      `/api/grc/${A}/objects`,
      serie('Série à fenêtre', { window: { openDays: 2, closeDays: 3 } }),
    );
    expect(s.statusCode, s.body).toBe(200);
    sFenetre = { id: s.json().id, version: s.json().version };
    await t.svc.grc.tasks.tick(new Date(Date.now() + 7 * 86400000));
    occurrences = (await lire(sFenetre.id)).reverse(); // de la plus ancienne à la plus récente
  });
  afterAll(async () => t.close());

  it('qualifie chaque occurrence selon sa fenêtre : fermée, fermée, ouverte, à venir', () => {
    expect(occurrences.map((o) => o.fenetre?.etat)).toEqual(['fermee', 'fermee', 'ouverte', 'a_venir']);
    expect(occurrences.every((o) => o.validation.etat === 'ouverte')).toBe(true);
  });

  it('refuse de valider hors fenêtre, avec un message qui dit quoi faire, et accepte dans la fenêtre', async () => {
    const [fermee, , ouverte, avenir] = occurrences.map((o) => o.actionId);
    const tard = await valider(fermee!);
    expect(tard.statusCode).toBe(409);
    expect(tard.json().error).toContain('s’est fermée');
    const tot = await valider(avenir!);
    expect(tot.statusCode).toBe(409);
    expect(tot.json().error).toContain('n’ouvre que');
    expect((await valider(ouverte!)).statusCode).toBe(201);
    // Aucune validation n'a été écrite pour les refus.
    const n = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int n FROM occurrence_validations WHERE objet_id=ANY($1::uuid[])',
      [[fermee, avenir]],
    );
    expect(n!.n).toBe(0);
  });

  it('enchaîne : la suivante est la plus ancienne non validée dont la fenêtre est ouverte', async () => {
    const [, , ouverte] = occurrences.map((o) => o.actionId);
    // Occurrence ouverte déjà validée : plus rien d'éligible (les autres sont fermées ou à venir).
    expect((await admin.get(`/api/grc/${A}/series/${sFenetre.id}/prochaine`)).json()).toEqual({ occurrence: null });
    // Une série sans fenêtre : toutes ouvertes, la plus ancienne vient d'abord et `apres` la saute.
    const libre = await admin.post(`/api/grc/${A}/objects`, serie('Série sans fenêtre', {}));
    await t.svc.grc.tasks.tick(new Date(Date.now() + 7 * 86400000));
    const liste = (await lire(libre.json().id)).reverse();
    expect(liste.length).toBeGreaterThanOrEqual(3);
    const premiere = (await admin.get(`/api/grc/${A}/series/${libre.json().id}/prochaine`)).json();
    expect(premiere.occurrence.actionId).toBe(liste[0]!.actionId);
    const apres = (
      await admin.get(`/api/grc/${A}/series/${libre.json().id}/prochaine?apres=${liste[0]!.actionId}`)
    ).json();
    expect(apres.occurrence.actionId).toBe(liste[1]!.actionId);
    // Valider la première la fait sortir de la liste : l'enchaînement avance sans résultat KO bloquant.
    expect(
      (await valider(liste[0]!.actionId, { result: 'ko', comment: 'Contrôle non conforme, écart à traiter.' }))
        .statusCode,
    ).toBe(201);
    const suivante = (await admin.get(`/api/grc/${A}/series/${libre.json().id}/prochaine`)).json();
    expect(suivante.occurrence.actionId).toBe(liste[1]!.actionId);
    expect(ouverte).toBeDefined();
  });

  it('reporte les échéances qui tombent un jour exclu et ne génère pas deux fois le même jour', async () => {
    // 2026-03-02 est un lundi : exclu, l'échéance passe au mardi 3 ; le dimanche 8 et le lundi 9 donnent aussi le 9 mars.
    const s = await admin.post(
      `/api/grc/${A}/objects`,
      serie('Série à jours exclus', {
        start: '2026-03-02',
        unit: 'day',
        count: 9,
        excludedDays: ['2026-03-02'],
        excludedWeekdays: [0],
      }),
    );
    expect(s.statusCode, s.body).toBe(200);
    await t.svc.grc.tasks.tick(new Date('2026-03-12T00:00:00Z'));
    const slots = (
      await t.svc.db.q<{ slot: string }>('SELECT slot FROM grc_occurrences WHERE series_id=$1 ORDER BY slot', [
        s.json().id,
      ])
    ).rows.map((r) => r.slot.slice(0, 10));
    expect(slots).toEqual([
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-09',
      '2026-03-10',
    ]);
  });

  it('refuse une configuration de jours exclus invalide', async () => {
    const r = await admin.post(
      `/api/grc/${A}/objects`,
      serie('Série absurde', { excludedWeekdays: [0, 1, 2, 3, 4, 5, 6] }),
    );
    expect(r.statusCode).toBe(422);
    const doublon = await admin.post(
      `/api/grc/${A}/objects`,
      serie('Série en double', { excludedDays: ['2026-05-01', '2026-05-01'] }),
    );
    expect(doublon.statusCode).toBe(422);
  });

  describe('import iCalendar', () => {
    let id: string, version: number;
    const importer = (corps: Record<string, unknown>, v?: number) =>
      admin.post(`/api/grc/${A}/series/${id}/calendrier`, corps, v === undefined ? {} : { 'if-match': `"${v}"` });
    const lireSerie = async () => (await admin.get(`/api/grc/${A}/objects/${id}`)).json();
    beforeAll(async () => {
      const s = await admin.post(`/api/grc/${A}/objects`, serie('Série calendrier', { excludedDays: ['2026-12-25'] }));
      id = s.json().id;
      version = s.json().version;
    });

    it('prévisualise sans rien écrire, en distinguant nouveaux jours et jours déjà exclus', async () => {
      const r = await importer({
        ics: ics(ferie('2026-12-25', 'Noël'), ferie('2027-01-01', 'Jour de l’an')),
        apercu: true,
      });
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json()).toMatchObject({
        nouveaux: ['2027-01-01'],
        dejaPresents: ['2026-12-25'],
        total: 2,
        applique: false,
        erreurs: [],
      });
      const s = await lireSerie();
      expect(s.version).toBe(version);
      expect(s.data.recurrence.excludedDays).toEqual(['2026-12-25']);
    });

    it('refuse un fichier incorrect sans modifier le calendrier, en indiquant la ligne', async () => {
      const mauvais = ics(ferie('2027-02-01', 'Bon'), 'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270231\r\nEND:VEVENT');
      const apercu = (await importer({ ics: mauvais, apercu: true })).json();
      expect(apercu.erreurs).toHaveLength(1);
      expect(apercu.erreurs[0].message).toContain('DTSTART illisible');
      expect(apercu.erreurs[0].ligne).toBeGreaterThan(0);
      const applique = await importer({ ics: mauvais, apercu: false }, version);
      expect(applique.statusCode).toBe(422);
      expect((await lireSerie()).data.recurrence.excludedDays).toEqual(['2026-12-25']);
      expect((await importer({ ics: 'pas un calendrier', apercu: true })).json().erreurs).toHaveLength(1);
    });

    it('exige If-Match et refuse une version périmée', async () => {
      const corps = { ics: ics(ferie('2027-01-01', 'Jour de l’an')), apercu: false };
      expect((await importer(corps)).statusCode).toBe(428);
      expect((await importer(corps, version + 5)).statusCode).toBe(412);
    });

    it('applique, puis rejouer le même fichier n’ajoute aucun doublon et ne crée aucune version', async () => {
      const corps = { ics: ics(ferie('2026-12-25', 'Noël'), ferie('2027-01-01', 'Jour de l’an')), apercu: false };
      const r = await importer(corps, version);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json()).toMatchObject({ applique: true, nouveaux: ['2027-01-01'], total: 2 });
      const s = await lireSerie();
      expect(s.data.recurrence.excludedDays).toEqual(['2026-12-25', '2027-01-01']);
      expect(s.version).toBe(version + 1);
      const rejeu = await importer(corps, s.version);
      expect(rejeu.json()).toMatchObject({
        applique: false,
        nouveaux: [],
        dejaPresents: ['2026-12-25', '2027-01-01'],
        total: 2,
      });
      expect((await lireSerie()).version).toBe(version + 1);
    });

    it('refuse un objet qui n’est pas une série', async () => {
      const action = await admin.post(`/api/grc/${A}/objects`, {
        kind: 'action',
        name: 'Action seule',
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
        },
      });
      const r = await admin.post(`/api/grc/${A}/series/${action.json().id}/calendrier`, { ics: ics(), apercu: true });
      expect(r.statusCode).toBe(422);
    });
  });
});
