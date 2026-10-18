/* Collections de l'outil de suivi en tables (ADR 0040) : correspondance générique entre une clé tableau de l'état
   historique (liste d'objets) et une table à colonnes typées. Sans perte : une colonne NULL signifie « champ absent »,
   `extra` garde les champs inconnus et les valeurs d'un type inattendu, une entrée qui n'est pas un objet est conservée
   telle quelle (`extra.brut`), l'ordre d'origine est conservé (`position`). Une clé vide mais présente est mémorisée dans
   `suivi_presence` pour que /legacy et l'export restent identiques à l'état d'origine. */
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { Client } from '../../db/db.js';
import { HttpError } from '../../http/errors.js';
import type { ModuleMapper } from '../../legacy/store.js';

export type ColType = 'text' | 'num' | 'bool' | 'json';
export interface Col {
  /** Champ de l'état historique. */
  f: string;
  /** Colonne de la table. */
  c: string;
  t: ColType;
}
export interface CollectionSpec {
  key: string;
  table: string;
  cols: readonly Col[];
}

const conforme = (t: ColType, v: unknown) =>
  t === 'text'
    ? typeof v === 'string'
    : t === 'num'
      ? typeof v === 'number' && Number.isFinite(v)
      : t === 'bool'
        ? typeof v === 'boolean'
        : v !== undefined && v !== null; // json : un null explicite reste dans `extra` (NULL SQL = champ absent)

export async function lireCollection(c: Client, spec: CollectionSpec): Promise<Json | undefined> {
  const lignes = (
    await c.query<Record<string, unknown> & { extra: JsonObject }>(`SELECT * FROM ${spec.table} ORDER BY position, seq`)
  ).rows;
  if (!lignes.length) {
    const present = await c.query('SELECT 1 FROM suivi_presence WHERE cle=$1', [spec.key]);
    return present.rowCount ? [] : undefined;
  }
  return lignes.map((r): Json => {
    if (r.extra.brut !== undefined) return r.extra.brut as Json;
    const o: JsonObject = { ...r.extra };
    for (const col of spec.cols) if (r[col.c] !== null && r[col.c] !== undefined) o[col.f] = r[col.c] as Json;
    return o;
  });
}

/** Remplace le contenu de la table par la valeur de la clé (undefined, null ou objet vide : module vidé). */
export async function ecrireCollection(c: Client, spec: CollectionSpec, value: Json | undefined): Promise<void> {
  await c.query(`DELETE FROM ${spec.table}`);
  await c.query('DELETE FROM suivi_presence WHERE cle=$1', [spec.key]);
  if (value === undefined || value === null || (isObject(value) && !Object.keys(value).length)) return;
  if (!Array.isArray(value)) throw new HttpError(422, `La clé « ${spec.key} » doit être une liste.`);
  await c.query('INSERT INTO suivi_presence(cle) VALUES ($1)', [spec.key]);
  const noms = spec.cols.map((col) => col.c).join(',');
  const params = spec.cols.map((_, i) => `$${i + 3}`).join(',');
  for (const [position, entree] of value.entries()) {
    if (!isObject(entree)) {
      await c.query(`INSERT INTO ${spec.table}(position,extra) VALUES ($1,$2)`, [position, { brut: entree }]);
      continue;
    }
    const extra: JsonObject = { ...entree };
    const valeurs = spec.cols.map((col) => {
      const v = entree[col.f];
      if (!(col.f in entree) || !conforme(col.t, v)) return null;
      delete extra[col.f];
      // Les colonnes jsonb reçoivent le texte JSON (un tableau JS serait lu par pg comme un tableau SQL).
      return col.t === 'json' ? JSON.stringify(v) : v;
    });
    await c.query(`INSERT INTO ${spec.table}(position,extra,${noms}) VALUES ($1,$2,${params})`, [
      position,
      extra,
      ...valeurs,
    ]);
  }
}

export const collectionMapper = (spec: CollectionSpec): ModuleMapper => ({
  key: spec.key,
  read: (c) => lireCollection(c, spec),
  write: (c, value) => ecrireCollection(c, spec, value),
});
