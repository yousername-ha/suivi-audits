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
import { sql } from 'kysely';
import { surConnexion, type Client, type Db } from './db/db.js';
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

/** Permissions d'un rôle : définies dans le code pour les rôles prédéfinis, en base pour les rôles personnalisés. */
export function rolePermissions(id: string, stored: readonly string[]): Permission[] {
  if (isSystemRole(id)) return [...SYSTEM_ROLE_DEFS[id].permissions];
  return stored.filter(isPermission);
}

/** Attributions d'un compte : rôles directs (avec leur portée) et rôles hérités des groupes. */
export async function loadGrants(c: Q, userId: string): Promise<RoleGrant[]> {
  const k = surConnexion(c);
  const directs = k
    .selectFrom('user_roles as ur')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .select([
      'r.id as role_id',
      'r.name as role_name',
      'r.permissions as role_permissions',
      'ur.modules',
      sql<string | null>`NULL::uuid`.as('group_id'),
      sql<string | null>`NULL::text`.as('group_name'),
    ])
    .where('ur.user_id', '=', userId);
  const parGroupe = k
    .selectFrom('user_groups as ug')
    .innerJoin('groups as g', 'g.id', 'ug.group_id')
    .innerJoin('group_roles as gr', 'gr.group_id', 'g.id')
    .innerJoin('roles as r', 'r.id', 'gr.role_id')
    .select([
      'r.id as role_id',
      'r.name as role_name',
      'r.permissions as role_permissions',
      sql<string[] | null>`NULL`.as('modules'),
      sql<string | null>`g.id`.as('group_id'),
      sql<string | null>`g.name`.as('group_name'),
    ])
    .where('ug.user_id', '=', userId);
  const r = await directs.unionAll(parGroupe).execute();
  return r.map((g) => ({
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
  const r = await surConnexion(c)
    .with('admin_roles', (db) =>
      db
        .selectFrom('roles')
        .select('id')
        .where((eb) =>
          eb.or([eb('id', '=', 'administrateur'), sql<boolean>`'administration:administrer' = ANY(permissions)`]),
        ),
    )
    .selectFrom('users as u')
    .select(sql<number>`count(*)::int`.as('n'))
    .where('u.disabled', '=', false)
    .where('u.expires_at', 'is', null)
    .where((eb) =>
      eb.or([
        eb.exists(
          eb
            .selectFrom('user_roles as ur')
            .select('ur.user_id')
            .whereRef('ur.user_id', '=', 'u.id')
            .where('ur.role_id', 'in', eb.selectFrom('admin_roles').select('id'))
            .where((e) => e.or([e('ur.modules', 'is', null), sql<boolean>`'administration' = ANY(ur.modules)`])),
        ),
        eb.exists(
          eb
            .selectFrom('user_groups as ug')
            .innerJoin('group_roles as gr', 'gr.group_id', 'ug.group_id')
            .select('ug.user_id')
            .whereRef('ug.user_id', '=', 'u.id')
            .where('gr.role_id', 'in', eb.selectFrom('admin_roles').select('id')),
        ),
      ]),
    )
    .executeTakeFirstOrThrow();
  return r.n;
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
  const b = await surConnexion(c)
    .selectFrom('user_roles as ur')
    .innerJoin('users as u', 'u.id', 'ur.user_id')
    .innerJoin('roles as r', 'r.id', 'ur.role_id')
    .select([
      'u.username',
      sql<'expiration' | 'modules'>`CASE WHEN u.expires_at IS NULL THEN 'expiration' ELSE 'modules' END`.as('why'),
    ])
    .where('ur.user_id', 'in', [...userIds])
    .where('r.id', '=', 'auditeur_externe')
    .where((eb) =>
      eb.or([eb('u.expires_at', 'is', null), eb('ur.modules', 'is', null), sql<boolean>`cardinality(ur.modules) = 0`]),
    )
    .executeTakeFirst();
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
  const k = surConnexion(c);
  const r = await k
    .selectFrom('user_roles')
    .select('user_id as id')
    .where('role_id', '=', roleId)
    .union(
      k
        .selectFrom('user_groups as ug')
        .innerJoin('group_roles as gr', 'gr.group_id', 'ug.group_id')
        .select('ug.user_id as id')
        .where('gr.role_id', '=', roleId),
    )
    .execute();
  return r.map((x) => x.id);
}

/** Un utilisateur ne peut pas modifier ses propres droits (ni directement, ni par un groupe ou un rôle qu'il détient). */
export function assertNotSelf(actorId: string, affected: readonly string[]) {
  if (affected.includes(actorId))
    throw new HttpError(403, 'Vous ne pouvez pas modifier vos propres droits. Demandez à un autre administrateur.');
}

/** Instantané des droits d'un ensemble de comptes, pour le journal d'audit (avant / après). */
export async function rightsSnapshot(c: Q, userIds: readonly string[]) {
  if (!userIds.length) return {};
  // Agrégats ordonnés : fragments SQL fixes.
  const r = await surConnexion(c)
    .selectFrom('users as u')
    .select((eb) => [
      'u.username',
      'u.expires_at',
      'u.disabled',
      eb
        .selectFrom('user_roles as ur')
        .select(
          sql<
            string[] | null
          >`array_agg(ur.role_id || COALESCE('[' || array_to_string(ur.modules, ',') || ']', '') ORDER BY ur.role_id)`.as(
            'r',
          ),
        )
        .whereRef('ur.user_id', '=', 'u.id')
        .as('roles'),
      eb
        .selectFrom('user_groups as ug')
        .innerJoin('groups as g', 'g.id', 'ug.group_id')
        .select(sql<string[] | null>`array_agg(g.name ORDER BY g.name)`.as('g'))
        .whereRef('ug.user_id', '=', 'u.id')
        .as('groups'),
    ])
    .where('u.id', 'in', [...userIds])
    .orderBy(sql`lower(u.username)`)
    .execute();
  return Object.fromEntries(
    r.map((u) => [
      u.username,
      { roles: u.roles ?? [], groups: u.groups ?? [], expires: u.expires_at, disabled: u.disabled },
    ]),
  );
}

/** Désactive les comptes arrivés à expiration et ferme leurs sessions. Renvoie les identifiants désactivés. */
export async function expireAccounts(db: Db): Promise<string[]> {
  const names = await db.tx(async (_c, k) => {
    const r = await k
      .updateTable('users')
      .set((eb) => ({ disabled: true, version: eb('version', '+', 1), updated_at: sql<Date>`now()` }))
      .where('disabled', '=', false)
      .where('expires_at', 'is not', null)
      .where('expires_at', '<=', sql<Date>`now()`)
      .returning(['id', 'username'])
      .execute();
    if (r.length)
      await k
        .deleteFrom('sessions')
        .where(
          'user_id',
          'in',
          r.map((x) => x.id),
        )
        .execute();
    return r.map((x) => x.username);
  }, 'système');
  for (const n of names) await db.audit({ username: 'système' }, null, 'account.expired', n);
  return names;
}
