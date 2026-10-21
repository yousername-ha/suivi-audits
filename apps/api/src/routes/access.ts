/* Administration des droits (RBAC) : comptes, groupes, rôles, droits effectifs, revue des accès (ISO 27001 A.5.18).
   Garde-fous : dernier administrateur, interdiction de modifier ses propres droits, journal avant/après,
   coupure des sessions concernées, rôle Auditeur externe avec portée et date d'expiration. */
import {
  ACTIONS,
  ALL_PERMISSIONS,
  AUDITOR_MODULES,
  EffectiveRightsOut,
  effectivePermissions,
  GroupBody,
  GroupOut,
  GroupPatchBody,
  isSystemRole,
  MODULES,
  RoleCreateBody,
  RoleOut,
  RolePatchBody,
  SYSTEM_ROLE_DEFS,
  TempPasswordOut,
  UserCreateBody,
  UserOut,
  UserPatchBody,
  Uuid,
  type RoleAssignment,
} from '@suivi/shared';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Session } from '../auth.js';
import type { Client } from '../db/db.js';
import { csvCell, xlsx } from '../export/tabular.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import {
  assertAdminRemains,
  assertNotSelf,
  assertScopedRoles,
  loadGrants,
  rightsSnapshot,
  rolePermissions,
  usersOfRole,
} from '../rights.js';
import { hashPassword, tempPassword } from '../security/crypto.js';
import type { Services } from '../services.js';

type Q = Pick<Client, 'query'>;
const IdParams = z.object({ id: Uuid });
const RoleParams = z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/) });

/* ---------------------------------------------------------------- Lectures */
const USER_COLS = `u.id, u.username, u.display_name, u.email, u.disabled, u.expires_at, u.totp_enabled,
  u.must_change_password, u.failed_logins, u.locked_until, u.last_login_at, u.created_at, u.version,
  (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now())::int AS sessions,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'modules', ur.modules) ORDER BY r.name)
     FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '[]') AS roles,
  COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name)
     FROM user_groups ug JOIN groups g ON g.id = ug.group_id WHERE ug.user_id = u.id), '[]') AS groups`;

async function userById(c: Q, id: string): Promise<UserOut | null> {
  return (await c.query<UserOut>(`SELECT ${USER_COLS} FROM users u WHERE u.id = $1`, [id])).rows[0] ?? null;
}

const GROUP_COLS = `g.id, g.name, g.description, g.version,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'name', r.name) ORDER BY r.name)
     FROM group_roles gr JOIN roles r ON r.id = gr.role_id WHERE gr.group_id = g.id), '[]') AS roles,
  COALESCE((SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name)
     ORDER BY lower(u.username)) FROM user_groups ug JOIN users u ON u.id = ug.user_id WHERE ug.group_id = g.id), '[]') AS members`;

async function groupById(c: Q, id: string): Promise<GroupOut | null> {
  return (await c.query<GroupOut>(`SELECT ${GROUP_COLS} FROM groups g WHERE g.id = $1`, [id])).rows[0] ?? null;
}

interface RoleRow {
  id: string;
  name: string;
  description: string;
  system: boolean;
  based_on: string | null;
  permissions: string[];
  version: number;
  users: number;
  groups: number;
}
const roleOut = (r: RoleRow): RoleOut => ({
  ...r,
  scoped: isSystemRole(r.id) ? !!SYSTEM_ROLE_DEFS[r.id].scoped : false,
  permissions: rolePermissions(r.id, r.permissions),
});
async function roleById(c: Q, id: string): Promise<RoleOut | null> {
  const r = await c.query<RoleRow>(
    `SELECT r.id, r.name, r.description, r.system, r.based_on, r.permissions, r.version,
            (SELECT count(*) FROM user_roles ur WHERE ur.role_id = r.id)::int AS users,
            (SELECT count(*) FROM group_roles gr WHERE gr.role_id = r.id)::int AS groups
       FROM roles r WHERE r.id = $1`,
    [id],
  );
  return r.rows[0] ? roleOut(r.rows[0]) : null;
}

