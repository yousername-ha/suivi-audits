/* Tableau de bord du style « Verre » (décision du RSSI du 27/11/2026) : répartition des risques dans la grille de la
   méthode paramétrée, état des actions, nature des constats. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  etatActionTdb,
  natureConstat,
  NOMS_PAR_CASE,
  repartirGrilleRisques,
  risquesCritiques,
  type MethodeGrille,
  type RisqueApprecie,
} from '../src/index.js';

/** Méthode fictive : gravité sur 3 niveaux (dans le désordre), vraisemblance sur 2, échelle de 3 niveaux de risque. */
const methode = (basis: 'gross' | 'residual' = 'residual'): MethodeGrille => ({
  name: 'Méthode fictive',
  display: { defaultBasis: basis },
  dimensions: [
    { id: 'autre', label: 'Autre', levels: [{ id: 'x', label: 'X', value: 1 }] },
    {
      id: 'g',
      label: 'Gravité',
      levels: [
        { id: 'g3', label: 'Grave', value: 3 },
        { id: 'g1', label: 'Mineure', value: 1 },
        { id: 'g2', label: 'Significative', value: 2 },
      ],
    },
  ],
  likelihood: [
    { id: 'v2', label: 'Probable', value: 2 },
    { id: 'v1', label: 'Peu probable', value: 1 },
  ],
  levels: [
    { id: 'bas', label: 'Faible' },
    { id: 'moyen', label: 'Modéré' },
    { id: 'haut', label: 'Élevé' },
  ],
  calculation: {
    kind: 'matrix',
    dimension: 'g',
    cells: [
      { impact: 'g1', likelihood: 'v1', level: 'bas' },
      { impact: 'g2', likelihood: 'v1', level: 'bas' },
      { impact: 'g3', likelihood: 'v1', level: 'moyen' },
      { impact: 'g1', likelihood: 'v2', level: 'bas' },
      { impact: 'g2', likelihood: 'v2', level: 'moyen' },
      // (g3, v2) absente : case sans niveau.
    ],
  },
});
const cote = (g: string, v: string, base = 'residual') => ({ [base]: { dimensions: { g }, likelihood: v } });
const risque = (i: number, ratings: unknown, code = `R${i}`): RisqueApprecie => ({
  id: `r${i}`,
  perimetre: 'p',
  nom: `Risque fictif ${i}`,
  code,
  ratings,
});

