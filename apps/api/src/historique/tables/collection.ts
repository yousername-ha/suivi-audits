/* Collections de l'outil de suivi en tables (ADR 0040) : correspondances génériques sans perte entre une clé de l'état
   historique et des tables à colonnes typées nullables.
   - liste : clé tableau d'objets (incidents, plans…) → une table ;
   - groupe : clé objet dont certaines propriétés sont des listes (crrc, crisis, ai) → une table par liste, le reste de
     l'objet dans `suivi_presence.reste` ;
   - carte : clé objet indexé par identifiant (dda) → une table, l'identifiant dans `cle`.
   Une colonne NULL signifie « champ absent » ; `extra` garde les champs inconnus et les valeurs d'un type inattendu ;
   une entrée qui n'est pas un objet est conservée telle quelle (`extra.brut`) ; l'ordre d'origine est conservé
   (`position`). Une clé vide mais présente est mémorisée dans `suivi_presence` pour que /legacy et l'export restent
   identiques à l'état d'origine.
   Sous-listes : une colonne `json` peut porter `enfants` (liste d'objets rangée dans une table liée par `parent_seq`, avec
   suppression en cascade). Une liste non vide est rangée dans la table liée et la colonne du parent reste NULL ; une liste
   vide, ou une valeur d'un autre type, reste dans la colonne du parent. À la lecture, les lignes liées l'emportent, sinon la
   colonne. Les entrées atypiques et les champs inconnus des sous-listes sont conservés comme pour les listes. */
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import { sql } from 'kysely';
import { surConnexion, type Client } from '../../db/db.js';
import { HttpError } from '../../http/errors.js';
import type { ModuleMapper } from '../../legacy/store.js';

