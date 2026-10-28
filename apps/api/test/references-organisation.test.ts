/* Le dépôt est public et générique : aucun nom d'organisation, d'établissement ni de prestataire réel dans le code, les textes
   servis et les documents courants (l'historique Git et les archives figées ne sont pas concernés). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './helpers.js';

// Motifs assemblés pour que ce fichier ne se contienne pas lui-même.
const INTERDITS = new RegExp(['norm' + 'and', '\\bG' + 'CS\\b', 'main' + 'care', '\\bA' + 'ZN\\b'].join('|'), 'i');
const EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.json', '.yml', '.yaml', '.sh', '.py', '.css', '.sql', '.html']);
const RACINES = [
  'apps',
  'packages',
  'scripts',
  'docker',
  'docs',
  'tests/e2e/specs',
  'README.md',
  '.env.example',
  'package.json',
];
const IGNORES = new Set(['node_modules', 'dist', '.git']);

function* fichiers(chemin: string): Generator<string> {
  const st = statSync(chemin);
  if (st.isFile()) {
    if (EXTENSIONS.has(path.extname(chemin)) || path.basename(chemin) === '.env.example') yield chemin;
    return;
  }
  for (const nom of readdirSync(chemin)) {
    if (IGNORES.has(nom)) continue;
    yield* fichiers(path.join(chemin, nom));
  }
}

describe('références à une organisation réelle', () => {
  it('aucune dans le code, les textes et les documents courants', () => {
    const trouves: string[] = [];
    for (const racine of RACINES)
      for (const f of fichiers(path.join(REPO, racine))) {
        const lignes = readFileSync(f, 'utf8').split('\n');
        lignes.forEach((l, i) => {
          if (INTERDITS.test(l)) trouves.push(`${path.relative(REPO, f)}:${i + 1}`);
        });
      }
    expect(trouves).toEqual([]);
  });
});
