/* Plans du SMSI : états, statistiques et occurrences, avec les résultats de l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  ActionPlanCreation,
  ActionPlanModification,
  actionPlanEnRetard,
  actionPlanEtat,
  actionPlanVierge,
  decalerAction,
  decalerDate,
  identifiantPlan,
  lireActionPlan,
  lireTacheRecurrente,
  occurrenceRealisee,
  planStatistiques,
  plansDe,
  recurrenceOccurrences,
  recurrenceSuivante,
} from '../src/index.js';

const AUJOURDHUI = '2026-10-14';
const plan = (o: Record<string, unknown>) => lireActionPlan({ id: 'PL-FOR-001', type: 'formation', ...o })!;

describe('identifiants et lecture', () => {
  it('prend le premier numéro libre de chaque plan', () => {
    expect(identifiantPlan('formation', [])).toBe('PL-FOR-001');
    expect(identifiantPlan('formation', ['PL-FOR-001', 'PL-FOR-003'])).toBe('PL-FOR-002');
    expect(identifiantPlan('exo', ['PL-FOR-001'])).toBe('PL-EXO-001');
  });
  it('refuse un type inconnu ou sans identifiant, normalise le reste', () => {
    expect(lireActionPlan({ id: 'X', type: 'autre' })).toBeNull();
    expect(lireActionPlan({ type: 'audit' })).toBeNull();
    const p = lireActionPlan({ id: 'PL-AUD-001', type: 'audit', items: ['A-5.1', 3, 'A-5.2'], title: 12 })!;
    expect(p.items).toEqual(['A-5.1', 'A-5.2']);
    expect(p.title).toBe('12');
    expect(p.status).toBe('');
  });
  it('une action neuve reprend les valeurs de planNew', () => {
    const p = actionPlanVierge('sensi', 'PL-SEN-001', '2026-10-14T00:00:00.000Z');
    expect(p.status).toBe('Planifié');
    expect(p.kind).toBe('Module e-learning');
    expect(p.items).toEqual([]);
  });
});

describe('retard et états', () => {
  it('en retard : ni réalisé ni annulé, date de fin (ou de début) passée', () => {
    expect(actionPlanEnRetard(plan({ status: 'Planifié', start: '2026-10-13' }), AUJOURDHUI)).toBe(true);
    expect(actionPlanEnRetard(plan({ status: 'Planifié', start: '2026-10-14' }), AUJOURDHUI)).toBe(false);
    expect(actionPlanEnRetard(plan({ status: 'Planifié', start: '2026-09-01', end: '2026-10-20' }), AUJOURDHUI)).toBe(
      false,
    );
    expect(actionPlanEnRetard(plan({ status: 'Réalisé', start: '2026-01-01' }), AUJOURDHUI)).toBe(false);
    expect(actionPlanEnRetard(plan({ status: 'Annulé', start: '2026-01-01' }), AUJOURDHUI)).toBe(false);
    expect(actionPlanEnRetard(plan({ status: 'Planifié' }), AUJOURDHUI)).toBe(false);
  });
  it('« En retard » l’emporte sur le statut saisi ; sinon le statut et sa couleur', () => {
    expect(actionPlanEtat(plan({ status: 'En préparation', start: '2026-01-01' }), AUJOURDHUI)).toEqual([
      'En retard',
      'bad',
    ]);
    expect(actionPlanEtat(plan({ status: 'Réalisé', start: '2026-01-01' }), AUJOURDHUI)).toEqual(['Réalisé', 'ok']);
    expect(actionPlanEtat(plan({ status: 'Reporté', start: '2027-01-01' }), AUJOURDHUI)).toEqual(['Reporté', 'hi']);
    expect(actionPlanEtat(plan({ status: 'En préparation' }), AUJOURDHUI)).toEqual(['En préparation', 'mid']);
    expect(actionPlanEtat(plan({ status: '' }), AUJOURDHUI)).toEqual(['Planifié', 'na']);
  });
  it('statistiques d’un type et d’une année, sans les annulées', () => {
    const l = [
      plan({ id: 'a', status: 'Réalisé', start: '2026-02-01' }),
      plan({ id: 'b', status: 'Planifié', start: '2026-03-01' }),
      plan({ id: 'c', status: 'Annulé', start: '2026-04-01' }),
      plan({ id: 'd', status: 'Planifié', start: '2027-04-01' }),
      plan({ id: 'e', type: 'sensi', status: 'Planifié', start: '2026-04-01' }),
    ];
    expect(planStatistiques(l, 'formation', 2026, AUJOURDHUI)).toEqual({ total: 2, realises: 1, enRetard: 1 });
    expect(plansDe(l, null, 2026).map((p) => p.id)).toEqual(['a', 'b', 'c', 'e']);
    expect(plansDe(l, 'formation', null)).toHaveLength(4);
  });
});

describe('dates et décalage', () => {
  it('décale de n jours en traversant les mois', () => {
    expect(decalerDate('2026-02-27', 3)).toBe('2026-03-02');
    expect(decalerDate('2026-03-02', -3)).toBe('2026-02-27');
    expect(decalerDate('', 5)).toBe('');
  });
  it('décale la fin seulement si elle existe', () => {
    expect(decalerAction({ start: '2026-05-01', end: '' }, 7)).toEqual({ start: '2026-05-08', end: '' });
    expect(decalerAction({ start: '2026-05-01', end: '2026-05-03' }, 7)).toEqual({
      start: '2026-05-08',
      end: '2026-05-10',
    });
  });
});

describe('tâches récurrentes du calendrier', () => {
  const r = lireTacheRecurrente({
    id: 'R1',
    title: 'Revue',
    n: 3,
    u: 'm',
    last: '2026-03-15',
    history: [{ date: '2026-03-20' }],
  })!;
  it('prochaine échéance : dernière réalisation + période, à défaut début, à défaut aujourd’hui', () => {
    expect(recurrenceSuivante(r, AUJOURDHUI)).toBe('2026-06-15');
    expect(recurrenceSuivante({ last: '', start: '2026-05-05', n: 1, u: 'a' }, AUJOURDHUI)).toBe('2026-05-05');
    expect(recurrenceSuivante({ last: '', start: '', n: 1, u: 'a' }, AUJOURDHUI)).toBe(AUJOURDHUI);
  });
  it('occurrences d’une année civile', () => {
    expect(recurrenceOccurrences(r, 2026, AUJOURDHUI)).toEqual([
      '2026-03-15',
      '2026-06-15',
      '2026-09-15',
      '2026-12-15',
    ]);
    expect(recurrenceOccurrences(r, 2027, AUJOURDHUI)).toEqual([
      '2027-03-15',
      '2027-06-15',
      '2027-09-15',
      '2027-12-15',
    ]);
  });
  it('réalisée si une réalisation tombe dans une demi-période autour de l’échéance', () => {
    expect(occurrenceRealisee(r, '2026-03-15')).toBe(true);
    expect(occurrenceRealisee(r, '2026-06-15')).toBe(false);
  });
  it('ignore une entrée sans identifiant', () => {
    expect(lireTacheRecurrente({ title: 'x' })).toBeNull();
  });
});

describe('schémas des requêtes', () => {
  it('refuse un champ inconnu, un statut inconnu et une date mal formée', () => {
    expect(ActionPlanModification.safeParse({ inconnu: 1 }).success).toBe(false);
    expect(ActionPlanModification.safeParse({ status: 'Autre' }).success).toBe(false);
    expect(ActionPlanModification.safeParse({ start: '14/10/2026' }).success).toBe(false);
    expect(ActionPlanModification.safeParse({ start: '2026-10-14', status: 'Réalisé' }).success).toBe(true);
    expect(ActionPlanModification.safeParse({ start: '' }).success).toBe(true);
  });
  it('une création exige un type reconnu', () => {
    expect(ActionPlanCreation.safeParse({ type: 'formation', title: 'Accueil' }).success).toBe(true);
    expect(ActionPlanCreation.safeParse({ title: 'Accueil' }).success).toBe(false);
    expect(ActionPlanCreation.safeParse({ type: 'autre' }).success).toBe(false);
  });
});
