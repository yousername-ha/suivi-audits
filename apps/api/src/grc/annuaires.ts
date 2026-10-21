/* Annuaires de responsables : personnes, groupes et fonctions (migration 031). Le serveur est seul juge : un responsable
   de type groupe ou fonction doit exister et compter au moins une personne active ; pour une personne, l'identifiant
   historique `ownerId` reste la source des rappels. Un responsable n'est jamais une habilitation : désigner ou changer
   un responsable n'écrit dans aucune table de rôles, de groupes ou de droits de ressource. Les rappels d'un groupe ou d'une fonction vont aux
   personnes qui le composent au moment de l'envoi. */
import { FonctionBody, type FonctionDto, type ResponsableRef, type ResponsablesProposables } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

const ACTIF = '(NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()))';

export class GrcAnnuaires {
  constructor(private readonly g: Grc) {}

  /** Responsables proposables dans un périmètre : personnes autorisées, groupes et fonctions qui comptent du monde. */
  async proposables(smsi: string, user: SessionUser): Promise<ResponsablesProposables> {
    const utilisateurs = await this.g.owners(smsi, user);
    const groupes = (
      await this.g.db.q<{ id: string; name: string; membres: number }>(
        `SELECT g.id,g.name,count(u.id)::int AS membres FROM groups g
           LEFT JOIN user_groups ug ON ug.group_id=g.id LEFT JOIN users u ON u.id=ug.user_id AND ${ACTIF}
          GROUP BY g.id ORDER BY lower(g.name)`,
      )
    ).rows;
    const fonctions = (
      await this.g.db.q<{ id: string; name: string; membres: number }>(
        `SELECT f.id,f.name,count(u.id)::int AS membres FROM fonctions f
           LEFT JOIN fonction_membres fm ON fm.fonction_id=f.id LEFT JOIN users u ON u.id=fm.user_id AND ${ACTIF}
          WHERE NOT f.archived GROUP BY f.id ORDER BY lower(f.name)`,
      )
    ).rows;
    return { utilisateurs, groupes, fonctions };
  }

  /** Personnes actives que désigne un responsable ; erreur 422 si la cible n'existe pas ou ne compte personne. */
  async resoudre(smsi: string, ref: ResponsableRef, c: Client): Promise<string[]> {
    if (ref.type === 'utilisateur') {
      await this.g.checkOwner(smsi, ref.id, c);
      return [ref.id];
    }
    const rows =
      ref.type === 'groupe'
        ? (
            await c.query<{ id: string }>(
              `SELECT u.id FROM user_groups ug JOIN users u ON u.id=ug.user_id WHERE ug.group_id=$1 AND ${ACTIF}`,
              [ref.id],
            )
          ).rows
        : (
            await c.query<{ id: string }>(
              `SELECT u.id FROM fonction_membres fm JOIN users u ON u.id=fm.user_id
                 JOIN fonctions f ON f.id=fm.fonction_id WHERE fm.fonction_id=$1 AND NOT f.archived AND ${ACTIF}`,
              [ref.id],
            )
          ).rows;
    const existe =
      ref.type === 'groupe'
        ? (await c.query('SELECT 1 FROM groups WHERE id=$1', [ref.id])).rowCount
        : (await c.query('SELECT 1 FROM fonctions WHERE id=$1 AND NOT archived', [ref.id])).rowCount;
    if (!existe) throw new HttpError(422, ref.type === 'groupe' ? 'Groupe introuvable.' : 'Fonction introuvable.');
    if (!rows.length)
      throw new HttpError(
        422,
        `${ref.type === 'groupe' ? 'Ce groupe' : 'Cette fonction'} ne compte aucune personne active : désignez un responsable qui peut agir.`,
      );
    return rows.map((r) => r.id);
  }

  /** Contrôle et normalise le responsable d'une fiche : une seule désignation, `ownerId` cohérent avec une personne. */
  async normaliser(smsi: string, d: { ownerId: string | null; responsable?: ResponsableRef | null }, c: Client) {
    if (!d.responsable) return;
    if (d.responsable.type === 'utilisateur') {
      if (d.ownerId && d.ownerId !== d.responsable.id)
        throw new HttpError(422, 'Un seul responsable : la personne désignée doit être celle du champ responsable.');
      d.ownerId = d.responsable.id;
    } else if (d.ownerId)
      throw new HttpError(422, 'Un seul responsable : retirez la personne pour désigner un groupe ou une fonction.');
    await this.resoudre(smsi, d.responsable, c);
  }

