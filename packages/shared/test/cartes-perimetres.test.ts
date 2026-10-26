import { describe, expect, it } from 'vitest';
import { agregerCouvertures, type CouvertureReferentiel } from '../src/cartes-perimetres.js';

const fw = (
  id: string,
  version: number,
  nom: string,
  v: Partial<CouvertureReferentiel> = {},
): CouvertureReferentiel => ({
  referentielId: id,
  identifiant: id.toUpperCase(),
  nom,
  version,
  perimetres: 1,
  exigences: 10,
  applicables: 8,
  testees: 3,
  aDeterminer: 2,
  obligatoiresNonConformes: 1,
  ...v,
});

describe('agregerCouvertures', () => {
  it('ne renvoie rien (indisponible, jamais zéro) quand aucun périmètre n’a de référentiel effectif', () => {
    expect(agregerCouvertures([])).toBeNull();
    expect(agregerCouvertures([[], []], 2)).toBeNull();
  });

  it('un seul périmètre : ses propres chiffres, un périmètre compté, la provenance est conservée', () => {
    const c = agregerCouvertures([[fw('a', 1, 'Alpha', { provenance: 'herite', origine: 'Parent' })]])!;
    expect(c).toMatchObject({
      referentiels: 1,
      exigences: 10,
      applicables: 8,
      testees: 3,
      aDeterminer: 2,
      obligatoiresNonConformes: 1,
      perimetres: 1,
      nonLus: 0,
    });
    expect(c.parReferentiel[0]).toMatchObject({ provenance: 'herite', origine: 'Parent' });
  });

  it('somme par référentiel et version : une exigence compte une fois par périmètre où elle est évaluée', () => {
    const c = agregerCouvertures([
      [
        fw('a', 1, 'Alpha'),
        fw('b', 1, 'Bêta', { exigences: 4, applicables: 4, testees: 4, aDeterminer: 0, obligatoiresNonConformes: 0 }),
      ],
      [fw('a', 1, 'Alpha', { testees: 5, aDeterminer: 0 })],
      [],
    ])!;
    expect(c.perimetres).toBe(2); // le périmètre sans référentiel ne compte pas
    expect(c.referentiels).toBe(2);
    expect(c.exigences).toBe(24);
    expect(c.applicables).toBe(20);
    expect(c.testees).toBe(12);
    expect(c.aDeterminer).toBe(2);
    expect(c.obligatoiresNonConformes).toBe(2);
    const alpha = c.parReferentiel.find((f) => f.referentielId === 'a')!;
    expect(alpha).toMatchObject({ perimetres: 2, exigences: 20, testees: 8 });
    expect(alpha).not.toHaveProperty('provenance'); // plusieurs périmètres : plus de provenance unique
    // La somme du détail est celle du total.
    expect(c.parReferentiel.reduce((t, f) => t + f.exigences, 0)).toBe(c.exigences);
    expect(c.parReferentiel.reduce((t, f) => t + f.testees, 0)).toBe(c.testees);
  });

  it('deux versions d’un même référentiel restent distinctes', () => {
    const c = agregerCouvertures([[fw('a', 1, 'Alpha')], [fw('a', 2, 'Alpha')]])!;
    expect(c.referentiels).toBe(2);
    expect(c.parReferentiel.map((f) => f.version)).toEqual([1, 2]);
  });

  it('signale les périmètres non lus sans les compter comme des zéros', () => {
    const c = agregerCouvertures([[fw('a', 1, 'Alpha')]], 3)!;
    expect(c).toMatchObject({ perimetres: 1, nonLus: 3, exigences: 10 });
  });

  it('ne modifie pas ses entrées', () => {
    const entree = fw('a', 1, 'Alpha');
    agregerCouvertures([[entree], [entree]]);
    expect(entree.exigences).toBe(10);
    expect(entree.perimetres).toBe(1);
  });
});
