/* Connexion unique SAML 2.0 (ADR 0114 ; décisions du RSSI du 25/11/2026).
   - Fournisseurs (Entra ID, Keycloak, SAML générique) : configuration, métadonnées lues par l'exécutant d'exploitation (flux
     « sso-saml », fermé par défaut, ouvert quand l'administrateur enregistre une adresse de métadonnées et valide) ou importées
     à la main ; certificats suivis (expiration, changement) avec alerte de sécurité.
   - Connexion à l'initiative du service seulement (SP-initiated) : demande HTTP-Redirect enregistrée en base (usage unique,
     cinq minutes, chemin de retour interne), réponse HTTP-POST sur l'adresse de retour du fournisseur ; InResponseTo exigé ;
     IdP-initiated refusé. Validation par @node-saml/node-saml : signature obligatoire (réponse ou assertion), audience,
     échéances avec une petite tolérance d'horloge, anti-rejeu des assertions en base ; contrôles ajoutés ici : XML durci,
     algorithmes SHA-256 ou plus, Destination et Recipient, preuve de la double authentification faite chez le fournisseur.
   - Comptes créés d'avance (mode « sso », fournisseur, identifiant attendu) ; aucune création à la volée ; droits locaux. */
import crypto from 'node:crypto';
import { SAML, ValidateInResponseTo, generateServiceProviderMetadata, type CacheProvider } from '@node-saml/node-saml';
import {
  SSO_BORNES,
  destinationMetadonnees,
  type FournisseurSsoBody,
  type FournisseurSsoOut,
  type MotifRefusSso,
  type OptionsConnexionSsoOut,
  type RapportMetadonneesSso,
  type SpSsoOut,
} from '@suivi/shared';
import { sql, type Selectable } from 'kysely';
import type { Config } from '../config.js';
import type { Actor, Client, Db, Kdb } from '../db/db.js';
import type { SsoFournisseurs } from '../db/types.generated.js';
import type { FluxExternes } from '../flux-externes.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { lireMetadonnees, type MetadonneesLues } from './metadonnees.js';
import { analyser, RefusXml, selectionner, xmlSur, type CertificatLu } from './xml.js';

/** Empreinte posée sur un compte « sso » : password_hash reste obligatoire, aucune vérification ne peut l'accepter. */
export const EMPREINTE_SSO = 'sso$inutilisable';

/** Évènement d'alerte de sécurité (ADR 0074) propre à la connexion unique. */
export interface AlerteSsoEvt {
  type: 'refus_mfa' | 'refus_signature' | 'certificat_expire' | 'metadonnees_echec' | 'certificat_change';
  fournisseurId: string;
  fournisseur: string;
  identifiant?: string | null;
  detail?: string | null;
  expireLe?: string | null;
}

type Ligne = Selectable<SsoFournisseurs>;
type CertificatStocke = CertificatLu;

/** Chemin de retour : relatif et interne (« /… », jamais « // » ni « /\ »), sans caractère de contrôle, hors de l'API. */
export function retourInterne(v: string | undefined | null): string | null {
  const r = v ?? '/';
  // eslint-disable-next-line no-control-regex
  if (r.length > 500 || !/^\/(?![/\\])[^\u0000-\u001f\u007f\\]*$/.test(r) || /^\/api(\/|$)/.test(r)) return null;
  return r;
}

const certificatsDe = (l: { certificats: unknown }): CertificatStocke[] =>
  Array.isArray(l.certificats) ? (l.certificats as CertificatStocke[]) : [];

type X = Record<string, unknown>;
const liste = (v: unknown): X[] => (Array.isArray(v) ? (v as X[]) : []);
const texte = (v: unknown): string | null =>
  typeof v === 'string'
    ? v
    : v && typeof v === 'object' && typeof (v as X)._ === 'string'
      ? ((v as X)._ as string)
      : null;
const proprietes = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && (v as X).$ && typeof (v as X).$ === 'object'
    ? ((v as X).$ as Record<string, string>)
    : {};

/** Valeurs d'un attribut nommé de l'assertion vérifiée. */
function valeursAttribut(assertion: X, nom: string): string[] {
  const r: string[] = [];
  for (const st of liste(assertion.AttributeStatement))
    for (const a of liste(st.Attribute))
      if (proprietes(a).Name === nom)
        for (const v of liste(a.AttributeValue)) {
          const t = texte(v);
          if (t !== null) r.push(t.trim());
        }
  return r;
}
function classesContexte(assertion: X): string[] {
  const r: string[] = [];
  for (const st of liste(assertion.AuthnStatement))
    for (const c of liste(st.AuthnContext))
      for (const ref of liste(c.AuthnContextClassRef)) {
        const t = texte(ref);
        if (t !== null) r.push(t.trim());
      }
  return r;
}
function destinatairesBearer(assertion: X): string[] {
  const r: string[] = [];
  for (const s of liste(assertion.Subject))
    for (const sc of liste(s.SubjectConfirmation)) {
      if (proprietes(sc).Method !== 'urn:oasis:names:tc:SAML:2.0:cm:bearer') continue;
      for (const d of liste(sc.SubjectConfirmationData)) {
        const rec = proprietes(d).Recipient;
        if (rec) r.push(rec);
      }
    }
  return r;
}

