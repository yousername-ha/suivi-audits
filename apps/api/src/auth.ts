/* Sessions, authentification (mot de passe + TOTP), jeton d'installation initiale. */
import {
  DEFAULT_PREFERENCES,
  effectivePermissions,
  Preferences as PreferencesSchema,
  Rights,
  type AccessStage,
  type Permission,
  type Preferences,
  type SettingsValues,
} from '@suivi/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import type { Config } from './config.js';
import { surConnexion, type Client, type Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import { isHttps } from './http/security.js';
import { loadGrants, permanentAdminCount, permissionDenied } from './rights.js';
import { dummyVerify, sha256, token, verifyPassword, verifyTotp, type Vault } from './security/crypto.js';
import {
  checkSetupToken,
  generateSetupToken,
  makeSetupTokenRecord,
  setupTokenPending,
  type SetupTokenRecord,
} from './security/setup-token.js';

export const COOKIE_SECURE = '__Host-suivi_sid';
const COOKIE_PLAIN = 'suivi_sid';

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  /** Noms des rôles détenus (directement ou par un groupe), pour l'affichage. */
  roles: string[];
  /** Droits effectifs, recalculés à chaque requête. */
  rights: Rights;
  expiresAt: string | null;
  preferences: Preferences;
  totpEnabled: boolean;
  mustChangePassword: boolean;
}
export interface Session {
  sid: Buffer;
  csrf: string;
  mfaOk: boolean;
  user: SessionUser;
}

/** Cookies de la requête. Map : un nom choisi par le client (« __proto__ »…) ne touche jamais un objet. */
export function parseCookies(header: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (out.has(k)) continue;
    try {
      out.set(k, decodeURIComponent(part.slice(i + 1).trim()));
    } catch {
      /* cookie mal encodé : ignoré */
    }
  }
  return out;
}

/** Étape d'accès : 'ok' | 'mfa' (code TOTP à saisir) | 'enroll' (TOTP à configurer) | 'password' (changement imposé). */
export function accessStage(
  s: (Pick<Session, 'mfaOk'> & { user: Pick<SessionUser, 'totpEnabled' | 'mustChangePassword'> }) | null,
  mfaRequired: boolean,
): AccessStage {
  if (!s) return 'anon';
  if (s.user.totpEnabled && !s.mfaOk) return 'mfa';
  if (!s.user.totpEnabled && mfaRequired) return 'enroll';
  if (s.user.mustChangePassword) return 'password';
  return 'ok';
}

