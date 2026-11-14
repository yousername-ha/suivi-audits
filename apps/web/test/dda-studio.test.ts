/* DdA « Studio » (refonte Neon, lot 4, ADR 0093) : teintes, filtres comptés et géométrie des dalles, calculés sur les
   statistiques partagées existantes ; libellés et ordre des indicateurs lus par les parcours de bout en bout. */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StatsDda } from '@suivi/shared';
import { DdaSynthese } from '../src/dda/DdaSynthese';
import {
  arcsAnneau,
  filtresDda,
  largeurBarre,
  libelleApplicable,
  niveauxSynthese,
  tonApplicable,
  tonNiveau,
} from '../src/dda/dda-studio';

const st = (p: Partial<StatsDda> = {}): StatsDda => ({
  total: 10,
  app: 8,
  na: 2,
  c: { Total: 4, Partiel: 2, Insuffisant: 1, '': 1 },
  pct: 50,
  ...p,
});

describe('teintes de la DdA', () => {
  it('colore les niveaux en vert, orange, rouge et laisse neutre un niveau absent ou inconnu', () => {
    expect(['Total', 'Partiel', 'Insuffisant', '', 'Autre'].map(tonNiveau)).toEqual([
      'total',
      'partiel',
      'insuffisant',
      'inconnu',
      'inconnu',
    ]);
  });
  it('colore l’applicabilité : Oui vert, Non rouge, à déterminer neutre', () => {
    expect(['oui', 'non', ''].map(tonApplicable)).toEqual(['total', 'insuffisant', 'inconnu']);
    expect(libelleApplicable('', false)).toBe('À déterminer');
    expect(libelleApplicable('non', true)).toBe('Obligatoire');
  });
});

describe('filtres du registre', () => {
  it('garde l’ordre et les libellés existants, avec le nombre de mesures de chaque filtre', () => {
    expect(filtresDda(st(), 3)).toEqual([
      { value: 'all', label: 'Toutes', nombre: 10 },
      { value: 'Total', label: 'Total', nombre: 4 },
      { value: 'Partiel', label: 'Partiel', nombre: 2 },
      { value: 'Insuffisant', label: 'Insuffisant', nombre: 1 },
      { value: 'none', label: 'Non renseignées', nombre: 1 },
      { value: 'na', label: 'Exclues', nombre: 2 },
      { value: 'inc', label: 'Total avec écart ouvert', nombre: 3 },
    ]);
  });
});

describe('géométrie des dalles', () => {
  it('découpe l’anneau en parts consécutives des mesures applicables', () => {
    const arcs = arcsAnneau(niveauxSynthese(st()), 8);
    expect(arcs.map((a) => a.part)).toEqual([50, 25, 12.5, 12.5]);
    expect(arcs.map((a) => a.decalage)).toEqual([-0, -50, -75, -87.5]);
  });
  it('ne dessine aucune part sans mesure applicable (pas d’anneau plein trompeur)', () => {
    expect(arcsAnneau(niveauxSynthese(st({ app: 0 })), 0).every((a) => a.part === 0)).toBe(true);
  });
  it('borne la largeur des barres entre 0 et 100', () => {
    expect(largeurBarre(2, 4)).toBe(50);
    expect(largeurBarre(3, 0)).toBe(0);
    expect(largeurBarre(9, 4)).toBe(100);
  });
});

describe('dalles de synthèse', () => {
  const html = renderToStaticMarkup(createElement(DdaSynthese, { st: st(), reference: 'Annexe A', incoherentes: 3 }));
  it('affiche la valeur juste avant son libellé, comme les indicateurs existants', () => {
    expect(html).toContain('<b>50 %</b><span>en mise en œuvre totale</span>');
    expect(html).toContain('<b>2</b><span>exclues</span>');
  });
  it('garde la répartition en image accessible et l’incohérence « Total » avec écart ouvert', () => {
    expect(html).toMatch(/role="img" aria-label="Répartition des mesures applicables par niveau/);
    expect(html).toContain('« Total » avec écart ouvert');
    // Le libellé du filtre « Total avec écart ouvert » reste unique dans la page.
    expect(html).not.toContain('>Total avec écart ouvert<');
  });
  it('n’écrit aucun style en ligne', () => {
    expect(html).not.toContain('style=');
  });
});
