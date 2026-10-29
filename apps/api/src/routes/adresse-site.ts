/* Adresse du site (ADR 0077) : état, et changement depuis l'administration (droit « administrer », code de double
   authentification). L'exécutant du serveur applique l'adresse demandée sous une minute. */
import { AdresseSiteBody, AdresseSiteEtat } from '@suivi/shared';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { exigerCode } from './remise-a-vide.js';

export const adresseSiteRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/adresse-site',
    summary: 'Adresse du site en service et adresse demandée (appliquée par l’exécutant du serveur)',
    tags: ['Administration'],
    access: 'administration:lire',
    response: AdresseSiteEtat,
    handler: async ({ svc }) => svc.adresseSite.etat(),
  }),
  route({
    method: 'POST',
    url: '/api/admin/adresse-site',
    summary: 'Changer l’adresse du site (code de double authentification) : le frontal et l’application redémarrent',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: AdresseSiteBody,
    response: AdresseSiteEtat,
    handler: async ({ svc, s, ip, body }) => {
      const user = s!.user;
      if (!svc.limits.adresseSiteByUser(user.id))
        throw new HttpError(429, 'Trop de tentatives. Réessayez dans une heure.');
      await exigerCode(svc, user, ip, body.code, 'exploitation.adresse_site');
      await svc.adresseSite.demander(svc.db.k, body.adresse, user.username);
      await svc.db.audit(user, ip, 'exploitation.adresse_site_demandee', body.adresse, {
        avant: svc.adresseSite.actuelle(),
      });
      return svc.adresseSite.etat();
    },
  }),
];
