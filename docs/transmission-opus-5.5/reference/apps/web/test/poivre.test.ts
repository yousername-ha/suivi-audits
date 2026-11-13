/* Écran du poivre (ADR 0072) : le bouton ne s'active que si le poivre respecte les règles, que la case est cochée et que la fin
   recopiée correspond. */
import { genererPoivre, formaterPoivreGenere } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { bilanPoivre } from '../src/poivre';

const SAISI = 'Vq7!mZ3#kP9$wX2@nR5%tL8&yB4*cD6^hF1(';

describe('bilanPoivre', () => {
  it('un poivre généré est prêt dès que la case est cochée et la fin recopiée', () => {
    const brut = genererPoivre();
    const valeur = formaterPoivreGenere(brut);
    const fin = brut.slice(-8);
    expect(bilanPoivre({ mode: 'genere', valeur, coffre: false, fin }).pret).toBeNull();
    expect(bilanPoivre({ mode: 'genere', valeur, coffre: true, fin: '' }).pret).toBeNull();
    expect(bilanPoivre({ mode: 'genere', valeur, coffre: true, fin: 'ZZZZZZZZ' }).finOk).toBe(false);
    expect(bilanPoivre({ mode: 'genere', valeur, coffre: true, fin: fin.toLowerCase() }).pret).toEqual({
      mode: 'genere',
      valeur,
      engagement: { coffre: true, fin: fin.toLowerCase() },
    });
  });
  it('un poivre saisi trop faible liste les critères et n’est jamais prêt', () => {
    const b = bilanPoivre({ mode: 'saisi', valeur: 'azertyazerty', coffre: true, fin: 'azertyaz'.slice(-8) });
    expect(b.pret).toBeNull();
    expect(b.problemes.length).toBeGreaterThanOrEqual(3);
    expect(bilanPoivre({ mode: 'saisi', valeur: '', coffre: true, fin: '' }).problemes).toEqual([]);
  });
  it('un bon poivre saisi est prêt, sauf s’il contient un texte interdit ou s’il est identique à l’ancien', () => {
    const base = { mode: 'saisi' as const, valeur: SAISI, coffre: true, fin: SAISI.slice(-8) };
    expect(bilanPoivre(base).pret).not.toBeNull();
    expect(bilanPoivre(base, { interdits: ['mZ3#k'] }).pret).toBeNull();
    expect(bilanPoivre(base, { ancien: SAISI }).pret).toBeNull();
    expect(bilanPoivre(base).entropie).toBeGreaterThan(128);
  });
});
