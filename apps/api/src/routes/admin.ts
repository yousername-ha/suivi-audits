/* Administration : comptes, sessions, journal d'audit, versions de l'état legacy, système. */
import { TempPasswordOut, UserCreateBody, UserOut, UserPatchBody, Uuid } from '@suivi/shared';
import { z } from 'zod';
import type { Session } from '../auth.js';
import type { Client } from '../db/db.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { hashPassword, tempPassword } from '../security/crypto.js';
import type { Services } from '../services.js';

const IdParams = z.object({ id: Uuid });
const USER_COLS = `id, username, display_name, email, role, disabled, totp_enabled, must_change_password, failed_logins, locked_until,
  last_login_at, created_at, version,
  (SELECT count(*) FROM sessions s WHERE s.user_id = users.id AND s.expires_at > now())::int AS sessions`;

async function userById(c: Client | Services['db']['pool'], id: string) {
  return (await c.query<z.infer<typeof UserOut>>(`SELECT ${USER_COLS} FROM users WHERE id=$1`, [id])).rows[0] ?? null;
}

/** Refuse toute modification qui laisserait l'application sans administrateur actif. */
async function lastAdminGuard(c: Client, id: string, change: { role?: string; disabled?: boolean; delete?: boolean }) {
  const u = (await c.query<{ role: string; disabled: boolean }>('SELECT role, disabled FROM users WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!u) throw new HttpError(404, 'Compte introuvable.');
  const stillAdmin = change.delete ? false : (change.role || u.role) === 'admin' && !(change.disabled ?? u.disabled);
  if (u.role === 'admin' && !u.disabled && !stillAdmin) {
    const n = (await c.query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE role='admin' AND NOT disabled")).rows[0]!.n;
    if (n <= 1) throw new HttpError(409, 'Impossible : ce compte est le dernier administrateur actif.');
  }
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Neutralise les formules à l'ouverture dans un tableur (injection CSV).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const adminRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/users',
    summary: 'Comptes',
    tags: ['Administration'],
    access: 'admin',
    response: z.array(UserOut),
    handler: async ({ svc }) => (await svc.db.q(`SELECT ${USER_COLS} FROM users ORDER BY lower(username)`)).rows,
  }),
  route({
    method: 'POST',
    url: '/api/admin/users',
    summary: 'Création d’un compte (mot de passe temporaire affiché une seule fois)',
    tags: ['Administration'],
    access: 'admin',
    body: UserCreateBody,
    status: 201,
    response: TempPasswordOut.extend({ id: z.string() }),
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const pw = tempPassword();
      const hash = await hashPassword(pw);
      const u = await svc.db
        .tx(
          async (c) =>
            (
              await c.query<{ id: string }>(
                'INSERT INTO users(username, display_name, email, role, password_hash, must_change_password) VALUES ($1,$2,$3,$4,$5,true) RETURNING id',
                [body.username, body.displayName || body.username, body.email || '', body.role, hash],
              )
            ).rows[0]!,
          sess.user.username,
        )
        .catch((e: { code?: string }) => {
          if (e.code === '23505') throw new HttpError(409, 'Cet identifiant existe déjà.');
          throw e;
        });
      await svc.db.audit(sess.user, ip, 'admin.user_create', body.username, { role: body.role });
      return { id: u.id, temporaryPassword: pw };
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/users/:id',
    summary: 'Un compte (ETag = version)',
    tags: ['Administration'],
    access: 'admin',
    params: IdParams,
    response: UserOut,
    handler: async ({ svc, params, reply }) => {
      const u = await userById(svc.db.pool, params.id);
      if (!u) throw new HttpError(404, 'Compte introuvable.');
      setEtag(reply, u.version);
      return u;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/admin/users/:id',
    summary: 'Modification d’un compte (If-Match obligatoire)',
    tags: ['Administration'],
    access: 'admin',
    params: IdParams,
    body: UserPatchBody,
    response: UserOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const expected = requireIfMatch(req);
      const m: Record<string, unknown> = {};
      if (body.displayName !== undefined) m.display_name = body.displayName;
      if (body.email !== undefined) m.email = body.email;
      if (body.role !== undefined) m.role = body.role;
      if (body.disabled !== undefined) m.disabled = body.disabled;
      if (body.unlock) {
        m.failed_logins = 0;
        m.locked_until = null;
      }
      const out = await svc.db.tx(async (c) => {
        const cur = await userById(c, params.id);
        if (!cur) throw new HttpError(404, 'Compte introuvable.');
        if (cur.version !== expected) throw conflict(cur as unknown as { version: number });
        await lastAdminGuard(c, params.id, { role: body.role, disabled: body.disabled });
        const keys = Object.keys(m);
        if (!keys.length) return cur;
        await c.query(`UPDATE users SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(', ')}, version = version + 1, updated_at=now() WHERE id=$1`, [
          params.id,
          ...keys.map((k) => m[k]),
        ]);
        if (body.disabled || (body.role && body.role !== cur.role)) await svc.auth.destroyUserSessions(params.id, null, c);
        return (await userById(c, params.id))!;
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'admin.user_update', params.id, { ...m, version: out.version });
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/users/:id/reset-password',
    summary: 'Mot de passe temporaire (changement imposé à la connexion)',
    tags: ['Administration'],
    access: 'admin',
    params: IdParams,
    response: TempPasswordOut,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const pw = tempPassword();
      const hash = await hashPassword(pw);
      await svc.db.tx(async (c) => {
        const r = await c.query(
          'UPDATE users SET password_hash=$2, must_change_password=true, failed_logins=0, locked_until=NULL, version = version + 1, updated_at=now() WHERE id=$1',
          [params.id, hash],
        );
        if (!r.rowCount) throw new HttpError(404, 'Compte introuvable.');
        await svc.auth.destroyUserSessions(params.id, null, c);
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'admin.user_password_reset', params.id);
      return { temporaryPassword: pw };
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/users/:id/reset-mfa',
    summary: 'Réinitialisation de la double authentification (téléphone perdu)',
    tags: ['Administration'],
    access: 'admin',
    params: IdParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      await svc.db.tx(async (c) => {
        const r = await c.query(
          'UPDATE users SET totp_secret=NULL, totp_pending=NULL, totp_enabled=false, version = version + 1, updated_at=now() WHERE id=$1',
          [params.id],
        );
        if (!r.rowCount) throw new HttpError(404, 'Compte introuvable.');
        await svc.auth.destroyUserSessions(params.id, null, c);
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'admin.user_mfa_reset', params.id);
      return undefined;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/users/:id',
    summary: 'Suppression d’un compte',
    tags: ['Administration'],
    access: 'admin',
    params: IdParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      if (params.id === sess.user.id) throw new HttpError(409, 'Vous ne pouvez pas supprimer votre propre compte.');
      const name = await svc.db.tx(async (c) => {
        await lastAdminGuard(c, params.id, { delete: true });
        return (await c.query<{ username: string }>('DELETE FROM users WHERE id=$1 RETURNING username', [params.id])).rows[0]?.username;
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'admin.user_delete', name ?? params.id);
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Sessions */
  route({
    method: 'GET',
    url: '/api/admin/sessions',
    summary: 'Sessions ouvertes (tous les comptes)',
    tags: ['Administration'],
    access: 'admin',
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
    access: 'admin',
    params: z.object({ id: z.string().regex(/^[0-9a-f]{64}$/) }),
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      await svc.db.tx((c) => c.query("DELETE FROM sessions WHERE id_hash = decode($1,'hex')", [params.id]), sess.user.username);
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
    access: 'admin',
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
      await svc.db.audit((s as Session).user, ip, 'admin.audit_export', '', { rows: r.rowCount });
      const cols = ['id', 'ts', 'username', 'ip', 'action', 'target', 'details'];
      const body = '﻿' + [cols.join(';'), ...r.rows.map((x) => cols.map((c) => csvCell(c === 'ts' ? (x[c] as Date).toISOString() : x[c])).join(';'))].join('\r\n');
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.csv"`)
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
    access: 'admin',
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
    summary: 'Téléchargement d’une version (JSON)',
    tags: ['Administration'],
    access: 'admin',
    params: z.object({ v: z.coerce.number().int().positive() }),
    handler: async ({ svc, params, reply }) => {
      const r = await svc.db.one<{ data: string }>('SELECT data::text AS data FROM state_history WHERE version=$1', [params.v]);
      if (!r) throw new HttpError(404, 'Version introuvable.');
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
    access: 'admin',
    params: z.object({ v: z.coerce.number().int().positive() }),
    response: z.object({ version: z.number() }),
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const out = await svc.db.tx(async (c) => {
        const r = (await c.query('SELECT data FROM state_history WHERE version=$1', [params.v])).rows[0];
        if (!r) throw new HttpError(404, 'Version introuvable.');
        const res = await svc.legacy.save(c, r.data, sess.user, null, `Restauration de la version ${params.v}`);
        return res.conflict ? res.version : res.version;
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'admin.state_restore', `v${params.v}`, { newVersion: out });
      return { version: out };
    },
  }),

  /* ---------------------------------------------------------------- Système */
  route({
    method: 'GET',
    url: '/api/admin/info',
    summary: 'Informations système',
    tags: ['Administration'],
    access: 'admin',
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
      const migrations = (await svc.db.q<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')).rows.map((r) => r.name);
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
        clamav: c.clamav ? `${c.clamav.host}:${c.clamav.port}${c.clamav.required ? ' (obligatoire)' : ''}` : 'désactivé',
        mfaRequired: c.mfaRequired,
        session: c.session,
        maxUploadMb: c.maxUploadMb,
        realtime: svc.bus.connected ? 'connecté' : 'déconnecté',
        legacyTakenOver: svc.legacy.takenOver(),
      };
    },
  }),
];
