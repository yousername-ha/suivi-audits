/* Clés de sécurité FIDO2 / WebAuthn (ADR 0079) : second facteur après le mot de passe, à côté du TOTP (toujours obligatoire)
   et des codes de récupération. La cryptographie est entièrement déléguée à @simplewebauthn/server ; ce module garde les
   challenges (côté serveur, liés à la session, usage unique, 5 minutes), les clés, le compteur de signature, la politique et
   la journalisation (journal d'audit + ligne JSON pour le SIEM). Aucun challenge, clé publique ni code n'est journalisé. */
import crypto from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  SettingsService,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { decodeAttestationObject, isoBase64URL } from '@simplewebauthn/server/helpers';
import {
  CLES_MAX,
  CODES_RECUPERATION,
  REAUTH_MINUTES,
  WEBAUTHN_POLITIQUE_DEFAUT,
  WebauthnPolitique,
  type CleOut,
  type ReponseAuthentification,
  type ReponseEnrolement,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { Config } from './config.js';
import type { Actor, Db, Kdb } from './db/db.js';
import { RACINES_YUBICO } from './security/racines-yubico.js';
import { base32, safeEqual, sha256, type Vault } from './security/crypto.js';

/** Durée de vie d'un challenge (exigence : 5 minutes au plus). Le délai laissé au navigateur est un peu plus court. */
export const CHALLENGE_TTL_S = 300;
const DELAI_NAVIGATEUR_MS = 240_000;
/** ES256 (-7), EdDSA (-8), RS256 (-257). */
export const ALGORITHMES = [-8, -7, -257];
const CLE_POLITIQUE = 'webauthn:politique';

export type UsageChallenge = 'enrolement' | 'connexion' | 'reauth';

interface PolitiqueStockee {
  politique: WebauthnPolitique;
  version: number;
  activeeLe: string | null;
}

/** Contexte d'un évènement de sécurité, pour le journal d'audit et le SIEM. */
export interface ContexteEvt {
  ip: string | null;
  ua: string;
}

/** Message d'erreur de la bibliothèque, pour le journal : un message qui cite le challenge reçu est remplacé (aucun challenge
    au journal) ; les autres (origine, RP ID, UV, compteur) sont gardés, bornés. */
export const nettoyerDetail = (message: string) =>
  /challenge/i.test(message) ? 'challenge non conforme' : message.replace(/[\p{Cc}]+/gu, ' ').slice(0, 200);

/** Identifiant de clé tronqué pour les journaux : assez pour la retrouver, pas pour la rejouer ailleurs. */
export const tronquer = (credentialId: string) => credentialId.slice(0, 8) + '…';

export type ResultatAuth =
  | { ok: true; cleId: string; credentialId: string; aaguid: string }
  | {
      ok: false;
      motif: 'challenge' | 'inconnue' | 'revoquee' | 'suspecte' | 'verification' | 'compteur';
      credentialId?: string;
      aaguid?: string;
      detail?: string;
    };

export type ResultatEnrolement =
  | { ok: true; cle: CleOut }
  | { ok: false; motif: 'challenge' | 'verification' | 'materiel' | 'doublon' | 'trop'; detail?: string };

/** Évènement d'alerte (clé suspecte, connexion d'un administrateur par un facteur de secours). Branché par les services. */
export interface AlerteCleEvt {
  type: 'cle_suspecte' | 'facteur_secours';
  userId: string;
  facteur?: 'totp' | 'code_recuperation';
  credentialId?: string;
}

export class Webauthn {
  private stockee: PolitiqueStockee = { politique: WEBAUTHN_POLITIQUE_DEFAUT, version: 0, activeeLe: null };
  /** Alerte de sécurité (application et courriel) ; ne fait jamais échouer l'authentification. */
  surAlerte: ((e: AlerteCleEvt) => Promise<void>) | null = null;

  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
    private readonly vault: Vault,
  ) {}

  get disponible(): boolean {
    return this.cfg.webauthn.disponible;
  }

  /* ---------------------------------------------------------------- Politique */
  async charger(): Promise<void> {
    const r = await this.db.k
      .selectFrom('settings')
      .select('value')
      .where('key', '=', CLE_POLITIQUE)
      .executeTakeFirst();
    const v = r?.value as Partial<PolitiqueStockee> | undefined;
    const p = WebauthnPolitique.safeParse(v?.politique);
    this.stockee = {
      politique: p.success ? p.data : WEBAUTHN_POLITIQUE_DEFAUT,
      version: typeof v?.version === 'number' ? v.version : 0,
      activeeLe: typeof v?.activeeLe === 'string' ? v.activeeLe : null,
    };
  }
  politique(): PolitiqueStockee {
    return this.stockee;
  }

  /** Enregistre la politique (version attendue : concurrence optimiste). Renvoie l'ancienne et la nouvelle. */
  async ecrirePolitique(k: Kdb, p: WebauthnPolitique, versionAttendue: number) {
    const r = await k
      .selectFrom('settings')
      .select('value')
      .where('key', '=', CLE_POLITIQUE)
      .forUpdate()
      .executeTakeFirst();
    const avant = (r?.value as PolitiqueStockee | undefined) ?? {
      politique: WEBAUTHN_POLITIQUE_DEFAUT,
      version: 0,
      activeeLe: null,
    };
    if ((avant.version ?? 0) !== versionAttendue) return { conflit: true as const, avant };
    const activeeLe = p.obligatoireAdmins
      ? avant.politique?.obligatoireAdmins && avant.activeeLe
        ? avant.activeeLe
        : new Date().toISOString()
      : null;
    const apres: PolitiqueStockee = { politique: p, version: (avant.version ?? 0) + 1, activeeLe };
    await k
      .insertInto('settings')
      .values({ key: CLE_POLITIQUE, value: JSON.stringify(apres) })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value'), updated_at: sql<Date>`now()` })),
      )
      .execute();
    return { conflit: false as const, avant, apres };
  }

  /** Une clé est-elle exigée pour ce compte, et jusqu'à quand dure la période de grâce ? Toujours non si le serveur ne
      propose pas les clés (configuration RP inutilisable) : un compte n'est jamais bloqué sur un facteur impossible. */
  exigence(u: { admin: boolean; creeLe: Date; reenrolement: boolean }, now = Date.now()) {
    if (!this.disponible) return { requise: false, echeance: null as Date | null };
    if (u.reenrolement) return { requise: true, echeance: null as Date | null };
    const { politique, activeeLe } = this.stockee;
    if (!politique.obligatoireAdmins || !u.admin || !activeeLe)
      return { requise: false, echeance: null as Date | null };
    const depart = Math.max(new Date(activeeLe).getTime(), u.creeLe.getTime());
    const echeance = new Date(depart + politique.graceJours * 86400e3);
    return now >= echeance.getTime() ? { requise: true, echeance: null } : { requise: false, echeance };
  }

  /* ---------------------------------------------------------------- Challenges */
  /** Nouveau challenge (32 octets aléatoires) pour cette session et cet usage, qui remplace le précédent. Seule l'empreinte de
      sa forme base64url (celle que le navigateur renvoie dans clientDataJSON) est conservée. */
  private async nouveauChallenge(sid: Buffer, usage: UsageChallenge): Promise<Uint8Array<ArrayBuffer>> {
    const octets = crypto.randomFillSync(new Uint8Array(32));
    const challenge = isoBase64URL.fromBuffer(octets);
    await this.db.k
      .insertInto('webauthn_challenges')
      .values({
        session_hash: sid,
        usage,
        challenge_hash: sha256(challenge),
        expires_at: sql<Date>`now() + make_interval(secs => ${CHALLENGE_TTL_S})`,
      })
      .onConflict((oc) =>
        oc.columns(['session_hash', 'usage']).doUpdateSet((eb) => ({
          challenge_hash: eb.ref('excluded.challenge_hash'),
          expires_at: eb.ref('excluded.expires_at'),
        })),
      )
      .execute();
    return octets;
  }

  /** Consomme le challenge (usage unique : supprimé dès sa lecture, qu'il soit valide ou non). Null : absent ou expiré. */
  private async consommerChallenge(sid: Buffer, usage: UsageChallenge): Promise<Buffer | null> {
    const r = await this.db.k
      .deleteFrom('webauthn_challenges')
      .where('session_hash', '=', sid)
      .where('usage', '=', usage)
      .returning(['challenge_hash', sql<boolean>`expires_at > now()`.as('valide')])
      .executeTakeFirst();
    return r && r.valide ? r.challenge_hash : null;
  }

  purgerChallenges() {
    return this.db.k
      .deleteFrom('webauthn_challenges')
      .where('expires_at', '<', sql<Date>`now()`)
      .execute();
  }

  /* ---------------------------------------------------------------- Clés */
  private sortie(r: {
    id: string;
    label: string;
    device_type: 'singleDevice' | 'multiDevice';
    backed_up: boolean;
    aaguid: string;
    transports: unknown;
    created_at: Date;
    last_used_at: Date | null;
    suspect_at: Date | null;
    revoked_at: Date | null;
  }): CleOut {
    return {
      id: r.id,
      label: r.label,
      deviceType: r.device_type,
      backedUp: r.backed_up,
      aaguid: r.aaguid,
      transports: Array.isArray(r.transports) ? r.transports.map(String) : [],
      createdAt: new Date(r.created_at).toISOString(),
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
      suspect: !!r.suspect_at,
      revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
    };
  }

  async cles(userId: string, o: { revoquees?: boolean } = {}): Promise<CleOut[]> {
    const r = await this.db.k
      .selectFrom('webauthn_credentials')
      .select([
        'id',
        'label',
        'device_type',
        'backed_up',
        'aaguid',
        'transports',
        'created_at',
        'last_used_at',
        'suspect_at',
        'revoked_at',
      ])
      .where('user_id', '=', userId)
      .$if(!o.revoquees, (q) => q.where('revoked_at', 'is', null))
      .orderBy('created_at')
      .execute();
    return r.map((x) => this.sortie(x));
  }

  /** Clés utilisables (ni révoquées ni suspectes). */
  async nbUtilisables(userId: string, k: Kdb = this.db.k): Promise<number> {
    const r = await k
      .selectFrom('webauthn_credentials')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('suspect_at', 'is', null)
      .executeTakeFirstOrThrow();
    return r.n;
  }

  /** Identifiant WebAuthn du compte : 32 octets aléatoires créés au premier enrôlement, jamais l'UUID interne. */
  private async userHandle(userId: string): Promise<Buffer> {
    const r = await this.db.k
      .updateTable('users')
      .set({ webauthn_user_handle: sql<Buffer>`coalesce(webauthn_user_handle, ${crypto.randomBytes(32)})` })
      .where('id', '=', userId)
      .returning('webauthn_user_handle')
      .executeTakeFirstOrThrow();
    return r.webauthn_user_handle as Buffer;
  }

  /** Racines d'attestation du format « packed » : celles de Yubico et celles ajoutées, seulement sous la politique « clés
      matérielles uniquement ». Sans racine, la bibliothèque ne vérifie pas la chaîne (attestation « none » attendue). */
  private appliquerRacines() {
    const { politique } = this.stockee;
    const racines = politique.materielUniquement ? [...RACINES_YUBICO, ...politique.racinesSupplementaires] : [];
    SettingsService.setRootCertificates({ identifier: 'packed', certificates: racines });
  }

  async optionsEnrolement(
    sid: Buffer,
    user: { id: string; username: string; displayName: string },
  ): Promise<PublicKeyCredentialCreationOptionsJSON | null> {
    // Clés non révoquées seulement : une clé physique révoquée (retrouvée, ou après réinitialisation) peut être enregistrée
    // de nouveau, sous un nouvel identifiant ; un même identifiant reste refusé (contrainte d'unicité).
    const existantes = await this.db.k
      .selectFrom('webauthn_credentials')
      .select(['credential_id', 'transports'])
      .where('user_id', '=', user.id)
      .where('revoked_at', 'is', null)
      .execute();
    if (existantes.length >= CLES_MAX) return null;
    const { politique } = this.stockee;
    return generateRegistrationOptions({
      rpName: this.cfg.webauthn.rpName,
      rpID: this.cfg.webauthn.rpId!,
      userName: user.username,
      userDisplayName: user.displayName || user.username,
      userID: new Uint8Array(await this.userHandle(user.id)),
      challenge: await this.nouveauChallenge(sid, 'enrolement'),
      timeout: DELAI_NAVIGATEUR_MS,
      attestationType: politique.materielUniquement ? 'direct' : 'none',
      excludeCredentials: existantes.map((c) => ({
        id: c.credential_id,
        transports: (Array.isArray(c.transports) ? c.transports : []) as AuthenticatorTransport[],
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      supportedAlgorithmIDs: ALGORITHMES,
    });
  }

  async verifierEnrolement(
    sid: Buffer,
    userId: string,
    response: ReponseEnrolement,
    label: string,
  ): Promise<ResultatEnrolement> {
    const attendu = await this.consommerChallenge(sid, 'enrolement');
    if (!attendu) return { ok: false, motif: 'challenge' };
    if ((await this.nbActives(userId)) >= CLES_MAX) return { ok: false, motif: 'trop' };
    const { politique } = this.stockee;
    let info;
    try {
      this.appliquerRacines();
      const v = await verifyRegistrationResponse({
        response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
        expectedChallenge: (c) => safeEqual(sha256(c).toString('hex'), attendu.toString('hex')),
        expectedOrigin: this.cfg.webauthn.origines,
        expectedRPID: this.cfg.webauthn.rpId!,
        expectedType: 'webauthn.create',
        requireUserPresence: true,
        requireUserVerification: true,
        supportedAlgorithmIDs: ALGORITHMES,
      });
      if (!v.verified) return { ok: false, motif: 'verification' };
      info = v.registrationInfo;
    } catch (e) {
      return { ok: false, motif: 'verification', detail: nettoyerDetail((e as Error).message) };
    }
    if (politique.materielUniquement) {
      // Attestation complète exigée : format « packed » avec chaîne de certificats (vérifiée jusqu'à une racine ci-dessus),
      // AAGUID dans la liste blanche. L'auto-attestation (sans certificat) n'atteste aucun matériel.
      const att = decodeAttestationObject(isoBase64URL.toBuffer(response.response.attestationObject));
      const x5c = att.get('attStmt').get('x5c');
      if (info.fmt !== 'packed' || !Array.isArray(x5c) || x5c.length === 0)
        return { ok: false, motif: 'materiel', detail: `attestation « ${info.fmt} » sans chaîne de certificats` };
      if (!politique.aaguidAutorises.includes(info.aaguid.toLowerCase()))
        return { ok: false, motif: 'materiel', detail: `modèle ${info.aaguid} non autorisé` };
    }
    try {
      const r = await this.db.k
        .insertInto('webauthn_credentials')
        .values({
          user_id: userId,
          credential_id: info.credential.id,
          public_key: Buffer.from(info.credential.publicKey),
          sign_count: info.credential.counter,
          transports: JSON.stringify(info.credential.transports ?? []),
          aaguid: info.aaguid,
          device_type: info.credentialDeviceType,
          backed_up: info.credentialBackedUp,
          label,
          attestation_fmt: info.fmt,
        })
        .returning([
          'id',
          'label',
          'device_type',
          'backed_up',
          'aaguid',
          'transports',
          'created_at',
          'last_used_at',
          'suspect_at',
          'revoked_at',
        ])
        .executeTakeFirstOrThrow();
      await this.db.k.updateTable('users').set({ webauthn_reenrolement: false }).where('id', '=', userId).execute();
      return { ok: true, cle: this.sortie(r) };
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return { ok: false, motif: 'doublon' };
      throw e;
    }
  }

  private async nbActives(userId: string): Promise<number> {
    const r = await this.db.k
      .selectFrom('webauthn_credentials')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .executeTakeFirstOrThrow();
    return r.n;
  }

  /** Options de connexion (second facteur) ou de ré-authentification : seulement les clés utilisables du compte. */
  async optionsAuthentification(
    sid: Buffer,
    userId: string,
    usage: 'connexion' | 'reauth',
  ): Promise<PublicKeyCredentialRequestOptionsJSON | null> {
    const cles = await this.db.k
      .selectFrom('webauthn_credentials')
      .select(['credential_id', 'transports'])
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('suspect_at', 'is', null)
      .execute();
    if (cles.length === 0) return null;
    return generateAuthenticationOptions({
      rpID: this.cfg.webauthn.rpId!,
      challenge: await this.nouveauChallenge(sid, usage),
      timeout: DELAI_NAVIGATEUR_MS,
      userVerification: 'required',
      allowCredentials: cles.map((c) => ({
        id: c.credential_id,
        transports: (Array.isArray(c.transports) ? c.transports : []) as AuthenticatorTransport[],
      })),
    });
  }

  /** Vérifie une réponse de clé pour ce compte : challenge de la session (usage unique), origine, rpIdHash, présence et
      vérification de l'utilisateur, signature, puis compteur. Le compteur n'est contrôlé qu'APRÈS une signature valide :
      une réponse forgée ne peut pas faire suspendre la clé d'un tiers. */
  async verifierAuthentification(
    sid: Buffer,
    userId: string,
    usage: 'connexion' | 'reauth',
    response: ReponseAuthentification,
  ): Promise<ResultatAuth> {
    const attendu = await this.consommerChallenge(sid, usage);
    if (!attendu) return { ok: false, motif: 'challenge', credentialId: response.id };
    const cle = await this.db.k
      .selectFrom('webauthn_credentials')
      .select(['id', 'credential_id', 'public_key', 'sign_count', 'transports', 'aaguid', 'revoked_at', 'suspect_at'])
      .where('user_id', '=', userId)
      .where('credential_id', '=', response.id)
      .executeTakeFirst();
    if (!cle) return { ok: false, motif: 'inconnue', credentialId: response.id };
    const base = { credentialId: cle.credential_id, aaguid: cle.aaguid };
    if (cle.revoked_at) return { ok: false, motif: 'revoquee', ...base };
    if (cle.suspect_at) return { ok: false, motif: 'suspecte', ...base };
    let info;
    try {
      const v = await verifyAuthenticationResponse({
        response: response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
        expectedChallenge: (c) => safeEqual(sha256(c).toString('hex'), attendu.toString('hex')),
        expectedOrigin: this.cfg.webauthn.origines,
        expectedRPID: this.cfg.webauthn.rpId!,
        expectedType: 'webauthn.get',
        requireUserVerification: true,
        // Compteur à 0 ici : le contrôle du compteur est fait ci-dessous, après la signature, pour distinguer l'anomalie.
        credential: {
          id: cle.credential_id,
          publicKey: new Uint8Array(cle.public_key),
          counter: 0,
          transports: (Array.isArray(cle.transports) ? cle.transports : []) as AuthenticatorTransport[],
        },
      });
      if (!v.verified) return { ok: false, motif: 'verification', ...base };
      info = v.authenticationInfo;
    } catch (e) {
      return { ok: false, motif: 'verification', ...base, detail: nettoyerDetail((e as Error).message) };
    }
    // Compteur de signature : une clé qui en tient un (non nul) doit le faire progresser. Les passkeys synchronisées
    // renvoient toujours 0 : 0 après 0 est accepté. Un compteur qui stagne ou recule signale une clé possiblement clonée.
    const stocke = Number(cle.sign_count);
    const recu = info.newCounter;
    if ((recu > 0 || stocke > 0) && recu <= stocke) {
      await this.db.k
        .updateTable('webauthn_credentials')
        .set({ suspect_at: sql<Date>`now()` })
        .where('id', '=', cle.id)
        .where('suspect_at', 'is', null)
        .execute();
      return { ok: false, motif: 'compteur', ...base, detail: `compteur ${recu} pour ${stocke} enregistré` };
    }
    // Mise à jour conditionnelle : deux réponses simultanées de la même clé ne font progresser le compteur qu'une fois.
    const maj = await this.db.k
      .updateTable('webauthn_credentials')
      .set({ sign_count: recu, last_used_at: sql<Date>`now()`, backed_up: info.credentialBackedUp })
      .where('id', '=', cle.id)
      .where((eb) => (recu > 0 ? eb('sign_count', '<', recu) : eb('sign_count', '=', 0)))
      .executeTakeFirst();
    if (Number(maj.numUpdatedRows) !== 1)
      return { ok: false, motif: 'verification', ...base, detail: 'compteur modifié par une réponse simultanée' };
    return { ok: true, cleId: cle.id, ...base };
  }

  async renommer(userId: string, id: string, label: string): Promise<boolean> {
    const r = await this.db.k
      .updateTable('webauthn_credentials')
      .set({ label })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return Number(r.numUpdatedRows) === 1;
  }

  /** Révocation (jamais une suppression : la clé reste au dossier du compte). */
  async revoquer(k: Kdb, userId: string, id: string, par: string) {
    return k
      .updateTable('webauthn_credentials')
      .set({ revoked_at: sql<Date>`now()`, revoked_by: par })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .returning(['credential_id', 'aaguid'])
      .executeTakeFirst();
  }

  /** Réactivation d'une clé suspecte par un administrateur (après vérification de la clé auprès de son porteur). */
  async reactiver(userId: string, id: string) {
    return this.db.k
      .updateTable('webauthn_credentials')
      .set({ suspect_at: null })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('suspect_at', 'is not', null)
      .returning(['credential_id', 'aaguid'])
      .executeTakeFirst();
  }

  /** Réinitialisation par un administrateur : toutes les clés révoquées, codes de récupération effacés, ré-enrôlement imposé. */
  async reinitialiser(k: Kdb, userId: string, par: string): Promise<number> {
    const r = await k
      .updateTable('webauthn_credentials')
      .set({ revoked_at: sql<Date>`now()`, revoked_by: par })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    await k.deleteFrom('recovery_codes').where('user_id', '=', userId).execute();
    await k.updateTable('users').set({ webauthn_reenrolement: true }).where('id', '=', userId).execute();
    return Number(r.numUpdatedRows);
  }

  /* ---------------------------------------------------------------- Codes de récupération */
  private empreinteCode(userId: string, code: string): Buffer {
    return this.vault.hmac('recovery-code', userId + ':' + code);
  }

  /** Dix nouveaux codes (les anciens sont effacés), affichés une seule fois : 80 bits chacun, en quatre groupes. */
  async genererCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: CODES_RECUPERATION }, () => base32(crypto.randomBytes(10)).slice(0, 16));
    await this.db.tx(async (_c, k) => {
      await k.deleteFrom('recovery_codes').where('user_id', '=', userId).execute();
      await k
        .insertInto('recovery_codes')
        .values(codes.map((c) => ({ user_id: userId, code_hash: this.empreinteCode(userId, c) })))
        .execute();
    });
    return codes.map((c) => c.match(/.{4}/g)!.join('-'));
  }

  /** Consomme un code (usage unique, atomique). */
  async consommerCode(userId: string, code: string): Promise<boolean> {
    const r = await this.db.k
      .updateTable('recovery_codes')
      .set({ used_at: sql<Date>`now()` })
      .where('user_id', '=', userId)
      .where('code_hash', '=', this.empreinteCode(userId, code))
      .where('used_at', 'is', null)
      .executeTakeFirst();
    return Number(r.numUpdatedRows) === 1;
  }

  async codesRestants(userId: string): Promise<number> {
    const r = await this.db.k
      .selectFrom('recovery_codes')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('user_id', '=', userId)
      .where('used_at', 'is', null)
      .executeTakeFirstOrThrow();
    return r.n;
  }

  /* ---------------------------------------------------------------- Ré-authentification récente */
  async marquerReauth(sid: Buffer): Promise<Date> {
    const r = await this.db.k
      .updateTable('sessions')
      .set({ reauth_at: sql<Date>`now()` })
      .where('id_hash', '=', sid)
      .returning('reauth_at')
      .executeTakeFirstOrThrow();
    return new Date(r.reauth_at!.getTime() + REAUTH_MINUTES * 60e3);
  }

  /* ---------------------------------------------------------------- Journalisation (audit + SIEM) */
  /** Évènement de sécurité : une ligne au journal d'audit (en ajout seul) et une ligne JSON sur la sortie standard, collectée
      par le SIEM. Champs : compte, IP, user-agent, identifiant de clé tronqué, AAGUID, résultat ; jamais de challenge, de
      clé publique, de signature ni de code. */
  async evenement(
    who: Partial<Actor> | null,
    ctx: ContexteEvt,
    action: string,
    d: {
      resultat: 'succes' | 'echec' | 'refus' | 'alerte';
      credentialId?: string;
      aaguid?: string;
      cible?: string;
    } & Record<string, unknown>,
  ): Promise<void> {
    const { credentialId, cible, ...reste } = d;
    const details = {
      ...reste,
      ...(credentialId ? { cle: tronquer(credentialId) } : {}),
      ua: ctx.ua.slice(0, 300),
    };
    await this.db.audit(who, ctx.ip, action, cible ?? '', details);
    const niveau = d.resultat === 'succes' ? 'info' : 'warn';
    this.db.log[niveau](
      { evt: 'securite.webauthn', action, user: who?.username ?? '', userId: who?.id ?? null, ip: ctx.ip, ...details },
      action,
    );
  }

  async alerter(e: AlerteCleEvt): Promise<void> {
    if (!this.surAlerte) return;
    try {
      await this.surAlerte(e);
    } catch (err) {
      this.db.log.error({ err: (err as Error).message }, 'alerte de clé de sécurité non émise');
    }
  }
}
