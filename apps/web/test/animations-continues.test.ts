/* Animations en continu, sans bouton de pause (ADR 0099) : aucun écran ne propose plus de mettre en pause ou de reprendre
   ses animations décoratives, aucune préférence de pause n'est gardée dans le navigateur, et la préférence système de
   mouvement réduit reste le moyen de les arrêter (feuilles de style et graphe des périmètres). Données fictives. */
import { MantineProvider } from '@mantine/core';
import type { CartePerimetre } from '@suivi/shared';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartesPerimetres } from '../src/pilotage/CartesPerimetres';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(ICI, '../src');
const UI = path.resolve(ICI, '../../../packages/ui/src');
const fichiers = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === 'generated' ? [] : fichiers(p);
    return /\.(tsx?|css)$/.test(f) ? [p] : [];
  });
const lire = (f: string) => readFileSync(f, 'utf8');

/** Contenu des blocs `@media (<requete>) { … }` d'une feuille de style, accolades équilibrées. */
function blocsMedia(css: string, requete: string): string {
  const morceaux: string[] = [];
  let i = css.indexOf(`@media (${requete})`);
  while (i >= 0) {
    const debut = css.indexOf('{', i);
    let profondeur = 0,
      j = debut;
    for (; j < css.length; j++) {
      if (css[j] === '{') profondeur++;
      else if (css[j] === '}' && --profondeur === 0) break;
    }
    morceaux.push(css.slice(debut + 1, j));
    i = css.indexOf(`@media (${requete})`, j);
  }
  return morceaux.join('\n');
}
const occurrences = (texte: string, motif: RegExp) => (texte.match(motif) ?? []).length;

