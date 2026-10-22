import { afterEach, describe, expect, it } from 'vitest';
import { definirFamilles, familles, familyByKey, familyOf, presetsDe } from '../src/carto/index.js';

afterEach(() => definirFamilles([]));

describe('familles de processus pilotées par le registre', () => {
  it('par défaut : les trois familles historiques et « Autres »', () => {
    expect(familles().map((f) => f.k)).toEqual(['pil', 'rea', 'sup', 'oth']);
    expect(familyOf('Management').k).toBe('pil');
    expect(presetsDe('process').map((p) => p.k)).toEqual(['all', 'pil', 'rea', 'sup']);
  });

  it('un type ajouté devient une bande et un préréglage, les types d’origine gardent leur clé', () => {
    definirFamilles([
      { code: 'Management', label: 'Pilotage', tint: 'vert' },
      { code: 'Réalisation', label: 'Réalisation', tint: 'bleu' },
      { code: 'Support', label: 'Support', tint: 'violet' },
      { code: 'Conformite', label: 'Conformité', tint: 'orange' },
    ] as never);
    const cles = familles().map((f) => f.k);
    expect(cles.slice(0, 3)).toEqual(['pil', 'rea', 'sup']);
    expect(cles).toHaveLength(5);
    const nouveau = familles().find((f) => f.court === 'Conformité')!;
    expect(nouveau.tint).toBe('orange');
    expect(familyByKey(nouveau.k).family).toBe('Conformite');
    expect(presetsDe('process').map((p) => p.l)).toContain('Conformité');
  });
});
