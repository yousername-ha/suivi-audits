import { describe, expect, it } from 'vitest';
import {
  aggregateMapped,
  appliesToFamily,
  cfgCompatible,
  cfgRefs,
  cfgTemplates,
  diffScales,
  evaluateMatrix,
  instantiateTemplateDefinition,
  mapLevel,
  orphanLevels,
  parseCfgDefinition,
  scaleToMethodLevels,
  validateMapping,
  validateMatrix,
  type CfgDefinition,
  type MappingDefinition,
  type MatrixDefinition,
  type ScaleDefinition,
} from '../src/index.js';

const ID = '11111111-1111-4111-8111-111111111111';
const scaleOf = (input: unknown) => {
  const r = parseCfgDefinition('scale', input);
  if (!r.ok) throw new Error(r.errors.join(' ; '));
  return r.definition as ScaleDefinition;
};
const quatre = (extra: Record<string, unknown> = {}) =>
  scaleOf({
    name: 'Gravité',
    category: 'severity',
    nature: 'qualitative',
    levels: ['Mineure', 'Significative', 'Grave', 'Critique'].map((label, i) => ({ id: `g${i + 1}`, label })),
    ...extra,
  });

describe('échelles du catalogue', () => {
  it('accepte une échelle qualitative sans aucune valeur numérique, de longueur quelconque', () => {
    const trois = scaleOf({
      name: 'Motivation',
      category: 'motivation',
      nature: 'qualitative',
      levels: ['+', '++', '+++'].map((label, i) => ({ id: `n${i + 1}`, label })),
    });
    expect(trois.levels).toHaveLength(3);
    expect(trois.levels.every((l) => l.value === null && l.color === null && l.effect === null)).toBe(true);
    expect(trois.appliesTo).toBe('all');
    expect(quatre().levels).toHaveLength(4);
  });
  it('impose une valeur à chaque niveau d’une échelle quantitative et des valeurs croissantes', () => {
    const base = { name: 'Perte', category: 'impact', nature: 'quantitative', unit: 'k€' };
    expect(
      parseCfgDefinition('scale', {
        ...base,
        levels: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B', value: 5 },
        ],
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseCfgDefinition('scale', {
        ...base,
        levels: [
          { id: 'a', label: 'A', value: 10 },
          { id: 'b', label: 'B', value: 5 },
        ],
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseCfgDefinition('scale', {
        ...base,
        levels: [
          { id: 'a', label: 'A', value: 1 },
          { id: 'b', label: 'B', value: 10 },
        ],
      }),
    ).toMatchObject({ ok: true });
  });
  it('autorise une échelle hybride : valeurs seulement sur certains niveaux, croissantes', () => {
    const d = {
      name: 'Mixte',
      category: 'impact',
      nature: 'hybrid',
      levels: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', value: 3 },
        { id: 'c', label: 'C', value: 9 },
      ],
    };
    expect(parseCfgDefinition('scale', d)).toMatchObject({ ok: true });
    d.levels[2]!.value = 2;
    expect(parseCfgDefinition('scale', d)).toMatchObject({ ok: false });
  });
  it('refuse identifiants dupliqués, descripteur de dimension inconnue, champ inconnu et échelle trop courte', () => {
    const lv = (id: string) => ({ id, label: id.toUpperCase() });
    expect(
      parseCfgDefinition('scale', { name: 'X', category: 'other', nature: 'qualitative', levels: [lv('a'), lv('a')] }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      parseCfgDefinition('scale', {
        name: 'X',
        category: 'other',
        nature: 'qualitative',
        dimensions: [{ id: 'orga', label: 'Organisation' }],
        levels: [lv('a'), { ...lv('b'), criteria: { inconnue: 'texte' } }],
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseCfgDefinition('scale', { name: 'X', category: 'other', nature: 'qualitative', levels: [lv('a')] }),
    ).toMatchObject({ ok: false });
    expect(
      parseCfgDefinition('scale', {
        name: 'X',
        category: 'other',
        nature: 'qualitative',
        levels: [lv('a'), lv('b')],
        extra: 1,
      }),
    ).toMatchObject({ ok: false });
  });
  it('porte une grille de descripteurs par dimension (ex. catégorie d’impact)', () => {
    const s = scaleOf({
      name: 'Niveau d’impact',
      category: 'impact',
      nature: 'qualitative',
      dimensions: [
        { id: 'orga', label: 'Missions et services', short: 'Organisation' },
        { id: 'humain', label: 'Sécurité des personnes', short: 'Humain' },
      ],
      levels: [
        { id: 'n1', label: 'Mineur', criteria: { orga: 'Sans difficulté', humain: 'Aucune blessure' } },
        { id: 'n2', label: 'Significatif', criteria: { orga: 'Quelques difficultés' } },
      ],
    });
    expect(s.levels[0]!.criteria.humain).toBe('Aucune blessure');
  });
  it('convertit une échelle en niveaux de méthode : le rang remplace une valeur absente', () => {
    expect(scaleToMethodLevels(quatre()).map((l) => l.value)).toEqual([1, 2, 3, 4]);
    const s = scaleOf({
      name: 'Montants',
      category: 'impact',
      nature: 'hybrid',
      levels: [
        { id: 'a', label: 'A', value: 100 },
        { id: 'b', label: 'B', value: 5000 },
      ],
    });
    expect(scaleToMethodLevels(s).map((l) => l.value)).toEqual([100, 5000]);
  });
});

/* Matrice de pertinence : tableau de la demande de refonte (ressources en lignes, motivation en colonnes). */
describe('matrice de niveau de pertinence', () => {
  const tpl = cfgTemplates().find((t) => t.id === 'ebios-pertinence-sr-ov')!;
  const byRef = Object.fromEntries(tpl.items.map((i) => [i.ref, i]));
  // Adoption simulée : chaque élément du lot reçoit un identifiant.
  const ids = Object.fromEntries(
    tpl.items.map((i, n) => [i.ref, `00000000-0000-4000-8000-00000000000${n + 1}`]),
  ) as Record<string, string>;
  const instantiate = (ref: string) =>
    instantiateTemplateDefinition(byRef[ref]!.definition, (r) => ({ item: ids[r]!, version: 1 }));
  const scale = (ref: string) => scaleOf(instantiate(ref));
  const matrix = parseCfgDefinition('matrix', instantiate('matrice'));
  it('le modèle est valide, limité à EBIOS RM, et ses trois échelles ont trois niveaux', () => {
    expect(matrix.ok).toBe(true);
    for (const ref of ['motivation', 'ressources', 'pertinence']) {
      expect(scale(ref).levels).toHaveLength(3);
      expect(appliesToFamily(scale(ref).appliesTo, 'ebios_rm')).toBe(true);
      expect(appliesToFamily(scale(ref).appliesTo, 'iso27005')).toBe(false);
    }
    expect(cfgCompatible(matrix.ok ? (matrix.definition as MatrixDefinition) : { appliesTo: 'all' }, 'iso27005')).toBe(
      false,
    );
  });
  it('donne exactement les neuf résultats observés', () => {
    const m = (matrix as { ok: true; definition: MatrixDefinition }).definition;
    const result = (row: string, column: string) => evaluateMatrix(m, row, column)!.result;
    const expected = {
      n1: { n1: 'low', n2: 'low', n3: 'medium' },
      n2: { n1: 'low', n2: 'medium', n3: 'high' },
      n3: { n1: 'medium', n2: 'high', n3: 'high' },
    };
    for (const [row, cols] of Object.entries(expected))
      for (const [column, want] of Object.entries(cols)) expect(result(row, column)).toBe(want);
    expect(m.cells).toHaveLength(9);
  });
  it('est exhaustive vis-à-vis des échelles épinglées ; une cellule manquante, dupliquée ou inconnue est refusée', () => {
    const m = (matrix as { ok: true; definition: MatrixDefinition }).definition;
    const scales = { rows: scale('ressources'), columns: scale('motivation'), result: scale('pertinence') };
    expect(validateMatrix(m, scales)).toEqual([]);
    expect(validateMatrix({ ...m, cells: m.cells.slice(1) }, scales).join(' ')).toMatch(/exactement une fois/);
    expect(validateMatrix({ ...m, cells: [...m.cells, m.cells[0]!] }, scales).join(' ')).toMatch(/dupliquée/);
    expect(
      validateMatrix({ ...m, cells: [{ ...m.cells[0]!, result: 'inconnu' }, ...m.cells.slice(1)] }, scales).join(' '),
    ).toMatch(/résultat inconnu/);
    expect(
      validateMatrix({ ...m, cells: [{ ...m.cells[0]!, row: 'n9' }, ...m.cells.slice(1)] }, scales).join(' '),
    ).toMatch(/niveau inconnu/);
  });
  it('n’impose pas la symétrie : toute cellule est configurable', () => {
    const m = (matrix as { ok: true; definition: MatrixDefinition }).definition;
    const changed = {
      ...m,
      cells: m.cells.map((c) => (c.row === 'n1' && c.column === 'n3' ? { ...c, result: 'high' } : c)),
    };
    expect(evaluateMatrix(changed, 'n1', 'n3')!.result).toBe('high');
    expect(evaluateMatrix(changed, 'n3', 'n1')!.result).toBe('medium');
  });
  it('ne calcule rien sans les deux entrées', () => {
    const m = (matrix as { ok: true; definition: MatrixDefinition }).definition;
    expect(evaluateMatrix(m, null, 'n1')).toBeNull();
    expect(evaluateMatrix(m, 'n1', undefined)).toBeNull();
    expect(evaluateMatrix(m, 'n1', 'n7')).toBeNull();
  });
  it('le niveau le plus bas de la pertinence porte l’effet « écarté »', () => {
    const p = scale('pertinence');
    expect(p.levels.map((l) => l.effect)).toEqual(['excluded', 'retained', 'retained']);
  });
  it('porte un score facultatif par cellule', () => {
    const m = parseCfgDefinition('matrix', {
      name: 'Risque',
      category: 'risk',
      rows: { scale: { item: ID, version: 1 } },
      columns: { scale: { item: ID, version: 2 } },
      result: { scale: { item: ID, version: 3 } },
      cells: [{ row: 'a', column: 'b', result: 'c', score: 12 }],
    });
    expect(m.ok && (m.definition as MatrixDefinition).cells[0]!.score).toBe(12);
  });
});

describe('correspondance d’échelles et gravité proposée', () => {
  const impact = scaleOf({
    name: 'Niveau d’impact',
    category: 'impact',
    nature: 'qualitative',
    levels: ['Mineur', 'Significatif', 'Grave', 'Critique'].map((label, i) => ({ id: `i${i + 1}`, label })),
  });
  const severity = quatre();
  const parse = (input: unknown) =>
    (parseCfgDefinition('mapping', input) as { ok: true; definition: MappingDefinition }).definition;
  const mapping = (aggregation: string) =>
    parse({
      name: 'Impact → gravité',
      from: { item: ID, version: 1 },
      to: { item: ID, version: 2 },
      aggregation,
      pairs: [1, 2, 3, 4].map((n) => ({ from: `i${n}`, to: `g${n}` })),
    });
  it('valide l’exhaustivité et l’unicité des correspondances', () => {
    expect(validateMapping(mapping('max'), impact, severity)).toEqual([]);
    const partiel = { ...mapping('max'), pairs: mapping('max').pairs.slice(1) };
    expect(validateMapping(partiel, impact, severity).join(' ')).toMatch(/Chaque niveau/);
    const double = { ...mapping('max'), pairs: [...mapping('max').pairs, { from: 'i1', to: 'g2' }] };
    expect(validateMapping(double, impact, severity).join(' ')).toMatch(/deux fois/);
    const inconnu = {
      ...mapping('max'),
      pairs: mapping('max').pairs.map((p) => (p.from === 'i1' ? { ...p, to: 'zz' } : p)),
    };
    expect(validateMapping(inconnu, impact, severity).join(' ')).toMatch(/cible inconnu/);
  });
  it('gravité proposée = niveau le plus élevé des impacts retenus (règle observée dans l’export)', () => {
    const m = mapping('max');
    expect(mapLevel(m, 'i3')).toBe('g3');
    expect(aggregateMapped(m, severity, ['i4', 'i4', 'i1', 'i1'])).toBe('g4');
    expect(aggregateMapped(m, severity, ['i3', 'i2', 'i2', 'i1'])).toBe('g3');
    expect(aggregateMapped(m, severity, ['i1', 'i1', 'i1', 'i1'])).toBe('g1');
    expect(aggregateMapped(m, severity, [])).toBeNull();
    expect(aggregateMapped(m, severity, ['inconnu'])).toBeNull();
  });
  it('propose le minimum ou refuse plusieurs entrées selon l’agrégation configurée', () => {
    expect(aggregateMapped(mapping('min'), severity, ['i4', 'i2', 'i3'])).toBe('g2');
    expect(aggregateMapped(mapping('none'), severity, ['i2'])).toBe('g2');
    expect(aggregateMapped(mapping('none'), severity, ['i2', 'i3'])).toBeNull();
  });
  it('une correspondance peut relier deux échelles de longueurs différentes', () => {
    const trois = scaleOf({
      name: 'Besoin',
      category: 'security_need',
      nature: 'qualitative',
      levels: ['Négligeable', 'Limité', 'Critique'].map((label, i) => ({ id: `b${i + 1}`, label })),
    });
    const m = parse({
      name: 'Besoin → gravité',
      from: { item: ID, version: 1 },
      to: { item: ID, version: 2 },
      aggregation: 'max',
      pairs: [
        { from: 'b1', to: 'g1' },
        { from: 'b2', to: 'g2' },
        { from: 'b3', to: 'g4' },
      ],
    });
    expect(validateMapping(m, trois, severity)).toEqual([]);
    expect(aggregateMapped(m, severity, ['b1', 'b3'])).toBe('g4');
  });
});

describe('critères et taxonomies', () => {
  it('chaque critère épingle sa propre échelle', () => {
    const r = parseCfgDefinition('criteria', {
      name: 'Critères de sécurité',
      criteria: [
        { id: 'confidentialite', label: 'Confidentialité', scale: { item: ID, version: 1 } },
        { id: 'integrite', label: 'Intégrité', scale: { item: '22222222-2222-4222-8222-222222222222', version: 3 } },
      ],
    });
    expect(r.ok).toBe(true);
    expect(cfgRefs('criteria', (r as { ok: true; definition: CfgDefinition }).definition)).toHaveLength(2);
    expect(parseCfgDefinition('criteria', { name: 'X', criteria: [] })).toMatchObject({ ok: false });
  });
  it('dédoublonne les références d’une définition', () => {
    const r = parseCfgDefinition('criteria', {
      name: 'C',
      criteria: [
        { id: 'a', label: 'A', scale: { item: ID, version: 1 } },
        { id: 'b', label: 'B', scale: { item: ID, version: 1 } },
      ],
    });
    expect(cfgRefs('criteria', (r as { ok: true; definition: CfgDefinition }).definition)).toEqual([
      { item: ID, version: 1 },
    ]);
  });
  it('taxonomie hiérarchique : parent connu, pas de cycle, identifiants uniques', () => {
    const nodes = (...n: [string, string | null][]) =>
      n.map(([id, parent]) => ({ id, label: id.toUpperCase(), parent }));
    const ok = parseCfgDefinition('taxonomy', {
      name: 'Catégories de biens',
      purpose: 'asset_category',
      nodes: nodes(['systemes', null], ['materiels', 'systemes'], ['logiciels', 'systemes']),
    });
    expect(ok.ok).toBe(true);
    expect(
      parseCfgDefinition('taxonomy', { name: 'T', purpose: 'other', nodes: nodes(['a', 'inconnu']) }),
    ).toMatchObject({ ok: false });
    expect(
      parseCfgDefinition('taxonomy', { name: 'T', purpose: 'other', nodes: nodes(['a', 'b'], ['b', 'a']) }),
    ).toMatchObject({ ok: false });
    expect(
      parseCfgDefinition('taxonomy', { name: 'T', purpose: 'other', nodes: nodes(['a', null], ['a', null]) }),
    ).toMatchObject({ ok: false });
  });
});

describe('étude d’impact entre deux versions d’une échelle', () => {
  const v1 = quatre();
  it('ne signale rien pour une définition identique', () => {
    expect(diffScales(v1, v1)).toMatchObject({
      added: [],
      removed: [],
      renamed: [],
      valueChanged: [],
      reordered: false,
      breaking: false,
    });
  });
  it('un libellé renommé ou un niveau ajouté n’est pas bloquant', () => {
    const v2 = quatre({
      levels: [
        ...v1.levels.map((l) => (l.id === 'g2' ? { ...l, label: 'Notable' } : l)),
        { id: 'g5', label: 'Catastrophique' },
      ],
    });
    const d = diffScales(v1, v2);
    expect(d.added).toEqual(['g5']);
    expect(d.renamed).toEqual([{ id: 'g2', from: 'Significative', to: 'Notable' }]);
    expect(d.breaking).toBe(false);
  });
  it('un niveau supprimé, un ordre changé ou une valeur modifiée sont bloquants', () => {
    const sans = quatre({ levels: v1.levels.filter((l) => l.id !== 'g3') });
    expect(diffScales(v1, sans)).toMatchObject({ removed: ['g3'], breaking: true });
    const permute = quatre({ levels: [v1.levels[1]!, v1.levels[0]!, ...v1.levels.slice(2)] });
    expect(diffScales(v1, permute)).toMatchObject({ reordered: true, breaking: true });
    const valeurs = quatre({ levels: v1.levels.map((l, i) => ({ ...l, value: (i + 1) * 10 })) });
    expect(diffScales(v1, valeurs).valueChanged).toHaveLength(4);
    expect(diffScales(v1, valeurs).breaking).toBe(true);
  });
  it('repère les niveaux utilisés qui n’existent plus', () => {
    const sans = quatre({ levels: v1.levels.filter((l) => l.id !== 'g3') });
    expect(orphanLevels(['g1', 'g3', 'g3', 'g4'], sans)).toEqual(['g3']);
    expect(orphanLevels(['g1'], sans)).toEqual([]);
  });
});

describe('modèles proposés', () => {
  it('tous les éléments des modèles sont valides, et leurs références désignent des éléments du même lot', () => {
    for (const t of cfgTemplates()) {
      const refs = new Set(t.items.map((i) => i.ref));
      const ids = Object.fromEntries(t.items.map((i, n) => [i.ref, `00000000-0000-4000-8000-00000000000${n + 1}`]));
      const known = new Set(Object.values(ids));
      expect(t.note).toMatch(/valider/);
      for (const i of t.items) {
        // Les références locales désignent des éléments du même lot, jamais un identifiant extérieur.
        const walk = JSON.stringify(i.definition).match(/"item":"([^"]+)"/g) ?? [];
        for (const m of walk) expect(refs.has(m.slice(8, -1)), `${i.ref} → ${m}`).toBe(true);
        const def = instantiateTemplateDefinition(i.definition, (r) => ({ item: ids[r]!, version: 1 }));
        const r = parseCfgDefinition(i.kind, def);
        expect(r, `${t.id}/${i.ref}`).toMatchObject({ ok: true });
        if (r.ok) for (const ref of cfgRefs(i.kind, r.definition)) expect(known.has(ref.item)).toBe(true);
      }
    }
  });
});
