/* Fiches longues en parties : intitulés jamais génériques ni répétés. Le découpage lui-même (colonnes, hauteur, pied de
   fenêtre) dépend de la mise en page du navigateur : il est vérifié par la recette de bout en bout (tests/e2e/specs/…-fiches-parties.spec.ts). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nommerParties, PREMIERE_PARTIE, titreCourt, type RepereDePartie } from '../src/components/fiches-parties';

const repere = (page: number, titre: string, options: Partial<RepereDePartie> = {}): RepereDePartie => ({
  page,
  titre,
  explicite: false,
  enTete: false,
  ...options,
});

describe('intitulés des parties d’une fiche', () => {
  it('retire la parenthèse d’explication et borne la longueur', () => {
    expect(titreCourt('Identification (processus inspiré de l’ISO/IEC 27005)')).toBe('Identification');
    expect(titreCourt('  Filiation   EBIOS RM (facultatif) ')).toBe('Filiation EBIOS RM');
    expect(titreCourt('Un intitulé de section fictif beaucoup trop long pour un onglet')).toHaveLength(30);
  });

  it('nomme chaque partie par la section déclarée qui l’ouvre', () => {
    const reperes = [
      repere(1, 'Analyse', { explicite: true, enTete: true }),
      repere(1, 'Filiation EBIOS RM'),
      repere(2, 'Liens et preuves', { explicite: true, enTete: true }),
    ];
    expect(nommerParties(3, reperes)).toEqual([PREMIERE_PARTIE, 'Analyse', 'Liens et preuves']);
  });

  it('prolonge la section en cours au lieu d’un intitulé générique', () => {
    // La section « Analyse » occupe deux parties : la seconde n'a aucun titre en tête.
    const reperes = [repere(1, 'Analyse', { explicite: true, enTete: true }), repere(3, 'Liens', { explicite: true })];
    expect(nommerParties(4, reperes)).toEqual([PREMIERE_PARTIE, 'Analyse', 'Analyse (suite)', 'Liens']);
  });

  it('sans section déclarée, un titre en tête de partie la nomme ; un titre en milieu de partie non', () => {
    const reperes = [
      repere(0, 'Certificats'),
      repere(1, 'Contrôles à effectuer', { enTete: true }),
      repere(2, 'Historique'),
    ];
    // Partie 3 : elle commence par la fin des contrôles, le titre « Historique » n'arrive qu'ensuite.
    expect(nommerParties(3, reperes)).toEqual([
      PREMIERE_PARTIE,
      'Contrôles à effectuer',
      'Contrôles à effectuer (suite)',
    ]);
  });

  it('la première partie qui se prolonge donne « Informations (suite) », puis un rang', () => {
    expect(nommerParties(3, [])).toEqual([PREMIERE_PARTIE, 'Informations (suite)', 'Informations (suite 2)']);
  });

  it('deux sections de même nom restent distinctes', () => {
    const reperes = [repere(1, 'Contrôles', { enTete: true }), repere(2, 'Contrôles', { enTete: true })];
    const noms = nommerParties(3, reperes);
    expect(new Set(noms).size).toBe(3);
    expect(noms).toEqual([PREMIERE_PARTIE, 'Contrôles', 'Contrôles (suite)']);
  });

  it('aucun intitulé du type « Suite 2 » quel que soit le découpage', () => {
    for (let total = 2; total <= 6; total++) {
      for (const noms of [nommerParties(total, []), nommerParties(total, [repere(1, 'Analyse', { enTete: true })])]) {
        expect(noms).toHaveLength(total);
        expect(new Set(noms).size).toBe(total);
        expect(noms.some((n) => /^Suite\b/.test(n))).toBe(false);
      }
    }
  });
});

describe('feuille de style des fiches en parties', () => {
  const css = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/ui/src/neon-fiches-pages.css'),
    'utf8',
  );

  it('la hauteur vient de la mesure du contenu, la hauteur disponible n’étant que la valeur par défaut', () => {
    expect(css).toMatch(/\[data-fiche-paginee\] \{\s*block-size: var\(--fiche-hauteur, calc\(100dvh/);
  });

  it('une section déclarée ouvre une partie et les groupes de champs restent entiers', () => {
    expect(css).toMatch(/\[data-fiche-section\] \{\s*break-before: column;/);
    for (const groupeIndivisible of ['[data-fiche-entier]', '.mantine-InputWrapper-root', 'summary', 'tr,'])
      expect(css).toContain(groupeIndivisible);
  });
});
