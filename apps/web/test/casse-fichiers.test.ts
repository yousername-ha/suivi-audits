/* Architecture : aucun couple de fichiers source ne doit différer seulement par la casse une fois l'extension retirée
   (par exemple `alertes.ts` et `Alertes.tsx`). Sur un système de fichiers insensible à la casse (Windows, macOS, Docker
   Desktop avec un dossier partagé), l'import `./Alertes` est alors résolu vers `alertes.ts` et l'interface ne démarre
   plus. Contrôle porté sur `apps/web/src`, `apps/api/src` et `packages/<paquet>/src`. */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const IGNORES = new Set(['node_modules', 'dist']);

const fichiers = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    if (IGNORES.has(f)) return [];
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? fichiers(p) : [p];
  });

/** Chemin relatif, en minuscules, dernière extension retirée (`a/Alertes.tsx` → `a/alertes`). */
const cleCasse = (chemin: string) =>
  chemin
    .split(path.sep)
    .join('/')
    .toLowerCase()
    .replace(/\.[^./]*$/, '');

/** Groupes de chemins qui se confondent sur un système insensible à la casse, extension retirée. */
const collisionsDeCasse = (chemins: readonly string[]): string[][] => {
  const parCle = new Map<string, string[]>();
  for (const c of chemins) parCle.set(cleCasse(c), [...(parCle.get(cleCasse(c)) ?? []), c]);
  return [...parCle.values()].filter((g) => g.length > 1).map((g) => [...g].sort());
};

const racinesSource = (): string[] => {
  const paquets = readdirSync(path.join(RACINE, 'packages')).map((p) => path.join('packages', p, 'src'));
  return [path.join('apps', 'web', 'src'), path.join('apps', 'api', 'src'), ...paquets].filter((r) =>
    existsSync(path.join(RACINE, r)),
  );
};

describe('casse des noms de fichiers', () => {
  it('le contrôle repère deux modules qui ne diffèrent que par la casse et l’extension', () => {
    expect(
      collisionsDeCasse([
        'apps/web/src/vulnerabilites/alertes.ts',
        'apps/web/src/vulnerabilites/Alertes.tsx',
        'apps/web/src/vulnerabilites/alertes-presentation.ts',
        'apps/web/src/Vulnerabilites/veille.ts',
        'apps/web/src/vulnerabilites/Veille.tsx',
        'apps/web/src/vulnerabilites/recherche.ts',
      ]),
    ).toEqual([
      ['apps/web/src/vulnerabilites/Alertes.tsx', 'apps/web/src/vulnerabilites/alertes.ts'],
      ['apps/web/src/Vulnerabilites/veille.ts', 'apps/web/src/vulnerabilites/Veille.tsx'],
    ]);
  });

  it('les racines contrôlées existent (web, api et chaque paquet)', () => {
    const racines = racinesSource().map((r) => r.split(path.sep).join('/'));
    expect(racines).toEqual(expect.arrayContaining(['apps/web/src', 'apps/api/src', 'packages/shared/src']));
    expect(racines.length).toBeGreaterThanOrEqual(4);
  });

  it('aucun fichier de apps/web/src, apps/api/src ou packages/*/src ne diffère d’un autre par la seule casse', () => {
    const chemins = racinesSource().flatMap((r) => fichiers(path.join(RACINE, r)).map((f) => path.relative(RACINE, f)));
    expect(chemins.length).toBeGreaterThan(100);
    expect(collisionsDeCasse(chemins)).toEqual([]);
  });
});
