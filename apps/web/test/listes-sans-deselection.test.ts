/* Listes de choix : recliquer la valeur affichée ne la désélectionne pas (BUG-068, BUG-057, BUG-022). Une liste Mantine
   désélectionne par défaut ; sans bouton d'effacement (`clearable`), c'est un accident qui envoie une valeur vide. Toute
   liste « Select » porte donc `allowDeselect={false}` ou `clearable`. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === 'generated' ? [] : files(p);
    return /\.tsx$/.test(f) ? [p] : [];
  });

describe('listes de choix', () => {
  it('aucune liste « Select » ne se désélectionne par un second clic sans bouton d’effacement', () => {
    const fautives = files(SRC).flatMap((f) => {
      const s = readFileSync(f, 'utf8');
      return [...s.matchAll(/<Select\b/g)].flatMap((m) => {
        const bloc = s.slice(m.index, s.indexOf('/>', m.index));
        return /allowDeselect|clearable/.test(bloc)
          ? []
          : [`${path.relative(SRC, f)}:${s.slice(0, m.index).split('\n').length}`];
      });
    });
    expect(fautives).toEqual([]);
  });
});
