/* Schémas zod des échanges API (validation côté serveur, types côté interface, documentation OpenAPI). */
import { z } from 'zod';
import { ACTIONS, ALL_PERMISSIONS, MODULES, type Permission } from './permissions.js';
import { PRESENCE_HEARTBEAT_MS } from './events.js';
import { Preferences as PreferencesSchema } from './affichage.js';

export const USERNAME_RE = /^[a-zA-Z0-9._@-]{2,64}$/;
export const CLASSIFICATIONS = ['public', 'interne', 'restreint', 'confidentiel'] as const;
export const CLASSIFICATION_LABELS: Record<(typeof CLASSIFICATIONS)[number], string> = {
  public: 'Public',
  interne: 'Interne',
  restreint: 'Restreint',
  confidentiel: 'Confidentiel',
};

const text = (max: number) => z.string().trim().max(max);
/** Liste de chaînes : tableau ou texte séparé par des virgules, dédoublonnée et bornée. */
const strList = (maxItems: number, max: number) =>
  z.union([z.array(z.string()), z.string()]).transform((v) =>
    (Array.isArray(v) ? v : v.split(','))
      .map((x) => x.trim().slice(0, max))
      .filter(Boolean)
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, maxItems),
  );

export const Username = z
  .string()
  .trim()
  .regex(USERNAME_RE, 'Identifiant invalide (2 à 64 caractères : lettres, chiffres, . _ - @).');
export const Email = z.union([z.literal(''), z.email('Adresse e-mail invalide.').max(200)]);
export const ModuleSchema = z.enum(MODULES);
export const ActionSchema = z.enum(ACTIONS);
export const PermissionSchema = z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]]);
export const RoleId = z.string().regex(/^[a-z][a-z0-9_]{1,62}$/, 'Identifiant de rôle invalide.');
/** Date d'expiration de compte : date ISO (AAAA-MM-JJ ou horodatage), ou null pour aucune. */
export const ExpiresAt = z.union([z.iso.date(), z.iso.datetime({ offset: true })]).nullable();
export const Uuid = z.uuid();

/* ---------------------------------------------------------------- Authentification */
export const LoginBody = z.object({ username: text(64).min(1), password: z.string().min(1).max(256) });
export const MfaBody = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Code à 6 chiffres attendu.'),
});
export const SetupBody = z.object({
  token: z.string().max(100),
  username: Username,
  displayName: text(120).optional(),
  email: Email.optional(),
  /** Nom de l'organisation (réglage « general »), demandé au premier lancement ; facultatif. */
  orgName: text(120).optional(),
  password: z.string().max(256),
});
export const PasswordChangeBody = z.object({ current: z.string().max(256), next: z.string().max(256) });
export const PasswordBody = z.object({ password: z.string().max(256).optional() });
export const TotpConfirmBody = MfaBody;

export const AccessStageSchema = z.enum(['anon', 'mfa', 'enroll', 'password', 'ok']);
export const MeOut = z.object({
  stage: AccessStageSchema,
  csrf: z.string().nullable(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      displayName: z.string(),
      totpEnabled: z.boolean(),
      mustChangePassword: z.boolean(),
      roles: z.array(z.string()),
      expiresAt: z.string().nullable(),
    })
    .nullable(),
  /** Droits effectifs (module:action) ; l'interface s'en sert pour masquer ce qui n'est pas permis. */
  permissions: z.array(PermissionSchema),
  mfaRequired: z.boolean(),
  passwordMinLength: z.number(),
  appName: z.string(),
  orgName: z.string(),
  /** Site web de l'organisation (Paramètres > Général), chaîne vide si non renseigné. */
  orgSite: z.string(),
  /** Apparence par défaut de l'organisation (page Paramètres). */
  appearance: z.object({
    theme: z.enum(['auto', 'clair', 'sombre']),
    densite: z.enum(['compacte', 'normale', 'confortable']),
    style: z.enum(['sage', 'clair']),
  }),
  /** Préférences d'affichage de la personne (null avant la connexion). */
  preferences: PreferencesSchema.nullable(),
  version: z.string(),
});
export type MeOut = z.infer<typeof MeOut>;
export const StageOut = z.object({ stage: AccessStageSchema });
export const SetupStatusOut = z.object({ needed: z.boolean(), pending: z.boolean(), adminExists: z.boolean() });
export const TotpBeginOut = z.object({ secret: z.string(), uri: z.string() });
export const ErrorOut = z.object({ error: z.string() }).catchall(z.unknown());

