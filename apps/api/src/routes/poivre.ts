/* Poivre des mots de passe (ADR 0072) : état, définition (installation existante) et changement depuis l'administration.
   Droit « administrer » + code de double authentification saisi à ce moment (même anti-rejeu que l'installation d'une mise à jour),
   ancien poivre exigé pour un changement, au plus 5 tentatives par heure et par compte. Le poivre ne traverse l'API que dans la
   requête qui l'enregistre ; il n'est jamais renvoyé, journalisé ni stocké en texte. */
import { PoivreChangerBody, PoivreEtat, finCorrespond, problemesPoivre, type PoivreAEnregistrer } from '@suivi/shared';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import type { Services } from '../services.js';
import { exigerCode } from './remise-a-vide.js';

/** Règles de solidité (serveur = autorité) et engagement de sauvegarde au coffre-fort. */
export async function exigerPoivreValide(
  svc: Services,
  p: PoivreAEnregistrer,
  o: { ancien?: string; identifiants?: string[] } = {},
) {
  const general = svc.settings.get('general');
  const comptes = await svc.db.k.selectFrom('users').select('username').execute();
  const problemes = problemesPoivre(p.valeur, {
    mode: p.mode,
    interdits: [general.appName, general.orgName, ...comptes.map((u) => u.username), ...(o.identifiants ?? [])],
    ancien: o.ancien,
  });
  if (problemes.length)
    throw new HttpError(422, `Poivre refusé : ${problemes.join(' ; ')}.`, { reason: 'poivre_faible', problemes });
  if (!finCorrespond(p.valeur, p.engagement.fin))
    throw new HttpError(
      422,
      'Les 8 derniers caractères saisis ne correspondent pas au poivre : enregistrez-le au coffre-fort, puis recopiez sa fin.',
      { reason: 'engagement' },
    );
}

export const poivreRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/poivre',
    summary: 'État du poivre des mots de passe (défini ou non, identifiant de clé, empreintes protégées)',
    tags: ['Administration'],
    access: 'administration:administrer',
    response: PoivreEtat,
    handler: async ({ svc }) => svc.motsDePasse.etat(),
  }),
  route({
    method: 'POST',
    url: '/api/admin/poivre/changer',
    summary:
      'Changer le poivre : ancien poivre et code de double authentification exigés, toutes les empreintes rechiffrées',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: PoivreChangerBody,
    response: PoivreEtat,
    handler: async ({ svc, s, ip, body }) => {
      const user = s!.user;
      if (!svc.limits.poivreByUser(user.id)) throw new HttpError(429, 'Trop de tentatives. Réessayez dans une heure.');
      const avant = await svc.motsDePasse.etat();
      if (!avant.defini)
        throw new HttpError(409, 'Le poivre n’est pas encore défini : utilisez la définition du poivre.');
      await exigerPoivreValide(svc, body.poivre, { ancien: body.ancienPoivre });
      await exigerCode(svc, user, ip, body.code, 'securite.poivre_changement');
      if (!(await svc.motsDePasse.estLePoivre(body.ancienPoivre))) {
        await svc.db.audit(user, ip, 'securite.poivre_changement.ancien_incorrect');
        throw new HttpError(403, 'Ancien poivre incorrect.', { reason: 'ancien_incorrect' });
      }
      const prep = await svc.motsDePasse.preparer(body.poivre.valeur);
      await svc.motsDePasse.changer(prep, avant.idCle as string, user, ip);
      await svc.alertesSecurite.poivre({
        type: 'change',
        auteur: user.username,
        ancienIdCle: avant.idCle,
        nouvelIdCle: prep.idCle,
      });
      return svc.motsDePasse.etat();
    },
  }),
];