/* ---------------------------------------------------------------- Écritures */
/** Remplace les rôles directs d'un compte (portée « modules » conservée seulement pour un rôle à portée). */
async function setUserRoles(c: Q, userId: string, roles: readonly RoleAssignment[]) {
  const ids = [...new Set(roles.map((r) => r.roleId))];
  const known = await c.query<{ id: string }>('SELECT id FROM roles WHERE id = ANY($1::text[])', [ids]);
  if (known.rowCount !== ids.length) throw new HttpError(422, 'Rôle inconnu.');
  await c.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  for (const id of ids) {
    const a = roles.find((r) => r.roleId === id)!;
    const scoped = isSystemRole(id) && SYSTEM_ROLE_DEFS[id].scoped;
    const modules = scoped ? [...new Set(a.modules ?? [])].filter((m) => AUDITOR_MODULES.includes(m)) : null;
    await c.query('INSERT INTO user_roles(user_id, role_id, modules) VALUES ($1, $2, $3)', [userId, id, modules]);
  }
}
async function setUserGroups(c: Q, userId: string, groups: readonly string[]) {
  const ids = [...new Set(groups)];
  const known = await c.query('SELECT id FROM groups WHERE id = ANY($1::uuid[])', [ids]);
  if (known.rowCount !== ids.length) throw new HttpError(422, 'Groupe inconnu.');
  await c.query('DELETE FROM user_groups WHERE user_id = $1', [userId]);
  for (const g of ids) await c.query('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [userId, g]);
}

/** Coupe les sessions des comptes dont les droits ont changé (sauf l'acteur, qui ne peut pas être concerné). */
async function cutSessions(c: Q, userIds: readonly string[]) {
  if (userIds.length) await c.query('DELETE FROM sessions WHERE user_id = ANY($1::uuid[])', [userIds]);
}

const expiresValue = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59Z` : v;

/* ---------------------------------------------------------------- Revue des accès */
interface ReviewRow {
  username: string;
  display_name: string;
  email: string;
  disabled: boolean;
  expires_at: Date | null;
  last_login_at: Date | null;
  totp_enabled: boolean;
  id: string;
}
async function accessReview(svc: Services) {
  const users = (
    await svc.db.q<ReviewRow>(
      'SELECT id, username, display_name, email, disabled, expires_at, last_login_at, totp_enabled FROM users ORDER BY lower(username)',
    )
  ).rows;
  const out: string[][] = [];
  for (const u of users) {
    const grants = await loadGrants(svc.db.pool, u.id);
    const eff = effectivePermissions(grants);
    const groups = [...new Set(grants.flatMap((g) => (g.via.kind === 'group' ? [g.via.groupName] : [])))];
    const direct = grants
      .filter((g) => g.via.kind === 'direct')
      .map((g) => (g.modules ? `${g.roleName} (${g.modules.join(', ')})` : g.roleName));
    const viaGroups = grants
      .filter((g) => g.via.kind === 'group')
      .map((g) => `${g.roleName} [${(g.via as { groupName: string }).groupName}]`);
    out.push([
      u.username,
      u.display_name,
      u.email,
      u.disabled ? 'Désactivé' : u.expires_at && new Date(u.expires_at) <= new Date() ? 'Expiré' : 'Actif',
      u.totp_enabled ? 'Oui' : 'Non',
      groups.join(', '),
      [...direct, ...viaGroups].join(', '),
      [...eff.keys()].join(' '),
      u.last_login_at ? new Date(u.last_login_at).toISOString() : '',
      u.expires_at ? new Date(u.expires_at).toISOString().slice(0, 10) : '',
    ]);
  }
  return out;
}
const REVIEW_HEADERS = [
  'Identifiant',
  'Nom',
  'E-mail',
  'État',
  'Double authentification',
  'Groupes',
  'Rôles (directs et [groupe])',
  'Droits effectifs',
  'Dernière connexion',
  'Expiration',
];

/* ================================================================ Routes */
export const accessRoutes = [
  /* ---------------------------------------------------------------- Comptes */
  route({
    method: 'GET',
    url: '/api/admin/users',
    summary: 'Comptes, avec leurs rôles et groupes',
    tags: ['Droits'],
    access: 'administration:lire',
    response: z.array(UserOut),
    handler: async ({ svc }) => (await svc.db.q(`SELECT ${USER_COLS} FROM users u ORDER BY lower(u.username)`)).rows,
  }),
  route({
    method: 'POST',
    url: '/api/admin/users',
    summary: 'Création d’un compte (mot de passe temporaire affiché une seule fois)',
    tags: ['Droits'],
    access: 'administration:administrer',
    body: UserCreateBody,
    status: 201,
    response: TempPasswordOut.extend({ id: z.string() }),
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const pw = tempPassword();
      const hash = await hashPassword(pw);
      const { id, after } = await svc.db
        .tx(async (c) => {
          const u = (
            await c.query<{ id: string }>(
              `INSERT INTO users(username, display_name, email, password_hash, must_change_password, expires_at)
               VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
              [
                body.username,
                body.displayName || body.username,
                body.email || '',
                hash,
                expiresValue(body.expiresAt) ?? null,
              ],
            )
          ).rows[0]!;
          await setUserRoles(c, u.id, body.roles);
          await setUserGroups(c, u.id, body.groups);
          await assertScopedRoles(c, [u.id]);
          const after = await rightsSnapshot(c, [u.id]);
          await svc.db.audit(sess.user, ip, 'admin.user_create', body.username, { after }, c);
          return { id: u.id, after };
        }, sess.user.username)
        .catch((e: { code?: string }) => {
          if (e.code === '23505') throw new HttpError(409, 'Cet identifiant existe déjà.');
          throw e;
        });
      void after;
      return { id, temporaryPassword: pw };
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/users/:id',
    summary: 'Un compte (ETag = version)',
    tags: ['Droits'],
    access: 'administration:lire',
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
    summary: 'Modification d’un compte : identité, état, expiration, rôles, groupes (If-Match obligatoire)',
    tags: ['Droits'],
    access: 'administration:administrer',
    params: IdParams,
    body: UserPatchBody,
    response: UserOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const expected = requireIfMatch(req);
      const rightsChange =
        body.roles !== undefined ||
        body.groups !== undefined ||
        body.disabled !== undefined ||
        body.expiresAt !== undefined;
      if (rightsChange) assertNotSelf(sess.user.id, [params.id]);
      const m: Record<string, unknown> = {};
      if (body.displayName !== undefined) m.display_name = body.displayName;
      if (body.email !== undefined) m.email = body.email;
      if (body.disabled !== undefined) m.disabled = body.disabled;
      if (body.expiresAt !== undefined) m.expires_at = expiresValue(body.expiresAt);
      if (body.unlock) {
        m.failed_logins = 0;
        m.locked_until = null;
      }
      const { out } = await svc.db.tx(async (c) => {
        const cur = await userById(c, params.id);
        if (!cur) throw new HttpError(404, 'Compte introuvable.');
        if (cur.version !== expected) throw conflict(cur as unknown as { version: number });
        const before = rightsChange ? await rightsSnapshot(c, [params.id]) : null;
        const keys = Object.keys(m);
        if (keys.length || body.roles || body.groups)
          await c.query(
            `UPDATE users SET ${[...keys.map((k, i) => `${k}=$${i + 2}`), 'version = version + 1', 'updated_at = now()'].join(', ')} WHERE id=$1`,
            [params.id, ...keys.map((k) => m[k])],
          );
        if (body.roles) await setUserRoles(c, params.id, body.roles);
        if (body.groups) await setUserGroups(c, params.id, body.groups);
        if (rightsChange) {
          await assertScopedRoles(c, [params.id]);
          await assertAdminRemains(c);
          await cutSessions(c, [params.id]);
        }
        const out = (await userById(c, params.id))!;
        const after = rightsChange ? await rightsSnapshot(c, [params.id]) : null;
        await svc.db.audit(
          sess.user,
          ip,
          'admin.user_update',
          out.username,
          { changes: Object.keys(m), ...(rightsChange ? { before, after } : {}), version: out.version },
          c,
        );
        return { out };
      }, sess.user.username);
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/users/:id/reset-password',
    summary: 'Mot de passe temporaire (changement imposé à la connexion)',
    tags: ['Droits'],
    access: 'administration:administrer',
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
        await svc.db.audit(sess.user, ip, 'admin.user_password_reset', params.id, {}, c);
      }, sess.user.username);
      return { temporaryPassword: pw };
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/users/:id/reset-mfa',
    summary: 'Réinitialisation de la double authentification (téléphone perdu)',
    tags: ['Droits'],
    access: 'administration:administrer',
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
        await svc.db.audit(sess.user, ip, 'admin.user_mfa_reset', params.id, {}, c);
      }, sess.user.username);
      return undefined;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/users/:id',
    summary: 'Suppression d’un compte',
    tags: ['Droits'],
    access: 'administration:supprimer',
    params: IdParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      if (params.id === sess.user.id) throw new HttpError(409, 'Vous ne pouvez pas supprimer votre propre compte.');
      await svc.db.tx(async (c) => {
        const before = await rightsSnapshot(c, [params.id]);
        const r = await c.query<{ username: string }>('DELETE FROM users WHERE id=$1 RETURNING username', [params.id]);
        if (!r.rowCount) throw new HttpError(404, 'Compte introuvable.');
        await assertAdminRemains(c);
        await svc.db.audit(sess.user, ip, 'admin.user_delete', r.rows[0]!.username, { before, after: null }, c);
      }, sess.user.username);
      return undefined;
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/users/:id/rights',
    summary: 'Droits effectifs d’un compte, avec l’origine de chaque droit (rôle direct ou groupe)',
    tags: ['Droits'],
    access: 'administration:lire',
    params: IdParams,
    response: EffectiveRightsOut,
    handler: async ({ svc, params }) => {
      const u = await svc.db.one<{ id: string; username: string; display_name: string }>(
        'SELECT id, username, display_name FROM users WHERE id=$1',
        [params.id],
      );
      if (!u) throw new HttpError(404, 'Compte introuvable.');
      const eff = effectivePermissions(await loadGrants(svc.db.pool, u.id));
      return {
        user: u,
        permissions: ALL_PERMISSIONS.filter((p) => eff.has(p)).map((p) => ({ permission: p, origins: eff.get(p)! })),
      };
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/access-review',
    summary:
      'Revue des accès (ISO 27001 A.5.18) : comptes, groupes, rôles, droits effectifs, dernière connexion, expiration',
    tags: ['Droits'],
    access: 'administration:exporter',
    query: z.object({ format: z.enum(['csv', 'xlsx']).default('csv') }),
    handler: async ({ svc, s, ip, query, reply }) => {
      const rows = await accessReview(svc);
      const day = new Date().toISOString().slice(0, 10);
      await svc.db.audit((s as Session).user, ip, 'admin.access_review_export', query.format, { rows: rows.length });
      reply.header('Cache-Control', 'no-store');
      if (query.format === 'xlsx') {
        reply
          .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .header('Content-Disposition', `attachment; filename="revue-des-acces-${day}.xlsx"`);
        return reply.send(xlsx('Revue des accès', [REVIEW_HEADERS, ...rows]));
      }
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="revue-des-acces-${day}.csv"`);
      return reply.send('﻿' + [REVIEW_HEADERS, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n'));
    },
  }),

  /* ---------------------------------------------------------------- Groupes */
  route({
    method: 'GET',
    url: '/api/admin/groups',
    summary: 'Groupes, avec leurs rôles et leurs membres',
    tags: ['Droits'],
    access: 'administration:lire',
    response: z.array(GroupOut),
    handler: async ({ svc }) => (await svc.db.q(`SELECT ${GROUP_COLS} FROM groups g ORDER BY lower(g.name)`)).rows,
  }),
  route({
    method: 'POST',
    url: '/api/admin/groups',
    summary: 'Création d’un groupe',
    tags: ['Droits'],
    access: 'administration:administrer',
    body: GroupBody,
    status: 201,
    response: GroupOut,
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      assertNotSelf(sess.user.id, body.roles.length ? body.members : []);
      const out = await svc.db
        .tx(async (c) => {
          const g = (
            await c.query<{ id: string }>(
              'INSERT INTO groups(name, description, created_by, updated_by) VALUES ($1, $2, $3, $3) RETURNING id',
              [body.name, body.description ?? '', sess.user.username],
            )
          ).rows[0]!;
          await setGroupRoles(c, g.id, body.roles);
          await setGroupMembers(c, g.id, body.members);
          await cutSessions(c, body.roles.length ? body.members : []);
          const created = (await groupById(c, g.id))!;
          await svc.db.audit(sess.user, ip, 'admin.group_create', created.name, { after: groupSnap(created) }, c);
          return created;
        }, sess.user.username)
        .catch(uniqueName('groupe'));
      return out;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/admin/groups/:id',
    summary: 'Modification d’un groupe : nom, description, rôles, membres (If-Match obligatoire)',
    tags: ['Droits'],
    access: 'administration:administrer',
    params: IdParams,
    body: GroupPatchBody,
    response: GroupOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const expected = requireIfMatch(req);
      const { out } = await svc.db
        .tx(async (c) => {
          const cur = await groupById(c, params.id);
          if (!cur) throw new HttpError(404, 'Groupe introuvable.');
          if (cur.version !== expected) throw conflict(cur as unknown as { version: number });
          const oldMembers = cur.members.map((m) => m.id);
          const newMembers = body.members ?? oldMembers;
          const rolesChanged =
            body.roles !== undefined &&
            [...body.roles].sort().join() !==
              cur.roles
                .map((r) => r.id)
                .sort()
                .join();
          // Comptes dont les droits changent : tous les membres si les rôles changent, sinon les arrivants et partants.
          const affected = rolesChanged
            ? [...new Set([...oldMembers, ...newMembers])]
            : [
                ...newMembers.filter((x) => !oldMembers.includes(x)),
                ...oldMembers.filter((x) => !newMembers.includes(x)),
              ];
          const effective = (body.roles ?? cur.roles.map((r) => r.id)).length || rolesChanged ? affected : [];
          assertNotSelf(sess.user.id, effective);
          await c.query(
            `UPDATE groups SET name = COALESCE($2, name), description = COALESCE($3, description), updated_by = $4,
                    version = version + 1, updated_at = now() WHERE id = $1`,
            [params.id, body.name ?? null, body.description ?? null, sess.user.username],
          );
          if (body.roles) await setGroupRoles(c, params.id, body.roles);
          if (body.members) await setGroupMembers(c, params.id, body.members);
          await assertAdminRemains(c);
          await cutSessions(c, effective);
          const updated = (await groupById(c, params.id))!;
          await svc.db.audit(
            sess.user,
            ip,
            'admin.group_update',
            updated.name,
            { before: groupSnap(cur), after: groupSnap(updated) },
            c,
          );
          return { out: updated };
        }, sess.user.username)
        .catch(uniqueName('groupe'));
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/groups/:id',
    summary: 'Suppression d’un groupe (ses membres perdent les rôles qu’il portait)',
    tags: ['Droits'],
    access: 'administration:supprimer',
    params: IdParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      await svc.db.tx(async (c) => {
        const cur = await groupById(c, params.id);
        if (!cur) throw new HttpError(404, 'Groupe introuvable.');
        const affected = cur.roles.length ? cur.members.map((m) => m.id) : [];
        assertNotSelf(sess.user.id, affected);
        await c.query('DELETE FROM groups WHERE id = $1', [params.id]);
        await assertAdminRemains(c);
        await cutSessions(c, affected);
        await svc.db.audit(sess.user, ip, 'admin.group_delete', cur.name, { before: groupSnap(cur), after: null }, c);
      }, sess.user.username);
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Rôles */
  route({
    method: 'GET',
    url: '/api/admin/roles',
    summary: 'Rôles (prédéfinis et personnalisés) et leur matrice de permissions',
    tags: ['Droits'],
    access: 'administration:lire',
    response: z.array(RoleOut),
    handler: async ({ svc }) => {
      const r = await svc.db.q<RoleRow>(
        `SELECT r.id, r.name, r.description, r.system, r.based_on, r.permissions, r.version,
                (SELECT count(*) FROM user_roles ur WHERE ur.role_id = r.id)::int AS users,
                (SELECT count(*) FROM group_roles gr WHERE gr.role_id = r.id)::int AS groups
           FROM roles r ORDER BY NOT r.system, CASE r.id WHEN 'administrateur' THEN 0 WHEN 'rssi' THEN 1
             WHEN 'contributeur' THEN 2 WHEN 'lecteur' THEN 3 ELSE 4 END, lower(r.name)`,
      );
      return r.rows.map(roleOut);
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/permissions',
    summary: 'Modules et actions du modèle de droits (liste partagée avec l’interface)',
    tags: ['Droits'],
    access: 'administration:lire',
    handler: async () => ({ modules: MODULES, actions: ACTIONS }),
  }),
  route({
    method: 'POST',
    url: '/api/admin/roles',
    summary: 'Création d’un rôle personnalisé par duplication d’un rôle existant',
    tags: ['Droits'],
    access: 'administration:administrer',
    body: RoleCreateBody,
    status: 201,
    response: RoleOut,
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const out = await svc.db
        .tx(async (c) => {
          const src = await roleById(c, body.from);
          if (!src) throw new HttpError(404, 'Rôle d’origine introuvable.');
          if (src.scoped)
            throw new HttpError(
              422,
              'Le rôle Auditeur externe ne peut pas être dupliqué : sa portée est choisie à l’attribution.',
            );
          const id = 'r_' + crypto.randomBytes(8).toString('hex');
          await c.query(
            `INSERT INTO roles(id, name, description, system, permissions, based_on, created_by, updated_by)
             VALUES ($1, $2, $3, false, $4, $5, $6, $6)`,
            [id, body.name, body.description ?? src.description, src.permissions, src.id, sess.user.username],
          );
          const created = (await roleById(c, id))!;
          await svc.db.audit(
            sess.user,
            ip,
            'admin.role_create',
            created.name,
            { from: body.from, after: { permissions: created.permissions } },
            c,
          );
          return created;
        }, sess.user.username)
        .catch(uniqueName('rôle'));
      return out;
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/admin/roles/:id',
    summary: 'Modification d’un rôle personnalisé : nom, description, matrice (If-Match obligatoire)',
    tags: ['Droits'],
    access: 'administration:administrer',
    params: RoleParams,
    body: RolePatchBody,
    response: RoleOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const expected = requireIfMatch(req);
      if (isSystemRole(params.id)) throw new HttpError(409, 'Un rôle prédéfini n’est pas modifiable : dupliquez-le.');
      const { out } = await svc.db
        .tx(async (c) => {
          const cur = await roleById(c, params.id);
          if (!cur) throw new HttpError(404, 'Rôle introuvable.');
          if (cur.version !== expected) throw conflict(cur as unknown as { version: number });
          const permsChanged =
            body.permissions !== undefined &&
            [...body.permissions].sort().join() !== [...cur.permissions].sort().join();
          const affected = permsChanged ? await usersOfRole(c, params.id) : [];
          assertNotSelf(sess.user.id, affected);
          await c.query(
            `UPDATE roles SET name = COALESCE($2, name), description = COALESCE($3, description),
                    permissions = COALESCE($4, permissions), updated_by = $5, version = version + 1, updated_at = now()
              WHERE id = $1`,
            [params.id, body.name ?? null, body.description ?? null, body.permissions ?? null, sess.user.username],
          );
          await assertAdminRemains(c);
          await cutSessions(c, affected);
          const updated = (await roleById(c, params.id))!;
          await svc.db.audit(
            sess.user,
            ip,
            'admin.role_update',
            updated.name,
            {
              before: { name: cur.name, permissions: cur.permissions },
              after: { name: updated.name, permissions: updated.permissions },
            },
            c,
          );
          return { out: updated };
        }, sess.user.username)
        .catch(uniqueName('rôle'));
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/admin/roles/:id',
    summary: 'Suppression d’un rôle personnalisé (retiré des comptes et des groupes qui le portent)',
    tags: ['Droits'],
    access: 'administration:supprimer',
    params: RoleParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      if (isSystemRole(params.id)) throw new HttpError(409, 'Un rôle prédéfini ne peut pas être supprimé.');
      await svc.db.tx(async (c) => {
        const cur = await roleById(c, params.id);
        if (!cur) throw new HttpError(404, 'Rôle introuvable.');
        const affected = await usersOfRole(c, params.id);
        assertNotSelf(sess.user.id, affected);
        await c.query('DELETE FROM roles WHERE id = $1', [params.id]);
        await assertAdminRemains(c);
        await cutSessions(c, affected);
        await svc.db.audit(
          sess.user,
          ip,
          'admin.role_delete',
          cur.name,
          { before: { permissions: cur.permissions, users: cur.users, groups: cur.groups }, after: null },
          c,
        );
      }, sess.user.username);
      return undefined;
    },
  }),
];

/* ---------------------------------------------------------------- Aides (groupes) */
async function setGroupRoles(c: Q, groupId: string, roles: readonly string[]) {
  const ids = [...new Set(roles)];
  const known = await c.query<{ id: string }>('SELECT id FROM roles WHERE id = ANY($1::text[])', [ids]);
  if (known.rowCount !== ids.length) throw new HttpError(422, 'Rôle inconnu.');
  if (ids.some((id) => isSystemRole(id) && SYSTEM_ROLE_DEFS[id].scoped))
    throw new HttpError(422, 'Le rôle Auditeur externe s’attribue directement à un compte, pas à un groupe.');
  await c.query('DELETE FROM group_roles WHERE group_id = $1', [groupId]);
  for (const id of ids) await c.query('INSERT INTO group_roles(group_id, role_id) VALUES ($1, $2)', [groupId, id]);
}
async function setGroupMembers(c: Q, groupId: string, members: readonly string[]) {
  const ids = [...new Set(members)];
  const known = await c.query('SELECT id FROM users WHERE id = ANY($1::uuid[])', [ids]);
  if (known.rowCount !== ids.length) throw new HttpError(422, 'Compte inconnu.');
  await c.query('DELETE FROM user_groups WHERE group_id = $1', [groupId]);
  for (const u of ids) await c.query('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [u, groupId]);
}
const groupSnap = (g: GroupOut) => ({
  name: g.name,
  roles: g.roles.map((r) => r.id),
  members: g.members.map((m) => m.username),
});
const uniqueName = (what: string) => (e: { code?: string }) => {
  if (e.code === '23505') throw new HttpError(409, `Un ${what} porte déjà ce nom.`);
  throw e;
};
