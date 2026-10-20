/* Fenêtres de réalisation, jours exclus et lecture iCalendar (lot D). Données fictives. */
import { describe, expect, it } from 'vitest';
import { fenetreOccurrence, jourDisponible, lireIcs, recurrenceSlot, Recurrence } from '../src/index.js';

const base = {
  start: '2026-03-02',
  time: '09:00',
  timezone: 'Europe/Paris',
  unit: 'week' as const,
  interval: 1,
  until: null,
  count: null,
  reminderDays: 7,
  active: true,
};

describe('jours exclus', () => {
  it('reporte une échéance au prochain jour disponible et signale le report', () => {
    // 2026-03-02 est un lundi ; on exclut ce lundi précis.
    const r = Recurrence.parse({ ...base, excludedDays: ['2026-03-02'] });
    const premier = recurrenceSlot(r, 0)!;
    expect(premier).toMatchObject({ local: '2026-03-03', nominal: '2026-03-02', decalee: true });
    const suivant = recurrenceSlot(r, 1)!;
    expect(suivant).toMatchObject({ local: '2026-03-09', decalee: false });
  });
  it('saute les jours de la semaine exclus (samedi et dimanche, le report tombe le lundi)', () => {
    const r = Recurrence.parse({ ...base, unit: 'day', start: '2026-03-06', excludedWeekdays: [0, 6] });
    expect(recurrenceSlot(r, 0)!.local).toBe('2026-03-06'); // vendredi
    expect(recurrenceSlot(r, 1)!.local).toBe('2026-03-09'); // samedi → lundi
    expect(recurrenceSlot(r, 2)!.local).toBe('2026-03-09'); // dimanche → lundi : même clé, donc masquée à la génération
    expect(recurrenceSlot(r, 1)!.key).toBe(recurrenceSlot(r, 2)!.key);
  });
  it('sans jour exclu, rien ne change', () => {
    const r = Recurrence.parse(base);
    expect(recurrenceSlot(r, 3)).toMatchObject({ local: '2026-03-23', decalee: false });
  });
  it('refuse une configuration qui ne laisse aucun jour disponible', () => {
    expect(() => jourDisponible({ excludedWeekdays: [0, 1, 2, 3, 4, 5, 6] }, '2026-03-02')).toThrow();
    expect(Recurrence.safeParse({ ...base, excludedWeekdays: [0, 1, 2, 3, 4, 5, 6] }).success).toBe(false);
  });
  it('valide les dates et refuse les doublons', () => {
    expect(Recurrence.safeParse({ ...base, excludedDays: ['2026-02-30'] }).success).toBe(false);
    expect(Recurrence.safeParse({ ...base, excludedDays: ['2026-03-02', '2026-03-02'] }).success).toBe(false);
    expect(Recurrence.safeParse({ ...base, excludedWeekdays: [1, 1] }).success).toBe(false);
  });
});

describe('fenêtre de réalisation', () => {
  const echeance = '2026-06-15T07:00:00.000Z';
  const fenetre = { window: { openDays: 3, closeDays: 2 } };
  it('sans fenêtre, une occurrence est ouverte', () => {
    expect(fenetreOccurrence({}, echeance, new Date('2030-01-01T00:00:00Z')).etat).toBe('ouverte');
  });
  it('est à venir, ouverte puis fermée', () => {
    expect(fenetreOccurrence(fenetre, echeance, new Date('2026-06-10T00:00:00Z')).etat).toBe('a_venir');
    expect(fenetreOccurrence(fenetre, echeance, new Date('2026-06-12T07:00:00Z')).etat).toBe('ouverte');
    expect(fenetreOccurrence(fenetre, echeance, new Date('2026-06-15T23:00:00Z')).etat).toBe('ouverte');
    expect(fenetreOccurrence(fenetre, echeance, new Date('2026-06-17T07:00:00Z')).etat).toBe('ouverte');
    expect(fenetreOccurrence(fenetre, echeance, new Date('2026-06-17T07:00:01Z')).etat).toBe('fermee');
  });
  it('donne les bornes de la fenêtre', () => {
    const f = fenetreOccurrence(fenetre, echeance, new Date('2026-06-15T00:00:00Z'));
    expect(f.ouvreLe).toBe('2026-06-12T07:00:00.000Z');
    expect(f.fermeLe).toBe('2026-06-17T07:00:00.000Z');
  });
});

const ics = (...evenements: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...evenements, 'END:VCALENDAR'].join('\r\n');
describe('lecture iCalendar', () => {
  it('lit un jour entier, une période (DTEND exclusive) et une date avec heure', () => {
    const l = lireIcs(
      ics(
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261225\r\nSUMMARY:Noël\r\nEND:VEVENT',
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260810\r\nDTEND;VALUE=DATE:20260813\r\nEND:VEVENT',
        'BEGIN:VEVENT\r\nDTSTART:20260501T090000Z\r\nDTEND:20260501T170000Z\r\nEND:VEVENT',
      ),
    );
    expect(l.erreurs).toEqual([]);
    expect(l.jours).toEqual(['2026-05-01', '2026-08-10', '2026-08-11', '2026-08-12', '2026-12-25']);
  });
  it('déplie les lignes, ignore les événements annulés et les règles de répétition', () => {
    const l = lireIcs(
      ics(
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:2026\r\n 0101\r\nSUMMARY:Jour de l’an\r\nEND:VEVENT',
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260214\r\nSTATUS:CANCELLED\r\nEND:VEVENT',
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260301\r\nRRULE:FREQ=YEARLY\r\nEND:VEVENT',
      ),
    );
    expect(l.jours).toEqual(['2026-01-01']);
    expect(l.ignores.map((i) => i.message)).toEqual([
      expect.stringContaining('annulé'),
      expect.stringContaining('RRULE'),
    ]);
    expect(l.erreurs).toEqual([]);
  });
  it('signale les erreurs avec leur ligne et ne retient rien de douteux', () => {
    expect(lireIcs('pas un calendrier').erreurs[0]!.message).toContain('BEGIN:VCALENDAR');
    const l = lireIcs(ics('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260231\r\nEND:VEVENT'));
    expect(l.erreurs).toHaveLength(1);
    expect(l.erreurs[0]!.message).toContain('DTSTART illisible');
    expect(lireIcs(ics('BEGIN:VEVENT\r\nSUMMARY:sans date\r\nEND:VEVENT')).erreurs[0]!.message).toContain('DTSTART');
    expect(
      lireIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260101\r\nEND:VEVENT').erreurs.length,
    ).toBeGreaterThan(0);
  });
  it('refuse un événement de plus d’un an', () => {
    const l = lireIcs(ics('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20280101\r\nEND:VEVENT'));
    expect(l.erreurs[0]!.message).toContain('366');
  });
});
