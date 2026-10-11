/* Charte : aucune couleur ni aucun espacement codé en dur dans l'interface, hors du thème (packages/ui). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === 'generated' ? [] : files(p);
    return /\.(tsx?|css)$/.test(f) ? [p] : [];
  });

const COLOR = /(?<![\w&/])#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/;
const NUMERIC_PROP =
  /\b(maw|miw|mah|mih|w|h|m|mt|mb|ml|mr|mx|my|p|pt|pb|pl|pr|px|py|gap|rowGap|columnGap|fz|lh)=\{[1-9][0-9.]*\}/;
const INLINE_STYLE = /\bstyle=\{/;
const CSS_LENGTH = /(?<![\w-])\d*\.?\d+(px|rem)\b/;

describe('charte graphique', () => {
  const all = files(SRC);

  it('aucune couleur codée en dur', () => {
    const bad = all.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((l, i) => [l, i] as const)
        .filter(([l]) => COLOR.test(l))
        .map(([l, i]) => `${path.relative(SRC, f)}:${i + 1} ${l.trim()}`),
    );
    expect(bad).toEqual([]);
  });

  it('aucun espacement ni aucune taille numérique dans les composants (jetons du thème uniquement)', () => {
    const bad = all
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((l, i) => [l, i] as const)
          .filter(([l]) => NUMERIC_PROP.test(l) || INLINE_STYLE.test(l))
          .map(([l, i]) => `${path.relative(SRC, f)}:${i + 1} ${l.trim()}`),
      );
    expect(bad).toEqual([]);
  });

  it('aucune longueur en px ou rem dans les feuilles de style de l’application', () => {
    const bad = all
      .filter((f) => f.endsWith('.css'))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((l, i) => [l, i] as const)
          .filter(([l]) => !l.trim().startsWith('@media') && CSS_LENGTH.test(l))
          .map(([l, i]) => `${path.relative(SRC, f)}:${i + 1} ${l.trim()}`),
      );
    expect(bad).toEqual([]);
  });
});
