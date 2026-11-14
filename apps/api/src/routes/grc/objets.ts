import { z } from 'zod';
import { CalendrierBody, GRC_KINDS, GrcObjectBody, GrcRef, LinkBody } from '@suivi/shared';
import type { Session } from '../../auth.js';
import { route } from '../../http/route.js';
import { requireIfMatch, setEtag } from '../../http/concurrency.js';
import { base, scope, object } from './commun.js';

export const objetsRoutes = [
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/tasks',
    summary: 'Liste paginée des actions natives et historiques sans duplication',
    params: scope,
    query: z.object({
      search: z.string().max(200).default(''),
      offset: z.coerce.number().int().min(0).max(1000000).default(0),
      status: z.string().max(64).optional(),
      ownerId: z.uuid().optional(),
    }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.list(params.smsi, (s as Session).user, query.search, query.offset, {
        status: query.status,
        ownerId: query.ownerId,
      }),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/legacy-tasks/complete',
    summary: 'Réaliser une action historique sans créer de copie',
    body: z.object({
      ref: GrcRef,
      sourceSha: z.string().regex(/^[a-f0-9]{64}$/),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      comment: z.string().trim().min(10).max(5000),
      proof: z.string().max(5000),
      confirm: z.literal('REALISER'),
    }),
    handler: async ({ svc, s, body, req, ip }) =>
      svc.grc.legacyTasks.complete(
        body.ref,
        requireIfMatch(req),
        body.sourceSha,
        { date: body.date, comment: body.comment, proof: body.proof },
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/objects',
    summary: 'Registre paginé sans duplication',
    params: scope,
    query: z
      .object({
        kind: z.enum(GRC_KINDS),
        search: z.string().max(200).default(''),
        offset: z.coerce.number().int().min(0).max(1000000).default(0),
        status: z.string().max(64).optional(),
        ownerId: z.uuid().optional(),
        domain: z.string().max(120).optional(),
        scope: z.string().max(200).optional(),
        relatedRef: GrcRef.optional(),
        entity: z.string().max(200).optional(),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) => {
      const { kind, search, offset, ...filters } = query;
      return svc.grc.listObjects(params.smsi, (s as Session).user, kind, search, offset, filters);
    },
  }),
  route({
    ...base,
    // Session complète (ADR 0092, lot 2) : la personne à qui un registre est attribué y crée, et gère ce qu'elle a créé, sans
    // droit de module. Le service reste seul juge : registre, droits de module et périmètres (403 ou 404 sinon).
    access: 'auth',
    method: 'POST',
    url: '/api/grc/:smsi/objects',
    summary: 'Créer une fiche liée au SMSI',
    params: scope,
    body: GrcObjectBody,
    handler: async ({ svc, s, params, body, ip, reply }) => {
      const o = await svc.grc.createObject(params.smsi, body, (s as Session).user, ip);
      setEtag(reply, o.version);
      return o;
    },
  }),
  route({
    ...base,
    // Session complète : un droit de lecture attribué sur un registre (ADR 0043) suffit sans droit de module ; le service
    // refuse (403) tout objet qui n'est ni dans un registre accessible ni lisible par les droits de module et périmètres.
    access: 'auth',
    method: 'GET',
    url: '/api/grc/:smsi/objects/:id',
    summary: 'Consulter une fiche',
    params: object,
    handler: async ({ svc, s, params, reply }) => {
      const o = await svc.grc.object(params.smsi, params.id, (s as Session).user);
      setEtag(reply, o.version);
      return o;
    },
  }),
  route({
    ...base,
    // Session complète (ADR 0092, lot 2) : la personne à qui un registre est attribué y crée, et gère ce qu'elle a créé, sans
    // droit de module. Le service reste seul juge : registre, droits de module et périmètres (403 ou 404 sinon).
    access: 'auth',
    method: 'PUT',
    url: '/api/grc/:smsi/objects/:id',
    summary: 'Modifier avec contrôle de concurrence',
    params: object,
    body: GrcObjectBody,
    handler: async ({ svc, s, params, body, ip, req, reply }) => {
      const o = await svc.grc.updateObject(params.smsi, params.id, body, requireIfMatch(req), (s as Session).user, ip);
      setEtag(reply, o.version);
      return o;
    },
  }),
  route({
    ...base,
    // Session complète (ADR 0092, lot 2) : la personne à qui un registre est attribué y crée, et gère ce qu'elle a créé, sans
    // droit de module. Le service reste seul juge : registre, droits de module et périmètres (403 ou 404 sinon).
    access: 'auth',
    method: 'DELETE',
    url: '/api/grc/:smsi/objects/:id',
    summary: 'Archiver sans supprimer les décisions',
    params: object,
    handler: async ({ svc, s, params, ip, req }) =>
      svc.grc.archive(params.smsi, params.id, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/objects/:id/history',
    summary: 'Historique immuable des fiches',
    params: object,
    query: z.object({ before: z.coerce.number().int().positive().default(2147483647) }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.history(params.smsi, params.id, (s as Session).user, query.before),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/links',
    summary: 'Relations bidirectionnelles filtrées par les droits',
    params: scope,
    query: z.object({ ref: GrcRef }),
    handler: async ({ svc, s, params, query }) => svc.grc.links(params.smsi, query.ref, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/links',
    summary: 'Lier deux objets existants',
    params: scope,
    body: LinkBody.extend({ source: GrcRef }),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.link(params.smsi, body.source, body.target, body.type, body.note, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/links/:id',
    summary: 'Retirer une relation',
    params: object,
    handler: async ({ svc, s, params, ip }) => svc.grc.unlink(params.smsi, params.id, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/tasks/window',
    summary: 'Actions synchronisées pour calendrier et planning',
    params: scope,
    query: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).refine((q) => q.from <= q.to),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.window(params.smsi, (s as Session).user, query.from, query.to),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/tasks/dashboard',
    summary: 'Indicateurs d’actions selon le workflow du SMSI',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.tasks.dashboard(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/series/:id/occurrences',
    summary: 'Occurrences uniques et historique de récurrence',
    params: object,
    query: z.object({ before: z.string().max(200).optional() }),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.occurrences(params.smsi, params.id, (s as Session).user, query.before),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/series/:id/prochaine',
    summary: 'Occurrence suivante à traiter (la plus ancienne non validée dont la fenêtre est ouverte)',
    params: object,
    query: z.object({ apres: z.uuid().optional() }).strict(),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.prochaine(params.smsi, params.id, (s as Session).user, query.apres),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/occurrences/prochaine',
    summary:
      'Occurrence suivante à traiter dans la liste courante de la personne (ordre conservé, toutes séries confondues)',
    params: scope,
    query: z
      .object({
        apres: z.uuid(),
        liste: z
          .string()
          .max(40_000)
          .regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(,[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})*$/),
      })
      .strict(),
    handler: async ({ svc, s, params, query }) =>
      svc.grc.tasks.prochaineDansListe(params.smsi, query.liste.split(','), query.apres, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/series/:id/calendrier',
    summary: 'Importer un calendrier iCalendar dans les jours exclus d’une série (aperçu, puis import tout ou rien)',
    params: object,
    body: CalendrierBody,
    handler: async ({ svc, s, params, body, ip, req }) =>
      svc.grc.tasks.importerCalendrier(
        params.smsi,
        params.id,
        body,
        body.apercu ? 0 : requireIfMatch(req),
        (s as Session).user,
        ip,
      ),
  }),
];
