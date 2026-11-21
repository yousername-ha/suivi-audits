/* Droits (RBAC) : permissions = module × action, rôles = ensembles de permissions, groupes = ensembles de rôles.
   Liste unique, utilisée par l'API (garde requirePermission, filtrage du temps réel) et par l'interface
   (affichage conditionnel ; le serveur reste seul juge). */

/** Modules métier : chacun recevra ses tables lors de sa reprise (docs/ROADMAP.md). Leurs droits sont donnés par défaut au
    contributeur et au lecteur, ouvrent l'accueil, les écrans muraux et les routes communes « métier ». */
export const BUSINESS_MODULES = [
  'audit',
  'ecarts',
  'plan_audit',
  'pilotage',
  'fournisseurs',
  'conformite',
  'incidents',
  'cartographie',
] as const;
export const MODULES = [
  ...BUSINESS_MODULES,
  // Vulnérabilités (ADR 0100) : hors des modules métier depuis le lot V5 (failles et machines de Tenable). Comme l'assistant,
  // ses droits ne vont par défaut qu'à l'administrateur et au RSSI ; un rôle personnalisé peut les accorder. Réglage prudent,
  // à confirmer par le RSSI (point ouvert 13 de l'ADR 0100).
  'vulnerabilites',
  // Veille réglementaire (ADR 0110) : hors des modules métier, comme les vulnérabilités ; droits de la matrice par défaut à
  // l'administrateur et au RSSI. La qualification se fait par le rôle RSSI (sécurité) et par le droit réservé
  // `veille_reglementaire:dpo` (données personnelles), qui ouvre aussi la lecture du module.
  'veille_reglementaire',
  'documents',
  'import_export',
  'administration',
  'parametres',
  'tableau_de_bord',
  'assistant',
  'integrations',
] as const;
export type Module = (typeof MODULES)[number];
export type BusinessModule = (typeof BUSINESS_MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  audit: 'Audit (référentiels et couverture)',
  ecarts: 'Écarts et actions',
  plan_audit: "Plan d'audit",
  pilotage: 'Pilotage du SMSI',
  fournisseurs: 'Fournisseurs',
  conformite: 'Conformité (ReCyF)',
  incidents: 'Incidents et PCA/PRA',
  cartographie: 'Cartographie du SMSI',
  vulnerabilites: 'Vulnérabilités',
  veille_reglementaire: 'Veille réglementaire',
  documents: 'Documents et liens',
  import_export: 'Import et export',
  administration: 'Administration (comptes, groupes, rôles, sessions, journal)',
  parametres: 'Paramètres',
  tableau_de_bord: 'Tableau de bord de l’accueil (disposition et partage)',
  assistant: 'Assistant RSSI (dialogue, réglages)',
  integrations: 'Intégrations (connecteurs vers des outils externes)',
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

/** Libellé propre à une action d'un module, quand l'action générique ne dit pas ce qu'elle permet (écran des rôles). */
export const ACTION_LABELS_MODULE: Partial<Record<Module, Partial<Record<Action, string>>>> = {
  tableau_de_bord: { modifier: 'Créer et partager', administrer: 'Publier pour tous' },
};
export const libelleAction = (m: Module, a: Action) => ACTION_LABELS_MODULE[m]?.[a] ?? ACTION_LABELS[a];

/** Droits réservés, hors de la matrice module × action (droits spéciaux cumulables de l'addendum de l'ADR 0092, point 5 ;
    décisions du RSSI du 20/11/2026). Chacun appartient au module nommé avant « : » (désactiver le module le retire, comme
    les autres droits du module), se coche dans un rôle personnalisé et s'ajoute aux droits de la matrice.
    - `veille_reglementaire:dpo` (ADR 0110 ; décision du RSSI du 20/11/2026 : « DPO » est un droit spécial cumulable, qui
      s'ajoute à un profil ou à un rôle personnalisé, en attendant le lot 3 de l'ADR 0092) : lire la veille réglementaire et
      qualifier les publications du domaine « données personnelles ». Donné à personne d'office, pas même à l'administrateur
      ni au RSSI (DROITS_HORS_ROLES_PREDEFINIS). */
export const PERMISSIONS_RESERVEES = ['veille_reglementaire:dpo'] as const;
export type PermissionReservee = (typeof PERMISSIONS_RESERVEES)[number];
export const PERMISSION_RESERVEE_LIBELLES: Record<PermissionReservee, string> = {
  'veille_reglementaire:dpo':
    'DPO : lire la veille réglementaire et qualifier les publications « données personnelles »',
};
/** Droits réservés que les rôles prédéfinis Administrateur et RSSI ne reçoivent pas d'office et qui n'entrent pas dans
    « tous les droits » : ils ne se tiennent que par un rôle personnalisé (directement ou par un groupe). La qualification
    « données personnelles » exige le droit DPO, même pour l'administrateur (décision du RSSI du 20/11/2026, ADR 0110). */
export const DROITS_HORS_ROLES_PREDEFINIS: readonly PermissionReservee[] = ['veille_reglementaire:dpo'];
const HORS_ROLES_PREDEFINIS: ReadonlySet<string> = new Set(DROITS_HORS_ROLES_PREDEFINIS);

export type Permission = `${Module}:${Action}` | PermissionReservee;
export const ALL_PERMISSIONS: readonly Permission[] = [
  ...MODULES.flatMap((m) => ACTIONS.map((a) => `${m}:${a}` as Permission)),
  ...PERMISSIONS_RESERVEES,
];
const RESERVEES: ReadonlySet<string> = new Set(PERMISSIONS_RESERVEES);
export const estPermissionReservee = (p: string): p is PermissionReservee => RESERVEES.has(p);
/** Libellé d'un droit, en clair : « Module — Action », ou le libellé du droit réservé précédé de son module. */
export function libellePermission(p: Permission): string {
  const [m, a] = p.split(':') as [Module, string];
  if (estPermissionReservee(p)) return `${MODULE_LABELS[m]} — ${PERMISSION_RESERVEE_LIBELLES[p]}`;
  return `${MODULE_LABELS[m]} — ${libelleAction(m, a as Action)}`;
}
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
    // Tous, sauf les droits spéciaux qui ne vont à aucun rôle prédéfini (DPO).
    permissions: ALL_PERMISSIONS.filter((p) => !HORS_ROLES_PREDEFINIS.has(p)),
  },
  rssi: {
    name: 'RSSI',
    description: 'Tous les droits, sauf l’administration technique (comptes, groupes, rôles, sessions, journal).',
    permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith('administration:') && !HORS_ROLES_PREDEFINIS.has(p)),
  },
  contributeur: {
    name: 'Contributeur',
    description:
      'Lire et modifier les modules métier, les documents et les liens ; exporter les cartes ; disposer et partager son tableau de bord.',
    permissions: [
      ...every([...BUSINESS_MODULES, 'documents'], ['lire', 'modifier']),
      'cartographie:exporter',
      'tableau_de_bord:modifier',
    ],
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
  plan: 'plan_audit',
  processes: 'pilotage',
  objectives: 'pilotage',
  indicators: 'pilotage',
  dda: 'pilotage',
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
  ai: 'conformite',
  incidents: 'incidents',
  crisis: 'incidents',
  branding: 'parametres',
  maps: 'cartographie',
};
/** Module de droits d'une clé legacy ; null pour les métadonnées techniques ; « parametres » pour une clé inconnue. */
export function legacyKeyModule(key: string): Module | null {
  return Object.prototype.hasOwnProperty.call(LEGACY_KEY_MODULE, key) ? LEGACY_KEY_MODULE[key]! : 'parametres';
}
