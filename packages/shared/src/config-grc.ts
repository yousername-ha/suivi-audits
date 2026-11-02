/* Catalogue de configuration GRC transversal (ADR 0038) : échelles, matrices, correspondances, critères et taxonomies,
   définis une fois, versionnés, épinglés par les méthodes et les analyses. Définitions fermées et calculs déterministes :
   aucun code ni expression libre. Les fonctions de ce fichier sont pures (aucun accès à la base). */
import { z } from 'zod';
import { GrcKey } from './grc.js';

export const CFG_KINDS = ['scale', 'matrix', 'mapping', 'criteria', 'taxonomy'] as const;
export type CfgKind = (typeof CFG_KINDS)[number];
export const CFG_KIND_LABELS: Record<CfgKind, string> = {
  scale: 'Échelle',
  matrix: 'Matrice',
  mapping: 'Correspondance',
  criteria: 'Critères',
  taxonomy: 'Taxonomie',
};
export const CFG_STATES = ['draft', 'active', 'archived'] as const;
export type CfgState = (typeof CFG_STATES)[number];
export const CFG_STATE_LABELS: Record<CfgState, string> = {
  draft: 'Brouillon',
  active: 'Active',
  archived: 'Archivée',
};
export const CFG_SCOPES = ['instance', 'smsi'] as const;
export type CfgScope = (typeof CFG_SCOPES)[number];

/** Familles de méthode d'analyse (même liste que `RiskMethod.family`). */
export const CFG_FAMILIES = ['ebios_rm', 'iso27005', 'mehari', 'custom'] as const;
export type CfgFamily = (typeof CFG_FAMILIES)[number];
export const CFG_FAMILY_LABELS: Record<CfgFamily, string> = {
  ebios_rm: 'EBIOS Risk Manager',
  iso27005: 'ISO/IEC 27005',
  mehari: 'MÉHARI',
  custom: 'Méthode personnalisée',
};

export const SCALE_CATEGORIES = [
  'impact',
  'severity',
  'likelihood',
  'criticality',
  'maturity',
  'compliance',
  'confidence',
  'motivation',
  'resources',
  'relevance',
  'exposure',
  'reliability',
  'dangerousness',
  'security_need',
  'risk_level',
  'other',
] as const;
export type ScaleCategory = (typeof SCALE_CATEGORIES)[number];
export const SCALE_CATEGORY_LABELS: Record<ScaleCategory, string> = {
  impact: 'Impact',
  severity: 'Gravité',
  likelihood: 'Vraisemblance',
  criticality: 'Criticité',
  maturity: 'Maturité',
  compliance: 'Conformité',
  confidence: 'Confiance',
  motivation: 'Motivation',
  resources: 'Ressources',
  relevance: 'Pertinence',
  exposure: 'Exposition',
  reliability: 'Fiabilité',
  dangerousness: 'Dangerosité',
  security_need: 'Besoin de sécurité',
  risk_level: 'Niveau de risque',
  other: 'Autre',
};

const label = z.string().trim().min(1).max(200);
const text = z.string().max(5000);
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const value = z.number().finite().min(-1_000_000_000).max(1_000_000_000);

/** Élément du catalogue épinglé à une version précise : une version publiée ne change jamais. */
export const CfgRef = z.object({ item: z.uuid(), version: z.number().int().min(1).max(2147483647) }).strict();
export type CfgRef = z.infer<typeof CfgRef>;

/** Méthodes auxquelles un élément convient : « all » ou une liste de familles. */
export const AppliesTo = z.union([z.literal('all'), z.array(z.enum(CFG_FAMILIES)).min(1).max(4)]).default('all');
export type AppliesTo = z.infer<typeof AppliesTo>;
export const appliesToFamily = (a: AppliesTo, family: CfgFamily) => a === 'all' || a.includes(family);

/* ---------------------------------------------------------------- Échelle */

export const ScaleLevel = z
  .object({
    id: GrcKey,
    label,
    description: text.default(''),
    /** Valeur numérique facultative : imposée seulement aux échelles quantitatives. */
    value: value.nullable().default(null),
    color: color.nullable().default(null),
    /** Effet sur la suite d'une analyse (ex. pertinence) : « écarté » signale sans supprimer. */
    effect: z.enum(['retained', 'excluded']).nullable().default(null),
    /** Acceptabilité (échelles de criticité ou de risque). */
    acceptability: z.enum(['acceptable', 'conditional', 'unacceptable']).nullable().default(null),
    /** Descripteurs du niveau par dimension de la grille (ex. catégorie d'impact). */
    criteria: z.record(GrcKey, text).default({}),
  })
  .strict();
export type ScaleLevel = z.infer<typeof ScaleLevel>;

