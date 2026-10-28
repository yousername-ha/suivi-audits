/* Alertes de sécurité dans l'application (ADR 0074) : liste des alertes non lues du compte et marquage « lu ». Réservé à qui
   peut administrer ; le destinataire est fixé à l'émission (administrateurs actifs), jamais choisi par l'appelant. */
import { z } from 'zod';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';

const tags = ['Administration'];

export const alertesSecuriteRoutes = [
  route({
    method: 'GET',
    url: '/api/account/alertes-securite',
    summary: 'Alertes de sécurité non lues (verrouillage de compte) adressées à l’administrateur connecté',
    tags,
    access: 'administration:administrer',
    handler: async ({ svc, s }) => svc.alertesSecurite.nonLues(s!.user.id),
  }),
  route({
    method: 'PUT',
    url: '/api/account/alertes-securite/:id/read',
    summary: 'Marquer une alerte de sécurité comme lue',
    tags,
    access: 'administration:administrer',
    params: z.object({ id: z.uuid() }),
    handler: async ({ svc, s, params }) => {
      if (!(await svc.alertesSecurite.lire(params.id, s!.user.id))) throw new HttpError(404, 'Alerte introuvable.');
      return { ok: true };
    },
  }),
];
