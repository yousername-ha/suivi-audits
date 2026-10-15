/* Plan d'investissement : calculs de l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  LigneInvestModification,
  comparerOptions,
  etatRenouvellement,
  identifiantInvest,
  lireLigneInvest,
  niveauStatutInvest,
  renouvellements,
  syntheseInvest,
  totalInvest,
  trierLignesInvest,
} from '../src/index.js';

const ligne = (o: Record<string, unknown>) => lireLigneInvest({ id: 'INV-001', ...o })!;
const AUJOURDHUI = '2026-10-14';

describe('lecture et total', () => {
  it('valeurs par défaut de l’outil historique', () => {
    const l = ligne({});
    expect(l).toMatchObject({ status: 'À qualifier', nature: 'Abonnement', notice: 60, n0: 0, renewal: '' });
    expect(lireLigneInvest({ company: 'sans identifiant' })).toBeNull();
  });
  it('total sur trois ans', () => {
    expect(totalInvest(ligne({ n0: 100, n1: 50.5, n2: '25' }))).toBe(175.5);
  });
  it('identifiant : premier numéro libre', () => {
    expect(identifiantInvest(['INV-001', 'INV-003'])).toBe('INV-002');
    expect(identifiantInvest([])).toBe('INV-001');
  });
});

describe('renouvellements', () => {
  it('lignes non annulées dont l’échéance tombe dans la fenêtre, échues comprises', () => {
    const l = [
      ligne({ id: 'A', renewal: '2026-12-01' }),
      ligne({ id: 'B', renewal: '2026-09-01' }),
      ligne({ id: 'C', renewal: '2027-06-01' }),
      ligne({ id: 'D', renewal: '2026-11-01', status: 'Annulé' }),
      ligne({ id: 'E' }),
    ];
    expect(renouvellements(l, 120, AUJOURDHUI).map((x) => x.id)).toEqual(['B', 'A']);
  });
  it('état : échu, à anticiper selon le préavis, à venir, non renseigné', () => {
    expect(etatRenouvellement(ligne({}), AUJOURDHUI)).toEqual(['Non renseigné', 'na']);
    expect(etatRenouvellement(ligne({ renewal: '2026-10-13' }), AUJOURDHUI)).toEqual(['Échu', 'bad']);
    expect(etatRenouvellement(ligne({ renewal: '2026-12-13', notice: 60 }), AUJOURDHUI)).toEqual([
      'À anticiper',
      'mid',
    ]);
    expect(etatRenouvellement(ligne({ renewal: '2026-12-14', notice: 60 }), AUJOURDHUI)).toEqual(['À venir', 'ok']);
  });
});

describe('tableau de bord', () => {
  const l = [
    ligne({ id: 'A', status: 'En place', n0: 100, n1: 100, n2: 100, perimeter: 'Poste' }),
    ligne({ id: 'B', status: 'Validé', n0: 50, n1: 20, perimeter: 'Poste' }),
    ligne({ id: 'C', status: 'Prévisionnel', n1: 300 }),
    ligne({ id: 'D', status: 'À qualifier', n0: 10 }),
    ligne({ id: 'E', status: 'Annulé', n0: 9999, perimeter: 'Poste' }),
  ];
  it('budgets, prévisionnels et barres exclues des lignes annulées', () => {
    const s = syntheseInvest(l, 2026);
    expect(s.budgetN).toBe(160);
    expect(s.budgetNEnPlace).toBe(100);
    expect(s.total3ans).toBe(300 + 70 + 300 + 10);
    expect(s.previsionnels).toEqual({ nombre: 3, total: 70 + 300 + 10 });
    expect(s.parAnnee[1]).toEqual({ cle: 'n1', annee: 2027, enPlace: 100, valide: 20, previsionnel: 300 });
    expect(s.parPerimetre).toEqual(
      [
        { libelle: 'Non renseigné', valeur: 310 },
        { libelle: 'Poste', valeur: 370 },
      ].sort((a, b) => b.valeur - a.valeur),
    );
    expect(s.principales[0]!.id).toBe('A');
  });
  it('niveaux de statut', () => {
    expect(['En place', 'Validé', 'Prévisionnel', 'Annulé', 'À qualifier'].map(niveauStatutInvest)).toEqual([
      'ok',
      'info',
      'mid',
      'na',
      'na',
    ]);
  });
  it('tri : priorité puis coût décroissant', () => {
    const t = trierLignesInvest([
      ligne({ id: 'A', n0: 1 }),
      ligne({ id: 'B', priority: '2', n0: 5 }),
      ligne({ id: 'C', priority: '1', n0: 1 }),
      ligne({ id: 'D', priority: '2', n0: 9 }),
    ]);
    expect(t.map((x) => x.id)).toEqual(['C', 'D', 'B', 'A']);
  });
});

describe('comparaison des options', () => {
  it('groupes de même type, moins cher parmi les non annulées', () => {
    const g = comparerOptions([
      ligne({ id: 'A', type: 'EDR', n0: 100 }),
      ligne({ id: 'B', type: ' EDR ', n0: 60 }),
      ligne({ id: 'C', type: 'EDR', n0: 10, status: 'Annulé' }),
      ligne({ id: 'D', type: 'SIEM', n0: 5 }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.type).toBe('EDR');
    expect(g[0]!.options.map((x) => x.id)).toEqual(['C', 'B', 'A']);
    expect(g[0]!.minimum).toBe(60);
  });
});

describe('validation', () => {
  it('refuse un statut inconnu, une date invalide et les champs inattendus', () => {
    expect(LigneInvestModification.safeParse({ status: 'Autre' }).success).toBe(false);
    expect(LigneInvestModification.safeParse({ renewal: '14/10/2026' }).success).toBe(false);
    expect(LigneInvestModification.safeParse({ inconnu: 1 }).success).toBe(false);
    expect(LigneInvestModification.safeParse({ renewal: '', n0: 12.5, priority: '' }).success).toBe(true);
  });
});
