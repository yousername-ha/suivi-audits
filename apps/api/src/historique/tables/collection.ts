/* Collections de l'outil de suivi en tables (ADR 0040) : correspondances génériques sans perte entre une clé de l'état
   historique et des tables à colonnes typées nullables.
   - liste : clé tableau d'objets (incidents, plans…) → une table ;
   - groupe : clé objet dont certaines propriétés sont des listes (crrc, crisis, ai) → une table par liste, le reste de
     l'objet dans `suivi_presence.reste` ;
   - carte : clé objet indexé par identifiant (dda) → une table, l'identifiant dans `cle`.
   Une colonne NULL signifie « champ absent » ; `extra` garde les champs inconnus et les valeurs d'un type inattendu ;
   une entrée qui n'est pas un objet est conservée telle quelle (`extra.brut`) ; l'ordre d'origine est conservé
   (`position`). Une clé vide mais présente est mémorisée dans `suivi_presence` pour que /legacy et l'export restent
   identiques à l'état d'origine. */
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
export interface ListeSpec {
  table: string;
  cols: readonly Col[];
}
export interface CollectionSpec extends ListeSpec {
  key: string;
}
export interface GroupeSpec {
  key: string;
  /** Propriétés de l'objet stockées chacune dans une table. */
  parts: readonly (ListeSpec & { field: string })[];
}
export type CarteSpec = CollectionSpec;

const conforme = (t: ColType, v: unknown) =>
  t === 'text'
    ? typeof v === 'string'
    : t === 'num'
      ? typeof v === 'number' && Number.isFinite(v)
      : t === 'bool'
        ? typeof v === 'boolean'
        : v !== undefined && v !== null; // json : un null explicite reste dans `extra` (NULL SQL = champ absent)

type Rangee = Record<string, unknown> & { extra: JsonObject; cle?: string };

/** Entrées d'une table, dans l'ordre d'origine. */
async function lireRangees(c: Client, spec: ListeSpec): Promise<Rangee[]> {
  return (await c.query<Rangee>(`SELECT * FROM ${spec.table} ORDER BY position, seq`)).rows;
}
function entree(r: Rangee, spec: ListeSpec): Json {
  if (r.extra.brut !== undefined) return r.extra.brut as Json;
  const o: JsonObject = { ...r.extra };
  for (const col of spec.cols) if (r[col.c] !== null && r[col.c] !== undefined) o[col.f] = r[col.c] as Json;
  return o;
}

/** Remplace le contenu d'une table ; le premier élément de chaque couple est la clé d'une carte (null pour une liste). */
async function ecrireRangees(c: Client, spec: ListeSpec, entrees: readonly [string | null, Json][]): Promise<void> {
  await c.query(`DELETE FROM ${spec.table}`);
  for (const [position, [cle, e]] of entrees.entries()) {
    const extra: JsonObject = isObject(e) ? { ...e } : { brut: e };
    const valeurs = spec.cols.map((col) => {
      if (!isObject(e)) return null;
      const v = e[col.f];
      if (!(col.f in e) || !conforme(col.t, v)) return null;
      delete extra[col.f];
      // Les colonnes jsonb reçoivent le texte JSON (un tableau JS serait lu par pg comme un tableau SQL).
      return col.t === 'json' ? JSON.stringify(v) : v;
    });
    const noms = ['position', 'extra', ...(cle === null ? [] : ['cle']), ...spec.cols.map((col) => col.c)];
    const params = [position, extra, ...(cle === null ? [] : [cle]), ...valeurs];
    await c.query(
      `INSERT INTO ${spec.table}(${noms.join(',')}) VALUES (${params.map((_, k) => `$${k + 1}`).join(',')})`,
      params,
    );
  }
}

/** Valeurs qui vident un module : absente, null ou objet vide (une liste vide reste une liste présente). */
const videOuAbsent = (v: Json | undefined) => v === undefined || v === null || (isObject(v) && !Object.keys(v).length);

async function effacerPresence(c: Client, key: string) {
  await c.query('DELETE FROM suivi_presence WHERE cle=$1', [key]);
}

