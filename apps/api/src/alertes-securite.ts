/* Alerte de verrouillage de compte (ADR 0070, S-09) : à la TRANSITION vers l'état verrouillé (une alerte par verrou), un courriel
   sans donnée métier part vers le contact technique et vers chaque administrateur actif (rôle « administrateur », direct ou par
   un groupe). C'est une alerte de sécurité : les réglages personnels de notification (ADR 0058) ne s'y appliquent pas.
   Même file que les alertes d'exploitation (`courriel_jobs`, ADR 0049 et 0059) : l'adresse est celle de la demande.
   Le corps ne contient jamais d'adresse IP (elle reste au journal d'audit) ni de code saisi. Plafond : ALERTES_PAR_HEURE alertes
   détaillées par heure, puis une seule synthèse horaire ; les événements restent tous au journal.
   Notification dans l'application (ADR 0074) : les mêmes évènements, aux mêmes administrateurs actifs, dans `grc_notifications`
   (type `alerte_securite`, sans SMSI ni objet) ; elle existe même quand le courriel n'est pas configuré.
   Espace disque bas (ADR 0106) : même notification dans l'application, aux mêmes administrateurs actifs, quand l'espace libre
   du disque des données relevé par l'exécutant d'exploitation passe sous SEUIL_ESPACE_LIBRE_POURCENT ; une seule fois par
   franchissement (réarmée quand l'espace libre remonte à SEUIL_ESPACE_REARMEMENT_POURCENT), sans courriel. */
import { sql } from 'kysely';
import { SEUIL_ESPACE_LIBRE_POURCENT, type HostState, type SettingsValues } from '@suivi/shared';
import type { VerrouillageEvt } from './auth.js';
import type { AlerteCleEvt } from './webauthn.js';
import type { AlerteSsoEvt } from './connexion-unique/index.js';
import { DEMANDEUR_ALERTE } from './alertes-exploitation.js';
import type { Db } from './db/db.js';
import { COMPTE_ACTIF, adresseUtilisable, porteLeRole } from './notifications-metier.js';
import type { Settings } from './settings.js';

export const ALERTES_PAR_HEURE = 10;
/** Réarmement de l'alerte d'espace disque : seuil + 5 points, pour qu'une oscillation autour du seuil (une archive créée,
    une autre supprimée) ne produise pas une alerte à chaque sauvegarde. */
export const SEUIL_ESPACE_REARMEMENT_POURCENT = SEUIL_ESPACE_LIBRE_POURCENT + 5;
/** État de l'alerte d'espace disque (table settings) : basse tant qu'elle n'est pas réarmée. */
const CLE_ESPACE_DISQUE = 'exploitation:espace-disque';
const VERROU_ESPACE_DISQUE = 'alerte-espace-disque';
type DisqueHote = NonNullable<HostState['disque']>;
/** Taille lisible, en unités binaires comme l'interface (Go = 1024³ octets). */
export const tailleLisible = (n: number) => {
  const unites: [number, string][] = [
    [1024 ** 4, 'To'],
    [1024 ** 3, 'Go'],
    [1024 ** 2, 'Mo'],
  ];
  for (const [u, nom] of unites)
    if (n >= u) return `${(n / u).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${nom}`;
  return `${Math.round(n / 1024).toLocaleString('fr-FR')} Ko`;
};

/** Évènement sur le poivre des mots de passe (ADR 0072). Jamais le poivre : seulement les identifiants de clé. */
export interface PoivreEvt {
  type: 'defini' | 'change' | 'reinitialise';
  auteur: string;
  ancienIdCle: string | null;
  nouvelIdCle: string;
}
const TITRES_POIVRE = {
  defini: 'Poivre des mots de passe défini',
  change: 'Poivre des mots de passe changé',
  reinitialise: 'Poivre des mots de passe réinitialisé (procédure d’urgence)',
} as const;
const VERROU_ALERTE = 'alerte-verrouillage';
export const KIND_ALERTE_SECURITE = 'alerte_securite';

