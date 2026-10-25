/* Signalement de l'écart avec la matrice courante dans le registre (décision 6) : rendu serveur, données fictives. */
import { MantineProvider } from '@mantine/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EcartMatrice } from '@suivi/shared';
import { EcartMatriceNote } from '../src/grc/RegistreRisques';

const rendu = (e: EcartMatrice) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(EcartMatriceNote, { ecart: e })));
const base = {
  versionEnregistree: 1,
  versionCourante: 3,
  enregistre: { brut: 'Élevé', residuel: 'Faible' },
};

describe('écart avec la matrice courante', () => {
  it('écrit les deux niveaux et rappelle que le niveau enregistré fait foi', () => {
    const html = rendu({ etat: 'ecart', ...base, courant: { brut: 'Élevé', residuel: 'Moyen' } });
    expect(html).toContain('Écart avec la matrice courante');
    expect(html).toContain('Enregistré (méthode v1) : brut Élevé, résiduel Faible');
    expect(html).toContain('Avec la méthode v3 : brut Élevé, résiduel Moyen');
    expect(html).toContain('Le niveau enregistré fait foi');
  });
  it('dit quand les cotations ne sont plus comparables, sans inventer de niveau', () => {
    const html = rendu({ etat: 'non_comparable', ...base, courant: null });
    expect(html).toContain('Matrice courante non comparable');
    expect(html).toContain('n’existent plus dans la méthode v3');
    expect(html).not.toContain('Avec la méthode');
  });
});
