import { describe, expect, it } from 'vitest';
import { REMISE_A_VIDE_PHRASES } from '@suivi/shared';
import { peutRemettreAVide } from '../src/components/RemiseAVide';

const pret = {
  autorisee: true,
  occupee: false,
  sauvegarde: { derniere: '2026-10-27T10:00:00.000Z', recente: true, delaiMinutes: 30 },
};

describe('remise à vide : conditions du bouton rouge', () => {
  it('est actif seulement avec la phrase exacte de la portée et un code à six chiffres', () => {
    expect(peutRemettreAVide(pret, 'travail', REMISE_A_VIDE_PHRASES.travail, '123456')).toBe(true);
    expect(peutRemettreAVide(pret, 'tout', REMISE_A_VIDE_PHRASES.tout, '123456')).toBe(true);
    // La phrase d'une portée ne vaut pas pour l'autre, et la casse compte.
    expect(peutRemettreAVide(pret, 'tout', REMISE_A_VIDE_PHRASES.travail, '123456')).toBe(false);
    expect(peutRemettreAVide(pret, 'travail', REMISE_A_VIDE_PHRASES.travail.toLowerCase(), '123456')).toBe(false);
    expect(peutRemettreAVide(pret, 'travail', REMISE_A_VIDE_PHRASES.travail, '12345')).toBe(false);
    expect(peutRemettreAVide(pret, 'travail', REMISE_A_VIDE_PHRASES.travail, '12345a')).toBe(false);
  });
  it('reste inactif sans autorisation, sans sauvegarde récente, en cours d’exploitation ou sans état', () => {
    const phrase = REMISE_A_VIDE_PHRASES.travail;
    expect(peutRemettreAVide({ ...pret, autorisee: false }, 'travail', phrase, '123456')).toBe(false);
    expect(
      peutRemettreAVide({ ...pret, sauvegarde: { ...pret.sauvegarde, recente: false } }, 'travail', phrase, '123456'),
    ).toBe(false);
    expect(peutRemettreAVide({ ...pret, occupee: true }, 'travail', phrase, '123456')).toBe(false);
    expect(peutRemettreAVide(undefined, 'travail', phrase, '123456')).toBe(false);
  });
});
