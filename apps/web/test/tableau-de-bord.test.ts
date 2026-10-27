import { describe, expect, it } from 'vitest';
import { joursAvant } from '../src/components/TableauDeBord';

describe('tableau de bord de l’accueil (ADR 0066)', () => {
  it('jours avant l’audit : comptés depuis le jour de génération de la synthèse, négatifs une fois passés', () => {
    expect(joursAvant('2026-12-12', '2026-10-26T09:42:00.000Z')).toBe(47);
    expect(joursAvant('2026-10-26', '2026-10-26T21:00:00')).toBe(0);
    expect(joursAvant('2026-10-20', '2026-10-26T09:42:00.000Z')).toBe(-6);
    expect(joursAvant('', '2026-10-26T09:42:00.000Z')).toBeNull();
  });
});
