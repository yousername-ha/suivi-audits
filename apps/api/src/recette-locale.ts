/* Recette locale (poste de test) : crée le premier compte administrateur sans passer par l'assistant d'installation, pour
   essayer une branche sur « localhost ». Aucune authentification n'est contournée : la commande émet un jeton d'installation
   comme `setup-token`, puis appelle la route d'installation normale avec un poivre, une clé de secours et un mot de passe
   tirés au hasard. Elle est refusée hors de « localhost » et dès qu'un administrateur existe. Le poivre et la clé de secours
   ne sont pas conservés : une recette locale est jetable, ses sauvegardes ne sont pas restaurables. */
import { randomBytes } from 'node:crypto';
import { finPoivre, canoniquePoivre, genererCleSecours, genererPoivre } from '@suivi/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from './services.js';

export const COMPTE_RECETTE = 'recette';

export async function installerRecetteLocale(
  svc: Services,
  app: FastifyInstance,
): Promise<{ identifiant: string; motDePasse: string }> {
  let hote = '';
  try {
    hote = new URL(svc.cfg.publicUrl).hostname;
  } catch {
    /* adresse absente ou invalide : refus ci-dessous */
  }
  if (hote !== 'localhost')
    throw new Error('Commande réservée à une recette locale : l’adresse du site doit être « localhost ».');
  if (await svc.auth.adminExists()) throw new Error('Un administrateur existe déjà : connectez-vous normalement.');
  const { token } = await svc.auth.issueSetupToken('recette-locale', () => {});
  const poivre = genererPoivre();
  // Mot de passe long et aléatoire, avec les quatre familles de caractères.
  const motDePasse = 'Rl-' + randomBytes(15).toString('base64url') + '-9a';
  const r = await app.inject({
    method: 'POST',
    url: '/api/setup',
    headers: { 'content-type': 'application/json' },
    payload: {
      token,
      username: COMPTE_RECETTE,
      displayName: 'Compte de recette',
      orgName: 'Organisation fictive de recette',
      password: motDePasse,
      // Comme l'assistant : le poivre et la clé de secours ne sont fournis que s'ils ne sont pas déjà définis.
      ...((await svc.motsDePasse.defini())
        ? {}
        : {
            poivre: {
              mode: 'genere',
              valeur: poivre,
              engagement: { coffre: true, fin: finPoivre(canoniquePoivre(poivre)) },
            },
          }),
      ...((await svc.cleSecours.definie())
        ? {}
        : { cleSecours: { publique: (await genererCleSecours()).publique, coffre: true } }),
    },
  });
  if (r.statusCode !== 201) throw new Error(`Installation refusée (${r.statusCode}) : ${r.body.slice(0, 300)}`);
  return { identifiant: COMPTE_RECETTE, motDePasse };
}
