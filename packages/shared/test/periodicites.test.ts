/* Périodicités : sept préréglages sans ambiguïté, personnalisée, aperçu calculé par le moteur. */
import { describe, expect, it } from 'vitest';
import { apercuOccurrences, appliquerPeriodicite, PERIODICITES, periodiciteDe, type Recurrence } from '../src/index.js';

const base: Recurrence = {
  start: '2026-01-31',
  time: '09:00',
  timezone: 'Europe/Paris',
  unit: 'month',
  interval: 1,
  until: null,
  count: null,
  reminderDays: 7,
  active: true,
};

describe('périodicités', () => {
  it('sept préréglages, chacun reconnu à son unité et son intervalle', () => {
    expect(PERIODICITES.map((p) => p.label)).toEqual([
      'Journalier',
      'Hebdomadaire',
      'Mensuel',
      'Tous les deux mois',
      'Trimestriel',
      'Semestriel',
      'Annuel',
    ]);
    for (const p of PERIODICITES) expect(periodiciteDe({ unit: p.unit, interval: p.interval })).toBe(p.id);
    expect(periodiciteDe({ unit: 'month', interval: 5 })).toBe('personnalisee');
    expect(periodiciteDe({ unit: 'week', interval: 2 })).toBe('personnalisee');
  });
  it('appliquer un préréglage change l’unité et l’intervalle, la personnalisée ne touche à rien', () => {
    expect(appliquerPeriodicite(base, 'trimestriel')).toMatchObject({ unit: 'month', interval: 3 });
    expect(appliquerPeriodicite(base, 'annuel')).toMatchObject({ unit: 'year', interval: 1 });
    expect(appliquerPeriodicite(base, 'personnalisee')).toEqual(base);
  });
  it('l’aperçu suit le moteur : fin de mois bornée sans dérive, jours exclus reportés, fin de série respectée', () => {
    const jours = apercuOccurrences(base, 4).map((o) => o.local);
    expect(jours).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    const exclus = apercuOccurrences({ ...base, excludedDays: ['2026-02-28'] }, 2);
    expect(exclus[1]).toMatchObject({ local: '2026-03-01', decalee: true });
    expect(apercuOccurrences({ ...base, count: 2 }, 5)).toHaveLength(2);
    expect(apercuOccurrences({ ...base, timezone: 'Mars/Phobos' } as Recurrence)).toEqual([]);
  });
});
