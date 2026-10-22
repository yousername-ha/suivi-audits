/* Registre des types de processus (Plateforme). Le serveur est seul juge : un processus ne peut porter qu'un type actif
   (ou celui qu'il portait déjà), un type utilisé ne se supprime pas (il s'archive), le code ne change jamais. */
import {
  codeDepuisLibelle,
  type TypeProcessusBody,
  type TypeProcessusDto,
  type TypeProcessusPatch,
} from '@suivi/shared';
import type { Actor, Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';

const COLONNES = `t.id, t.code, t.label, t.description, t.tint, t.rank, t.archived,
  (SELECT count(*) FROM suivi_processus p WHERE p.family = t.code)::int AS usage`;

/** Contrôle du type d'un processus : vide, inchangé ou type actif du registre (422 sinon). */
export async function verifierTypeProcessus(
  c: Pick<Client, 'query'>,
  famille: unknown,
  ancienne?: unknown,
): Promise<void> {
  if (typeof famille !== 'string' || !famille || famille === ancienne) return;
  const ok = await c.query('SELECT 1 FROM types_processus WHERE code=$1 AND NOT archived', [famille]);
  if (!ok.rowCount) throw new HttpError(422, 'Type de processus inconnu ou archivé.');
}

export class TypesProcessus {
  constructor(private readonly db: Db) {}

  async lister(): Promise<TypeProcessusDto[]> {
    return (
      await this.db.q<TypeProcessusDto>(
        `SELECT ${COLONNES} FROM types_processus t ORDER BY t.archived, t.rank, lower(t.label)`,
      )
    ).rows;
  }

  async creer(body: TypeProcessusBody, user: Actor, ip: string): Promise<TypeProcessusDto> {
    return this.db.tx(async (c) => {
      const existants = (await c.query<{ code: string }>('SELECT code FROM types_processus')).rows.map((r) => r.code);
      const doublon = await c.query('SELECT 1 FROM types_processus WHERE lower(label)=lower($1) AND NOT archived', [
        body.label,
      ]);
      if (doublon.rowCount) throw new HttpError(409, 'Un type de processus porte déjà ce libellé.');
      const code = codeDepuisLibelle(body.label, existants);
      const rang = (await c.query<{ n: number }>('SELECT coalesce(max(rank),0)::int+1 AS n FROM types_processus'))
        .rows[0]!.n;
      const id = (
        await c.query<{ id: string }>(
          `INSERT INTO types_processus (code,label,description,tint,rank,created_by,updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
          [code, body.label, body.description, body.tint, rang, user.username],
        )
      ).rows[0]!.id;
      await this.db.audit(user, ip, 'admin.type_processus_created', id, { code, label: body.label }, c);
      return this.lire(c, id);
    }, user.username);
  }

  async modifier(id: string, patch: TypeProcessusPatch, user: Actor, ip: string): Promise<TypeProcessusDto> {
    if (!Object.keys(patch).length) throw new HttpError(422, 'Aucune modification.');
    return this.db.tx(async (c) => {
      const avant = await this.lire(c, id);
      if (patch.label !== undefined) {
        const doublon = await c.query(
          'SELECT 1 FROM types_processus WHERE lower(label)=lower($1) AND NOT archived AND id<>$2',
          [patch.label, id],
        );
        if (doublon.rowCount) throw new HttpError(409, 'Un type de processus porte déjà ce libellé.');
      }
      if (patch.archived === false && avant.archived) {
        const doublon = await c.query(
          'SELECT 1 FROM types_processus WHERE lower(label)=lower($1) AND NOT archived AND id<>$2',
          [patch.label ?? avant.label, id],
        );
        if (doublon.rowCount)
          throw new HttpError(409, 'Un type actif porte déjà ce libellé : renommez avant de restaurer.');
      }
      await c.query(
        `UPDATE types_processus SET label=$2, description=$3, tint=$4, archived=$5, updated_by=$6, updated_at=now() WHERE id=$1`,
        [
          id,
          patch.label ?? avant.label,
          patch.description ?? avant.description,
          patch.tint ?? avant.tint,
          patch.archived ?? avant.archived,
          user.username,
        ],
      );
      await this.db.audit(user, ip, 'admin.type_processus_updated', id, { code: avant.code, patch }, c);
      return this.lire(c, id);
    }, user.username);
  }

  /** Nouvel ordre d'affichage : la liste complète des identifiants, sans oubli ni doublon. */
  async ordonner(ids: string[], user: Actor, ip: string): Promise<TypeProcessusDto[]> {
    await this.db.tx(async (c) => {
      const connus = (await c.query<{ id: string }>('SELECT id FROM types_processus')).rows.map((r) => r.id);
      if (new Set(ids).size !== ids.length || ids.length !== connus.length || ids.some((i) => !connus.includes(i)))
        throw new HttpError(422, 'L’ordre doit reprendre chaque type exactement une fois.');
      for (const [i, id] of ids.entries())
        await c.query('UPDATE types_processus SET rank=$2, updated_by=$3, updated_at=now() WHERE id=$1', [
          id,
          i + 1,
          user.username,
        ]);
      await this.db.audit(user, ip, 'admin.type_processus_ordered', '', { ids }, c);
    }, user.username);
    return this.lister();
  }

  /** Suppression : seulement un type qu'aucun processus ne porte (sinon on l'archive). */
  async supprimer(id: string, user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c) => {
      const t = await this.lire(c, id);
      if (t.usage > 0)
        throw new HttpError(409, `${t.usage} processus portent ce type : archivez-le plutôt que de le supprimer.`);
      await c.query('DELETE FROM types_processus WHERE id=$1', [id]);
      await this.db.audit(user, ip, 'admin.type_processus_deleted', id, { code: t.code, label: t.label }, c);
    }, user.username);
  }

  private async lire(c: Client, id: string): Promise<TypeProcessusDto> {
    const r = (await c.query<TypeProcessusDto>(`SELECT ${COLONNES} FROM types_processus t WHERE t.id=$1`, [id]))
      .rows[0];
    if (!r) throw new HttpError(404, 'Type de processus introuvable.');
    return r;
  }
}
