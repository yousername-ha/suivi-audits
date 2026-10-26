/* Notifications métier (décision 012-10, ADR 0058) : réglages tri-état par groupe, rôle et utilisateur, résultat effectif et
   aperçu des destinataires. Une personne ne modifie que ses propres réglages (route « account ») ; l'administration
   (administration:administrer) modifie ceux des groupes, des rôles et des comptes. Écritures versionnées (If-Match) et
   journalisées sans adresse courriel. */
import { ApercuQuery, ReglagesBody } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

const tags = ['Notifications'];
const cible = z.object({ kind: z.enum(['groupe', 'role', 'utilisateur']), id: z.string().min(1).max(64) }).strict();

export const notificationsRoutes = [
  route({
    method: 'GET',
    url: '/api/account/notifications',
    summary: 'Mes réglages de notification (tri-état par type et canal) et leur résultat effectif avec l’origine',
    tags,
    access: 'auth',
    handler: async ({ svc, s, reply }) => {
      const out = await svc.notificationsMetier.lirePortee('utilisateur', (s as Session).user.id);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/account/notifications',
    summary: 'Modifier mes propres réglages de notification (If-Match obligatoire)',
    tags,
    access: 'auth',
    body: ReglagesBody,
    handler: async ({ svc, s, req, reply, body, ip }) => {
      const user = (s as Session).user;
      const out = await svc.notificationsMetier.ecrire(
        'utilisateur',
        user.id,
        body.changements,
        requireIfMatch(req),
        user,
        ip,
      );
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/notifications/portees',
    summary: 'Groupes et rôles dont on peut régler les notifications, avec le nombre de comptes actifs concernés',
    tags,
    access: 'administration:lire',
    handler: async ({ svc }) => svc.notificationsMetier.portees(),
  }),
  route({
    method: 'GET',
    url: '/api/admin/notifications/etat',
    summary: 'État du canal courriel et des envois de notification des sept derniers jours (sans adresse)',
    tags,
    access: 'administration:lire',
    handler: async ({ svc }) => ({
      courriel: svc.notificationsMetier.canalCourriel(),
      envois: await svc.notificationsMetier.etatEnvois(),
    }),
  }),
  route({
    method: 'GET',
    url: '/api/admin/notifications/apercu',
    summary:
      'Qui recevrait quoi : destinataires résolus pour un type et un canal, avec l’origine, et exclusions personnelles',
    tags,
    access: 'administration:lire',
    query: ApercuQuery,
    handler: async ({ svc, query }) => svc.notificationsMetier.apercu(query.type, query.canal),
  }),
  route({
    method: 'GET',
    url: '/api/admin/notifications/reglages/:kind/:id',
    summary: 'Réglages de notification d’un groupe, d’un rôle ou d’un compte (ETag = version de la portée)',
    tags,
    access: 'administration:lire',
    params: cible,
    handler: async ({ svc, params, reply }) => {
      const out = await svc.notificationsMetier.lirePortee(params.kind, params.id);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/notifications/reglages/:kind/:id',
    summary: 'Modifier les réglages de notification d’un groupe, d’un rôle ou d’un compte (If-Match obligatoire)',
    tags,
    access: 'administration:administrer',
    params: cible,
    body: ReglagesBody,
    handler: async ({ svc, s, req, reply, params, body, ip }) => {
      const out = await svc.notificationsMetier.ecrire(
        params.kind,
        params.id,
        body.changements,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      );
      setEtag(reply, out.version);
      return out;
    },
  }),
];
