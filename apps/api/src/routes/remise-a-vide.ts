import {
  REMISE_A_VIDE_PHRASES,
  RemiseAVideAutorisation,
  RemiseAVideEtat,
  RemiseAVideRequest,
  RemiseAVideResultat,
} from '@suivi/shared';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import type { SessionUser } from '../auth.js';
import type { Services } from '../services.js';
import { prepareDatabase } from '../startup.js';

/** Contrôles communs : même limiteur et même anti-rejeu que l'installation d'une mise à jour. */
export async function exigerCode(svc: Services, user: SessionUser, ip: string, code: string, action: string) {
  if (!svc.limits.updateMfaByUser(user.id))
    throw new HttpError(429, 'Trop de codes refusés. Réessayez dans quinze minutes.');
  if (!(await svc.auth.checkTotp(user.id, code))) {
    await svc.db.audit(user, ip, `${action}.mfa_failed`);
    throw new HttpError(401, 'Code de double authentification incorrect ou déjà utilisé.', { reason: 'mfa_failed' });
  }
}

export const remiseAVideRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/remise-a-vide',
    summary: 'État de la remise à vide : interrupteur, dernière sauvegarde, exploitation',
    tags: ['Administration'],
    access: 'administration:administrer',
    response: RemiseAVideEtat,
    handler: async ({ svc }) => svc.remiseAVide.etat(),
  }),
  route({
    method: 'PUT',
    url: '/api/admin/remise-a-vide/autorisation',
    summary: 'Autoriser ou interdire la remise à vide (désactivée par défaut ; code requis pour autoriser)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: RemiseAVideAutorisation,
    response: RemiseAVideEtat,
    handler: async ({ svc, s, ip, body }) => {
      const user = s!.user;
      if (body.autorisee) await exigerCode(svc, user, ip, body.code!, 'remise_a_vide.autorisation');
      await svc.remiseAVide.definirAutorisation(body.autorisee, user, ip);
      return svc.remiseAVide.etat();
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/remise-a-vide',
    summary: 'Remettre la base à vide (données de travail, ou tout) après phrase, code et sauvegarde récente',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: RemiseAVideRequest,
    response: RemiseAVideResultat,
    handler: async ({ svc, s, ip, body }) => {
      const user = s!.user;
      // L'interrupteur est contrôlé avant le code : un refus de principe ne consomme pas le code saisi.
      if (!(await svc.remiseAVide.autorisee()))
        throw new HttpError(403, 'La remise à vide n’est pas autorisée sur ce serveur.', { reason: 'interdite' });
      if (body.confirm !== REMISE_A_VIDE_PHRASES[body.portee])
        throw new HttpError(422, `Recopiez exactement : ${REMISE_A_VIDE_PHRASES[body.portee]}`, {
          reason: 'phrase',
        });
      await exigerCode(svc, user, ip, body.code, 'remise_a_vide');
      const { tables } = await svc.remiseAVide.executer(body.portee, user, ip);
      // Amorçage identique à un démarrage : état initial vide, configuration par défaut, jeton si plus aucun compte.
      await prepareDatabase(svc, { issueToken: body.portee === 'tout' });
      return {
        portee: body.portee,
        tables,
        jeton: body.portee === 'tout',
        message:
          body.portee === 'tout'
            ? 'Base remise à zéro, comptes compris. Relevez le jeton d’installation dans les journaux du service (docker compose logs app | grep -A3 JETON), puis rechargez la page.'
            : 'Données de travail effacées. Comptes, rôles et réglages conservés.',
      };
    },
  }),
];