describe('grille des risques du tableau de bord', () => {
  it('suit la taille de la matrice paramétrée : colonnes = gravité croissante, lignes = vraisemblance croissante', () => {
    const g = repartirGrilleRisques(methode(), [])!;
    expect(g.axe).toBe('Gravité');
    expect(g.colonnes).toEqual(['Mineure', 'Significative', 'Grave']);
    expect(g.lignes).toEqual(['Peu probable', 'Probable']);
    expect(g.niveaux).toEqual(['Faible', 'Modéré', 'Élevé']);
    expect(g.cases).toHaveLength(6);
    // Niveau publié dans la méthode, case absente : sans niveau.
    expect(g.cases.map((c) => c.niveau)).toEqual([0, 0, 1, 0, 1, null]);
    expect(g.cases.every((c) => c.n === 0 && c.risques.length === 0)).toBe(true);
  });

  it('place chaque risque dans la case de ses cotations, selon la base par défaut de la méthode', () => {
    const risques = [
      risque(1, cote('g3', 'v1')),
      risque(2, cote('g3', 'v1')),
      risque(3, cote('g1', 'v2')),
      // Cotation brute seulement : hors grille quand la méthode affiche le résiduel.
      risque(4, cote('g1', 'v1', 'gross')),
      // Niveau inconnu de la matrice, cotation absente : hors grille.
      risque(5, cote('g9', 'v1')),
      risque(6, null),
    ];
    const g = repartirGrilleRisques(methode(), risques)!;
    const n = (colonne: number, ligne: number) => g.cases.find((c) => c.colonne === colonne && c.ligne === ligne)!.n;
    expect(n(2, 0)).toBe(2);
    expect(n(0, 1)).toBe(1);
    expect(g.places).toBe(3);
    expect(g.horsGrille).toBe(3);
    expect(g.cases.reduce((s, c) => s + c.n, 0)).toBe(g.places);
    const brute = repartirGrilleRisques(methode('gross'), risques)!;
    expect(brute.base).toBe('gross');
    expect(brute.places).toBe(1);
    expect(brute.cases.find((c) => c.colonne === 0 && c.ligne === 0)!.n).toBe(1);
  });

  it('borne les noms d’une case, gardés par code, sans changer son nombre', () => {
    const risques = Array.from({ length: NOMS_PAR_CASE + 3 }, (_, i) => risque(20 - i, cote('g2', 'v2')));
    const c = repartirGrilleRisques(methode(), risques)!.cases.find((x) => x.colonne === 1 && x.ligne === 1)!;
    expect(c.n).toBe(NOMS_PAR_CASE + 3);
    expect(c.risques).toHaveLength(NOMS_PAR_CASE);
    expect(c.risques[0]!.code).toBe('R12');
    expect(c.risques.map((r) => r.code)).toEqual(['R12', 'R13', 'R14', 'R15', 'R16', 'R17']);
  });

  it('risques critiques : ceux des cases au niveau le plus fort de l’échelle', () => {
    const m = methode();
    (m.calculation as { cells: { impact: string; likelihood: string; level: string }[] }).cells.push({
      impact: 'g3',
      likelihood: 'v2',
      level: 'haut',
    });
    const g = repartirGrilleRisques(m, [
      risque(1, cote('g3', 'v2')),
      risque(2, cote('g3', 'v2')),
      risque(3, cote('g2', 'v2')),
    ])!;
    expect(risquesCritiques(g)).toBe(2);
    expect(risquesCritiques(repartirGrilleRisques(methode(), [risque(1, cote('g3', 'v1'))])!)).toBe(0);
  });

  it('pas de grille pour une méthode sans matrice (jugement, règles) ou à dimension inconnue', () => {
    expect(repartirGrilleRisques({ ...methode(), calculation: { kind: 'judgement' } }, [])).toBeNull();
    expect(
      repartirGrilleRisques({ ...methode(), calculation: { kind: 'matrix', dimension: 'absente', cells: [] } }, []),
    ).toBeNull();
  });
});

describe('état d’une action au tableau de bord', () => {
  const jour = '2026-11-27';
  it('close, en retard, à échéance ce mois-ci, sinon ouverte', () => {
    expect(etatActionTdb('2026-10-01', true, jour)).toBe('close');
    expect(etatActionTdb('2026-11-26', false, jour)).toBe('retard');
    expect(etatActionTdb('2026-11-27', false, jour)).toBe('mois');
    expect(etatActionTdb('2026-11-30', false, jour)).toBe('mois');
    expect(etatActionTdb('2026-12-01', false, jour)).toBe('ouverte');
    expect(etatActionTdb(null, false, jour)).toBe('ouverte');
    expect(etatActionTdb('à définir', false, jour)).toBe('ouverte');
  });
});

describe('nature d’un constat', () => {
  it('classification d’abord (fiche, sinon type historique), puis piste de progrès, sinon observation', () => {
    expect(natureConstat({ classification: 'majeure' })).toBe('majeure');
    expect(natureConstat({ classification: 'mineure', findingType: 'opportunity' })).toBe('mineure');
    expect(natureConstat({ type: 'NC maj' })).toBe('majeure');
    expect(natureConstat({ classification: 'point_sensible' })).toBe('observation');
    expect(natureConstat({ findingType: 'opportunity' })).toBe('piste');
    expect(natureConstat({ type: 'PP' })).toBe('piste');
    expect(natureConstat({ findingType: 'observation' })).toBe('observation');
    expect(natureConstat({ findingType: 'nonconformity', classification: '' })).toBe('observation');
  });
});