type ColType = 'text' | 'num' | 'bool' | 'json';
interface Col {
  /** Champ de l'état historique. */
  f: string;
  /** Colonne de la table. */
  c: string;
  t: ColType;
  /** Sous-liste d'objets rangée dans une table liée (colonne `parent_seq`) ; réservé aux colonnes `json`. */
  enfants?: ListeSpec;
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
/* Tables et colonnes viennent des descriptions de ce module (liste fermée, jamais d'une saisie) : identifiants cités par
   sql.table / sql.id, valeurs liées (ADR 0062). */
const presence = (c: Client) => surConnexion(c).selectFrom('suivi_presence');

/** Entrées d'une table, dans l'ordre d'origine. */
async function lireRangees(c: Client, spec: ListeSpec): Promise<Rangee[]> {
  return (await sql<Rangee>`SELECT * FROM ${sql.table(spec.table)} ORDER BY position, seq`.execute(surConnexion(c)))
    .rows;
}
/** Sous-listes déjà lues : colonne du parent → clé du parent → entrées, dans l'ordre. */
type Sous = Map<string, Map<string, Json[]>>;
function entree(r: Rangee, spec: ListeSpec, sous: Sous): Json {
  if (r.extra.brut !== undefined) return r.extra.brut as Json;
  const o: JsonObject = { ...r.extra };
  for (const col of spec.cols) {
    const liste = col.enfants ? sous.get(col.c)?.get(String(r.seq)) : undefined;
    if (liste?.length) o[col.f] = liste;
    else if (r[col.c] !== null && r[col.c] !== undefined) o[col.f] = r[col.c] as Json;
  }
  return o;
}
/** Entrées recomposées de lignes déjà lues, sous-listes comprises (une requête par table liée). */
async function composer(c: Client, spec: ListeSpec, rangees: readonly Rangee[]): Promise<Json[]> {
  const sous: Sous = new Map();
  for (const col of spec.cols) {
    if (!col.enfants) continue;
    const lignes = (
      await sql<Rangee>`SELECT * FROM ${sql.table(col.enfants.table)} ORDER BY parent_seq, position, seq`.execute(
        surConnexion(c),
      )
    ).rows;
    const valeurs = await composer(c, col.enfants, lignes);
    const parParent = new Map<string, Json[]>();
    for (const [i, l] of lignes.entries()) {
      const k = String(l.parent_seq);
      const liste = parParent.get(k) ?? [];
      liste.push(valeurs[i]!);
      parParent.set(k, liste);
    }
    sous.set(col.c, parParent);
  }
  return rangees.map((r) => entree(r, spec, sous));
}
/** Entrées d'une table, dans l'ordre d'origine. */
async function lireEntrees(c: Client, spec: ListeSpec): Promise<{ rangee: Rangee; valeur: Json }[]> {
  const rangees = await lireRangees(c, spec);
  const valeurs = await composer(c, spec, rangees);
  return rangees.map((rangee, i) => ({ rangee, valeur: valeurs[i]! }));
}

/** Insère une entrée (et ses sous-listes) ; `parent` est la clé de la ligne parente d'une sous-liste. */
async function inserer(
  c: Client,
  spec: ListeSpec,
  position: number,
  cle: string | null,
  e: Json,
  parent: string | null,
): Promise<void> {
  const extra: JsonObject = isObject(e) ? { ...e } : { brut: e };
  const sousListes: [Col, Json[]][] = [];
  const valeurs = spec.cols.map((col) => {
    if (!isObject(e)) return null;
    const v = e[col.f];
    if (!(col.f in e) || !conforme(col.t, v)) return null;
    delete extra[col.f];
    if (col.enfants && Array.isArray(v) && v.length) {
      sousListes.push([col, v]);
      return null;
    }
    // Les colonnes jsonb reçoivent le texte JSON (un tableau JS serait lu par pg comme un tableau SQL).
    return col.t === 'json' ? JSON.stringify(v) : v;
  });
  const noms = [
    'position',
    'extra',
    ...(parent === null ? [] : ['parent_seq']),
    ...(cle === null ? [] : ['cle']),
    ...spec.cols.map((col) => col.c),
  ];
  const params = [position, extra, ...(parent === null ? [] : [parent]), ...(cle === null ? [] : [cle]), ...valeurs];
  const r = await sql<{ seq: string }>`INSERT INTO ${sql.table(spec.table)} (${sql.join(noms.map((n) => sql.id(n)))})
    VALUES (${sql.join(params)}) RETURNING seq`.execute(surConnexion(c));
  for (const [col, liste] of sousListes)
    for (const [i, x] of liste.entries()) await inserer(c, col.enfants!, i, null, x, r.rows[0]!.seq);
}

/** Remplace le contenu d'une table (les sous-listes suivent par cascade) ; le premier élément de chaque couple est la clé
    d'une carte (null pour une liste). */
async function ecrireRangees(c: Client, spec: ListeSpec, entrees: readonly [string | null, Json][]): Promise<void> {
  await sql`DELETE FROM ${sql.table(spec.table)}`.execute(surConnexion(c));
  for (const [position, [cle, e]] of entrees.entries()) await inserer(c, spec, position, cle, e, null);
}

/** Valeurs qui vident un module : absente, null ou objet vide (une liste vide reste une liste présente). */
const videOuAbsent = (v: Json | undefined) => v === undefined || v === null || (isObject(v) && !Object.keys(v).length);

async function effacerPresence(c: Client, key: string) {
  await surConnexion(c).deleteFrom('suivi_presence').where('cle', '=', key).execute();
}

/* ---------------------------------------------------------------- liste */
async function lireCollection(c: Client, spec: CollectionSpec): Promise<Json | undefined> {
  const lignes = await lireEntrees(c, spec);
  if (!lignes.length)
    return (await presence(c).select('cle').where('cle', '=', spec.key).executeTakeFirst()) ? [] : undefined;
  return lignes.map((l) => l.valeur);
}
/** Remplace le contenu par la valeur de la clé (undefined, null ou objet vide : module vidé). */
export async function ecrireCollection(c: Client, spec: CollectionSpec, value: Json | undefined): Promise<void> {
  await effacerPresence(c, spec.key);
  if (videOuAbsent(value)) return void (await ecrireRangees(c, spec, []));
  if (!Array.isArray(value)) throw new HttpError(422, `La clé « ${spec.key} » doit être une liste.`);
  await surConnexion(c).insertInto('suivi_presence').values({ cle: spec.key, kind: 'liste' }).execute();
  await ecrireRangees(
    c,
    spec,
    value.map((e) => [null, e]),
  );
}

/* ---------------------------------------------------------------- groupe */
async function lireGroupe(c: Client, spec: GroupeSpec): Promise<Json | undefined> {
  const p = await presence(c).select(['champs', 'reste']).where('cle', '=', spec.key).executeTakeFirst();
  if (!p) return undefined;
  const o: JsonObject = { ...(p.reste as JsonObject) };
  for (const part of spec.parts)
    if (p.champs.includes(part.field)) o[part.field] = (await lireEntrees(c, part)).map((l) => l.valeur);
  return o;
}
export async function ecrireGroupe(c: Client, spec: GroupeSpec, value: Json | undefined): Promise<void> {
  await effacerPresence(c, spec.key);
  for (const part of spec.parts) await ecrireRangees(c, part, []);
  if (value === undefined || value === null) return;
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
  await surConnexion(c)
    .insertInto('suivi_presence')
    .values({ cle: spec.key, kind: 'objet', champs, reste: JSON.stringify(reste) })
    .execute();
}

/* ---------------------------------------------------------------- carte */
async function lireCarte(c: Client, spec: CarteSpec): Promise<Json | undefined> {
  const lignes = await lireEntrees(c, spec);
  if (!lignes.length)
    return (await presence(c).select('cle').where('cle', '=', spec.key).executeTakeFirst()) ? {} : undefined;
  return Object.fromEntries(lignes.map((l) => [l.rangee.cle as string, l.valeur]));
}
export async function ecrireCarte(c: Client, spec: CarteSpec, value: Json | undefined): Promise<void> {
  await effacerPresence(c, spec.key);
  if (value === undefined || value === null) return void (await ecrireRangees(c, spec, []));
  if (!isObject(value)) throw new HttpError(422, `La clé « ${spec.key} » doit être un objet.`);
  await surConnexion(c).insertInto('suivi_presence').values({ cle: spec.key, kind: 'objet' }).execute();
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
