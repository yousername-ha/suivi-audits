/* Clés de sécurité FIDO2 / WebAuthn (ADR 0079) : second facteur à la connexion, codes de récupération, ré-authentification,
   enrôlement et gestion des clés (compte personnel), facteurs d'un compte et politique (administration).
   Toutes les routes passent par route() : contrôle d'origine, CSRF, session, permission et limite globale. */
import crypto from 'node:crypto';
import {
  AuthentificationBody,
  CodeRecuperationBody,
  CodesRecuperationOut,
  EnrolementBody,
  FacteursOut,
  MotifBody,
  REAUTH_MINUTES,
  ReauthBody,
  RenommerCleBody,
  StageOut,
  Uuid,
  WebauthnPolitique,
  WebauthnPolitiqueOut,
  effectivePermissions,
  Rights,
  type FacteursOut as FacteursOutT,
} from '@suivi/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { loadGrants } from '../rights.js';
import { sha256hex } from '../security/crypto.js';
import type { Services } from '../services.js';
import type { ContexteEvt, ResultatAuth } from '../webauthn.js';
import { ECHEC_CONNEXION, exigerMotDePasse } from './auth.js';

const IdParams = z.object({ id: Uuid });
const CleParams = z.object({ id: Uuid, cle: Uuid });
const Vide = z.object({}).strict();

const ctx = (req: FastifyRequest, ip: string): ContexteEvt => ({
  ip: ip || null,
  ua: String(req.headers['user-agent'] || ''),
});

function exigerDisponible(svc: Services) {
  if (!svc.webauthn.disponible)
    throw new HttpError(404, 'Les clés de sécurité ne sont pas proposées sur ce serveur.', { reason: 'indisponible' });
}
/** Étapes où la gestion des clés est ouverte : accès complet, ou enrôlement d'une clé imposé. */
function exigerEtape(svc: Services, s: Session, etapes: string[]) {
  const st = svc.auth.stage(s);
  if (!etapes.includes(st)) throw new HttpError(403, 'Authentification incomplète.', { stage: st });
}
/** Ré-authentification récente (mot de passe et second facteur depuis moins de REAUTH_MINUTES). */
function exigerReauth(s: Session) {
  if (!s.reauthAt || Date.now() - s.reauthAt.getTime() > REAUTH_MINUTES * 60e3)
    throw new HttpError(403, 'Confirmez votre identité (mot de passe et second facteur) pour continuer.', {
      reason: 'reauth',
    });
}
function limiter(ok: boolean) {
  if (!ok) throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
}

/** Message affiché pour un refus de clé : précis sur ce que la personne peut faire, sans détail technique. */
const MESSAGES_REFUS: Record<Exclude<ResultatAuth, { ok: true }>['motif'], string> = {
  challenge: 'La demande a expiré. Recommencez.',
  inconnue: 'Cette clé n’est pas enregistrée pour votre compte.',
  revoquee: 'Cette clé a été révoquée.',
  suspecte: 'Cette clé est suspendue par mesure de sécurité. Contactez un administrateur.',
  compteur: 'Cette clé est suspendue par mesure de sécurité. Contactez un administrateur.',
  verification: 'La vérification de la clé a échoué.',
};

/** Échec d'une clé : journal (audit et SIEM), compteur de verrouillage (sauf demande expirée) et alerte si clonage suspecté. */
async function refusCle(
  svc: Services,
  sess: Session,
  c: ContexteEvt,
  usage: 'connexion' | 'reauth',
  r: Exclude<ResultatAuth, { ok: true }>,
) {
  if (r.motif !== 'challenge') await svc.auth.enregistrerEchec(sess.user.id, 'second_facteur', c.ip);
  if (r.motif === 'compteur') {
    await svc.webauthn.evenement(sess.user, c, 'auth.webauthn_compteur', {
      resultat: 'alerte',
      credentialId: r.credentialId,
      aaguid: r.aaguid,
      detail: r.detail,
    });
    await svc.webauthn.alerter({ type: 'cle_suspecte', userId: sess.user.id, credentialId: r.credentialId });
  } else {
    await svc.webauthn.evenement(
      sess.user,
      c,
      usage === 'connexion' ? 'auth.webauthn_failed' : 'account.reauth_failed',
      {
        resultat: 'echec',
        facteur: 'webauthn',
        motif: r.motif,
        credentialId: r.credentialId,
        aaguid: r.aaguid,
        ...(r.detail ? { detail: r.detail } : {}),
      },
    );
  }
  throw new HttpError(401, MESSAGES_REFUS[r.motif], { reason: r.motif });
}

