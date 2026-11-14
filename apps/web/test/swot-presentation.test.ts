/* Matrice SWOT Studio (refonte Neon, lot 5) : lecture des analyses et des rattachements, sans écriture ni objet fabriqué. */
import type { Rattache } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import {
  QUADRANTS_SWOT,
  analyseLisible,
  choixSwot,
  codeProcessus,
  dateSwot,
  elementsSwot,
  metaAnalyse,
  processusParDefaut,
  referenceSwot,
} from '../src/pilotage/swot-presentation';

const rattache = (ref: string, name: string, via: Rattache['via'] = 'fiche'): Rattache => ({
  ref,
  id: ref.split(':').at(-1)!,
  name,
  via,
  lienId: via === 'lien' ? 'lien-1' : null,
});

describe('matrice SWOT : quadrants', () => {
  it('garde l’ordre forces, faiblesses, opportunités, menaces sur les deux axes', () => {
    expect(QUADRANTS_SWOT.map((q) => [q.key, q.label, q.nature, q.angle])).toEqual([
      ['S', 'Forces', 'Interne', 'Favorable'],
      ['W', 'Faiblesses', 'Interne', 'Défavorable'],
      ['O', 'Opportunités', 'Externe', 'Favorable'],
      ['T', 'Menaces', 'Externe', 'Défavorable'],
    ]);
  });
  it('lit les quatre champs saisis, une ligne par élément, sans mélanger les catégories', () => {
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
  it('un champ effacé masque l’ancienne colonne historique', () => {
    expect(elementsSwot({ strengths: '', S: [{ text: 'Ancienne force' }] }, QUADRANTS_SWOT[0])).toEqual([]);
    expect(elementsSwot({ strengths: null, S: ['Ancienne force'] }, QUADRANTS_SWOT[0])).toEqual([]);
  });
  it('lit les listes historiques sans modifier la donnée et garde un élément sur plusieurs lignes', () => {
    const data = {
      T: [{ text: 'Une menace\nsur deux lignes' }, { t: 'Autre' }, { label: 'Troisième' }, 'Texte', null, {}],
    };
    expect(elementsSwot(data, QUADRANTS_SWOT[3])).toEqual([
      'Une menace\nsur deux lignes',
      'Autre',
      'Troisième',
      'Texte',
    ]);
    expect(data.T[0]).toEqual({ text: 'Une menace\nsur deux lignes' });
  });
  it('ignore les lignes vides et les retours de ligne Windows', () => {
    expect(elementsSwot({ opportunities: ' Un\r\n\r\n  Deux ' }, QUADRANTS_SWOT[2])).toEqual(['Un', 'Deux']);
    expect(elementsSwot({}, QUADRANTS_SWOT[1])).toEqual([]);
    expect(elementsSwot({ weaknesses: 42 }, QUADRANTS_SWOT[1])).toEqual([]);
  });
});

describe('matrice SWOT : analyses d’un processus', () => {
  it('réunit rattachements et relations des deux sens sans compter deux fois la même analyse', () => {
    const fiche = rattache('legacy:swots:SW1', 'SWOT SW1');
    expect(
      choixSwot(
        [fiche, rattache('legacy:swots:SW1', 'Doublon', 'lien')],
        [
          { other: { ref: fiche.ref, name: 'Même fiche', kind: 'swot' } },
          { other: { ref: 'object:a1', name: 'Analyse native', kind: 'swot' } },
        ],
      ),
    ).toEqual([
      { ref: 'legacy:swots:SW1', name: 'SWOT SW1' },
      { ref: 'object:a1', name: 'Analyse native' },
    ]);
  });
  it('écarte les autres relations et les analyses archivées', () => {
    expect(
      choixSwot(null, [
        { other: { ref: 'object:r1', name: 'Risque', kind: 'risk' } },
        { other: { ref: 'object:a2', name: 'Archivée', kind: 'swot', archived: true } },
      ]),
    ).toEqual([]);
  });
  it('hors du pilotage commun, n’offre pas les analyses historiques que l’API ne sert pas', () => {
    const liens = [{ other: { ref: 'legacy:swots:SW2', name: 'Historique', kind: 'swot' } }];
    expect(
      choixSwot([rattache('legacy:swots:SW1', 'SW1'), rattache('object:a3', 'Native', 'lien')], liens, false),
    ).toEqual([{ ref: 'object:a3', name: 'Native' }]);
    expect(analyseLisible('legacy:swots:SW1', true)).toBe(true);
    expect(analyseLisible('legacy:swots:SW1', false)).toBe(false);
    expect(analyseLisible('object:a3', false)).toBe(true);
  });
  it('référence une analyse historique ou native comme les relations transverses', () => {
    expect(referenceSwot({ id: 'legacy:swots:SW1' })).toBe('legacy:swots:SW1');
    expect(referenceSwot({ id: '0d8c5a3e-5b9e-4c38-9f61-6c0d6e7f2a10' })).toBe(
      'object:0d8c5a3e-5b9e-4c38-9f61-6c0d6e7f2a10',
    );
  });
  it('affiche par défaut le premier processus qui a une analyse, sinon le premier', () => {
    type P = { id: string; rattaches?: Rattache[] | null };
    const p1: P = { id: 'PR1', rattaches: [] },
      p2: P = { id: 'PR2', rattaches: [rattache('legacy:swots:SW1', 'SW1')] },
      p3: P = { id: 'natif' };
    expect(processusParDefaut([p1, p2, p3])?.id).toBe('PR2');
    expect(processusParDefaut([p1, p3])?.id).toBe('PR1');
    expect(processusParDefaut([])).toBeUndefined();
  });
});

describe('matrice SWOT : libellés', () => {
  it('montre le code métier du processus, jamais un identifiant technique', () => {
    expect(codeProcessus('PR2')).toBe('PR2');
    expect(codeProcessus('0d8c5a3e-5b9e-4c38-9f61-6c0d6e7f2a10')).toBe('Processus');
  });
  it('date et version de l’analyse, sinon version de la fiche', () => {
    expect(dateSwot('2026-09-20T10:00:00Z')).toBe('20/09/2026');
    expect(dateSwot(undefined)).toBe('');
    expect(metaAnalyse({ data: { date: '2026-09-20', version: 2 }, version: 7 })).toBe('20/09/2026 / Version 2');
    expect(metaAnalyse({ data: {}, version: 7 })).toBe('Fiche version 7');
  });
});
