/* Annuaires de responsables : personnes, groupes et fonctions (migration 031). Le serveur est seul juge : un responsable
   de type groupe ou fonction doit exister et compter au moins une personne active ; pour une personne, l'identifiant
   historique `ownerId` reste la source des rappels. Un responsable n'est jamais une habilitation : désigner ou changer
   un responsable n'écrit dans aucune table de rôles, de groupes ou de droits de ressource. Les rappels d'un groupe ou d'une fonction vont aux
   personnes qui le composent au moment de l'envoi. Accès aux données en Kysely (ADR 0062). */
import { FonctionBody, type FonctionDto, type ResponsableRef, type ResponsablesProposables } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

/** Compte actif : ni désactivé ni expiré (alias « u » de la table users ; fragment constant, sans valeur). */
const actif = sql<boolean>`(NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at > now()))`;
const nomAffiche = sql<string>`coalesce(nullif(u.display_name, ''), u.username)`;
const memeNom = (nom: string) => sql<boolean>`lower(name) = lower(${nom})`;

export class GrcAnnuaires {
  constructor(private readonly g: Grc) {}

  /** Responsables proposables dans un périmètre : personnes autorisées, groupes et fonctions qui comptent du monde. */
  async proposables(smsi: string, user: SessionUser): Promise<ResponsablesProposables> {
    const utilisateurs = await this.g.owners(smsi, user);
    const k = this.g.db.k;
    const groupes = await k
      .selectFrom('groups as g')
      .leftJoin('user_groups as ug', 'ug.group_id', 'g.id')
      .leftJoin('users as u', (j) => j.onRef('u.id', '=', 'ug.user_id').on(actif))
      .select(['g.id', 'g.name', sql<number>`count(u.id)::int`.as('membres')])
      .groupBy('g.id')
      .orderBy(sql`lower(g.name)`)
      .execute();
    const fonctions = await k
      .selectFrom('fonctions as f')
      .leftJoin('fonction_membres as fm', 'fm.fonction_id', 'f.id')
      .leftJoin('users as u', (j) => j.onRef('u.id', '=', 'fm.user_id').on(actif))
      .select(['f.id', 'f.name', sql<number>`count(u.id)::int`.as('membres')])
      .where('f.archived', '=', false)
      .groupBy('f.id')
      .orderBy(sql`lower(f.name)`)
      .execute();
    return { utilisateurs, groupes, fonctions };
  }

  /** Personnes actives que désigne un responsable ; erreur 422 si la cible n'existe pas ou ne compte personne. */
  async resoudre(smsi: string, ref: ResponsableRef, c: Client): Promise<string[]> {
    if (ref.type === 'utilisateur') {
      await this.g.checkOwner(smsi, ref.id, c);
      return [ref.id];
    }
    const k = surConnexion(c);
    const rows =
      ref.type === 'groupe'
        ? await k
            .selectFrom('user_groups as ug')
            .innerJoin('users as u', 'u.id', 'ug.user_id')
            .select('u.id')
            .where('ug.group_id', '=', ref.id)
            .where(actif)
            .execute()
        : await k
            .selectFrom('fonction_membres as fm')
            .innerJoin('users as u', 'u.id', 'fm.user_id')
            .innerJoin('fonctions as f', 'f.id', 'fm.fonction_id')
            .select('u.id')
            .where('fm.fonction_id', '=', ref.id)
            .where('f.archived', '=', false)
            .where(actif)
            .execute();
    const existe =
      ref.type === 'groupe'
        ? await k.selectFrom('groups').select('id').where('id', '=', ref.id).executeTakeFirst()
        : await k
            .selectFrom('fonctions')
            .select('id')
            .where('id', '=', ref.id)
            .where('archived', '=', false)
            .executeTakeFirst();
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
    const k = this.g.db.k;
    const r =
      ref.type === 'utilisateur'
        ? await k.selectFrom('users as u').select(nomAffiche.as('l')).where('u.id', '=', ref.id).executeTakeFirst()
        : ref.type === 'groupe'
          ? await k.selectFrom('groups').select('name as l').where('id', '=', ref.id).executeTakeFirst()
          : await k.selectFrom('fonctions').select('name as l').where('id', '=', ref.id).executeTakeFirst();
    return r?.l ?? null;
  }