/** Facteurs d'un compte, pour la page « Sécurité du compte » et la fiche d'administration. */
async function facteurs(
  svc: Services,
  userId: string,
  o: { revoquees: boolean; reauthAt?: Date | null },
): Promise<FacteursOutT> {
  const u = await svc.db.k
    .selectFrom('users')
    .select(['totp_enabled', 'created_at', 'webauthn_reenrolement'])
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!u) throw new HttpError(404, 'Compte introuvable.');
  const rights = new Rights(effectivePermissions(await loadGrants(svc.db.pool, userId)).keys());
  const ex = svc.webauthn.exigence({
    admin: rights.has('administration:administrer'),
    creeLe: new Date(u.created_at),
    reenrolement: u.webauthn_reenrolement,
  });
  const echeanceGrace = (() => {
    const { politique, activeeLe } = svc.webauthn.politique();
    if (!svc.webauthn.disponible || !politique.obligatoireAdmins || !activeeLe) return null;
    if (!rights.has('administration:administrer')) return null;
    return ex.echeance;
  })();
  const reauth =
    o.reauthAt && Date.now() - o.reauthAt.getTime() <= REAUTH_MINUTES * 60e3
      ? new Date(o.reauthAt.getTime() + REAUTH_MINUTES * 60e3).toISOString()
      : null;
  return {
    disponible: svc.webauthn.disponible,
    totpEnabled: u.totp_enabled,
    cles: await svc.webauthn.cles(userId, { revoquees: o.revoquees }),
    codesRestants: await svc.webauthn.codesRestants(userId),
    obligatoire: ex.requise || !!echeanceGrace,
    echeance: echeanceGrace ? echeanceGrace.toISOString() : null,
    reenrolement: u.webauthn_reenrolement,
    reauthJusqua: reauth,
  };
}

/** Second facteur réussi : verrou effacé, session régénérée (prévention de la fixation), étape suivante. */
async function ouvrirSession(
  svc: Services,
  req: FastifyRequest,
  reply: FastifyReply,
  sess: Session,
  c: ContexteEvt,
  facteur: 'webauthn' | 'code_recuperation',
  details: Record<string, unknown>,
) {
  await svc.auth.effacerEchecs(sess.user.id);
  await svc.auth.destroy(sess.sid);
  await svc.auth.create(req, reply, sess.user.id, true);
  await svc.db.audit(sess.user, c.ip, 'auth.login', '', { facteur });
  await svc.webauthn.evenement(
    sess.user,
    c,
    facteur === 'webauthn' ? 'auth.webauthn_succes' : 'auth.code_recuperation_utilise',
    { resultat: 'succes', facteur, ...details },
  );
  if (facteur === 'code_recuperation') await alerteSecours(svc, sess, c, 'code_recuperation');
  return { stage: await svc.auth.etape(sess.user.id, true) };
}

/** Administrateur tenu d'utiliser une clé qui se connecte par un facteur de secours : trace et alerte (décision du RSSI). */
export async function alerteSecours(
  svc: Services,
  sess: Session,
  c: ContexteEvt,
  facteur: 'totp' | 'code_recuperation',
) {
  if (!sess.user.cleRequise || sess.user.cles === 0) return;
  await svc.webauthn.evenement(sess.user, c, 'auth.facteur_secours', { resultat: 'alerte', facteur });
  await svc.webauthn.alerter({ type: 'facteur_secours', userId: sess.user.id, facteur });
}