export const ScaleDefinition = z
  .object({
    name: label,
    description: text.default(''),
    category: z.enum(SCALE_CATEGORIES),
    nature: z.enum(['qualitative', 'quantitative', 'hybrid']),
    appliesTo: AppliesTo,
    unit: z.string().trim().max(40).default(''),
    dimensions: z
      .array(z.object({ id: GrcKey, label, short: z.string().trim().max(60).default('') }).strict())
      .max(20)
      .default([]),
    levels: z.array(ScaleLevel).min(2).max(20),
    /** Règles d'utilisation de l'échelle (texte libre, consultatif). */
    usage: text.default(''),
  })
  .strict()
  .superRefine((s, c) => {
    const issue = (message: string, path: (string | number)[] = []) => c.addIssue({ code: 'custom', message, path });
    if (new Set(s.levels.map((l) => l.id)).size !== s.levels.length)
      issue('Identifiants de niveaux uniques requis.', ['levels']);
    const dims = new Set(s.dimensions.map((d) => d.id));
    if (dims.size !== s.dimensions.length) issue('Identifiants de dimensions uniques requis.', ['dimensions']);
    s.levels.forEach((l, i) => {
      if (Object.keys(l.criteria).some((k) => !dims.has(k)))
        issue('Un descripteur désigne une dimension inconnue.', ['levels', i, 'criteria']);
    });
    const values = s.levels.map((l) => l.value).filter((v): v is number => v !== null);
    if (values.some((v, i) => i > 0 && v <= values[i - 1]!))
      issue('Les valeurs renseignées doivent être strictement croissantes dans l’ordre des niveaux.', ['levels']);
    if (s.nature === 'quantitative' && values.length !== s.levels.length)
      issue('Une échelle quantitative exige une valeur numérique à chaque niveau.', ['levels']);
  });
export type ScaleDefinition = z.infer<typeof ScaleDefinition>;

/* ---------------------------------------------------------------- Matrice */

const axis = z.object({ scale: CfgRef, label: z.string().trim().max(100).default('') }).strict();
export const MATRIX_CATEGORIES = ['criticality', 'relevance', 'risk', 'exposure', 'other'] as const;
export const MATRIX_CATEGORY_LABELS: Record<(typeof MATRIX_CATEGORIES)[number], string> = {
  criticality: 'Criticité',
  relevance: 'Pertinence',
  risk: 'Risque',
  exposure: 'Exposition',
  other: 'Autre',
};
export const MatrixDefinition = z
  .object({
    name: label,
    description: text.default(''),
    category: z.enum(MATRIX_CATEGORIES),
    appliesTo: AppliesTo,
    /** Axe vertical (lignes) et axe horizontal (colonnes) ; chacun épingle une échelle. */
    rows: axis,
    columns: axis,
    /** Échelle des résultats. */
    result: z.object({ scale: CfgRef }).strict(),
    cells: z
      .array(
        z
          .object({
            row: GrcKey,
            column: GrcKey,
            result: GrcKey,
            /** Score numérique facultatif de la cellule. */
            score: value.nullable().default(null),
          })
          .strict(),
      )
      .max(400),
  })
  .strict();
export type MatrixDefinition = z.infer<typeof MatrixDefinition>;

/* ---------------------------------------------------------------- Correspondance */

export const MAPPING_AGGREGATIONS = ['max', 'min', 'none'] as const;
export const MAPPING_AGGREGATION_LABELS: Record<(typeof MAPPING_AGGREGATIONS)[number], string> = {
  max: 'Niveau le plus élevé',
  min: 'Niveau le plus bas',
  none: 'Aucune agrégation (une seule entrée)',
};
export const MappingDefinition = z
  .object({
    name: label,
    description: text.default(''),
    appliesTo: AppliesTo,
    from: CfgRef,
    to: CfgRef,
    pairs: z.array(z.object({ from: GrcKey, to: GrcKey }).strict()).max(40),
    aggregation: z.enum(MAPPING_AGGREGATIONS),
  })
  .strict();
export type MappingDefinition = z.infer<typeof MappingDefinition>;

/* ---------------------------------------------------------------- Critères */

