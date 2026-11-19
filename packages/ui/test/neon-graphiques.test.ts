import { describe, expect, it } from 'vitest';
import {
  cheminMarque,
  formeMarque,
  graduationsCourbes,
  nombreNeon,
  pointsRadar,
  positionsDates,
  segmentsCourbe,
} from '../src/neon-graphiques.tsx';
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
  it('courbes : graduations d’origine ou entières, segments coupés par les mesures absentes, une forme par série', () => {
    expect(graduationsCourbes(5, false)).toEqual({ haut: 5, valeurs: [0, 2, 3, 5] });
    expect(graduationsCourbes(4, true)).toEqual({ haut: 4, valeurs: [0, 1, 2, 3, 4] });
    expect(graduationsCourbes(1, true)).toEqual({ haut: 4, valeurs: [0, 1, 2, 3, 4] });
    expect(graduationsCourbes(37, true)).toEqual({ haut: 40, valeurs: [0, 10, 20, 30, 40] });
    const s = segmentsCourbe([1, null, 2, 3, null], 4);
    expect(s.map((seg) => seg.map((p) => p.k))).toEqual([[0], [2, 3]]);
    expect(s[0]![0]).toEqual({ x: 25, y: 145 - 126 / 4, k: 0 });
    expect(segmentsCourbe([null, null], 4)).toEqual([]);
    expect([0, 1, 2, 3, 4].map(formeMarque)).toEqual(['rond', 'carre', 'triangle', 'losange', 'rond']);
    for (const f of ['rond', 'carre', 'triangle', 'losange'] as const)
      expect(cheminMarque(f, 10, 20)).not.toMatch(/NaN|Infinity/);
  });
});
