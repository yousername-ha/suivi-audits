import { describe, expect, it } from 'vitest';
import {
  evaluateMethod,
  methodBindingRefs,
  methodTemplate,
  parseCfgDefinition,
  resolveMethodBindings,
  RiskMethod,
  type CfgRef,
  type MatrixDefinition,
  type ScaleDefinition,
} from '../src/index.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number): CfgRef => ({ item: uuid(n), version: 1 });
const key = (n: number) => `${uuid(n)}@1`;
const scaleOf = (input: unknown) => {
  const r = parseCfgDefinition('scale', input);
  if (!r.ok) throw new Error(r.errors.join(' ; '));
  return r.definition as ScaleDefinition;
};
const impact = scaleOf({
  name: 'Impact',
  category: 'impact',
  nature: 'qualitative',
  levels: ['Faible', 'Moyen', 'Fort'].map((label, i) => ({ id: `i${i + 1}`, label })),
});
const vrais = scaleOf({
  name: 'Vraisemblance',
  category: 'likelihood',
  nature: 'qualitative',
  levels: ['Rare', 'Fréquent'].map((label, i) => ({ id: `v${i + 1}`, label })),
});
const niveaux = (complete = true) =>
  scaleOf({
    name: 'Niveaux',
    category: 'risk_level',
    nature: 'qualitative',
    levels: [
      { id: 'n1', label: 'Bas', color: '#718975', acceptability: 'acceptable' },
      { id: 'n2', label: 'Haut', ...(complete ? { color: '#A36F65', acceptability: 'unacceptable' } : {}) },
    ],
  });
const matrix = (): MatrixDefinition => {
  const r = parseCfgDefinition('matrix', {
    name: 'Matrice',
    category: 'risk',
    rows: { scale: ref(1), label: 'Impact' },
    columns: { scale: ref(2), label: 'Vraisemblance' },
    result: { scale: ref(3) },
    cells: ['i1', 'i2', 'i3'].flatMap((row) =>
      ['v1', 'v2'].map((column) => ({
        row,
        column,
        result: row === 'i3' || (row === 'i2' && column === 'v2') ? 'n2' : 'n1',
        score: null,
      })),
    ),
  });
  if (!r.ok) throw new Error(r.errors.join(' ; '));
  return r.definition as MatrixDefinition;
};
const items = (complete = true) => ({
  scales: new Map([
    [key(1), impact],
    [key(2), vrais],
    [key(3), niveaux(complete)],
  ]),
  matrices: new Map([[key(4), matrix()]]),
});
const bound = (extra: Partial<NonNullable<RiskMethod['bindings']>> = {}): RiskMethod => {
  const m = methodTemplate('custom');
  return {
    ...m,
    bindings: {
      dimensions: { [m.dimensions[0]!.id]: ref(1) },
      likelihood: ref(2),
      levels: ref(3),
      matrix: { ref: ref(4), dimension: m.dimensions[0]!.id },
      ...extra,
    },
  };
};

describe('épinglage des méthodes au catalogue', () => {
  it('liste les références distinctes épinglées', () => {
    const m = bound({ dimensions: { a: ref(1), b: ref(1) } });
    expect(methodBindingRefs(m.bindings).map((r) => r.item)).toEqual([uuid(1), uuid(2), uuid(3), uuid(4)]);
    expect(methodBindingRefs(undefined)).toEqual([]);
  });

  it('laisse intacte une méthode sans épinglage', () => {
    const m = methodTemplate('iso27005');
    const r = resolveMethodBindings(m, items());
    expect(r.ok && r.definition).toEqual(m);
  });

  it('intègre les niveaux, la vraisemblance, les niveaux de risque et la matrice, puis évalue', () => {
    const r = resolveMethodBindings(bound(), items());
    if (!r.ok) throw new Error(r.errors.join(' ; '));
    const dim = r.definition.dimensions[0]!;
    expect(dim.levels.map((l) => l.id)).toEqual(['i1', 'i2', 'i3']);
    expect(r.definition.likelihood.map((l) => l.id)).toEqual(['v1', 'v2']);
    expect(r.definition.levels.map((l) => l.id)).toEqual(['n1', 'n2']);
    expect(r.definition.calculation.kind).toBe('matrix');
    expect(r.definition.bindings).toBeDefined();
    const ev = evaluateMethod(r.definition, {
      dimensions: { [dim.id]: 'i2' },
      likelihood: 'v2',
      level: null,
      inputs: {},
    });
    expect(ev.level).toBe('n2');
    expect(ev.acceptability).toBe('unacceptable');
  });

  it('refuse un niveau de risque sans couleur ou acceptabilité, sans rien inventer', () => {
    const r = resolveMethodBindings(bound(), items(false));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('couleur et une acceptabilité');
  });

  it('refuse une référence introuvable, une dimension inconnue et une matrice incohérente', () => {
    const none = resolveMethodBindings(bound(), { scales: new Map(), matrices: new Map() });
    expect(none.ok).toBe(false);
    const inconnue = resolveMethodBindings(bound({ dimensions: { absente: ref(1) } }), items());
    expect(inconnue.ok).toBe(false);
    const croisee = resolveMethodBindings(bound({ likelihood: ref(1) }), items());
    expect(croisee.ok).toBe(false);
    if (!croisee.ok) expect(croisee.errors.join(' ')).toContain('colonnes');
    const sansNiveaux = resolveMethodBindings(bound({ levels: undefined }), items());
    expect(sansNiveaux.ok).toBe(false);
  });

  it('rejette un champ inconnu dans les épinglages', () => {
    const m = bound();
    expect(RiskMethod.safeParse({ ...m, bindings: { ...m.bindings, extra: 1 } }).success).toBe(false);
  });
});

describe('livrables et objets d’une méthode', () => {
  it('sont facultatifs, vérifiés contre les étapes et sans doublon', () => {
    const base = methodTemplate('custom');
    expect(RiskMethod.safeParse(base).success).toBe(true);
    const stage = base.stages[0]!.id;
    const ok = {
      ...base,
      objects: ['risk', 'treatment'],
      deliverables: [{ id: 'rapport', label: 'Rapport', stage, required: true }],
    };
    expect(RiskMethod.safeParse(ok).success).toBe(true);
    expect(
      RiskMethod.safeParse({ ...ok, deliverables: [{ id: 'x', label: 'X', stage: 'inconnue', required: false }] })
        .success,
    ).toBe(false);
    expect(RiskMethod.safeParse({ ...ok, objects: ['risk', 'risk'] }).success).toBe(false);
    expect(RiskMethod.safeParse({ ...ok, objects: ['type_inconnu'] }).success).toBe(false);
  });
});
