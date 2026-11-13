/* Présentation de l'accueil choisie par la personne (refonte Neon, ADR 0093) : préférence facultative du compte. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, Preferences } from '../src/affichage.js';

describe('préférence « accueil »', () => {
  it('absente par défaut : le tableau personnalisable reste la présentation de l’accueil', () => {
    expect(DEFAULT_PREFERENCES.accueil).toBeUndefined();
    expect(Preferences.parse({}).accueil).toBeUndefined();
  });
  it('accepte les deux présentations et les conserve à l’enregistrement', () => {
    expect(Preferences.parse({ accueil: 'analytique' }).accueil).toBe('analytique');
    expect(Preferences.parse({ accueil: 'personnalisee' }).accueil).toBe('personnalisee');
  });
  it('refuse une présentation inconnue', () => {
    expect(Preferences.safeParse({ accueil: 'mosaique' }).success).toBe(false);
  });
  it('ne touche pas aux autres préférences', () => {
    const p = Preferences.parse({ accueil: 'analytique', theme: 'sombre' });
    expect(p.theme).toBe('sombre');
  });
});
