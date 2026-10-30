/* Filtres de liste conservés dans l'adresse (R06) : écriture d'un filtre, valeur par défaut retirée, filtres successifs. */
import { describe, expect, it } from 'vitest';
import { avecFiltre } from '../src/components/filtre-url';

describe('filtres dans l’adresse', () => {
  it('écrit le filtre et conserve les autres paramètres', () => {
    expect(avecFiltre('?tvue=calendar&tq=audit', 'tmois', '2026-12', '2026-10').toString()).toBe(
      'tvue=calendar&tq=audit&tmois=2026-12',
    );
  });

  it('retire le filtre revenu à sa valeur par défaut ou vidé', () => {
    expect(avecFiltre('?tmois=2026-12&tq=a', 'tmois', '2026-10', '2026-10').toString()).toBe('tq=a');
    expect(avecFiltre('?tq=a', 'tq', '', '').toString()).toBe('');
  });

  it('deux filtres changés coup sur coup se cumulent quand chacun part de l’adresse courante', () => {
    // Le mois, puis la bascule des jours fériés : la seconde écriture repart de l'adresse déjà mise à jour.
    const apresMois = '?' + avecFiltre('?tvue=calendar', 'tmois', '2026-12', '2026-10').toString();
    const apresBascule = avecFiltre(apresMois, 'tferies', '1', '0');
    expect(Object.fromEntries(apresBascule)).toEqual({ tvue: 'calendar', tmois: '2026-12', tferies: '1' });
    // Repartir des paramètres d'avant le premier changement (ancien comportement) perdait le mois.
    expect(Object.fromEntries(avecFiltre('?tvue=calendar', 'tferies', '1', '0'))).not.toHaveProperty('tmois');
  });
});
