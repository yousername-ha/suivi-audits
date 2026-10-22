/* Administration : sessions, journal d'audit, versions de l'état legacy, système (droits : routes/access.ts). */
import {
  BackupsOut,
  BackupJobOut,
  BackupRequestIn,
  FonctionBody,
  OrdreTypesProcessus,
  SystemeOut,
  TypeProcessusBody,
  TypeProcessusPatch,
} from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { DUREE_DEBUG_MAX_MINUTES } from '../journal-technique.js';
import { NIVEAUX_TECHNIQUES } from '../log.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { csvCell } from '../export/tabular.js';
import { assertLegacyKeys } from '../rights.js';
import { systemStatus } from '../systeme.js';
import { requireIfMatch } from '../http/concurrency.js';

export const adminRoutes = [
  /* ---------------------------------------------------------------- Fonctions (annuaire de responsables) */
  route({
    method: 'GET',
    url: '/api/admin/fonctions',
    summary: 'Fonctions de l’organisation et leurs titulaires',
    tags: ['Administration'],
    access: 'administration:lire',
    handler: async ({ svc }) => svc.grc.annuaires.lister(),
  }),
  route({
    method: 'POST',
    url: '/api/admin/fonctions',
    summary: 'Créer une fonction',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: FonctionBody,
    status: 201,
    handler: async ({ svc, s, body, ip }) => svc.grc.annuaires.creer(body, (s as Session).user, ip),
  }),
  route({
    method: 'PUT',
    url: '/api/admin/fonctions/:id',
    summary: 'Modifier une fonction et ses titulaires',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: z.object({ id: z.uuid() }),
    body: FonctionBody,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.grc.annuaires.modifier(params.id, body, (s as Session).user, ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/fonctions/:id',
    summary: 'Archiver une fonction (les fiches qui la désignent restent lisibles)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: z.object({ id: z.uuid() }),
    handler: async ({ svc, s, params, ip }) => {
      await svc.grc.annuaires.archiver(params.id, (s as Session).user, ip);
    },
  }),
  /* ---------------------------------------------------------------- Sessions */
  route({
    method: 'GET',
    url: '/api/admin/sessions',
    summary: 'Sessions ouvertes (tous les comptes)',
    tags: ['Administration'],
    access: 'administration:lire',
    handler: async ({ svc, s }) => {
      const r = await svc.db.q<{ id: string }>(
        `SELECT encode(s.id_hash,'hex') AS id, u.username, s.ip::text, s.user_agent, s.mfa_ok, s.created_at, s.last_seen_at
           FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at > now() ORDER BY s.last_seen_at DESC`,
      );
      return r.rows.map((x) => ({ ...x, current: x.id === (s as Session).sid.toString('hex') }));
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/sessions/:id',
    summary: 'Fermeture d’une session',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: z.object({ id: z.string().regex(/^[0-9a-f]{64}$/) }),
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      await svc.db.tx(
        (c) => c.query("DELETE FROM sessions WHERE id_hash = decode($1,'hex')", [params.id]),
        sess.user.username,
      );
      await svc.db.audit(sess.user, ip, 'admin.session_revoke', params.id.slice(0, 12));
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Journal d'audit */
  route({
    method: 'GET',
    url: '/api/admin/audit',
    summary:
      'Journal d’audit (en ajout seul) : recherche, période, compte, pagination ; format=csv ou format=json&export=1 pour l’export (droit d’exportation, tracé)',
    tags: ['Administration'],
    access: 'administration:lire',
    query: z.object({
      q: z.string().max(200).optional(),
      before: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().min(1).max(5000).optional(),
      format: z.enum(['json', 'csv']).optional(),
      /** json + export=1 : fichier téléchargeable, réservé au droit d'exportation (la liste affichée n'exige que la lecture). */
      export: z.enum(['1']).optional(),
      /** Période (jours calendaires UTC, bornes incluses) et compte. */
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      user: z.string().trim().max(100).optional(),
    }),
    handler: async ({ svc, s, ip, query, reply }) => {
      const where: string[] = [];
      const args: unknown[] = [];
      if (query.from) {
        args.push(query.from);
        where.push(`ts >= $${args.length}::date`);
      }
      if (query.to) {
        args.push(query.to);
        where.push(`ts < ($${args.length}::date + 1)`);
      }
      if (query.user) {
        args.push(query.user);
        where.push(`username = $${args.length}`);
      }
      if (query.before) {
        args.push(query.before);
        where.push(`id < $${args.length}`);
      }
      if (query.q) {
        args.push('%' + query.q.replace(/[\\%_]/g, '\\$&') + '%');
        const n = `$${args.length}`;
        where.push(`(username ILIKE ${n} OR action ILIKE ${n} OR target ILIKE ${n} OR ip::text ILIKE ${n})`);
      }
      const limit = query.limit ?? (query.format === 'csv' ? 5000 : 200);
      const r = await svc.db.q<Record<string, unknown>>(
        `SELECT id, ts, username, ip::text, action, target, details FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limit}`,
        args,
      );
      // Troncature signalée : la page est pleine, il reste des entrées plus anciennes (pagination par `before`, ou période à resserrer).
      const tronque = r.rowCount === limit;
      if (tronque) reply.header('X-Journal-Tronque', '1');
      const exportJson = query.format === 'json' && query.export === '1';
      if (query.format !== 'csv' && !exportJson) return r.rows;
      svc.auth.requirePermission(s, 'administration:exporter');
      await svc.db.audit((s as Session).user, ip, 'admin.audit_export', '', {
        rows: r.rowCount,
        format: exportJson ? 'json' : 'csv',
        truncated: tronque,
        filters: { from: query.from ?? null, to: query.to ?? null, user: query.user ?? null, q: query.q ?? null },
      });
      if (exportJson) {
        reply
          .header('Content-Type', 'application/json; charset=utf-8')
          .header(
            'Content-Disposition',
            `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.json"`,
          )
          .header('Cache-Control', 'no-store');
        return reply.send(JSON.stringify(r.rows));
      }
      const cols = ['id', 'ts', 'username', 'ip', 'action', 'target', 'details'];
      const body =
        '﻿' +
        [
          cols.join(';'),
          ...r.rows.map((x) => cols.map((c) => csvCell(c === 'ts' ? (x[c] as Date).toISOString() : x[c])).join(';')),
        ].join('\r\n');
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header(
          'Content-Disposition',
          `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        )
        .header('Cache-Control', 'no-store');
      return reply.send(body);
    },
  }),

  /* ---------------------------------------------------------------- Types de processus */
  route({
    method: 'GET',
    url: '/api/types-processus',
    summary: 'Registre des types de processus (libellés et teintes : lisible par toute personne connectée)',
    tags: ['Administration'],
    access: 'auth',
    handler: async ({ svc }) => svc.typesProcessus.lister(),
  }),
  route({
    method: 'POST',
    url: '/api/types-processus',
    summary: 'Créer un type de processus (le code se déduit du libellé et ne change plus)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: TypeProcessusBody,
    status: 201,
    handler: async ({ svc, s, ip, body }) => svc.typesProcessus.creer(body, (s as Session).user, ip),
  }),
  route({
    method: 'PUT',
    url: '/api/types-processus/ordre',
    summary: 'Ordre d’affichage des types de processus (liste complète des identifiants)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: OrdreTypesProcessus,
    handler: async ({ svc, s, ip, body }) => svc.typesProcessus.ordonner(body.ids, (s as Session).user, ip),
  }),
  route({
    method: 'PUT',
    url: '/api/types-processus/:id',
    summary: 'Modifier ou archiver un type de processus',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: z.object({ id: z.uuid() }),
    body: TypeProcessusPatch,
    handler: async ({ svc, s, ip, params, body }) =>
      svc.typesProcessus.modifier(params.id, body, (s as Session).user, ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/types-processus/:id',
    summary: 'Supprimer un type de processus qu’aucun processus ne porte',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: z.object({ id: z.uuid() }),
    handler: async ({ svc, s, ip, params }) => {
      await svc.typesProcessus.supprimer(params.id, (s as Session).user, ip);
    },
  }),

  /* ---------------------------------------------------------------- Journaux techniques */
  route({
    method: 'GET',
    url: '/api/admin/journaux-techniques',
    summary:
      'Journaux techniques du serveur : état du niveau et dernières entrées (niveau minimal, recherche, pagination) ; format=ndjson&export=1 pour le téléchargement (droit d’exportation, tracé)',
    tags: ['Administration'],
    access: 'administration:lire',
    query: z.object({
      niveau: z.enum(NIVEAUX_TECHNIQUES).optional(),
      q: z.string().trim().max(200).optional(),
      avant: z.coerce.number().int().positive().optional(),
      limite: z.coerce.number().int().min(1).max(5000).optional(),
      format: z.enum(['json', 'ndjson']).optional(),
      export: z.enum(['1']).optional(),
    }),
    handler: async ({ svc, s, ip, query, reply }) => {
      const exporter = query.format === 'ndjson' && query.export === '1';
      const { entrees, reste } = svc.journalTechnique.lire({
        niveauMin: query.niveau,
        q: query.q,
        avant: query.avant,
        limite: query.limite ?? (exporter ? 5000 : 200),
      });
      if (!exporter) return { etat: svc.journalTechnique.etat(), entrees, reste };
      svc.auth.requirePermission(s, 'administration:exporter');
      await svc.db.audit((s as Session).user, ip, 'admin.journal_technique_export', '', {
        rows: entrees.length,
        truncated: reste,
        filters: { niveau: query.niveau ?? null, q: query.q ?? null },
      });
      reply
        .header('Content-Type', 'application/x-ndjson; charset=utf-8')
        .header(
          'Content-Disposition',
          `attachment; filename="journaux-techniques-${new Date().toISOString().slice(0, 10)}.ndjson"`,
        )
        .header('Cache-Control', 'no-store');
      if (reste) reply.header('X-Journal-Tronque', '1');
      // Ordre chronologique dans le fichier : les plus anciennes entrées d'abord.
      return reply.send(
        [...entrees]
          .reverse()
          .map((e) => JSON.stringify(e))
          .join('\n') + '\n',
      );
    },
  }),
  route({
    method: 'PUT',
    url: '/api/admin/journaux-techniques/niveau',
    summary:
      'Niveau de journalisation du serveur : warn ou info (permanents), debug (temporaire, 24 heures au plus). Les erreurs sont toujours collectées ; le journal d’audit est indépendant',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: z
      .object({
        niveau: z.enum(['debug', 'info', 'warn']),
        dureeMinutes: z.number().int().min(5).max(DUREE_DEBUG_MAX_MINUTES).optional(),
        reason: z.string().trim().max(500).default(''),
        confirm: z.literal('APPLIQUER'),
      })
      .strict(),
    handler: async ({ svc, s, ip, body }) =>
      svc.journalTechnique.modifier(body.niveau, body.dureeMinutes, body.reason, (s as Session).user, ip),
  }),

  /* ---------------------------------------------------------------- Versions de l'état legacy */
  route({
    method: 'GET',
    url: '/api/admin/versions',
    summary: 'Historique des versions de l’état de l’outil historique',
    tags: ['Administration'],
    access: 'administration:lire',
    handler: async ({ svc }) =>
      (
        await svc.db.q(
          `SELECT version, updated_at, updated_by, note, sha256, import_batch_id, pg_column_size(data) AS bytes,
                  jsonb_array_length(COALESCE(data->'items','[]')) AS items
             FROM state_history ORDER BY version DESC LIMIT 500`,
        )
      ).rows,
  }),
  route({
    method: 'GET',
    url: '/api/admin/versions/:v',
    summary: 'Téléchargement d’une version (JSON ; droit d’exporter chacun des modules qu’elle contient)',
    tags: ['Administration'],
    access: 'administration:exporter',
    params: z.object({ v: z.coerce.number().int().positive() }),
    handler: async ({ svc, s, params, reply }) => {
      const r = await svc.db.one<{ data: string; keys: string[] }>(
        'SELECT data::text AS data, ARRAY(SELECT jsonb_object_keys(data)) AS keys FROM state_history WHERE version=$1',
        [params.v],
      );
      if (!r) throw new HttpError(404, 'Version introuvable.');
      assertLegacyKeys((s as Session).user.rights, r.keys, 'exporter');
      reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .header('Content-Disposition', `attachment; filename="suivi-audits-v${params.v}.json"`);
      return reply.send(r.data);
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/versions/:v/restore',
    summary: 'Restauration d’une version (crée une nouvelle version)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: z.object({ v: z.coerce.number().int().positive() }),
    response: z.object({ version: z.number() }),
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const out = await svc.db.tx(async (c) => {
        const r = (await c.query('SELECT data FROM state_history WHERE version=$1', [params.v])).rows[0];
        if (!r) throw new HttpError(404, 'Version introuvable.');
        assertLegacyKeys(sess.user.rights, Object.keys(r.data as object), 'modifier');
        const res = await svc.legacy.nativeWrite(c, r.data, sess.user, null, `Restauration de la version ${params.v}`);
        return res.conflict ? res.version : res.version;
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'admin.state_restore', `v${params.v}`, { newVersion: out });
      return { version: out };
    },
  }),

  /* A1a : demandes uniquement ; aucune route d'exécution ou accès au système hôte. */
  route({
    method: 'GET',
    url: '/api/admin/sauvegardes',
    summary: 'Exécutant et historique des demandes de sauvegarde',
    tags: ['Administration'],
    access: 'administration:lire',
    response: BackupsOut,
    handler: async ({ svc }) => svc.backups.list(),
  }),
  route({
    method: 'POST',
    url: '/api/admin/sauvegardes',
    summary: 'Demander une sauvegarde chiffrée complète',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: BackupRequestIn,
    response: BackupJobOut,
    status: 202,
    handler: async ({ svc, s, ip, body }) => svc.backups.request(body.requestId, s!.user, ip),
  }),
  route({
    method: 'POST',
    url: '/api/admin/sauvegardes/:id/annuler',
    summary: 'Annuler une demande en attente (If-Match)',
    tags: ['Administration'],
    access: 'administration:administrer',
    body: z.object({}).strict(),
    params: z.object({ id: z.string().uuid() }),
    response: BackupJobOut,
    handler: async ({ svc, s, ip, params, req }) => svc.backups.cancel(params.id, requireIfMatch(req), s!.user, ip),
  }),
  /* ---------------------------------------------------------------- Système */
  route({
    method: 'GET',
    url: '/api/admin/systeme',
    summary:
      'Exploitation : version, mises à jour, dernière sauvegarde, espace disque, nouvelle version disponible (lecture seule)',
    tags: ['Administration'],
    access: 'administration:lire',
    response: SystemeOut,
    handler: async ({ svc }) => ({
      ...systemStatus(svc.cfg),
      migrations: (
        await svc.db.q<{ name: string; applied_at: Date }>(
          'SELECT name, applied_at FROM schema_migrations ORDER BY name DESC',
        )
      ).rows.map((r) => ({ name: r.name, applied_at: new Date(r.applied_at).toISOString() })),
    }),
  }),
  route({
    method: 'GET',
    url: '/api/admin/info',
    summary: 'Informations système',
    tags: ['Administration'],
    access: 'administration:lire',
    handler: async ({ svc }) => {
      const pg = await svc.db.one<{ server_version: string }>('SHOW server_version');
      const size = await svc.db.one<{ s: string }>('SELECT pg_size_pretty(pg_database_size(current_database())) AS s');
      const st = await svc.db.one('SELECT version, updated_at, updated_by FROM app_state WHERE id=1');
      // Volume des pièces (taille en clair des versions de documents, corbeille comprise) : la base est la seule source des fichiers.
      const pieces = await svc.db.one<{ octets: string }>(
        'SELECT COALESCE(sum(size),0)::text AS octets FROM document_versions',
      );
      const counts = await svc.db.one(`SELECT (SELECT count(*) FROM users)::int AS users,
        (SELECT count(*) FROM documents WHERE deleted_at IS NULL)::int AS documents,
        (SELECT count(*) FROM links WHERE deleted_at IS NULL)::int AS links,
        (SELECT count(*) FROM state_history)::int AS versions,
        (SELECT count(*) FROM audit_log)::int AS audit,
        (SELECT count(*) FROM import_batches)::int AS imports`);
      const migrations = (
        await svc.db.q<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')
      ).rows.map((r) => r.name);
      const c = svc.cfg;
      return {
        app: c.version,
        node: process.version,
        postgres: pg?.server_version,
        dbSize: size?.s,
        documentsBytes: Number(pieces?.octets ?? 0),
        /** Date du relevé : ces chiffres sont lus à la demande, ils ne sont pas mis en cache. */
        measuredAt: new Date().toISOString(),
        state: st,
        counts,
        migrations,
        keyId: svc.vault.keyId,
        clamav: c.clamav
          ? `${c.clamav.host}:${c.clamav.port}${c.clamav.required ? ' (obligatoire)' : ''}`
          : 'désactivé',
        mfaRequired: c.mfaRequired,
        session: c.session,
        maxUploadMb: c.maxUploadMb,
        realtime: svc.bus.connected ? 'connecté' : 'déconnecté',
        legacyTakenOver: svc.legacy.takenOver(),
      };
    },
  }),
];
