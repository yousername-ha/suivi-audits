/* Résolution des épinglages d'une méthode de risque sur le catalogue de configuration (ADR 0038) : fonctions pures.
   Le résultat est une définition de méthode intégrée, que le moteur d'évaluation existant exploite sans modification. */
import type { CfgRef, MatrixDefinition, ScaleDefinition } from './config-grc.js';
import { scaleToMethodLevels } from './config-grc.js';
import { RiskMethod, type MethodBindings } from './risk-methods.js';

const keyOf = (r: CfgRef) => r.item + '@' + r.version;

/** Références distinctes épinglées par une méthode. */
export function methodBindingRefs(b: MethodBindings | undefined): CfgRef[] {
  if (!b) return [];
  const refs = [
    ...Object.values(b.dimensions),
    ...(b.likelihood ? [b.likelihood] : []),
    ...(b.levels ? [b.levels] : []),
    ...(b.matrix ? [b.matrix.ref] : []),
  ];
  const seen = new Set<string>();
  return refs.filter((r) => !seen.has(keyOf(r)) && !!seen.add(keyOf(r)));
}

export interface BoundItems {
  scales: ReadonlyMap<string, ScaleDefinition>;
  matrices: ReadonlyMap<string, MatrixDefinition>;
}

/** Applique les épinglages à une méthode : niveaux des dimensions, vraisemblance, niveaux de risque et matrice de calcul.
    Renvoie la méthode intégrée (épinglages conservés, à titre de provenance) ou la liste des erreurs. */
export function resolveMethodBindings(
  method: RiskMethod,
  items: BoundItems,
): { ok: true; definition: RiskMethod } | { ok: false; errors: string[] } {
  const b = method.bindings;
  if (!b) return { ok: true, definition: method };
  const errors: string[] = [];
  const scale = (r: CfgRef, what: string) => {
    const s = items.scales.get(keyOf(r));
    if (!s) errors.push(`${what} : échelle épinglée introuvable.`);
    return s;
  };
  const next: RiskMethod = structuredClone(method);
  for (const [dim, ref] of Object.entries(b.dimensions)) {
    const target = next.dimensions.find((d) => d.id === dim);
    if (!target) {
      errors.push(`Dimension « ${dim} » inconnue de la méthode.`);
      continue;
    }
    const s = scale(ref, `Dimension « ${dim} »`);
    if (s) target.levels = scaleToMethodLevels(s);
  }
  if (b.likelihood) {
    const s = scale(b.likelihood, 'Vraisemblance');
    if (s) next.likelihood = scaleToMethodLevels(s);
  }
  if (b.levels) {
    const s = scale(b.levels, 'Niveaux de risque');
    if (s) {
      const incomplete = s.levels.filter((l) => !l.color || !l.acceptability).map((l) => l.id);
      if (incomplete.length)
        errors.push(
          `Niveaux de risque : une couleur et une acceptabilité sont requises à chaque niveau (manquantes : ${incomplete.join(', ')}).`,
        );
      else
        next.levels = s.levels.map((l) => ({
          id: l.id,
          label: l.label,
          color: l.color!,
          acceptability: l.acceptability!,
        }));
    }
  }
  if (b.matrix) {
    const m = items.matrices.get(keyOf(b.matrix.ref));
    const dimRef = b.dimensions[b.matrix.dimension];
    if (!m) errors.push('Matrice épinglée introuvable.');
    else if (!dimRef || !b.likelihood || !b.levels)
      errors.push('Une matrice exige l’épinglage de sa dimension, de la vraisemblance et des niveaux de risque.');
    else {
      if (keyOf(m.rows.scale) !== keyOf(dimRef))
        errors.push('Les lignes de la matrice ne correspondent pas à l’échelle de la dimension épinglée.');
      if (keyOf(m.columns.scale) !== keyOf(b.likelihood))
        errors.push('Les colonnes de la matrice ne correspondent pas à l’échelle de vraisemblance épinglée.');
      if (keyOf(m.result.scale) !== keyOf(b.levels))
        errors.push('Le résultat de la matrice ne correspond pas à l’échelle des niveaux de risque épinglée.');
      next.calculation = {
        kind: 'matrix',
        dimension: b.matrix.dimension,
        cells: m.cells.map((c) => ({ impact: c.row, likelihood: c.column, level: c.result, score: c.score })),
      };
    }
  }
  if (errors.length) return { ok: false, errors };
  const parsed = RiskMethod.safeParse(next);
  if (!parsed.success)
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'méthode'} : ${i.message}`) };
  return { ok: true, definition: parsed.data };
}
