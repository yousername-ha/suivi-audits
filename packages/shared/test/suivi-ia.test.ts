/* Conformité IA : indice, niveau, alertes des étapes et statistiques de l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  EtapeIaModification,
  UsageIaModification,
  etapeIa,
  evaluationIa,
  identifiantUsageIa,
  lireDonneesIa,
  statistiquesIa,
} from '../src/index.js';

const ev = (o: Record<string, unknown> = {}) => ({
  app: 'Applicable',
  c: 0,
  i: 0,
  a: 0,
  audit: 0,
  patient: 0,
  prob: 0,
  dscp: '',
  maturity: 0,
  effort: 0,
  ...o,
});
const AUJOURDHUI = '2026-10-14';

describe('indice et niveau', () => {
  it('70 % du risque résiduel + 30 % de l’effort ; facteur 1,25 avec DSCP ; maturité réduit le risque', () => {
    // impact 4 × probabilité 3 = 12 ; DSCP ×1,25 = 15 ; maturité 2 : × 0,6 = 9 ; 0,7 × 9 + 0,3 × 5 = 7,8
    expect(evaluationIa(ev({ c: 3, i: 2, a: 1, patient: 4, prob: 3, dscp: 'Oui', maturity: 2, effort: 5 }))).toEqual({
      niveau: 'Modéré',
      indice: 7.8,
      residuel: 9,
      cls: 'mid',
    });
  });
  it('plafonne le risque à 25 ; seuils 16 critique, 10 élevé, 5 modéré', () => {
    expect(evaluationIa(ev({ c: 5, prob: 5, dscp: 'Oui' }))).toMatchObject({ niveau: 'Critique', indice: 17.5 });
    expect(evaluationIa(ev({ c: 4, prob: 3 }))).toMatchObject({ niveau: 'Modéré', indice: 8.4 }); // 12 × 0,7 = 8,4
    expect(evaluationIa(ev({ c: 5, prob: 4 }))).toMatchObject({ niveau: 'Élevé', indice: 14 });
    expect(evaluationIa(ev({ c: 2, prob: 4 }))).toMatchObject({ niveau: 'Modéré', indice: 5.6 });
    expect(evaluationIa(ev({ c: 2, prob: 3 }))).toMatchObject({ niveau: 'Faible', indice: 4.2 });
    expect(evaluationIa(ev({ c: 1, prob: 1 }))).toMatchObject({ niveau: 'Faible', indice: 0.7 });
  });
  it('un scénario conditionnel n’a pas d’indice', () => {
    expect(evaluationIa(ev({ app: 'Conditionnel : IA interne', c: 5, prob: 5 }))).toEqual({
      niveau: 'N/A conditionnel',
      indice: null,
      cls: 'na',
    });
  });
});

describe('étapes du plan', () => {
  const e = (jEnd: number, status = 'En cours') => ({ jStart: 0, jEnd, status });
  it('début et échéance = date de début du plan + jours', () => {
    expect(etapeIa({ jStart: 10, jEnd: 40, status: 'À faire' }, '2026-01-01', true, AUJOURDHUI)).toMatchObject({
      debut: '2026-01-11',
      echeance: '2026-02-10',
    });
    expect(etapeIa(e(10), '', true, AUJOURDHUI)).toEqual({ debut: null, echeance: null, alerte: ['Planifié', 'na'] });
  });
  it('alertes : retard, date à valider, à traiter sous 14 jours, planifié, clos, déclencheur futur', () => {
    expect(etapeIa(e(30), '2026-01-01', true, AUJOURDHUI).alerte).toEqual(['En retard', 'bad']);
    expect(etapeIa(e(30), '2026-01-01', false, AUJOURDHUI).alerte).toEqual(['Date à valider', 'na']);
    expect(etapeIa(e(289), '2026-01-01', true, AUJOURDHUI).alerte).toEqual(['À traiter ≤ 14 j', 'mid']); // 17/10/2026
    expect(etapeIa(e(400), '2026-01-01', true, AUJOURDHUI).alerte).toEqual(['Planifié', 'na']);
    expect(etapeIa(e(30, 'Terminé'), '2026-01-01', true, AUJOURDHUI).alerte).toEqual(['Clos', 'ok']);
    expect(etapeIa(e(30, 'Non applicable'), '2026-01-01', true, AUJOURDHUI).alerte).toEqual([
      'Déclencheur futur',
      'na',
    ]);
  });
});

describe('statistiques et lecture', () => {
  const brut = {
    context: 'Contexte fictif',
    start: '2026-01-01',
    startValidated: true,
    register: [{ id: 'EXT-IA-01' }, { nom: 'sans identifiant' }],
    evals: [
      { id: 'E01', app: 'Applicable', c: 5, prob: 5, maturity: 3 },
      { id: 'E02', app: 'Conditionnel', c: 5, prob: 5 },
      { id: 'E03', app: 'Applicable', c: 1, prob: 1, maturity: 0 },
    ],
    plan: [
      { id: 'AP-001', step: '1', status: 'Terminé', progress: 100, jEnd: 10 },
      { step: '2', status: 'En cours', progress: 50, jEnd: 20 },
      { id: 'AP-003', step: '3', status: 'Non applicable', progress: 0, jEnd: 20 },
    ],
    policies: [{ policy: 'Politique fictive', status: 'À faire' }],
  };
  it('lit les données ; l’usage sans identifiant est ignoré, l’étape sans identifiant reçoit « @rang »', () => {
    const d = lireDonneesIa(brut)!;
    expect(d.register.map((r) => r.id)).toEqual(['EXT-IA-01']);
    expect(d.plan.map((p) => p.cle)).toEqual(['AP-001', '@1', 'AP-003']);
    expect(d.policies[0]!.cle).toBe('@0');
  });
  it('données absentes ou incomplètes : null', () => {
    expect(lireDonneesIa(undefined)).toBeNull();
    expect(lireDonneesIa({ register: [] })).toBeNull();
  });
  it('statistiques du tableau de bord IA', () => {
    const s = statistiquesIa(lireDonneesIa(brut)!, AUJOURDHUI);
    expect(s).toMatchObject({
      scenarios: 3,
      applicables: 2,
      couverts: 1,
      etapes: 2,
      terminees: 1,
      avancement: 75,
      enRetard: 1,
    });
    expect(s.niveaux).toEqual({ Critique: 0, Élevé: 0, Modéré: 1, Faible: 1 }); // E01 : 25 × 0,4 = 10 → indice 7
  });
  it('identifiant d’usage', () => {
    expect(identifiantUsageIa([])).toBe('EXT-IA-01');
    expect(identifiantUsageIa(['EXT-IA-01', 'EXT-IA-03'])).toBe('EXT-IA-04');
  });
});

describe('requêtes', () => {
  it('listes fermées et bornes', () => {
    expect(UsageIaModification.safeParse({ authz: 'Autorisé', category: 'Service IA web externe' }).success).toBe(true);
    expect(UsageIaModification.safeParse({ authz: 'Peut-être' }).success).toBe(false);
    expect(EtapeIaModification.safeParse({ progress: 75, status: 'Terminé' }).success).toBe(true);
    expect(EtapeIaModification.safeParse({ progress: 60 }).success).toBe(false);
    expect(EtapeIaModification.safeParse({ inconnu: 1 }).success).toBe(false);
  });
});
