/* Notifications métier (décision 012-10 du 26/10/2026, ADR 0058) : réglage tri-état par groupe, par rôle et par utilisateur,
   résolution par la fonction pure du paquet partagé, et diffusion des notifications émises (canal « application » : visibilité
   dans Rappels ; canal « courriel » : demande déposée dans la file de l'exécutant d'exploitation, jamais d'envoi par l'API).

   La notification est toujours enregistrée dans grc_notifications (c'est ce qui évite un doublon au passage suivant) ; les
   canaux ne décident que de sa visibilité et de l'envoi d'un courriel. Un échec d'envoi n'affecte jamais la notification. */
import {
  NOTIFICATION_CANAUX,
  NOTIFICATION_LIEN,
  NOTIFICATION_TYPES,
  isNotificationType,
  notificationLabel,
  resoudreNotification,
  type ApercuDestinatairesDto,
  type CanalCourrielDto,
  type ChangementReglage,
  type DestinataireApercuDto,
  type EffectifDto,
  type HeritageReglage,
  type NotificationCanal,
  type NotificationType,
  type PorteeKind,
  type PorteeListeDto,
  type ReglageDto,
  type ReglagesPorteeDto,
  type ResolutionNotification,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import { surConnexion, type Actor, type Client, type Db, type Kdb } from './db/db.js';
import { HttpError } from './http/errors.js';
import { conflict } from './http/concurrency.js';
import type { Settings } from './settings.js';

type Q = Pick<Client, 'query'>;
/** Compte actif : ni désactivé, ni expiré (fragment SQL fixe sur l'alias u). */
export const COMPTE_ACTIF = sql<boolean>`(NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at > now()))`;
/** Comptes actifs portant un rôle, directement ou par un de leurs groupes (fragment sur l'alias u, rôle lié). */
export const porteLeRole = (role: RawBuilder<unknown>) =>
  sql<boolean>`(EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = ${role})
    OR EXISTS (SELECT 1 FROM user_groups ug JOIN group_roles gr ON gr.group_id = ug.group_id
               WHERE ug.user_id = u.id AND gr.role_id = ${role}))`;

/** Une notification vient d'être créée (INSERT … RETURNING) : à diffuser. */
export interface NotificationEmise {
  id: string;
  userId: string;
  kind: string;
}

interface LigneHeritage {
  user_id: string;
  kind: 'groupe' | 'role';
  id: string;
  nom: string;
  type: string;
  canal: NotificationCanal;
  valeur: boolean;
}
interface LignePerso {
  user_id: string;
  type: string;
  canal: NotificationCanal;
  valeur: boolean;
}
interface Contexte {
  perso: Map<string, boolean>;
  heritages: Map<string, HeritageReglage[]>;
}
const cle = (type: string, canal: string) => `${type}/${canal}`;
const MESSAGE_COURRIEL_INACTIF = 'Courriel non configuré : le réglage est enregistré, mais rien n’est envoyé.';
const MESSAGE_COURRIEL_ACTIF = 'Le courriel est configuré : les notifications activées sont envoyées par le serveur.';
/** Une demande de courriel de notification plus ancienne que cela et toujours en attente est abandonnée (exécutant absent). */
export const EXPIRATION_NOTIFICATION_JOURS = 3;

export class NotificationsMetier {
  constructor(
    private readonly db: Db,
    private readonly settings: Pick<Settings, 'get'>,
    private readonly publicUrl: string,
  ) {}

  /* ---------------------------------------------------------------- Canal courriel */
  courrielOperationnel(): boolean {
    const c = this.settings.get('courriel');
    return !!(c.actif && c.hote && c.expediteur);
  }
  canalCourriel(): CanalCourrielDto {
    const actif = this.courrielOperationnel();
    return { actif, message: actif ? MESSAGE_COURRIEL_ACTIF : MESSAGE_COURRIEL_INACTIF };
  }

  /* ---------------------------------------------------------------- Résolution */
  /** Réglages personnels et hérités (groupes, rôles directs ou portés par un groupe) d'un ensemble de comptes. */
  private async contextes(q: Q, userIds: readonly string[]): Promise<Map<string, Contexte>> {
    const out = new Map<string, Contexte>(userIds.map((id) => [id, { perso: new Map(), heritages: new Map() }]));
    if (!userIds.length) return out;
    const perso: LignePerso[] = await surConnexion(q)
      .selectFrom('notification_reglages')
      .select(['portee_id as user_id', 'type', 'canal', 'valeur'])
      .where('portee_kind', '=', 'utilisateur')
      .where('portee_id', 'in', [...userIds])
      .execute();
    for (const r of perso) out.get(r.user_id)?.perso.set(cle(r.type, r.canal), r.valeur);
    // Héritages par groupe et par rôle (direct ou porté par un groupe) : union de deux sources et d'une sous-union,
    // gardée en SQL paramétré (ADR 0062 §5).
    const heritees = await q.query<LigneHeritage>(
      `SELECT ug.user_id::text AS user_id, 'groupe' AS kind, g.id::text AS id, g.name AS nom, r.type, r.canal, r.valeur
         FROM user_groups ug JOIN groups g ON g.id = ug.group_id
         JOIN notification_reglages r ON r.portee_kind='groupe' AND r.portee_id = g.id::text
        WHERE ug.user_id = ANY($1::uuid[])
       UNION ALL
       SELECT x.user_id::text, 'role', ro.id, ro.name, r.type, r.canal, r.valeur
         FROM (SELECT user_id, role_id FROM user_roles WHERE user_id = ANY($1::uuid[])
               UNION
               SELECT ug.user_id, gr.role_id FROM user_groups ug JOIN group_roles gr ON gr.group_id = ug.group_id
                WHERE ug.user_id = ANY($1::uuid[])) x
         JOIN roles ro ON ro.id = x.role_id
         JOIN notification_reglages r ON r.portee_kind='role' AND r.portee_id = ro.id`,
      [userIds],
    );
    for (const h of heritees.rows) {
      const m = out.get(h.user_id)!.heritages;
      const k = cle(h.type, h.canal);
      m.set(k, [...(m.get(k) ?? []), { kind: h.kind, id: h.id, nom: h.nom, valeur: h.valeur }]);
    }
    return out;
  }

  private resoudre(ctx: Contexte, type: string, canal: NotificationCanal): ResolutionNotification {
    return resoudreNotification(
      ctx.perso.get(cle(type, canal)) ?? null,
      ctx.heritages.get(cle(type, canal)) ?? [],
      canal,
    );
  }

  /** Résultat effectif (type × canal) d'un compte. */
  async effectifs(q: Q, userId: string): Promise<EffectifDto[]> {
    const ctx = (await this.contextes(q, [userId])).get(userId)!;
    return NOTIFICATION_TYPES.flatMap((t) =>
      NOTIFICATION_CANAUX.map((canal) => ({ type: t.id, canal, ...this.resoudre(ctx, t.id, canal) })),
    );
  }

  /* ---------------------------------------------------------------- Lecture et écriture des réglages */
  private async nomPortee(q: Q, kind: PorteeKind, id: string): Promise<string> {
    // Identifiant comparé en texte : un identifiant qui n'est pas un UUID donne « introuvable », pas une erreur.
    const k = surConnexion(q);
    const r =
      kind === 'groupe'
        ? await k
            .selectFrom('groups')
            .select('name as n')
            .where(sql`id::text`, '=', id)
            .executeTakeFirst()
        : kind === 'role'
          ? await k.selectFrom('roles').select('name as n').where('id', '=', id).executeTakeFirst()
          : await k
              .selectFrom('users')
              .select(sql<string>`CASE WHEN display_name <> '' THEN display_name ELSE username END`.as('n'))
              .where(sql`id::text`, '=', id)
              .executeTakeFirst();
    if (!r)
      throw new HttpError(
        404,
        kind === 'groupe' ? 'Groupe introuvable.' : kind === 'role' ? 'Rôle introuvable.' : 'Compte introuvable.',
      );
    return r.n;
  }

  private async reglagesDe(q: Q, kind: PorteeKind, id: string): Promise<ReglageDto[]> {
    const rows = await surConnexion(q)
      .selectFrom('notification_reglages')
      .select(['type', 'canal', 'valeur'])
      .where('portee_kind', '=', kind)
      .where('portee_id', '=', id)
      .execute();
    const map = new Map(rows.map((r) => [cle(r.type, r.canal), r.valeur]));
    return NOTIFICATION_TYPES.flatMap((t) =>
      NOTIFICATION_CANAUX.map((canal) => ({ type: t.id, canal, valeur: map.get(cle(t.id, canal)) ?? null })),
    );
  }

  private async versionDe(q: Q, kind: PorteeKind, id: string): Promise<number> {
    const r = await this.portee(surConnexion(q), kind, id).executeTakeFirst();
    return r?.version ?? 0;
  }
  private portee(k: Kdb, kind: PorteeKind, id: string) {
    return k
      .selectFrom('notification_portees')
      .select('version')
      .where('portee_kind', '=', kind)
      .where('portee_id', '=', id);
  }

  /** Nombre de comptes actifs concernés par un groupe ou un rôle. */
  private async membres(q: Q, kind: PorteeKind, id: string): Promise<number | undefined> {
    if (kind === 'utilisateur') return undefined;
    const k = surConnexion(q);
    const r =
      kind === 'groupe'
        ? await k
            .selectFrom('user_groups as ug')
            .innerJoin('users as u', 'u.id', 'ug.user_id')
            .select(sql<number>`count(*)::int`.as('n'))
            .where(sql`ug.group_id::text`, '=', id)
            .where(COMPTE_ACTIF)
            .executeTakeFirstOrThrow()
        : await k
            .selectFrom('users as u')
            .select(sql<number>`count(DISTINCT u.id)::int`.as('n'))
            .where(COMPTE_ACTIF)
            .where(porteLeRole(sql`${id}`))
            .executeTakeFirstOrThrow();
    return r.n;
  }

  async lirePortee(kind: PorteeKind, id: string, q: Q = this.db.pool): Promise<ReglagesPorteeDto> {
    const nom = await this.nomPortee(q, kind, id);
    const out: ReglagesPorteeDto = {
      portee: { kind, id, nom },
      version: await this.versionDe(q, kind, id),
      reglages: await this.reglagesDe(q, kind, id),
      courriel: this.canalCourriel(),
    };
    const membres = await this.membres(q, kind, id);
    if (membres !== undefined) out.membres = membres;
    if (kind === 'utilisateur') {
      out.effectifs = await this.effectifs(q, id);
      const u = await surConnexion(q)
        .selectFrom('users')
        .select('email')
        .where(sql`id::text`, '=', id)
        .executeTakeFirst();
      out.sansAdresse = !adresseUtilisable(u?.email ?? '');
    }
    return out;
  }

  /** Groupes et rôles réglables, avec le nombre de comptes actifs concernés. */
  async portees(): Promise<{ groupes: PorteeListeDto[]; roles: PorteeListeDto[] }> {
    const groupes = await this.db.k
      .selectFrom('groups as g')
      .select([
        sql<string>`g.id::text`.as('id'),
        'g.name as nom',
        sql<number>`(SELECT count(*)::int FROM user_groups ug JOIN users u ON u.id = ug.user_id
                      WHERE ug.group_id = g.id AND ${COMPTE_ACTIF})`.as('membres'),
      ])
      .orderBy(sql`lower(g.name)`)
      .execute();
    const roles = await this.db.k
      .selectFrom('roles as r')
      .select([
        'r.id',
        'r.name as nom',
        sql<number>`(SELECT count(*)::int FROM users u WHERE ${COMPTE_ACTIF} AND ${porteLeRole(sql`r.id`)})`.as(
          'membres',
        ),
      ])
      .orderBy(sql`lower(r.name)`)
      .execute();
    return {
      groupes: groupes.map((g) => ({ kind: 'groupe', ...g })),
      roles: roles.map((r) => ({ kind: 'role', ...r })),
    };
  }

  /** Enregistre des changements sur une portée : If-Match sur sa version, un seul passage d'audit, aucune adresse courriel. */
  async ecrire(
    kind: PorteeKind,
    id: string,
    changements: readonly ChangementReglage[],
    attendue: number,
    user: Actor,
    ip: string,
  ): Promise<ReglagesPorteeDto> {
    await this.db.tx(async (c, k) => {
      const nom = await this.nomPortee(c, kind, id);
      await k
        .insertInto('notification_portees')
        .values({ portee_kind: kind, portee_id: id, version: 0, updated_by: user.username })
        .onConflict((oc) => oc.doNothing())
        .execute();
      const courante = (await this.portee(k, kind, id).forUpdate().executeTakeFirstOrThrow()).version;
      if (courante !== attendue)
        throw conflict({ version: courante, reglages: await this.reglagesDe(c, kind, id) } as never);
      const avant = new Map((await this.reglagesDe(c, kind, id)).map((r) => [cle(r.type, r.canal), r.valeur]));
      const effectifs = changements.filter((ch) => (avant.get(cle(ch.type, ch.canal)) ?? null) !== ch.valeur);
      if (!effectifs.length) return;
      for (const ch of effectifs) {
        if (ch.valeur === null)
          await k
            .deleteFrom('notification_reglages')
            .where('portee_kind', '=', kind)
            .where('portee_id', '=', id)
            .where('type', '=', ch.type)
            .where('canal', '=', ch.canal)
            .execute();
        else
          await k
            .insertInto('notification_reglages')
            .values({
              portee_kind: kind,
              portee_id: id,
              type: ch.type,
              canal: ch.canal,
              valeur: ch.valeur,
              updated_by: user.username,
            })
            .onConflict((oc) =>
              oc.columns(['portee_kind', 'portee_id', 'type', 'canal']).doUpdateSet((eb) => ({
                valeur: eb.ref('excluded.valeur'),
                updated_by: eb.ref('excluded.updated_by'),
                updated_at: sql<Date>`now()`,
              })),
            )
            .execute();
      }
      await k
        .updateTable('notification_portees')
        .set((eb) => ({ version: eb('version', '+', 1), updated_by: user.username, updated_at: sql<Date>`now()` }))
        .where('portee_kind', '=', kind)
        .where('portee_id', '=', id)
        .execute();
      // Journal : qui a changé quoi, pour qui. Jamais d'adresse courriel : la cible est un nom de groupe, un identifiant de
      // rôle ou un identifiant de compte.
      const cible =
        kind === 'utilisateur'
          ? ((
              await k
                .selectFrom('users')
                .select('username')
                .where(sql`id::text`, '=', id)
                .executeTakeFirst()
            )?.username ?? id)
          : nom;
      await this.db.audit(
        user,
        ip,
        kind === 'utilisateur' && user.id === id ? 'notifications.reglages_personnels' : 'notifications.reglages',
        cible,
        {
          portee: kind,
          changements: effectifs.map((ch) => ({
            type: ch.type,
            canal: ch.canal,
            avant: avant.get(cle(ch.type, ch.canal)) ?? null,
            apres: ch.valeur,
          })),
        },
        c,
      );
    }, user.username);
    return this.lirePortee(kind, id);
  }

  /* ---------------------------------------------------------------- Aperçu « qui recevrait quoi » */
  async apercu(type: NotificationType, canal: NotificationCanal): Promise<ApercuDestinatairesDto> {
    const comptes = await this.db.k
      .selectFrom('users as u')
      .select([sql<string>`u.id::text`.as('id'), 'u.username', 'u.display_name', 'u.email'])
      .where(COMPTE_ACTIF)
      .orderBy(sql`lower(u.display_name)`)
      .orderBy(sql`lower(u.username)`)
      .execute();
    const ctx = await this.contextes(
      this.db.pool,
      comptes.map((u) => u.id),
    );
    const destinataires: DestinataireApercuDto[] = [];
    const exclus: DestinataireApercuDto[] = [];
    let autres = 0;
    for (const u of comptes) {
      const r = this.resoudre(ctx.get(u.id)!, type, canal);
      const ligne: DestinataireApercuDto = {
        userId: u.id,
        username: u.username,
        displayName: u.display_name || u.username,
        origine: r.origine,
        sources: r.sources,
        sansAdresse: !adresseUtilisable(u.email),
      };
      if (r.actif) destinataires.push(ligne);
      else if (r.exclu) exclus.push(ligne);
      else autres++;
    }
    return { type, canal, courriel: this.canalCourriel(), destinataires, exclus, autres };
  }

  /** Synthèse des envois de notification des sept derniers jours (administrateurs) : état de la file, jamais d'adresse. */
  async etatEnvois() {
    const k = this.db.k;
    const notifications = k
      .selectFrom('courriel_jobs')
      .where('kind', '=', 'notification')
      .where('requested_by', '<>', 'alerte-exploitation');
    const r = await notifications
      .select(['status', sql<number>`count(*)::int`.as('n')])
      .where('created_at', '>', sql<Date>`now() - interval '7 days'`)
      .groupBy('status')
      .execute();
    const n = Object.fromEntries(r.map((x) => [x.status, x.n])) as Record<string, number>;
    const relances = await notifications
      .select(sql<number>`count(*)::int`.as('n'))
      .where('status', '=', 'en_attente')
      .where('attempts', '>', 0)
      .executeTakeFirst();
    const derniere = await notifications
      .select([sql<string | null>`result->>'error'`.as('error'), 'finished_at as at'])
      .where('status', '=', 'echec')
      .orderBy('finished_at', (ob) => ob.desc().nullsLast())
      .limit(1)
      .executeTakeFirst();
    return {
      enAttente: (n.en_attente ?? 0) + (n.en_cours ?? 0),
      envoyees: n.reussie ?? 0,
      relances: relances?.n ?? 0,
      echecs: n.echec ?? 0,
      derniereErreur: derniere?.error ?? null,
      derniereErreurLe: derniere?.at ? derniere.at.toISOString() : null,
    };
  }

  /* ---------------------------------------------------------------- Diffusion */
  /** À appeler dans la transaction qui vient d'insérer des notifications (uniquement les lignes réellement créées). */
  async diffuser(c: Client, emises: readonly NotificationEmise[]): Promise<void> {
    const connues = emises.filter((n) => isNotificationType(n.kind));
    if (!connues.length) return;
    const ctx = await this.contextes(c, [...new Set(connues.map((n) => n.userId))]);
    const masquees = connues
      .filter((n) => !this.resoudre(ctx.get(n.userId)!, n.kind, 'application').actif)
      .map((n) => n.id);
    const k = surConnexion(c);
    if (masquees.length)
      await k.updateTable('grc_notifications').set({ canal_application: false }).where('id', 'in', masquees).execute();
    if (!this.courrielOperationnel()) return;
    const voulues = connues.filter((n) => this.resoudre(ctx.get(n.userId)!, n.kind, 'courriel').actif);
    if (!voulues.length) return;
    const comptes = new Map(
      (
        await k
          .selectFrom('users as u')
          .select([sql<string>`u.id::text`.as('id'), 'u.email'])
          .where('u.id', 'in', [...new Set(voulues.map((n) => n.userId))])
          .where(COMPTE_ACTIF)
          .execute()
      ).map((u) => [u.id, u.email.trim()]),
    );
    const titres = new Map(
      (
        await k
          .selectFrom('grc_notifications')
          .select([sql<string>`id::text`.as('id'), 'title'])
          .where(
            'id',
            'in',
            voulues.map((n) => n.id),
          )
          .execute()
      ).map((t) => [t.id, t.title]),
    );
    const appName = this.settings.get('general').appName;
    for (const n of voulues) {
      const adresse = comptes.get(n.userId);
      if (!adresse || !adresseUtilisable(adresse)) continue;
      const { objet, corps } = this.composer(n.kind as NotificationType, titres.get(n.id) ?? '', appName);
      await k
        .insertInto('courriel_jobs')
        .values({
          kind: 'notification',
          requested_by: 'système',
          to_address: adresse,
          notification_id: n.id,
          user_id: n.userId,
          subject: objet,
          body: corps,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  }

  /** Objet et corps en texte brut : aucune donnée métier (ni nom de mesure, de risque ou d'action), un titre court et un lien. */
  composer(type: NotificationType, titre: string, appName: string): { objet: string; corps: string } {
    const lien = this.publicUrl ? this.publicUrl + NOTIFICATION_LIEN : NOTIFICATION_LIEN;
    const court = titre.replace(/\s+/g, ' ').trim().slice(0, 80);
    const nom = appName.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Suivi des audits';
    return {
      objet: `${nom} : ${notificationLabel(type)}`.slice(0, 180),
      corps: [
        'Bonjour,',
        '',
        `Une notification est disponible dans ${nom}${court ? ` : ${court}` : ''}.`,
        '',
        `Pour la consulter, ouvrez l’application (rubrique Pilotage, Rappels) : ${lien}`,
        '',
        'Ce message ne contient aucun détail afin de ne pas exposer d’information sensible par courriel.',
        'Vous le recevez parce que les notifications par courriel sont activées pour vous (réglage de votre groupe, de votre rôle ou personnel).',
        'Pour les modifier : Mon compte, rubrique Notifications.',
        '',
      ].join('\n'),
    };
  }
}

/** Adresse exploitable pour un envoi : non vide, un seul « @ », pas de saut de ligne (injection d'en-tête). */
export function adresseUtilisable(adresse: string): boolean {
  const a = adresse.trim();
  return (
    a.length > 3 &&
    a.length <= 200 &&
    !/[\r\n\s,;<>]/.test(a) &&
    a.split('@').length === 2 &&
    !a.startsWith('@') &&
    !a.endsWith('@')
  );
}
