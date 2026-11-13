import { describe, expect, it } from 'vitest';
import type { GrcObject } from '@suivi/shared';
import {
  classerDates,
  decalerPeriode,
  etagerReperes,
  infererEchelle,
  JOUR,
  jour,
  periodeCalendaire,
} from '../src/grc/timeline-calendrier';

const today = Date.parse('2026-11-11T12:00:00Z');
const serie = (id: string, unit: string) => ({ id, data: { recurrence: { unit } } }) as unknown as GrcObject;
const action = (id: string, startAt: string | null, dueAt: string | null, seriesId?: string) =>
  ({ id, name: id, data: { startAt, dueAt, seriesId } }) as unknown as GrcObject;
describe('Timeline : périodes calendaires et conservation des objets', () => {
  it('adapte Auto à la série sélectionnée, y compris sans occurrence', () => {
    const series = [serie('j', 'day'), serie('m', 'month'), serie('a', 'year')];
    const items = [action('1', null, '2026-11-12', 'm'), action('2', null, '2026-11-13', 'j')];
    expect(infererEchelle(series, items, '')).toBe('day');
    expect(infererEchelle(series, items, 'm')).toBe('month');
    expect(infererEchelle(series, [], 'a')).toBe('year');
  });
  it('affiche 14 jours ou 12 semaines, sans modifier les objets', () => {
    const daily = periodeCalendaire('day', today),
      weekly = periodeCalendaire('week', today);
    expect(daily.jours).toBe(14);
    expect(weekly.jours).toBe(84);
    expect(daily.reperes).toHaveLength(14);
    expect(weekly.reperes).toHaveLength(12);
    expect(new Date(daily.debut).getUTCDay()).toBe(1);
  });
  it('respecte février bissextile et les largeurs réelles des mois', () => {
    const p = periodeCalendaire('month', today, Date.UTC(2024, 0, 1));
    expect(p.jours).toBe(366);
    expect(p.reperes).toHaveLength(12);
    expect((p.reperes[1]!.fin - p.reperes[1]!.debut) / JOUR).toBe(29);
    expect((p.reperes[0]!.fin - p.reperes[0]!.debut) / JOUR).toBe(31);
  });
  it('affiche cinq années civiles et navigue sans dérive en jours', () => {
    const p = periodeCalendaire('year', today);
    expect(p.reperes.map((r) => r.label)).toEqual(['2024', '2025', '2026', '2027', '2028']);
    expect(p.jours).toBe(1827);
    expect(decalerPeriode(p, 1)).toBe(Date.UTC(2029, 0, 1));
    expect(decalerPeriode(p, -1)).toBe(Date.UTC(2019, 0, 1));
  });
  it('utilise les semaines ISO à la jonction d’année', () => {
    const p = periodeCalendaire('week', today, Date.UTC(2025, 11, 29));
    expect(p.reperes[0]!.label).toMatch(/^S1 ·/);
  });
  it('Tout afficher conserve les dates lointaines, avec un nombre de repères borné', () => {
    const p = periodeCalendaire('day', today, undefined, [Date.UTC(1990, 0, 1), Date.UTC(2060, 0, 1), NaN]);
    expect(p.debut).toBeLessThan(Date.UTC(1990, 0, 1));
    expect(p.fin).toBeGreaterThan(Date.UTC(2060, 0, 1));
    expect(p.reperes.length).toBeLessThanOrEqual(14);
  });
  it('sépare hors période, sans date et incohérences sans en supprimer', () => {
    const p = periodeCalendaire('month', today);
    const input = [
      action('visible', '2026-11-01', '2026-11-20'),
      action('hors', null, '2027-01-01'),
      action('sans', null, null),
      action('inversee', '2026-12-01', '2026-11-01'),
      action('illisible', null, '2026-02-30'),
    ];
    const classified = classerDates(input, p, false);
    expect(classified.visibles.map((o) => o.objet.id)).toEqual(['visible']);
    expect(classified.horsPeriode.map((o) => o.id)).toEqual(['hors']);
    expect(classified.sansDate.map((o) => o.id)).toEqual(['sans']);
    expect(classified.incoherentes.map((o) => o.id)).toEqual(['inversee', 'illisible']);
    expect(input[0]!.data.startAt).toBe('2026-11-01');
  });
  it('une occurrence sans échéance ne prend pas son début comme échéance fictive', () => {
    expect(
      classerDates([action('occ', '2026-11-01', null, 's')], periodeCalendaire('month', today), true).sansDate,
    ).toHaveLength(1);
  });
  it('empile les repères proches tout en conservant leur vraie abscisse', () => {
    expect(etagerReperes([12, 12, 30, 95, 99, 180])).toEqual([0, 1, 2, 0, 1, 0]);
  });
  it('refuse les dates illisibles et les jours calendaires inexistants', () => {
    expect(jour('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
    expect(jour('2026-02-29')).toBeNaN();
    expect(jour('inconnu')).toBeNaN();
  });
});
