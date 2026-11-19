/* Contacts de crise issus des comptes (ADR 0107) : fiche d'un compte dans l'administration des comptes (lecture avec
   administration:lire, écriture avec administration:administrer), et carte « Contact de crise » de Mon compte (la personne
   lit sa fiche et ne modifie que ses téléphones et sa disponibilité). Écritures avec If-Match ; ETag = version (0 : pas de
   fiche). La lecture par les personnes qui lisent les incidents passe par `GET /api/crise` (historique/crise.ts). */
import {
  ContactCriseCompteAdmin,
  ContactCriseCompteAdminOut,
  ContactCriseCompteSoi,
  ContactCriseCompteSoiOut,
  Uuid,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

const IdParams = z.object({ id: Uuid });

export const contactsCriseComptesRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/users/:id/contact-crise',
    summary: 'Contact de crise d’un compte : rôle de crise, téléphones, disponibilité, contact clé, périmètres (ETag)',
    tags: ['Droits'],
    access: 'administration:lire',
    params: IdParams,
    response: ContactCriseCompteAdminOut,
    handler: async ({ svc, params, reply }) => {
      const out = await svc.contactsCrise.lireAdmin(params.id);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/users/:id/contact-crise',
    summary:
      'Marquer ou retirer un compte comme contact de crise, avec son rôle, ses téléphones et ses périmètres (If-Match, 0 pour une création)',
    tags: ['Droits'],
    access: 'administration:administrer',
    params: IdParams,
    body: ContactCriseCompteAdmin,
    response: ContactCriseCompteAdminOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const out = await svc.contactsCrise.ecrireAdmin(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'GET',
    url: '/api/account/contact-crise',
    summary: 'Ma fiche de contact de crise (null si je ne suis pas contact de crise)',
    tags: ['Compte'],
    access: 'auth',
    response: ContactCriseCompteSoiOut.nullable(),
    handler: async ({ svc, s, reply }) => {
      const out = await svc.contactsCrise.lireSoi((s as Session).user);
      if (out) setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/account/contact-crise',
    summary: 'Mettre à jour mes téléphones et ma disponibilité de contact de crise (If-Match obligatoire)',
    tags: ['Compte'],
    access: 'auth',
    body: ContactCriseCompteSoi,
    response: ContactCriseCompteSoiOut,
    handler: async ({ svc, s, ip, req, reply, body }) => {
      const out = await svc.contactsCrise.ecrireSoi((s as Session).user, body, requireIfMatch(req), ip);
      setEtag(reply, out.version);
      return out;
    },
  }),
];
