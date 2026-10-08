/* Droits (RBAC) : permissions = module × action, rôles = ensembles de permissions, groupes = ensembles de rôles.
   Liste unique, utilisée par l'API (garde requirePermission, filtrage du temps réel) et par l'interface
   (affichage conditionnel ; le serveur reste seul juge). */

/** Modules métier : chacun recevra ses tables lors de sa reprise (docs/ROADMAP.md). */
export const BUSINESS_MODULES = [
  'audit',
  'ecarts',
  'plan_audit',
  'pilotage',
  'fournisseurs',
  'conformite',
  'ia',
  'crrc',
  'investissements',
  'incidents',
  'cartographie',
] as const;
export const MODULES = [...BUSINESS_MODULES, 'documents', 'import_export', 'administration', 'parametres'] as const;
export type Module = (typeof MODULES)[number];
export type BusinessModule = (typeof BUSINESS_MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  audit: 'Audit (référentiels et couverture)',
  ecarts: 'Écarts et actions',
  plan_audit: "Plan d'audit",
  pilotage: 'Pilotage du SMSI',
  fournisseurs: 'Fournisseurs',
  conformite: 'Conformité (ReCyF, GAP)',
  ia: 'Intelligence artificielle',
  crrc: 'CRRC',
  investissements: 'Investissements',
  incidents: 'Incidents et PCA/PRA',
  cartographie: 'Cartographie du SMSI',
  documents: 'Documents et liens',
  import_export: 'Import et export',
  administration: 'Administration (comptes, groupes, rôles, sessions, journal)',
  parametres: 'Paramètres',
};

export const ACTIONS = ['lire', 'modifier', 'supprimer', 'exporter', 'administrer'] as const;
export type Action = (typeof ACTIONS)[number];
export const ACTION_LABELS: Record<Action, string> = {
  lire: 'Lire',
  modifier: 'Créer et modifier',
  supprimer: 'Supprimer',
  exporter: 'Exporter',
  administrer: 'Administrer',
};

export type Permission = `${Module}:${Action}`;
export const ALL_PERMISSIONS: readonly Permission[] = MODULES.flatMap((m) =>
  ACTIONS.map((a) => `${m}:${a}` as Permission),
);
const PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);
export const isPermission = (p: unknown): p is Permission => typeof p === 'string' && PERMISSION_SET.has(p);
export const perm = (m: Module, a: Action): Permission => `${m}:${a}`;

const every = (mods: readonly Module[], acts: readonly Action[]) => mods.flatMap((m) => acts.map((a) => perm(m, a)));

/* ---------------------------------------------------------------- Rôles prédéfinis (ni supprimables ni modifiables) */
export const SYSTEM_ROLES = ['administrateur', 'rssi', 'contributeur', 'lecteur', 'auditeur_externe'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export interface SystemRoleDef {
  name: string;
  description: string;
  permissions: readonly Permission[];
  /** Portée par modules obligatoire à l'attribution, et compte obligatoirement assorti d'une date d'expiration. */
  scoped?: boolean;
}

/** Modules qu'un auditeur externe peut se voir ouvrir (lecture seule). */
export const AUDITOR_MODULES: readonly Module[] = [...BUSINESS_MODULES, 'documents'];

export const SYSTEM_ROLE_DEFS: Record<SystemRole, SystemRoleDef> = {
  administrateur: {
    name: 'Administrateur',
    description: 'Tous les droits, y compris l’administration technique.',
    permissions: ALL_PERMISSIONS,
  },
  rssi: {
    name: 'RSSI',
    description: 'Tous les droits, sauf l’administration technique (comptes, groupes, rôles, sessions, journal).',
    permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith('administration:')),
  },
  contributeur: {
    name: 'Contributeur',
    description: 'Lire et modifier les modules métier, les documents et les liens ; exporter les cartes.',
    permissions: [...every([...BUSINESS_MODULES, 'documents'], ['lire', 'modifier']), 'cartographie:exporter'],
  },
  lecteur: {
    name: 'Lecteur',
    description: 'Lecture seule des modules métier, des documents et des liens ; export des cartes.',
    permissions: [...every([...BUSINESS_MODULES, 'documents'], ['lire']), 'cartographie:exporter'],
  },
  auditeur_externe: {
    name: 'Auditeur externe',
    description:
      'Lecture seule des modules choisis à l’attribution. Compte obligatoirement assorti d’une date d’expiration.',
    permissions: every(AUDITOR_MODULES, ['lire']),
    scoped: true,
  },
};
export const isSystemRole = (id: string): id is SystemRole => (SYSTEM_ROLES as readonly string[]).includes(id);

