/* Authentification, installation initiale et compte personnel. */
import crypto from 'node:crypto';
import {
  LoginBody,
  MeOut,
  MfaBody,
  PasswordBody,
  PasswordChangeBody,
  SETUP_TOKEN_MESSAGES,
  SetupBody,
  SetupStatusOut,
  StageOut,
  TotpBeginOut,
  TotpConfirmBody,
  type MeOut as MeOutT,
} from '@suivi/shared';
import { z } from 'zod';
import { accessStage, type Session } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { base32, hashPassword, passwordProblems, verifyPassword, verifyTotp } from '../security/crypto.js';
import type { Services } from '../services.js';

export function checkPassword(svc: Services, pw: unknown, username: string) {
  const p = passwordProblems(pw, svc.cfg.passwordMinLength, [username]);
  if (p.length) throw new HttpError(422, 'Mot de passe trop faible : ' + p.join(', ') + '.');
}

export function meOut(svc: Services, s: Session | null): MeOutT {
  return {
    stage: svc.auth.stage(s),
    csrf: s ? s.csrf : null,
    user: s ? s.user : null,
    mfaRequired: svc.cfg.mfaRequired,
    passwordMinLength: svc.cfg.passwordMinLength,
    appName: svc.cfg.appName,
    orgName: svc.cfg.orgName,
    version: svc.cfg.version,
  };
}

const SETUP_HTTP = { invalid: 401, expired: 410, used: 409, none: 410 } as const;
const stageAfter = (svc: Services, user: { totpEnabled: boolean; mustChangePassword: boolean }, mfaOk: boolean) =>
  accessStage({ mfaOk, user }, svc.cfg.mfaRequired);

