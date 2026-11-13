/* Planification d'un import legacy : calcul de l'état résultant et du rapport, SANS effet de bord.
   La simulation et l'application utilisent exactement la même fonction : l'application ne fait qu'enregistrer « next ». */
import type { ImportMode } from '../schemas.js';
import { moduleLabel, modulePhase, TECHNICAL_KEYS } from './modules.js';
import { deepEqual } from './normalize.js';
import { DICT_PATHS, isObject, unknownPaths, type Json, type JsonObject } from './paths.js';
import { LegacyFileError } from './schema.js';
import { migrateToSchema15 } from './schema15.js';

export interface CollectionStats {
  path: string;
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  ids: { created: string[]; updated: string[]; deleted: string[] };
}
export interface ModuleReport {
  module: string;
  label: string;
  phase: number | null;
  change: 'created' | 'updated' | 'unchanged' | 'deleted';
  collections: CollectionStats[];
  /** Champs simples modifiés (chemins). */
  fields: string[];
}
export interface BrokenRef {
  path: string;
  value: string;
}
export interface ImportReport {
  mode: ImportMode;
  module: string | null;
  sourceSchema: number;
  envelope: boolean;
  modules: ModuleReport[];
  affected: string[];
  totals: { created: number; updated: number; unchanged: number; deleted: number };
  brokenRefs: BrokenRef[];
  unknownPaths: string[];
  warnings: string[];
}

const MAX_IDS = 500;
const isIdObj = (v: Json): v is JsonObject & { id: string } => isObject(v) && typeof v.id === 'string' && v.id !== '';
const isIdList = (v: Json | undefined): boolean => Array.isArray(v) && v.length > 0 && v.every(isIdObj);
const isPrimitive = (v: Json) => v === null || typeof v !== 'object';

/* ---------------------------------------------------------------- Fusion (mode « Fusionner ») */
function mergeValue(cur: Json | undefined, inc: Json, path: string, warnings: string[]): Json {
  if (cur === undefined) return structuredClone(inc);
  if (Array.isArray(cur) && Array.isArray(inc)) {
    if ((isIdList(inc) || inc.length === 0) && (isIdList(cur) || cur.length === 0)) {
      const incById = new Map(inc.map((e) => [(e as { id: string }).id, e]));
      const out: Json[] = cur.map((e) => {
        const id = (e as { id: string }).id;
        return incById.has(id) ? structuredClone(incById.get(id) as Json) : e;
      });
      const curIds = new Set(cur.map((e) => (e as { id: string }).id));
      for (const e of inc) if (!curIds.has((e as { id: string }).id)) out.push(structuredClone(e));
      return out;
    }
    if (cur.every(isPrimitive) && inc.every(isPrimitive)) {
      const out = [...cur];
      for (const v of inc) if (!out.some((x) => x === v)) out.push(v);
      return out;
    }
    if (!deepEqual(cur, inc)) warnings.push(`${path} : liste sans identifiant, remplacée par celle du fichier.`);
    return structuredClone(inc);
  }
  if (isObject(cur) && isObject(inc)) {
    const out: JsonObject = { ...cur };
    for (const [k, v] of Object.entries(inc)) out[k] = mergeValue(cur[k], v, `${path}.${k}`, warnings);
    return out;
  }
  return structuredClone(inc);
}