/** Motif d'un refus de @node-saml/node-saml (messages de la bibliothèque, version figée). */
export function motifErreurSaml(e: unknown): MotifRefusSso {
  const m = e instanceof Error ? e.message : String(e);
  if (/InResponseTo is missing/i.test(m) || /SubjectInResponseTo is missing/i.test(m)) return 'idp_initie';
  if (/InResponseTo/i.test(m)) return 'requete_inconnue';
  if (/already been received/i.test(m)) return 'rejeu';
  if (/audience/i.test(m)) return 'audience';
  if (/expired|not yet valid|NotOnOrAfter/i.test(m)) return 'expiration';
  if (/signature|signed/i.test(m)) return 'signature';
  if (/SAML provider returned|status code/i.test(m)) return 'statut';
  if (/issuer/i.test(m)) return 'signature';
  // Aucune confirmation « bearer » valide maintenant : échéance dépassée ou pas encore atteinte.
  if (/subject confirmation/i.test(m)) return 'expiration';
  return 'invalide';
}

export type ResultatAcs =
  | {
      ok: true;
      userId: string;
      username: string;
      but: 'connexion' | 'reauth';
      retour: string;
      sessionHash: Buffer | null;
      fournisseur: string;
    }
  | {
      ok: false;
      motif: MotifRefusSso;
      detail: string | null;
      fournisseur: string | null;
      but: 'connexion' | 'reauth' | null;
      retour: string | null;
      compte: { id: string; username: string } | null;
      identifiant: string | null;
    };

