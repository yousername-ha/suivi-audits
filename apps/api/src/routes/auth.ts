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
  empreinteCleSecours,
  problemesMotDePasse,
  type MeOut as MeOutT,
} from '@suivi/shared';
import { chargerDemoDemandee, demanderDemo } from '../demo-installation.js';
import { sql } from 'kysely';
import { z } from 'zod';
import { accessStage, type Session } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { permanentAdminCount } from '../rights.js';
import { base32, chiffrerEmpreinte, hashPassword, verifyTotp } from '../security/crypto.js';
import type { PoivrePrepare } from '../mots-de-passe.js';
import { exigerPoivreValide } from './poivre.js';
import type { Services } from '../services.js';

function checkPassword(svc: Services, pw: unknown, username: string) {
  const general = svc.settings.get('general');
  const p = problemesMotDePasse(pw, {
    minLen: svc.settings.get('securite').passwordMinLength,
    identifiants: [username],
    noms: [general.appName, general.orgName],
  });
  if (p.length) throw new HttpError(422, 'Mot de passe trop faible : ' + p.join(', ') + '.');
}

function meOut(svc: Services, s: Session | null): MeOutT {
  return {
    stage: svc.auth.stage(s),
    csrf: s ? s.csrf : null,
    user: s
      ? {
          id: s.user.id,
          username: s.user.username,
          displayName: s.user.displayName,
          totpEnabled: s.user.totpEnabled,
          mustChangePassword: s.user.mustChangePassword,
          roles: s.user.roles,
          expiresAt: s.user.expiresAt,
        }
      : null,
    preferences: s && svc.auth.stage(s) === 'ok' ? s.user.preferences : null,
    permissions: s && svc.auth.stage(s) === 'ok' ? s.user.rights.list() : [],
    mfaRequired: svc.cfg.mfaRequired,
    passwordMinLength: svc.settings.get('securite').passwordMinLength,
    appName: svc.settings.get('general').appName,
    orgName: svc.settings.get('general').orgName,
    orgSite: svc.settings.get('general').site,
    appearance: svc.settings.get('apparence'),
    version: svc.cfg.version,
  };
}

const SETUP_HTTP = { invalid: 401, expired: 410, used: 409, none: 410 } as const;
const stageAfter = (svc: Services, user: { totpEnabled: boolean; mustChangePassword: boolean }, mfaOk: boolean) =>
  accessStage({ mfaOk, user }, svc.cfg.mfaRequired);

/** Réponse unique à tout échec de connexion (inconnu, mot de passe faux, verrouillé, désactivé, expiré) : le motif exact reste
    au journal d'audit (ADR 0070). */
