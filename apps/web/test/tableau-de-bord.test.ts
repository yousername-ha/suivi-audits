import { describe, expect, it } from 'vitest';
import { joursAvant, tauxGlobal } from '../src/components/TableauDeBord';

describe('tableau de bord de l’accueil (ADR 0069)', () => {
  it('jours avant l’audit : comptés depuis le jour de génération de la synthèse, négatifs une fois passés', () => {
    expect(joursAvant('2026-12-12', '2026-10-26T09:42:00.000Z')).toBe(47);
    expect(joursAvant('2026-10-26', '2026-10-26T21:00:00')).toBe(0);
    expect(joursAvant('2026-10-20', '2026-10-26T09:42:00.000Z')).toBe(-6);
    expect(joursAvant('', '2026-10-26T09:42:00.000Z')).toBeNull();
  });

  it('taux global : moyenne simple des taux par référentiel, chaque référentiel comptant autant', () => {
    const ligne = (total: number, applicables: number) => ({
      ref: 'R',
      libelle: 'R',
      exigences: applicables,
      applicables,
      total,
      partiel: 0,
      insuffisant: 0,
      nonRenseigne: applicables - total,
    });
    // 30/40 = 75 % et 10/10 = 100 % : moyenne 87,5 %, et non 40/50 = 80 % (somme des exigences).
    expect(tauxGlobal([ligne(30, 40), ligne(10, 10), ligne(0, 0)])).toEqual({ pourcent: 87.5, referentiels: 2 });
    expect(tauxGlobal([ligne(0, 0)])).toBeNull();
    expect(tauxGlobal(null)).toBeNull();
  });
});