export const CriteriaDefinition = z
  .object({
    name: label,
    description: text.default(''),
    appliesTo: AppliesTo,
    criteria: z
      .array(z.object({ id: GrcKey, label, description: text.default(''), scale: CfgRef }).strict())
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((d, c) => {
    if (new Set(d.criteria.map((x) => x.id)).size !== d.criteria.length)
      c.addIssue({ code: 'custom', message: 'Identifiants de critères uniques requis.', path: ['criteria'] });
  });
export type CriteriaDefinition = z.infer<typeof CriteriaDefinition>;

/* ---------------------------------------------------------------- Taxonomie */

export const TAXONOMY_PURPOSES = [
  'impact_category',
  'asset_category',
  'risk_source_category',
  'objective_category',
  'risk_category',
  'classification',
  'other',
] as const;
export const TAXONOMY_PURPOSE_LABELS: Record<(typeof TAXONOMY_PURPOSES)[number], string> = {
  impact_category: 'Catégories d’impact',
  asset_category: 'Catégories de biens',
  risk_source_category: 'Catégories de sources de risque',
  objective_category: 'Catégories d’objectifs visés',
  risk_category: 'Catégories de risques',
  classification: 'Classification',
  other: 'Autre',
};
export const TaxonomyDefinition = z
  .object({
    name: label,
    description: text.default(''),
    purpose: z.enum(TAXONOMY_PURPOSES),
    appliesTo: AppliesTo,
    nodes: z
      .array(
        z
          .object({
            id: GrcKey,
            label,
            short: z.string().trim().max(60).default(''),
            parent: GrcKey.nullable().default(null),
            description: text.default(''),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()
  .superRefine((t, c) => {
    const ids = new Set(t.nodes.map((n) => n.id));
    if (ids.size !== t.nodes.length)
      c.addIssue({ code: 'custom', message: 'Identifiants de catégories uniques requis.', path: ['nodes'] });
    const parent = new Map(t.nodes.map((n) => [n.id, n.parent]));
    for (const n of t.nodes) {
      if (n.parent !== null && !ids.has(n.parent))
        c.addIssue({ code: 'custom', message: 'Catégorie parente inconnue.', path: ['nodes'] });
      let cur: string | null = n.id;
      for (let i = 0; cur !== null && i <= t.nodes.length; i++) {
        cur = parent.get(cur) ?? null;
        if (cur === n.id) {
          c.addIssue({
            code: 'custom',
            message: 'Une catégorie ne peut pas être son propre ancêtre.',
            path: ['nodes'],
          });
          break;
        }
      }
    }
  });
export type TaxonomyDefinition = z.infer<typeof TaxonomyDefinition>;

export const CFG_DEFINITIONS = {
  scale: ScaleDefinition,
  matrix: MatrixDefinition,
  mapping: MappingDefinition,
  criteria: CriteriaDefinition,
  taxonomy: TaxonomyDefinition,
} as const;
export type CfgDefinition =
  ScaleDefinition | MatrixDefinition | MappingDefinition | CriteriaDefinition | TaxonomyDefinition;

/** Valide une définition selon son type ; renvoie la définition normalisée (valeurs par défaut posées). */
export function parseCfgDefinition(
  kind: CfgKind,
  input: unknown,
): { ok: true; definition: CfgDefinition } | { ok: false; errors: string[] } {
  const r = CFG_DEFINITIONS[kind].safeParse(input);
  if (r.success) return { ok: true, definition: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.') || 'définition'} : ${i.message}`) };
}

/** Libellé de l'élément (le nom est dans chaque définition). */
export const cfgName = (def: CfgDefinition) => def.name;

/** Références épinglées contenues dans une définition (dépendances de l'élément). */
export function cfgRefs(kind: CfgKind, def: CfgDefinition): CfgRef[] {
  const refs: CfgRef[] =
    kind === 'matrix'
      ? [
          (def as MatrixDefinition).rows.scale,
          (def as MatrixDefinition).columns.scale,
          (def as MatrixDefinition).result.scale,
        ]
      : kind === 'mapping'
        ? [(def as MappingDefinition).from, (def as MappingDefinition).to]
        : kind === 'criteria'
          ? (def as CriteriaDefinition).criteria.map((x) => x.scale)
          : [];
  const seen = new Set<string>();
  return refs.filter((r) => !seen.has(r.item + '@' + r.version) && !!seen.add(r.item + '@' + r.version));
}

/* ---------------------------------------------------------------- Calculs purs */

export const levelIndex = (scale: ScaleDefinition, levelId: string) => scale.levels.findIndex((l) => l.id === levelId);

/** Contrôle une matrice par rapport aux échelles épinglées : couverture exhaustive, niveaux connus, doublons. */
export function validateMatrix(
  def: MatrixDefinition,
  scales: { rows: ScaleDefinition; columns: ScaleDefinition; result: ScaleDefinition },
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const rowIds = new Set(scales.rows.levels.map((l) => l.id)),
    colIds = new Set(scales.columns.levels.map((l) => l.id)),
    resIds = new Set(scales.result.levels.map((l) => l.id));
  for (const cell of def.cells) {
    const key = cell.row + '/' + cell.column;
    if (!rowIds.has(cell.row) || !colIds.has(cell.column))
      errors.push(`Cellule ${key} : niveau inconnu de l’échelle d’un axe.`);
    else if (seen.has(key)) errors.push(`Cellule ${key} dupliquée.`);
    if (!resIds.has(cell.result)) errors.push(`Cellule ${key} : résultat inconnu de l’échelle des résultats.`);
    seen.add(key);
  }
  const expected = rowIds.size * colIds.size;
  if (seen.size !== expected)
    errors.push(`La matrice doit couvrir chaque couple exactement une fois (${expected} cellules attendues).`);
  return errors;
}

/** Résultat d'une matrice pour un couple de niveaux ; null si une entrée manque ou si la cellule n'existe pas. */
export function evaluateMatrix(
  def: MatrixDefinition,
  row: string | null | undefined,
  column: string | null | undefined,
): { result: string; score: number | null } | null {
  if (!row || !column) return null;
  const cell = def.cells.find((c) => c.row === row && c.column === column);
  return cell ? { result: cell.result, score: cell.score } : null;
}

/** Contrôle une correspondance par rapport à ses deux échelles : chaque niveau d'origine est mis en correspondance une fois. */
export function validateMapping(def: MappingDefinition, from: ScaleDefinition, to: ScaleDefinition): string[] {
  const errors: string[] = [];
  const fromIds = new Set(from.levels.map((l) => l.id)),
    toIds = new Set(to.levels.map((l) => l.id)),
    seen = new Set<string>();
  for (const p of def.pairs) {
    if (!fromIds.has(p.from)) errors.push(`Niveau d’origine inconnu : ${p.from}.`);
    else if (seen.has(p.from)) errors.push(`Niveau d’origine mis en correspondance deux fois : ${p.from}.`);
    if (!toIds.has(p.to)) errors.push(`Niveau cible inconnu : ${p.to}.`);
    seen.add(p.from);
  }
  if (seen.size !== fromIds.size) errors.push('Chaque niveau de l’échelle d’origine doit avoir une correspondance.');
  return errors;
}

/** Niveau cible d'un niveau d'origine ; null s'il n'est pas mis en correspondance. */
export const mapLevel = (def: MappingDefinition, from: string) => def.pairs.find((p) => p.from === from)?.to ?? null;

/** Niveau proposé par agrégation de plusieurs niveaux d'origine (ex. gravité proposée = maximum des impacts).
    Renvoie null si aucune entrée n'est exploitable ou si l'agrégation « none » reçoit plusieurs entrées. */
export function aggregateMapped(def: MappingDefinition, to: ScaleDefinition, inputs: readonly string[]): string | null {
  const mapped = inputs.map((i) => mapLevel(def, i)).filter((x): x is string => x !== null);
  if (!mapped.length) return null;
  if (def.aggregation === 'none') return mapped.length === 1 ? mapped[0]! : null;
  const ranks = mapped.map((m) => levelIndex(to, m)).filter((i) => i >= 0);
  if (!ranks.length) return null;
  return to.levels[def.aggregation === 'max' ? Math.max(...ranks) : Math.min(...ranks)]!.id;
}

/** Niveaux au format d'une dimension de méthode : le rang (1, 2, …) tient lieu de valeur quand l'échelle n'en porte pas. */
export function scaleToMethodLevels(scale: ScaleDefinition) {
  return scale.levels.map((l, i) => ({ id: l.id, label: l.label, value: l.value ?? i + 1 }));
}

/** Compatibilité d'un élément avec une famille de méthode. */
export const cfgCompatible = (def: { appliesTo: AppliesTo }, family: CfgFamily) =>
  appliesToFamily(def.appliesTo, family);

/* ---------------------------------------------------------------- Étude d'impact d'une nouvelle version */

export interface ScaleDiff {
  added: string[];
  removed: string[];
  renamed: { id: string; from: string; to: string }[];
  valueChanged: { id: string; from: number | null; to: number | null }[];
  reordered: boolean;
  /** Vrai si un niveau a disparu ou si l'ordre/les valeurs changent : les consommateurs doivent être revus. */
  breaking: boolean;
}

export function diffScales(before: ScaleDefinition, after: ScaleDefinition): ScaleDiff {
  const b = new Map(before.levels.map((l) => [l.id, l])),
    a = new Map(after.levels.map((l) => [l.id, l]));
  const added = [...a.keys()].filter((k) => !b.has(k)),
    removed = [...b.keys()].filter((k) => !a.has(k));
  const common = [...b.keys()].filter((k) => a.has(k));
  const renamed = common
    .filter((k) => b.get(k)!.label !== a.get(k)!.label)
    .map((id) => ({ id, from: b.get(id)!.label, to: a.get(id)!.label }));
  const valueChanged = common
    .filter((k) => b.get(k)!.value !== a.get(k)!.value)
    .map((id) => ({ id, from: b.get(id)!.value, to: a.get(id)!.value }));
  const orderBefore = common.join('|'),
    orderAfter = after.levels
      .map((l) => l.id)
      .filter((k) => b.has(k))
      .join('|');
  const reordered = orderBefore !== orderAfter;
  return {
    added,
    removed,
    renamed,
    valueChanged,
    reordered,
    breaking: removed.length > 0 || reordered || valueChanged.length > 0,
  };
}

/** Niveaux de la version précédente que l'analyse utilise encore et qui n'existent plus dans la nouvelle version. */
export const orphanLevels = (usedLevelIds: readonly string[], after: ScaleDefinition) => {
  const ids = new Set(after.levels.map((l) => l.id));
  return [...new Set(usedLevelIds)].filter((id) => !ids.has(id));
};

/* ---------------------------------------------------------------- Modèles proposés (adoptés à la demande) */

/** Un modèle est un lot d'éléments liés ; adopté, il crée des éléments ordinaires à relire et publier. Les clés locales
    (« ref ») remplacent les identifiants d'éléments tant que le lot n'est pas adopté. Aucune donnée n'est livrée par défaut. */
export interface CfgTemplateItem {
  ref: string;
  kind: CfgKind;
  key: string;
  /** Définition dont les références d'échelle sont des clés locales (`{ item: '<ref>', version: 1 }`) avant adoption. */
  definition: unknown;
}
export interface CfgTemplate {
  id: string;
  label: string;
  description: string;
  /** Provenance et réserve affichées à l'adoption : les modèles sont des propositions à valider. */
  note: string;
  /** Document public dont les libellés et la grille sont repris (absent pour une proposition de l'organisation). */
  source?: CfgTemplateSource;
  items: CfgTemplateItem[];
}
export interface CfgTemplateSource {
  organisation: string;
  document: string;
  version: string;
  url: string;
  /** Pages ou sections d'où proviennent les niveaux et la grille. */
  reference: string;
  license: string;
  /** Date de vérification du document (AAAA-MM-JJ). */
  verifiedAt: string;
}

/** Instancie la définition d'un élément de modèle : chaque référence locale `{ item: '<ref>', version }` devient la
    référence réelle `{ item: <identifiant>, version }` fournie par `idOf` (éléments créés à l'adoption). */
export function instantiateTemplateDefinition(
  definition: unknown,
  idOf: (ref: string) => { item: string; version: number },
): unknown {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (
        keys.length === 2 &&
        typeof o.item === 'string' &&
        typeof o.version === 'number' &&
        !z.uuid().safeParse(o.item).success
      )
        return idOf(o.item);
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(definition);
}

const PALETTE = { low: '#718975', medium: '#9A8B64', high: '#A36F65' };
const niveaux3 = (descriptions: [string, string, string]) =>
  (['+', '++', '+++'] as const).map((l, i) => ({
    id: `n${i + 1}`,
    label: l,
    description: descriptions[i]!,
  }));

/** Modèles proposés : matrice de pertinence SR/OV (proposition de l'organisation), puis deux lots repris de documents
    publics vérifiés : EBIOS Risk Manager (ANSSI) et MÉHARI 2010 (CLUSIF). Les libellés, descriptions et grilles sont ceux
    des documents cités (`source`) ; rien n'est complété ni extrapolé. ISO/IEC 27005 ne prescrit pas d'échelle : ses
    exemples d'annexe, payants, ne sont pas reconstruits ; les deux lots publics sont déclarés utilisables avec cette famille. */
export function cfgTemplates(): CfgTemplate[] {
  const grid: Record<string, [string, string, string]> = {
    n1: ['low', 'low', 'medium'],
    n2: ['low', 'medium', 'high'],
    n3: ['medium', 'high', 'high'],
  };
  return [
    {
      id: 'ebios-pertinence-sr-ov',
      label: 'Pertinence des couples source de risque / objectif visé (EBIOS RM)',
      description:
        'Échelles de motivation, de ressources et de pertinence (trois niveaux) et matrice ressources × motivation → pertinence.',
      note: 'Proposition établie d’après la matrice décrite par l’organisation et un export d’outil EBIOS RM : à relire et à valider avant toute utilisation. Aucune conformité à un guide n’est revendiquée.',
      items: [
        {
          ref: 'motivation',
          kind: 'scale',
          key: 'motivation_sr',
          definition: {
            name: 'Motivation de la source de risque',
            category: 'motivation',
            nature: 'qualitative',
            appliesTo: ['ebios_rm'],
            levels: niveaux3([
              'La source de risque a une faible motivation.',
              'La source de risque a une motivation moyenne.',
              'La source de risque est très motivée.',
            ]),
          },
        },
        {
          ref: 'ressources',
          kind: 'scale',
          key: 'ressources_sr',
          definition: {
            name: 'Ressources de la source de risque',
            category: 'resources',
            nature: 'qualitative',
            appliesTo: ['ebios_rm'],
            levels: niveaux3([
              'La source de risque dispose de faibles ressources (financières, matérielles et compétences).',
              'La source de risque dispose de ressources (financières, matérielles et compétences).',
              'La source de risque dispose d’importantes ressources (financières, matérielles et compétences).',
            ]),
          },
        },
        {
          ref: 'pertinence',
          kind: 'scale',
          key: 'pertinence_sr_ov',
          definition: {
            name: 'Pertinence du couple SR/OV',
            category: 'relevance',
            nature: 'qualitative',
            appliesTo: ['ebios_rm'],
            levels: [
              {
                id: 'low',
                label: 'Faible',
                description: 'Le couple SR/OV ne sera pas pris en compte pour le reste de l’étude.',
                color: PALETTE.low,
                effect: 'excluded',
              },
              {
                id: 'medium',
                label: 'Moyenne',
                description: 'Le couple SR/OV sera pris en compte pour le reste de l’étude.',
                color: PALETTE.medium,
                effect: 'retained',
              },
              {
                id: 'high',
                label: 'Élevée',
                description: 'Le couple SR/OV sera pris en compte pour le reste de l’étude.',
                color: PALETTE.high,
                effect: 'retained',
              },
            ],
          },
        },
        {
          ref: 'matrice',
          kind: 'matrix',
          key: 'matrice_pertinence_sr_ov',
          definition: {
            name: 'Niveau de pertinence (ressources × motivation)',
            category: 'relevance',
            appliesTo: ['ebios_rm'],
            rows: { scale: { item: 'ressources', version: 1 }, label: 'Ressources' },
            columns: { scale: { item: 'motivation', version: 1 }, label: 'Motivation' },
            result: { scale: { item: 'pertinence', version: 1 } },
            cells: Object.entries(grid).flatMap(([row, results]) =>
              results.map((result, i) => ({ row, column: `n${i + 1}`, result })),
            ),
          },
        },
      ],
    },
    ebiosRmRisque(),
    mehariRisque(),
  ];
}

/** Niveaux numérotés à partir de 1 (cotation des guides : G1…G4, V1…V4, niveaux 1 à 4). */
const niveauxCotes = (
  prefix: string,
  levels: { label: string; description: string; color?: string; acceptability?: string }[],
) => levels.map((l, i) => ({ id: `${prefix}${i + 1}`, value: i + 1, ...l }));

/** Cellules d'une grille donnée ligne par ligne (lignes et colonnes numérotées à partir de 1). */
const grille = (rowPrefix: string, colPrefix: string, resultPrefix: string, rows: Record<number, number[]>) =>
  Object.entries(rows).flatMap(([row, results]) =>
    results.map((r, j) => ({
      row: `${rowPrefix}${row}`,
      column: `${colPrefix}${j + 1}`,
      result: `${resultPrefix}${r}`,
    })),
  );

/** EBIOS Risk Manager, guide de l'ANSSI version 1.5 (septembre 2024), sous Licence Ouverte Etalab : échelle de gravité
    (atelier 1, p. 27), échelle de vraisemblance globale (atelier 4, p. 67), classes d'acceptation (atelier 5, p. 74) et
    cartographie du risque de l'exemple (atelier 5, p. 75). Dans la figure de la p. 75, l'axe de gravité est numéroté de
    1 en haut à 4 en bas, alors que les scénarios placés sur la ligne du haut (R4, R5) sont cotés G4 dans le texte (p. 51,
    vraisemblances V2 et V1 p. 67) et ceux de la deuxième ligne (R1 à R3) G3 (p. 50) : la grille est relue d'après ces
    cotations, ligne du haut = G4. */
function ebiosRmRisque(): CfgTemplate {
  const familles: CfgFamily[] = ['ebios_rm', 'iso27005'];
  return {
    id: 'ebios-rm-gravite-vraisemblance',
    label: 'Gravité, vraisemblance et niveau de risque (EBIOS Risk Manager, ANSSI)',
    description:
      'Échelles de gravité (G1 à G4) et de vraisemblance (V1 à V4) du guide EBIOS Risk Manager, classes d’acceptation du risque (faible, moyen, élevé) et matrice gravité × vraisemblance de la cartographie du risque du guide.',
    note: 'Libellés et descriptions repris du guide de l’ANSSI (Licence Ouverte Etalab) ; « la société » de l’exemple du guide est remplacée par « l’organisation ». Les échelles et la grille sont présentées par le guide comme l’exemple d’une société de biotechnologie : à relire, adapter à votre contexte et valider avant usage. Aucune conformité n’est revendiquée.',
    source: {
      organisation: 'ANSSI',
      document: 'EBIOS Risk Manager — Le guide (ANSSI-PA-048)',
      version: '1.5 — septembre 2024',
      url: 'https://messervices.cyber.gouv.fr/documents-guides/250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf',
      reference:
        'Atelier 1 p. 27 (gravité), atelier 4 p. 67 (vraisemblance), atelier 5 p. 74 (acceptabilité) et p. 75 (cartographie).',
      license: 'Licence Ouverte / Open Licence (Etalab — V1), mention de la source obligatoire.',
      verifiedAt: '2026-11-02',
    },
    items: [
      {
        ref: 'gravite',
        kind: 'scale',
        key: 'gravite_ebios_rm',
        definition: {
          name: 'Gravité des événements redoutés (EBIOS RM)',
          description: 'Échelle de cotation de la gravité des impacts (guide EBIOS Risk Manager, atelier 1).',
          category: 'severity',
          nature: 'qualitative',
          appliesTo: familles,
          usage:
            'La gravité de chaque événement redouté s’estime d’après ses impacts sur la valeur métier vis-à-vis des missions de l’organisation, de la réglementation, et de la nature et de l’intensité des impacts directs, voire indirects.',
          levels: niveauxCotes('g', [
            {
              label: 'G1 — Mineure',
              description:
                'Aucun impact opérationnel ni sur les performances de l’activité ni sur la sécurité des personnes et des biens. L’organisation surmontera la situation sans trop de difficultés (consommation des marges).',
            },
            {
              label: 'G2 — Significative',
              description:
                'Dégradation des performances de l’activité sans impact sur la sécurité des personnes et des biens. L’organisation surmontera la situation malgré quelques difficultés (fonctionnement en mode dégradé).',
            },
            {
              label: 'G3 — Grave',
              description:
                'Forte dégradation des performances de l’activité, avec d’éventuels impacts significatifs sur la sécurité des personnes et des biens. L’organisation surmontera la situation avec de sérieuses difficultés (fonctionnement en mode très dégradé).',
            },
            {
              label: 'G4 — Critique',
              description:
                'Incapacité pour l’organisation d’assurer tout ou partie de son activité, avec d’éventuels impacts graves sur la sécurité des personnes et des biens. L’organisation ne surmontera vraisemblablement pas la situation (sa survie est menacée).',
            },
          ]),
        },
      },
      {
        ref: 'vraisemblance',
        kind: 'scale',
        key: 'vraisemblance_ebios_rm',
        definition: {
          name: 'Vraisemblance globale d’un scénario opérationnel (EBIOS RM)',
          description:
            'Échelle de vraisemblance globale d’un scénario opérationnel (guide EBIOS Risk Manager, atelier 4).',
          category: 'likelihood',
          nature: 'qualitative',
          appliesTo: familles,
          levels: niveauxCotes('v', [
            {
              label: 'V1 — Peu vraisemblable',
              description:
                'La source de risque a peu de chance d’atteindre son objectif visé selon l’un des modes opératoires envisagés. La vraisemblance du scénario est faible.',
            },
            {
              label: 'V2 — Vraisemblable',
              description:
                'La source de risque est susceptible d’atteindre son objectif visé selon l’un des modes opératoires envisagés. La vraisemblance du scénario est significative.',
            },
            {
              label: 'V3 — Très vraisemblable',
              description:
                'La source de risque va probablement atteindre son objectif visé selon l’un des modes opératoires envisagés. La vraisemblance du scénario est élevée.',
            },
            {
              label: 'V4 — Quasi certain',
              description:
                'La source de risque va certainement atteindre son objectif visé selon l’un des modes opératoires envisagés. La vraisemblance du scénario est très élevée.',
            },
          ]),
        },
      },
      {
        ref: 'niveau',
        kind: 'scale',
        key: 'niveau_risque_ebios_rm',
        definition: {
          name: 'Niveau de risque et acceptabilité (EBIOS RM)',
          description:
            'Classes d’acceptation du risque recommandées par le guide EBIOS Risk Manager (atelier 5, stratégie de traitement du risque).',
          category: 'risk_level',
          nature: 'qualitative',
          appliesTo: familles,
          levels: [
            {
              id: 'faible',
              label: 'Faible',
              description: 'Acceptable en l’état : aucune action n’est à entreprendre.',
              color: PALETTE.low,
              acceptability: 'acceptable',
            },
            {
              id: 'moyen',
              label: 'Moyen',
              description:
                'Tolérable sous contrôle : un suivi en termes de gestion du risque est à mener et des actions sont à mettre en place dans le cadre d’une amélioration continue sur le moyen et long terme.',
              color: PALETTE.medium,
              acceptability: 'conditional',
            },
            {
              id: 'eleve',
              label: 'Élevé',
              description:
                'Inacceptable : des mesures de réduction du risque doivent impérativement être prises à court terme. Dans le cas contraire, tout ou partie de l’activité sera refusé.',
              color: PALETTE.high,
              acceptability: 'unacceptable',
            },
          ],
        },
      },
      {
        ref: 'matrice',
        kind: 'matrix',
        key: 'matrice_risque_ebios_rm',
        definition: {
          name: 'Cartographie du risque (gravité × vraisemblance, EBIOS RM)',
          description:
            'Zones de la cartographie du risque de l’exemple du guide EBIOS Risk Manager (atelier 5, p. 75) : vert = faible, orange = moyen, rouge = élevé (légende p. 74).',
          category: 'risk',
          appliesTo: familles,
          rows: { scale: { item: 'gravite', version: 1 }, label: 'Gravité' },
          columns: { scale: { item: 'vraisemblance', version: 1 }, label: 'Vraisemblance' },
          result: { scale: { item: 'niveau', version: 1 } },
          cells: Object.entries({
            1: ['faible', 'faible', 'moyen', 'moyen'],
            2: ['faible', 'faible', 'moyen', 'eleve'],
            3: ['faible', 'moyen', 'eleve', 'eleve'],
            4: ['moyen', 'moyen', 'eleve', 'eleve'],
          }).flatMap(([g, results]) => results.map((result, j) => ({ row: `g${g}`, column: `v${j + 1}`, result }))),
        },
      },
    ],
  };
}

/** MÉHARI 2010, « Principes fondamentaux et spécifications fonctionnelles » (CLUSIF) : échelles standards d'impact et de
    potentialité (annexe D, p. 42), grille d'acceptabilité des risques et trois types de risques (§ 4, p. 28). Les
    descriptions sont de courtes citations (première phrase de chaque niveau) ; le document entier n'est pas reproduit. */
function mehariRisque(): CfgTemplate {
  const familles: CfgFamily[] = ['mehari', 'iso27005'];
  return {
    id: 'mehari-2010-impact-potentialite',
    label: 'Impact, potentialité et grille d’acceptabilité (MÉHARI 2010, CLUSIF)',
    description:
      'Échelles standards d’impact et de potentialité de MÉHARI 2010 (quatre niveaux), échelle de gravité du risque (toléré, inadmissible, insupportable), grille d’acceptabilité impact × potentialité et critères de classification D, I, C.',
    note: 'Libellés et grille repris du document « MÉHARI 2010 — Principes fondamentaux et spécifications fonctionnelles » du CLUSIF ; descriptions limitées à de courtes citations. MÉHARI est une marque déposée du CLUSIF. Le CLUSIF présente la grille comme un exemple : à relire, adapter et valider avant usage. Aucune base de connaissances MÉHARI n’est fournie ni aucune conformité revendiquée.',
    source: {
      organisation: 'CLUSIF',
      document: 'MÉHARI 2010 — Principes fondamentaux et spécifications fonctionnelles',
      version: '2010',
      url: 'https://clusif.fr/wp-content/uploads/2015/10/mehari-2010-principes-specifications.pdf',
      reference:
        '§ 4 p. 28 (grille d’acceptabilité des risques), annexe D p. 42 (échelles d’impact et de potentialité).',
      license: '© CLUSIF 2010 : courtes citations avec mention de la source ; aucun texte intégral reproduit.',
      verifiedAt: '2026-11-02',
    },
    items: [
      {
        ref: 'impact',
        kind: 'scale',
        key: 'impact_mehari',
        definition: {
          name: 'Impact (MÉHARI 2010)',
          description: 'Échelle standard des niveaux d’impact de MÉHARI 2010 (annexe D).',
          category: 'impact',
          nature: 'qualitative',
          appliesTo: familles,
          levels: niveauxCotes('i', [
            {
              label: '1 — Non significatif',
              description:
                'À ce niveau les dommages encourus n’ont pratiquement pas d’impact sur les résultats de l’entité ni sur son image, même si certaines personnes sont fortement impliquées dans le rétablissement de la situation d’origine.',
            },
            {
              label: '2 — Important',
              description:
                'Il s’agit là de sinistres ayant un impact notable au niveau des opérations de l’entité, de ses résultats ou de son image, mais restant globalement supportables.',
            },
            {
              label: '3 — Très grave',
              description:
                'Il s’agit là d’impact très grave au niveau de l’entité, sans que son avenir soit compromis.',
            },
            {
              label: '4 — Vital',
              description:
                'À ce niveau l’impact est extrêmement grave et met en danger l’existence même ou la survie de l’entité ou de l’une de ses activités majeures.',
            },
          ]),
        },
      },
      {
        ref: 'potentialite',
        kind: 'scale',
        key: 'potentialite_mehari',
        definition: {
          name: 'Potentialité (MÉHARI 2010)',
          description: 'Échelle standard des niveaux de potentialité de MÉHARI 2010 (annexe D).',
          category: 'likelihood',
          nature: 'qualitative',
          appliesTo: familles,
          levels: niveauxCotes('p', [
            {
              label: '1 — Très improbable',
              description: 'À ce niveau l’occurrence du risque est tout à fait improbable.',
            },
            {
              label: '2 — Improbable',
              description:
                'Il s’agit là de scénarios dont il est raisonnable de penser qu’ils ne surviendront pas. Ils demeurent néanmoins « possibles » et ne sont pas complètement invraisemblables.',
            },
            {
              label: '3 — Probable',
              description:
                'Il s’agit là des scénarios dont il est raisonnable de penser qu’ils pourraient bien se produire, à plus ou moins court terme.',
            },
            {
              label: '4 — Très probable',
              description:
                'À ce niveau, il est raisonnable de penser que le scénario se produira très certainement et vraisemblablement à court terme.',
            },
          ]),
        },
      },
      {
        ref: 'gravite',
        kind: 'scale',
        key: 'gravite_risque_mehari',
        definition: {
          name: 'Gravité du risque (MÉHARI 2010)',
          description:
            'Gravité globale évaluée par la grille d’acceptabilité : 4 = risque insupportable, 3 = risque inadmissible, gravités inférieures = risques tolérés. Les risques insupportables et inadmissibles sont les risques inacceptables.',
          category: 'risk_level',
          nature: 'qualitative',
          appliesTo: familles,
          levels: niveauxCotes('g', [
            {
              label: 'Gravité 1 — Risque toléré',
              description: 'Risque toléré.',
              color: PALETTE.low,
              acceptability: 'acceptable',
            },
            {
              label: 'Gravité 2 — Risque toléré',
              description: 'Risque toléré.',
              color: PALETTE.medium,
              acceptability: 'acceptable',
            },
            {
              label: 'Gravité 3 — Risque inadmissible',
              description:
                'Risque qui devrait être réduit ou éliminé à une échéance à déterminer, donc à prendre en compte dans une planification (plan de sécurité).',
              color: PALETTE.high,
              acceptability: 'unacceptable',
            },
            {
              label: 'Gravité 4 — Risque insupportable',
              description: 'Risque qui devrait faire l’objet de mesures d’urgence, en dehors de tout cycle budgétaire.',
              color: '#7E4A45',
              acceptability: 'unacceptable',
            },
          ]),
        },
      },
      {
        ref: 'grille',
        kind: 'matrix',
        key: 'grille_acceptabilite_mehari',
        definition: {
          name: 'Grille d’acceptabilité des risques (impact × potentialité, MÉHARI 2010)',
          description:
            'Grille de gravité standard de MÉHARI 2010 (§ 4) : gravité G en fonction de l’impact I et de la potentialité P.',
          category: 'risk',
          appliesTo: familles,
          rows: { scale: { item: 'impact', version: 1 }, label: 'Impact' },
          columns: { scale: { item: 'potentialite', version: 1 }, label: 'Potentialité' },
          result: { scale: { item: 'gravite', version: 1 } },
          cells: grille('i', 'p', 'g', { 1: [1, 1, 1, 2], 2: [1, 2, 2, 3], 3: [2, 3, 3, 4], 4: [2, 3, 4, 4] }),
        },
      },
      {
        ref: 'classification',
        kind: 'criteria',
        key: 'classification_dic_mehari',
        definition: {
          name: 'Classification des informations et des actifs (D, I, C — MÉHARI 2010)',
          description:
            'Critères de classification cités par MÉHARI 2010 : disponibilité, intégrité et confidentialité, chacun évalué sur l’échelle à quatre niveaux. D’autres critères (traçabilité, valeur probatoire…) peuvent être ajoutés.',
          appliesTo: familles,
          criteria: [
            { id: 'disponibilite', label: 'Disponibilité', scale: { item: 'impact', version: 1 } },
            { id: 'integrite', label: 'Intégrité', scale: { item: 'impact', version: 1 } },
            { id: 'confidentialite', label: 'Confidentialité', scale: { item: 'impact', version: 1 } },
          ],
        },
      },
    ],
  };
}
