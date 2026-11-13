/* Matrice des risques (§ « cases pleines ») : rendu serveur, sans navigateur. Données fictives. */
import { MantineProvider } from '@mantine/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RiskMethod } from '@suivi/shared';
import { MatriceRisques } from '../src/grc/MatriceRisques';

const niveaux = [
  { id: 'faible', label: 'Faible', color: '#4dbb69', acceptability: 'acceptable' },
  { id: 'modere', label: 'Modéré', color: '#ffdf45', acceptability: 'acceptable' },
  { id: 'eleve', label: 'Élevé', color: '#ff8335', acceptability: 'conditional' },
  { id: 'critique', label: 'Critique', color: '#e5192f', acceptability: 'unacceptable' },
] as const;
const g = [
  { id: 'g1', label: 'Mineure', value: 1 },
  { id: 'g2', label: 'Majeure', value: 2 },
];
const p = [
  { id: 'p1', label: 'Rare', value: 1 },
  { id: 'p2', label: 'Fréquent', value: 2 },
];
const methode = {
  name: 'Méthode fictive',
  dimensions: [{ id: 'gravite', label: 'Gravité', levels: g }],
  likelihood: p,
  levels: niveaux,
  calculation: {
    kind: 'matrix',
    dimension: 'gravite',
    cells: [
      { impact: 'g1', likelihood: 'p1', level: 'faible', score: null },
      { impact: 'g1', likelihood: 'p2', level: 'modere', score: null },
      { impact: 'g2', likelihood: 'p1', level: 'eleve', score: null },
      { impact: 'g2', likelihood: 'p2', level: 'critique', score: null },
    ],
  },
} as unknown as RiskMethod;
const risque = (id: string, code: string, gravite: string, proba: string) =>
  ({
    id,
    name: 'Risque ' + code,
    data: { code },
    assessment: {
      method_version_id: 'pub-1',
      ratings: { residual: { dimensions: { gravite }, likelihood: proba }, gross: { dimensions: {}, likelihood: '' } },
      result: {
        residual: { label: 'Résultat', color: '#000000', level: 'x', acceptability: 'acceptable', score: null },
      },
    },
  }) as never;
const rendu = (items: unknown[]) =>
  renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(MatriceRisques, {
        methode,
        publicationId: 'pub-1',
        items: items as never[],
        basis: 'residual',
        onOpen: () => {},
      }),
    ),
  );

describe('matrice des risques', () => {
  const html = rendu([
    risque('1', 'RISK-000001', 'g2', 'p2'),
    risque('2', 'RISK-000002', 'g2', 'p2'),
    risque('3', 'RISK-000003', 'g1', 'p1'),
  ]);
  it('colore chaque case de la couleur exacte de son niveau, sans voile', () => {
    for (const n of niveaux) expect(html).toContain(`fill="${n.color}"`);
    expect(html).not.toMatch(/opacity/);
  });
  it('place la gravité décroissante de haut en bas et la probabilité croissante de gauche à droite', () => {
    expect(html.indexOf('Majeure')).toBeLessThan(html.indexOf('Mineure'));
    expect(html.indexOf('Rare')).toBeLessThan(html.indexOf('Fréquent'));
  });
  it('indique niveau, nombre de risques et références, et nomme chaque case pour les lecteurs d’écran', () => {
    expect(html).toContain('Gravité Majeure, probabilité Fréquent, niveau Critique, 2 risque(s)');
    expect(html).toContain('Gravité Majeure, probabilité Rare, niveau Élevé, 0 risque(s)');
    expect(html).toContain('RISK-000001');
    expect(html).toContain('RISK-000003');
    expect(html).toContain('Risques de la matrice · 3');
    expect(html).toContain('aria-pressed="false"');
  });
  it('affiche un tiret et « Aucun risque » sans risque apprécié, et ignore une méthode sans matrice', () => {
    const vide = rendu([]);
    expect(vide).toContain('Risques de la matrice · 0');
    expect(vide).toContain('Aucun risque dans cette cellule.');
    const jugement = renderToStaticMarkup(
      createElement(
        MantineProvider,
        null,
        createElement(MatriceRisques, {
          methode: { ...methode, calculation: { kind: 'judgement' } } as never,
          publicationId: 'pub-1',
          items: [],
          basis: 'residual',
          onOpen: () => {},
        }),
      ),
    );
    expect(jugement).not.toContain('matrice-risques');
  });
  it('choisit un texte lisible (AA) sur chacune des couleurs de niveau', () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const n of niveaux) {
      const clair = html.match(
        new RegExp(`matrice-cellule (matrice-texte-(?:clair|fonce))">\\s*<svg[^>]*><rect[^>]*fill="${n.color}"`),
      );
      expect(clair, n.label).toBeTruthy();
      const texte = clair![1] === 'matrice-texte-clair' ? '#ffffff' : '#173f34';
      expect(ratio(texte, n.color), `${n.label} ${texte}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
