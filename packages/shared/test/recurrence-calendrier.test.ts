/* Fenêtres de réalisation, jours exclus et lecture iCalendar (lot D). Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  developper,
  fenetreOccurrence,
  jourDisponible,
  lireIcs,
  lireRegle,
  recurrenceSlot,
  Recurrence,
} from '../src/index.js';

const AUJ = '2026-10-20';

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
  it('déplie les lignes et ignore les événements annulés', () => {
    const l = lireIcs(
      ics(
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:2026\r\n 0101\r\nSUMMARY:Jour de l’an\r\nEND:VEVENT',
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260214\r\nSTATUS:CANCELLED\r\nEND:VEVENT',
      ),
      AUJ,
    );
    expect(l.jours).toEqual(['2026-01-01']);
    expect(l.ignores.map((i) => i.message)).toEqual([expect.stringContaining('annulé')]);
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

const regleDe = (brut: string) => {
  const r = lireRegle(brut);
  if (!('regle' in r)) throw new Error(r.refus);
  return r.regle;
};

describe('règles de répétition (RRULE)', () => {
  const evenement = (debut: string, regle: string, extra = '') =>
    ics(`BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${debut}\r\nRRULE:${regle}\r\n${extra}END:VEVENT`);
  it('développe un jour férié annuel sur cinq ans', () => {
    const l = lireIcs(evenement('20250101', 'FREQ=YEARLY'), AUJ);
    expect(l.jours).toEqual(['2026-01-01', '2027-01-01', '2028-01-01', '2029-01-01', '2030-01-01', '2031-01-01']);
    expect(l.ignores[0]!.message).toContain("développée jusqu'au");
    expect(l.erreurs).toEqual([]);
  });
  it('respecte COUNT, UNTIL et EXDATE', () => {
    expect(lireIcs(evenement('20260101', 'FREQ=YEARLY;COUNT=3'), AUJ).jours).toEqual([
      '2026-01-01',
      '2027-01-01',
      '2028-01-01',
    ]);
    expect(lireIcs(evenement('20260501', 'FREQ=YEARLY;UNTIL=20280501'), AUJ).jours).toEqual([
      '2026-05-01',
      '2027-05-01',
      '2028-05-01',
    ]);
    const l = lireIcs(evenement('20260101', 'FREQ=YEARLY;COUNT=3', 'EXDATE;VALUE=DATE:20270101\r\n'), AUJ);
    expect(l.jours).toEqual(['2026-01-01', '2028-01-01']);
  });
  it('développe un événement de plusieurs jours à chaque occurrence', () => {
    const l = lireIcs(
      ics(
        'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260810\r\nDTEND;VALUE=DATE:20260812\r\nRRULE:FREQ=YEARLY;COUNT=2\r\nEND:VEVENT',
      ),
      AUJ,
    );
    expect(l.jours).toEqual(['2026-08-10', '2026-08-11', '2027-08-10', '2027-08-11']);
  });
  it('développe chaque semaine (jours précis), chaque mois et tous les deux jours', () => {
    const sem = developper(regleDe('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4'), '2026-10-19', '2026-10-01', '2030-01-01');
    expect(sem.jours).toEqual(['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28']);
    const mois = developper(regleDe('FREQ=MONTHLY;BYMONTHDAY=31;COUNT=3'), '2026-01-31', '2026-01-01', '2030-01-01');
    // Le 31 n'existe pas en février ni en avril : ces mois sont sautés, la norme ne ramène pas au dernier jour.
    expect(mois.jours).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    const quotidien = developper(regleDe('FREQ=DAILY;INTERVAL=2;COUNT=3'), '2026-10-20', '2026-10-01', '2030-01-01');
    expect(quotidien.jours).toEqual(['2026-10-20', '2026-10-22', '2026-10-24']);
  });
  it('développe un jour de rang du mois (premier lundi, dernier vendredi) et le dernier jour du mois', () => {
    const premierLundi = developper(
      regleDe('FREQ=MONTHLY;BYDAY=1MO;COUNT=3'),
      '2026-10-01',
      '2026-10-01',
      '2030-01-01',
    );
    expect(premierLundi.jours).toEqual(['2026-10-05', '2026-11-02', '2026-12-07']);
    const dernierVendredi = developper(
      regleDe('FREQ=MONTHLY;BYDAY=-1FR;COUNT=2'),
      '2026-10-01',
      '2026-10-01',
      '2030-01-01',
    );
    expect(dernierVendredi.jours).toEqual(['2026-10-30', '2026-11-27']);
    const dernierJour = developper(
      regleDe('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3'),
      '2026-01-31',
      '2026-01-01',
      '2030-01-01',
    );
    expect(dernierJour.jours).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    const tousLesLundis = developper(
      regleDe('FREQ=MONTHLY;BYDAY=MO;COUNT=5'),
      '2026-10-01',
      '2026-10-01',
      '2030-01-01',
    );
    expect(tousLesLundis.jours).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
    // Quatrième jeudi de novembre, chaque année.
    const annuel = developper(
      regleDe('FREQ=YEARLY;BYMONTH=11;BYDAY=4TH;COUNT=2'),
      '2026-11-26',
      '2026-01-01',
      '2030-01-01',
    );
    expect(annuel.jours).toEqual(['2026-11-26', '2027-11-25']);
    // Un cinquième lundi inexistant est sauté.
    const cinquieme = developper(regleDe('FREQ=MONTHLY;BYDAY=5MO;COUNT=2'), '2026-10-01', '2026-10-01', '2030-01-01');
    expect(cinquieme.jours).toEqual(['2026-11-30', '2027-03-29']);
  });
  it('refuse explicitement ce qu’il ne sait pas développer, sans rien deviner', () => {
    for (const r of [
      'FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1',
      'FREQ=YEARLY;BYSETPOS=1',
      'FREQ=YEARLY;BYDAY=4TH',
      'FREQ=MONTHLY;BYDAY=1MO;BYMONTHDAY=3',
      'FREQ=WEEKLY;BYDAY=1MO',
      'FREQ=HOURLY',
      'FREQ=WEEKLY;INTERVAL=0',
    ])
      expect('refus' in lireRegle(r)).toBe(true);
    const l = lireIcs(evenement('20260301', 'FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO'), AUJ);
    expect(l.jours).toEqual([]);
    expect(l.ignores[0]!.message).toContain('non prise en charge');
  });
  it('ne produit jamais plus de jours que la limite d’une série', () => {
    const l = lireIcs(evenement('20200101', 'FREQ=DAILY'), AUJ);
    expect(l.erreurs.map((e) => e.message).join()).toContain('Plus de 1000 jours');
  });
});
