import { AssociationParcoursBody, RetraitAssociationBody } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { route } from '../http/route.js';

const smsi = z.object({ smsi: z.uuid() });

export const parcoursRoutes = [
  route({
    method: 'GET',
    url: '/api/grc/:smsi/parcours/associations',
    summary: 'Fiches et preuves associées aux sous-actions du parcours ISO / HDS dans le périmètre (état courant)',
    tags: ['Parcours ISO / HDS'],
    access: 'pilotage:lire',
    params: smsi,
    handler: async ({ svc, s, params }) => svc.grc.parcours.lister(params.smsi, (s as Session).user),
  }),
  route({
    method: 'POST',
    url: '/api/grc/:smsi/parcours/associations',
    summary: 'Associer une fiche ou une preuve lisible à une sous-action : journal immuable, idempotent par requestId',
    tags: ['Parcours ISO / HDS'],
    access: 'pilotage:modifier',
    params: smsi,
    body: AssociationParcoursBody,
    status: 201,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.parcours.associer(params.smsi, body, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/grc/:smsi/parcours/associations/retrait',
    summary: 'Retirer une association (motif obligatoire) : l’historique est conservé, la cible n’est pas modifiée',
    tags: ['Parcours ISO / HDS'],
    access: 'pilotage:modifier',
    params: smsi,
    body: RetraitAssociationBody,
    status: 201,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.parcours.retirer(params.smsi, body, (s as Session).user, ip),
  }),
  route({
    method: 'GET',
    url: '/api/grc/:smsi/parcours/hds',
    summary: 'Applicabilité, dans le périmètre, des exigences du référentiel HDS rattaché (lecture seule)',
    tags: ['Parcours ISO / HDS'],
    access: 'conformite:lire',
    params: smsi,
    handler: async ({ svc, s, params }) => svc.grc.parcours.applicabiliteHds(params.smsi, (s as Session).user),
  }),
];