/* ---------------------------------------------------------------- Droits : comptes, groupes, rôles */
export const RoleAssignment = z.object({
  roleId: RoleId,
  /** Portée (modules) : obligatoire pour l'auditeur externe, ignorée sinon. */
  modules: z.array(ModuleSchema).max(MODULES.length).nullable().optional(),
});
export type RoleAssignment = z.infer<typeof RoleAssignment>;

export const UserCreateBody = z.object({
  username: Username,
  displayName: text(120).optional(),
  email: Email.optional(),
  roles: z.array(RoleAssignment).max(50).default([]),
  groups: z.array(z.uuid()).max(100).default([]),
  expiresAt: ExpiresAt.optional(),
});
export const UserPatchBody = z.object({
  displayName: text(120).optional(),
  email: Email.optional(),
  disabled: z.boolean().optional(),
  unlock: z.boolean().optional(),
  expiresAt: ExpiresAt.optional(),
  roles: z.array(RoleAssignment).max(50).optional(),
  groups: z.array(z.uuid()).max(100).optional(),
});
export const UserOut = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  email: z.string(),
  disabled: z.boolean(),
  expires_at: z.string().nullable(),
  totp_enabled: z.boolean(),
  must_change_password: z.boolean(),
  failed_logins: z.number(),
  locked_until: z.string().nullable(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
  sessions: z.number(),
  version: z.number(),
  roles: z.array(z.object({ id: z.string(), name: z.string(), modules: z.array(z.string()).nullable() })),
  groups: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type UserOut = z.infer<typeof UserOut>;

export const GroupBody = z.object({
  name: text(80).min(1, 'Nom obligatoire.'),
  description: text(500).optional(),
  roles: z.array(RoleId).max(50).default([]),
  members: z.array(z.uuid()).max(1000).default([]),
});
export const GroupPatchBody = GroupBody.partial();
export const GroupOut = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.number(),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  members: z.array(z.object({ id: z.string(), username: z.string(), display_name: z.string() })),
});
export type GroupOut = z.infer<typeof GroupOut>;

/** Création d'un rôle personnalisé : toujours par duplication d'un rôle existant. */
export const RoleCreateBody = z.object({
  from: RoleId,
  name: text(80).min(1, 'Nom obligatoire.'),
  description: text(500).optional(),
});
export const RolePatchBody = z.object({
  name: text(80).min(1).optional(),
  description: text(500).optional(),
  permissions: z.array(PermissionSchema).max(ALL_PERMISSIONS.length).optional(),
});
export const RoleOut = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  system: z.boolean(),
  scoped: z.boolean(),
  based_on: z.string().nullable(),
  permissions: z.array(PermissionSchema),
  version: z.number(),
  users: z.number(),
  groups: z.number(),
});
export type RoleOut = z.infer<typeof RoleOut>;

const Via = z.union([
  z.object({ kind: z.literal('direct') }),
  z.object({ kind: z.literal('group'), groupId: z.string(), groupName: z.string() }),
]);
export const EffectiveRightsOut = z.object({
  user: z.object({ id: z.string(), username: z.string(), display_name: z.string() }),
  permissions: z.array(
    z.object({
      permission: PermissionSchema,
      origins: z.array(z.object({ roleId: z.string(), roleName: z.string(), via: Via })),
    }),
  ),
});
export type EffectiveRightsOut = z.infer<typeof EffectiveRightsOut>;
export const TempPasswordOut = z.object({ temporaryPassword: z.string() });

