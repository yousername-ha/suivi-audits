import { describe, expect, it } from 'vitest';
import { buildObjects } from '../src/carto/index.js';

/* Enjeux tirés des SWOT : les éléments d'un quadrant sont enregistrés sous la forme `{ text }` (format actuel) ou, dans
   les anciennes données, en texte simple. La carte affiche leur texte, jamais « [object Object] ». */
const etat = {
  processes: [{ id: 'PR1', name: 'Processus fictif' }],
  swots: [
    {
      id: 'SW-1',
      process: 'PR1',
      date: '2026-01-01',
      S: [{ text: 'Équipe stable' }],
      W: ['Ancien texte de faiblesse'],
      O: [],
      T: [{ text: 'Menace fictive' }],
    },
  ],
};

describe('enjeux issus des SWOT sur la carte', () => {
  const objets = [...buildObjects(etat, { org: 'Organisation fictive' }).values()];
  const libelles = objets.filter((o) => o.ref.startsWith('issue:')).map((o) => o.name);

  it('affiche le texte des éléments, ancien comme actuel', () => {
    expect(libelles).toEqual(expect.arrayContaining(['Équipe stable', 'Ancien texte de faiblesse', 'Menace fictive']));
  });

  it('n’affiche jamais « [object Object] »', () => {
    expect(libelles.some((l) => String(l).includes('[object Object]'))).toBe(false);
  });
});
