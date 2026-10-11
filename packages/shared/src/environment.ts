/* B2 : définitions immuables, règles fermées et calcul déterministe ; aucun code utilisateur. */
import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/);
const label = z.string().trim().min(1).max(100);
const level = z.object({ id, label, value: z.number().int().min(0).max(10) }).strict();
const scale = z.array(level).min(2).max(10);
export const EnvironmentDefinition = z
  .object({
    name: label,
    impact: scale,
    probability: scale,
    maturity: z
      .array(z.object({ id, label, reduction: z.number().int().min(0).max(100) }).strict())
      .min(2)
      .max(10),
    criticality: z
      .array(
        z
          .object({
            id,
            label,
            minimum: z.number().min(0).max(100),
            tone: z.enum(['neutral', 'low', 'medium', 'high']),
          })
          .strict(),
      )
      .min(2)
      .max(10),
    calculation: z
      .object({
        method: z.enum(['product', 'sum', 'matrix']),
        ceiling: z.number().min(1).max(100),
        cells: z.array(z.object({ impact: id, probability: id, score: z.number().min(0).max(100) }).strict()).max(100),
      })
      .strict(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    for (const key of ['impact', 'probability', 'maturity', 'criticality'] as const) {
      const ids = d[key].map((x) => x.id);
      if (new Set(ids).size !== ids.length) issue([key], 'Les identifiants doivent être uniques dans chaque échelle.');
    }
    for (const key of ['impact', 'probability'] as const) {
      if (d[key].some((l, i) => i > 0 && l.value <= d[key][i - 1]!.value))
        issue([key], 'Les valeurs doivent être strictement croissantes.');
    }
    if (d.maturity.some((l, i) => i > 0 && l.reduction < d.maturity[i - 1]!.reduction))
      issue(['maturity'], 'La réduction ne doit pas diminuer avec la maturité.');
    if (
      d.criticality[0]!.minimum !== 0 ||
      d.criticality.some(
        (l, i) => l.minimum > d.calculation.ceiling || (i > 0 && l.minimum <= d.criticality[i - 1]!.minimum),
      )
    )
      issue(
        ['criticality'],
        'Les seuils commencent à zéro, sont strictement croissants et ne dépassent pas le plafond.',
      );
    if (d.calculation.method !== 'matrix') {
      if (d.calculation.cells.length)
        issue(['calculation', 'cells'], 'Les cellules sont réservées à la règle matrice.');
      return;
    }
    const pairs = new Set<string>();
    for (const [i, c] of d.calculation.cells.entries()) {
      const pair = `${c.impact}/${c.probability}`;
      if (
        !d.impact.some((l) => l.id === c.impact) ||
        !d.probability.some((l) => l.id === c.probability) ||
        pairs.has(pair) ||
        c.score > d.calculation.ceiling
      )
        issue(['calculation', 'cells', i], 'Cellule inconnue, dupliquée ou supérieure au plafond.');
      pairs.add(pair);
    }
    if (pairs.size !== d.impact.length * d.probability.length)
      issue(['calculation', 'cells'], 'La matrice doit couvrir chaque couple impact/probabilité exactement une fois.');
  });
export type EnvironmentDefinition = z.infer<typeof EnvironmentDefinition>;
export const RiskExample = z.object({ impact: id, probability: id, maturity: id }).strict();
export type RiskExample = z.infer<typeof RiskExample>;
export const EnvironmentVersion = z.object({
  version: z.number().int().positive(),
  definition: EnvironmentDefinition,
  reason: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
});
export type EnvironmentVersion = z.infer<typeof EnvironmentVersion>;

/** Proposition pour de nouveaux usages uniquement ; aucune norme ni remplacement de la méthode IA historique. */
export function environmentDefaults(): EnvironmentDefinition {
  return {
    name: 'Matrice organisationnelle',
    impact: ['Très faible', 'Faible', 'Modéré', 'Élevé', 'Très élevé'].map((label, i) => ({
      id: `impact_${i + 1}`,
      label,
      value: i + 1,
    })),
    probability: ['Rare', 'Peu probable', 'Possible', 'Probable', 'Très probable'].map((label, i) => ({
      id: `probability_${i + 1}`,
      label,
      value: i + 1,
    })),
    maturity: [
      'Absent',
      'Ad hoc',
      'Défini partiellement',
      'Déployé et documenté',
      'Mesuré et contrôlé',
      'Optimisé',
    ].map((label, i) => ({ id: `maturity_${i}`, label, reduction: i * 20 })),
    criticality: [
      { id: 'low', label: 'Faible', minimum: 0, tone: 'neutral' },
      { id: 'moderate', label: 'Modéré', minimum: 5, tone: 'low' },
      { id: 'elevated', label: 'Élevé', minimum: 10, tone: 'medium' },
      { id: 'critical', label: 'Critique', minimum: 16, tone: 'high' },
    ],
    calculation: { method: 'product', ceiling: 25, cells: [] },
  };
}

/** Arrondi final au dixième ; classement sur le résultat affiché. Les identifiants d’une autre version sont refusés. */
export function calculateRisk(definition: EnvironmentDefinition, input: RiskExample) {
  const d = EnvironmentDefinition.parse(definition),
    e = RiskExample.parse(input);
  const impact = d.impact.find((l) => l.id === e.impact),
    probability = d.probability.find((l) => l.id === e.probability),
    maturity = d.maturity.find((l) => l.id === e.maturity);
  if (!impact || !probability || !maturity) throw new Error('Le scénario doit utiliser les niveaux de cette version.');
  const raw =
    d.calculation.method === 'product'
      ? impact.value * probability.value
      : d.calculation.method === 'sum'
        ? impact.value + probability.value
        : d.calculation.cells.find((c) => c.impact === impact.id && c.probability === probability.id)!.score;
  const initial = Math.min(raw, d.calculation.ceiling);
  const residual = Math.round(initial * (1 - maturity.reduction / 100) * 10) / 10;
  const criticality = [...d.criticality].reverse().find((l) => residual >= l.minimum)!;
  return { initial, residual, criticality, reduction: maturity.reduction };
}
