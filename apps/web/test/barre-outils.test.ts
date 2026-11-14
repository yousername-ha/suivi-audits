/* Barre d'outils discrète des registres (refonte Neon, lot 8, ADR 0093) : raccourci « / » vers la recherche seulement hors
   saisie, sans touche de modification ni fenêtre ouverte ; pastilles des critères actifs nommées une à une, commande
   « Effacer les critères » à partir de deux critères, rien quand aucun critère n'est actif. Données fictives. */
import { MantineProvider } from '@mantine/core';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { doitOuvrirRecherche, PastillesCriteres, type CritereActif } from '../src/components/BarreOutils';

const touche = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  defaultPrevented: false,
  ...extra,
});
const rendu = (el: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, el));
const critere = (cle: string, libelle: string, valeur: string): CritereActif => ({
  cle,
  libelle,
  valeur,
  retirer: () => {},
});

describe('raccourci de recherche', () => {
  it('ouvre la recherche avec « / » hors saisie', () => {
    expect(doitOuvrirRecherche(touche('/'), { tagName: 'DIV' }, false)).toBe(true);
    expect(doitOuvrirRecherche(touche('/'), null, false)).toBe(true);
  });
  it('laisse « / » aux champs de saisie et au contenu modifiable', () => {
    for (const tagName of ['INPUT', 'textarea', 'SELECT'])
      expect(doitOuvrirRecherche(touche('/'), { tagName }, false)).toBe(false);
    expect(doitOuvrirRecherche(touche('/'), { tagName: 'DIV', isContentEditable: true }, false)).toBe(false);
  });
  it('ignore les autres touches, les modificateurs, une touche déjà traitée et une fenêtre ouverte', () => {
    expect(doitOuvrirRecherche(touche('a'), { tagName: 'DIV' }, false)).toBe(false);
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true }])
      expect(doitOuvrirRecherche(touche('/', extra), { tagName: 'DIV' }, false)).toBe(false);
    expect(doitOuvrirRecherche(touche('/'), { tagName: 'DIV' }, true)).toBe(false);
  });
});

describe('pastilles des critères actifs', () => {
  it('ne rend rien sans critère actif', () => {
    const html = rendu(createElement(PastillesCriteres, { criteres: [], onToutEffacer: () => {} }));
    expect(html).not.toContain('Critères actifs');
    expect(html).not.toContain('Retirer le critère');
  });
  it('nomme chaque critère et sa commande de retrait, sans « Effacer les critères » pour un seul', () => {
    const html = rendu(
      createElement(PastillesCriteres, {
        criteres: [critere('etat', 'État', 'À faire')],
        onToutEffacer: () => {},
      }),
    );
    expect(html).toContain('aria-label="Critères actifs"');
    expect(html).toContain('aria-label="Retirer le critère « État : À faire »"');
    expect(html).not.toContain('Effacer les critères');
  });
  it('propose « Effacer les critères » à partir de deux critères', () => {
    const html = rendu(
      createElement(PastillesCriteres, {
        criteres: [critere('etat', 'État', 'À faire'), critere('ech', 'Échéance', 'Dépassée')],
        onToutEffacer: () => {},
      }),
    );
    expect(html).toContain('Retirer le critère « Échéance : Dépassée »');
    expect(html).toContain('Effacer les critères');
  });
});
