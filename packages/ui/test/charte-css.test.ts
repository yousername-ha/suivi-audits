/* Lot « charte CSS » du 24/11/2026 : page immobile sous une fenêtre, barres de défilement de la charte, coupure des lignes
   et polices de repli stables, en CSS statique et dans le thème (CSP stricte, ADR 0006). */
import { readdirSync, readFileSync } from 'node:fs';
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { cssVariablesResolver, theme } from '../src/theme.ts';
import { BARRES_DEFILEMENT, POLICE } from '../src/tokens.ts';

const lire = (nom: string) => readFileSync(new URL(`../src/${nom}`, import.meta.url), 'utf8');
const feuilles = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.css'));
const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const styles = sansCommentaires(lire('styles.css'));
const essai = sansCommentaires(lire('polices-essai.css'));
const fenetres = sansCommentaires(lire('neon-fenetres.css'));
const faces = (css: string) => [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]!);
const famille = (face: string) => /font-family:\s*'([^']+)'/.exec(face)?.[1];

describe('charte CSS : page immobile sous une fenêtre ouverte', () => {
  it('le voile et le conteneur retiennent le geste, la page n’est jamais figée', () => {
    const regle = /:is\(([^)]*)\)\s*\{\s*overflow:\s*hidden;\s*overscroll-behavior:\s*contain;\s*\}/.exec(fenetres);
    expect(regle?.[1]?.split(',').map((s) => s.trim())).toEqual([
      '.mantine-Modal-overlay',
      '.mantine-Drawer-overlay',
      '.mantine-Modal-inner',
      '.mantine-Drawer-inner',
    ]);
    expect(fenetres).toMatch(
      /:is\(\.mantine-Modal-content, \.mantine-Drawer-content\)\s*\{\s*overscroll-behavior:\s*contain;\s*\}/,
    );
    for (const f of feuilles)
      expect(sansCommentaires(lire(f)), f).not.toMatch(/(^|[\s,}])(html|body)\s*\{[^}]*overflow:\s*hidden/);
  });

  it('le verrou de Mantine reste coupé (balise <style> interdite par la CSP)', () => {
    expect(theme.components?.Modal?.defaultProps?.lockScroll).toBe(false);
    expect(theme.components?.Drawer?.defaultProps?.lockScroll).toBe(false);
  });
});

describe('charte CSS : barres de défilement', () => {
  it('couleurs posées sur la racine, héritées partout, contraste renforcé à part', () => {
    expect(styles).toMatch(/:root\s*\{\s*scrollbar-color:\s*var\(--suivi-barre-pouce\) var\(--suivi-barre-piste\);/);
    expect(styles).toMatch(
      /@media \(prefers-contrast: more\) \{\s*:root \{\s*scrollbar-color:\s*var\(--suivi-barre-pouce-contraste\) var\(--suivi-barre-piste-contraste\);\s*\}\s*:is\(\.shell-nav, \.nav-tiroir\) \{\s*scrollbar-color:\s*var\(--menu-barre-pouce-contraste\) var\(--menu-barre-piste-contraste\);\s*\}\s*\}/,
    );
  });

  it('aucune autre feuille ne redéfinit les couleurs ni n’utilise ::-webkit-scrollbar', () => {
    for (const f of feuilles.filter((x) => x !== 'styles.css')) {
      const css = sansCommentaires(lire(f));
      expect(css, f).not.toContain('scrollbar-color');
      expect(css, f).not.toContain('::-webkit-scrollbar');
    }
  });

  it('les variables des barres sont écrites pour les deux thèmes', () => {
    const v = cssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, theme));
    for (const [mode, vars] of [
      ['clair', v.light],
      ['sombre', v.dark],
    ] as const) {
      expect(vars['--suivi-barre-pouce']).toBe(BARRES_DEFILEMENT[mode].pouce);
      expect(vars['--suivi-barre-piste']).toBe(BARRES_DEFILEMENT[mode].piste);
      expect(vars['--suivi-barre-pouce-contraste']).toBe(BARRES_DEFILEMENT.contraste[mode].pouce);
      expect(vars['--suivi-barre-piste-contraste']).toBe(BARRES_DEFILEMENT.contraste[mode].piste);
    }
    expect(v.variables['--menu-barre-pouce']).toBe(BARRES_DEFILEMENT.menu.pouce);
    expect(v.variables['--menu-barre-pouce-contraste']).toBe(BARRES_DEFILEMENT.contraste.menu.pouce);
  });
});

describe('charte CSS : coupure des lignes', () => {
  it('titres équilibrés par le thème, sans style en ligne', () => {
    expect(theme.headings?.textWrap).toBe('balance');
    expect(cssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, theme)).variables['--mantine-heading-text-wrap']).toBe(
      'balance',
    );
    expect(styles).toMatch(/:where\(h1, h2, h3, h4, h5, h6\)\s*\{\s*text-wrap:\s*balance;\s*\}/);
  });

  it('textes d’aide sans mot isolé, sans toucher au passage à la ligne', () => {
    expect(styles).toMatch(
      /:is\(\.lecture, \.a-propos__texte, \.mantine-InputWrapper-description, \.champ-aide-texte\)\s*\{\s*text-wrap-style:\s*pretty;\s*\}/,
    );
  });
});

describe('charte CSS : polices de repli stables', () => {
  const toutes = [...faces(styles), ...faces(essai)];
  const replis = toutes.filter((f) => famille(f)?.endsWith(' repli'));
  const webfonts = toutes.filter((f) => !famille(f)?.endsWith(' repli'));

  it('chaque police hébergée garde font-display: swap et a sa police de repli réglée', () => {
    const noms = [...new Set(webfonts.map(famille))];
    expect(noms).toEqual(['Lexend', 'Plex Sans', 'Figtree', 'Public Sans']);
    for (const f of webfonts) expect(f).toMatch(/font-display:\s*swap;/);
    expect(replis.map(famille)).toEqual(noms.map((n) => `${n} repli`));
  });

  it('une police de repli est locale (rien n’est téléchargé) et mise aux dimensions de la police', () => {
    for (const f of replis) {
      expect(f).toMatch(/src:\s*local\('Arial'\)/);
      expect(f).not.toContain('url(');
      for (const d of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override'])
        expect(f).toMatch(new RegExp(`${d}:\\s*\\d+(\\.\\d+)?%;`));
      expect(f).toContain('unicode-range');
    }
  });

  it('la police de repli suit immédiatement sa police dans chaque pile', () => {
    expect(POLICE.startsWith('"Lexend", "Lexend repli", ')).toBe(true);
    for (const n of ['Plex Sans', 'Figtree', 'Public Sans'])
      expect(essai.match(new RegExp(`'${n}', '${n} repli', -apple-system`, 'g'))).toHaveLength(2);
  });
});
