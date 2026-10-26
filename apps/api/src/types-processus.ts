/* Registre des types de processus (Plateforme). Le serveur est seul juge : un processus ne peut porter qu'un type actif
   (ou celui qu'il portait déjà), un type utilisé ne se supprime pas (il s'archive), le code ne change jamais.
   Accès aux données en Kysely (ADR 0062). */
import {
  codeDepuisLibelle,
  TEINTES_TYPE_PROCESSUS,
  type TeinteTypeProcessus,
  type TypeProcessusBody,
  type TypeProcessusDto,
  type TypeProcessusPatch,
} from '@suivi/shared';
import { sql } from 'kysely';
import { surConnexion, type Actor, type Client, type Db, type Kdb } from './db/db.js';
import { HttpError } from './http/errors.js';

/** Colonnes d'un type, avec le nombre de processus qui le portent. */
const selectionner = (k: Kdb) =>
  k.selectFrom('types_processus as t').select((eb) => [
    't.id',
    't.code',
    't.label',
    't.description',
    't.tint',
    't.rank',
    't.archived',
    eb
      .selectFrom('suivi_processus as p')
      .select(sql<number>`count(*)::int`.as('n'))
      .whereRef('p.family', '=', 't.code')
      .as('usage'),
  ]);
// La contrainte CHECK de la migration 035 garantit la teinte ; on la vérifie plutôt que de la transtyper en silence.
const estTeinte = (t: string): t is TeinteTypeProcessus => (TEINTES_TYPE_PROCESSUS as readonly string[]).includes(t);
const versDto = (r: Omit<TypeProcessusDto, 'usage' | 'tint'> & { tint: string; usage: number | null }) => {
  if (!estTeinte(r.tint)) throw new Error(`Teinte de type de processus inattendue : ${r.tint}`);
  return { ...r, tint: r.tint, usage: r.usage ?? 0 } satisfies TypeProcessusDto;
};

/** Un type actif porte-t-il déjà ce libellé (à la casse près), en excluant éventuellement un identifiant ? */
async function libelleActifPris(k: Kdb, label: string, sauf?: string): Promise<boolean> {
  let q = k
    .selectFrom('types_processus')
    .select(sql<number>`1`.as('x'))
    .where(sql<string>`lower(label)`, '=', sql<string>`lower(${label})`)
    .where('archived', '=', false);
  if (sauf) q = q.where('id', '<>', sauf);
  return (await q.executeTakeFirst()) !== undefined;
}

/** Contrôle du type d'un processus : vide, inchangé ou type actif du registre (422 sinon). */
export async function verifierTypeProcessus(
  c: Pick<Client, 'query'>,
  famille: unknown,
  ancienne?: unknown,
): Promise<void> {
  if (typeof famille !== 'string' || !famille || famille === ancienne) return;
  const ok = await surConnexion(c)
    .selectFrom('types_processus')
    .select('id')
    .where('code', '=', famille)
    .where('archived', '=', false)
    .executeTakeFirst();
  if (!ok) throw new HttpError(422, 'Type de processus inconnu ou archivé.');
}

export class TypesProcessus {
  constructor(private readonly db: Db) {}

  async lister(): Promise<TypeProcessusDto[]> {
    const rows = await selectionner(this.db.k)
      .orderBy('t.archived')
      .orderBy('t.rank')
      .orderBy(sql`lower(t.label)`)
      .execute();
    return rows.map(versDto);
  }

  async creer(body: TypeProcessusBody, user: Actor, ip: string): Promise<TypeProcessusDto> {
    return this.db.tx(async (c, k) => {
      const existants = (await k.selectFrom('types_processus').select('code').execute()).map((r) => r.code);
      if (await libelleActifPris(k, body.label))
        throw new HttpError(409, 'Un type de processus porte déjà ce libellé.');
      const code = codeDepuisLibelle(body.label, existants);
      const { n: rang } = await k
        .selectFrom('types_processus')
        .select(sql<number>`coalesce(max(rank), 0)::int + 1`.as('n'))
        .executeTakeFirstOrThrow();
      const { id } = await k
        .insertInto('types_processus')
        .values({
          code,
          label: body.label,
          description: body.description,
          tint: body.tint,
          rank: rang,
          created_by: user.username,
          updated_by: user.username,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.db.audit(user, ip, 'admin.type_processus_created', id, { code, label: body.label }, c);
      return this.lire(k, id);
    }, user.username);
  }

  async modifier(id: string, patch: TypeProcessusPatch, user: Actor, ip: string): Promise<TypeProcessusDto> {
    if (!Object.keys(patch).length) throw new HttpError(422, 'Aucune modification.');
    return this.db.tx(async (c, k) => {
      const avant = await this.lire(k, id);
      if (patch.label !== undefined && (await libelleActifPris(k, patch.label, id)))
        throw new HttpError(409, 'Un type de processus porte déjà ce libellé.');
      if (patch.archived === false && avant.archived && (await libelleActifPris(k, patch.label ?? avant.label, id)))
        throw new HttpError(409, 'Un type actif porte déjà ce libellé : renommez avant de restaurer.');
      await k
        .updateTable('types_processus')
        .set({
          label: patch.label ?? avant.label,
          description: patch.description ?? avant.description,
          tint: patch.tint ?? avant.tint,
          archived: patch.archived ?? avant.archived,
          updated_by: user.username,
          updated_at: sql<Date>`now()`,
        })
        .where('id', '=', id)
        .execute();
      await this.db.audit(user, ip, 'admin.type_processus_updated', id, { code: avant.code, patch }, c);
      return this.lire(k, id);
    }, user.username);
  }

  /** Nouvel ordre d'affichage : la liste complète des identifiants, sans oubli ni doublon. */
  async ordonner(ids: string[], user: Actor, ip: string): Promise<TypeProcessusDto[]> {
    await this.db.tx(async (c, k) => {
      const connus = (await k.selectFrom('types_processus').select('id').execute()).map((r) => r.id);
      if (new Set(ids).size !== ids.length || ids.length !== connus.length || ids.some((i) => !connus.includes(i)))
        throw new HttpError(422, 'L’ordre doit reprendre chaque type exactement une fois.');
      for (const [i, id] of ids.entries())
        await k
          .updateTable('types_processus')
          .set({ rank: i + 1, updated_by: user.username, updated_at: sql<Date>`now()` })
          .where('id', '=', id)
          .execute();
      await this.db.audit(user, ip, 'admin.type_processus_ordered', '', { ids }, c);
    }, user.username);
    return this.lister();
  }

  /** Suppression : seulement un type qu'aucun processus ne porte (sinon on l'archive). */
  async supprimer(id: string, user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      const t = await this.lire(k, id);
      if (t.usage > 0)
        throw new HttpError(409, `${t.usage} processus portent ce type : archivez-le plutôt que de le supprimer.`);
      await k.deleteFrom('types_processus').where('id', '=', id).execute();
      await this.db.audit(user, ip, 'admin.type_processus_deleted', id, { code: t.code, label: t.label }, c);
    }, user.username);
  }

  private async lire(k: Kdb, id: string): Promise<TypeProcessusDto> {
    const r = await selectionner(k).where('t.id', '=', id).executeTakeFirst();
    if (!r) throw new HttpError(404, 'Type de processus introuvable.');
    return versDto(r);
  }
}
