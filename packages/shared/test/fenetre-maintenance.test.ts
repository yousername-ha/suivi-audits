import { describe, expect, it } from 'vitest';
import { dansFenetre, FenetreMaintenance, heureLocale, libelleFenetre } from '../src/updates.js';

const f = (changes: Partial<FenetreMaintenance> = {}): FenetreMaintenance => ({
  active: true,
  jours: [1, 2, 3, 4, 5],
  debut: '12:00',
  fin: '14:00',
  ...changes,
});

describe('fenêtre de maintenance (heure de Paris)', () => {
  it('désactivée : toujours autorisée', () => {
    expect(dansFenetre(f({ active: false }), new Date('2026-10-25T03:00:00Z'))).toBe(true);
  });
  it('créneau de jour : bornes incluse au début, exclue à la fin', () => {
    // Lundi 26 octobre 2026 : heure d'hiver (UTC+1).
    expect(dansFenetre(f(), new Date('2026-10-26T10:59:00Z'))).toBe(false);
    expect(dansFenetre(f(), new Date('2026-10-26T11:00:00Z'))).toBe(true);
    expect(dansFenetre(f(), new Date('2026-10-26T12:59:00Z'))).toBe(true);
    expect(dansFenetre(f(), new Date('2026-10-26T13:00:00Z'))).toBe(false);
  });
  it('respecte les jours (samedi exclu)', () => {
    expect(dansFenetre(f(), new Date('2026-10-24T11:30:00Z'))).toBe(false);
  });
  it('suit l’heure d’été', () => {
    // Lundi 19 octobre 2026 : heure d'été (UTC+2), 12:30 à Paris = 10:30 UTC.
    expect(dansFenetre(f(), new Date('2026-10-19T10:30:00Z'))).toBe(true);
    expect(dansFenetre(f(), new Date('2026-10-19T12:30:00Z'))).toBe(false);
  });
  it('créneau qui passe minuit : rattaché au jour de son début', () => {
    const nuit = f({ jours: [5], debut: '22:00', fin: '02:00' }); // vendredi soir → samedi matin
    expect(dansFenetre(nuit, new Date('2026-10-23T21:30:00Z'))).toBe(true); // vendredi 23:30
    expect(dansFenetre(nuit, new Date('2026-10-24T00:30:00Z'))).toBe(false); // samedi 02:30 : après la fin
    expect(dansFenetre(nuit, new Date('2026-10-23T23:30:00Z'))).toBe(true); // samedi 01:30
    expect(dansFenetre(nuit, new Date('2026-10-22T21:30:00Z'))).toBe(false); // jeudi 23:30
    expect(dansFenetre(nuit, new Date('2026-10-24T21:30:00Z'))).toBe(false); // samedi 23:30
  });
  it('heure locale et libellé', () => {
    expect(heureLocale(new Date('2026-10-26T11:15:00Z'))).toEqual({ jour: 1, minute: 12 * 60 + 15 });
    expect(libelleFenetre(f({ jours: [3, 1] }))).toBe('lundi, mercredi de 12:00 à 14:00 (heure de Paris)');
    expect(libelleFenetre(f({ active: false }))).toBe('Aucune restriction horaire.');
  });
  it('schéma : refuse jours vides ou en double, heures invalides, début = fin', () => {
    expect(FenetreMaintenance.safeParse(f({ jours: [] })).success).toBe(false);
    expect(FenetreMaintenance.safeParse(f({ jours: [2, 2] })).success).toBe(false);
    expect(FenetreMaintenance.safeParse(f({ debut: '24:00' })).success).toBe(false);
    expect(FenetreMaintenance.safeParse(f({ fin: '12:00' })).success).toBe(false);
    expect(FenetreMaintenance.safeParse(f()).success).toBe(true);
  });
});