export class ConnexionUnique {
  /** Alerte de sécurité dans l'application (branchée par les services) ; ne fait jamais échouer l'appelant. */
  surAlerte: ((e: AlerteSsoEvt) => Promise<void>) | null = null;

  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
    private readonly flux: FluxExternes,
  ) {}

  /* ---------------------------------------------------------------- Service (SP) */
  private get base(): string | null {
    return this.cfg.publicUrl ? this.cfg.publicUrl.replace(/\/+$/, '') : null;
  }
  get spEntityId(): string | null {
    return this.base ? `${this.base}/api/auth/sso/sp` : null;
  }
  acsUrl(id: string): string {
    return `${this.base ?? ''}/api/auth/sso/${id}/acs`;
  }
  private get cleSp(): string | null {
    const k = this.cfg.sso.cleSp;
    if (!k) return null;
    try {
      crypto.createPrivateKey(k);
      return k;
    } catch {
      return null;
    }
  }

  sp(): SpSsoOut {
    const cert = this.cleSp ? this.cfg.sso.certificatSp || null : null;
    let expire: string | null = null;
    if (cert)
      try {
        expire = new Date(new crypto.X509Certificate(cert).validTo).toISOString();
      } catch {
        expire = null;
      }
    return {
      disponible: !!this.spEntityId,
      raison: this.spEntityId
        ? null
        : 'Adresse publique du site (PUBLIC_URL) absente : la connexion unique est indisponible.',
      entityId: this.spEntityId,
      certificat: expire ? cert : null,
      certificatExpireLe: expire,
      signeRequetes: !!this.cleSp,
    };
  }

  /** Métadonnées du service pour un fournisseur (XML à importer chez lui, Keycloak notamment). */
  metadonneesSp(id: string): string {
    if (!this.spEntityId) throw new HttpError(409, 'Adresse publique du site absente.');
    const sp = this.sp();
    return generateServiceProviderMetadata({
      issuer: this.spEntityId,
      callbackUrl: this.acsUrl(id),
      identifierFormat: null,
      wantAssertionsSigned: true,
      publicCerts: sp.certificat ?? null,
      decryptionCert: null,
      signMetadata: false,
    });
  }

  /* ---------------------------------------------------------------- Lectures */
  private async ligne(id: string, k: Kdb = this.db.k, verrou = false): Promise<Ligne | undefined> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return undefined;
    let q = k.selectFrom('sso_fournisseurs').selectAll().where('id', '=', id);
    if (verrou) q = q.forUpdate();
    return (await q.executeTakeFirst()) as Ligne | undefined;
  }

  private pret(l: Pick<Ligne, 'sso_url' | 'certificats'>): boolean {
    return !!l.sso_url && certificatsDe(l).length > 0;
  }

  private versSortie(l: Ligne, comptes: number): FournisseurSsoOut {
    const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
    return {
      id: l.id,
      type: l.type,
      libelle: l.libelle,
      actif: l.actif,
      entityId: l.entity_id,
      urlMetadonnees: l.url_metadonnees,
      autoriteTls: l.autorite_tls,
      mfaSource: l.mfa_source,
      mfaAttribut: l.mfa_attribut,
      mfaValeurs: l.mfa_valeurs,
      rapprochement: l.rapprochement,
      rapprochementAttribut: l.rapprochement_attribut,
      ssoUrl: l.sso_url,
      certificats: certificatsDe(l).map((c) => ({ empreinte: c.empreinte, sujet: c.sujet, expireLe: c.expireLe })),
      certificatExpireLe: iso(l.certificat_expire_le),
      metadonnees: {
        source: l.metadonnees_source,
        lueLe: iso(l.metadonnees_lues_le),
        signees: l.metadonnees_signees,
        erreur: l.metadonnees_erreur,
        erreurLe: iso(l.metadonnees_erreur_le),
        relectureDemandee: l.relecture_demandee,
      },
      pret: this.pret(l),
      comptes,
      sp: { acsUrl: this.acsUrl(l.id) },
      version: l.version,
    };
  }

  async lister(k: Kdb = this.db.k): Promise<FournisseurSsoOut[]> {
    const lignes = (await k.selectFrom('sso_fournisseurs').selectAll().orderBy('libelle').execute()) as Ligne[];
    const n = new Map(
      (
        await k
          .selectFrom('users')
          .select(['sso_fournisseur_id', sql<number>`count(*)::int`.as('n')])
          .where('sso_fournisseur_id', 'is not', null)
          .groupBy('sso_fournisseur_id')
          .execute()
      ).map((r) => [r.sso_fournisseur_id, r.n]),
    );
    return lignes.map((l) => this.versSortie(l, n.get(l.id) ?? 0));
  }

  async un(id: string, k: Kdb = this.db.k): Promise<FournisseurSsoOut | null> {
    return (await this.lister(k)).find((f) => f.id === id) ?? null;
  }

  async existe(id: string, k: Kdb = this.db.k): Promise<boolean> {
    return !!(await this.ligne(id, k));
  }

  /** Boutons de la page de connexion : fournisseurs actifs et prêts, si le service est disponible. */
  async optionsConnexion(): Promise<OptionsConnexionSsoOut> {
    if (!this.spEntityId) return [];
    const lignes = (await this.db.k
      .selectFrom('sso_fournisseurs')
      .selectAll()
      .where('actif', '=', true)
      .orderBy('libelle')
      .execute()) as Ligne[];
    return lignes.filter((l) => this.pret(l)).map((l) => ({ id: l.id, libelle: l.libelle, type: l.type }));
  }

  /* ---------------------------------------------------------------- Configuration */
  /** Flux « sso-saml » : une adresse de métadonnées nouvelle ou changée exige la validation explicite (destination montrée),
      puis ouvre le flux dans la transaction ; plus aucune adresse : le flux est refermé. */
  private async decidersFlux(
    c: Client,
    k: Kdb,
    urlAvant: string | null,
    body: FournisseurSsoBody,
    actor: Actor,
    ip: string,
  ): Promise<void> {
    if (body.urlMetadonnees && body.urlMetadonnees !== urlAvant) {
      if (body.fluxConfirme !== true)
        throw new HttpError(
          409,
          `Lire les métadonnées à cette adresse ouvre le flux « Connexion unique (SAML) » vers ${destinationMetadonnees(body.urlMetadonnees)} : validez d’abord la destination et les données qui sortent.`,
          { reason: 'flux_validation', module: 'sso-saml', destination: destinationMetadonnees(body.urlMetadonnees) },
        );
      await this.flux.activer(c, k, 'sso-saml', {
        confirme: true,
        administrateur: true,
        actor,
        ip,
        origine: 'sso.fournisseur',
      });
    }
  }
  private async fermerFluxSansAdresse(c: Client, k: Kdb, actor: Actor, ip: string) {
    const reste = await k
      .selectFrom('sso_fournisseurs')
      .select('id')
      .where('url_metadonnees', 'is not', null)
      .executeTakeFirst();
    if (!reste) await this.flux.desactiver(c, k, 'sso-saml', actor, ip, 'sso.fournisseur');
  }

  async creer(c: Client, k: Kdb, body: FournisseurSsoBody, actor: Actor, ip: string): Promise<string> {
    await this.decidersFlux(c, k, null, body, actor, ip);
    const r = await k
      .insertInto('sso_fournisseurs')
      .values({
        type: body.type,
        libelle: body.libelle,
        actif: body.actif,
        entity_id: body.entityId,
        url_metadonnees: body.urlMetadonnees,
        autorite_tls: body.autoriteTls?.trim() || null,
        mfa_source: body.mfaSource,
        mfa_attribut: body.mfaAttribut,
        mfa_valeurs: [...new Set(body.mfaValeurs)],
        rapprochement: body.rapprochement,
        rapprochement_attribut: body.rapprochementAttribut,
        relecture_demandee: !!body.urlMetadonnees,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
      .catch((e: { code?: string }) => {
        if (e.code === '23505') throw new HttpError(409, 'Un fournisseur porte déjà cet identifiant (entityID).');
        throw e;
      });
    await this.db.audit(
      actor,
      ip,
      'auth.sso_fournisseur_cree',
      body.libelle,
      { fournisseur: r.id, ...resumeConfiguration(body) },
      c,
    );
    return r.id;
  }

  async modifier(
    c: Client,
    k: Kdb,
    id: string,
    body: FournisseurSsoBody,
    attendue: number,
    actor: Actor,
    ip: string,
  ): Promise<void> {
    const avant = await this.ligne(id, k, true);
    if (!avant) throw new HttpError(404, 'Fournisseur introuvable.');
    if (avant.version !== attendue) throw conflict({ version: avant.version });
    await this.decidersFlux(c, k, avant.url_metadonnees, body, actor, ip);
    const urlChangee = body.urlMetadonnees !== avant.url_metadonnees;
    // Autre fournisseur (identifiant ou type changé) : les métadonnées lues ne valent plus, rien n'est gardé.
    const remiseAZero = body.entityId !== avant.entity_id || body.type !== avant.type;
    await k
      .updateTable('sso_fournisseurs')
      .set((eb) => ({
        type: body.type,
        libelle: body.libelle,
        actif: body.actif,
        entity_id: body.entityId,
        url_metadonnees: body.urlMetadonnees,
        autorite_tls: body.autoriteTls?.trim() || null,
        mfa_source: body.mfaSource,
        mfa_attribut: body.mfaAttribut,
        mfa_valeurs: [...new Set(body.mfaValeurs)],
        rapprochement: body.rapprochement,
        rapprochement_attribut: body.rapprochementAttribut,
        ...(urlChangee ? { lecture_id: null, relecture_demandee: !!body.urlMetadonnees } : {}),
        ...(remiseAZero
          ? {
              sso_url: null,
              certificats: '[]',
              certificat_expire_le: null,
              metadonnees_source: null,
              metadonnees_lues_le: null,
              metadonnees_signees: false,
              metadonnees_empreinte: null,
              metadonnees_erreur: null,
              metadonnees_erreur_le: null,
              alerte_expiration: null,
            }
          : {}),
        version: eb('version', '+', 1),
        modifie_le: sql<Date>`now()`,
      }))
      .where('id', '=', id)
      .execute()
      .catch((e: { code?: string }) => {
        if (e.code === '23505') throw new HttpError(409, 'Un fournisseur porte déjà cet identifiant (entityID).');
        throw e;
      });
    if (!body.urlMetadonnees) await this.fermerFluxSansAdresse(c, k, actor, ip);
    // Fournisseur désactivé, ou autre fournisseur : les sessions ouvertes par lui sont fermées.
    if ((avant.actif && !body.actif) || remiseAZero)
      await k
        .deleteFrom('sessions')
        .where('par_sso', '=', true)
        .where('user_id', 'in', (eb) => eb.selectFrom('users').select('id').where('sso_fournisseur_id', '=', id))
        .execute();
    await this.db.audit(
      actor,
      ip,
      'auth.sso_fournisseur_modifie',
      body.libelle,
      { fournisseur: id, ...resumeConfiguration(body), remiseAZero },
      c,
    );
  }

  async supprimer(c: Client, k: Kdb, id: string, actor: Actor, ip: string): Promise<void> {
    const l = await this.ligne(id, k, true);
    if (!l) throw new HttpError(404, 'Fournisseur introuvable.');
    const comptes = await k
      .selectFrom('users')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('sso_fournisseur_id', '=', id)
      .executeTakeFirstOrThrow();
    if (comptes.n > 0)
      throw new HttpError(
        409,
        `${comptes.n} compte(s) se connectent par ce fournisseur : passez-les d’abord en connexion locale ou sur un autre fournisseur.`,
        { reason: 'comptes' },
      );
    await k.deleteFrom('sso_fournisseurs').where('id', '=', id).execute();
    await this.fermerFluxSansAdresse(c, k, actor, ip);
    await this.db.audit(actor, ip, 'auth.sso_fournisseur_supprime', l.libelle, { fournisseur: id }, c);
  }

  /* ---------------------------------------------------------------- Métadonnées */
  /** Import manuel (secours, flux fermé) : l'administrateur est la source de confiance ; même contrôle qu'à la lecture. */
  async importer(id: string, xml: string, actor: Actor, ip: string): Promise<FournisseurSsoOut> {
    const alertes: AlerteSsoEvt[] = [];
    await this.db.tx(async (c, k) => {
      const l = await this.ligne(id, k, true);
      if (!l) throw new HttpError(404, 'Fournisseur introuvable.');
      let lues: MetadonneesLues;
      try {
        lues = await lireMetadonnees(Buffer.from(xml, 'utf8'), { entityIdAttendu: l.entity_id, certificatsConnus: [] });
      } catch (e) {
        if (e instanceof RefusXml) {
          await this.db.audit(
            actor,
            ip,
            'auth.sso_metadonnees_refusees',
            l.libelle,
            { fournisseur: id, source: 'import', motif: e.motif, erreur: e.message },
            c,
          );
          throw new HttpError(422, e.message, { reason: e.motif });
        }
        throw e;
      }
      alertes.push(...(await this.appliquer(c, k, l, lues, 'import', actor, ip)));
    }, actor.username);
    await this.alerter(alertes);
    return (await this.un(id))!;
  }

  /** Relecture demandée par un administrateur (flux ouvert et adresse réglée exigés). */
  async demanderRelecture(id: string, actor: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      const l = await this.ligne(id, k, true);
      if (!l) throw new HttpError(404, 'Fournisseur introuvable.');
      if (!l.url_metadonnees)
        throw new HttpError(409, 'Aucune adresse de métadonnées : importez le fichier XML du fournisseur.', {
          reason: 'sans_adresse',
        });
      await this.flux.exiger('sso-saml', k);
      await k.updateTable('sso_fournisseurs').set({ relecture_demandee: true }).where('id', '=', id).execute();
      await this.db.audit(actor, ip, 'auth.sso_relecture_demandee', l.libelle, { fournisseur: id }, c);
    }, actor.username);
  }

  /** CLI de l'exécutant : une lecture due (jamais lue, plus de RELECTURE heures, ou relecture demandée), si le flux est
      ouvert. La lecture reçoit un identifiant à usage unique ; une adresse changée entre-temps l'annule. */
  async reclamerLecture(): Promise<{ id: string; type: string; url: string; autorite: string | null } | null> {
    if (!(await this.flux.ouvert('sso-saml'))) return null;
    const r = await sql<{
      id: string;
      type: string;
      url_metadonnees: string;
      autorite_tls: string | null;
      lecture_id: string;
    }>`
      UPDATE sso_fournisseurs f
         SET lecture_id = gen_random_uuid(), lecture_reclamee_le = now(), relecture_demandee = false
       WHERE f.id = (
         SELECT id FROM sso_fournisseurs
          WHERE url_metadonnees IS NOT NULL
            AND (lecture_reclamee_le IS NULL
                 OR lecture_reclamee_le < now() - make_interval(hours => ${SSO_BORNES.relectureHeures})
                 OR (relecture_demandee AND lecture_reclamee_le < now() - interval '30 seconds'))
          ORDER BY relecture_demandee DESC, lecture_reclamee_le NULLS FIRST
          LIMIT 1
          FOR UPDATE SKIP LOCKED)
      RETURNING f.id, f.type, f.url_metadonnees, f.autorite_tls, f.lecture_id`.execute(this.db.k);
    const l = r.rows[0];
    return l ? { id: l.lecture_id, type: l.type, url: l.url_metadonnees, autorite: l.autorite_tls } : null;
  }

  /** CLI de l'exécutant : résultat d'une lecture (contenu ou erreur). Une lecture inconnue ou annulée est ignorée. */
  async terminerLecture(
    lectureId: string,
    rapport: RapportMetadonneesSso,
  ): Promise<'appliquee' | 'refusee' | 'ignoree'> {
    const acteur = { username: 'exploitation serveur' };
    const alertes: AlerteSsoEvt[] = [];
    const issue = await this.db.tx(async (c, k) => {
      const l = (await k
        .selectFrom('sso_fournisseurs')
        .selectAll()
        .where('lecture_id', '=', lectureId)
        .forUpdate()
        .executeTakeFirst()) as Ligne | undefined;
      if (!l) return 'ignoree' as const;
      await k.updateTable('sso_fournisseurs').set({ lecture_id: null }).where('id', '=', l.id).execute();
      let erreur: string;
      if (rapport.ok) {
        try {
          const lues = await lireMetadonnees(Buffer.from(rapport.contenu, 'base64'), {
            entityIdAttendu: l.entity_id,
            certificatsConnus: certificatsDe(l).map((x) => x.pem),
          });
          alertes.push(...(await this.appliquer(c, k, l, lues, 'url', acteur, null)));
          return 'appliquee' as const;
        } catch (e) {
          if (!(e instanceof RefusXml)) throw e;
          erreur = e.message;
        }
      } else erreur = `Lecture impossible : ${rapport.erreur}`;
      erreur = erreur.slice(0, 300);
      await k
        .updateTable('sso_fournisseurs')
        .set({ metadonnees_erreur: erreur, metadonnees_erreur_le: sql<Date>`now()` })
        .where('id', '=', l.id)
        .execute();
      await this.db.audit(
        acteur,
        null,
        'auth.sso_metadonnees_echec',
        l.libelle,
        { fournisseur: l.id, source: 'url', erreur },
        c,
      );
      // Une alerte au passage en échec, pas à chaque relecture qui échoue encore.
      if (!l.metadonnees_erreur)
        alertes.push({ type: 'metadonnees_echec', fournisseurId: l.id, fournisseur: l.libelle, detail: erreur });
      return 'refusee' as const;
    });
    await this.alerter(alertes);
    return issue;
  }

  /** Enregistre des métadonnées acceptées ; rend les alertes à émettre (certificat changé, expiration proche). */
  private async appliquer(
    c: Client,
    k: Kdb,
    l: Ligne,
    lues: MetadonneesLues,
    source: 'url' | 'import',
    actor: Actor,
    ip: string | null,
  ): Promise<AlerteSsoEvt[]> {
    const alertes: AlerteSsoEvt[] = [];
    const avant = certificatsDe(l)
      .map((x) => x.empreinte)
      .sort();
    const apres = lues.certificats.map((x) => x.empreinte).sort();
    const change = avant.length > 0 && JSON.stringify(avant) !== JSON.stringify(apres);
    const expire = lues.certificats.reduce((m, x) => (x.expireLe > m ? x.expireLe : m), '');
    await k
      .updateTable('sso_fournisseurs')
      .set({
        sso_url: lues.ssoUrl,
        certificats: JSON.stringify(lues.certificats),
        certificat_expire_le: expire || null,
        metadonnees_source: source,
        metadonnees_lues_le: sql<Date>`now()`,
        metadonnees_signees: lues.signees,
        metadonnees_empreinte: lues.empreinte,
        metadonnees_erreur: null,
        metadonnees_erreur_le: null,
        ...(change ? { alerte_expiration: null } : {}),
      })
      .where('id', '=', l.id)
      .execute();
    await this.db.audit(
      actor,
      ip,
      'auth.sso_metadonnees_lues',
      l.libelle,
      {
        fournisseur: l.id,
        source,
        signees: lues.signees,
        empreinte: lues.empreinte,
        certificats: lues.certificats.map((x) => ({ empreinte: x.empreinte, expireLe: x.expireLe })),
        certificatChange: change,
      },
      c,
    );
    if (change)
      alertes.push({
        type: 'certificat_change',
        fournisseurId: l.id,
        fournisseur: l.libelle,
        detail: apres.map((e) => e.slice(0, 16)).join(', '),
      });
    return alertes;
  }

  /** Certificats de signature qui expirent dans moins de PREAVIS jours : une alerte par certificat (empreinte retenue). */
  async verifierEcheances(): Promise<number> {
    const lignes = (await this.db.k
      .selectFrom('sso_fournisseurs')
      .selectAll()
      .where('certificat_expire_le', 'is not', null)
      .where(
        'certificat_expire_le',
        '<',
        sql<Date>`now() + make_interval(days => ${SSO_BORNES.preavisExpirationJours})`,
      )
      .execute()) as Ligne[];
    const alertes: AlerteSsoEvt[] = [];
    for (const l of lignes) {
      const empreinte = certificatsDe(l)
        .map((x) => x.empreinte)
        .sort()
        .join(',');
      if (l.alerte_expiration === empreinte) continue;
      const r = await this.db.k
        .updateTable('sso_fournisseurs')
        .set({ alerte_expiration: empreinte })
        .where('id', '=', l.id)
        .where((eb) => eb.or([eb('alerte_expiration', 'is', null), eb('alerte_expiration', '<>', empreinte)]))
        .executeTakeFirst();
      if (!Number(r.numUpdatedRows)) continue;
      const expireLe = new Date(l.certificat_expire_le!).toISOString();
      await this.db.audit(null, null, 'auth.sso_certificat_expire_bientot', l.libelle, { fournisseur: l.id, expireLe });
      alertes.push({ type: 'certificat_expire', fournisseurId: l.id, fournisseur: l.libelle, expireLe });
    }
    await this.alerter(alertes);
    return alertes.length;
  }

  async alerter(alertes: AlerteSsoEvt[]): Promise<void> {
    for (const a of alertes)
      try {
        await this.surAlerte?.(a);
      } catch (e) {
        this.db.log.error({ err: (e as Error).message }, 'alerte de connexion unique non émise');
      }
  }

  /** Demandes et identifiants d'assertions échus. */
  async purger(): Promise<void> {
    await this.db.k
      .deleteFrom('sso_requetes')
      .where('expire_le', '<', sql<Date>`now() - interval '1 hour'`)
      .execute();
    await this.db.k
      .deleteFrom('sso_assertions_vues')
      .where('expire_le', '<', sql<Date>`now()`)
      .execute();
  }

  /* ---------------------------------------------------------------- Connexion */
  /** Mémoire des demandes (InResponseTo) et des assertions reçues (anti-rejeu), en base, propre à un fournisseur. */
  private cache(
    fournisseurId: string,
    o: {
      demande?: { but: 'connexion' | 'reauth'; retour: string; userId: string | null; sessionHash: Buffer | null };
      consommee?: (r: {
        but: 'connexion' | 'reauth';
        retour: string;
        user_id: string | null;
        session_hash: Buffer | null;
      }) => void;
    },
  ): CacheProvider {
    const k = this.db.k;
    return {
      saveAsync: async (cle, valeur) => {
        if (!o.demande) throw new Error('Aucune demande à enregistrer.');
        await k
          .insertInto('sso_requetes')
          .values({
            id: cle,
            fournisseur_id: fournisseurId,
            but: o.demande.but,
            retour: o.demande.retour,
            user_id: o.demande.userId,
            session_hash: o.demande.sessionHash,
            expire_le: sql<Date>`now() + make_interval(mins => ${SSO_BORNES.requeteMinutes})`,
          })
          .execute();
        return { value: valeur, createdAt: Date.now() };
      },
      getAsync: async (cle) => {
        // Valeur rendue : instant de la demande (la bibliothèque y ajoute sa propre durée de validité).
        const r = await k
          .selectFrom('sso_requetes')
          .select('cree_le')
          .where('id', '=', String(cle).slice(0, 200))
          .where('fournisseur_id', '=', fournisseurId)
          .where('consommee_le', 'is', null)
          .where('expire_le', '>', sql<Date>`now()`)
          .executeTakeFirst();
        return r ? new Date(r.cree_le).toISOString() : null;
      },
      removeAsync: async (cle) => {
        if (cle)
          await k
            .updateTable('sso_requetes')
            .set({ consommee_le: sql<Date>`now()` })
            .where('id', '=', String(cle).slice(0, 200))
            .where('fournisseur_id', '=', fournisseurId)
            .execute();
        return cle;
      },
      consumeAsync: async (cle) => {
        const r = await k
          .updateTable('sso_requetes')
          .set({ consommee_le: sql<Date>`now()` })
          .where('id', '=', String(cle).slice(0, 200))
          .where('fournisseur_id', '=', fournisseurId)
          .where('consommee_le', 'is', null)
          .where('expire_le', '>', sql<Date>`now()`)
          .returning(['but', 'retour', 'user_id', 'session_hash', 'cree_le'])
          .executeTakeFirst();
        if (!r) return null;
        o.consommee?.(r);
        return new Date(r.cree_le).toISOString();
      },
      saveIfAbsentAsync: async (cle, _valeur, jusquaMs) => {
        const r = await k
          .insertInto('sso_assertions_vues')
          .values({ cle: String(cle).slice(0, 3000), fournisseur_id: fournisseurId, expire_le: new Date(jusquaMs) })
          .onConflict((oc) => oc.column('cle').doNothing())
          .executeTakeFirst();
        return Number(r.numInsertedOrUpdatedRows ?? 0) === 1;
      },
    };
  }

  private instance(l: Ligne, cache: CacheProvider, forceAuthn = false): SAML {
    const cle = this.cleSp;
    const demanderContexte = l.type !== 'entra' && l.mfa_source === 'authn_context';
    return new SAML({
      issuer: this.spEntityId!,
      callbackUrl: this.acsUrl(l.id),
      entryPoint: l.sso_url ?? undefined,
      idpCert: certificatsDe(l).map((x) => x.pem),
      idpIssuer: l.entity_id,
      audience: this.spEntityId!,
      // Une signature au moins est exigée par la bibliothèque (réponse ou assertion) ; ni l'une ni l'autre n'est imposée.
      wantAssertionsSigned: false,
      wantAuthnResponseSigned: false,
      acceptedClockSkewMs: SSO_BORNES.toleranceHorlogeSecondes * 1000,
      validateInResponseTo: ValidateInResponseTo.always,
      requestIdExpirationPeriodMs: SSO_BORNES.requeteMinutes * 60e3,
      rejectReplayedAssertions: true,
      cacheProvider: cache,
      identifierFormat: null,
      forceAuthn,
      // Keycloak et générique : la classe de contexte attendue est demandée (le fournisseur impose alors la double
      // authentification) ; Entra ID n'accepte pas ces demandes, sa preuve est le claim des méthodes.
      disableRequestedAuthnContext: !demanderContexte,
      authnContext: l.mfa_valeurs,
      racComparison: 'exact',
      ...(cle ? { privateKey: cle, signatureAlgorithm: 'sha256' as const, digestAlgorithm: 'sha256' } : {}),
    });
  }

  /** Adresse de connexion chez le fournisseur (HTTP-Redirect), après enregistrement de la demande. */
  async demarrer(
    id: string,
    o: { but: 'connexion' | 'reauth'; retour: string; userId?: string; sessionHash?: Buffer },
  ): Promise<string> {
    const l = await this.ligne(id);
    if (!l || !l.actif || !this.pret(l) || !this.spEntityId)
      throw new HttpError(404, 'Ce fournisseur d’identité n’est pas disponible.', { reason: 'fournisseur' });
    const saml = this.instance(
      l,
      this.cache(l.id, {
        demande: { but: o.but, retour: o.retour, userId: o.userId ?? null, sessionHash: o.sessionHash ?? null },
      }),
      o.but === 'reauth',
    );
    return saml.getAuthorizeUrlAsync('', undefined, {});
  }

  /** Réponse reçue sur l'adresse de retour : validation complète, puis compte rapproché. Ne lève pas pour un refus. */
  async valider(id: string, samlResponse: string): Promise<ResultatAcs> {
    const l = await this.ligne(id);
    let requete: {
      but: 'connexion' | 'reauth';
      retour: string;
      user_id: string | null;
      session_hash: Buffer | null;
    } | null = null;
    const refus = (
      motif: MotifRefusSso,
      detail: string | null = null,
      plus: Partial<{ compte: { id: string; username: string } | null; identifiant: string | null }> = {},
    ): ResultatAcs => ({
      ok: false,
      motif,
      // eslint-disable-next-line no-control-regex
      detail: detail ? detail.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 300) : null,
      fournisseur: l?.libelle ?? null,
      but: requete?.but ?? null,
      retour: requete?.retour ?? null,
      compte: plus.compte ?? null,
      identifiant: plus.identifiant ?? null,
    });
    if (!l || !l.actif || !this.pret(l) || !this.spEntityId) return refus('fournisseur');
    if (samlResponse.length > SSO_BORNES.corpsAcs || !/^[A-Za-z0-9+/=\r\n]+$/.test(samlResponse)) return refus('xml');
    let xml: string;
    try {
      xml = xmlSur(Buffer.from(samlResponse, 'base64'), SSO_BORNES.corpsAcs);
      const { racine } = await analyser(xml);
      if (racine.localName !== 'Response' || racine.namespaceURI !== 'urn:oasis:names:tc:SAML:2.0:protocol')
        return refus('invalide', 'Réponse SAML (samlp:Response) attendue.');
      if (racine.getAttribute('Destination') !== this.acsUrl(l.id))
        return refus('destination', 'Destination absente ou différente de l’adresse de retour.');
      if (
        selectionner(racine, "./*[local-name()='EncryptedAssertion']").length ||
        selectionner(racine, "./*[local-name()='Assertion']").length > 1
      )
        return refus('invalide', 'Une assertion non chiffrée attendue.');
    } catch (e) {
      if (e instanceof RefusXml) return refus(e.motif === 'algorithme' ? 'algorithme' : 'xml', e.message);
      throw e;
    }
    const saml = this.instance(
      l,
      this.cache(l.id, {
        consommee: (r) => {
          requete = r;
        },
      }),
    );
    let profil: Awaited<ReturnType<SAML['validatePostResponseAsync']>>['profile'];
    try {
      profil = (await saml.validatePostResponseAsync({ SAMLResponse: Buffer.from(xml, 'utf8').toString('base64') }))
        .profile;
    } catch (e) {
      return refus(motifErreurSaml(e), e instanceof Error ? e.message : null);
    }
    if (!profil || !requete) return refus('invalide', 'Aucune assertion d’authentification.');
    const brute = profil.getAssertion?.() as X | undefined;
    const assertion = brute && typeof brute.Assertion === 'object' ? (brute.Assertion as X) : null;
    if (!assertion) return refus('invalide', 'Assertion illisible.');
    if (!destinatairesBearer(assertion).includes(this.acsUrl(l.id)))
      return refus('destination', 'Destinataire (Recipient) absent ou différent de l’adresse de retour.');
    const identifiant =
      (l.rapprochement === 'nameid'
        ? profil.nameID
        : valeursAttribut(assertion, l.rapprochement_attribut)[0]
      )?.trim() ?? '';
    const compte = identifiant
      ? await this.db.k
          .selectFrom('users')
          .select(['id', 'username', 'disabled', 'expires_at'])
          .where('sso_fournisseur_id', '=', l.id)
          .where(sql`lower(sso_identifiant)`, '=', sql`lower(${identifiant.slice(0, SSO_BORNES.valeur)})`)
          .executeTakeFirst()
      : undefined;
    const qui = compte ? { id: compte.id, username: compte.username } : null;
    const preuves =
      l.mfa_source === 'attribut' ? valeursAttribut(assertion, l.mfa_attribut) : classesContexte(assertion);
    if (!preuves.some((v) => l.mfa_valeurs.includes(v)))
      return refus('mfa_absente', `Preuve reçue : ${preuves.join(', ') || 'aucune'}.`, { compte: qui, identifiant });
    if (!identifiant) return refus('compte_inconnu', 'Identifiant absent de l’assertion.');
    if (!compte) {
      const local = await this.db.k
        .selectFrom('users')
        .select(['id', 'username'])
        .where('mode_connexion', '=', 'local')
        .where((eb) =>
          eb.or([
            eb(sql`lower(username)`, '=', sql`lower(${identifiant.slice(0, 200)})`),
            eb(sql`lower(email)`, '=', sql`lower(${identifiant.slice(0, 200)})`),
          ]),
        )
        .executeTakeFirst();
      return local
        ? refus('compte_local', 'Compte en connexion locale : la connexion unique ne lui est pas ouverte.', {
            compte: local,
            identifiant,
          })
        : refus('compte_inconnu', null, { identifiant });
    }
    if (compte.disabled || (compte.expires_at && new Date(compte.expires_at) <= new Date()))
      return refus('compte_desactive', null, { compte: qui, identifiant });
    const r = requete as {
      but: 'connexion' | 'reauth';
      retour: string;
      user_id: string | null;
      session_hash: Buffer | null;
    };
    if (r.but === 'reauth' && r.user_id !== compte.id)
      return refus('reauth_autre_compte', null, { compte: qui, identifiant });
    return {
      ok: true,
      userId: compte.id,
      username: compte.username,
      but: r.but,
      retour: r.retour,
      sessionHash: r.session_hash,
      fournisseur: l.libelle,
    };
  }
}

/** Configuration au journal : jamais l'autorité de certification complète (empreinte seulement). */
function resumeConfiguration(b: FournisseurSsoBody) {
  return {
    type: b.type,
    actif: b.actif,
    entityId: b.entityId,
    urlMetadonnees: b.urlMetadonnees,
    destination: b.urlMetadonnees ? destinationMetadonnees(b.urlMetadonnees) : null,
    autoriteTls: b.autoriteTls
      ? crypto.createHash('sha256').update(b.autoriteTls.trim()).digest('hex').slice(0, 16)
      : null,
    mfa: { source: b.mfaSource, attribut: b.mfaAttribut, valeurs: b.mfaValeurs },
    rapprochement: b.rapprochement === 'nameid' ? 'NameID' : b.rapprochementAttribut,
  };
}