/* ---------------------------------------------------------------- Différences (rapport) */
function idStats(path: string, before: Json[] | undefined, after: Json[] | undefined): CollectionStats {
  const b = new Map((before ?? []).filter(isIdObj).map((e) => [e.id, e]));
  const a = new Map((after ?? []).filter(isIdObj).map((e) => [e.id, e]));
  const s: CollectionStats = {
    path,
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    ids: { created: [], updated: [], deleted: [] },
  };
  const push = (k: 'created' | 'updated' | 'deleted', id: string) => {
    s[k]++;
    if (s.ids[k].length < MAX_IDS) s.ids[k].push(id);
  };
  for (const [id, e] of a) {
    const old = b.get(id);
    if (old === undefined) push('created', id);
    else if (deepEqual(old, e)) s.unchanged++;
    else push('updated', id);
  }
  for (const id of b.keys()) if (!a.has(id)) push('deleted', id);
  return s;
}
function dictStats(path: string, before: JsonObject | undefined, after: JsonObject | undefined): CollectionStats {
  const toList = (o: JsonObject | undefined) =>
    Object.entries(o ?? {}).map(([id, v]) => ({ id, v }) as unknown as Json);
  return idStats(`${path}.{clé}`, toList(before), toList(after));
}
function diffValue(path: string, before: Json | undefined, after: Json | undefined, r: ModuleReport) {
  if (deepEqual(before, after) && !(isIdList(after) || (isObject(after) && DICT_PATHS.has(path)))) return;
  const arrays = (before === undefined || Array.isArray(before)) && (after === undefined || Array.isArray(after));
  if (arrays && (isIdList(before) || isIdList(after))) {
    r.collections.push(idStats(path, before as Json[] | undefined, after as Json[] | undefined));
    return;
  }
  const objs = (before === undefined || isObject(before)) && (after === undefined || isObject(after));
  if (objs && DICT_PATHS.has(path)) {
    r.collections.push(dictStats(path, before as JsonObject | undefined, after as JsonObject | undefined));
    return;
  }
  if (objs && (before !== undefined || after !== undefined) && (isObject(before) || isObject(after))) {
    const keys = new Set([...Object.keys((before as JsonObject) ?? {}), ...Object.keys((after as JsonObject) ?? {})]);
    for (const k of keys)
      diffValue(`${path}.${k}`, (before as JsonObject | undefined)?.[k], (after as JsonObject | undefined)?.[k], r);
    return;
  }
  if (!deepEqual(before, after)) r.fields.push(path);
}

