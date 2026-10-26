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
import type { Actor, Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import { conflict } from './http/concurrency.js';
import type { Settings } from './settings.js';

type Q = Pick<Client, 'query'>;

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
    const perso = await q.query<LignePerso>(
      `SELECT portee_id AS user_id, type, canal, valeur FROM notification_reglages
        WHERE portee_kind='utilisateur' AND portee_id = ANY($1::text[])`,
      [userIds],
    );
    for (const r of perso.rows) out.get(r.user_id)?.perso.set(cle(r.type, r.canal), r.valeur);
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
    const r =
      kind === 'groupe'
        ? await q.query<{ n: string }>('SELECT name AS n FROM groups WHERE id::text=$1', [id])
        : kind === 'role'
          ? await q.query<{ n: string }>('SELECT name AS n FROM roles WHERE id=$1', [id])
          : await q.query<{ n: string }>(
              "SELECT CASE WHEN display_name <> '' THEN display_name ELSE username END AS n FROM users WHERE id::text=$1",
              [id],
            );
    if (!r.rowCount)
      throw new HttpError(
        404,
        kind === 'groupe' ? 'Groupe introuvable.' : kind === 'role' ? 'Rôle introuvable.' : 'Compte introuvable.',
      );
    return r.rows[0]!.n;
  }

  private async reglagesDe(q: Q, kind: PorteeKind, id: string): Promise<ReglageDto[]> {
    const rows = (
      await q.query<{ type: string; canal: NotificationCanal; valeur: boolean }>(
        'SELECT type, canal, valeur FROM notification_reglages WHERE portee_kind=$1 AND portee_id=$2',
        [kind, id],
      )
    ).rows;
    const map = new Map(rows.map((r) => [cle(r.type, r.canal), r.valeur]));
    return NOTIFICATION_TYPES.flatMap((t) =>
      NOTIFICATION_CANAUX.map((canal) => ({ type: t.id, canal, valeur: map.get(cle(t.id, canal)) ?? null })),
    );
  }

  private async versionDe(q: Q, kind: PorteeKind, id: string): Promise<number> {
    const r = await q.query<{ version: number }>(
      'SELECT version FROM notification_portees WHERE portee_kind=$1 AND portee_id=$2',
      [kind, id],
    );
    return r.rows[0]?.version ?? 0;
  }

  /** Nombre de comptes actifs concernés par un groupe ou un rôle. */
  private async membres(q: Q, kind: PorteeKind, id: string): Promise<number | undefined> {
    if (kind === 'utilisateur') return undefined;
    const r = await q.query<{ n: number }>(
      kind === 'groupe'
        ? `SELECT count(*)::int AS n FROM user_groups ug JOIN users u ON u.id=ug.user_id
            WHERE ug.group_id::text=$1 AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now())`
        : `SELECT count(DISTINCT u.id)::int AS n FROM users u
            WHERE NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND (
              EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id=$1)
              OR EXISTS (SELECT 1 FROM user_groups ug JOIN group_roles gr ON gr.group_id=ug.group_id WHERE ug.user_id=u.id AND gr.role_id=$1))`,
      [id],
    );
    return r.rows[0]!.n;
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
      const u = await q.query<{ email: string }>('SELECT email FROM users WHERE id::text=$1', [id]);
      out.sansAdresse = !adresseUtilisable(u.rows[0]?.email ?? '');
    }
    return out;
  }

  /** Groupes et rôles réglables, avec le nombre de comptes actifs concernés. */
  async portees(): Promise<{ groupes: PorteeListeDto[]; roles: PorteeListeDto[] }> {
    const groupes = (
      await this.db.q<{ id: string; nom: string; membres: number }>(
        `SELECT g.id::text AS id, g.name AS nom,
                (SELECT count(*)::int FROM user_groups ug JOIN users u ON u.id=ug.user_id
                  WHERE ug.group_id=g.id AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now())) AS membres
           FROM groups g ORDER BY lower(g.name)`,
      )
    ).rows;
    const roles = (
      await this.db.q<{ id: string; nom: string; membres: number }>(
        `SELECT r.id, r.name AS nom,
                (SELECT count(*)::int FROM users u WHERE NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND (
                   EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id=r.id)
                   OR EXISTS (SELECT 1 FROM user_groups ug JOIN group_roles gr ON gr.group_id=ug.group_id
                               WHERE ug.user_id=u.id AND gr.role_id=r.id))) AS membres
           FROM roles r ORDER BY lower(r.name)`,
      )
    ).rows;
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
    await this.db.tx(async (c) => {
      const nom = await this.nomPortee(c, kind, id);
      await c.query(
        `INSERT INTO notification_portees (portee_kind, portee_id, version, updated_by) VALUES ($1,$2,0,$3) ON CONFLICT DO NOTHING`,
        [kind, id, user.username],
      );
      const courante = (
        await c.query<{ version: number }>(
          'SELECT version FROM notification_portees WHERE portee_kind=$1 AND portee_id=$2 FOR UPDATE',
          [kind, id],
        )
      ).rows[0]!.version;
      if (courante !== attendue)
        throw conflict({ version: courante, reglages: await this.reglagesDe(c, kind, id) } as never);
      const avant = new Map((await this.reglagesDe(c, kind, id)).map((r) => [cle(r.type, r.canal), r.valeur]));
      const effectifs = changements.filter((ch) => (avant.get(cle(ch.type, ch.canal)) ?? null) !== ch.valeur);
      if (!effectifs.length) return;
      for (const ch of effectifs) {
        if (ch.valeur === null)
          await c.query(
            'DELETE FROM notification_reglages WHERE portee_kind=$1 AND portee_id=$2 AND type=$3 AND canal=$4',
            [kind, id, ch.type, ch.canal],
          );
        else
          await c.query(
            `INSERT INTO notification_reglages (portee_kind, portee_id, type, canal, valeur, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (portee_kind, portee_id, type, canal)
             DO UPDATE SET valeur=EXCLUDED.valeur, updated_by=EXCLUDED.updated_by, updated_at=now()`,
            [kind, id, ch.type, ch.canal, ch.valeur, user.username],
          );
      }
      await c.query(
        'UPDATE notification_portees SET version=version+1, updated_by=$3, updated_at=now() WHERE portee_kind=$1 AND portee_id=$2',
        [kind, id, user.username],
      );
      // Journal : qui a changé quoi, pour qui. Jamais d'adresse courriel : la cible est un nom de groupe, un identifiant de
      // rôle ou un identifiant de compte.
      const cible =
        kind === 'utilisateur'
          ? ((await c.query<{ u: string }>('SELECT username AS u FROM users WHERE id::text=$1', [id])).rows[0]?.u ?? id)
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
    const comptes = (
      await this.db.q<{ id: string; username: string; display_name: string; email: string }>(
        `SELECT id::text AS id, username, display_name, email FROM users
          WHERE NOT disabled AND (expires_at IS NULL OR expires_at > now()) ORDER BY lower(display_name), lower(username)`,
      )
    ).rows;
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
    const r = await this.db.q<{ status: string; n: number }>(
      `SELECT status, count(*)::int AS n FROM courriel_jobs
        WHERE kind='notification' AND created_at > now() - interval '7 days' GROUP BY status`,
    );
    const n = Object.fromEntries(r.rows.map((x) => [x.status, x.n])) as Record<string, number>;
    const relances = await this.db.one<{ n: number }>(
      `SELECT count(*)::int AS n FROM courriel_jobs
        WHERE kind='notification' AND status='en_attente' AND attempts > 0`,
    );
    const derniere = await this.db.one<{ error: string | null; at: Date }>(
      `SELECT result->>'error' AS error, finished_at AS at FROM courriel_jobs
        WHERE kind='notification' AND status='echec' ORDER BY finished_at DESC NULLS LAST LIMIT 1`,
    );
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
    if (masquees.length)
      await c.query('UPDATE grc_notifications SET canal_application=false WHERE id = ANY($1::uuid[])', [masquees]);
    if (!this.courrielOperationnel()) return;
    const voulues = connues.filter((n) => this.resoudre(ctx.get(n.userId)!, n.kind, 'courriel').actif);
    if (!voulues.length) return;
    const comptes = new Map(
      (
        await c.query<{ id: string; email: string }>(
          `SELECT id::text AS id, email FROM users
            WHERE id = ANY($1::uuid[]) AND NOT disabled AND (expires_at IS NULL OR expires_at > now())`,
          [[...new Set(voulues.map((n) => n.userId))]],
        )
      ).rows.map((u) => [u.id, u.email.trim()]),
    );
    const titres = new Map(
      (
        await c.query<{ id: string; title: string }>(
          'SELECT id::text AS id, title FROM grc_notifications WHERE id = ANY($1::uuid[])',
          [voulues.map((n) => n.id)],
        )
      ).rows.map((t) => [t.id, t.title]),
    );
    const appName = this.settings.get('general').appName;
    for (const n of voulues) {
      const adresse = comptes.get(n.userId);
      if (!adresse || !adresseUtilisable(adresse)) continue;
      const { objet, corps } = this.composer(n.kind as NotificationType, titres.get(n.id) ?? '', appName);
      await c.query(
        `INSERT INTO courriel_jobs (kind, requested_by, to_address, notification_id, user_id, subject, body)
         VALUES ('notification', 'système', $1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [adresse, n.id, n.userId, objet, corps],
      );
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
