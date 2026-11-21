/* Tâches d'une action (ADR 0111) : schéma strict et borné, intitulé nettoyé, échéance AAAA-MM-JJ, calcul d'avancement.
   Données fictives. */
import { describe, expect, it } from 'vitest';
import { avancementTaches, TacheAction, TACHES_ACTION_MAX, TaskData } from '../src/index.js';

const ID = '7f0c3c8e-2a3d-4b1e-9c55-1d2a3b4c5d6e';
const tache = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  intitule: 'Tâche fictive',
  faite: false,
  echeance: null,
  ...extra,
});
const action = (taches?: unknown) => ({
  description: '',
  status: 'todo',
  ownerId: null,
  startAt: null,
  dueAt: null,
  priority: 'normal',
  category: 'action',
  justification: '',
  reminderDays: 7,
  dependencies: [],
  ...(taches === undefined ? {} : { taches }),
});
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

describe('schéma des tâches d’une action', () => {
  it('nettoie l’intitulé : caractères de contrôle et espaces superflus retirés', () => {
    expect(TacheAction.parse(tache({ intitule: '  Inventorier\tles   comptes\n ' })).intitule).toBe(
      'Inventorier les comptes',
    );
  });
  it('refuse un intitulé vide ou trop long, une échéance invalide et tout champ inconnu', () => {
    for (const t of [
      tache({ intitule: ' \n\t ' }),
      tache({ intitule: 'x'.repeat(201) }),
      tache({ echeance: '2026-02-29' }),
      tache({ echeance: '2026-12-1' }),
      tache({ echeance: '2026-12-01T00:00:00Z' }),
      tache({ id: 'tache-1' }),
      tache({ faite: 1 }),
      tache({ note: 'champ inconnu' }),
      tache({ responsable: { type: 'equipe', id: ID } }),
    ])
      expect(TacheAction.safeParse(t).success, JSON.stringify(t)).toBe(false);
    expect(TacheAction.safeParse(tache({ intitule: 'x'.repeat(200), echeance: '2028-02-29' })).success).toBe(true);
    expect(
      TacheAction.safeParse(tache({ responsable: { type: 'groupe', id: ID } })).success &&
        TacheAction.safeParse(tache({ responsable: null })).success,
    ).toBe(true);
  });
  it('dans une action : champ facultatif, au plus 50 tâches, identifiants uniques', () => {
    expect(TaskData.safeParse(action()).success).toBe(true);
    expect(TaskData.safeParse(action([])).success).toBe(true);
    const n = (k: number) => Array.from({ length: k }, (_, i) => tache({ id: uuid(i + 1), intitule: `Tâche ${i}` }));
    expect(TaskData.safeParse(action(n(TACHES_ACTION_MAX))).success).toBe(true);
    expect(TaskData.safeParse(action(n(TACHES_ACTION_MAX + 1))).success).toBe(false);
    expect(TaskData.safeParse(action([tache(), tache()])).success).toBe(false);
    expect(TaskData.safeParse(action({ intitule: 'pas un tableau' })).success).toBe(false);
  });
});

describe('avancement des tâches', () => {
  it('compte les tâches faites et arrondit le pourcentage ; aucune tâche : pas d’avancement', () => {
    expect(avancementTaches(undefined)).toBeNull();
    expect(avancementTaches([])).toBeNull();
    expect(avancementTaches([{ faite: true }, { faite: false }, { faite: false }])).toEqual({
      faites: 1,
      total: 3,
      pourcentage: 33,
    });
    expect(avancementTaches([{ faite: true }, { faite: true }])).toEqual({ faites: 2, total: 2, pourcentage: 100 });
    expect(avancementTaches([{ faite: false }])).toEqual({ faites: 0, total: 1, pourcentage: 0 });
  });
});
