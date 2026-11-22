/* Accessibilité (WCAG A, règle axe « button-name ») : chaque <Pagination> des modules Vulnérabilités et Veille
   réglementaire nomme ses boutons (flèches et pages), sans quoi le bouton désactivé et la page active n'ont pas de nom.
   Défaut relevé le 22/11/2026 par la session Ergonomie sur l'écran « Machines » ; présent aussi sur cinq autres écrans.
   Lecture statique des sources : la balise doit porter NOMS_PAGINATION, ou getControlProps et getItemProps. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOMS_PAGINATION } from '../src/vulnerabilites/pagination';

const SRC = path.resolve(__dirname, '../src');
const DOSSIERS = ['vulnerabilites', 'veille-reglementaire'];

describe('pagination nommée', () => {
  it('chaque <Pagination> des modules nomme ses boutons', () => {
    const sans: string[] = [];
    let vues = 0;
    for (const d of DOSSIERS)
      for (const f of fs.readdirSync(path.join(SRC, d)).filter((x) => x.endsWith('.tsx'))) {
        const texte = fs.readFileSync(path.join(SRC, d, f), 'utf8');
        for (const m of texte.matchAll(/<Pagination(?![A-Za-z])[^>]*?\/>/gs)) {
          vues++;
          if (!/NOMS_PAGINATION|getItemProps/.test(m[0]))
            sans.push(`${d}/${f} : ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`);
        }
      }
    expect(vues).toBeGreaterThan(5);
    expect(sans).toEqual([]);
  });

  it('noms rendus : flèches et pages', () => {
    expect(NOMS_PAGINATION.getControlProps('previous')['aria-label']).toBe('Page précédente');
    expect(NOMS_PAGINATION.getControlProps('next')['aria-label']).toBe('Page suivante');
    expect(NOMS_PAGINATION.getItemProps(3)['aria-label']).toBe('Page 3');
  });
});
