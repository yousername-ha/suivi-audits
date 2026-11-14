import { sql } from 'kysely';
import { z } from 'zod';
import { AvisRappelBody, ReponseQuestionBody, SmsiCreate, SmsiMember, SmsiUpdate } from '@suivi/shared';
import type { Session } from '../../auth.js';
import { cartesPerimetres } from '../../grc/cartes.js';
import { dashboard } from '../../grc/dashboard.js';
import { report } from '../../grc/report.js';
import { sources } from '../../grc/sources.js';
import { route } from '../../http/route.js';
import { requireIfMatch } from '../../http/concurrency.js';
import { base, scope, object } from './commun.js';

export const perimetresRoutes = [
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/method',
    summary: 'Choisir la version méthodologique par défaut du SMSI, sans recalculer le registre',
    params: scope,
    body: z.object({ methodId: z.uuid(), version: z.number().int().positive(), confirm: z.literal('CHOISIR') }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.selectMethod(params.smsi, body.methodId, body.version, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/member-candidates',
    summary: 'Comptes actifs proposés pour les membres du périmètre',
    params: scope,
    handler: async ({ svc, s, params }) => {
      const u = (s as Session).user;
      await svc.grc.permission(u, 'pilotage', 'administrer');
      await svc.grc.access(params.smsi, u, true);
      return svc.db.k
        .selectFrom('users')
        .select(['id', 'username', 'display_name as displayName'])
        .where('disabled', '=', false)
        .where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', sql<Date>`now()`)]))
        .orderBy('username')
        .limit(1000)
        .execute();
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/dashboard',
    summary: 'Tableau de bord SMSI selon les référentiels activés, la politique et les droits',
    params: scope,
    handler: async ({ svc, s, params }) => dashboard(svc.grc, params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/report',
    summary: 'Rapport comité SMSI et audit, filtré par les droits',
    params: scope,
    handler: async ({ svc, s, params, ip }) => report(svc.grc, params.smsi, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/policy',
    summary: 'Adopter explicitement une politique métier compatible',
    params: scope,
    body: z.object({ version: z.number().int().positive(), confirm: z.literal('ADOPTER') }),
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.adoptPolicy(params.smsi, body.version, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/export/authorize',
    summary: 'Autoriser et tracer un export du périmètre',
    params: scope,
    query: z.object({ kind: z.enum(['risks', 'frameworks', 'tasks']) }),
    handler: async ({ svc, s, params, query, ip }) => {
      const u = (s as Session).user;
      await svc.grc.access(params.smsi, u);
      await svc.grc.permission(u, 'import_export', 'exporter');
      await svc.grc.permission(
        u,
        query.kind === 'risks' ? 'pilotage' : query.kind === 'tasks' ? 'ecarts' : 'conformite',
        'lire',
      );
      await svc.grc.permission(
        u,
        query.kind === 'risks' ? 'cartographie' : query.kind === 'tasks' ? 'ecarts' : 'conformite',
        'exporter',
      );
      await svc.db.audit(u, ip, 'grc.export', params.smsi, { kind: query.kind });
      return { ok: true };
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/sources',
    summary: 'Sélectionner un objet ou une version de preuve existants',
    params: scope,
    query: z.object({
      search: z.string().max(200).default(''),
      /** Cibles d'un champ typé (« object:<type> », « legacy:<clé> », « requirement » ou « document » (versions de documents), séparées par des virgules). */
      cibles: z
        .string()
        .max(500)
        .regex(
          /^((object|legacy):[a-z_]{2,40}|requirement|document)(,((object|legacy):[a-z_]{2,40}|requirement|document))*$/,
        )
        .optional(),
    }),
    handler: async ({ svc, s, params, query }) =>
      sources(svc.grc, params.smsi, (s as Session).user, query.search, query.cibles?.split(',')),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/smsis',
    summary: 'SMSI accessibles',
    handler: async ({ svc, s }) => svc.grc.listSmsis((s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/perimetres/synthese',
    summary: 'Cartes de périmètres : compteurs de synthèse par périmètre accessible (null : indisponible)',
    access: 'auth',
    handler: async ({ svc, s }) => cartesPerimetres(svc.grc, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/smsis',
    summary: 'Créer un périmètre SMSI restreint',
    body: SmsiCreate,
    handler: async ({ svc, s, body, ip }) => svc.grc.createSmsi(body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'PATCH',
    url: '/api/grc/smsis/:smsi',
    summary: 'Modifier le nom, le texte, la nature et le fuseau d’un périmètre',
    params: scope,
    body: SmsiUpdate,
    handler: async ({ svc, s, params, body, req, ip }) =>
      svc.grc.updateSmsi(params.smsi, body, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/members',
    summary: 'Membres du SMSI',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.members(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/members',
    summary: 'Attribuer un accès au SMSI',
    params: scope,
    body: SmsiMember,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.setMember(params.smsi, body.userId, body.write, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/members/:id',
    summary: 'Révoquer un accès au SMSI',
    params: object,
    handler: async ({ svc, s, params, ip }) => svc.grc.setMember(params.smsi, params.id, null, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/policy',
    summary: 'Politique métier épinglée au SMSI',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.policy(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/owners',
    summary: 'Responsables autorisés',
    params: scope,
    handler: async ({ svc, s, params }) => svc.grc.owners(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/notifications',
    summary: 'Rappels personnels respectant les accès SMSI',
    handler: async ({ svc, s }) => svc.grc.tasks.notifications((s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/notifications/:id/read',
    summary: 'Marquer un rappel comme lu',
    params: z.object({ id: z.uuid() }),
    handler: async ({ svc, s, params }) => svc.grc.tasks.read(params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/notifications/:id/reponse',
    summary: 'Répondre à une question de l’assistant RSSI (réservé à la personne interrogée)',
    params: z.object({ id: z.uuid() }),
    body: ReponseQuestionBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.assistantRondes.repondreQuestion(params.id, body.texte, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/notifications/:id/avis',
    summary: 'Dire si un rappel de l’assistant RSSI était utile (réservé à son destinataire)',
    params: z.object({ id: z.uuid() }),
    body: AvisRappelBody,
    handler: async ({ svc, s, params, body }) =>
      svc.assistantRondes.avisRappel(params.id, body.avis, (s as Session).user),
  }),
];
