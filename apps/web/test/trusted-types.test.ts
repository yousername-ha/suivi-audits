/* Trusted Types en observation (ADR 0006, addendum du 24/11/2026) : politique « suivi-xml » de l'interface, en-tête
   Content-Security-Policy-Report-Only des frontaux et absence de point d'injection non couvert dans les sources.
   Aucun navigateur : API Trusted Types et DOMParser simulés. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { creerPolitiqueXml, POLITIQUE_XML, POLITIQUES_TRUSTED_TYPES } from '../src/trusted-types';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const lire = (fichier: string) => readFileSync(path.join(RACINE, fichier), 'utf8');
const fichiers = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === 'generated' || f === 'node_modules' ? [] : fichiers(p);
    return /\.(tsx?|m?js)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });

const fabrique = () => {
  const createHTML = vi.fn((texte: string) => ({ confiance: texte }));
  const createPolicy = vi.fn((_nom: string, regles: { createHTML(texte: string): string }) => ({
    createHTML: (texte: string) => createHTML(regles.createHTML(texte)),
  }));
  return { createPolicy, createHTML };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('politique Trusted Types « suivi-xml »', () => {
  it('passe par createPolicy sous le nom déclaré et rend la valeur de la politique', () => {
    const f = fabrique();
    const convertir = creerPolitiqueXml(f);
    expect(f.createPolicy).toHaveBeenCalledOnce();
    expect(f.createPolicy.mock.calls[0]![0]).toBe(POLITIQUE_XML);
    expect(convertir('<a/>')).toEqual({ confiance: '<a/>' });
  });

  it('refuse une déclaration de type de document ou d’entité, avec ou sans API Trusted Types', () => {
    const f = fabrique();
    for (const convertir of [creerPolitiqueXml(f), creerPolitiqueXml(undefined)]) {
      expect(() => convertir('<!doctype x>\n<a/>')).toThrow(TypeError);
      expect(() => convertir('<a><!-- <!Entity x "y"> --></a>')).toThrow(TypeError);
    }
    expect(f.createHTML).not.toHaveBeenCalled();
  });

  it('sans API Trusted Types (navigateur ancien), le texte passe tel quel', () => {
    expect(creerPolitiqueXml(undefined)('<a/>')).toBe('<a/>');
  });

  it('analyserXml crée la politique une seule fois et analyse en application/xml', async () => {
    const f = fabrique();
    vi.stubGlobal('trustedTypes', f);
    const { analyserXml } = await import('../src/trusted-types');
    const document = {} as Document;
    const parseFromString = vi.fn(() => document);
    expect(analyserXml('<a/>', { parseFromString })).toBe(document);
    analyserXml('<b/>', { parseFromString });
    expect(f.createPolicy).toHaveBeenCalledOnce();
    expect(parseFromString.mock.calls).toEqual([
      [{ confiance: '<a/>' }, 'application/xml'],
      [{ confiance: '<b/>' }, 'application/xml'],
    ]);
  });
});

describe('en-tête Content-Security-Policy-Report-Only des frontaux', () => {
  const OBSERVATION = /header Content-Security-Policy-Report-Only "([^"]*)"/g;
  const politiques = (fichier: string) => [...lire(fichier).matchAll(OBSERVATION)].map((m) => m[1]);

  it('interface : Trusted Types exigés en observation, avec la liste exacte des politiques de l’interface', () => {
    const attendu = `require-trusted-types-for 'script'; trusted-types ${POLITIQUES_TRUSTED_TYPES.join(' ')}`;
    for (const fichier of ['docker/Caddyfile', 'docker/Caddyfile.internal']) {
      const texte = lire(fichier);
      // Un en-tête d'observation par CSP appliquée de l'interface, juste à côté d'elle.
      expect(texte.match(/header Content-Security-Policy "/g), fichier).toHaveLength(1);
      expect(politiques(fichier), fichier).toEqual([attendu]);
    }
  });

  it('page de mise à jour : Trusted Types exigés en observation, aucune politique autorisée', () => {
    const texte = lire('docker/Caddyfile.gateway');
    const appliquees = texte.match(/header Content-Security-Policy "/g) ?? [];
    expect(appliquees.length).toBeGreaterThan(0);
    expect(politiques('docker/Caddyfile.gateway')).toEqual(
      appliquees.map(() => "require-trusted-types-for 'script'; trusted-types 'none'"),
    );
  });

  it('la CSP appliquée reste inchangée et aucun rapport ne part vers un point de collecte', () => {
    for (const fichier of ['docker/Caddyfile', 'docker/Caddyfile.internal', 'docker/Caddyfile.gateway']) {
      const texte = lire(fichier);
      expect(texte, fichier).not.toMatch(/report-uri|report-to|Reporting-Endpoints|Report-To:/i);
      for (const [, csp] of texte.matchAll(/header Content-Security-Policy "([^"]*)"/g))
        expect(csp, fichier).not.toMatch(/trusted-types/);
    }
  });
});

describe('points d’injection du DOM dans les sources de l’interface', () => {
  const sources = [
    ...fichiers(path.join(RACINE, 'apps/web/src')),
    ...fichiers(path.join(RACINE, 'packages/ui/src')),
    ...fichiers(path.join(RACINE, 'docker/maintenance')),
  ];
  const releves = (motif: RegExp, permis: string[] = []) =>
    sources.flatMap((f) => {
      const relatif = path.relative(RACINE, f);
      if (permis.includes(relatif)) return [];
      return readFileSync(f, 'utf8')
        .split('\n')
        .map((l, i) => [l, i] as const)
        .filter(([l]) => motif.test(l))
        .map(([l, i]) => `${relatif}:${i + 1} ${l.trim()}`);
    });

  it('aucun point d’injection HTML ou script écrit directement', () => {
    expect(
      releves(
        /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(|dangerouslySetInnerHTML|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe|\bsrcdoc\b|set(Timeout|Interval)\(\s*['"`]/,
      ),
    ).toEqual([]);
  });

  it('Mantine : tout changement de thème garde les transitions (sinon un innerHTML sur une balise <style>)', () => {
    const appels = releves(/useMantineColorScheme\(/);
    expect(appels.length).toBeGreaterThan(0);
    expect(appels.filter((l) => !/useMantineColorScheme\(\{ keepTransitions: true \}\)/.test(l))).toEqual([]);
  });

  it('le DOMParser et createPolicy ne servent qu’à travers trusted-types.ts', () => {
    const permis = ['apps/web/src/trusted-types.ts'];
    expect(releves(/\.parseFromString\(|createPolicy\(/, permis)).toEqual([]);
  });
});
