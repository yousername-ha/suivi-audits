import { describe, expect, it } from 'vitest';
import { FUSEAU_PARIS, jourParis, maintenantLocalParis } from '../src/index.js';

const t = (iso: string) => new Date(iso);

describe('jour et heure civils de Paris', () => {
  it('le fuseau est celui de Paris', () => expect(FUSEAU_PARIS).toBe('Europe/Paris'));

  it('après minuit à Paris, le jour civil est le lendemain du jour UTC (hiver, UTC+1)', () => {
    expect(t('2026-11-24T23:30:00Z').toISOString().slice(0, 10)).toBe('2026-11-24');
    expect(jourParis(t('2026-11-24T23:30:00Z'))).toBe('2026-11-25');
    expect(maintenantLocalParis(t('2026-11-24T23:30:00Z'))).toBe('2026-11-25T00:30');
    expect(jourParis(t('2026-11-24T22:59:59Z'))).toBe('2026-11-24');
    expect(maintenantLocalParis(t('2026-11-24T22:59:59Z'))).toBe('2026-11-24T23:59');
    expect(jourParis(t('2026-11-24T23:00:00Z'))).toBe('2026-11-25');
  });

  it('en été (UTC+2), le jour change dès 22 h UTC', () => {
    expect(jourParis(t('2026-07-14T21:59:00Z'))).toBe('2026-07-14');
    expect(jourParis(t('2026-07-14T22:00:00Z'))).toBe('2026-07-15');
    expect(maintenantLocalParis(t('2026-07-14T22:15:00Z'))).toBe('2026-07-15T00:15');
  });

  it('passage à l’heure d’été (29/03/2026 : 2 h devient 3 h)', () => {
    expect(maintenantLocalParis(t('2026-03-29T00:59:59Z'))).toBe('2026-03-29T01:59');
    expect(maintenantLocalParis(t('2026-03-29T01:00:00Z'))).toBe('2026-03-29T03:00');
    expect(jourParis(t('2026-03-28T23:30:00Z'))).toBe('2026-03-29');
    expect(jourParis(t('2026-03-29T22:30:00Z'))).toBe('2026-03-30');
  });

  it('passage à l’heure d’hiver (25/10/2026 : 3 h redevient 2 h)', () => {
    expect(maintenantLocalParis(t('2026-10-25T00:59:59Z'))).toBe('2026-10-25T02:59');
    expect(maintenantLocalParis(t('2026-10-25T01:00:00Z'))).toBe('2026-10-25T02:00');
    expect(jourParis(t('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
    expect(jourParis(t('2026-10-25T22:59:00Z'))).toBe('2026-10-25');
    expect(jourParis(t('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });

  it('minuit s’écrit 00 (jamais 24) et le format est celui d’un champ « datetime-local »', () => {
    const v = maintenantLocalParis(t('2026-01-01T23:00:00Z'));
    expect(v).toBe('2026-01-02T00:00');
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(jourParis(t('2026-12-31T23:00:00Z'))).toBe('2027-01-01');
  });

  it('sans argument, prend l’instant courant', () => {
    const avant = jourParis(new Date());
    const j = jourParis();
    expect([avant, jourParis(new Date())]).toContain(j);
    expect(maintenantLocalParis()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('refuse une date invalide', () => {
    expect(() => jourParis(new Date('n’importe quoi'))).toThrow(RangeError);
    expect(() => maintenantLocalParis(new Date(Number.NaN))).toThrow(RangeError);
  });
});
