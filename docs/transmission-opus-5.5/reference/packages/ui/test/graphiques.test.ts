import { describe, expect, it } from 'vitest';
import { arcsAnneau, hautAxe } from '../src/graphiques.tsx';

describe('graphiques du tableau de bord (UI-02)', () => {
  it('anneau : arcs contigus couvrant toute la circonférence, parts nulles omises', () => {
    const arcs = arcsAnneau([
      { libelle: 'A', valeur: 1, teinte: 'vert' },
      { libelle: 'B', valeur: 0, teinte: 'rouge' },
      { libelle: 'C', valeur: 3, teinte: 'gris' },
    ]);
    expect(arcs.map((a) => a.libelle)).toEqual(['A', 'C']);
    const c = 2 * Math.PI * 40;
    expect(arcs[0]!.longueur).toBeCloseTo(c / 4, 6);
    expect(arcs[1]!.decalage).toBeCloseTo(c / 4, 6);
    expect(arcs[0]!.longueur + arcs[1]!.longueur).toBeCloseTo(c, 6);
  });
  it('anneau vide : aucun arc', () => {
    expect(arcsAnneau([{ libelle: 'A', valeur: 0, teinte: 'vert' }])).toEqual([]);
  });
  it('axe : graduation entière, au moins 3, au-dessus du maximum', () => {
    expect(hautAxe(0)).toBe(3);
    expect(hautAxe(10)).toBe(12);
    for (const m of [1, 7, 25, 99]) {
      expect(hautAxe(m) % 3).toBe(0);
      expect(hautAxe(m)).toBeGreaterThanOrEqual(m);
    }
  });
});