export const ECHEC_CONNEXION =
  'Identifiant ou mot de passe incorrect, ou compte temporairement verrouillé après plusieurs échecs.';

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
      const r = await svc.auth.checkLogin(username, body.password, ip);
      if (!r.ok) {
        await svc.db.audit(
          r.user ? { id: r.user.id, username: r.user.username } : { username },
          ip,
          'auth.login_failed',
          '',
          { reason: r.reason },
        );
        throw new HttpError(401, ECHEC_CONNEXION);
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
      if (!svc.limits.mfaBySession(sess.sid.toString('hex')) || !svc.limits.mfaByUser(sess.user.id))
        throw new HttpError(429, 'Trop de tentatives. Reconnectez-vous.');
      if (await svc.auth.estVerrouille(sess.user.id)) {
        await svc.auth.destroy(sess.sid);
        await svc.db.audit(sess.user, ip, 'auth.mfa_locked');
        throw new HttpError(401, ECHEC_CONNEXION);
      }
      if (!(await svc.auth.checkTotp(sess.user.id, body.code))) {
        await svc.auth.enregistrerEchec(sess.user.id, 'second_facteur', ip);
        await svc.db.audit(sess.user, ip, 'auth.mfa_failed');
        throw new HttpError(401, 'Code incorrect ou déjà utilisé.');
      }
      await svc.auth.effacerEchecs(sess.user.id);
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
      return {
        needed: pending || !adminExists,
        pending,
        adminExists,
        poivreDefini: await svc.motsDePasse.defini(),
        cleSecoursDefinie: await svc.cleSecours.definie(),
        adresseSite: svc.adresseSite.actuelle(),
      };
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
      // Poivre des mots de passe (ADR 0072) : défini ici, dans la transaction qui consomme le jeton, ou déjà défini (administrateur
      // de secours). Les règles et l'engagement de sauvegarde sont contrôlés avant toute consommation du jeton.
      let poivre: PoivrePrepare | null = null;
      if (!(await svc.motsDePasse.defini())) {
        if (!body.poivre)
          throw new HttpError(422, 'Le poivre des mots de passe est obligatoire à l’installation.', {
            reason: 'poivre_requis',
          });
        await exigerPoivreValide(svc, body.poivre, { identifiants: [body.username] });
        poivre = await svc.motsDePasse.preparer(body.poivre.valeur);
      }
      // Clé de secours des sauvegardes (ADR 0077) : sa clé publique seule, enregistrée avec le compte ; l'engagement de l'avoir
      // rangée au coffre-fort est vérifié dans le navigateur, seul détenteur de la clé privée.
      const cleSecoursDefinie = await svc.cleSecours.definie();
      const cleSecours = cleSecoursDefinie ? null : (body.cleSecours ?? null);
      if (!cleSecoursDefinie && !cleSecours)
        throw new HttpError(422, 'La clé de secours des sauvegardes est obligatoire à l’installation.', {
          reason: 'cle_secours_requise',
        });
      const id = svc.motsDePasse.nouvelId();
      const hash = poivre
        ? chiffrerEmpreinte(poivre.cle, id, await hashPassword(body.password))
        : await svc.motsDePasse.hacher(id, body.password);
      const res = await svc.db
        .tx(async (c, kdb) => {
          const k = await svc.auth.consumeSetupToken(body.token, c);
          if (k.status !== 'ok') return { status: k.status };
          if (k.reason !== 'recovery' && (await permanentAdminCount(c)) > 0) {
            throw new HttpError(409, 'Un administrateur existe déjà.');
          }
          if (!poivre && body.poivre)
            throw new HttpError(409, 'Le poivre est déjà défini.', { reason: 'poivre_defini' });
          if (poivre) await svc.motsDePasse.inscrireALInstallation(c, kdb, poivre, body.username);
          if (cleSecours) await svc.cleSecours.inscrire(kdb, cleSecours.publique, body.username);
          if (body.adresseSite && body.adresseSite !== svc.adresseSite.actuelle())
            await svc.adresseSite.demander(kdb, body.adresseSite, body.username);
          const u = await kdb
            .insertInto('users')
            .values({
              id,
              username: body.username,
              display_name: body.displayName || body.username,
              email: body.email || '',
              password_hash: hash,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await kdb.insertInto('user_roles').values({ user_id: u.id, role_id: 'administrateur' }).execute();
          const org = body.orgName?.trim();
          if (org) {
            const cur = await svc.settings.read('general', c);
            await svc.settings.write(c, 'general', { ...cur.values, orgName: org }, cur.version, {
              id: u.id,
              username: body.username,
            });
          }
          return { status: 'ok' as const, id: u.id };
        }, body.username)
        .catch((e: { code?: string }) => {
          if (e.code === '23505') throw new HttpError(409, 'Cet identifiant existe déjà.');
          throw e;
        });
      if (res.status !== 'ok') {
        await svc.db.audit({ username: body.username }, ip, 'setup.failed', '', { reason: res.status });
        throw new HttpError(SETUP_HTTP[res.status], SETUP_TOKEN_MESSAGES[res.status], { reason: res.status });
      }
      await svc.settings.load();
      await svc.db.audit({ id: res.id, username: body.username }, ip, 'setup.admin_created');
      if (poivre)
        await svc.db.audit({ id: res.id, username: body.username }, ip, 'securite.poivre_defini', '', {
          idCle: poivre.idCle,
          installation: true,
        });
      if (cleSecours)
        await svc.db.audit({ id: res.id, username: body.username }, ip, 'sauvegarde.cle_secours_definie', '', {
          empreinte: empreinteCleSecours(cleSecours.publique),
          installation: true,
        });
      await svc.auth.create(req, reply, res.id, false);
      if (body.demo) await demanderDemo(svc, { id: res.id, username: body.username });
      return {
        stage: stageAfter(svc, { totpEnabled: false, mustChangePassword: false }, false),
        ...(body.demo ? { demo: 'en_attente' as const } : {}),
      };
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
      const u = await svc.db.k
        .selectFrom('users')
        .select(['username', 'password_hash'])
        .where('id', '=', sess.user.id)
        .executeTakeFirstOrThrow();
      limiterMotDePasse(svc, sess.user.id);
      if (!(await svc.motsDePasse.verifier(sess.user.id, body.current, u.password_hash))) {
        await svc.auth.enregistrerEchec(sess.user.id, 'mot_de_passe', ip);
        await svc.db.audit(sess.user, ip, 'account.password_failed');
        throw new HttpError(401, 'Mot de passe actuel incorrect.');
      }
      checkPassword(svc, body.next, u.username);
      if (await svc.motsDePasse.verifier(sess.user.id, body.next, u.password_hash))
        throw new HttpError(422, "Le nouveau mot de passe doit être différent de l'actuel.");
      const nouveau = await svc.motsDePasse.hacher(sess.user.id, body.next);
      await svc.db.tx(async (c, k) => {
        await k
          .updateTable('users')
          .set({
            password_hash: nouveau,
            must_change_password: false,
            password_changed_at: sql<Date>`now()`,
            updated_at: sql<Date>`now()`,
          })
          .where('id', '=', sess.user.id)
          .execute();
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
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const st = svc.auth.stage(sess);
      if (!['ok', 'enroll'].includes(st)) throw new HttpError(403, 'Authentification incomplète.');
      if (st === 'ok' && sess.user.totpEnabled) await exigerMotDePasse(svc, sess.user, ip, body.password);
      const key = crypto.randomBytes(20);
      await svc.db.k
        .updateTable('users')
        .set({ totp_pending: svc.vault.sealSmall(key, 'totp:' + sess.user.id) })
        .where('id', '=', sess.user.id)
        .execute();
      const secret = base32(key);
      const label = encodeURIComponent(`${svc.settings.get('general').appName}:${sess.user.username}`);
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(svc.settings.get('general').orgName)}&algorithm=SHA1&digits=6&period=30`;
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
      const u = await svc.db.k
        .selectFrom('users')
        .select('totp_pending')
        .where('id', '=', sess.user.id)
        .executeTakeFirst();
      if (!u || !u.totp_pending) throw new HttpError(409, 'Aucun enrôlement en cours.');
      const key = svc.vault.openSmall(u.totp_pending, 'totp:' + sess.user.id);
      const step = verifyTotp(key, body.code, 0);
      if (!step) throw new HttpError(401, "Code incorrect. Vérifiez l'heure du téléphone et réessayez.");
      await svc.db.tx(async (c, k) => {
        await k
          .updateTable('users')
          .set((eb) => ({
            totp_secret: eb.ref('totp_pending'),
            totp_pending: null,
            totp_enabled: true,
            totp_last_step: step,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', sess.user.id)
          .execute();
        await svc.auth.destroyUserSessions(sess.user.id, null, c);
      }, sess.user.username);
      await svc.auth.create(req, reply, sess.user.id, true);
      await svc.db.audit(sess.user, ip, 'account.mfa_enrolled');
      const demo = await chargerDemoDemandee(svc, req.server, sess.user, ip);
      return { stage: stageAfter(svc, { ...sess.user, totpEnabled: true }, true), ...(demo ? { demo } : {}) };
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/totp/disable',
    summary: 'Désactivation de la double authentification (si non obligatoire)',
    tags: ['Compte'],
    access: 'auth',
    body: PasswordBody,
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      if (svc.cfg.mfaRequired) throw new HttpError(403, 'La double authentification est obligatoire sur ce serveur.');
      await exigerMotDePasse(svc, sess.user, ip, body.password);
      await svc.db.k
        .updateTable('users')
        .set({ totp_secret: null, totp_pending: null, totp_enabled: false })
        .where('id', '=', sess.user.id)
        .execute();
      await svc.db.audit(sess.user, ip, 'account.mfa_disabled');
      return undefined;
    },
  }),
  route({
    method: 'GET',
    url: '/api/account/sessions',
    summary: 'Mes sessions ouvertes',
    tags: ['Compte'],
    access: 'auth',
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
      const r = await svc.db.k
        .selectFrom('sessions')
        .select([
          sql<string>`encode(id_hash, 'hex')`.as('id'),
          sql<string | null>`ip::text`.as('ip'),
          'user_agent',
          'created_at',
          'last_seen_at',
        ])
        .where('user_id', '=', sess.user.id)
        .orderBy('last_seen_at', 'desc')
        .execute();
      // Dates renvoyées telles quelles (sérialisées en ISO par la réponse), comme avant la conversion.
      return r.map((x) => ({ ...x, current: x.id === sess.sid.toString('hex') })) as unknown as {
        id: string;
        ip: string | null;
        user_agent: string;
        created_at: string;
        last_seen_at: string;
        current: boolean;
      }[];
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/sessions/revoke-others',
    summary: 'Fermer mes autres sessions',
    tags: ['Compte'],
    access: 'auth',
    handler: async ({ svc, s, ip }) => {
      const sess = s as Session;
      await svc.auth.destroyUserSessions(sess.user.id, sess.sid);
      await svc.db.audit(sess.user, ip, 'account.sessions_revoked');
      return undefined;
    },
  }),
];

/** Empreinte du mot de passe d'un compte (le compte de la session existe toujours). */
async function motDePasse(svc: Services, userId: string) {
  return svc.db.k.selectFrom('users').select('password_hash').where('id', '=', userId).executeTakeFirstOrThrow();
}
/** Vérifications du mot de passe actuel : cinq par quart d'heure et par compte. */
function limiterMotDePasse(svc: Services, userId: string) {
  if (!svc.limits.motDePasseByUser(userId))
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
}
/** Exige le mot de passe actuel : limité par compte ; chaque échec est compté dans le verrouillage et journalisé. */
async function exigerMotDePasse(svc: Services, user: Session['user'], ip: string | null, password: string | undefined) {
  limiterMotDePasse(svc, user.id);
  const u = await motDePasse(svc, user.id);
  if (!(await svc.motsDePasse.verifier(user.id, password || '', u.password_hash))) {
    await svc.auth.enregistrerEchec(user.id, 'mot_de_passe', ip);
    await svc.db.audit(user, ip, 'account.password_failed');
    throw new HttpError(401, 'Mot de passe incorrect.');
  }
}
