/* Calque « santé des indicateurs » : les processus portent le nombre d'indicateurs atteints, non atteints et à mesurer. */
import { describe, expect, it } from 'vitest';
import { buildObjects } from '../src/carto/objects.js';

const etat = {
  processes: [
    { id: 'PR1', name: 'Gestion des accès', family: 'Support' },
    { id: 'PR2', name: 'Sans indicateur', family: 'Support' },
  ],
  objectives: [{ id: 'OBJ1', name: 'Objectif', processes: ['PR1'] }],
  indicators: [
    { id: 'I1', obj: 'OBJ1', dir: '≥', target: 0.9, values: [{ date: '2026-01-01', v: 0.95 }] },
    { id: 'I2', obj: 'OBJ1', dir: '≤', target: 2, values: [{ date: '2026-01-01', v: 5 }] },
    { id: 'I3', obj: 'OBJ1', dir: '≤', target: 2, values: [] },
    { id: 'I4', obj: 'OBJ1', values: [] },
  ],
};
describe('compteurs de santé des processus', () => {
  it('compte atteints, non atteints et à mesurer (non mesurés ou cible à définir)', () => {
    const objets = buildObjects(etat, {} as never);
    expect(objets.get('process:PR1')).toMatchObject({ nInd: 4, nKo: 1, nOk: 1, nMes: 2 });
    expect(objets.get('process:PR2')).toMatchObject({ nInd: 0, nKo: 0, nOk: 0, nMes: 0 });
  });
});
