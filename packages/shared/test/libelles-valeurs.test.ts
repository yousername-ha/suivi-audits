/* Libellés français des valeurs techniques de l'appréciation (BUG-059). */
import { describe, expect, it } from 'vitest';
import {
  libelleAcceptabilite,
  libelleEtatAppreciation,
  libelleModeCalcul,
  libelleOptionTraitement,
} from '../src/libelles-valeurs.js';

describe('libellés des valeurs techniques', () => {
  it('traduit les codes connus et laisse tel quel un code inconnu', () => {
    expect(libelleAcceptabilite('conditional')).toBe('Acceptable sous condition');
    expect(libelleAcceptabilite('unacceptable')).toBe('Inacceptable');
    expect(libelleOptionTraitement('reduce')).toBe('Réduire');
    expect(libelleEtatAppreciation('draft')).toBe('Brouillon');
    expect(libelleModeCalcul('judgement')).toBe('jugement qualitatif');
    expect(libelleAcceptabilite('autre')).toBe('autre');
    expect(libelleAcceptabilite(null)).toBe('');
  });
});
