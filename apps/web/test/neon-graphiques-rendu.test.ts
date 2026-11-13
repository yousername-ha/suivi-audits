import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { NeonAnneau, NeonRadar } from '@suivi/ui';
describe('rendu accessible des graphiques Neon', () => {
  it('affiche un état sans donnée plutôt que 0 % quand le dénominateur est nul', () => {
    const html = renderToStaticMarkup(createElement(NeonAnneau, { titre: 'Objectifs', valeur: 0, total: 0 }));
    expect(html).toContain('aucune donnée');
    expect(html).not.toContain('NaN');
  });
  it('ne dessine pas un radar incomplet comme si une valeur inconnue valait zéro', () => {
    const html = renderToStaticMarkup(
      createElement(NeonRadar, {
        titre: 'Référentiels',
        axes: [
          { libelle: 'A', valeur: 50 },
          { libelle: 'B', valeur: null },
          { libelle: 'C', valeur: 0 },
        ],
      }),
    );
    expect(html).toContain('non renseigné');
    expect(html).not.toContain('neon-radar-donnee');
  });
});
