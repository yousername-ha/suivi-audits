/* Cache des lectures (TanStack Query) : une même clé ne doit jamais servir à deux adresses d'API différentes. Sinon, la
   réponse rangée par une page est relue par une autre, d'une autre forme, et l'affichage échoue (défaut constaté le
   22/11/2026 : la page « Machines » des Vulnérabilités, ouverte depuis la carte « Sans périmètre » de l'onglet
   « Périmètres », recevait les cartes de l'onglet au lieu de la liste des périmètres et affichait « (perimetres.data ?? [])
   .map is not a function »). Lecture statique des sources : clés écrites en littéraux ou en constantes littérales du même
   fichier ou de `vulnerabilites/perimetres.ts`, adresse lue au premier argument de `get(...)` dans `queryFn`. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLE_PERIMETRES, CLE_PERIMETRES_AFFECTABLES } from '../src/vulnerabilites/perimetres';

const SRC = path.resolve(__dirname, '../src');
const fichiers = (d: string): string[] =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? fichiers(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : [],
    );

/** Constantes de clé écrites en littéral : `const CLE = ['a', 'b'] as const;`. */
const constantes = (texte: string) =>
  new Map([...texte.matchAll(/const (CLE[A-Z_]*)\s*=\s*\[([^\]]*)\]\s*as const/g)].map((m) => [m[1]!, m[2]!] as const));
/** Adresses écrites en constantes littérales : `const URL_X = '/api/…';`. */
const adresses = (texte: string) =>
  new Map([...texte.matchAll(/const (URL_[A-Z_]+)\s*=\s*'([^']+)'/g)].map((m) => [m[1]!, m[2]!] as const));
const PARTAGE = fs.readFileSync(path.join(SRC, 'vulnerabilites/perimetres.ts'), 'utf8');
const PARTAGEES = constantes(PARTAGE);
const ADRESSES_PARTAGEES = adresses(PARTAGE);

/** Clé résolue en texte (null si elle dépend d'une variable) ; adresse sans paramètres ni partie calculée. */
function lectures(fichier: string) {
  const texte = fs.readFileSync(fichier, 'utf8');
  const locales = constantes(texte);
  const urls = adresses(texte);
  const out: { cle: string; url: string; ou: string }[] = [];
  for (const m of texte.matchAll(
    /queryKey:\s*\[([^\]]*)\],\s*queryFn:\s*\(\)\s*=>\s*get<[^>]*>\(\s*(?:(['`])([^'`$?]+)|(URL_[A-Z_]+)\))/g,
  )) {
    const morceaux = m[1]!
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const resolus: string[] = [];
    let complet = true;
    for (const x of morceaux) {
      const lit = /^'([^']*)'$/.exec(x);
      const etale = /^\.\.\.(CLE[A-Z_]*)$/.exec(x);
      if (lit) resolus.push(lit[1]!);
      else if (etale && (locales.has(etale[1]!) || PARTAGEES.has(etale[1]!)))
        resolus.push(
          ...(locales.get(etale[1]!) ?? PARTAGEES.get(etale[1]!))!
            .split(',')
            .map((y) => y.trim().replace(/^'|'$/g, ''))
            .filter(Boolean),
        );
      else complet = false;
    }
    const url = m[3] ?? urls.get(m[4]!) ?? ADRESSES_PARTAGEES.get(m[4]!);
    if (complet && url)
      out.push({ cle: JSON.stringify(resolus), url: url.replace(/\/$/, ''), ou: path.relative(SRC, fichier) });
  }
  return out;
}

describe('clés du cache des lectures', () => {
  it('une clé, une seule adresse d’API', () => {
    const parCle = new Map<string, Set<string>>();
    const ou = new Map<string, string[]>();
    const toutes = fichiers(SRC).flatMap(lectures);
    expect(toutes.length).toBeGreaterThan(20);
    for (const l of toutes) {
      parCle.set(l.cle, (parCle.get(l.cle) ?? new Set()).add(l.url));
      ou.set(l.cle, [...(ou.get(l.cle) ?? []), `${l.ou} → ${l.url}`]);
    }
    const conflits = [...parCle]
      .filter(([, urls]) => urls.size > 1)
      .map(([cle]) => `${cle} : ${ou.get(cle)!.join(' ; ')}`);
    expect(conflits).toEqual([]);
  });

  it('les cartes de l’onglet « Périmètres » et la liste des périmètres affectables ont deux clés distinctes', () => {
    expect([...CLE_PERIMETRES_AFFECTABLES]).not.toEqual([...CLE_PERIMETRES]);
    const machines = lectures(path.join(SRC, 'vulnerabilites/Machines.tsx'));
    const affectables = machines.filter((l) => l.url === '/api/vulnerabilites/perimetres');
    expect(affectables.length).toBeGreaterThan(0);
    for (const l of affectables) expect(l.cle).toBe(JSON.stringify([...CLE_PERIMETRES_AFFECTABLES]));
  });
});