export interface AlerteApplication {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  /** Écran à consulter (lien relatif de l'application) et son libellé. */
  lien: string;
  libelleLien: string;
}

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

  /** Alertes de sécurité non lues de ce compte (le droit d'administrer est vérifié par la route). */
  async nonLues(userId: string): Promise<AlerteApplication[]> {
    const lignes = await this.db.k
      .selectFrom('grc_notifications')
      .select(['id', 'title', 'message', 'created_at', 'due_key'])
      .where('user_id', '=', userId)
      .where('kind', '=', KIND_ALERTE_SECURITE)
      .where('read_at', 'is', null)
      .where('canal_application', '=', true)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
    return lignes.map((l) => ({
      id: l.id,
      title: l.title,
      message: l.message,
      createdAt: new Date(l.created_at).toISOString(),
      ...(l.due_key.startsWith('disque:')
        ? { lien: '/systeme/sauvegardes', libelleLien: 'Sauvegardes et restauration' }
        : l.due_key.startsWith('sso:')
          ? { lien: '/systeme/securite', libelleLien: 'Sécurité, connexion unique (SAML)' }
          : { lien: '/admin/audit', libelleLien: 'Journal d’audit' }),
    }));
  }

  /** Marque une alerte comme lue ; seul son destinataire peut le faire. */
  async lire(id: string, userId: string): Promise<boolean> {
    const r = await this.db.k
      .updateTable('grc_notifications')
      .set({ read_at: sql<Date>`now()` })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('kind', '=', KIND_ALERTE_SECURITE)
      .executeTakeFirst();
    return Number(r.numUpdatedRows) > 0;
  }

  /** Administrateurs actifs (rôle « administrateur », direct ou par un groupe) : destinataires dans l'application. */
  private async administrateurs(): Promise<string[]> {
    const lignes = await this.db.k
      .selectFrom('users as u')
      .select('u.id')
      .where(COMPTE_ACTIF)
      .where(porteLeRole(sql`${'administrateur'}`))
      .execute();
    return lignes.map((l) => l.id);
  }

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

  /** Le poivre des mots de passe vient d'être défini, changé ou réinitialisé : même destinataires que l'alerte de verrouillage.
      Ne lève jamais (l'opération est déjà faite) ; chaque évènement reste dans le journal d'audit. */
  async poivre(e: PoivreEvt): Promise<void> {
    try {
      const dest = await this.destinataires();
      if (dest.length === 0) return;
      const general = (await this.settings.read('general')).values as SettingsValues['general'];
      const nom = propre(general.appName, 80) || 'Suivi des audits';
      const objet = `[${nom}] ${TITRES_POIVRE[e.type]}`;
      const lignes = [
        'Bonjour,',
        '',
        `${TITRES_POIVRE[e.type]} le ${paris(new Date())} (heure de Paris), par « ${propre(e.auteur, 64)} ».`,
        '',
        ...(e.ancienIdCle ? [`Ancien identifiant de clé : ${e.ancienIdCle}.`] : []),
        `Nouvel identifiant de clé : ${e.nouvelIdCle}.`,
        '',
        e.type === 'reinitialise'
          ? 'Tous les comptes ont reçu un mot de passe temporaire : les sessions sont fermées et un nouveau mot de passe est imposé.'
          : 'Les sessions ouvertes ne sont pas fermées ; les mots de passe des comptes ne changent pas.',
        'Le nouveau poivre doit être conservé au coffre-fort de l’organisation.',
        '',
        `Journal d'audit : ${this.lien('/admin/audit')} (action « securite.poivre_* »)`,
        '',
        'Si ce changement n’est pas attendu, traitez-le comme un incident de sécurité.',
        '',
        'Message automatique ; il ne contient ni poivre ni donnée métier.',
      ];
      await this.db.tx(async (_c, k) => {
        for (const a of dest)
          await k
            .insertInto('courriel_jobs')
            .values({
              kind: 'notification',
              requested_by: DEMANDEUR_ALERTE,
              to_address: a,
              subject: objet.slice(0, 180),
              body: lignes.join('\n'),
            })
            .execute();
      });
    } catch (err) {
      this.db.log.error({ err: (err as Error).message }, 'alerte du poivre non émise');
    }
  }

  /** L'analyse antivirale a échoué (délai de 15 s dépassé, démon injoignable, réponse inattendue) : au plus UNE alerte par heure,
      au contact technique seul. Ne lève jamais ; le dépôt n'attend pas l'envoi. */
  async antivirus(requis: boolean): Promise<void> {
    try {
      const c = (await this.settings.read('courriel')).values as SettingsValues['courriel'];
      if (!c.actif || !c.hote || !c.expediteur || !adresseUtilisable(c.contactTechnique)) return;
      const general = (await this.settings.read('general')).values as SettingsValues['general'];
      const nom = propre(general.appName, 80) || 'Suivi des audits';
      await this.db.tx(async (cl, k) => {
        await cl.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['alerte-antivirus']);
        const recente = await k
          .selectFrom('audit_log')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('action', '=', 'document.scan_alerte')
          .where('ts', '>', sql<Date>`now() - interval '1 hour'`)
          .executeTakeFirstOrThrow();
        if (recente.n > 0) return;
        await this.db.audit(null, null, 'document.scan_alerte', '', { requis }, cl);
        await k
          .insertInto('courriel_jobs')
          .values({
            kind: 'notification',
            requested_by: DEMANDEUR_ALERTE,
            to_address: c.contactTechnique.trim(),
            subject: `[${nom}] Analyse antivirale indisponible`.slice(0, 180),
            body: [
              'Bonjour,',
              '',
              `L’analyse antivirale d’un document déposé a échoué le ${paris(new Date())} (heure de Paris) : le service ClamAV ne répond pas`,
              'dans le délai de 15 secondes ou est injoignable.',
              '',
              requis
                ? 'L’analyse est obligatoire : les dépôts de documents sont refusés tant qu’elle est indisponible.'
                : 'L’analyse n’est pas obligatoire : les documents sont acceptés sans analyse (« non analysé ») tant qu’elle est indisponible.',
              '',
              `Détails techniques : ${this.lien('/systeme/details')}`,
              `Journal d'audit : ${this.lien('/systeme/journal')} (action « document.scan_unavailable »)`,
              '',
              'Au plus un message de ce type par heure. Message automatique ; il ne contient aucune donnée métier.',
            ].join('\n'),
          })
          .execute();
      });
    } catch (err) {
      this.db.log.error({ err: (err as Error).message }, 'alerte antivirus non émise');
    }
  }

  /** Clé de sécurité suspecte (compteur de signature qui ne progresse pas : clonage possible), ou connexion d'un administrateur
      soumis à l'obligation de clé par un facteur de secours (TOTP, code de récupération), ADR 0079. Mêmes destinataires et
      même plafond horaire que l'alerte de verrouillage ; ne lève jamais. */
  async cleSecurite(e: AlerteCleEvt): Promise<void> {
    try {
      const compte = await this.db.k
        .selectFrom('users')
        .select(['username', 'display_name'])
        .where('id', '=', e.userId)
        .executeTakeFirst();
      if (!compte) return;
      const general = (await this.settings.read('general')).values as SettingsValues['general'];
      const nom = propre(general.appName, 80) || 'Suivi des audits';
      const dest = await this.destinataires();
      const admins = await this.administrateurs();
      const identifiant = propre(compte.username, 64);
      const quand = paris(new Date());
      const titre =
        e.type === 'cle_suspecte'
          ? `Clé de sécurité suspendue : ${identifiant}`
          : `Connexion par facteur de secours : ${identifiant}`;
      const message =
        e.type === 'cle_suspecte'
          ? `Une clé de sécurité du compte « ${identifiant} » a présenté un compteur de signature qui ne progresse pas le ${quand} (heure de Paris) : elle peut avoir été clonée. La connexion a été refusée et la clé est suspendue ; vérifiez-la avec son porteur, puis réactivez-la ou révoquez-la (Droits, fiche du compte). Détail dans le journal d’audit (action « auth.webauthn_compteur »).`
          : `Le compte administrateur « ${identifiant} », tenu d’utiliser une clé de sécurité, s’est connecté le ${quand} (heure de Paris) avec ${e.facteur === 'code_recuperation' ? 'un code de récupération' : 'le code TOTP'}. Si cet usage n’est pas expliqué (clé perdue ou oubliée), traitez-le comme un incident de sécurité. Détail dans le journal d’audit (action « auth.facteur_secours »).`;
      await this.db.tx(async (c, k) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [VERROU_ALERTE]);
        const fenetre = await k
          .selectFrom('audit_log')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('action', '=', 'securite.alerte_cle')
          .where('ts', '>', sql<Date>`now() - interval '1 hour'`)
          .executeTakeFirstOrThrow();
        if (fenetre.n >= ALERTES_PAR_HEURE) return;
        await this.db.audit(null, null, 'securite.alerte_cle', compte.username, { type: e.type }, c);
        const corps = [
          'Bonjour,',
          '',
          message,
          '',
          `Comptes : ${this.lien('/admin/users')}`,
          `Journal d'audit : ${this.lien('/admin/audit')}`,
          '',
          'Message automatique ; il ne contient ni code, ni clé, ni donnée métier.',
        ].join('\n');
        for (const a of dest)
          await k
            .insertInto('courriel_jobs')
            .values({
              kind: 'notification',
              requested_by: DEMANDEUR_ALERTE,
              to_address: a,
              subject: `[${nom}] ${titre}`.slice(0, 180),
              body: corps,
            })
            .execute();
        for (const id of admins)
          await k
            .insertInto('grc_notifications')
            .values({
              smsi_id: null,
              object_id: null,
              user_id: id,
              kind: KIND_ALERTE_SECURITE,
              due_key: `cle:${e.type}:${e.userId}:${Date.now()}`,
              title: titre.slice(0, 180),
              message,
            })
            .onConflict((oc) => oc.doNothing())
            .execute();
      });
    } catch (err) {
      this.db.log.error({ err: (err as Error).message }, 'alerte de clé de sécurité non émise');
    }
  }

  /** Connexion unique SAML (ADR 0114) : refus pour double authentification absente ou signature invalide, certificat de
      signature d'un fournisseur qui expire dans moins de 30 jours, relecture des métadonnées en échec ou certificat changé.
      Notification dans l'application aux administrateurs actifs et courriel au contact technique et aux administrateurs, même
      plafond horaire que les autres alertes ; ne lève jamais. Aucune assertion, aucun certificat complet dans le message. */
  async sso(e: AlerteSsoEvt): Promise<void> {
    try {
      const general = (await this.settings.read('general')).values as SettingsValues['general'];
      const nom = propre(general.appName, 80) || 'Suivi des audits';
      const fournisseur = propre(e.fournisseur, 120);
      const qui = e.identifiant ? propre(e.identifiant, 120) : null;
      const quand = paris(new Date());
      const detail = e.detail ? propre(e.detail, 300) : '';
      const { titre, message } = {
        refus_mfa: {
          titre: `Connexion unique refusée : double authentification absente (${fournisseur})`,
          message: `Le ${quand} (heure de Paris), une connexion par « ${fournisseur} »${qui ? ` pour « ${qui} »` : ''} a été refusée : l’assertion ne prouvait pas une double authentification faite chez le fournisseur. Vérifiez la politique d’accès conditionnel ou le parcours d’authentification du fournisseur ; si la tentative n’est pas expliquée, traitez-la comme un incident. Détail dans le journal d’audit (action « auth.sso_refus »).`,
        },
        refus_signature: {
          titre: `Connexion unique refusée : signature invalide (${fournisseur})`,
          message: `Le ${quand} (heure de Paris), une réponse attribuée à « ${fournisseur} »${qui ? ` pour « ${qui} »` : ''} a été refusée : signature absente, invalide ou d’un algorithme refusé (${detail || 'signature'}). Ce peut être une réponse forgée, ou un certificat changé chez le fournisseur : relisez ses métadonnées. Détail dans le journal d’audit (action « auth.sso_refus »).`,
        },
        refus_navigateur: {
          titre: `Connexion unique refusée : réponse d’un autre navigateur (${fournisseur})`,
          message: `Le ${quand} (heure de Paris), une réponse valide de « ${fournisseur} »${qui ? ` pour « ${qui} »` : ''} a été refusée : elle n’est pas revenue dans le navigateur qui avait lancé la demande (témoin de liaison absent ou différent). Ce peut être une tentative de connexion forcée sur le compte d’une autre personne, ou un navigateur qui bloque les cookies de l’application. Détail dans le journal d’audit (action « auth.sso_refus », motif « navigateur »).`,
        },
        certificat_expire: {
          titre: `Certificat du fournisseur d’identité « ${fournisseur} » bientôt expiré`,
          message: `Le certificat de signature du fournisseur « ${fournisseur} » expire le ${e.expireLe ? paris(new Date(e.expireLe)) : 'prochainement'} (heure de Paris). Renouvelez-le chez le fournisseur, puis relisez ou importez ses métadonnées (Configuration système, Sécurité, Connexion unique) ; après l’expiration, plus personne ne pourra se connecter par lui.`,
        },
        metadonnees_echec: {
          titre: `Métadonnées du fournisseur « ${fournisseur} » non relues`,
          message: `La relecture des métadonnées du fournisseur « ${fournisseur} » a échoué le ${quand} (heure de Paris) : ${detail || 'erreur sans détail'} La configuration déjà lue reste en service. Vérifiez l’adresse, le pare-feu et le certificat du serveur du fournisseur, ou importez le fichier à la main.`,
        },
        certificat_change: {
          titre: `Certificat du fournisseur d’identité « ${fournisseur} » changé`,
          message: `Les métadonnées relues le ${quand} (heure de Paris) portent un certificat de signature nouveau pour « ${fournisseur} » (empreintes : ${detail || 'voir le journal'}). Si ce renouvellement n’est pas prévu chez le fournisseur, traitez-le comme un incident. Détail dans le journal d’audit (action « auth.sso_metadonnees_lues »).`,
        },
      }[e.type];
      const dest = await this.destinataires();
      const admins = await this.administrateurs();
      await this.db.tx(async (c, k) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [VERROU_ALERTE]);
        const fenetre = await k
          .selectFrom('audit_log')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('action', '=', 'securite.alerte_sso')
          // Plafond par type : une rafale de refus ne masque pas l'alerte d'expiration d'un certificat.
          .where(sql`details->>'type'`, '=', e.type)
          .where('ts', '>', sql<Date>`now() - interval '1 hour'`)
          .executeTakeFirstOrThrow();
        if (fenetre.n >= ALERTES_PAR_HEURE) return;
        await this.db.audit(
          null,
          null,
          'securite.alerte_sso',
          fournisseur,
          { type: e.type, fournisseur: e.fournisseurId },
          c,
        );
        const corps = [
          'Bonjour,',
          '',
          message,
          '',
          `Connexion unique : ${this.lien('/systeme/securite')}`,
          `Journal d'audit : ${this.lien('/admin/audit')}`,
          '',
          'Message automatique ; il ne contient ni assertion, ni certificat complet, ni donnée métier.',
        ].join('\n');
        for (const a of dest)
          await k
            .insertInto('courriel_jobs')
            .values({
              kind: 'notification',
              requested_by: DEMANDEUR_ALERTE,
              to_address: a,
              subject: `[${nom}] ${titre}`.slice(0, 180),
              body: corps,
            })
            .execute();
        // Même clé pour tous les destinataires d'une même alerte.
        const cle = `sso:${e.type}:${e.fournisseurId}:${Date.now()}`;
        for (const id of admins)
          await k
            .insertInto('grc_notifications')
            .values({
              smsi_id: null,
              object_id: null,
              user_id: id,
              kind: KIND_ALERTE_SECURITE,
              due_key: cle,
              title: titre.slice(0, 180),
              message,
            })
            .onConflict((oc) => oc.doNothing())
            .execute();
      });
    } catch (err) {
      this.db.log.error({ err: (err as Error).message }, 'alerte de connexion unique non émise');
    }
  }

  /** Relevé du disque des données publié par l'exécutant d'exploitation (sans chemin) : alerte les administrateurs actifs dans
      l'application quand l'espace libre passe sous le seuil, une fois par franchissement. Ne lève jamais : la synchronisation
      de l'exécutant n'en dépend pas. Renvoie l'état après le relevé (« bas », « normal »), ou null sans relevé exploitable. */
  async espaceDisque(disque: DisqueHote | null | undefined): Promise<'bas' | 'normal' | null> {
    try {
      if (!disque || !(disque.totalOctets > 0) || disque.libreOctets > disque.totalOctets) return null;
      const pourcent = (100 * disque.libreOctets) / disque.totalOctets;
      return await this.db.tx(async (c, k) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [VERROU_ESPACE_DISQUE]);
        const r = await k
          .selectFrom('settings')
          .select('value')
          .where('key', '=', CLE_ESPACE_DISQUE)
          .executeTakeFirst();
        const bas =
          !!r && typeof r.value === 'object' && r.value !== null && (r.value as { bas?: unknown }).bas === true;
        const ecrire = (valeur: { bas: boolean; depuis: string }) =>
          k
            .insertInto('settings')
            .values({ key: CLE_ESPACE_DISQUE, value: JSON.stringify(valeur) })
            .onConflict((oc) =>
              oc.column('key').doUpdateSet({ value: JSON.stringify(valeur), updated_at: sql<Date>`now()` }),
            )
            .execute();
        const mesures = {
          librePourcent: Math.floor(pourcent * 10) / 10,
          libreOctets: disque.libreOctets,
          totalOctets: disque.totalOctets,
          sauvegardesOctets: disque.sauvegardesOctets,
          imagesOctets: disque.imagesOctets,
        };
        if (bas) {
          if (pourcent < SEUIL_ESPACE_REARMEMENT_POURCENT) return 'bas';
          await ecrire({ bas: false, depuis: new Date().toISOString() });
          await this.db.audit(null, null, 'exploitation.espace_disque_retabli', '', mesures, c);
          return 'normal';
        }
        if (pourcent >= SEUIL_ESPACE_LIBRE_POURCENT) return 'normal';
        await ecrire({ bas: true, depuis: new Date().toISOString() });
        await this.db.audit(null, null, 'exploitation.espace_disque_bas', '', mesures, c);
        const arrondi = Math.floor(pourcent);
        const titre = `Espace disque bas sur le serveur : ${arrondi} % libre`;
        const message = [
          `Le disque des données n’a plus que ${tailleLisible(disque.libreOctets)} libres sur ${tailleLisible(disque.totalOctets)}`,
          `(${arrondi} %, seuil d’alerte ${SEUIL_ESPACE_LIBRE_POURCENT} %). Occupation : sauvegardes ${tailleLisible(disque.sauvegardesOctets)},`,
          `images de l’application ${disque.imagesOctets === null ? 'non mesurées' : tailleLisible(disque.imagesOctets)}.`,
          'Une sauvegarde ou une mise à jour peut être refusée faute de place. Externalisez les sauvegardes, puis réduisez leur',
          'nombre (Configuration système, Sauvegardes et restauration) ou libérez de la place comme l’indique le guide',
          'd’installation (« Libérer de la place »).',
        ].join(' ');
        for (const id of await this.administrateurs())
          await k
            .insertInto('grc_notifications')
            .values({
              smsi_id: null,
              object_id: null,
              user_id: id,
              kind: KIND_ALERTE_SECURITE,
              due_key: `disque:bas:${Date.now()}`,
              title: titre.slice(0, 180),
              message,
            })
            .onConflict((oc) => oc.doNothing())
            .execute();
        return 'bas';
      });
    } catch (err) {
      this.db.log.error({ err: (err as Error).message }, 'alerte d’espace disque non émise');
      return null;
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
    const admins = await this.administrateurs();
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
      if (dest.length === 0 && admins.length === 0) return;
      const fenetre = await k
        .selectFrom('audit_log')
        .select([sql<number>`count(*)::int`.as('n'), sql<Date>`min(ts)`.as('depuis')])
        .where('action', '=', 'auth.account_locked')
        .where('ts', '>', sql<Date>`now() - interval '1 hour'`)
        .executeTakeFirstOrThrow();
      let objet: string, corps: string, titre: string, message: string, cle: string;
      if (fenetre.n <= ALERTES_PAR_HEURE) {
        objet = `[${nom}] Compte verrouillé : ${identifiant}`;
        titre = `Compte verrouillé : ${identifiant}`;
        cle = `verrou:${e.userId}:${e.jusqua.toISOString()}`;
        message = [
          `Le compte « ${identifiant} » (${propre(compte.display_name, 120)}) a été verrouillé le ${paris(new Date())}`,
          `(heure de Paris) : ${MOTIFS[e.motif]} (${e.echecs} échecs). Fin prévue du verrou : ${paris(e.jusqua)}.`,
          'Détail dans le journal d’audit (action « auth.account_locked »). Si ce verrouillage ne vient pas de l’utilisateur lui-même,',
          'traitez-le comme un incident de sécurité.',
        ].join(' ');
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
        titre = `${fenetre.n} comptes verrouillés depuis ${heureParis(new Date(fenetre.depuis))}`;
        cle = `synthese:${new Date().toISOString().slice(0, 13)}`;
        message = `${fenetre.n} comptes verrouillés en moins d’une heure : cette série peut indiquer une attaque par essais de mots de passe. Détail dans le journal d’audit (action « auth.account_locked »).`;
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
      for (const id of admins)
        await k
          .insertInto('grc_notifications')
          .values({
            smsi_id: null,
            object_id: null,
            user_id: id,
            kind: KIND_ALERTE_SECURITE,
            due_key: cle,
            title: titre.slice(0, 180),
            message,
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
    });
  }
}