describe('animations en continu : plus de bouton de pause', () => {
  it('aucun libellé de pause ou de reprise des animations dans l’interface', () => {
    const LIBELLES =
      /Mettre (les animations |le flux )?en pause|Pause animations|Suspendre les animations|Activer les animations|Reprendre (les animations|le mouvement|le flux)|Animations du menu en pause/;
    const trouves = fichiers(WEB).flatMap((f) =>
      lire(f)
        .split('\n')
        .map((l, i) => [l, i] as const)
        .filter(([l]) => LIBELLES.test(l))
        .map(([l, i]) => `${path.relative(WEB, f)}:${i + 1} ${l.trim()}`),
    );
    expect(trouves).toEqual([]);
  });
  it('aucune préférence de pause gardée dans le navigateur', () => {
    const trouves = fichiers(WEB).filter((f) => /['"](menu|taches)-mouvement['"]/.test(lire(f)));
    expect(trouves).toEqual([]);
  });
  it('aucune règle de style pour les commandes retirées', () => {
    const RETIRES = /\.(nav-pause|taches-pause|swot-motion-control)\b|data-animations=/;
    const trouves = [...fichiers(UI), ...fichiers(WEB)].filter((f) => RETIRES.test(lire(f)));
    expect(trouves).toEqual([]);
  });
});

describe('animations en continu : le mouvement réduit les arrête toujours', () => {
  it('menu : chaque mouvement des pictogrammes n’existe que sans préférence de mouvement réduit et onglet visible', () => {
    const css = lire(path.join(UI, 'neon-menu.css'));
    const libre = blocsMedia(css, 'prefers-reduced-motion: no-preference');
    const total = occurrences(css, /animation: mw-/g);
    expect(total).toBe(8);
    expect(occurrences(libre, /animation: mw-/g)).toBe(total);
    expect(occurrences(libre, /\.nav-neon:not\(\[data-mouvement='pause'\]\) \.mw-/g)).toBe(total);
  });
  it('tâches : le halo n’existe que sans préférence de mouvement réduit, et le mouvement réduit coupe tout', () => {
    const css = lire(path.join(UI, 'neon-taches.css'));
    expect(occurrences(blocsMedia(css, 'prefers-reduced-motion: no-preference'), /animation: tache-pouls/g)).toBe(
      occurrences(css, /animation: tache-pouls/g),
    );
    expect(blocsMedia(css, 'prefers-reduced-motion: reduce')).toContain('animation: none !important');
  });
  it('processus, PESTEL, SWOT, objectifs, assistant, flux des périmètres et carte de la surface externe : règle de mouvement réduit présente', () => {
    for (const f of [
      path.join(UI, 'neon-surface.css'),
      path.join(UI, 'neon-processus.css'),
      path.join(UI, 'neon-pestel.css'),
      path.join(UI, 'neon-swot.css'),
      path.join(UI, 'neon-objectifs.css'),
      path.join(UI, 'neon-assistant.css'),
      path.join(WEB, 'app.css'),
    ])
      expect(blocsMedia(lire(f), 'prefers-reduced-motion: reduce'), path.basename(f)).toMatch(/animation: none/);
    expect(blocsMedia(lire(path.join(WEB, 'app.css')), 'prefers-reduced-motion: reduce')).toContain(
      '.graphe-lien--flux',
    );
  });
});

describe('graphe des périmètres : flux continu, arrêté par le mouvement réduit', () => {
  const vide = { actions: null, recurrentes: null, ecarts: null, continuite: null, couverture: null };
  const carte = (id: string, parentId: string | null): CartePerimetre => ({
    id,
    name: 'Périmètre ' + id,
    parentId,
    nature: '',
    entityKind: 'organisation',
    supplierId: null,
    compteurs: vide,
    total: vide,
    sousPerimetres: 0,
  });
  const graphe = () =>
    renderToStaticMarkup(
      createElement(
        MantineProvider,
        null,
        createElement(CartesPerimetres, {
          cartes: [carte('racine', null), carte('enfant', 'racine')],
          affiche: 'racine',
          onChoisir: () => undefined,
        }),
      ),
    );
  afterEach(() => vi.unstubAllGlobals());

  it('sans préférence : liaison animée et aucun bouton de pause', () => {
    const html = graphe();
    expect(html).toContain('graphe-lien graphe-lien--flux');
    expect(html).not.toMatch(/Mettre le flux en pause|Reprendre le flux/);
  });
  it('mouvement réduit demandé par le système : liaison tracée, sans flux, dès le premier rendu', () => {
    const matchMedia = (q: string) => ({
      matches: q.includes('prefers-reduced-motion: reduce'),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    });
    vi.stubGlobal('window', { matchMedia });
    const html = graphe();
    expect(html).toContain('class="graphe-lien"');
    expect(html).not.toContain('graphe-lien--flux');
    expect(html).not.toMatch(/Mettre le flux en pause|Reprendre le flux/);
  });
});

describe('carte de la surface externe (ADR 0100, lot ALH4) : animations seulement sans mouvement réduit', () => {
  it('flux du chemin critique, halo et balayage n’existent que sans préférence de mouvement réduit', () => {
    const css = lire(path.join(UI, 'neon-surface.css'));
    const libre = blocsMedia(css, 'prefers-reduced-motion: no-preference');
    const total = occurrences(css, /animation: sc-/g);
    expect(total).toBe(3);
    expect(occurrences(libre, /animation: sc-/g)).toBe(total);
    expect(blocsMedia(css, 'prefers-reduced-motion: reduce')).toContain('.surface-carte .sc-balayage');
  });
});

describe('vue d’ensemble du module Vulnérabilités (ADR 0100, lot PC1) : animations seulement sans mouvement réduit', () => {
  it('balayage du radar, halo des failles exploitées et cran du niveau : coupés par le mouvement réduit et à l’impression', () => {
    const css = lire(path.join(UI, 'neon-commandement.css'));
    const libre = blocsMedia(css, 'prefers-reduced-motion: no-preference');
    const total = occurrences(css, /animation: pc-/g);
    expect(total).toBe(3);
    expect(occurrences(libre, /animation: pc-/g)).toBe(total);
    expect(blocsMedia(css, 'prefers-reduced-motion: reduce')).toContain('animation: none !important');
    expect(blocsMedia(css, 'prefers-reduced-motion: reduce')).toContain('.poste .pc-balayage');
    expect(css).toMatch(/@media print \{[^}]*\.poste \.pc-balayage/);
  });
});
