/* Registres, périmètres hérités et droits par ressource (ADR 0043). Accès « auth » : l'autorisation réelle (droits de module,
   périmètres, droits attribués) est évaluée par le service, jamais par l'affichage. */
import {
  ContributionAction,
  DeplacementBody,
  DroitBody,
  REGISTRE_KINDS,
  ReouvertureOccurrenceBody,
  ValidationOccurrenceBody,
  RegistreBody,
  RegistrePerimetresBody,
  RegistreUpdate,
  OrdreBody,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

const base = { tags: ['Registres'], access: 'auth' as const };
const registre = z.object({ id: z.uuid() });
const ressource = z.object({ type: z.enum(['registre', 'objet']), id: z.uuid() });
const objet = z.object({ smsi: z.uuid(), id: z.uuid() });

export const registresRoutes = [
  route({
    ...base,
    method: 'GET',
    url: '/api/registres',
    summary: 'Registres accessibles, avec le rôle et les droits de l’utilisateur',
    query: z
      .object({
        perimetre: z.uuid().optional(),
        kind: z.enum(REGISTRE_KINDS).optional(),
        archives: z.enum(['true', 'false']).default('false'),
      })
      .strict(),
    handler: async ({ svc, s, query }) => ({
      items: await svc.grc.registres.list((s as Session).user, {
        perimetre: query.perimetre,
        kind: query.kind,
        archives: query.archives === 'true',
      }),
    }),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/registres',
    summary: 'Créer un registre portant un ou plusieurs périmètres',
    body: RegistreBody,
    status: 201,
    handler: async ({ svc, s, body, ip, reply }) => {
      const r = await svc.grc.registres.create(body, (s as Session).user, ip);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/registres/elements',
    summary: 'Éléments des registres d’un périmètre, filtrés par registres choisis (sans doublon)',
    query: z
      .object({
        perimetre: z.uuid(),
        registres: z.string().max(2000).default(''),
        kind: z.enum(['action', 'nonconformity', 'task_series']).optional(),
        search: z.string().max(200).default(''),
        offset: z.coerce.number().int().min(0).max(1000000).default(0),
      })
      .strict(),
    handler: async ({ svc, s, query }) => {
      const registres = query.registres ? query.registres.split(',').map((x) => z.uuid().parse(x.trim())) : [];
      return svc.grc.registres.elementsFiltres((s as Session).user, { ...query, registres });
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/registres/:id',
    summary: 'Consulter un registre',
    params: registre,
    handler: async ({ svc, s, params, reply }) => {
      const r = await svc.grc.registres.get(params.id, (s as Session).user);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    ...base,
    method: 'PATCH',
    url: '/api/registres/:id',
    summary: 'Renommer, décrire ou restreindre un registre',
    params: registre,
    body: RegistreUpdate,
    handler: async ({ svc, s, params, body, ip, req, reply }) => {
      const r = await svc.grc.registres.update(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/registres/:id/perimetres',
    summary: 'Changer les périmètres d’un registre (aperçu de l’impact, puis commande atomique)',
    params: registre,
    body: RegistrePerimetresBody,
    handler: async ({ svc, s, params, body, ip, req }) =>
      svc.grc.registres.setPerimetres(params.id, body, body.apercu ? 0 : requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/registres/:id/ordre',
    summary: 'Ordonner les actions d’un plan d’actions',
    params: registre,
    body: OrdreBody,
    handler: async ({ svc, s, params, body, ip, req, reply }) => {
      const r = await svc.grc.registres.ordonner(params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, r.version);
      return r;
    },
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/registres/:id/archivage',
    summary: 'Archiver un registre sans toucher à ses éléments',
    params: registre,
    handler: async ({ svc, s, params, ip, req }) =>
      svc.grc.registres.archive(params.id, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/registres/:id/elements',
    summary: 'Éléments d’un registre (périmètres hérités du registre)',
    params: registre,
    query: z
      .object({
        kind: z.enum(['action', 'nonconformity', 'task_series']).optional(),
        search: z.string().max(200).default(''),
        offset: z.coerce.number().int().min(0).max(1000000).default(0),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.registres.elements(params.id, (s as Session).user, query.kind, query.search, query.offset),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/registres/elements/:id/acces',
    summary: 'Accès effectif de l’utilisateur à un élément (lecture, contribution, gestion)',
    params: registre,
    handler: async ({ svc, s, params }) => svc.grc.registres.accesElement(params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/droits/:type/:id',
    summary: 'Droits attribués sur un registre ou un élément (gestionnaires)',
    params: ressource,
    handler: async ({ svc, s, params }) => ({
      items: await svc.grc.registres.droits(params.type, params.id, (s as Session).user),
    }),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/droits/:type/:id/titulaires',
    summary: 'Utilisateurs et groupes proposables pour un droit (gestionnaires de la ressource)',
    params: ressource,
    query: z.object({ q: z.string().max(100).default('') }).strict(),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.registres.titulaires(params.type, params.id, (s as Session).user, query.q),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/droits/:type/:id',
    summary: 'Attribuer ou modifier le rôle d’un utilisateur ou d’un groupe',
    params: ressource,
    body: DroitBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.registres.accorder(params.type, params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/droits/:type/:id/:droitId',
    summary: 'Retirer un droit',
    params: ressource.extend({ droitId: z.uuid() }),
    handler: async ({ svc, s, params, ip }) => {
      await svc.grc.registres.retirer(params.type, params.id, params.droitId, (s as Session).user, ip);
    },
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/objects/:id/contribution',
    summary: 'Contribuer à une action : avancement seulement (rôle de contributeur suffisant)',
    params: objet,
    body: ContributionAction,
    handler: async ({ svc, s, params, body, ip, req, reply }) => {
      const o = await svc.grc.contribuer(params.smsi, params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, o.version);
      return o;
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/objects/:id/validations',
    summary: 'Journal de validation d’une occurrence récurrente et son état',
    params: objet,
    handler: async ({ svc, s, params }) => svc.grc.validations.historique(params.smsi, params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/objects/:id/validations',
    summary: 'Valider une occurrence (OK, KO ou NA) : journal immuable, commande idempotente par requestId',
    params: objet,
    body: ValidationOccurrenceBody,
    status: 201,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.validations.valider(params.smsi, params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/objects/:id/validations/reouverture',
    summary: 'Rouvrir une occurrence validée, avec motif (gestionnaires)',
    params: objet,
    body: ReouvertureOccurrenceBody,
    status: 201,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.validations.rouvrir(params.smsi, params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/objects/:id/deplacement',
    summary: 'Déplacer un élément vers un autre registre de la même famille (aperçu d’impact, puis commande motivée)',
    params: objet,
    body: DeplacementBody,
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.registres.deplacer(
        params.smsi,
        params.id,
        body,
        body.apercu ? 0 : requireIfMatch(req),
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/responsables',
    summary: 'Responsables proposables dans un périmètre : personnes, groupes et fonctions',
    params: z.object({ smsi: z.uuid() }),
    handler: async ({ svc, s, params }) => svc.grc.annuaires.proposables(params.smsi, (s as Session).user),
  }),
];