export const authRoutes = [
  route({
    method: 'GET',
    url: '/api/auth/me',
    summary: 'État de la session (étape d’accès, jeton CSRF, utilisateur)',
    tags: ['Authentification'],
    access: 'public',
    response: MeOut,
    handler: async ({ svc, s }) => meOut(svc, s),
  }),
  route({
    method: 'POST',
    url: '/api/auth/login',
    summary: 'Connexion (identifiant et mot de passe)',
    tags: ['Authentification'],
    access: 'public',
    csrf: false,
    body: LoginBody,
    response: StageOut,
    handler: async ({ svc, req, reply, s, ip, body }) => {
      const username = body.username;
      if (!svc.limits.loginByIp(ip) || !svc.limits.loginByUser(username.toLowerCase())) {
        await svc.db.audit({ username }, ip, 'auth.rate_limited');
        throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
      }
      const r = await svc.auth.checkLogin(username, body.password);
      if (!r.ok) {
        await svc.db.audit(
          r.user ? { id: r.user.id, username: r.user.username } : { username },
          ip,
          'auth.login_failed',
          '',
          { reason: r.reason },
        );
        if (r.reason === 'locked' || r.reason === 'locked_now') {
          throw new HttpError(
            423,
            'Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard ou contactez un administrateur.',
          );
        }
        throw new HttpError(401, 'Identifiant ou mot de passe incorrect.');
      }
      if (s) await svc.auth.destroy(s.sid);
      await svc.auth.create(req, reply, r.user.id, false);
      await svc.db.audit({ id: r.user.id, username: r.user.username }, ip, 'auth.password_ok');
      return {
        stage: stageAfter(
          svc,
          { totpEnabled: r.user.totp_enabled, mustChangePassword: r.user.must_change_password },
          false,
        ),
      };
    },
  }),
  route({
    method: 'POST',
    url: '/api/auth/mfa',
    summary: 'Second facteur : code TOTP (anti-rejeu, rotation de la session)',
    tags: ['Authentification'],
    access: 'session',
    body: MfaBody,
    response: StageOut,
    handler: async ({ svc, req, reply, s, ip, body }) => {
      const sess = s as Session;
      if (!svc.limits.mfaBySession(sess.sid.toString('hex')))
        throw new HttpError(429, 'Trop de tentatives. Reconnectez-vous.');
      if (!(await svc.auth.checkTotp(sess.user.id, body.code))) {
        await svc.db.audit(sess.user, ip, 'auth.mfa_failed');
        throw new HttpError(401, 'Code incorrect ou déjà utilisé.');
      }
      // Rotation de la session après élévation (prévention de la fixation de session).
      await svc.auth.destroy(sess.sid);
      await svc.auth.create(req, reply, sess.user.id, true);
      await svc.db.audit(sess.user, ip, 'auth.login');
      return { stage: stageAfter(svc, sess.user, true) };
    },
  }),
  route({
    method: 'POST',
    url: '/api/auth/logout',
    summary: 'Déconnexion',
    tags: ['Authentification'],
    access: 'public',
    handler: async ({ svc, req, reply, s, ip }) => {
      if (s) {
        await svc.auth.destroy(s.sid);
        await svc.db.audit(s.user, ip, 'auth.logout');
      }
      svc.auth.clearCookie(req, reply);
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Installation */
  route({
    method: 'GET',
    url: '/api/setup',
    summary: "État de l'installation initiale",
    tags: ['Installation'],
    access: 'public',
    response: SetupStatusOut,
    handler: async ({ svc }) => {
      const adminExists = await svc.auth.adminExists();
      const pending = await svc.auth.setupPending();
      return { needed: pending || !adminExists, pending, adminExists };
    },
  }),
  route({
    method: 'POST',
    url: '/api/setup',
    summary: "Création du compte administrateur avec le jeton d'installation",
    tags: ['Installation'],
    access: 'public',
    csrf: false,
    body: SetupBody,
    status: 201,
    response: StageOut,
    handler: async ({ svc, req, reply, ip, body }) => {
      if (!svc.limits.setupByIp(ip)) throw new HttpError(429, 'Trop de tentatives. Réessayez dans 15 minutes.');
      checkPassword(svc, body.password, body.username);
      const hash = await hashPassword(body.password);
      const res = await svc.db
        .tx(async (c) => {
          const k = await svc.auth.consumeSetupToken(body.token, c);
          if (k.status !== 'ok') return { status: k.status };
          if (k.reason !== 'recovery' && (await c.query("SELECT 1 FROM users WHERE role='admin'")).rowCount) {
            throw new HttpError(409, 'Un administrateur existe déjà.');
          }
          const u = await c.query<{ id: string }>(
            "INSERT INTO users(username, display_name, email, role, password_hash) VALUES ($1,$2,$3,'admin',$4) RETURNING id",
            [body.username, body.displayName || body.username, body.email || '', hash],
          );
          return { status: 'ok' as const, id: u.rows[0]!.id };
        }, body.username)
        .catch((e: { code?: string }) => {
          if (e.code === '23505') throw new HttpError(409, 'Cet identifiant existe déjà.');
          throw e;
        });
      if (res.status !== 'ok') {
        await svc.db.audit({ username: body.username }, ip, 'setup.failed', '', { reason: res.status });
        throw new HttpError(SETUP_HTTP[res.status], SETUP_TOKEN_MESSAGES[res.status], { reason: res.status });
      }
      await svc.db.audit({ id: res.id, username: body.username }, ip, 'setup.admin_created');
      await svc.auth.create(req, reply, res.id, false);
      return { stage: stageAfter(svc, { totpEnabled: false, mustChangePassword: false }, false) };
    },
  }),

  /* ---------------------------------------------------------------- Compte personnel */
  route({
    method: 'POST',
    url: '/api/account/password',
    summary: 'Changement de mot de passe (ferme les autres sessions)',
    tags: ['Compte'],
    access: 'session',
    body: PasswordChangeBody,
    response: StageOut,
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      if (!['ok', 'password'].includes(svc.auth.stage(sess))) throw new HttpError(403, 'Authentification incomplète.');
      const u = (await svc.db.one<{ username: string; password_hash: string }>(
        'SELECT username, password_hash FROM users WHERE id=$1',
        [sess.user.id],
      ))!;
      if (!(await verifyPassword(body.current, u.password_hash))) {
        await svc.db.audit(sess.user, ip, 'account.password_failed');
        throw new HttpError(401, 'Mot de passe actuel incorrect.');
      }
      checkPassword(svc, body.next, u.username);
      if (await verifyPassword(body.next, u.password_hash))
        throw new HttpError(422, "Le nouveau mot de passe doit être différent de l'actuel.");
      await svc.db.tx(async (c) => {
        await c.query(
          'UPDATE users SET password_hash=$2, must_change_password=false, password_changed_at=now(), updated_at=now() WHERE id=$1',
          [sess.user.id, await hashPassword(body.next)],
        );
        await svc.auth.destroyUserSessions(sess.user.id, sess.sid, c);
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'account.password_changed');
      return { stage: stageAfter(svc, { ...sess.user, mustChangePassword: false }, sess.mfaOk) };
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/totp/begin',
    summary: 'Début d’enrôlement TOTP (secret et URI otpauth)',
    tags: ['Compte'],
    access: 'session',
    body: PasswordBody,
    response: TotpBeginOut,
    handler: async ({ svc, s, body }) => {
      const sess = s as Session;
      const st = svc.auth.stage(sess);
      if (!['ok', 'enroll'].includes(st)) throw new HttpError(403, 'Authentification incomplète.');
      if (st === 'ok' && sess.user.totpEnabled) {
        const u = (await svc.db.one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=$1', [
          sess.user.id,
        ]))!;
        if (!(await verifyPassword(body.password || '', u.password_hash)))
          throw new HttpError(401, 'Mot de passe incorrect.');
      }
      const key = crypto.randomBytes(20);
      await svc.db.q('UPDATE users SET totp_pending=$2 WHERE id=$1', [
        sess.user.id,
        svc.vault.sealSmall(key, 'totp:' + sess.user.id),
      ]);
      const secret = base32(key);
      const label = encodeURIComponent(`${svc.cfg.appName}:${sess.user.username}`);
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(svc.cfg.orgName)}&algorithm=SHA1&digits=6&period=30`;
      return { secret, uri };
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/totp/confirm',
    summary: 'Confirmation de l’enrôlement TOTP (rotation de la session)',
    tags: ['Compte'],
    access: 'session',
    body: TotpConfirmBody,
    response: StageOut,
    handler: async ({ svc, req, reply, s, ip, body }) => {
      const sess = s as Session;
      if (!['ok', 'enroll'].includes(svc.auth.stage(sess))) throw new HttpError(403, 'Authentification incomplète.');
      const u = await svc.db.one<{ totp_pending: Buffer | null }>('SELECT totp_pending FROM users WHERE id=$1', [
        sess.user.id,
      ]);
      if (!u || !u.totp_pending) throw new HttpError(409, 'Aucun enrôlement en cours.');
      const key = svc.vault.openSmall(u.totp_pending, 'totp:' + sess.user.id);
      const step = verifyTotp(key, body.code, 0);
      if (!step) throw new HttpError(401, "Code incorrect. Vérifiez l'heure du téléphone et réessayez.");
      await svc.db.tx(async (c) => {
        await c.query(
          'UPDATE users SET totp_secret=totp_pending, totp_pending=NULL, totp_enabled=true, totp_last_step=$2, updated_at=now() WHERE id=$1',
          [sess.user.id, step],
        );
        await svc.auth.destroyUserSessions(sess.user.id, null, c);
      }, sess.user.username);
      await svc.auth.create(req, reply, sess.user.id, true);
      await svc.db.audit(sess.user, ip, 'account.mfa_enrolled');
      return { stage: stageAfter(svc, { ...sess.user, totpEnabled: true }, true) };
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/totp/disable',
    summary: 'Désactivation de la double authentification (si non obligatoire)',
    tags: ['Compte'],
    access: 'any',
    body: PasswordBody,
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      if (svc.cfg.mfaRequired) throw new HttpError(403, 'La double authentification est obligatoire sur ce serveur.');
      const u = (await svc.db.one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=$1', [
        sess.user.id,
      ]))!;
      if (!(await verifyPassword(body.password || '', u.password_hash)))
        throw new HttpError(401, 'Mot de passe incorrect.');
      await svc.db.q('UPDATE users SET totp_secret=NULL, totp_pending=NULL, totp_enabled=false WHERE id=$1', [
        sess.user.id,
      ]);
      await svc.db.audit(sess.user, ip, 'account.mfa_disabled');
      return undefined;
    },
  }),
  route({
    method: 'GET',
    url: '/api/account/sessions',
    summary: 'Mes sessions ouvertes',
    tags: ['Compte'],
    access: 'any',
    response: z.array(
      z.object({
        id: z.string(),
        ip: z.string().nullable(),
        user_agent: z.string(),
        created_at: z.string(),
        last_seen_at: z.string(),
        current: z.boolean(),
      }),
    ),
    handler: async ({ svc, s }) => {
      const sess = s as Session;
      const r = await svc.db.q<{ id: string }>(
        "SELECT encode(id_hash,'hex') AS id, ip::text, user_agent, created_at, last_seen_at FROM sessions WHERE user_id=$1 ORDER BY last_seen_at DESC",
        [sess.user.id],
      );
      return r.rows.map((x) => ({ ...x, current: x.id === sess.sid.toString('hex') }));
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/sessions/revoke-others',
    summary: 'Fermer mes autres sessions',
    tags: ['Compte'],
    access: 'any',
    handler: async ({ svc, s, ip }) => {
      const sess = s as Session;
      await svc.auth.destroyUserSessions(sess.user.id, sess.sid);
      await svc.db.audit(sess.user, ip, 'account.sessions_revoked');
      return undefined;
    },
  }),
];
