/* Catalogue de configuration GRC transversal (ADR 0038). Les droits sont contrôlés par le service : lecture avec
   pilotage:lire, parametres:lire ou administration:lire ; brouillon avec parametres:modifier (organisation) ou
   pilotage:administrer + écriture dans le périmètre ; publication, archivage et suppression avec parametres:administrer. */
import { CFG_FAMILIES, CFG_KINDS, CFG_SCOPES, CFG_STATES } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { requireIfMatch, setEtag } from '../http/concurrency.js';
import { route } from '../http/route.js';

const id = z.object({ id: z.uuid() });
const definition = z.record(z.string(), z.unknown());
const key = z.string().trim().min(1).max(64);
const version = z.coerce.number().int().min(1).max(2147483647);
const user = (s: unknown) => (s as Session).user;

export const configGrcRoutes = [
  route({
    method: 'GET',
    url: '/api/config-grc/templates',
    summary: 'Modèles de configuration proposés (adoptés à la demande, jamais livrés par défaut)',
    tags: ['Configuration GRC'],
    access: 'auth',
    handler: async ({ svc, s }) => {
      await svc.configGrc.list(user(s));
      return svc.configGrc.templates();
    },
  }),
  route({
    method: 'POST',
    url: '/api/config-grc/templates/:id/adopt',
    summary: 'Adopter un modèle : crée ses éléments d’organisation, publiés en version 1 à relire et valider',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: z.object({ id: z.string().min(1).max(100) }),
    status: 201,
    handler: async ({ svc, s, ip, params }) => svc.configGrc.adoptTemplate(user(s), ip, params.id),
  }),
  route({
    method: 'GET',
    url: '/api/config-grc/items',
    summary: 'Éléments du catalogue visibles (échelles, matrices, correspondances, critères, taxonomies)',
    tags: ['Configuration GRC'],
    access: 'auth',
    query: z.object({
      kind: z.enum(CFG_KINDS).optional(),
      state: z.enum(CFG_STATES).optional(),
      scope: z.enum(CFG_SCOPES).optional(),
      smsi: z.uuid().optional(),
      family: z.enum(CFG_FAMILIES).optional(),
      category: z.string().max(60).optional(),
      q: z.string().max(100).optional(),
    }),
    handler: async ({ svc, s, query }) => svc.configGrc.list(user(s), query),
  }),
  route({
    method: 'POST',
    url: '/api/config-grc/items',
    summary: 'Créer un élément (brouillon)',
    tags: ['Configuration GRC'],
    access: 'auth',
    status: 201,
    body: z
      .object({
        kind: z.enum(CFG_KINDS),
        key,
        scope: z.enum(CFG_SCOPES).default('instance'),
        smsiId: z.uuid().nullable().optional(),
        definition,
      })
      .strict(),
    handler: async ({ svc, s, ip, body, reply }) => {
      const item = await svc.configGrc.create(user(s), ip, body);
      setEtag(reply, item.version);
      return item;
    },
  }),
  route({
    method: 'GET',
    url: '/api/config-grc/items/:id',
    summary: 'Un élément : brouillon, version publiée, versions et nombre d’usages',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    handler: async ({ svc, s, params, reply }) => {
      const item = await svc.configGrc.get(user(s), params.id);
      setEtag(reply, item.version);
      return item;
    },
  }),
  route({
    method: 'PUT',
    url: '/api/config-grc/items/:id/draft',
    summary: 'Enregistrer le brouillon (If-Match : version de l’élément)',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    body: z.object({ definition }).strict(),
    handler: async ({ svc, s, ip, req, params, body, reply }) => {
      const item = await svc.configGrc.saveDraft(user(s), ip, params.id, requireIfMatch(req), body.definition);
      setEtag(reply, item.version);
      return item;
    },
  }),
  route({
    method: 'POST',
    url: '/api/config-grc/items/:id/preview',
    summary: 'Valider le brouillon et mesurer son impact, sans aucune écriture',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    handler: async ({ svc, s, params }) => svc.configGrc.preview(user(s), params.id),
  }),
  route({
    method: 'POST',
    url: '/api/config-grc/items/:id/publish',
    summary: 'Publier une nouvelle version immuable (If-Match : version de l’élément)',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    body: z
      .object({
        previewId: z.string().regex(/^[a-f0-9]{64}$/),
        reason: z.string().trim().min(5).max(1000),
        confirm: z.literal('PUBLIER'),
      })
      .strict(),
    handler: async ({ svc, s, ip, req, params, body, reply }) => {
      const item = await svc.configGrc.publish(
        user(s),
        ip,
        params.id,
        requireIfMatch(req),
        body.previewId,
        body.reason,
      );
      setEtag(reply, item.version);
      return item;
    },
  }),
  route({
    method: 'GET',
    url: '/api/config-grc/items/:id/versions/:version',
    summary: 'Définition immuable d’une version publiée',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: z.object({ id: z.uuid(), version }),
    handler: async ({ svc, s, params }) => svc.configGrc.version(user(s), params.id, params.version),
  }),
  route({
    method: 'GET',
    url: '/api/config-grc/items/:id/usages',
    summary: 'Dépendances : méthodes, éléments et analyses qui épinglent une version de cet élément',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    handler: async ({ svc, s, params }) => svc.configGrc.usages(user(s), params.id),
  }),
  route({
    method: 'GET',
    url: '/api/config-grc/items/:id/impact',
    summary: 'Étude d’impact d’un passage d’une version à une autre d’une échelle (aucune écriture)',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    query: z.object({ from: version, to: version }),
    handler: async ({ svc, s, params, query }) => svc.configGrc.impact(user(s), params.id, query.from, query.to),
  }),
  route({
    method: 'POST',
    url: '/api/config-grc/items/:id/derive',
    summary: 'Créer une variante (l’élément d’origine n’est jamais modifié)',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    status: 201,
    body: z
      .object({
        key,
        name: z.string().trim().min(1).max(200).optional(),
        scope: z.enum(CFG_SCOPES).default('instance'),
        smsiId: z.uuid().nullable().optional(),
      })
      .strict(),
    handler: async ({ svc, s, ip, params, body }) => svc.configGrc.derive(user(s), ip, params.id, body),
  }),
  route({
    method: 'POST',
    url: '/api/config-grc/items/:id/archive',
    summary: 'Archiver : plus aucun nouvel usage, les usages existants sont conservés',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    handler: async ({ svc, s, ip, params, reply }) => {
      const item = await svc.configGrc.setArchived(user(s), ip, params.id, true);
      setEtag(reply, item.version);
      return item;
    },
  }),
  route({
    method: 'POST',
    url: '/api/config-grc/items/:id/restore',
    summary: 'Restaurer un élément archivé',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    handler: async ({ svc, s, ip, params, reply }) => {
      const item = await svc.configGrc.setArchived(user(s), ip, params.id, false);
      setEtag(reply, item.version);
      return item;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/config-grc/items/:id',
    summary: 'Supprimer un brouillon jamais publié',
    tags: ['Configuration GRC'],
    access: 'auth',
    params: id,
    handler: async ({ svc, s, ip, params }) => {
      await svc.configGrc.remove(user(s), ip, params.id);
    },
  }),
];
