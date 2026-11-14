/* L'événement React n'est plus valable une fois le gestionnaire terminé : lire `currentTarget` dans la fonction passée à un
   `setX((v) => …)` lève « Cannot read properties of null » au deuxième déclenchement (BUG-054). La valeur se lit avant. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) ? [p] : [];
  });

describe('événements React', () => {
  it('aucun `currentTarget` lu dans la fonction de mise à jour d’un état', () => {
    const fautifs = files(SRC).flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((l, i) =>
          /\bset[A-Z]\w*\(\(\w+\) =>.*\.currentTarget/.test(l) ? [`${path.relative(SRC, f)}:${i + 1}`] : [],
        ),
    );
    expect(fautifs).toEqual([]);
  });
});
