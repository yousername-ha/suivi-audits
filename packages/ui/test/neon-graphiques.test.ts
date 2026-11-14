import { describe, expect, it } from 'vitest';
import { nombreNeon, pointsRadar, positionsDates } from '../src/neon-graphiques.tsx';
describe('graphiques Neon, intégrité des représentations', () => {
  it('borne les données illisibles sans produire de coordonnées non finies', () => {
    expect([NaN, Infinity, -1, 0, 3].map(nombreNeon)).toEqual([0, 0, 0, 0, 3]);
    expect(
      pointsRadar([
        { libelle: 'A', valeur: null },
        { libelle: 'B', valeur: Infinity },
        { libelle: 'C', valeur: 150 },
      ]),
    ).not.toMatch(/NaN|Infinity/);
  });
  it('trie les dates, écarte les dates invalides et positionne les échéances sur une échelle temporelle', () => {
    const p = positionsDates([
      { libelle: 'B', date: '2026-02-03' },
      { libelle: 'inconnue', date: '?' },
      { libelle: 'A', date: '2026-02-01' },
      { libelle: 'C', date: '2026-02-02' },
    ]);
    expect(p.map((x) => x.libelle)).toEqual(['A', 'C', 'B']);
    expect(p.map((x) => x.position)).toEqual([8, 50, 92]);
    expect(positionsDates([{ libelle: 'A', date: '2026-01-01' }])[0]?.position).toBe(50);
  });
});
