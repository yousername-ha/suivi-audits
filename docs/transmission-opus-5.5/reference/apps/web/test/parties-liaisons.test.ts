import { describe, expect, it } from 'vitest';
import { liaisonsParties, parcoursParties, type CartePartie, type PointPartie } from '../src/pilotage/parties-liaisons';

const hub = { cx: 360, cy: 190, radius: 58 };
const internal: CartePartie[] = [
  { id: 'I1', left: 0, right: 220, top: 30, bottom: 170 },
  { id: 'I2', left: 0, right: 220, top: 196, bottom: 350 },
];
const external: CartePartie[] = [
  { id: 'E1', left: 500, right: 720, top: 30, bottom: 170 },
  { id: 'E2', left: 754, right: 974, top: 30, bottom: 170 },
  { id: 'E3', left: 500, right: 720, top: 196, bottom: 350 },
  { id: 'E4', left: 754, right: 974, top: 196, bottom: 350 },
];
function crosses(a: PointPartie, b: PointPartie, c: CartePartie) {
  return a[1] === b[1]
    ? a[1] > c.top && a[1] < c.bottom && Math.max(a[0], b[0]) > c.left && Math.min(a[0], b[0]) < c.right
    : a[0] > c.left && a[0] < c.right && Math.max(a[1], b[1]) > c.top && Math.min(a[1], b[1]) < c.bottom;
}

describe('liaisons orthogonales des parties intéressées', () => {
  for (const [name, ins, outs] of [
    ['deux colonnes externes', internal, external],
    ['une seule rangée', internal.slice(0, 1), external.slice(0, 2)],
    ['colonne externe unique', internal, external.filter((c) => c.left === 500)],
    ['externes seules', [], external],
    ['internes seules', internal, []],
  ] as const)
    it(`${name} : une branche par acteur, sans traverser une carte`, () => {
      const routes = liaisonsParties(hub, [...ins], [...outs]);
      expect(routes.filter((r) => r.role === 'outlet')).toHaveLength(Number(!!ins.length) + Number(!!outs.length));
      expect(
        routes
          .filter((r) => r.role === 'branch')
          .map((r) => r.target)
          .sort(),
      ).toEqual([...ins, ...outs].map((c) => c.id).sort());
      for (const r of [...routes, ...parcoursParties(routes)]) {
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1]!,
            b = r.points[i]!;
          expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
          for (const card of [...ins, ...outs]) expect(crosses(a, b, card)).toBe(false);
        }
      }
      for (const p of parcoursParties(routes)) {
        const outlet = routes.find((r) => r.side === p.side && r.role === 'outlet')!;
        const branch = routes.find((r) => r.target === p.target)!;
        expect(p.points[0]).toEqual(outlet.points[0]);
        expect(p.points.at(-1)).toEqual(branch.points.at(-1));
      }
    });
  it('aucune nature connue : aucun lien ni parcours inventé', () => {
    expect(liaisonsParties(hub, [], [])).toEqual([]);
    expect(parcoursParties([])).toEqual([]);
  });
});