  /** Libellé d'un responsable pour l'affichage (null si la cible a disparu). */
  async libelle(ref: ResponsableRef): Promise<string | null> {
    const sql =
      ref.type === 'utilisateur'
        ? "SELECT coalesce(nullif(display_name,''),username) AS l FROM users WHERE id=$1"
        : ref.type === 'groupe'
          ? 'SELECT name AS l FROM groups WHERE id=$1'
          : 'SELECT name AS l FROM fonctions WHERE id=$1';
    return (await this.g.db.one<{ l: string }>(sql, [ref.id]))?.l ?? null;
  }

  /* --------------------------------------------------------------------------------------- gestion des fonctions */
  private async dto(id: string, c?: Client): Promise<FonctionDto> {
    const q = c ?? this.g.db.pool;
    const f = (
      await q.query<Omit<FonctionDto, 'members'>>('SELECT id,name,description,archived FROM fonctions WHERE id=$1', [
        id,
      ])
    ).rows[0];
    if (!f) throw new HttpError(404, 'Fonction introuvable.');
    const members = (
      await q.query<FonctionDto['members'][number]>(
        `SELECT u.id,u.username,coalesce(nullif(u.display_name,''),u.username) AS "displayName" FROM fonction_membres fm
           JOIN users u ON u.id=fm.user_id WHERE fm.fonction_id=$1 ORDER BY lower(u.username)`,
        [id],
      )
    ).rows;
    return { ...f, members };
  }
  async lister(): Promise<FonctionDto[]> {
    const ids = (await this.g.db.q<{ id: string }>('SELECT id FROM fonctions ORDER BY archived,lower(name)')).rows;
    return Promise.all(ids.map((r) => this.dto(r.id)));
  }
  private async membres(c: Client, id: string, users: string[]) {
    const uniques = [...new Set(users)];
    if (uniques.length) {
      const ok = (await c.query('SELECT 1 FROM users WHERE id=ANY($1::uuid[])', [uniques])).rowCount;
      if (ok !== uniques.length) throw new HttpError(422, 'Compte inconnu.');
    }
    await c.query('DELETE FROM fonction_membres WHERE fonction_id=$1', [id]);
    for (const u of uniques) await c.query('INSERT INTO fonction_membres(fonction_id,user_id) VALUES($1,$2)', [id, u]);
  }
  async creer(input: FonctionBody, user: SessionUser, ip: string) {
    const b = FonctionBody.parse(input);
    return this.g.db.tx(async (c) => {
      if ((await c.query('SELECT 1 FROM fonctions WHERE lower(name)=lower($1) AND NOT archived', [b.name])).rowCount)
        throw new HttpError(409, 'Une fonction porte déjà ce nom.');
      const id = (
        await c.query<{ id: string }>(
          'INSERT INTO fonctions(name,description,created_by,updated_by) VALUES($1,$2,$3,$3) RETURNING id',
          [b.name, b.description, user.username],
        )
      ).rows[0]!.id;
      await this.membres(c, id, b.members);
      await this.g.db.audit(user, ip, 'fonction.creee', id, { nom: b.name, membres: b.members.length }, c);
      return this.dto(id, c);
    }, user.username);
  }
  async modifier(id: string, input: FonctionBody, user: SessionUser, ip: string) {
    const b = FonctionBody.parse(input);
    return this.g.db.tx(async (c) => {
      const f = (await c.query<{ archived: boolean }>('SELECT archived FROM fonctions WHERE id=$1 FOR UPDATE', [id]))
        .rows[0];
      if (!f) throw new HttpError(404, 'Fonction introuvable.');
      if (f.archived) throw new HttpError(409, 'Fonction archivée.');
      if (
        (await c.query('SELECT 1 FROM fonctions WHERE lower(name)=lower($1) AND NOT archived AND id<>$2', [b.name, id]))
          .rowCount
      )
        throw new HttpError(409, 'Une fonction porte déjà ce nom.');
      await c.query('UPDATE fonctions SET name=$2,description=$3,updated_by=$4,updated_at=now() WHERE id=$1', [
        id,
        b.name,
        b.description,
        user.username,
      ]);
      await this.membres(c, id, b.members);
      await this.g.db.audit(user, ip, 'fonction.modifiee', id, { nom: b.name, membres: b.members.length }, c);
      return this.dto(id, c);
    }, user.username);
  }
  async archiver(id: string, user: SessionUser, ip: string) {
    await this.g.db.tx(async (c) => {
      const r = await c.query(
        'UPDATE fonctions SET archived=true,updated_by=$2,updated_at=now() WHERE id=$1 AND NOT archived',
        [id, user.username],
      );
      if (!r.rowCount) throw new HttpError(404, 'Fonction introuvable.');
      await this.g.db.audit(user, ip, 'fonction.archivee', id, {}, c);
    }, user.username);
  }
}