/* ---------------------------------------------------------------- Références croisées */
const itemCode = (it: JsonObject): string[] => {
  const ref = String(it.ref ?? ''),
    n = String(it.num ?? '');
  return [String(it.id ?? ''), n, ref === 'A' ? `A.${n}` : ref === 'HDS' ? `HDS ${n}` : n].filter(Boolean);
};
export function brokenRefs(state: JsonObject): BrokenRef[] {
  const out: BrokenRef[] = [];
  const add = (path: string, value: string) => {
    if (out.length < 200) out.push({ path, value });
  };
  const arr = (v: Json | undefined): JsonObject[] => (Array.isArray(v) ? v.filter(isObject) : []);
  const items = arr(state.items);
  const itemKeys = new Set(items.flatMap(itemCode));
  const procIds = new Set(arr(state.processes).map((p) => String(p.id)));
  for (const f of arr(state.findings))
    for (const v of Array.isArray(f.items) ? f.items : [])
      if (typeof v === 'string' && v && !itemKeys.has(v)) add(`$.findings[${String(f.id)}].items`, v);
  for (const o of arr(state.objectives))
    for (const v of Array.isArray(o.processes) ? o.processes : [])
      if (typeof v === 'string' && v && !procIds.has(v)) add(`$.objectives[${String(o.id)}].processes`, v);
  for (const p of arr(state.processes))
    if (typeof p.parent === 'string' && p.parent && !procIds.has(p.parent))
      add(`$.processes[${String(p.id)}].parent`, p.parent);
  if (isObject(state.dda) && items.length) {
    const ids = new Set(items.map((i) => String(i.id)));
    for (const k of Object.keys(state.dda)) if (!ids.has(k)) add('$.dda', k);
  }
  const plan = isObject(state.plan) ? state.plan : null;
  if (plan) {
    const days = new Set(arr(plan.days).map((d) => String(d.id)));
    const people = new Set(arr(plan.people).map((p) => String(p.id)));
    for (const s of arr(plan.slots)) {
      const at = `$.plan.slots[${String(s.id)}]`;
      if (typeof s.day === 'string' && s.day && !days.has(s.day)) add(`${at}.day`, s.day);
      for (const v of Array.isArray(s.items) ? s.items : [])
        if (typeof v === 'string' && v && !itemKeys.has(v)) add(`${at}.items`, v);
      for (const v of Array.isArray(s.people) ? s.people : [])
        if (typeof v === 'string' && v && !people.has(v)) add(`${at}.people`, v);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- État « vide » (mode Initialiser) */
const USER_LISTS = [
  'findings',
  'processes',
  'objectives',
  'indicators',
  'suppliers',
  'supEvals',
  'accessReviews',
  'appGaps',
  'reviews',
  'swots',
  'incidents',
  'roles',
  'plans',
  'recurring',
  'evidences',
  'interested',
];
/** Vrai si l'état ne contient que les référentiels (aucune donnée saisie). */
export function isEmptyState(s: JsonObject | null): boolean {
  if (!s) return true;
  const len = (v: Json | undefined) => (Array.isArray(v) ? v.length : isObject(v) ? Object.keys(v).length : 0);
  if (USER_LISTS.some((k) => len(s[k]) > 0)) return false;
  if (len(s.dda) > 0) return false;
  const sub = (k: string, c: string) => (isObject(s[k]) ? len((s[k] as JsonObject)[c]) : 0);
  return (
    sub('ai', 'register') +
      sub('ai', 'evals') +
      sub('invest', 'lines') +
      sub('crisis', 'cells') +
      sub('plan', 'slots') ===
    0
  );
}

/* ---------------------------------------------------------------- Point d'entrée */
export interface PlanOptions {
  mode: ImportMode;
  module?: string | null;
  sourceSchema: number;
  envelope: boolean;
}

/** Modules de l'ancien outil qui n'existent plus : ignorés à l'import. */
const CLES_RETIREES = ['findings', 'findingsRev'] as const;

/** Calcule l'état résultant d'un import et son rapport. Ne modifie ni « current » ni « incoming ». */
export function planImport(
  current: JsonObject | null,
  incoming: JsonObject,
  opts: PlanOptions,
): { next: JsonObject; report: ImportReport } {
  const inc = migrateToSchema15(incoming);
  const cur = current ? migrateToSchema15(current) : null;
  const warnings: string[] = [];
  // Les constats historiques n'existent plus comme module : les écarts se saisissent dans les registres.
  if (Array.isArray(inc.findings) && inc.findings.length)
    warnings.push(
      `Les ${inc.findings.length} constat(s) historique(s) du fichier ne sont pas importés : les écarts se saisissent dans le registre des écarts.`,
    );
  for (const etat of [inc, cur]) if (etat) for (const cle of CLES_RETIREES) delete etat[cle];
  let next: JsonObject;
  const module = opts.module || null;

  if (opts.mode === 'init') {
    if (!isEmptyState(cur)) {
      throw new LegacyFileError(
        "Le mode « Initialiser » n'est possible que sur une base vide : des données ont déjà été saisies. Utilisez « Fusionner » ou « Remplacer un module ».",
      );
    }
    next = structuredClone(inc);
  } else if (opts.mode === 'replace') {
    if (!module) throw new LegacyFileError('Choisissez le module à remplacer.');
    if (TECHNICAL_KEYS.has(module))
      throw new LegacyFileError(`Le module « ${module} » est technique et ne peut pas être remplacé.`);
    if (!(module in inc)) throw new LegacyFileError(`Le module « ${moduleLabel(module)} » est absent du fichier.`);
    next = { ...(cur ?? {}), [module]: structuredClone(inc[module] as Json) };
  } else {
    next = cur ? (mergeValue(cur, inc, '$', warnings) as JsonObject) : structuredClone(inc);
  }
  next.schema = 15;

  const keys = new Set([...Object.keys(cur ?? {}), ...Object.keys(next)]);
  const modules: ModuleReport[] = [];
  const affected: string[] = [];
  for (const k of keys) {
    const b = cur?.[k];
    const a = next[k];
    const r: ModuleReport = {
      module: k,
      label: moduleLabel(k),
      phase: modulePhase(k),
      change: b === undefined ? 'created' : a === undefined ? 'deleted' : deepEqual(b, a) ? 'unchanged' : 'updated',
      collections: [],
      fields: [],
    };
    if (r.change !== 'unchanged') affected.push(k);
    if (opts.mode === 'replace' && k !== module) continue;
    diffValue(`$.${k}`, b, a, r);
    if (opts.mode === 'replace' || r.change !== 'unchanged' || r.collections.length || k in inc) modules.push(r);
  }
  modules.sort((x, y) => (x.phase ?? 9) - (y.phase ?? 9) || x.module.localeCompare(y.module));
  const totals = { created: 0, updated: 0, unchanged: 0, deleted: 0 };
  for (const m of modules)
    for (const c of m.collections) {
      totals.created += c.created;
      totals.updated += c.updated;
      totals.unchanged += c.unchanged;
      totals.deleted += c.deleted;
    }
  const report: ImportReport = {
    mode: opts.mode,
    module,
    sourceSchema: opts.sourceSchema,
    envelope: opts.envelope,
    modules,
    affected: affected.filter((k) => !TECHNICAL_KEYS.has(k)).sort(),
    totals,
    brokenRefs: brokenRefs(next),
    unknownPaths: unknownPaths(inc),
    warnings,
  };
  return { next, report };
}
