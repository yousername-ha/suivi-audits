/* Style des fenêtres à l'essai (addendum du 19/11/2026 à l'ADR 0093) : réglage d'apparence de l'instance, sans migration
   (JSON des réglages). Barre d'accent par défaut, liseré au choix, toute autre valeur refusée. */
import { describe, expect, it } from 'vitest';
import { ApparenceSettings, FENETRES, MeOut, SETTINGS_SCHEMAS, SETTINGS_WRITE } from '../src/index.js';

const apparence = { theme: 'auto', densite: 'normale' } as const;

describe('apparence : style des fenêtres', () => {
  it('deux styles seulement, la barre d’accent par défaut (ancien enregistrement sans le champ compris)', () => {
    expect(FENETRES).toEqual(['barre', 'lisere']);
    expect(ApparenceSettings.parse(apparence)).toEqual({ ...apparence, style: 'sage', fenetres: 'barre' });
    expect(ApparenceSettings.parse({ ...apparence, style: 'clair' }).fenetres).toBe('barre');
    expect(SETTINGS_SCHEMAS.apparence.parse({ ...apparence, fenetres: 'lisere' }).fenetres).toBe('lisere');
  });
  it('une valeur inconnue est refusée', () => {
    for (const fenetres of ['hexagone', 'biseau', '', 'BARRE', 1, null])
      expect(ApparenceSettings.safeParse({ ...apparence, fenetres }).success, String(fenetres)).toBe(false);
  });
  it('réglé avec le droit qui règle déjà l’apparence ; transmis à tous les comptes par /api/auth/me', () => {
    expect(SETTINGS_WRITE.apparence).toBe('parametres:modifier');
    const schema = MeOut.shape.appearance;
    expect(schema.parse({ ...apparence, style: 'sage', fenetres: 'lisere' }).fenetres).toBe('lisere');
    expect(schema.safeParse({ ...apparence, style: 'sage', fenetres: 'hexagone' }).success).toBe(false);
  });
});
