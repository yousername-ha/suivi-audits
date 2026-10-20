/* Classification d'un constat : celle de la fiche, sinon celle de l'outil de suivi historique. */
import { describe, expect, it } from 'vitest';
import { classificationEcart } from '../src/pilotage.js';

describe('classificationEcart', () => {
  it('reprend la classification posée sur la fiche', () => {
    expect(classificationEcart({ classification: 'majeure' })).toBe('majeure');
    expect(classificationEcart({ classification: 'point_sensible', type: 'NC maj' })).toBe('point_sensible');
  });
  it('reprend la classification historique (NC maj, NC min, PS)', () => {
    expect(classificationEcart({ type: 'NC maj' })).toBe('majeure');
    expect(classificationEcart({ type: 'NC min' })).toBe('mineure');
    expect(classificationEcart({ type: 'PS' })).toBe('point_sensible');
  });
  it('n’invente rien : absente ou inconnue, la classification est nulle', () => {
    expect(classificationEcart({})).toBeNull();
    expect(classificationEcart({ classification: '' })).toBeNull();
    expect(classificationEcart({ type: 'Obs' })).toBeNull();
    expect(classificationEcart({ classification: 'grave' })).toBeNull();
  });
});
