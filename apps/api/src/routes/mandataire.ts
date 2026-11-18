/* Mandataire sortant de l'établissement (ADR 0101, lot P1) : lecture et enregistrement du réglage (administration:administrer,
   If-Match), mot de passe en écriture seule (défini, retiré ; jamais relu). Journal `systeme.mandataire.*` sans secret. */
import { MandataireMotDePasseBody, MandataireOut } from '@suivi/shared';
import { z } from 'zod';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

export const mandataireRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/mandataire',
    summary: 'Mandataire sortant de l’établissement : réglage (ETag = version) ; le mot de passe n’est jamais renvoyé',
    tags: ['Administration'],
    access: 'administration:administrer',
    response: MandataireOut,
    handler: async ({ svc, reply }) => {
      const out = await svc.mandataire.lire();
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/mandataire',
    summary:
      'Mandataire sortant : enregistrer le réglage (If-Match obligatoire) ; changer l’adresse ou l’identifiant efface le mot de passe',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: z.record(z.string(), z.unknown()),
    response: MandataireOut,
    handler: async ({ svc, s, ip, req, reply, body }) => {
      const attendue = requireIfMatch(req);
      const out = await svc.mandataire.ecrire(body, attendue, s!.user, ip);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/mandataire/mot-de-passe',
    summary: 'Mandataire sortant : enregistrer le mot de passe (scellé par le coffre, jamais relu)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: MandataireMotDePasseBody,
    status: 204,
    handler: async ({ svc, s, ip, body }) => {
      await svc.mandataire.definirMotDePasse(body.password, s!.user, ip);
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/mandataire/mot-de-passe',
    summary: 'Mandataire sortant : retirer le mot de passe enregistré',
    tags: ['Administration'],
    access: 'administration:administrer',
    status: 204,
    handler: async ({ svc, s, ip }) => {
      await svc.mandataire.retirerMotDePasse(s!.user, ip);
    },
  }),
];
