/* Registres, périmètres hérités et droits par ressource (ADR 0043).
   Un registre est un conteneur d'éléments (actions d'un plan, écarts, séries de tâches récurrentes) ; il porte un ou
   plusieurs périmètres que ses éléments héritent sans les copier. Les droits fins s'attribuent à un utilisateur ou à un
   groupe sur un registre entier ou sur un élément ; ils s'ajoutent aux droits de module et à l'appartenance aux périmètres. */
import { z } from 'zod';
import type { GrcKind } from './grc.js';

/** Familles de registre : le plan d'actions (actions autonomes), le registre d'écarts, le registre de tâches récurrentes. */
export const REGISTRE_KINDS = ['plan_actions', 'ecarts', 'recurrences'] as const;
export type RegistreKind = (typeof REGISTRE_KINDS)[number];
export const REGISTRE_LABELS: Record<RegistreKind, string> = {
  plan_actions: 'Plan d’actions',
  ecarts: 'Registre d’écarts',
  recurrences: 'Registre de tâches récurrentes',
};

/** Rôles d'une ressource, du plus faible au plus fort.
    - lecteur : consulte ;
    - contributeur : renseigne l'avancement (statut, compte rendu, réalisation) sans modifier la définition de l'élément ;
    - gestionnaire : modifie, crée, archive, attribue les droits de la ressource. */
export const ROLES_RESSOURCE = ['lecteur', 'contributeur', 'gestionnaire'] as const;
export type RoleRessource = (typeof ROLES_RESSOURCE)[number];
export const ROLE_LABELS: Record<RoleRessource, string> = {
  lecteur: 'Lecteur',
  contributeur: 'Contributeur',
  gestionnaire: 'Gestionnaire',
};
export const RANG_ROLE: Record<RoleRessource, number> = { lecteur: 1, contributeur: 2, gestionnaire: 3 };
export type Besoin = 'lire' | 'contribuer' | 'gerer';
/** Rang minimal du rôle pour chaque besoin. */
export const RANG_BESOIN: Record<Besoin, number> = { lire: 1, contribuer: 2, gerer: 3 };
export const roleSuffit = (role: RoleRessource | null, besoin: Besoin) =>
  role !== null && RANG_ROLE[role] >= RANG_BESOIN[besoin];

export const TYPES_RESSOURCE = ['registre', 'objet'] as const;
export const TYPES_SUJET = ['utilisateur', 'groupe'] as const;

/** Famille de registre qui accueille un élément : les occurrences (actions issues d'une série) vivent dans le registre de
    tâches récurrentes de leur série ; les autres types n'appartiennent à aucun registre. */
export function registreKindOf(kind: GrcKind, data: Record<string, unknown> = {}): RegistreKind | null {
  if (kind === 'task_series') return 'recurrences';
  if (kind === 'action') return typeof data.seriesId === 'string' && data.seriesId ? 'recurrences' : 'plan_actions';
  if (kind === 'nonconformity') return 'ecarts';
  return null;
}

const nom = z.string().trim().min(1).max(200);
export const RegistreBody = z
  .object({
    kind: z.enum(REGISTRE_KINDS),
    name: nom,
    description: z.string().trim().max(2000).default(''),
    /** Périmètre de référence (politique métier, fuseau) : fixé à la création, il reste l'un des périmètres du registre. */
    referenceId: z.uuid(),
    /** Périmètres complémentaires ; le périmètre de référence est toujours inclus. */
    perimetres: z.array(z.uuid()).max(50).default([]),
    /** Registre restreint : seuls les droits attribués (et les administrateurs) donnent accès. */
    restreint: z.boolean().default(false),
  })
  .strict();
export type RegistreBody = z.infer<typeof RegistreBody>;

export const RegistreUpdate = z
  .object({ name: nom, description: z.string().trim().max(2000), restreint: z.boolean() })
  .strict();
export type RegistreUpdate = z.infer<typeof RegistreUpdate>;

/** Changement des périmètres d'un registre : commande atomique, avec aperçu de l'impact puis confirmation. */
export const RegistrePerimetresBody = z
  .object({
    perimetres: z.array(z.uuid()).min(1).max(50),
    /** Aperçu seul : calcule l'impact sans rien écrire. */
    apercu: z.boolean().default(false),
    reason: z.string().trim().min(10).max(1000).optional(),
  })
  .strict();
export type RegistrePerimetresBody = z.infer<typeof RegistrePerimetresBody>;

export const DroitBody = z
  .object({
    subjectType: z.enum(TYPES_SUJET),
    subjectId: z.uuid(),
    role: z.enum(ROLES_RESSOURCE),
  })
  .strict();
export type DroitBody = z.infer<typeof DroitBody>;

/** Contribution à une action : avancement seulement (statut et compte rendu), jamais la définition. */
export const ContributionAction = z
  .object({
    status: z.string().trim().min(1).max(64),
    justification: z.string().max(5000).optional(),
  })
  .strict();
export type ContributionAction = z.infer<typeof ContributionAction>;

export interface RegistreDto {
  id: string;
  kind: RegistreKind;
  name: string;
  description: string;
  referenceId: string;
  restreint: boolean;
  archived: boolean;
  parDefaut: boolean;
  version: number;
  /** Périmètres du registre que l'utilisateur peut voir ; les autres ne sont pas nommés (voir `autresPerimetres`). */
  perimetres: { id: string; name: string }[];
  autresPerimetres: number;
  /** Rôle effectif de l'utilisateur par droit attribué (null : accès par droits de module et périmètres seulement). */
  role: RoleRessource | null;
  /** Besoins couverts pour l'utilisateur courant, toutes origines confondues. */
  peut: Record<Besoin, boolean>;
  elements: number;
}

/** Validation d'une occurrence de tâche récurrente (migration 030) : résultat, compte rendu et référence de preuve. */
export const RESULTATS_VALIDATION = ['ok', 'ko', 'na'] as const;
export type ResultatValidation = (typeof RESULTATS_VALIDATION)[number];
export const RESULTAT_LABELS: Record<ResultatValidation, string> = {
  ok: 'Réalisée (OK)',
  ko: 'Non réalisée (KO)',
  na: 'Non applicable (NA)',
};
export const ValidationOccurrenceBody = z
  .object({
    /** Identifiant de requête fourni par le client : rejouer la commande ne crée pas de second enregistrement. */
    requestId: z.uuid(),
    result: z.enum(RESULTATS_VALIDATION),
    comment: z.string().trim().max(5000).default(''),
    /** Référence d'une preuve versionnée (par exemple `document:<id>`) ; facultative. */
    proofRef: z.string().trim().max(500).default(''),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.result !== 'ok' && v.comment.length < 10)
      c.addIssue({
        code: 'custom',
        path: ['comment'],
        message: 'Un KO ou un NA se justifie (10 caractères au moins).',
      });
  });
export type ValidationOccurrenceBody = z.infer<typeof ValidationOccurrenceBody>;
export const ReouvertureOccurrenceBody = z
  .object({ requestId: z.uuid(), reason: z.string().trim().min(10).max(5000) })
  .strict();
export type ReouvertureOccurrenceBody = z.infer<typeof ReouvertureOccurrenceBody>;
export interface ValidationDto {
  id: string;
  seq: number;
  kind: 'validation' | 'reouverture';
  result: ResultatValidation | null;
  comment: string;
  proofRef: string;
  createdBy: string;
  createdAt: string;
}
/** État d'une occurrence : jamais validée, validée (dernière entrée du journal) ou rouverte. */
export type EtatValidation = 'ouverte' | 'validee' | 'rouverte';
