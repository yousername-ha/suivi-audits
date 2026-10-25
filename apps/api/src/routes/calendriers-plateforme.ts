import {
  CalendrierPlateformeBody,
  GenererFeriesBody,
  ImporterCalendrierPlateformeBody,
  RetirerAnneeBody,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { route } from '../http/route.js';

const id = z.object({ id: z.uuid() });
const tags = ['Calendriers de plateforme'];

export const calendriersPlateformeRoutes = [
  route({
    method: 'GET',
    url: '/api/calendriers-plateforme',
    summary: 'Calendriers de plateforme (jours fériés, fermetures) : années couvertes et années à mettre à jour',
    tags,
    access: 'auth',
    handler: async ({ svc }) => svc.calendriers.lister(),
  }),
  route({
    method: 'GET',
    url: '/api/calendriers-plateforme/:id/jours',
    summary: 'Jours d’un calendrier de plateforme, éventuellement d’une seule année',
    tags,
    access: 'auth',
    params: id,
    query: z.object({ annee: z.coerce.number().int().min(1583).max(2200).optional() }).strict(),
    handler: async ({ svc, params, query }) => svc.calendriers.jours(params.id, query.annee),
  }),
  route({
    method: 'GET',
    url: '/api/calendriers-plateforme/:id/journal',
    summary: 'Journal immuable des mises à jour d’un calendrier de plateforme, avec leur provenance',
    tags,
    access: 'administration:lire',
    params: id,
    handler: async ({ svc, params }) => svc.calendriers.journal(params.id),
  }),
  route({
    method: 'POST',
    url: '/api/calendriers-plateforme',
    summary: 'Créer un calendrier de plateforme',
    tags,
    access: 'administration:administrer',
    body: CalendrierPlateformeBody,
    status: 201,
    handler: async ({ svc, s, body, ip }) => svc.calendriers.creer(body, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/calendriers-plateforme/:id/feries',
    summary: 'Générer les jours fériés légaux français d’une année (aperçu, puis ajout sans doublon)',
    tags,
    access: 'administration:administrer',
    params: id,
    body: GenererFeriesBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.calendriers.genererFeries(params.id, body, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/calendriers-plateforme/:id/ical',
    summary: 'Importer un calendrier iCalendar (texte fourni, aucune adresse distante) : aperçu, puis tout ou rien',
    tags,
    access: 'administration:administrer',
    params: id,
    body: ImporterCalendrierPlateformeBody,
    handler: async ({ svc, s, params, body, ip }) => svc.calendriers.importer(params.id, body, (s as Session).user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/calendriers-plateforme/:id/annees/:annee/retrait',
    summary: 'Retirer tous les jours d’une année d’un calendrier, avec un motif consigné',
    tags,
    access: 'administration:administrer',
    params: id.extend({ annee: z.coerce.number().int().min(1583).max(2200) }),
    body: RetirerAnneeBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.calendriers.retirerAnnee(params.id, params.annee, body.reason, (s as Session).user, ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/calendriers-plateforme/:id',
    summary: 'Supprimer un calendrier de plateforme vide',
    tags,
    access: 'administration:administrer',
    params: id,
    handler: async ({ svc, s, params, ip }) => {
      await svc.calendriers.supprimer(params.id, (s as Session).user, ip);
    },
  }),
];
