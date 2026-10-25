import { describe, expect, it } from 'vitest';
import { anneesAttendues, joursFeriesFrance, paques } from '../src/index.js';

describe('date de Pâques (comput grégorien)', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('%i', (annee, attendu) => expect(paques(annee)).toBe(attendu));
});

describe('jours fériés français', () => {
  it('produit les onze jours légaux de 2026, triés', () => {
    expect(joursFeriesFrance(2026).map((j) => j.date)).toEqual([
      '2026-01-01',
      '2026-04-06',
      '2026-05-01',
      '2026-05-08',
      '2026-05-14',
      '2026-05-25',
      '2026-07-14',
      '2026-08-15',
      '2026-11-01',
      '2026-11-11',
      '2026-12-25',
    ]);
  });
  it('suit Pâques les années où les fêtes mobiles changent de mois', () => {
    const f = (a: number) => joursFeriesFrance(a).filter((j) => /Pâques|Ascension|Pentecôte/.test(j.label));
    expect(f(2024).map((j) => j.date)).toEqual(['2024-04-01', '2024-05-09', '2024-05-20']);
    expect(f(2025).map((j) => j.date)).toEqual(['2025-04-21', '2025-05-29', '2025-06-09']);
    expect(f(2027).map((j) => j.date)).toEqual(['2027-03-29', '2027-05-06', '2027-05-17']);
  });
  it('refuse une année hors plage ou non entière', () => {
    expect(() => joursFeriesFrance(1200)).toThrow(RangeError);
    expect(() => joursFeriesFrance(2026.5)).toThrow(RangeError);
  });
});

describe('années à couvrir', () => {
  it('année courante, puis la suivante à partir d’octobre', () => {
    expect(anneesAttendues(new Date('2026-09-30T10:00:00Z'))).toEqual([2026]);
    expect(anneesAttendues(new Date('2026-10-01T10:00:00Z'))).toEqual([2026, 2027]);
  });
});
