/* Registres, périmètres hérités et droits par ressource (ADR 0043).
   Un registre est un conteneur d'éléments (actions d'un plan, écarts, séries de tâches récurrentes) ; il porte un ou
   plusieurs périmètres que ses éléments héritent sans les copier. Les droits fins s'attribuent à un utilisateur ou à un
   groupe sur un registre entier ou sur un élément ; ils s'ajoutent aux droits de module et à l'appartenance aux périmètres. */
import { z } from 'zod';
import type { GrcKind } from './grc.js';
import { ResponsableRef } from './responsables.js';

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

/** Plan d'actions conteneur : statut propre au plan (distinct du statut de chacune de ses actions). */
export const STATUTS_PLAN_REGISTRE = ['prevu', 'en_cours', 'termine', 'abandonne'] as const;
export type StatutPlanRegistre = (typeof STATUTS_PLAN_REGISTRE)[number];
export const STATUT_PLAN_REGISTRE_LABELS: Record<StatutPlanRegistre, string> = {
  prevu: 'Prévu',
  en_cours: 'En cours',
  termine: 'Terminé',
  abandonne: 'Abandonné',
};
const dateJour = z.iso.date();
/** Champs d'un plan d'actions ; hors famille « plan d'actions », le serveur les refuse. */
const champsPlan = {
  dateDebut: dateJour.nullable(),
  dateFin: dateJour.nullable(),
  statut: z.enum(STATUTS_PLAN_REGISTRE),
  responsable: ResponsableRef.nullable(),
};
const finApresDebut = (v: { dateDebut?: string | null; dateFin?: string | null }) =>
  !v.dateDebut || !v.dateFin || v.dateDebut <= v.dateFin;
const MESSAGE_DATES = { message: 'La date de fin ne peut pas précéder la date de début.', path: ['dateFin'] };
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
    dateDebut: champsPlan.dateDebut.default(null),
    dateFin: champsPlan.dateFin.default(null),
    statut: champsPlan.statut.default('prevu'),
    responsable: champsPlan.responsable.default(null),
  })
  .strict()
  .refine(finApresDebut, MESSAGE_DATES);
export type RegistreBody = z.infer<typeof RegistreBody>;

/** Les champs d'un plan sont facultatifs : absents, ils gardent leur valeur ; `null` efface une date ou le responsable. */
export const RegistreUpdate = z
  .object({
    name: nom,
    description: z.string().trim().max(2000),
    restreint: z.boolean(),
    dateDebut: champsPlan.dateDebut.optional(),
    dateFin: champsPlan.dateFin.optional(),
    statut: champsPlan.statut.optional(),
    responsable: champsPlan.responsable.optional(),
  })
  .strict()
  .refine(finApresDebut, MESSAGE_DATES);
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
    /** Motif facultatif, conservé au journal d'audit avec l'ancien rôle. */
    motif: z.string().trim().max(500).optional(),
    /** Aperçu seul : calcule l'effet de l'attribution sans rien écrire. */
    apercu: z.boolean().default(false),
  })
  .strict();
export type DroitBody = z.infer<typeof DroitBody>;
/** Effet d'une attribution de droit, calculé par le serveur avant confirmation. */
export interface ApercuDroit {
  apercu: true;
  titulaire: { type: 'utilisateur' | 'groupe'; id: string; libelle: string };
  avant: RoleRessource | null;
  apres: RoleRessource;
  /** Personnes touchées : 1 pour un compte, le nombre de membres actifs pour un groupe. */
  personnes: number;
  /** Autres rôles que le titulaire garde sur la ressource (par ses groupes), qui continuent de s'appliquer. */
  subsistants: { role: RoleRessource; libelle: string }[];
  /** Pour un groupe : membres qui ont déjà un rôle direct plus élevé (leur rôle ne change pas). */
  dejaPlusEleves: number;
  inchange: boolean;
}

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
  /** Plan d'actions seulement : dates, statut, responsable et avancement (actions terminées sur actions suivies). */
  dateDebut: string | null;
  dateFin: string | null;
  statut: StatutPlanRegistre;
  responsable: ResponsableRef | null;
  avancement: { total: number; terminees: number };
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

/** Déplacement d'un élément vers un autre registre de la même famille : commande atomique, avec aperçu d'impact puis
    confirmation motivée. Une série se déplace avec ses occurrences. */
export const DeplacementBody = z
  .object({
    registreId: z.uuid(),
    /** Aperçu seul : calcule l'impact sans rien écrire. */
    apercu: z.boolean().default(false),
    /** Les liens vers des fiches d'un autre périmètre de référence ne survivent pas au déplacement : à retirer en connaissance de cause. */
    retirerLiensIncompatibles: z.boolean().default(false),
    reason: z.string().trim().min(10).max(1000).optional(),
  })
  .strict();
export type DeplacementBody = z.infer<typeof DeplacementBody>;
export interface ImpactDeplacement {
  depuis: { id: string; name: string; perimetres: { id: string; name: string }[] };
  vers: { id: string; name: string; perimetres: { id: string; name: string }[] };
  /** Éléments déplacés (la série et ses occurrences comptent chacune). */
  elements: number;
  /** Le périmètre de référence change : politique métier, fuseau et appartenance se lisent désormais dans le nouveau. */
  referenceChange: boolean;
  liensConserves: number;
  liensIncompatibles: { ref: string; type: string; nom: string }[];
  /** Obstacles bloquants (état inconnu du workflow cible, responsable non autorisé…). */
  problemes: string[];
}

/** Ordre des actions d'un plan : identifiants dans l'ordre voulu (les actions non citées passent après). */
export const OrdreBody = z.object({ ids: z.array(z.uuid()).min(1).max(1000) }).strict();
export type OrdreBody = z.infer<typeof OrdreBody>;

/* ---------------------------------------------------------------------------------------- Vue des accès d'un sujet */
/** Origine d'un rôle de ressource : attribué à la personne elle-même ou reçu d'un groupe. */
export interface OrigineDroit {
  type: 'direct' | 'groupe';
  libelle: string;
}
/** Accès d'une personne ou d'un groupe à un registre, tel que le serveur le calcule (jamais déduit par l'écran). */
export interface AccesSujetRegistre {
  registre: {
    id: string;
    name: string;
    kind: RegistreKind;
    restreint: boolean;
    perimetres: { id: string; name: string }[];
  };
  /** Rôle de ressource le plus élevé, ou null s'il n'y en a aucun. */
  role: RoleRessource | null;
  origines: OrigineDroit[];
  /** Droits effectifs d'une personne (rôle de ressource, droits de module, périmètres) ; absent pour un groupe. */
  peut?: { lire: boolean; contribuer: boolean; gerer: boolean };
  /** D'où vient le droit de lecture : administrateur, rôle de ressource, droits de module et périmètres, ou aucun. */
  source: 'administrateur' | 'role' | 'module' | 'aucune';
}
export interface AccesSujetPage {
  sujet: { type: 'utilisateur' | 'groupe'; id: string; libelle: string };
  total: number;
  limite: number;
  decalage: number;
  items: AccesSujetRegistre[];
}
