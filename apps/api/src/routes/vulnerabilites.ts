/* Module Vulnérabilités (ADR 0100), lot V1 : produits surveillés. Toute route passe par route() : session complète et
   double authentification, activation du module « vulnerabilites », droit exigé, CSRF et origine sur les écritures. */
import {
  type ProduitSurveilleDto,
  ProduitSurveilleBody,
  ProduitSurveillePatch,
  ProduitsSurveillesQuery,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

const tags = ['Vulnérabilités'];
const id = z.object({ id: z.uuid() });

export const vulnerabilitesRoutes = [
  route({
    method: 'GET',
    url: '/api/vulnerabilites/produits',
    summary: 'Produits surveillés du registre de l’organisation, éventuellement filtrés par famille',
    tags,
    access: 'vulnerabilites:lire',
    query: ProduitsSurveillesQuery,
    handler: async ({ svc, query }) => svc.vulnerabilites.produits.lister(query.famille),
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/produits/:id',
    summary: 'Fiche d’un produit surveillé (ETag : version de la fiche)',
    tags,
    access: 'vulnerabilites:lire',
    params: id,
    handler: async ({ svc, params, reply }) => {
      const p: ProduitSurveilleDto = await svc.vulnerabilites.produits.lire(params.id);
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'POST',
    url: '/api/vulnerabilites/produits',
    summary: 'Ajouter un produit surveillé (origine « saisie ») ; doublon éditeur, produit et version refusé',
    tags,
    access: 'vulnerabilites:modifier',
    body: ProduitSurveilleBody,
    status: 201,
    handler: async ({ svc, s, body, ip, reply }) => {
      const p = await svc.vulnerabilites.produits.creer(body, (s as Session).user, ip);
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/vulnerabilites/produits/:id',
    summary: 'Modifier un produit surveillé (If-Match : version attendue)',
    tags,
    access: 'vulnerabilites:modifier',
    params: id,
    body: ProduitSurveillePatch,
    handler: async ({ svc, s, params, body, req, ip, reply }) => {
      const p = await svc.vulnerabilites.produits.modifier(
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, p.version);
      return p;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/vulnerabilites/produits/:id',
    summary: 'Supprimer un produit surveillé (If-Match : version attendue)',
    tags,
    access: 'vulnerabilites:supprimer',
    params: id,
    handler: async ({ svc, s, params, req, ip }) => {
      await svc.vulnerabilites.produits.supprimer(params.id, requireIfMatch(req), (s as Session).user, ip);
    },
  }),
  route({
    method: 'GET',
    url: '/api/vulnerabilites/responsables',
    summary: 'Responsables désignables pour un produit surveillé : personnes actives, groupes et fonctions',
    tags,
    access: 'vulnerabilites:modifier',
    handler: async ({ svc }) => svc.vulnerabilites.produits.responsables(),
  }),
];
