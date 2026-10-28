/* Alerte de verrouillage de compte (ADR 0070, S-09) : à la TRANSITION vers l'état verrouillé (une alerte par verrou), un courriel
   sans donnée métier part vers le contact technique et vers chaque administrateur actif (rôle « administrateur », direct ou par
   un groupe). C'est une alerte de sécurité : les réglages personnels de notification (ADR 0058) ne s'y appliquent pas.
   Même file que les alertes d'exploitation (`courriel_jobs`, ADR 0049 et 0059) : l'adresse est celle de la demande.
   Le corps ne contient jamais d'adresse IP (elle reste au journal d'audit) ni de code saisi. Plafond : ALERTES_PAR_HEURE alertes
   détaillées par heure, puis une seule synthèse horaire ; les événements restent tous au journal. */
import { sql } from 'kysely';
import type { SettingsValues } from '@suivi/shared';
import type { VerrouillageEvt } from './auth.js';
import { DEMANDEUR_ALERTE } from './alertes-exploitation.js';
import type { Db } from './db/db.js';
import { COMPTE_ACTIF, adresseUtilisable, porteLeRole } from './notifications-metier.js';
import type { Settings } from './settings.js';

export const ALERTES_PAR_HEURE = 10;
const VERROU_ALERTE = 'alerte-verrouillage';

const MOTIFS = {
  mot_de_passe: 'échecs de mot de passe',
  second_facteur: 'échecs du second facteur',
} as const;

/** Texte pour un en-tête ou une ligne de courriel : pas de saut de ligne ni de caractère de contrôle, longueur bornée. */
const propre = (v: string, max: number) =>
  v
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const paris = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })
    .format(d)
    .replace(',', ' à');
const heureParis = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(d);

export class AlertesSecurite {
  constructor(
    private readonly db: Db,
    private readonly settings: Settings,
    private readonly publicUrl: string,
  ) {}

  private lien(ecran: string) {
    return this.publicUrl ? this.publicUrl.replace(/\/$/, '') + ecran : ecran;
  }

  /** Un compte vient d'être verrouillé. Ne lève jamais : l'authentification ne dépend pas de l'envoi. */
  async verrouillage(e: VerrouillageEvt): Promise<void> {
    try {
      await this.emettre(e);
    } catch (err) {
      this.db.log.error({ err: (err as Error).message }, 'alerte de verrouillage non émise');
    }
  }

  private async destinataires(): Promise<string[]> {
    const c = (await this.settings.read('courriel')).values as SettingsValues['courriel'];
    if (!c.actif || !c.hote || !c.expediteur) return [];
    const admins = await this.db.k
      .selectFrom('users as u')
      .select('u.email')
      .where(COMPTE_ACTIF)
      .where(porteLeRole(sql`${'administrateur'}`))
      .execute();
    const vus = new Map<string, string>();
    for (const a of [c.contactTechnique, ...admins.map((x) => x.email)])
      if (adresseUtilisable(a)) vus.set(a.trim().toLowerCase(), a.trim());
    return [...vus.values()];
  }

  private async emettre(e: VerrouillageEvt): Promise<void> {
    const compte = await this.db.k
      .selectFrom('users')
      .select(['username', 'display_name'])
      .where('id', '=', e.userId)
      .executeTakeFirst();
    if (!compte) return;
    const general = (await this.settings.read('general')).values as SettingsValues['general'];
    const nom = propre(general.appName, 80) || 'Suivi des audits';
    const dest = await this.destinataires();
    const identifiant = propre(compte.username, 64);

    await this.db.tx(async (c, k) => {
      // Un seul verrou applicatif : le décompte horaire et l'écriture des demandes se font sans concurrence.
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [VERROU_ALERTE]);
      await this.db.audit(
        { id: e.userId, username: compte.username },
        e.ip,
        'auth.account_locked',
        compte.username,
        { motif: e.motif, echecs: e.echecs, jusqua: e.jusqua.toISOString() },
        c,
      );
      if (dest.length === 0) return;
      const fenetre = await k
        .selectFrom('audit_log')
        .select([sql<number>`count(*)::int`.as('n'), sql<Date>`min(ts)`.as('depuis')])
        .where('action', '=', 'auth.account_locked')
        .where('ts', '>', sql<Date>`now() - interval '1 hour'`)
        .executeTakeFirstOrThrow();
      let objet: string, corps: string;
      if (fenetre.n <= ALERTES_PAR_HEURE) {
        objet = `[${nom}] Compte verrouillé : ${identifiant}`;
        corps = [
          'Bonjour,',
          '',
          `Le compte « ${identifiant} » (${propre(compte.display_name, 120)}) a été verrouillé le ${paris(new Date())} (heure de Paris).`,
          '',
          `Motif : ${MOTIFS[e.motif]} (${e.echecs} échecs).`,
          `Fin prévue du verrou : ${paris(e.jusqua)}.`,
          '',
          `Comptes : ${this.lien('/admin/users')}`,
          `Journal d'audit : ${this.lien('/admin/audit')} (action « auth.account_locked », compte ${identifiant})`,
          '',
          'Si ce verrouillage ne vient pas de l’utilisateur lui-même, traitez-le comme un incident de sécurité.',
          '',
          'Message automatique ; il ne contient aucune donnée métier.',
        ].join('\n');
      } else {
        const deja = await k
          .selectFrom('audit_log')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('action', '=', 'auth.account_locked_synthese')
          .where('ts', '>', sql<Date>`now() - interval '1 hour'`)
          .executeTakeFirstOrThrow();
        if (deja.n > 0) return;
        await this.db.audit(null, null, 'auth.account_locked_synthese', '', { comptes: fenetre.n }, c);
        objet = `[${nom}] ${fenetre.n} comptes verrouillés depuis ${heureParis(new Date(fenetre.depuis))}`;
        corps = [
          'Bonjour,',
          '',
          `${fenetre.n} comptes verrouillés depuis ${heureParis(new Date(fenetre.depuis))} (heure de Paris). Les alertes détaillées sont`,
          `plafonnées à ${ALERTES_PAR_HEURE} par heure ; chaque verrou reste inscrit au journal d'audit.`,
          '',
          `Journal d'audit : ${this.lien('/admin/audit')} (action « auth.account_locked »)`,
          `Comptes : ${this.lien('/admin/users')}`,
          '',
          'Cette série peut indiquer une attaque par essais de mots de passe : traitez-la comme un incident de sécurité.',
          '',
          'Message automatique ; il ne contient aucune donnée métier.',
        ].join('\n');
      }
      for (const a of dest)
        await k
          .insertInto('courriel_jobs')
          .values({
            kind: 'notification',
            requested_by: DEMANDEUR_ALERTE,
            to_address: a,
            subject: objet.slice(0, 180),
            body: corps,
          })
          .execute();
    });
  }
}
