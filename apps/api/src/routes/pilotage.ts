import { z } from 'zod';
import { GrcRef, GRC_MODULES, PilotageRecord, Recurrence, SuppressionBody } from '@suivi/shared';
import type { Session } from '../auth.js';
import { Pilotage } from '../pilotage/service.js';
import { PilotageObjectifs } from '../pilotage/objectifs.js';
import { PilotageBoites } from '../pilotage/boites.js';
import { route } from '../http/route.js';
import { requireIfMatch } from '../http/concurrency.js';
const base = { tags: ['Pilotage'], access: 'metier' as const };
const scope = z.object({ smsi: z.uuid() });
const cleObjectifs = z.enum(['processes', 'objectives', 'indicators']);
const recordBody = z.object({ ref: GrcRef, decision: PilotageRecord }).strict();
export const pilotageRoutes = [
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/pilotage/boites',
    params: scope,
    summary: 'Boîtes de pilotage par processus : actions, risques et séries rattachés, prochaine échéance récurrente',
    handler: async ({ svc, s, params }) => new PilotageBoites(svc.grc).lister(params.smsi, (s as Session).user),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/pilotage/objectifs/:cle',
    params: scope.extend({ cle: cleObjectifs }),
    body: z.record(z.string(), z.unknown()),
    summary: 'Créer un processus, un objectif ou un indicateur dans l’état de l’outil de suivi',
    handler: async ({ svc, s, params, body, ip }) =>
      new PilotageObjectifs(svc.grc).creer(params.smsi, params.cle, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'PATCH',
    url: '/api/grc/:smsi/pilotage/objectifs/:cle/:id',
    params: scope.extend({ cle: cleObjectifs, id: z.string().min(1).max(60) }),
    body: z.record(z.string(), z.unknown()),
    summary: 'Modifier un processus, un objectif ou un indicateur (champs présents seulement)',
    handler: async ({ svc, s, params, body, ip }) =>
      new PilotageObjectifs(svc.grc).modifier(params.smsi, params.cle, params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/pilotage/objectifs/:cle/:id',
    params: scope.extend({ cle: cleObjectifs, id: z.string().min(1).max(60) }),
    query: SuppressionBody,
    summary: 'Supprimer un processus, un objectif (et ses indicateurs) ou un indicateur',
    handler: async ({ svc, s, params, ip }) =>
      new PilotageObjectifs(svc.grc).supprimer(params.smsi, params.cle, params.id, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/pilotage/objectifs/indicators/:id/values',
    params: scope.extend({ id: z.string().min(1).max(60) }),
    body: z.record(z.string(), z.unknown()),
    summary: 'Ajouter une mesure à un indicateur',
    handler: async ({ svc, s, params, body, ip }) =>
      new PilotageObjectifs(svc.grc).ajouterValeur(params.smsi, params.id, body, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'DELETE',
    url: '/api/grc/:smsi/pilotage/objectifs/indicators/:id/values/:rang',
    params: scope.extend({ id: z.string().min(1).max(60), rang: z.coerce.number().int().min(0).max(10000) }),
    summary: 'Supprimer une mesure d’un indicateur',
    handler: async ({ svc, s, params, ip }) =>
      new PilotageObjectifs(svc.grc).supprimerValeur(params.smsi, params.id, params.rang, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/pilotage/export',
    params: scope,
    query: z.object({
      kind: z.enum([
        'bia',
        'continuity_plan',
        'continuity_exercise',
        'evidence',
        'control',
        'nonconformity',
        'journey',
        'management_review',
      ]),
    }),
    summary: 'Exporter le registre et ses décisions selon les droits du demandeur',
    handler: async ({ svc, s, params, query, ip }) => {
      const user = (s as Session).user,
        g = svc.grc;
      await g.access(params.smsi, user);
      await g.permission(user, 'import_export', 'exporter');
      await g.permission(user, GRC_MODULES[query.kind], 'exporter');
      await g.permission(user, GRC_MODULES[query.kind], 'lire');
      const objects = (
        await svc.db.q(
          'SELECT id,name,kind,data,version,created_by,updated_by,created_at,updated_at FROM grc_objects WHERE smsi_id=$1 AND kind=$2 AND NOT archived ORDER BY id LIMIT 1000',
          [params.smsi, query.kind],
        )
      ).rows;
      const refs = objects.map((o) => 'object:' + o.id);
      const key =
        query.kind === 'nonconformity'
          ? 'findings'
          : query.kind === 'evidence'
            ? 'evidences'
            : query.kind === 'management_review'
              ? 'reviews'
              : null;
      const legacy = [];
      if (
        key &&
        params.smsi === '00000000-0000-4000-8000-000000000001' &&
        (key !== 'evidences' || user.rights.can('pilotage', 'lire'))
      ) {
        const adapter = new Pilotage(g).legacy;
        const state = await g.legacy.recompose();
        for (const row of adapter.rows(state?.data ?? {}, key).slice(0, 1000)) {
          const o = adapter.dto(params.smsi, key, row, state?.version ?? 0);
          legacy.push(o);
          refs.push(o.id);
        }
      }
      const decisions = (
        await svc.db.q(
          'SELECT * FROM pilotage_decisions WHERE smsi_id=$1 AND source_ref=ANY($2) ORDER BY created_at DESC LIMIT 1000',
          [params.smsi, refs],
        )
      ).rows;
      await svc.db.audit(user, ip, 'pilotage.register.exported', params.smsi, {
        kind: query.kind,
        objects: objects.length + legacy.length,
      });
      return {
        format: 'pilotage-register-v1',
        kind: query.kind,
        generatedAt: new Date().toISOString(),
        objects,
        legacy,
        decisions,
        limits: { objects: 1000, legacy: 1000, decisions: 1000 },
        note: 'Export borné des données et décisions disponibles ; aucune attestation de conformité.',
      };
    },
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/pilotage/history',
    params: scope,
    query: z.object({ ref: GrcRef, before: z.iso.datetime().optional() }),
    summary: 'Décisions de pilotage immuables, filtrées par les droits',
    handler: async ({ svc, s, params, query }) =>
      new Pilotage(svc.grc).history(params.smsi, query.ref, (s as Session).user, query.before),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/pilotage/decisions',
    params: scope,
    body: recordBody,
    summary: 'Enregistrer une réalisation, vérification ou validation tracée',
    handler: async ({ svc, s, params, body, req, ip }) =>
      new Pilotage(svc.grc).record(params.smsi, body.ref, body.decision, requireIfMatch(req), (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/pilotage/legacy/:key',
    params: scope.extend({ key: z.string().max(64) }),
    query: z.object({
      search: z.string().max(200).default(''),
      offset: z.coerce.number().int().min(0).max(1000000).default(0),
    }),
    summary: 'Registre historique paginé sans copie',
    handler: async ({ svc, s, params, query }) =>
      new Pilotage(svc.grc).legacy.list(params.smsi, params.key, (s as Session).user, query.search, query.offset),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/pilotage/legacy/:key/:id',
    params: scope.extend({ key: z.string().max(64), id: z.string().max(200) }),
    summary: 'Lire une fiche historique dans son format métier',
    handler: async ({ svc, s, params }) =>
      (await new Pilotage(svc.grc).legacy.get(params.smsi, params.key, params.id, (s as Session).user)).object,
  }),
  route({
    ...base,
    method: 'PUT',
    url: '/api/grc/:smsi/pilotage/legacy/:key/:id',
    params: scope.extend({ key: z.string().max(64), id: z.string().max(200) }),
    body: z
      .object({
        name: z.string().trim().min(1).max(200),
        data: z.record(z.string(), z.unknown()),
        sourceSha: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    summary: 'Modifier la source historique en préservant les champs non modélisés',
    handler: async ({ svc, s, params, body, req, ip }) =>
      new Pilotage(svc.grc).legacy.update(
        params.smsi,
        params.key,
        params.id,
        body,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/pilotage/findings',
    params: scope,
    body: z.object({ name: z.string().trim().min(1).max(200), data: z.record(z.string(), z.unknown()) }).strict(),
    summary: 'Ajouter un constat dans le registre existant des écarts',
    handler: async ({ svc, s, params, body, ip }) =>
      new Pilotage(svc.grc).createFinding(params.smsi, body.name, body.data, (s as Session).user, ip),
  }),
  route({
    ...base,
    method: 'POST',
    url: '/api/grc/:smsi/pilotage/controls/:id/schedule',
    params: scope.extend({ id: z.uuid() }),
    body: z.object({ recurrence: Recurrence }).strict(),
    summary: 'Planifier un contrôle via le moteur partagé de récurrences',
    handler: async ({ svc, s, params, body, req, ip }) =>
      new Pilotage(svc.grc).schedule(
        params.smsi,
        'object:' + params.id,
        body.recurrence,
        requireIfMatch(req),
        (s as Session).user,
        ip,
      ),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/pilotage/journeys/:id',
    params: scope.extend({ id: z.uuid() }),
    summary: 'Reprendre un parcours guidé avec critères et validations historisées',
    handler: async ({ svc, s, params }) => new Pilotage(svc.grc).journey(params.smsi, params.id, (s as Session).user),
  }),
  route({
    ...base,
    method: 'GET',
    url: '/api/grc/:smsi/pilotage/improvement-indicators',
    params: scope,
    summary: 'Indicateurs d’amélioration basés sur les dates et données disponibles',
    handler: async ({ svc, s, params }) => new Pilotage(svc.grc).indicators(params.smsi, (s as Session).user),
  }),
];
