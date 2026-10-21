import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, COUPLES_CONTRASTE, RAYONS, STYLE_CLAIR } from '../src/tokens.ts';

describe('charte : contrastes WCAG AA', () => {
  it.each(COUPLES_CONTRASTE)('$nom ≥ $seuil', ({ texte, fond, seuil }) => {
    expect(contrast(texte, fond)).toBeGreaterThanOrEqual(seuil);
  });

  it('calcul de contraste conforme aux valeurs de référence', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('les fonds du style Clair testés sont ceux de la feuille de styles', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const bloc = css.slice(css.indexOf("html[data-style='clair']"));
    expect(bloc).toContain(`--suivi-fond-page: ${STYLE_CLAIR.page};`);
    expect(bloc).toContain(`--suivi-surface-douce: ${STYLE_CLAIR.surfaceDouce};`);
  });

  it('rayons de 6 à 12 px', () => {
    for (const r of Object.values(RAYONS)) {
      const px = parseInt(r, 10);
      expect(px).toBeGreaterThanOrEqual(6);
      expect(px).toBeLessThanOrEqual(12);
    }
  });
});
