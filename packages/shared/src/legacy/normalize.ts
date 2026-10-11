/* Forme canonique pour comparer deux états legacy : clés triées, listes d'objets identifiés triées par identifiant. */
import { isObject, type Json } from './paths.js';

const hasId = (v: Json): v is { id: string } & Record<string, Json> => isObject(v) && typeof v.id === 'string';

export function canonical(value: Json): Json {
  if (Array.isArray(value)) {
    const items = value.map(canonical);
    if (items.length && items.every(hasId)) {
      return [...items].sort((a, b) => ((a as { id: string }).id < (b as { id: string }).id ? -1 : 1));
    }
    return items;
  }
  if (isObject(value)) {
    const out: Record<string, Json> = {};
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k] as Json);
    return out;
  }
  return value;
}

/** Sérialisation canonique (stable) : base des comparaisons et des empreintes de contenu. */
export const canonicalJson = (value: Json): string => JSON.stringify(canonical(value));

export const deepEqual = (a: Json | undefined, b: Json | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && canonicalJson(a) === canonicalJson(b));
