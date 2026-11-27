/* Barre de recherche et de filtres des listes (refonte Verre, règle validée par le RSSI le 27/11/2026 ; raccourci repris de
   la refonte Neon, lot 8) : raccourci « / » vers la recherche seulement hors saisie, sans touche de modification ni
   fenêtre ouverte ; seuil de 8 éléments ; puces avec leur nombre, groupe « Filtres », puces inutiles masquées ; critères
   actifs de « Plus de filtres » en puces actives retirables ; « Tout effacer » dès qu'un critère est actif. Données
   fictives. */
import { MantineProvider } from '@mantine/core';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  BoiteOutils,
  doitOuvrirRecherche,
  toutEffacer,
  type CritereActif,
  type CriterePuces,
} from '../src/components/BarreOutils';

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

const rien = () => {};
const recherche = (value = '') => ({ label: 'Rechercher dans les fiches', value, onChange: rien });
const nature = (valeur: string | null = null): CriterePuces => ({
  cle: 'nature',
  libelle: 'Nature',
  valeur,
  options: [
    { value: 'Externe', label: 'Externes', compte: 9 },
    { value: 'Interne', label: 'Internes', compte: 5 },
    { value: 'Inconnue', label: 'À préciser', compte: 0 },
  ],
  onChange: rien,
});
const barre = (p: Partial<Parameters<typeof BoiteOutils>[0]>) =>
  rendu(createElement(BoiteOutils, { label: 'Outils du registre', ...p }));

describe('seuil de 8 éléments', () => {
  it('masque la recherche et les puces à 7 éléments, sans critère actif', () => {
    const html = barre({ total: 7, recherche: recherche(), puces: [nature()] });
    expect(html).not.toContain('aria-label="Rechercher dans les fiches"');
    expect(html).not.toContain('aria-label="Filtres"');
    expect(html).not.toContain('Externes');
  });
  it('montre la recherche et les puces à 8 éléments', () => {
    const html = barre({
      total: 8,
      recherche: recherche(),
      puces: [{ ...nature(), options: [{ value: 'Externe', label: 'Externes', compte: 3 }] }],
    });
    expect(html).toContain('aria-label="Rechercher dans les fiches"');
    expect(html).toContain('role="group" aria-label="Filtres"');
    expect(html).toContain('Externes');
  });
  it('montre la barre à 3 éléments quand une recherche ou un filtre est déjà actif', () => {
    expect(barre({ total: 3, recherche: recherche('santé') })).toContain('aria-label="Rechercher dans les fiches"');
    const filtre = barre({ total: 3, recherche: recherche(), puces: [nature('Externe')] });
    expect(filtre).toContain('aria-label="Rechercher dans les fiches"');
    expect(filtre).toContain('aria-pressed="true"');
  });
  it('garde toujours les outils qui ne sont pas des filtres (ajout, outils de la page)', () => {
    const html = barre({
      total: 2,
      recherche: recherche(),
      ajout: createElement('button', { type: 'button' }, 'Ajouter une fiche fictive'),
      children: createElement('button', { type: 'button' }, 'Outil fictif'),
    });
    expect(html).toContain('Ajouter une fiche fictive');
    expect(html).toContain('Outil fictif');
  });
});

describe('puces de filtre', () => {
  it('donne à chaque puce son nombre, la marque à bascule, et masque les puces inutiles', () => {
    const html = barre({ total: 14, recherche: recherche(), puces: [nature()] });
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*Externes.*>9</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*Internes.*>5</);
    expect(html).not.toContain('À préciser');
    expect(html).toContain('role="group" aria-label="Nature"');
    // Puce « Toutes » : enfoncée sans filtre, avec le total.
    expect(html).toMatch(
      /aria-pressed="true"[^>]*><span class="liste-puce__texte">Toutes<\/span><span class="liste-puce__nombre">14</,
    );
  });
  it('ne montre pas un critère dont la seule valeur couvre toute la liste', () => {
    const html = barre({
      total: 14,
      recherche: recherche(),
      puces: [{ ...nature(), options: [{ value: 'Externe', label: 'Externes', compte: 14 }] }],
    });
    expect(html).not.toContain('Externes');
    expect(html).not.toContain('aria-label="Filtres"');
  });
  it('passe dans « Plus de filtres » un critère de plus de huit valeurs utiles', () => {
    const options = Array.from({ length: 9 }, (_, i) => ({ value: `p${i}`, label: `Personne ${i}`, compte: 1 }));
    const html = barre({
      total: 14,
      recherche: recherche(),
      puces: [{ cle: 'resp', libelle: 'Responsable', valeur: 'p2', options, onChange: rien }],
    });
    expect(html).toContain('aria-label="Plus de filtres (1 actif)"');
    expect(html).not.toMatch(/aria-pressed="false"[^>]*>.*Personne 0/);
    // La valeur retenue reste visible en puce active, retirable.
    expect(html).toMatch(/aria-pressed="true" title="Retirer ce critère">.*Responsable : <strong>Personne 2<\/strong>/);
  });
  it('montre « N sur M » dans le champ quand un critère est actif', () => {
    expect(barre({ total: 14, affiches: 4, recherche: recherche('santé') })).toContain('4 sur 14');
    expect(barre({ total: 14, affiches: 14, recherche: recherche() })).not.toContain('sur 14');
  });
});

describe('« Tout effacer »', () => {
  it('n’apparaît que si un critère est actif', () => {
    expect(barre({ total: 14, recherche: recherche(), puces: [nature()] })).not.toContain('Tout effacer');
    expect(barre({ total: 14, recherche: recherche(), puces: [nature('Interne')] })).toContain('Tout effacer');
    expect(
      barre({
        total: 14,
        recherche: recherche(),
        criteres: [critere('etat', 'État', 'À faire')],
        filtres: { actifs: 1, contenu: null },
      }),
    ).toContain('Tout effacer');
  });
  it('vide la recherche, retire les puces actives et les critères de « Plus de filtres »', () => {
    const onChange = vi.fn(),
      puceActive = vi.fn(),
      puceInactive = vi.fn(),
      retirer = vi.fn(),
      reinitialiser = vi.fn();
    toutEffacer({
      recherche: { onChange },
      puces: [
        { valeur: 'Externe', onChange: puceActive },
        { valeur: null, onChange: puceInactive },
      ],
      criteres: [{ retirer }],
      filtres: { onReinitialiser: reinitialiser },
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
    expect(puceActive).toHaveBeenCalledExactlyOnceWith(null);
    expect(puceInactive).not.toHaveBeenCalled();
    expect(retirer).toHaveBeenCalledOnce();
    expect(reinitialiser).toHaveBeenCalledOnce();
  });
  it('vide un champ repris d’un formulaire par son événement habituel', () => {
    const vider = vi.fn();
    toutEffacer({}, vider);
    expect(vider).toHaveBeenCalledOnce();
  });
});

describe('plus d’entonnoir dans les en-têtes de colonnes', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? fichiers(p) : /\.tsx?$/.test(f) ? [p] : [];
    });
  it('aucun écran ne pose de filtre sur le titre d’une colonne ni n’utilise l’ancienne boîte d’outils', () => {
    const restes = fichiers(SRC).flatMap((f) => {
      const texte = readFileSync(f, 'utf8');
      return [/\bFiltreColonne(Multiple)?\b/, /\bIconeFiltre\b/, /\bPastillesCriteres\b/, /Filtrer par /, /barre-boite/]
        .filter((motif) => motif.test(texte))
        .map((motif) => `${path.relative(SRC, f)} : ${motif}`);
    });
    expect(restes).toEqual([]);
  });
});
