/* Composition d'un mot de passe de compte (ADR 0075) : longueur, types, répétition, suite, noms interdits, identique à l'ancien. */
import { describe, expect, it } from 'vitest';
import { problemesMotDePasse } from '../src/mot-de-passe.js';

const ctx = { minLen: 12, identifiants: ['jdupont'], noms: ['Suivi des audits', 'Mon organisation'] };

describe('problemesMotDePasse', () => {
  it('accepte des mots de passe conformes', () => {
    for (const pw of ['Mot-de-passe-2026!', 'Bonjour-Zq8-Rt3-Lm5!', 'Correct-Horse-Battery-9'])
      expect(problemesMotDePasse(pw, ctx), pw).toEqual([]);
  });
  it('refuse trop court, trop long et trop peu de types de caractères', () => {
    expect(problemesMotDePasse('Court-9!', ctx)).toEqual(['au moins 12 caractères']);
    expect(problemesMotDePasse('a'.repeat(300), ctx).join('|')).toMatch(/256 caractères au maximum/);
    expect(problemesMotDePasse('motdepasseseulement', ctx)).toEqual([
      'au moins 3 types de caractères parmi minuscules, majuscules, chiffres, symboles',
    ]);
  });
  it('refuse plus de 3 caractères identiques à la suite', () => {
    expect(problemesMotDePasse('Zk8-xxxx-Lm5-Hjk!', { ...ctx, minLen: 8 }).join('|')).toMatch(/identiques à la suite/);
    expect(problemesMotDePasse('Zk8-xxx-Lm5-Hjk-2026!', ctx)).toEqual([]);
  });
  it('refuse une suite de plus de 4 caractères consécutifs, croissante, décroissante ou de clavier', () => {
    for (const pw of ['Zq8-abcde-Lm5!', 'Zq8-54321-Lm5!x', 'Zq8-azerty-Lm5!', 'Zq8-QWERTY-lm5!'])
      expect(problemesMotDePasse(pw, ctx).join('|'), pw).toMatch(/suite de plus de 4/);
    expect(problemesMotDePasse('Zq8-abcd-Lm5-4321!', ctx)).toEqual([]);
  });
  it('refuse l’identifiant, le nom de l’application et celui de l’organisation, sans tenir compte de la casse', () => {
    expect(problemesMotDePasse('Zq8-JDupont-Lm5!x', ctx)).toEqual(["ne pas contenir l'identifiant"]);
    expect(problemesMotDePasse('Zq8-SUIVI DES AUDITS-5!', ctx)).toEqual([
      "ne pas contenir le nom de l'application ou de l'organisation",
    ]);
    expect(problemesMotDePasse('Zq8-mon organisation-5!', ctx)).toHaveLength(1);
    // Un texte de moins de 3 caractères n'est pas retenu (il interdirait presque tout).
    expect(problemesMotDePasse('Zq8-ab-Lm5-Hjk!x', { ...ctx, identifiants: ['ab'] })).toEqual([]);
  });
  it('refuse un mot de passe identique à l’ancien quand on le connaît', () => {
    expect(problemesMotDePasse('Mot-de-passe-2026!', { ...ctx, ancien: 'Mot-de-passe-2026!' })).toEqual([
      "doit être différent de l'ancien mot de passe",
    ]);
    expect(problemesMotDePasse('Mot-de-passe-2026!', { ...ctx, ancien: '' })).toEqual([]);
  });
  it('liste tous les critères en défaut, un message par critère', () => {
    expect(problemesMotDePasse('aaaaa', { ...ctx }).length).toBeGreaterThanOrEqual(3);
    expect(problemesMotDePasse(undefined, ctx).length).toBeGreaterThanOrEqual(2);
  });
});
