/* Tableau de bord du style « Verre » (décision du RSSI du 27/11/2026) : répartition des risques dans la grille de la
   méthode paramétrée, état et ordre des actions (28/11/2026), nature des constats. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  comparerActionsTdb,
  ETATS_ACTION_TDB,
  etatActionTdb,
  LIBELLES_ETAT_ACTION_TDB,
  LIBELLES_NATURE_CONSTAT,
  NATURES_CONSTAT,
  natureConstat,
  NOMS_PAR_CASE,
  rangActionTdb,
  repartirGrilleRisques,
  risquesCritiques,
  type ActionPourTdb,
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
  const action = (x: Partial<ActionPourTdb> = {}): ActionPourTdb => ({
    terminee: false,
    initiale: true,
    debut: null,
    echeance: null,
    priorite: 'normal',
    ...x,
  });
  const etat = (x: Partial<ActionPourTdb> = {}) => etatActionTdb(action(x), jour);

  it('quatre états : terminée, planifiée, à faire, en cours', () => {
    expect(etat({ terminee: true, initiale: false }).etat).toBe('terminee');
    // Statut initial terminal impossible (politique), mais le statut terminal l'emporte toujours.
    expect(etat({ terminee: true, debut: '2027-01-01' }).etat).toBe('terminee');
    expect(etat({ debut: '2026-12-01T08:00:00.000Z' }).etat).toBe('planifiee');
    expect(etat().etat).toBe('a_faire');
    expect(etat({ initiale: false }).etat).toBe('en_cours');
    // Statut non initial (en cours, bloquée…) : en cours même avec un début futur.
    expect(etat({ initiale: false, debut: '2027-01-01' }).etat).toBe('en_cours');
  });

  it('planifiée seulement pour un début strictement postérieur au jour civil', () => {
    expect(etat({ debut: '2026-11-28' }).etat).toBe('planifiee');
    // Jour civil de la date enregistrée (ses dix premiers caractères), comme l'échéance.
    expect(etat({ debut: '2026-11-27T23:30:00.000Z' }).etat).toBe('a_faire');
    expect(etat({ debut: '2026-11-27' }).etat).toBe('a_faire');
    expect(etat({ debut: '2026-10-01T08:00:00.000Z' }).etat).toBe('a_faire');
    expect(etat({ debut: 'à définir' }).etat).toBe('a_faire');
  });

  it('en retard : non terminée et échéance antérieure au jour, quel que soit l’état', () => {
    expect(etat({ echeance: '2026-11-26' }).retard).toBe(true);
    expect(etat({ initiale: false, echeance: '2026-11-26T09:00:00.000Z' }).retard).toBe(true);
    expect(etat({ echeance: '2026-11-27' }).retard).toBe(false);
    expect(etat({ echeance: '2026-12-01' }).retard).toBe(false);
    expect(etat({ echeance: null }).retard).toBe(false);
    expect(etat({ echeance: 'à définir' }).retard).toBe(false);
    expect(etat({ terminee: true, initiale: false, echeance: '2026-10-01' })).toEqual({
      etat: 'terminee',
      retard: false,
      prioritaire: false,
    });
  });

  it('prioritaire : non terminée, priorité haute ou urgente, cumulable avec le retard', () => {
    expect(etat({ terminee: true, initiale: false, priorite: 'urgent' }).prioritaire).toBe(false);
    expect(etat({ priorite: 'high' }).prioritaire).toBe(true);
    expect(etat({ priorite: 'urgent' }).prioritaire).toBe(true);
    for (const p of ['normal', 'low', null, undefined, 'High'])
      expect(etat({ priorite: p }).prioritaire, String(p)).toBe(false);
    expect(etat({ initiale: false, priorite: 'urgent', echeance: '2026-11-01' })).toEqual({
      etat: 'en_cours',
      retard: true,
      prioritaire: true,
    });
  });

  it('ordre : en retard, prioritaires, à faire ou en cours par échéance, planifiées, terminées', () => {
    const a = (id: string, x: Partial<ActionPourTdb>, echeance: string | null = null) => ({
      id,
      nom: `Action fictive ${id}`,
      echeance,
      ...etat({ ...x, echeance }),
    });
    const actions = [
      a('terminee', { terminee: true, initiale: false }, '2026-11-01'),
      a('planifiee', { debut: '2026-12-10' }, '2026-12-20'),
      a('sans-echeance', {}),
      a('en-cours-tard', { initiale: false }, '2027-02-01'),
      a('a-faire-tot', {}, '2026-12-05'),
      a('prioritaire', { priorite: 'high' }, '2027-03-01'),
      a('planifiee-prioritaire', { debut: '2026-12-10', priorite: 'urgent' }, '2026-12-31'),
      a('retard-recent', {}, '2026-11-20'),
      a('retard-ancien', { priorite: 'urgent', initiale: false }, '2026-11-02'),
    ];
    expect([...actions].sort(comparerActionsTdb).map((x) => x.id)).toEqual([
      'retard-ancien',
      'retard-recent',
      'planifiee-prioritaire',
      'prioritaire',
      'a-faire-tot',
      'en-cours-tard',
      'sans-echeance',
      'planifiee',
      'terminee',
    ]);
    expect(actions.map((x) => [x.id, rangActionTdb(x)])).toEqual([
      ['terminee', 4],
      ['planifiee', 3],
      ['sans-echeance', 2],
      ['en-cours-tard', 2],
      ['a-faire-tot', 2],
      ['prioritaire', 1],
      ['planifiee-prioritaire', 1],
      ['retard-recent', 0],
      ['retard-ancien', 0],
    ]);
  });

  it('libellé de chaque état', () => {
    expect(ETATS_ACTION_TDB.map((e) => LIBELLES_ETAT_ACTION_TDB[e])).toEqual([
      'À faire',
      'En cours',
      'Planifiée',
      'Terminée',
    ]);
  });
});

describe('nature d’un constat', () => {
  it('classification d’abord (fiche, sinon type historique), puis piste de progrès, sinon observation', () => {
    expect(natureConstat({ type: 'PS' })).toBe('point_sensible');
    expect(natureConstat({ type: 'Remarque' })).toBe('observation');
    expect(natureConstat({ classification: 'majeure' })).toBe('majeure');
    expect(natureConstat({ classification: 'mineure', findingType: 'opportunity' })).toBe('mineure');
    expect(natureConstat({ type: 'NC maj' })).toBe('majeure');
    expect(natureConstat({ classification: 'point_sensible' })).toBe('point_sensible');
    expect(natureConstat({ findingType: 'opportunity' })).toBe('piste');
    expect(natureConstat({ type: 'PP' })).toBe('piste');
    expect(natureConstat({ findingType: 'observation' })).toBe('observation');
    expect(natureConstat({ findingType: 'nonconformity', classification: '' })).toBe('observation');
  });
});

describe('natures de constat du tableau de bord', () => {
  it('cinq natures, points sensibles entre mineures et observations', () => {
    expect(NATURES_CONSTAT).toEqual(['majeure', 'mineure', 'point_sensible', 'observation', 'piste']);
    expect(LIBELLES_NATURE_CONSTAT.point_sensible).toBe('Points sensibles');
  });
});
