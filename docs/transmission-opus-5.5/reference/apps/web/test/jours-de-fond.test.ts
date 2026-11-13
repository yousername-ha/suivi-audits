import { describe, expect, it } from 'vitest';
import { joursDeFond } from '../src/grc/jours-de-fond';

const calendriers = [
  { id: 'f', name: 'Fériés fictifs', kind: 'feries' as const },
  { id: 'a', name: 'Fermetures fictives', kind: 'autre' as const },
];
const jours = new Map([
  [
    'f',
    [
      { date: '2027-01-01', label: 'Jour de l’an' },
      { date: '2026-12-25', label: '' },
    ],
  ],
  ['a', [{ date: '2026-12-31', label: 'Pont fictif' }]],
]);

describe('jours de fond', () => {
  it('n’affiche que les familles cochées, chacune séparément', () => {
    expect(joursDeFond(calendriers, jours, { feries: false, autres: false })).toEqual([]);
    expect(joursDeFond(calendriers, jours, { feries: true, autres: false }).map((j) => j.famille)).toEqual([
      'feries',
      'feries',
    ]);
    expect(joursDeFond(calendriers, jours, { feries: false, autres: true }).map((j) => j.label)).toEqual([
      'Pont fictif',
    ]);
  });

  it('trie par date et garde le nom du calendrier quand un jour n’a pas de libellé', () => {
    const tout = joursDeFond(calendriers, jours, { feries: true, autres: true });
    expect(tout.map((j) => j.date)).toEqual(['2026-12-25', '2026-12-31', '2027-01-01']);
    expect(tout[0]!.label).toBe('Fériés fictifs');
  });
});
