/* Fenêtre d'un indicateur en style « Verre » (dessin validé par le RSSI le 27/11/2026) : série de la période, variation
   entre les deux dernières mesures, alerte de saisie comparée à la cible enregistrée, dernières mesures, lien vers les
   données d'un indicateur calculé et géométrie du graphique. Indicateurs fictifs, sans réseau ni base. */
import { MantineProvider } from '@mantine/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphiqueSerie } from '../src/pilotage/FicheIndicateurVerre';
import {
  alerteSaisie,
  dernieresMesures,
  geometrieSerie,
  libelleCible,
  libelleSens,
  lienSource,
  serieIndicateur,
  tendanceMesures,
} from '../src/pilotage/indicateur-verre';

const mesures = (...l: [string, unknown, string?][]) =>
  l.map(([date, v, hist]) => ({ date, v, note: '', hist: hist ?? '' }));
const delai = {
  id: 'IND-F1',
  name: 'Délai fictif',
  dir: '≤',
  target: 3,
  action: 'Action fictive',
  values: mesures(
    ['2025-06-30', 9],
    ['2025-10-31', 6],
    ['2026-03-31', 5],
    ['2026-09-30', 3.2],
    ['2026-10-31', 2.8],
    ['2025-12-31', 7, '2025'],
    ['2026-08-31', 'Oui'],
  ),
};
const taux = {
  id: 'IND-F2',
  dir: '≥',
  target: 0.85,
  values: mesures(['2026-05-31', 0.8], ['2026-06-30', 0.88]),
};

describe('libellés', () => {
  it('sens et cible en clair, taux en pourcentage', () => {
    expect(['≤', '≥', '=', ''].map(libelleSens)).toEqual([
      'Plus bas, c’est mieux',
      'Plus haut, c’est mieux',
      'Valeur attendue',
      'À définir',
    ]);
    expect(libelleCible(delai)).toBe('cible ≤ 3');
    expect(libelleCible(taux)).toBe('cible ≥ 85 %');
    expect(libelleCible({ dir: '=', target: 'Oui' })).toBe('cible : Oui');
    expect(libelleCible({ dir: '', target: '' })).toBe('cible à définir');
  });
});

describe('série et variation', () => {
  it('mesures chiffrées de la période courante, par date, limitées aux derniers mois', () => {
    const dates = (p: Parameters<typeof serieIndicateur>[1]) => serieIndicateur(delai, p).map((x) => x.date);
    expect(dates('tout')).toEqual(['2025-06-30', '2025-10-31', '2026-03-31', '2026-09-30', '2026-10-31']);
    expect(dates(12)).toEqual(['2026-03-31', '2026-09-30', '2026-10-31']);
    expect(dates(6)).toEqual(['2026-09-30', '2026-10-31']);
    expect(serieIndicateur({ values: [] }, 12)).toEqual([]);
  });
  it('variation entre les deux dernières mesures, favorable selon l’opérateur de la cible', () => {
    expect(tendanceMesures(delai)).toEqual({ sens: 'baisse', texte: '↓ 0,4 en 31 jours', favorable: true });
    expect(tendanceMesures(taux)).toEqual({ sens: 'hausse', texte: '↑ 8 pts en 30 jours', favorable: true });
    expect(tendanceMesures({ ...taux, dir: '≤' })?.favorable).toBe(false);
    expect(tendanceMesures({ dir: '=', values: mesures(['2026-01-01', 2], ['2026-01-01', 2]) })).toEqual({
      sens: 'stable',
      texte: '→ stable le même jour',
      favorable: null,
    });
    expect(tendanceMesures({ dir: '≤', values: mesures(['2026-01-01', 2]) })).toBeNull();
  });
  it('dernières mesures, la période historique signalée', () => {
    expect(dernieresMesures(delai, 3)).toEqual([
      { date: '2026-10-31', valeur: '2,8', hist: '' },
      { date: '2026-09-30', valeur: '3,2', hist: '' },
      { date: '2026-08-31', valeur: 'Oui', hist: '' },
    ]);
    expect(dernieresMesures(taux, 1)).toEqual([{ date: '2026-06-30', valeur: '88 %', hist: '' }]);
  });
});

describe('alerte de la saisie', () => {
  it('signale une valeur qui manquerait la cible, avec l’action prévue si non atteint', () => {
    expect(alerteSaisie(delai, '4')).toBe(
      'Au-dessus de la cible (cible ≤ 3) : la mesure sera « Non atteint ». Action prévue si non atteint : Action fictive.',
    );
    expect(alerteSaisie(taux, '80 %')).toBe(
      'En dessous de la cible (cible ≥ 85 %) : la mesure sera « Non atteint ». Aucune action n’est prévue si non atteint (onglet Définition).',
    );
    expect(alerteSaisie({ dir: '=', target: 'Oui' }, 'non')).toMatch(
      /^Différente de la valeur attendue \(cible : Oui\)/,
    );
  });
  it('se tait si la valeur est vide, respecte la cible ou si la cible est à définir', () => {
    expect(alerteSaisie(delai, '')).toBeNull();
    expect(alerteSaisie(delai, '3')).toBeNull();
    expect(alerteSaisie(taux, '90 %')).toBeNull();
    expect(alerteSaisie({ dir: '', target: '' }, '12')).toBeNull();
  });
});

describe('lien du pied et graphique', () => {
  it('mène aux données d’un indicateur calculé, rien pour un indicateur saisi', () => {
    expect(lienSource('saasMfa')).toEqual({
      to: '/pilotage/fournisseurs',
      libelle: 'Voir les services SaaS',
      module: 'fournisseurs',
    });
    expect(lienSource('interneNcMajOpen')?.to).toBe('/pilotage/amelioration');
    expect(lienSource(undefined)).toBeNull();
  });
  it('abscisse au temps, ordonnée inversée, zone de la cible du bon côté', () => {
    const serie = serieIndicateur(delai, 'tout');
    const g = geometrieSerie(delai, serie, 600, 200);
    expect(g.points).toHaveLength(5);
    expect(g.points[0]!.x).toBe(6);
    expect(g.points.at(-1)!.x).toBe(594);
    // La plus forte valeur est la plus haute (ordonnée la plus faible).
    expect(Math.min(...g.points.map((p) => p.y))).toBe(g.points[0]!.y);
    expect(g.ligne.startsWith('M6 ')).toBe(true);
    expect(g.aire.endsWith('Z')).toBe(true);
    // Cible ≤ : la zone respectée est sous la ligne de cible.
    expect(g.cible!.zone).toEqual({ y: g.cible!.y, hauteur: Math.round((200 - g.cible!.y) * 10) / 10 });
    expect(g.reperes).toHaveLength(5);
    const h = geometrieSerie(taux, serieIndicateur(taux, 'tout'), 600, 200);
    expect(h.cible!.zone).toEqual({ y: 0, hauteur: h.cible!.y });
    expect(geometrieSerie({ dir: '=', target: 'Oui' }, serie, 600, 200).cible).toBeNull();
  });
  it('sans mesure chiffrée sur la période : un message plutôt qu’un graphique vide', () => {
    const h = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(GraphiqueSerie, { indicateur: { values: [] }, periode: 12 })),
    );
    expect(h).toContain('Aucune mesure chiffrée à tracer sur cette période.');
  });
});
