/* Présentation du Contexte (refonte Neon, lot 3, ADR 0093) : une fiche reprise de l'ancien outil sans date de mise à jour
   arrive datée du 1er janvier 1970 ; elle s'affiche « Non renseignée ». */
import { describe, expect, it } from 'vitest';
import { dateConnue } from '../src/pilotage/categories-contexte';

describe('date de mise à jour connue', () => {
  it('écarte l’absence, la date nulle de l’API et une valeur illisible', () => {
    expect(dateConnue(undefined)).toBeNull();
    expect(dateConnue(null)).toBeNull();
    expect(dateConnue('')).toBeNull();
    expect(dateConnue(new Date(0).toISOString())).toBeNull();
    expect(dateConnue('pas une date')).toBeNull();
  });
  it('garde une vraie date', () => {
    expect(dateConnue('2026-11-14T10:00:00.000Z')).toBe('2026-11-14T10:00:00.000Z');
  });
});
