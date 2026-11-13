import { describe, expect, it } from 'vitest';
import { QUADRANTS_SWOT, choixSwot, elementsSwot } from '../src/pilotage/swot-presentation';
import type { Rattache } from '@suivi/shared';

describe('lecture de la matrice SWOT', () => {
  it('lit les quatre champs éditables sans mélanger les catégories', () => {
    const data = {
      strengths: 'Équipe stable\nCompétences',
      weaknesses: 'Charge',
      opportunities: 'Partenariat',
      threats: 'Réglementation',
    };
    expect(QUADRANTS_SWOT.map((q) => elementsSwot(data, q))).toEqual([
      ['Équipe stable', 'Compétences'],
      ['Charge'],
      ['Partenariat'],
      ['Réglementation'],
    ]);
  });
  it('prend en compte un texte effacé sans réafficher son ancienne valeur', () => {
    expect(elementsSwot({ strengths: '', S: [{ text: 'Ancienne force' }] }, QUADRANTS_SWOT[0])).toEqual([]);
    expect(elementsSwot({ strengths: null, S: ['Ancienne force'] }, QUADRANTS_SWOT[0])).toEqual([]);
  });
  it('lit les formats historiques en conservant le contenu des éléments', () => {
    const data = {
      S: [{ text: 'Une force\nsur deux lignes' }, { t: 'Autre force' }, { label: 'Troisième' }, 'Texte', null],
    };
    expect(elementsSwot(data, QUADRANTS_SWOT[0])).toEqual([
      'Une force\nsur deux lignes',
      'Autre force',
      'Troisième',
      'Texte',
    ]);
    expect(data.S[0]).toEqual({ text: 'Une force\nsur deux lignes' });
  });
  it('garde les retours de ligne Windows lisibles sans fabriquer de contenu vide', () => {
    expect(elementsSwot({ strengths: ' Équipe\r\n\r\n Compétences ' }, QUADRANTS_SWOT[0])).toEqual([
      'Équipe',
      'Compétences',
    ]);
    expect(elementsSwot({}, QUADRANTS_SWOT[0])).toEqual([]);
  });
  it('réunit les rattachements de la fiche et les liens sans compter deux fois la même analyse', () => {
    const fiche: Rattache = { id: 'SW1', ref: 'legacy:swots:SW1', name: 'SWOT SW1', via: 'fiche', lienId: null };
    expect(
      choixSwot(
        [fiche],
        [
          { other: { ref: fiche.ref, name: 'Même fiche', kind: 'swot' } },
          { other: { ref: 'object:analyse-native', name: 'Analyse native', kind: 'swot' } },
        ],
      ),
    ).toEqual([
      { ref: fiche.ref, name: fiche.name },
      { ref: 'object:analyse-native', name: 'Analyse native' },
    ]);
  });
  it('ne transforme pas les autres relations ou une analyse archivée en SWOT disponible', () => {
    expect(
      choixSwot(undefined, [
        { other: { ref: 'object:risque', name: 'Risque', kind: 'risk' } },
        { other: { ref: 'object:archive', name: 'Archivée', kind: 'swot', archived: true } },
      ]),
    ).toEqual([]);
  });
});
