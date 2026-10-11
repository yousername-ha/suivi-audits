import { describe, expect, it } from 'vitest';
import { EnvironmentDefinition, calculateRisk, environmentDefaults } from '../src/environment.js';

describe('configuration des échelles et matrices', () => {
  const scenario = { impact: 'impact_5', probability: 'probability_4', maturity: 'maturity_1' };
  it('produit, plafond, réduction et seuil inclus donnent un calcul explicite', () => {
    const definition = environmentDefaults();
    expect(EnvironmentDefinition.parse(definition)).toEqual(definition);
    expect(calculateRisk(definition, scenario)).toMatchObject({
      initial: 20,
      residual: 16,
      reduction: 20,
      criticality: { id: 'critical' },
    });
    expect(
      calculateRisk({ ...definition, calculation: { method: 'sum', ceiling: 25, cells: [] } }, scenario),
    ).toMatchObject({ initial: 9, residual: 7.2, criticality: { id: 'moderate' } });
    expect(calculateRisk(definition, { ...scenario, maturity: 'maturity_5' }).residual).toBe(0);
  });
  it('classe sur la valeur arrondie affichée et applique le plafond avant réduction', () => {
    const d = environmentDefaults();
    d.maturity[1]!.reduction = 33;
    d.criticality[3]!.minimum = 13.4;
    expect(calculateRisk(d, scenario).criticality.id).toBe('critical');
    d.calculation.ceiling = 20;
    expect(calculateRisk(d, { ...scenario, probability: 'probability_5' })).toMatchObject({
      initial: 20,
      residual: 13.4,
    });
  });
  it('une matrice explicite doit couvrir exactement tous les couples', () => {
    const d = environmentDefaults();
    d.calculation.method = 'matrix';
    d.calculation.cells = d.impact.flatMap((i) =>
      d.probability.map((p) => ({ impact: i.id, probability: p.id, score: 7 })),
    );
    expect(calculateRisk(d, scenario)).toMatchObject({ initial: 7, residual: 5.6 });
    const complete = structuredClone(d);
    d.calculation.cells.pop();
    expect(EnvironmentDefinition.safeParse(d).success).toBe(false);
    d.calculation.cells.push(d.calculation.cells[0]!);
    expect(EnvironmentDefinition.safeParse(d).success).toBe(false);
    complete.calculation.cells[0]!.impact = 'unknown';
    expect(EnvironmentDefinition.safeParse(complete).success).toBe(false);
  });
  it('refuse les identifiants dupliqués, les valeurs non ordonnées et les seuils incohérents', () => {
    for (const modify of [
      (d: EnvironmentDefinition) => {
        d.impact[1]!.id = d.impact[0]!.id;
      },
      (d: EnvironmentDefinition) => {
        d.probability[1]!.value = 0;
      },
      (d: EnvironmentDefinition) => {
        d.maturity[2]!.reduction = 0;
      },
      (d: EnvironmentDefinition) => {
        d.criticality[0]!.minimum = 1;
      },
      (d: EnvironmentDefinition) => {
        d.criticality[2]!.minimum = 4;
      },
      (d: EnvironmentDefinition) => {
        d.calculation.ceiling = 9;
      },
    ]) {
      const d = environmentDefaults();
      modify(d);
      expect(EnvironmentDefinition.safeParse(d).success).toBe(false);
    }
  });
  it('refuse code arbitraire, champs inconnus, nombres non finis et données d’une autre échelle', () => {
    const d = environmentDefaults();
    expect(
      EnvironmentDefinition.safeParse({
        ...d,
        calculation: { ...d.calculation, method: 'eval', expression: 'process.exit()' },
      }).success,
    ).toBe(false);
    expect(EnvironmentDefinition.safeParse({ ...d, script: 'alert(1)' }).success).toBe(false);
    expect(
      EnvironmentDefinition.safeParse({ ...d, calculation: { ...d.calculation, ceiling: Infinity } }).success,
    ).toBe(false);
    expect(() => calculateRisk(d, { ...scenario, impact: 'other' })).toThrow(/cette version/);
  });
  it('un calcul ne modifie jamais la définition ni le scénario de départ', () => {
    const d = environmentDefaults(),
      before = structuredClone(d),
      input = structuredClone(scenario);
    calculateRisk(d, input);
    expect(d).toEqual(before);
    expect(input).toEqual(scenario);
  });
});
