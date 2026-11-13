/* Chemins JSON dans la notation du contrat (LEGACY-FORMAT.md) : $.a.b, $.liste[], $.liste[].champ, $.dico.{clé}. */
import { CONTRACT_PATHS } from './contract.generated.js';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type JsonObject = { [k: string]: Json };

export const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Objets « dictionnaire indexé » du contrat : leurs clés sont des données, pas des champs. */
export const DICT_PATHS: ReadonlySet<string> = new Set(
  CONTRACT_PATHS.filter((c) => c.path.endsWith('.{clé}')).map((c) => c.path.slice(0, -'.{clé}'.length)),
);

/** Les clés d'années (2025, 2026…) varient d'un cycle à l'autre : on les compare sous une forme générique. */
export const genericYears = (p: string): string => p.replace(/\.\d{4}(?=\.|\[|$)/g, '.{année}');

/** Chemins supplémentaires du schéma 15 (identifiants stables ajoutés aux listes qui n'en avaient pas). */
export const ID_LISTS: ReadonlyArray<{ path: string; prefix: string; label: string }> = [
  { path: '$.findings[].tasks', prefix: 'TK-', label: 'Tâches des écarts' },
  { path: '$.indicators[].values', prefix: 'IV-', label: 'Valeurs des indicateurs' },
  { path: '$.ai.plan', prefix: 'AP-', label: "Plan d'action IA" },
  { path: '$.ai.policies', prefix: 'AL-', label: 'Politiques IA' },
  { path: '$.plan.slots[].proofs', prefix: 'PR-', label: "Preuves des créneaux du plan d'audit" },
  { path: '$.reviews[].cs.inc.focus', prefix: 'RF-', label: 'Incidents marquants des revues' },
  { path: '$.reviews[].cs.sujet', prefix: 'RS-', label: 'Sujets des revues' },
  { path: '$.crisis.cells[].log', prefix: 'CL-', label: 'Journal des cellules de crise' },
  { path: '$.roles', prefix: 'RO-', label: 'Rôles et responsabilités' },
];
export const SCHEMA15_PATHS: ReadonlyArray<string> = ID_LISTS.map((l) => `${l.path}[].id`);

/** Ensemble des chemins connus (contrat + schéma 15), années rendues génériques. */
export const KNOWN_PATHS: ReadonlySet<string> = new Set(
  [...CONTRACT_PATHS.map((c) => c.path), ...SCHEMA15_PATHS].map(genericYears),
);

/** Collecte tous les chemins d'une valeur JSON, dans la notation du contrat. */
export function collectPaths(value: Json, base = '$', out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const el of value) {
      out.add(`${base}[]`);
      collectPaths(el, `${base}[]`, out);
    }
  } else if (isObject(value)) {
    const dict = DICT_PATHS.has(base);
    for (const [k, v] of Object.entries(value)) {
      const p = dict ? `${base}.{clé}` : `${base}.${k}`;
      out.add(p);
      collectPaths(v, p, out);
    }
  }
  return out;
}

/** Chemins présents dans les données mais absents du contrat (années rendues génériques). */
export function unknownPaths(value: Json): string[] {
  const seen = new Set<string>();
  for (const p of collectPaths(value)) {
    const g = genericYears(p);
    if (!KNOWN_PATHS.has(g)) seen.add(g);
  }
  return [...seen].sort();
}

/** Renvoie toutes les listes situées à un chemin du type $.a[].b.c (les segments « [] » sont parcourus). */
export function listsAt(root: Json, path: string): Json[][] {
  const tokens = path.replace(/^\$\.?/, '').split('.');
  let cur: Json[] = [root];
  tokens.forEach((tok, i) => {
    const many = tok.endsWith('[]');
    const key = many ? tok.slice(0, -2) : tok;
    const next: Json[] = [];
    for (const node of cur) {
      if (!isObject(node)) continue;
      const v = node[key];
      if (v === undefined) continue;
      if (many && i < tokens.length - 1) {
        if (Array.isArray(v)) next.push(...v);
      } else next.push(v);
    }
    cur = next;
  });
  return cur.filter((v): v is Json[] => Array.isArray(v));
}
