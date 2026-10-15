/* Aide à la préparation de l'audit : preuves types et questions, repris tels quels de l'outil de suivi historique. */
import { describe, expect, it } from 'vitest';
import { GUIDE_AUDIT, guideDe } from '../src/audit/index.js';

describe('guide de préparation', () => {
  it('reprend les 111 entrées de l’outil historique, chacune avec preuves et questions', () => {
    expect(Object.keys(GUIDE_AUDIT)).toHaveLength(111);
    for (const g of Object.values(GUIDE_AUDIT)) {
      expect(g.preuves.length).toBeGreaterThan(0);
      expect(g.questions.length).toBeGreaterThan(0);
    }
  });
  it('mesure de l’Annexe A : entrée « A.<numéro> »', () => {
    expect(guideDe({ ref: 'A', num: '5.1' })).toBe(GUIDE_AUDIT['A.5.1']);
  });
  it('clause ISO : remonte à la clause parente', () => {
    expect(guideDe({ ref: 'ISO', num: '5.2.1' })).toBe(GUIDE_AUDIT['5.2'] ?? GUIDE_AUDIT['5']);
    expect(guideDe({ ref: 'ISO', num: '9' })).toBe(GUIDE_AUDIT['9']);
  });
  it('aucune aide pour une exigence HDS ou inconnue', () => {
    expect(guideDe({ ref: 'HDS', num: '01' })).toBeNull();
    expect(guideDe({ ref: 'A', num: '99.99' })).toBeNull();
  });
});