/** Comptes v2 : admin → Administrateur, rw → Contributeur, ro → Lecteur. */
export const V2_ROLE_MAPPING = { admin: 'administrateur', rw: 'contributeur', ro: 'lecteur' } as const;

/* ---------------------------------------------------------------- Droits effectifs */
/** Attribution d'un rôle, directe ou par un groupe ; « modules » restreint la portée (auditeur externe). */
export interface RoleGrant {
  roleId: string;
  roleName: string;
  permissions: readonly Permission[];
  modules?: readonly Module[] | null;
  via: { kind: 'direct' } | { kind: 'group'; groupId: string; groupName: string };
}

export interface PermissionOrigin {
  roleId: string;
  roleName: string;
  via: RoleGrant['via'];
}

/** Droits effectifs = union des rôles directs et des rôles des groupes, avec l'origine de chaque droit. */
export function effectivePermissions(grants: readonly RoleGrant[]): Map<Permission, PermissionOrigin[]> {
  const out = new Map<Permission, PermissionOrigin[]>();
  for (const g of grants) {
    const scope = g.modules ? new Set<string>(g.modules) : null;
    for (const p of g.permissions) {
      if (!isPermission(p)) continue;
      if (scope && !scope.has(p.slice(0, p.indexOf(':')))) continue;
      const list = out.get(p) ?? [];
      list.push({ roleId: g.roleId, roleName: g.roleName, via: g.via });
      out.set(p, list);
    }
  }
  return out;
}

/** Ensemble de permissions consultable (session, interface). */
export class Rights {
  private readonly set: ReadonlySet<string>;
  constructor(perms: Iterable<string>) {
    this.set = new Set([...perms].filter(isPermission));
  }
  can(m: Module, a: Action): boolean {
    return this.set.has(`${m}:${a}`);
  }
  has(p: Permission): boolean {
    return this.set.has(p);
  }
  /** Au moins un module métier lisible (accès à l'outil historique et à l'accueil). */
  canReadAnyBusiness(): boolean {
    return BUSINESS_MODULES.some((m) => this.can(m, 'lire'));
  }
  list(): Permission[] {
    return ALL_PERMISSIONS.filter((p) => this.set.has(p));
  }
}

/* ---------------------------------------------------------------- Outil historique : clés legacy → modules */
const LEGACY_KEY_MODULE: Record<string, Module | null> = {
  v: null,
  updatedAt: null,
  schema: null,
  years: 'audit',
  yearLabels: 'audit',
  nextYear: 'audit',
  nextDate: 'audit',
  internalDate: 'audit',
  iso27001Certified: 'audit',
  groups: 'audit',
  items: 'audit',
  hdsChap: 'audit',
  findings: 'ecarts',
  source: 'ecarts',
  closeDeadline: 'ecarts',
  findingsRev: 'ecarts',
  plan: 'plan_audit',
  processes: 'pilotage',
  objectives: 'pilotage',
  indicators: 'pilotage',
  dda: 'pilotage',
  accessReviews: 'pilotage',
  reviews: 'pilotage',
  scope: 'pilotage',
  interested: 'pilotage',
  swots: 'pilotage',
  roles: 'pilotage',
  plans: 'pilotage',
  recurring: 'pilotage',
  evidences: 'pilotage',
  suppliers: 'fournisseurs',
  supEvals: 'fournisseurs',
  frameworks: 'conformite',
  activeFw: 'conformite',
  entityCategory: 'conformite',
  appGaps: 'conformite',
  ai: 'ia',
  crrc: 'crrc',
  invest: 'investissements',
  incidents: 'incidents',
  crisis: 'incidents',
  branding: 'parametres',
  maps: 'cartographie',
};
/** Module de droits d'une clé legacy ; null pour les métadonnées techniques ; « parametres » pour une clé inconnue. */
export function legacyKeyModule(key: string): Module | null {
  return Object.prototype.hasOwnProperty.call(LEGACY_KEY_MODULE, key) ? LEGACY_KEY_MODULE[key]! : 'parametres';
}
