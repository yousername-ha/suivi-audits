/* Filtre à choix multiple à cases à cocher (étiquettes des documents, décision du RSSI du 18/11/2026) avec « Tous »,
   recherche au-delà de huit valeurs et valeurs retenues toujours décochables. Depuis la refonte Verre (27/11/2026), il est
   rangé dans « Plus de filtres » : les entonnoirs posés sur le titre des colonnes sont retirés. Données fictives. */
import { MantineProvider } from '@mantine/core';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  filtrerOptions,
  ListeFiltreMultiple,
  optionsAvecValeurs,
  SEUIL_RECHERCHE_FILTRE,
} from '../src/components/BarreOutils';

const rendu = (el: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, el));
const rien = () => {};
const options = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: `valeur-${i + 1}`, label: `Valeur fictive ${i + 1}` }));
const cases = (html: string) => html.match(/type="checkbox"/g)?.length ?? 0;

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

describe('filtre à choix multiple', () => {
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