  /* --------------------------------------------------------------------------------------- gestion des fonctions */
  private async dto(id: string, k: Kdb = this.g.db.k): Promise<FonctionDto> {
    const f = await k
      .selectFrom('fonctions')
      .select(['id', 'name', 'description', 'archived'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!f) throw new HttpError(404, 'Fonction introuvable.');
    const members = await k
      .selectFrom('fonction_membres as fm')
      .innerJoin('users as u', 'u.id', 'fm.user_id')
      .select(['u.id', 'u.username', nomAffiche.as('displayName')])
      .where('fm.fonction_id', '=', id)
      .orderBy(sql`lower(u.username)`)
      .execute();
    return { ...f, members };
  }
  async lister(): Promise<FonctionDto[]> {
    const ids = await this.g.db.k
      .selectFrom('fonctions')
      .select('id')
      .orderBy('archived')
      .orderBy(sql`lower(name)`)
      .execute();
    return Promise.all(ids.map((r) => this.dto(r.id)));
  }
  private async membres(k: Kdb, id: string, users: string[]) {
    const uniques = [...new Set(users)];
    if (uniques.length) {
      const ok = await k.selectFrom('users').select('id').where('id', 'in', uniques).execute();
      if (ok.length !== uniques.length) throw new HttpError(422, 'Compte inconnu.');
    }
    await k.deleteFrom('fonction_membres').where('fonction_id', '=', id).execute();
    for (const u of uniques) await k.insertInto('fonction_membres').values({ fonction_id: id, user_id: u }).execute();
  }
  async creer(input: FonctionBody, user: SessionUser, ip: string) {
    const b = FonctionBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      const doublon = await k
        .selectFrom('fonctions')
        .select('id')
        .where(memeNom(b.name))
        .where('archived', '=', false)
        .executeTakeFirst();
      if (doublon) throw new HttpError(409, 'Une fonction porte déjà ce nom.');
      const { id } = await k
        .insertInto('fonctions')
        .values({ name: b.name, description: b.description, created_by: user.username, updated_by: user.username })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.membres(k, id, b.members);
      await this.g.db.audit(user, ip, 'fonction.creee', id, { nom: b.name, membres: b.members.length }, c);
      return this.dto(id, k);
    }, user.username);
  }
  async modifier(id: string, input: FonctionBody, user: SessionUser, ip: string) {
    const b = FonctionBody.parse(input);
    return this.g.db.tx(async (c, k) => {
      const f = await k.selectFrom('fonctions').select('archived').where('id', '=', id).forUpdate().executeTakeFirst();
      if (!f) throw new HttpError(404, 'Fonction introuvable.');
      if (f.archived) throw new HttpError(409, 'Fonction archivée.');
      const doublon = await k
        .selectFrom('fonctions')
        .select('id')
        .where(memeNom(b.name))
        .where('archived', '=', false)
        .where('id', '<>', id)
        .executeTakeFirst();
      if (doublon) throw new HttpError(409, 'Une fonction porte déjà ce nom.');
      await k
        .updateTable('fonctions')
        .set({ name: b.name, description: b.description, updated_by: user.username, updated_at: sql<Date>`now()` })
        .where('id', '=', id)
        .execute();
      await this.membres(k, id, b.members);
      await this.g.db.audit(user, ip, 'fonction.modifiee', id, { nom: b.name, membres: b.members.length }, c);
      return this.dto(id, k);
    }, user.username);
  }
  async archiver(id: string, user: SessionUser, ip: string) {
    await this.g.db.tx(async (c, k) => {
      const r = await k
        .updateTable('fonctions')
        .set({ archived: true, updated_by: user.username, updated_at: sql<Date>`now()` })
        .where('id', '=', id)
        .where('archived', '=', false)
        .executeTakeFirst();
      if (!Number(r.numUpdatedRows)) throw new HttpError(404, 'Fonction introuvable.');
      await this.g.db.audit(user, ip, 'fonction.archivee', id, {}, c);
    }, user.username);
  }
}