/* ---------------------------------------------------------------- Documents et liens */
export const Classification = z.enum(CLASSIFICATIONS);
export const DocumentMeta = z.object({
  title: text(200).optional(),
  description: text(4000).optional(),
  category: text(80).optional(),
  refs: strList(100, 60).optional(),
  tags: strList(30, 40).optional(),
  classification: Classification.optional(),
});
export type DocumentMeta = z.infer<typeof DocumentMeta>;
export const DocumentQuery = z.object({
  q: z.string().max(200).optional(),
  ref: z.string().max(60).optional(),
  category: z.string().max(80).optional(),
  trash: z.enum(['0', '1']).optional(),
});
export const DocumentOut = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  refs: z.array(z.string()),
  tags: z.array(z.string()),
  classification: Classification,
  current_version: z.number(),
  version: z.number(),
  created_by: z.string(),
  created_at: z.string(),
  updated_by: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
  filename: z.string().nullable(),
  mime: z.string().nullable(),
  size: z.number().nullable(),
  sha256: z.string().nullable(),
  scan_status: z.string().nullable(),
  uploaded_by: z.string().nullable(),
  uploaded_at: z.string().nullable(),
});
export type DocumentOut = z.infer<typeof DocumentOut>;
export const DocumentVersionOut = z.object({
  version: z.number(),
  filename: z.string(),
  mime: z.string(),
  size: z.number(),
  sha256: z.string(),
  scan_status: z.string(),
  uploaded_by: z.string(),
  uploaded_at: z.string(),
  comment: z.string(),
});
export const DocumentDetailOut = DocumentOut.extend({ versions: z.array(DocumentVersionOut) });
export type DocumentDetailOut = z.infer<typeof DocumentDetailOut>;

/** Adresse de lien : http(s)://…, file://…, \\serveur\partage ou lecteur réseau. */
export function normalizeLinkUrl(u: string): string | null {
  const v = u.trim().slice(0, 2000);
  if (/^\\\\[^\\]+\\/.test(v)) return v;
  if (/^[a-z]:\\/i.test(v)) return v;
  try {
    const x = new URL(v);
    if (['http:', 'https:', 'file:'].includes(x.protocol)) return x.href;
  } catch {
    /* adresse non reconnue */
  }
  return null;
}
const LinkUrl = z.string().transform((v, ctx) => {
  const n = normalizeLinkUrl(v);
  if (!n) {
    ctx.addIssue({ code: 'custom', message: 'Adresse invalide : http(s)://…, file://… ou \\\\serveur\\partage\\…' });
    return z.NEVER;
  }
  return n;
});
export const LinkCreateBody = z.object({
  title: text(200).optional(),
  url: LinkUrl,
  description: text(4000).optional(),
  category: text(80).optional(),
  refs: strList(100, 60).optional(),
  tags: strList(30, 40).optional(),
});
export const LinkPatchBody = LinkCreateBody.partial();
export const LinkOut = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string(),
  category: z.string(),
  refs: z.array(z.string()),
  tags: z.array(z.string()),
  version: z.number(),
  created_by: z.string(),
  created_at: z.string(),
  updated_by: z.string(),
  updated_at: z.string(),
});
export type LinkOut = z.infer<typeof LinkOut>;
export const RefOut = z.object({ ref: z.string(), label: z.string(), kind: z.string() });

/* ---------------------------------------------------------------- Présence */
export const PresenceBody = z.object({
  client: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  resource: z
    .string()
    .max(200)
    .regex(/^[a-z0-9/_-]*$/i),
  mode: z.enum(['view', 'edit']),
});
export const PRESENCE_HEARTBEAT = PRESENCE_HEARTBEAT_MS;

/* ---------------------------------------------------------------- Import legacy */
export const IMPORT_MODES = ['init', 'merge', 'replace'] as const;
export const ImportMode = z.enum(IMPORT_MODES);
export type ImportMode = z.infer<typeof ImportMode>;
export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  init: 'Initialiser (base vide uniquement)',
  merge: 'Fusionner (créations et mises à jour, aucune suppression)',
  replace: 'Remplacer un module (supprime les éléments absents du fichier)',
};
export const ImportApplyQuery = z.object({
  mode: ImportMode,
  module: z.string().max(40).optional(),
  /** Empreinte du fichier simulé : garantit que l'on applique exactement ce qui a été simulé. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** Confirmation renforcée pour « Remplacer un module » : nom du module ressaisi. */
  confirm: z.string().max(40).optional(),
});
