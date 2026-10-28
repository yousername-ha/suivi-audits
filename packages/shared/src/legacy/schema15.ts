/* Migration du format legacy vers le schéma 15 : identifiant stable pour les éléments des 9 listes qui n'en avaient pas.
   Algorithme déterministe (même résultat à chaque exécution), identique à celui de l'outil legacy (ancien outil) :
   pour chaque préfixe, numérotation à la suite du plus grand numéro déjà attribué, sur 3 chiffres minimum. */
import { ID_LISTS, isObject, listsAt, type Json, type JsonObject } from './paths.js';

export const CURRENT_SCHEMA = 15;

const numOf = (id: unknown, prefix: string): number => {
  if (typeof id !== 'string' || !id.startsWith(prefix)) return 0;
  const n = Number(id.slice(prefix.length));
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** Prochain identifiant libre pour un préfixe, d'après les identifiants existants. */
export function nextLegacyId(prefix: string, existing: Iterable<unknown>): string {
  let max = 0;
  for (const id of existing) max = Math.max(max, numOf(id, prefix));
  return prefix + String(max + 1).padStart(3, '0');
}

/** Copie profonde au schéma 15. Les identifiants existants sont conservés ; seuls les manquants sont attribués. */
export function migrateToSchema15<T extends JsonObject>(data: T): T {
  const out = structuredClone(data) as JsonObject;
  for (const { path, prefix } of ID_LISTS) {
    const lists = listsAt(out, path);
    const used = new Set<string>();
    for (const l of lists) for (const el of l) if (isObject(el) && typeof el.id === 'string' && el.id) used.add(el.id);
    let n = 0;
    for (const id of used) n = Math.max(n, numOf(id, prefix));
    for (const l of lists) {
      for (const el of l) {
        if (!isObject(el)) continue;
        if (typeof el.id === 'string' && el.id) continue;
        let id: string;
        do id = prefix + String(++n).padStart(3, '0');
        while (used.has(id));
        used.add(id);
        // L'identifiant est placé en tête de l'objet, comme pour les autres listes.
        const copy: JsonObject = { id, ...el };
        for (const k of Object.keys(el)) delete el[k];
        Object.assign(el, copy);
      }
    }
  }
  out.schema = Math.max(CURRENT_SCHEMA, typeof out.schema === 'number' ? out.schema : 0);
  return out as T;
}

/** Vérifie la présence et l'unicité des identifiants du schéma 15. Renvoie la liste des problèmes. */
export function schema15Problems(data: Json): string[] {
  const problems: string[] = [];
  for (const { path } of ID_LISTS) {
    const seen = new Set<string>();
    for (const l of listsAt(data, path)) {
      for (const el of l) {
        if (!isObject(el)) continue;
        if (typeof el.id !== 'string' || !el.id) problems.push(`${path}[] : élément sans identifiant`);
        else if (seen.has(el.id)) problems.push(`${path}[] : identifiant en double (${el.id})`);
        else seen.add(el.id);
      }
    }
  }
  return problems;
}