export class Auth {
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
    private readonly vault: Vault,
    /** Politique de sécurité courante (page Paramètres, section Sécurité). */
    private readonly policy: () => SettingsValues['securite'],
  ) {}

  stage(s: Session | null): AccessStage {
    return accessStage(s, this.cfg.mfaRequired);
  }

  /** Session complète (mot de passe, double authentification, mot de passe définitif). */
  requireAuth(s: Session | null): Session {
    if (!s) throw new HttpError(401, 'Authentification requise.', { stage: 'anon' });
    const st = this.stage(s);
    if (st !== 'ok') throw new HttpError(403, 'Authentification incomplète.', { stage: st });
    return s;
  }

  /** Garde unique des droits : session complète et permission « module:action ». */
  requirePermission(s: Session | null, p: Permission): Session {
    const sess = this.requireAuth(s);
    if (!sess.user.rights.has(p)) throw permissionDenied(p);
    return sess;
  }

  /** Accès à l'outil historique et à l'accueil : au moins un module métier lisible. */
  requireBusinessRead(s: Session | null): Session {
    const sess = this.requireAuth(s);
    if (!sess.user.rights.canReadAnyBusiness())
      throw new HttpError(403, 'Droits insuffisants : aucun module métier ne vous est ouvert en lecture.', {
        reason: 'permission',
      });
    return sess;
  }

  /* ---------------------------------------------------------------- Cookie et sessions */
  private cookie(req: FastifyRequest) {
    const secure = this.cfg.cookieSecure === 'true' || (this.cfg.cookieSecure === 'auto' && isHttps(req));
    return { name: secure ? COOKIE_SECURE : COOKIE_PLAIN, secure };
  }
  private setCookie(req: FastifyRequest, reply: FastifyReply, value: string, maxAge?: number) {
    const { name, secure } = this.cookie(req);
    reply.header(
      'Set-Cookie',
      `${name}=${value}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}${maxAge !== undefined ? `; Max-Age=${maxAge}` : ''}`,
    );
  }
  clearCookie(req: FastifyRequest, reply: FastifyReply) {
    this.setCookie(req, reply, '', 0);
  }

  async create(req: FastifyRequest, reply: FastifyReply, userId: string, mfaOk: boolean, c?: Client): Promise<string> {
    const tok = token(32);
    const csrf = token(24);
    const exp = new Date(Date.now() + this.policy().sessionMaxHours * 3600e3);
    await (c ? surConnexion(c) : this.db.k)
      .insertInto('sessions')
      .values({
        id_hash: sha256(tok),
        user_id: userId,
        csrf,
        mfa_ok: mfaOk,
        ip: req.ip || null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
        expires_at: exp,
      })
      .execute();
    this.setCookie(req, reply, tok);
    return csrf;
  }

  sessionToken(req: FastifyRequest): string | null {
    const c = parseCookies(req.headers.cookie);
    const tok = c.get(COOKIE_SECURE) || c.get(COOKIE_PLAIN);
    return tok && tok.length <= 100 ? tok : null;
  }

  /** Charge la session (glissement de l'expiration d'inactivité, au plus une écriture par minute). */
  async load(req: FastifyRequest): Promise<Session | null> {
    const tok = this.sessionToken(req);
    return tok ? this.loadByHash(sha256(tok)) : null;
  }
  async loadByHash(h: Buffer, touch = true): Promise<Session | null> {
    // Session valide : non expirée et active depuis moins que la durée d'inactivité réglée.
    const r = await this.db.k
      .selectFrom('sessions as s')
      .innerJoin('users as u', 'u.id', 's.user_id')
      .select([
        's.id_hash',
        's.csrf',
        's.mfa_ok',
        's.last_seen_at',
        'u.id',
        'u.username',
        'u.display_name',
        'u.disabled',
        'u.expires_at',
        'u.preferences',
        'u.totp_enabled',
        'u.must_change_password',
      ])
      .where('s.id_hash', '=', h)
      .where('s.expires_at', '>', sql<Date>`now()`)
      .where('s.last_seen_at', '>', sql<Date>`now() - make_interval(mins => ${this.policy().sessionIdleMinutes})`)
      .executeTakeFirst();
    if (!r || r.disabled || (r.expires_at && new Date(r.expires_at) <= new Date())) return null;
    const grants = await loadGrants(this.db.pool, r.id);
    if (touch && Date.now() - new Date(r.last_seen_at).getTime() > 60e3) {
      this.db.k
        .updateTable('sessions')
        .set({ last_seen_at: sql<Date>`now()` })
        .where('id_hash', '=', h)
        .execute()
        .catch(() => {});
    }
    return {
      sid: h,
      csrf: r.csrf,
      mfaOk: r.mfa_ok,
      user: {
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        roles: [...new Set(grants.map((g) => g.roleName))],
        rights: new Rights(effectivePermissions(grants).keys()),
        expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
        preferences: PreferencesSchema.safeParse(r.preferences).data ?? DEFAULT_PREFERENCES,
        totpEnabled: r.totp_enabled,
        mustChangePassword: r.must_change_password,
      },
    };
  }
  async destroy(sid: Buffer) {
    await this.db.k.deleteFrom('sessions').where('id_hash', '=', sid).execute();
  }
  /** Ferme les sessions d'un compte, sauf éventuellement la session courante. */
  async destroyUserSessions(userId: string, exceptSid?: Buffer | null, c?: Client) {
    await (c ? surConnexion(c) : this.db.k)
      .deleteFrom('sessions')
      .where('user_id', '=', userId)
      .$if(!!exceptSid, (q) => q.where('id_hash', '<>', exceptSid!))
      .execute();
  }
  purgeExpired() {
    return this.db.k
      .deleteFrom('sessions')
      .where((eb) =>
        eb.or([
          eb('expires_at', '<', sql<Date>`now()`),
          eb('last_seen_at', '<', sql<Date>`now() - make_interval(mins => ${this.policy().sessionIdleMinutes})`),
        ]),
      )
      .execute();
  }

  /* ---------------------------------------------------------------- Mot de passe (verrouillage progressif) */
  async checkLogin(username: string, password: string) {
    // Identifiant comparé sans casse ; la fiche complète est relue, comme avant la conversion.
    const u = await this.db.k
      .selectFrom('users')
      .selectAll()
      .where(sql`lower(username)`, '=', sql`lower(${username.slice(0, 64)})`)
      .executeTakeFirst();
    if (!u) {
      await dummyVerify(password);
      return { ok: false as const, reason: 'unknown' as const };
    }
    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      await dummyVerify(password);
      return { ok: false as const, reason: 'locked' as const, user: u };
    }
    if (!(await verifyPassword(password, u.password_hash))) {
      const n = u.failed_logins + 1;
      const { lockoutThreshold: t, lockoutMinutes } = this.policy();
      const lock = n >= t ? new Date(Date.now() + lockoutMinutes * 60e3 * Math.min(8, 2 ** (n - t))) : null;
      // Un verrou en cours n'est jamais raccourci : sans nouveau verrou, la date existante est conservée (COALESCE).
      await this.db.k
        .updateTable('users')
        .set({ failed_logins: n, ...(lock ? { locked_until: lock } : {}) })
        .where('id', '=', u.id)
        .execute();
      return { ok: false as const, reason: lock ? ('locked_now' as const) : ('bad_password' as const), user: u };
    }
    if (u.disabled) return { ok: false as const, reason: 'disabled' as const, user: u };
    if (u.expires_at && new Date(u.expires_at) <= new Date())
      return { ok: false as const, reason: 'expired' as const, user: u };
    await this.db.k
      .updateTable('users')
      .set({ failed_logins: 0, locked_until: null, last_login_at: sql<Date>`now()` })
      .where('id', '=', u.id)
      .execute();
    return { ok: true as const, user: u };
  }

  /* ---------------------------------------------------------------- TOTP (anti-rejeu) */
  async checkTotp(userId: string, code: string): Promise<boolean> {
    const u = await this.db.k
      .selectFrom('users')
      .select(['id', 'totp_secret', 'totp_last_step'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!u || !u.totp_secret) return false;
    const key = this.vault.openSmall(u.totp_secret, 'totp:' + u.id);
    const step = verifyTotp(key, code, Number(u.totp_last_step));
    if (!step) return false;
    // Anti-rejeu : le pas n'est accepté qu'une fois, et seulement s'il dépasse le dernier pas utilisé.
    const r = await this.db.k
      .updateTable('users')
      .set({ totp_last_step: step })
      .where('id', '=', u.id)
      .where('totp_last_step', '<', step)
      .executeTakeFirst();
    return Number(r.numUpdatedRows) === 1;
  }

  /* ---------------------------------------------------------------- Jeton d'installation */
  async adminExists(): Promise<boolean> {
    return (await permanentAdminCount(this.db.pool)) > 0;
  }
  async setupRecord(): Promise<SetupTokenRecord | null> {
    const r = await this.db.k
      .selectFrom('settings')
      .select('value')
      .where('key', '=', 'setup_token')
      .executeTakeFirst();
    return (r?.value as SetupTokenRecord | undefined) ?? null;
  }
  async setupPending(): Promise<boolean> {
    return setupTokenPending(await this.setupRecord());
  }

  /** Émet un nouveau jeton (le précédent est annulé), le journalise dans l'audit et l'affiche sur la sortie standard. */
  async issueSetupToken(reason: string, out: (s: string) => void = (s) => process.stdout.write(s)) {
    const tok = generateSetupToken();
    const rec = await makeSetupTokenRecord(tok, reason);
    await this.db.k
      .insertInto('settings')
      .values({ key: 'setup_token', value: JSON.stringify(rec) })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value'), updated_at: sql<Date>`now()` })),
      )
      .execute();
    await this.db.audit(null, null, 'setup.token_issued', '', { reason, expires: rec.expires });
    const expiry =
      new Date(rec.expires).toLocaleString('fr-FR', { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'short' }) +
      ' UTC';
    const line = '='.repeat(72);
    out(
      `\n${line}\n  JETON D'INSTALLATION (usage unique, valable 24 h)\n\n    ${tok}\n\n` +
        `  Expire le : ${expiry}\n` +
        `  Ouvrir ${this.cfg.publicUrl || 'https://<serveur>'}/setup et le saisir pour créer le compte administrateur.\n` +
        `  Nouveau jeton (annule le précédent) : docker compose exec app setup-token\n${line}\n\n`,
    );
    return { token: tok, expires: rec.expires };
  }

  /** Vérifie et consomme le jeton dans la transaction « c » (le jeton est marqué utilisé, jamais supprimé). */
  async consumeSetupToken(tok: unknown, c: Client) {
    const k = surConnexion(c);
    const r = await k
      .selectFrom('settings')
      .select('value')
      .where('key', '=', 'setup_token')
      .forUpdate()
      .executeTakeFirst();
    const rec = (r?.value as SetupTokenRecord | undefined) ?? null;
    const status = await checkSetupToken(tok, rec);
    if (status === 'ok') {
      // Jeton marqué utilisé (date ajoutée à l'enregistrement), jamais supprimé.
      await k
        .updateTable('settings')
        .set({ value: sql<string>`value || jsonb_build_object('usedAt', now())`, updated_at: sql<Date>`now()` })
        .where('key', '=', 'setup_token')
        .execute();
    }
    return { status, reason: rec?.reason ?? null };
  }
}
