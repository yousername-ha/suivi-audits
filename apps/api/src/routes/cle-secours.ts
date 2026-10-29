/* Clé de secours des sauvegardes (ADR 0077) : état, et remplacement depuis l'administration. Droit « administrer » + code de
   double authentification saisi à ce moment, au plus 5 tentatives par heure et par compte. Seule la clé publique circule. */
import { CleSecoursDefinirBody, CleSecoursEtat, empreinteCleSecours } from '@suivi/shared';
import { route } from '../http/route.js';
import { HttpError } from '../http/errors.js';
import { exigerCode } from './remise-a-vide.js';

export const cleSecoursRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/cle-secours-sauvegardes',
    summary: 'Clé de secours des sauvegardes : clé publique enregistrée et clés lues par l’exécutant',
    tags: ['Administration'],
    access: 'administration:lire',
    response: CleSecoursEtat,
    handler: async ({ svc }) => svc.cleSecours.etat(),
  }),
  route({
    method: 'POST',
    url: '/api/admin/cle-secours-sauvegardes',
    summary:
      'Définir ou remplacer la clé de secours (clé publique générée par le navigateur, code de double authentification)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: CleSecoursDefinirBody,
    response: CleSecoursEtat,
    handler: async ({ svc, s, ip, body }) => {
      const user = s!.user;
      if (!svc.limits.cleSecoursByUser(user.id))
        throw new HttpError(429, 'Trop de tentatives. Réessayez dans une heure.');
      const avant = await svc.cleSecours.etat();
      await exigerCode(svc, user, ip, body.code, 'sauvegarde.cle_secours');
      await svc.cleSecours.inscrire(svc.db.k, body.cleSecours.publique, user.username);
      await svc.db.audit(user, ip, 'sauvegarde.cle_secours_definie', '', {
        empreinte: empreinteCleSecours(body.cleSecours.publique),
        remplace: avant.publique ? empreinteCleSecours(avant.publique) : null,
      });
      return svc.cleSecours.etat();
    },
  }),
];
