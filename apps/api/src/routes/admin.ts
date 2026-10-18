/* Administration : sessions, journal d'audit, versions de l'état legacy, système (droits : routes/access.ts). */
import { BackupsOut, BackupJobOut, BackupRequestIn, SystemeOut } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { csvCell } from '../export/tabular.js';
import { assertLegacyKeys } from '../rights.js';
import { systemStatus } from '../systeme.js';
import { requireIfMatch } from '../http/concurrency.js';

export const adminRoutes = [
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
    summary: 'Journal d’audit (en ajout seul), recherche et pagination ; format=csv pour l’export',
    tags: ['Administration'],
    access: 'administration:lire',
    query: z.object({
      q: z.string().max(200).optional(),
      before: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().min(1).max(5000).optional(),
      format: z.enum(['json', 'csv']).optional(),
    }),
    handler: async ({ svc, s, ip, query, reply }) => {
      const where: string[] = [];
      const args: unknown[] = [];
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
      if (query.format !== 'csv') return r.rows;
      svc.auth.requirePermission(s, 'administration:exporter');
      await svc.db.audit((s as Session).user, ip, 'admin.audit_export', '', { rows: r.rowCount });
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
                  jsonb_array_length(COALESCE(data->'items','[]')) AS items, jsonb_array_length(COALESCE(data->'findings','[]')) AS findings
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
