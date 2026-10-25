/* Écart entre le niveau enregistré et la matrice courante (décision 6 du 25/10/2026) : signalé, jamais recalculé. */
import { describe, expect, it } from 'vitest';
import { ecartMatriceCourante, evaluateMethod, methodTemplate, type RiskMethod } from '../src/risk-methods.js';

const v1 = methodTemplate('ebios_rm');
const cotation = (likelihood: string, impact: string) => ({
  dimensions: { severity: impact },
  likelihood,
  level: null,
  inputs: {},
});
const ratings = { gross: cotation('likelihood_3', 'impact_4'), residual: cotation('likelihood_1', 'impact_1') };
const enregistre = {
  gross: evaluateMethod(v1, ratings.gross),
  residual: evaluateMethod(v1, ratings.residual),
};
/** Version suivante dont la matrice change le niveau de la case résiduelle (faible → moyen). */
const v2 = (): RiskMethod => {
  const m = structuredClone(v1);
  if (m.calculation.kind !== 'matrix') throw new Error('matrice attendue');
  for (const c of m.calculation.cells)
    if (c.impact === 'impact_1' && c.likelihood === 'likelihood_1') c.level = 'medium';
  return m;
};

describe('écart avec la matrice courante', () => {
  it('ne signale rien quand le risque est apprécié avec la version courante', () => {
    expect(
      ecartMatriceCourante({
        result: enregistre,
        ratings,
        versionEnregistree: 1,
        courante: { version: 1, definition: v1 },
      }),
    ).toBeNull();
  });
  it('ne signale rien quand la nouvelle version donne les mêmes niveaux', () => {
    expect(
      ecartMatriceCourante({
        result: enregistre,
        ratings,
        versionEnregistree: 1,
        courante: { version: 2, definition: structuredClone(v1) },
      }),
    ).toBeNull();
  });
  it('signale l’écart avec les deux niveaux, sans modifier l’enregistré', () => {
    const e = ecartMatriceCourante({
      result: enregistre,
      ratings,
      versionEnregistree: 1,
      courante: { version: 2, definition: v2() },
    });
    expect(e).toMatchObject({ etat: 'ecart', versionEnregistree: 1, versionCourante: 2 });
    expect(e!.enregistre.residuel).toBe(enregistre.residual.label);
    expect(e!.courant!.residuel).not.toBe(enregistre.residual.label);
    expect(e!.courant!.brut).toBe(enregistre.gross.label);
    // Les données d'entrée ne sont pas touchées : le registre fait foi.
    expect(enregistre.residual.level).toBe('low');
  });
  it('dit « non comparable » quand les échelles ont changé', () => {
    const m = structuredClone(v1);
    m.likelihood = m.likelihood.map((l) => ({ ...l, id: 'autre_' + l.id }));
    if (m.calculation.kind === 'matrix')
      m.calculation.cells = m.calculation.cells.map((c) => ({ ...c, likelihood: 'autre_' + c.likelihood }));
    const e = ecartMatriceCourante({
      result: enregistre,
      ratings,
      versionEnregistree: 1,
      courante: { version: 2, definition: m },
    });
    expect(e).toMatchObject({ etat: 'non_comparable', courant: null });
  });
  it('dit « non comparable » quand les cotations enregistrées sont illisibles', () => {
    expect(
      ecartMatriceCourante({
        result: enregistre,
        ratings: { n: 'importe quoi' },
        versionEnregistree: 1,
        courante: { version: 2, definition: v2() },
      }),
    ).toMatchObject({ etat: 'non_comparable' });
  });
});
