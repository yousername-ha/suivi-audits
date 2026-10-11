import { describe, expect, it } from 'vitest';
import { contrast, COUPLES_CONTRASTE, RAYONS } from '../src/tokens.ts';

describe('charte : contrastes WCAG AA', () => {
  it.each(COUPLES_CONTRASTE)('$nom ≥ $seuil', ({ texte, fond, seuil }) => {
    expect(contrast(texte, fond)).toBeGreaterThanOrEqual(seuil);
  });

  it('calcul de contraste conforme aux valeurs de référence', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('rayons de 6 à 12 px', () => {
    for (const r of Object.values(RAYONS)) {
      const px = parseInt(r, 10);
      expect(px).toBeGreaterThanOrEqual(6);
      expect(px).toBeLessThanOrEqual(12);
    }
  });
});
