/* Filtres posés sur le titre des colonnes (ergonomie, lot 2, décisions du RSSI du 18/11/2026) : nom accessible
   « Filtrer par X » suivi des valeurs retenues, variante compacte réduite à l'entonnoir (catégorie des documents, à côté
   du titre triable), filtre à choix multiple à cases à cocher (étiquettes des documents) avec « Tous », recherche
   au-delà de huit valeurs et valeurs retenues toujours décochables. Données fictives. */
import { MantineProvider } from '@mantine/core';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  filtrerOptions,
  FiltreColonne,
  FiltreColonneMultiple,
  ListeFiltreMultiple,
  nomFiltreColonne,
  optionsAvecValeurs,
  SEUIL_RECHERCHE_FILTRE,
} from '../src/components/BarreOutils';

const rendu = (el: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, el));
const rien = () => {};
const options = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: `valeur-${i + 1}`, label: `Valeur fictive ${i + 1}` }));
const cases = (html: string) => html.match(/type="checkbox"/g)?.length ?? 0;

describe('nom accessible d’un filtre de colonne', () => {
  it('nomme la colonne seule sans filtre, puis les valeurs retenues', () => {
    expect(nomFiltreColonne('Étiquettes', [])).toBe('Filtrer par Étiquettes');
    expect(nomFiltreColonne('Catégorie', ['Politiques'])).toBe('Filtrer par Catégorie (filtre : Politiques)');
    expect(nomFiltreColonne('Étiquettes', ['Alpha', 'Bêta'])).toBe('Filtrer par Étiquettes (filtre : Alpha, Bêta)');
  });
});

describe('recherche dans les valeurs', () => {
  const valeurs = [
    { value: 'a', label: 'Sécurité physique' },
    { value: 'b', label: 'Continuité' },
    { value: 'c', label: 'Réseau' },
  ];
  it('ignore la casse et les accents ; un texte vide garde tout', () => {
    expect(filtrerOptions(valeurs, 'SECURITE').map((o) => o.value)).toEqual(['a']);
    expect(filtrerOptions(valeurs, ' continuite ').map((o) => o.value)).toEqual(['b']);
    expect(filtrerOptions(valeurs, 'é').map((o) => o.value)).toEqual(['a', 'b', 'c']);
    expect(filtrerOptions(valeurs, '   ')).toEqual(valeurs);
    expect(filtrerOptions(valeurs, 'introuvable')).toEqual([]);
  });
  it('garde visibles les valeurs retenues absentes des options', () => {
    expect(optionsAvecValeurs(valeurs, ['b', 'z'])).toEqual([...valeurs, { value: 'z', label: 'z' }]);
    expect(optionsAvecValeurs(valeurs, [])).toEqual(valeurs);
  });
});

describe('filtre de colonne à choix unique', () => {
  const categories = [{ value: 'Politiques', label: 'Politiques' }];
  it('garde le mot du titre dans sa forme habituelle', () => {
    const html = rendu(
      createElement(FiltreColonne, { libelle: 'Famille', valeur: null, options: categories, onChange: rien }),
    );
    expect(html).toContain('class="mantine-focus-auto filtre-colonne');
    expect(html).toContain('aria-label="Filtrer par Famille"');
    expect(html).toContain('>Famille<');
    expect(html).not.toContain('title=');
  });
  it('se réduit à l’entonnoir en variante compacte, avec le même nom accessible', () => {
    const html = rendu(
      createElement(FiltreColonne, {
        compact: true,
        libelle: 'Catégorie',
        valeur: null,
        options: categories,
        onChange: rien,
      }),
    );
    expect(html).toContain('filtre-colonne filtre-colonne--icone');
    expect(html).toContain('aria-label="Filtrer par Catégorie"');
    expect(html).toContain('title="Filtrer par Catégorie"');
    expect(html).not.toContain('>Catégorie<');
    expect(html).not.toContain('data-actif');
    expect(html).toContain('class="barre-filtre"');
  });
  it('marque la variante compacte quand un filtre est actif', () => {
    const html = rendu(
      createElement(FiltreColonne, {
        compact: true,
        libelle: 'Catégorie',
        valeur: 'Politiques',
        options: categories,
        onChange: rien,
      }),
    );
    expect(html).toContain('data-actif="true"');
    expect(html).toContain('aria-label="Filtrer par Catégorie (filtre : Politiques)"');
    expect(html).not.toContain('filtre-colonne__valeur');
  });
});

describe('filtre de colonne à choix multiple', () => {
  it('reprend le bouton du filtre de colonne, sans marque quand rien n’est coché', () => {
    const html = rendu(
      createElement(FiltreColonneMultiple, { libelle: 'Étiquettes', valeurs: [], options: options(3), onChange: rien }),
    );
    expect(html).toContain('filtre-colonne');
    expect(html).toContain('aria-label="Filtrer par Étiquettes"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-actif');
    // Liste fermée : aucune case rendue.
    expect(cases(html)).toBe(0);
  });
  it('marque la colonne et nomme toutes les valeurs retenues', () => {
    const html = rendu(
      createElement(FiltreColonneMultiple, {
        libelle: 'Étiquettes',
        valeurs: ['valeur-1', 'hors-liste'],
        options: options(3),
        onChange: rien,
      }),
    );
    expect(html).toContain('data-actif="true"');
    expect(html).toContain('aria-label="Filtrer par Étiquettes (filtre : Valeur fictive 1, hors-liste)"');
    expect(html).toContain('filtre-colonne__resume');
  });
  it('liste une case par valeur, cochée si retenue, avec « Tous » inactif sans filtre', () => {
    const vide = rendu(
      createElement(ListeFiltreMultiple, { libelle: 'Étiquettes', valeurs: [], options: options(3), onChange: rien }),
    );
    expect(cases(vide)).toBe(3);
    expect(vide).not.toContain('checked=""');
    expect(vide).toMatch(/<button[^>]*disabled=""[^>]*>.*Tous/);
    expect(vide).toContain('role="group" aria-label="Étiquettes"');

    const coche = rendu(
      createElement(ListeFiltreMultiple, {
        libelle: 'Étiquettes',
        valeurs: ['valeur-2'],
        options: options(3),
        onChange: rien,
        description: 'Toutes les étiquettes cochées sont exigées.',
      }),
    );
    expect(coche.match(/checked=""/g)?.length).toBe(1);
    expect(coche).not.toMatch(/<button[^>]*disabled=""[^>]*>.*Tous/);
    expect(coche).toContain('Toutes les étiquettes cochées sont exigées.');
    expect(coche).toMatch(/role="group" aria-label="Étiquettes" aria-describedby="[^"]+"/);
  });
  it('propose un champ de recherche au-delà de huit valeurs seulement', () => {
    const court = rendu(
      createElement(ListeFiltreMultiple, {
        libelle: 'Étiquettes',
        valeurs: [],
        options: options(SEUIL_RECHERCHE_FILTRE),
        onChange: rien,
      }),
    );
    expect(court).not.toContain('Chercher dans « Étiquettes »');
    const long = rendu(
      createElement(ListeFiltreMultiple, {
        libelle: 'Étiquettes',
        valeurs: [],
        options: options(SEUIL_RECHERCHE_FILTRE + 1),
        onChange: rien,
      }),
    );
    expect(long).toContain('aria-label="Chercher dans « Étiquettes »"');
    expect(cases(long)).toBe(SEUIL_RECHERCHE_FILTRE + 1);
  });
});