/** Empreintes des certificats (le journal d'audit ne recopie pas les certificats eux-mêmes). */
const resumePolitique = (p: WebauthnPolitique | undefined) =>
  p ? { ...p, racinesSupplementaires: p.racinesSupplementaires.map((r) => sha256hex(r).slice(0, 16)) } : null;

export const webauthnRoutes = [
  /* ---------------------------------------------------------------- Connexion (étape du second facteur) */
  route({
    method: 'POST',
    url: '/api/auth/webauthn/options',
    summary: 'Second facteur : options de connexion par clé de sécurité (challenge lié à la session)',
    tags: ['Authentification'],
    access: 'session',
    body: Vide,
    handler: async ({ svc, s }) => {
      const sess = s as Session;
      exigerDisponible(svc);
      exigerEtape(svc, sess, ['mfa']);
      limiter(svc.limits.webauthnBySession(sess.sid.toString('hex')) && svc.limits.webauthnByUser(sess.user.id));
      const options = await svc.webauthn.optionsAuthentification(sess.sid, sess.user.id, 'connexion');
      if (!options)
        throw new HttpError(409, 'Aucune clé de sécurité utilisable pour ce compte.', { reason: 'aucune_cle' });
      return options;
    },
  }),
  route({
    method: 'POST',
    url: '/api/auth/webauthn',
    summary: 'Second facteur : vérification de la clé de sécurité (rotation de la session)',
    tags: ['Authentification'],
    access: 'session',
    body: AuthentificationBody,
    response: StageOut,
    handler: async ({ svc, req, reply, s, ip, body }) => {
      const sess = s as Session;
      const c = ctx(req, ip);
      exigerDisponible(svc);
      exigerEtape(svc, sess, ['mfa']);
      limiter(svc.limits.mfaBySession(sess.sid.toString('hex')) && svc.limits.mfaByUser(sess.user.id));
      if (await svc.auth.estVerrouille(sess.user.id)) {
        await svc.auth.destroy(sess.sid);
        await svc.db.audit(sess.user, ip, 'auth.mfa_locked');
        throw new HttpError(401, ECHEC_CONNEXION);
      }
      const r = await svc.webauthn.verifierAuthentification(sess.sid, sess.user.id, 'connexion', body.response);
      if (!r.ok) return refusCle(svc, sess, c, 'connexion', r);
      return ouvrirSession(svc, req, reply, sess, c, 'webauthn', { credentialId: r.credentialId, aaguid: r.aaguid });
    },
  }),
  route({
    method: 'POST',
    url: '/api/auth/recovery',
    summary: 'Second facteur : code de récupération à usage unique (rotation de la session)',
    tags: ['Authentification'],
    access: 'session',
    body: CodeRecuperationBody,
    response: StageOut,
    handler: async ({ svc, req, reply, s, ip, body }) => {
      const sess = s as Session;
      const c = ctx(req, ip);
      exigerEtape(svc, sess, ['mfa']);
      limiter(svc.limits.mfaBySession(sess.sid.toString('hex')) && svc.limits.codeRecuperationByUser(sess.user.id));
      if (await svc.auth.estVerrouille(sess.user.id)) {
        await svc.auth.destroy(sess.sid);
        await svc.db.audit(sess.user, ip, 'auth.mfa_locked');
        throw new HttpError(401, ECHEC_CONNEXION);
      }
      if (!(await svc.webauthn.consommerCode(sess.user.id, body.code))) {
        await svc.auth.enregistrerEchec(sess.user.id, 'second_facteur', ip);
        await svc.webauthn.evenement(sess.user, c, 'auth.code_recuperation_refuse', {
          resultat: 'echec',
          facteur: 'code_recuperation',
        });
        throw new HttpError(401, 'Code de récupération incorrect ou déjà utilisé.');
      }
      return ouvrirSession(svc, req, reply, sess, c, 'code_recuperation', {
        restants: await svc.webauthn.codesRestants(sess.user.id),
      });
    },
  }),

  /* ---------------------------------------------------------------- Ré-authentification (step-up) */
  route({
    method: 'POST',
    url: '/api/account/reauth/options',
    summary: 'Ré-authentification : options de clé de sécurité (null sans clé : code TOTP attendu)',
    tags: ['Compte'],
    access: 'session',
    body: Vide,
    handler: async ({ svc, s }) => {
      const sess = s as Session;
      exigerEtape(svc, sess, ['ok', 'enroll_key']);
      if (!svc.webauthn.disponible) return { options: null };
      limiter(svc.limits.webauthnBySession(sess.sid.toString('hex')) && svc.limits.webauthnByUser(sess.user.id));
      return { options: await svc.webauthn.optionsAuthentification(sess.sid, sess.user.id, 'reauth') };
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/reauth',
    summary: 'Ré-authentification : mot de passe, puis code TOTP ou clé de sécurité (valable 5 minutes)',
    tags: ['Compte'],
    access: 'session',
    body: ReauthBody,
    response: z.object({ reauthJusqua: z.string() }),
    handler: async ({ svc, req, s, ip, body }) => {
      const sess = s as Session;
      const c = ctx(req, ip);
      exigerEtape(svc, sess, ['ok', 'enroll_key']);
      await exigerMotDePasse(svc, sess.user, ip, body.password);
      limiter(svc.limits.mfaByUser(sess.user.id));
      let facteur: 'totp' | 'webauthn' | 'mot_de_passe';
      if (!sess.user.totpEnabled && sess.user.cles === 0) {
        // Aucun second facteur encore (double authentification facultative sur ce serveur) : le mot de passe suffit.
        facteur = 'mot_de_passe';
      } else if (!body.code && !body.response) {
        throw new HttpError(400, 'Code de double authentification ou clé de sécurité attendu.');
      } else if (body.code) {
        facteur = 'totp';
        if (!(await svc.auth.checkTotp(sess.user.id, body.code))) {
          await svc.auth.enregistrerEchec(sess.user.id, 'second_facteur', ip);
          await svc.webauthn.evenement(sess.user, c, 'account.reauth_failed', { resultat: 'echec', facteur });
          throw new HttpError(401, 'Code incorrect ou déjà utilisé.');
        }
      } else {
        facteur = 'webauthn';
        exigerDisponible(svc);
        const r = await svc.webauthn.verifierAuthentification(sess.sid, sess.user.id, 'reauth', body.response!);
        if (!r.ok) return refusCle(svc, sess, c, 'reauth', r);
      }
      const jusqua = await svc.webauthn.marquerReauth(sess.sid);
      await svc.webauthn.evenement(sess.user, c, 'account.reauth', { resultat: 'succes', facteur });
      return { reauthJusqua: jusqua.toISOString() };
    },
  }),

  /* ---------------------------------------------------------------- Mes clés */
  route({
    method: 'GET',
    url: '/api/account/factors',
    summary: 'Mes facteurs d’authentification (TOTP, clés de sécurité, codes de récupération)',
    tags: ['Compte'],
    access: 'session',
    response: FacteursOut,
    handler: async ({ svc, s }) => {
      const sess = s as Session;
      exigerEtape(svc, sess, ['ok', 'enroll_key']);
      return facteurs(svc, sess.user.id, { revoquees: false, reauthAt: sess.reauthAt });
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/webauthn/options',
    summary: 'Enrôlement d’une clé de sécurité : options (ré-authentification récente exigée)',
    tags: ['Compte'],
    access: 'session',
    body: Vide,
    handler: async ({ svc, s }) => {
      const sess = s as Session;
      exigerDisponible(svc);
      exigerEtape(svc, sess, ['ok', 'enroll_key']);
      exigerReauth(sess);
      limiter(svc.limits.webauthnGestionByUser(sess.user.id));
      const options = await svc.webauthn.optionsEnrolement(sess.sid, sess.user);
      if (!options) throw new HttpError(409, 'Nombre maximal de clés atteint : révoquez-en une d’abord.');
      return options;
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/webauthn',
    summary: 'Enrôlement d’une clé de sécurité : vérification et enregistrement',
    tags: ['Compte'],
    access: 'session',
    body: EnrolementBody,
    status: 201,
    handler: async ({ svc, req, reply, s, ip, body }) => {
      const sess = s as Session;
      const c = ctx(req, ip);
      exigerDisponible(svc);
      exigerEtape(svc, sess, ['ok', 'enroll_key']);
      exigerReauth(sess);
      limiter(svc.limits.webauthnGestionByUser(sess.user.id));
      const r = await svc.webauthn.verifierEnrolement(sess.sid, sess.user.id, body.response, body.label);
      if (!r.ok) {
        await svc.webauthn.evenement(sess.user, c, 'account.webauthn_enrolement_refuse', {
          resultat: 'refus',
          motif: r.motif,
          credentialId: body.response.id,
          ...(r.detail ? { detail: r.detail } : {}),
        });
        const [status, message] = {
          challenge: [400, 'La demande a expiré. Recommencez.'],
          verification: [400, 'La réponse de la clé n’a pas pu être vérifiée.'],
          materiel: [
            422,
            'Clé refusée : seules les clés matérielles autorisées par la politique de sécurité sont acceptées.',
          ],
          doublon: [409, 'Cette clé est déjà enregistrée.'],
          trop: [409, 'Nombre maximal de clés atteint : révoquez-en une d’abord.'],
        }[r.motif] as [number, string];
        throw new HttpError(status, message, { reason: r.motif });
      }
      await svc.webauthn.evenement(sess.user, c, 'account.webauthn_enrolled', {
        resultat: 'succes',
        credentialId: body.response.id,
        aaguid: r.cle.aaguid,
        deviceType: r.cle.deviceType,
        backedUp: r.cle.backedUp,
      });
      // Première clé d'une session ouverte sans second facteur : la clé vient d'être présentée (avec vérification de
      // l'utilisateur) ; la session est régénérée à l'état « second facteur validé » (prévention de la fixation).
      if (!sess.mfaOk) {
        await svc.auth.destroy(sess.sid);
        await svc.auth.create(req, reply, sess.user.id, true);
      }
      return { cle: r.cle, stage: await svc.auth.etape(sess.user.id, true) };
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/account/webauthn/:id',
    summary: 'Renommer une de mes clés de sécurité',
    tags: ['Compte'],
    access: 'auth',
    params: IdParams,
    body: RenommerCleBody,
    handler: async ({ svc, req, s, ip, params, body }) => {
      const sess = s as Session;
      limiter(svc.limits.webauthnGestionByUser(sess.user.id));
      if (!(await svc.webauthn.renommer(sess.user.id, params.id, body.label)))
        throw new HttpError(404, 'Clé introuvable.');
      await svc.webauthn.evenement(sess.user, ctx(req, ip), 'account.webauthn_renamed', {
        resultat: 'succes',
        cible: params.id,
      });
      return undefined;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/account/webauthn/:id',
    summary: 'Révoquer une de mes clés de sécurité (ré-authentification récente ; jamais le dernier facteur fort)',
    tags: ['Compte'],
    access: 'auth',
    params: IdParams,
    handler: async ({ svc, req, s, ip, params }) => {
      const sess = s as Session;
      exigerReauth(sess);
      limiter(svc.limits.webauthnGestionByUser(sess.user.id));
      const r = await svc.db.tx(async (_c, k) => {
        // Ligne du compte verrouillée : deux révocations simultanées ne peuvent pas retirer ensemble les deux dernières clés.
        const u = await k
          .selectFrom('users')
          .select('totp_enabled')
          .where('id', '=', sess.user.id)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const autres = await k
          .selectFrom('webauthn_credentials')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('user_id', '=', sess.user.id)
          .where('revoked_at', 'is', null)
          .where('suspect_at', 'is', null)
          .where('id', '<>', params.id)
          .executeTakeFirstOrThrow();
        if (autres.n === 0 && !u.totp_enabled)
          throw new HttpError(409, 'Impossible de révoquer votre dernier facteur d’authentification forte.', {
            reason: 'dernier_facteur',
          });
        if (autres.n === 0 && sess.user.cleRequise)
          throw new HttpError(
            409,
            'Une clé de sécurité est obligatoire pour votre compte : enrôlez-en une autre d’abord.',
            {
              reason: 'cle_obligatoire',
            },
          );
        return svc.webauthn.revoquer(k, sess.user.id, params.id, sess.user.username);
      }, sess.user.username);
      if (!r) throw new HttpError(404, 'Clé introuvable.');
      await svc.webauthn.evenement(sess.user, ctx(req, ip), 'account.webauthn_revoked', {
        resultat: 'succes',
        credentialId: r.credential_id,
        aaguid: r.aaguid,
      });
      return undefined;
    },
  }),
  route({
    method: 'POST',
    url: '/api/account/recovery-codes',
    summary: 'Nouveaux codes de récupération (les précédents sont annulés ; affichés une seule fois)',
    tags: ['Compte'],
    access: 'auth',
    body: Vide,
    response: CodesRecuperationOut,
    handler: async ({ svc, req, s, ip }) => {
      const sess = s as Session;
      exigerReauth(sess);
      limiter(svc.limits.webauthnGestionByUser(sess.user.id));
      const codes = await svc.webauthn.genererCodes(sess.user.id);
      await svc.webauthn.evenement(sess.user, ctx(req, ip), 'account.codes_recuperation_generes', {
        resultat: 'succes',
        nombre: codes.length,
      });
      return { codes };
    },
  }),

  /* ---------------------------------------------------------------- Administration : facteurs d'un compte */
  route({
    method: 'GET',
    url: '/api/admin/users/:id/factors',
    summary: 'Facteurs d’authentification d’un compte (clés révoquées comprises)',
    tags: ['Droits'],
    access: 'administration:lire',
    params: IdParams,
    response: FacteursOut,
    handler: async ({ svc, params }) => facteurs(svc, params.id, { revoquees: true }),
  }),
  route({
    method: 'POST',
    url: '/api/admin/users/:id/webauthn/:cle/revoke',
    summary: 'Révoquer une clé de sécurité d’un compte (motif consigné)',
    tags: ['Droits'],
    access: 'administration:administrer',
    params: CleParams,
    body: MotifBody,
    handler: async ({ svc, req, s, ip, params, body }) => {
      const sess = s as Session;
      const r = await svc.db.tx(async (c, k) => {
        const x = await svc.webauthn.revoquer(k, params.id, params.cle, sess.user.username);
        if (x) await svc.auth.destroyUserSessions(params.id, params.id === sess.user.id ? sess.sid : null, c);
        return x;
      }, sess.user.username);
      if (!r) throw new HttpError(404, 'Clé introuvable ou déjà révoquée.');
      await svc.webauthn.evenement(sess.user, ctx(req, ip), 'admin.user_webauthn_revoked', {
        resultat: 'succes',
        cible: params.id,
        credentialId: r.credential_id,
        aaguid: r.aaguid,
        motif: body.motif,
      });
      return undefined;
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/users/:id/webauthn/:cle/reactivate',
    summary: 'Réactiver une clé suspendue après vérification auprès de son porteur (motif consigné)',
    tags: ['Droits'],
    access: 'administration:administrer',
    params: CleParams,
    body: MotifBody,
    handler: async ({ svc, req, s, ip, params, body }) => {
      const sess = s as Session;
      const r = await svc.webauthn.reactiver(params.id, params.cle);
      if (!r) throw new HttpError(404, 'Aucune clé suspendue à réactiver.');
      await svc.webauthn.evenement(sess.user, ctx(req, ip), 'admin.user_webauthn_reactivated', {
        resultat: 'succes',
        cible: params.id,
        credentialId: r.credential_id,
        aaguid: r.aaguid,
        motif: body.motif,
      });
      return undefined;
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/users/:id/webauthn/reset',
    summary:
      'Réinitialiser les clés d’un compte : toutes révoquées, codes effacés, ré-enrôlement imposé (motif consigné)',
    tags: ['Droits'],
    access: 'administration:administrer',
    params: IdParams,
    body: MotifBody,
    handler: async ({ svc, req, s, ip, params, body }) => {
      const sess = s as Session;
      const n = await svc.db.tx(async (c, k) => {
        const existe = await k
          .selectFrom('users')
          .select('id')
          .where('id', '=', params.id)
          .forUpdate()
          .executeTakeFirst();
        if (!existe) throw new HttpError(404, 'Compte introuvable.');
        const revoquees = await svc.webauthn.reinitialiser(k, params.id, sess.user.username);
        await svc.auth.destroyUserSessions(params.id, null, c);
        return revoquees;
      }, sess.user.username);
      await svc.webauthn.evenement(sess.user, ctx(req, ip), 'admin.user_webauthn_reset', {
        resultat: 'succes',
        cible: params.id,
        clesRevoquees: n,
        motif: body.motif,
      });
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Administration : politique */
  route({
    method: 'GET',
    url: '/api/admin/webauthn/policy',
    summary: 'Politique des clés de sécurité et configuration de la relying party',
    tags: ['Administration'],
    access: 'administration:lire',
    response: WebauthnPolitiqueOut,
    handler: async ({ svc, reply }) => {
      const p = svc.webauthn.politique();
      setEtag(reply, p.version);
      const w = svc.cfg.webauthn;
      return {
        politique: p.politique,
        version: p.version,
        activeeLe: p.activeeLe,
        serveur: {
          disponible: w.disponible,
          raison: w.raison,
          rpId: w.rpId,
          rpName: w.rpName,
          origines: w.origines,
          source: w.source,
        },
      };
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/webauthn/policy',
    summary: 'Modifier la politique des clés de sécurité (If-Match)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: WebauthnPolitique,
    handler: async ({ svc, req, reply, s, ip, body }) => {
      const sess = s as Session;
      const attendue = requireIfMatch(req);
      if (!svc.webauthn.disponible && (body.obligatoireAdmins || body.materielUniquement))
        throw new HttpError(409, 'Les clés de sécurité ne sont pas proposées sur ce serveur (configuration RP).', {
          reason: 'indisponible',
        });
      for (const pem of body.racinesSupplementaires) {
        let cert: crypto.X509Certificate;
        try {
          cert = new crypto.X509Certificate(pem);
        } catch {
          throw new HttpError(422, 'Certificat racine illisible.');
        }
        if (!cert.ca) throw new HttpError(422, `Le certificat « ${cert.subject} » n’est pas une autorité.`);
        if (new Date(cert.validTo) < new Date())
          throw new HttpError(422, `Le certificat « ${cert.subject} » a expiré.`);
      }
      const r = await svc.db.tx((_c, k) => svc.webauthn.ecrirePolitique(k, body, attendue), sess.user.username);
      if (r.conflit) throw conflict({ version: r.avant.version ?? 0 });
      await svc.webauthn.charger();
      setEtag(reply, r.apres.version);
      await svc.webauthn.evenement(sess.user, ctx(req, ip), 'securite.webauthn_politique', {
        resultat: 'succes',
        avant: resumePolitique(r.avant.politique),
        apres: resumePolitique(r.apres.politique),
        activeeLe: r.apres.activeeLe,
      });
      return undefined;
    },
  }),
];