/* ---------------------------------------------------------------- liste */
export async function lireCollection(c: Client, spec: CollectionSpec): Promise<Json | undefined> {
  const lignes = await lireRangees(c, spec);
  if (!lignes.length)
    return (await c.query('SELECT 1 FROM suivi_presence WHERE cle=$1', [spec.key])).rowCount ? [] : undefined;
  return lignes.map((r) => entree(r, spec));
}
/** Remplace le contenu par la valeur de la clé (undefined, null ou objet vide : module vidé). */
export async function ecrireCollection(c: Client, spec: CollectionSpec, value: Json | undefined): Promise<void> {
  await effacerPresence(c, spec.key);
  if (videOuAbsent(value)) return void (await ecrireRangees(c, spec, []));
  if (!Array.isArray(value)) throw new HttpError(422, `La clé « ${spec.key} » doit être une liste.`);
  await c.query("INSERT INTO suivi_presence(cle,kind) VALUES ($1,'liste')", [spec.key]);
  await ecrireRangees(
    c,
    spec,
    value.map((e) => [null, e]),
  );
}

/* ---------------------------------------------------------------- groupe */
export async function lireGroupe(c: Client, spec: GroupeSpec): Promise<Json | undefined> {
  const p = (
    await c.query<{ champs: string[]; reste: JsonObject }>('SELECT champs, reste FROM suivi_presence WHERE cle=$1', [
      spec.key,
    ])
  ).rows[0];
  if (!p) return undefined;
  const o: JsonObject = { ...p.reste };
  for (const part of spec.parts)
    if (p.champs.includes(part.field)) o[part.field] = (await lireRangees(c, part)).map((r) => entree(r, part));
  return o;
}
export async function ecrireGroupe(c: Client, spec: GroupeSpec, value: Json | undefined): Promise<void> {
  await effacerPresence(c, spec.key);
  for (const part of spec.parts) await ecrireRangees(c, part, []);
  if (videOuAbsent(value)) return;
  if (!isObject(value)) throw new HttpError(422, `La clé « ${spec.key} » doit être un objet.`);
  const reste: JsonObject = { ...value };
  const champs: string[] = [];
  for (const part of spec.parts) {
    const v = value[part.field];
    if (!Array.isArray(v)) continue;
    champs.push(part.field);
    delete reste[part.field];
    await ecrireRangees(
      c,
      part,
      v.map((e) => [null, e]),
    );
  }
  await c.query("INSERT INTO suivi_presence(cle,kind,champs,reste) VALUES ($1,'objet',$2,$3)", [
    spec.key,
    champs,
    reste,
  ]);
}

/* ---------------------------------------------------------------- carte */
export async function lireCarte(c: Client, spec: CarteSpec): Promise<Json | undefined> {
  const lignes = await lireRangees(c, spec);
  if (!lignes.length) return undefined;
  return Object.fromEntries(lignes.map((r) => [r.cle as string, entree(r, spec)]));
}
export async function ecrireCarte(c: Client, spec: CarteSpec, value: Json | undefined): Promise<void> {
  if (videOuAbsent(value)) return void (await ecrireRangees(c, spec, []));
  if (!isObject(value)) throw new HttpError(422, `La clé « ${spec.key} » doit être un objet.`);
  await ecrireRangees(c, spec, Object.entries(value));
}

export const collectionMapper = (spec: CollectionSpec): ModuleMapper => ({
  key: spec.key,
  read: (c) => lireCollection(c, spec),
  write: (c, value) => ecrireCollection(c, spec, value),
});
export const groupeMapper = (spec: GroupeSpec): ModuleMapper => ({
  key: spec.key,
  read: (c) => lireGroupe(c, spec),
  write: (c, value) => ecrireGroupe(c, spec, value),
});
export const carteMapper = (spec: CarteSpec): ModuleMapper => ({
  key: spec.key,
  read: (c) => lireCarte(c, spec),
  write: (c, value) => ecrireCarte(c, spec, value),
});
