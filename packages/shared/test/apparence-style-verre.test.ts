/* Style d'instance « Verre » (refonte verre, lot 1, décision du RSSI du 26/11/2026) : troisième valeur du style global, à
   côté de « sage » (défaut, inchangé) et « clair ». Réglage d'apparence sans migration (JSON des réglages). */
import { describe, expect, it } from 'vitest';
import { ApparenceSettings, MeOut, SETTINGS_SCHEMAS, SETTINGS_WRITE, STYLES } from '../src/index.js';

const apparence = { theme: 'auto', densite: 'normale' } as const;

describe('apparence : style « Verre »', () => {
  it('trois styles, « sage » reste le style par défaut', () => {
    expect(STYLES).toEqual(['sage', 'clair', 'verre']);
    expect(ApparenceSettings.parse(apparence).style).toBe('sage');
  });
  it('« verre » est accepté par le réglage et par /api/auth/me', () => {
    expect(ApparenceSettings.parse({ ...apparence, style: 'verre' }).style).toBe('verre');
    expect(SETTINGS_SCHEMAS.apparence.parse({ ...apparence, style: 'verre' }).style).toBe('verre');
    const me = MeOut.shape.appearance;
    expect(me.parse({ ...apparence, style: 'verre', fenetres: 'barre' }).style).toBe('verre');
  });
  it('une valeur inconnue reste refusée', () => {
    for (const style of ['Verre', 'VERRE', 'glass', 'verre ', '', 1, null])
      expect(ApparenceSettings.safeParse({ ...apparence, style }).success, String(style)).toBe(false);
    expect(MeOut.shape.appearance.safeParse({ ...apparence, style: 'glass', fenetres: 'barre' }).success).toBe(false);
  });
  it('réglé avec le droit qui règle déjà l’apparence (aucun droit élargi)', () => {
    expect(SETTINGS_WRITE.apparence).toBe('parametres:modifier');
  });
});
