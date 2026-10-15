/* Revues des accès : états et échéances de l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  RevueAccesModification,
  identifiantRevue,
  lireRevueAcces,
  revueEtat,
  revueSuivante,
  revuesSynthese,
} from '../src/index.js';

const AUJOURDHUI = '2026-10-14';
const revue = (month: string, freq = 12) => lireRevueAcces({ id: 'CONTROL-1', month, freq })!;

describe('prochaine revue et état', () => {
  it('mois de la dernière revue + périodicité', () => {
    expect(revueSuivante(revue('2025-11'))).toMatchObject({ annee: 2026, mois: 10, libelle: 'novembre 2026' });
    expect(revueSuivante(revue('2025-11', 6))).toMatchObject({ annee: 2026, mois: 4, libelle: 'mai 2026' });
    expect(revueSuivante(revue(''))).toBeNull();
  });
  it('jamais réalisée sans mois, en retard avant le mois courant, à planifier sous deux mois, sinon à jour', () => {
    expect(revueEtat(revue(''), AUJOURDHUI)).toEqual(['Jamais réalisée', 'bad']);
    expect(revueEtat(revue('2025-09'), AUJOURDHUI)).toEqual(['En retard', 'bad']); // échéance sept. 2026
    expect(revueEtat(revue('2025-10'), AUJOURDHUI)).toEqual(['À planifier', 'mid']); // échéance oct. 2026 : mois courant
    expect(revueEtat(revue('2025-12'), AUJOURDHUI)).toEqual(['À planifier', 'mid']); // déc. 2026 = courant + 2
    expect(revueEtat(revue('2026-01'), AUJOURDHUI)).toEqual(['À jour', 'ok']); // janv. 2027
  });
  it('passe l’année et accepte une périodicité courte', () => {
    expect(revueEtat(revue('2026-08', 1), AUJOURDHUI)).toEqual(['En retard', 'bad']);
    expect(revueEtat(revue('2026-09', 1), AUJOURDHUI)).toEqual(['À planifier', 'mid']);
  });
  it('synthèse', () => {
    const l = [revue(''), revue('2025-09'), revue('2026-01'), revue('2025-12')];
    expect(revuesSynthese(l, AUJOURDHUI)).toEqual({ total: 4, aJour: 1, jamais: 1, enRetard: 1, aPlanifier: 1 });
  });
});

describe('lecture et identifiants', () => {
  it('normalise la périodicité (12 par défaut) et le mois', () => {
    expect(lireRevueAcces({ id: 'C', freq: 'x', month: '2026-13x' })).toMatchObject({ freq: 12, month: '' });
    expect(lireRevueAcces({ app: 'sans identifiant' })).toBeNull();
  });
  it('numéro libre supérieur au plus grand existant', () => {
    expect(identifiantRevue([])).toBe('CONTROL-1');
    expect(identifiantRevue(['CONTROL-1', 'CONTROL-4'])).toBe('CONTROL-5');
    expect(identifiantRevue(['CONTROL-1', 'autre', 'x'])).toBe('CONTROL-4');
  });
});

describe('modification', () => {
  it('refuse un mois mal formé, un champ inconnu et une périodicité hors limites', () => {
    expect(RevueAccesModification.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(RevueAccesModification.safeParse({ month: '10/2026' }).success).toBe(false);
    expect(RevueAccesModification.safeParse({ inconnu: 1 }).success).toBe(false);
    expect(RevueAccesModification.safeParse({ freq: 0 }).success).toBe(false);
    expect(RevueAccesModification.safeParse({ month: '2026-10', freq: 6, app: 'Application fictive' }).success).toBe(
      true,
    );
    expect(RevueAccesModification.safeParse({ month: '' }).success).toBe(true);
  });
});
