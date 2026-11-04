import { describe, expect, it } from 'vitest';
import { cleDomaine, codeDepuisLibelle, sansSoulignesDeBord } from '../src/index.js';

/** Ancienne implémentation (expression régulière), gardée ici comme référence de comportement. */
const ancienne = (s: string) => s.replace(/^_+|_+$/g, '');

describe('sansSoulignesDeBord', () => {
  const cas = ['', '_', '___', 'a', '_a', 'a_', '__a__', 'a_b', '_a_b_', '__a__b__', 'abc', '___ _x_ ___'];
  it.each(cas)('même résultat que l’ancienne expression régulière pour %j', (s) => {
    expect(sansSoulignesDeBord(s)).toBe(ancienne(s));
  });

  it('reste linéaire sur une très longue suite de soulignés suivie d’un autre caractère', () => {
    const long = '_'.repeat(200_000) + 'x';
    const debut = Date.now();
    expect(sansSoulignesDeBord(long)).toBe('x');
    expect(sansSoulignesDeBord('x' + '_'.repeat(200_000) + 'x')).toBe('x' + '_'.repeat(200_000) + 'x');
    expect(Date.now() - debut).toBeLessThan(500);
  });
});

describe('clés construites sans expression régulière quadratique', () => {
  it('cleDomaine : « 01 Gouvernance » → « ia_01_gouvernance »', () => {
    expect(cleDomaine('01 Gouvernance')).toBe('ia_01_gouvernance');
    expect(cleDomaine('  --Été & Sécurité !! ')).toBe('ia_ete_securite');
    expect(cleDomaine('!!!')).toBe('ia_');
  });
  it('codeDepuisLibelle : libellé sans accents ni ponctuation, unique', () => {
    expect(codeDepuisLibelle('Réalisation (cœur)', [])).toBe('Realisation_c_ur');
    expect(codeDepuisLibelle('???', [])).toBe('type');
    expect(codeDepuisLibelle('Support', ['support'])).not.toBe('Support');
  });
});
