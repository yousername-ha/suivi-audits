/* Droits effectifs (RBAC) côté serveur : lecture des attributions, garde-fous, instantanés pour le journal d'audit. */
import {
  isPermission,
  isSystemRole,
  legacyKeyModule,
  MODULE_LABELS,
  SYSTEM_ROLE_DEFS,
  type Action,
  type Module,
  type Permission,
  type RoleGrant,
  type Rights,
} from '@suivi/shared';
import type { Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';

type Q = Pick<Client, 'query'>;

const ACTION_TEXT: Record<string, string> = {
  lire: 'consulter',
  modifier: 'créer ou modifier',
  supprimer: 'supprimer',
  exporter: 'exporter',
  administrer: 'administrer',
};
export function permissionDenied(p: Permission): HttpError {
  const [m, a] = p.split(':') as [Module, string];
  return new HttpError(
    403,
    `Droits insuffisants : vous ne pouvez pas ${ACTION_TEXT[a] ?? a} dans « ${MODULE_LABELS[m]} ».`,
    {
      reason: 'permission',
      permission: p,
    },
  );
}

/** Exige « action » sur le module de droits de chaque clé legacy modifiée (outil historique, import). */
export function assertLegacyKeys(rights: Rights, keys: Iterable<string>, action: Action) {
  for (const k of keys) {
    const m = legacyKeyModule(k);
    if (m && !rights.can(m, action)) throw permissionDenied(`${m}:${action}`);
  }
}

interface GrantRow {
  role_id: string;
  role_name: string;
  role_permissions: string[];
  modules: string[] | null;
  group_id: string | null;
  group_name: string | null;
}

/** Permissions d'un rôle : définies dans le code pour les rôles prédéfinis, en base pour les rôles personnalisés. */
export function rolePermissions(id: string, stored: readonly string[]): Permission[] {
  if (isSystemRole(id)) return [...SYSTEM_ROLE_DEFS[id].permissions];
  return stored.filter(isPermission);
}

const GRANTS_SQL = `
  SELECT r.id AS role_id, r.name AS role_name, r.permissions AS role_permissions, ur.modules,
         NULL::uuid AS group_id, NULL::text AS group_name
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id
   WHERE ur.user_id = $1
  UNION ALL
  SELECT r.id, r.name, r.permissions, NULL, g.id, g.name
    FROM user_groups ug
    JOIN groups g ON g.id = ug.group_id
    JOIN group_roles gr ON gr.group_id = g.id
    JOIN roles r ON r.id = gr.role_id
   WHERE ug.user_id = $1`;

/** Attributions d'un compte : rôles directs (avec leur portée) et rôles hérités des groupes. */
export async function loadGrants(c: Q, userId: string): Promise<RoleGrant[]> {
  const r = await c.query<GrantRow>(GRANTS_SQL, [userId]);
  return r.rows.map((g) => ({
    roleId: g.role_id,
    roleName: g.role_name,
    permissions: rolePermissions(g.role_id, g.role_permissions),
    modules: g.group_id ? null : ((g.modules as Module[] | null) ?? null),
    via: g.group_id ? { kind: 'group', groupId: g.group_id, groupName: g.group_name ?? '' } : { kind: 'direct' },
  }));
}

/** Nombre d'administrateurs actifs et permanents : comptes non désactivés, sans date d'expiration,
    détenant « administration:administrer » (rôle direct ou par un groupe). */
export async function permanentAdminCount(c: Q): Promise<number> {
  const r = await c.query<{ n: number }>(
    `WITH admin_roles AS (
       SELECT id FROM roles WHERE id = 'administrateur' OR 'administration:administrer' = ANY(permissions))
     SELECT count(*)::int AS n FROM users u
      WHERE NOT u.disabled AND u.expires_at IS NULL AND (
        EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id IN (SELECT id FROM admin_roles)
                  AND (ur.modules IS NULL OR 'administration' = ANY(ur.modules)))
        OR EXISTS (SELECT 1 FROM user_groups ug JOIN group_roles gr ON gr.group_id = ug.group_id
                    WHERE ug.user_id = u.id AND gr.role_id IN (SELECT id FROM admin_roles)))`,
  );
  return r.rows[0]!.n;
}

/** À appeler dans la transaction, après la modification : annule tout ce qui laisserait l'application
    sans administrateur actif et permanent. */
export async function assertAdminRemains(c: Q) {
  if ((await permanentAdminCount(c)) < 1)
    throw new HttpError(
      409,
      'Impossible : il doit rester au moins un administrateur actif, sans date d’expiration. Désignez-en un autre d’abord.',
    );
}

/** Le rôle « Auditeur externe » : attribution directe uniquement, avec des modules choisis et une date d'expiration. */
export async function assertScopedRoles(c: Q, userIds: readonly string[]) {
  if (!userIds.length) return;
  const bad = await c.query<{ username: string; why: string }>(
    `SELECT u.username,
            CASE WHEN u.expires_at IS NULL THEN 'expiration' ELSE 'modules' END AS why
       FROM user_roles ur JOIN users u ON u.id = ur.user_id JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ANY($1::uuid[]) AND r.id = 'auditeur_externe'
        AND (u.expires_at IS NULL OR ur.modules IS NULL OR cardinality(ur.modules) = 0)`,
    [userIds],
  );
  const b = bad.rows[0];
  if (b)
    throw new HttpError(
      422,
      b.why === 'expiration'
        ? `Le compte ${b.username} a le rôle Auditeur externe : une date d’expiration est obligatoire.`
        : `Le compte ${b.username} a le rôle Auditeur externe : choisissez les modules ouverts en lecture.`,
    );
}

/** Comptes concernés par un rôle (directement ou par un groupe), ou par un groupe. */
export async function usersOfRole(c: Q, roleId: string): Promise<string[]> {
  const r = await c.query<{ id: string }>(
    `SELECT user_id AS id FROM user_roles WHERE role_id = $1
     UNION SELECT ug.user_id FROM user_groups ug JOIN group_roles gr ON gr.group_id = ug.group_id WHERE gr.role_id = $1`,
    [roleId],
  );
  return r.rows.map((x) => x.id);
}

/** Un utilisateur ne peut pas modifier ses propres droits (ni directement, ni par un groupe ou un rôle qu'il détient). */
export function assertNotSelf(actorId: string, affected: readonly string[]) {
  if (affected.includes(actorId))
    throw new HttpError(403, 'Vous ne pouvez pas modifier vos propres droits. Demandez à un autre administrateur.');
}

/** Instantané des droits d'un ensemble de comptes, pour le journal d'audit (avant / après). */
export async function rightsSnapshot(c: Q, userIds: readonly string[]) {
  if (!userIds.length) return {};
  const r = await c.query<{
    username: string;
    roles: string[] | null;
    groups: string[] | null;
    expires_at: Date | null;
    disabled: boolean;
  }>(
    `SELECT u.username, u.expires_at, u.disabled,
            (SELECT array_agg(ur.role_id || COALESCE('[' || array_to_string(ur.modules, ',') || ']', '') ORDER BY ur.role_id)
               FROM user_roles ur WHERE ur.user_id = u.id) AS roles,
            (SELECT array_agg(g.name ORDER BY g.name) FROM user_groups ug JOIN groups g ON g.id = ug.group_id
              WHERE ug.user_id = u.id) AS groups
       FROM users u WHERE u.id = ANY($1::uuid[]) ORDER BY lower(u.username)`,
    [userIds],
  );
  return Object.fromEntries(
    r.rows.map((u) => [
      u.username,
      { roles: u.roles ?? [], groups: u.groups ?? [], expires: u.expires_at, disabled: u.disabled },
    ]),
  );
}

/** Désactive les comptes arrivés à expiration et ferme leurs sessions. Renvoie les identifiants désactivés. */
export async function expireAccounts(db: Db): Promise<string[]> {
  const names = await db.tx(async (c) => {
    const r = await c.query<{ id: string; username: string }>(
      `UPDATE users SET disabled = true, version = version + 1, updated_at = now()
        WHERE NOT disabled AND expires_at IS NOT NULL AND expires_at <= now() RETURNING id, username`,
    );
    if (r.rowCount) await c.query('DELETE FROM sessions WHERE user_id = ANY($1::uuid[])', [r.rows.map((x) => x.id)]);
    return r.rows.map((x) => x.username);
  }, 'système');
  for (const n of names) await db.audit({ username: 'système' }, null, 'account.expired', n);
  return names;
}
