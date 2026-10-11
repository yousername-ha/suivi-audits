/* Schémas zod du module Audit (AUD-02 à AUD-11, ADR 0025) : enregistrements et corps des routes prévues. Bornes
   raisonnables, caractères de contrôle refusés (sauf tabulation et retours à la ligne dans les textes longs). Les
   dates sont au format AAAA-MM-JJ ; une date vide est `null`. */
import { z } from 'zod';
import {
  COVERAGE_VALUES,
  FINDING_SOURCES,
  FINDING_STATUSES,
  FINDING_TYPES,
  PLAN_STATUSES,
  PREP_VALUES,
  SLOT_KINDS,
} from './model.js';
import { REOPEN_REASON_MAX } from './ecarts.js';

/** Bornes des champs. */
export const AUDIT_LIMITS = {
  label: 80,
  title: 500,
  owner: 120,
  longText: 20000,
  note: 10000,
  action: 2000,
  task: 2000,
  requirementsPerFinding: 200,
  tasksPerFinding: 100,
  slotRequirements: 200,
  slotPeople: 50,
  slotProofs: 200,
  slotQuestions: 100,
} as const;

const SANS_CONTROLE = /^[^\p{Cc}]*$/u;
const SANS_CONTROLE_SAUF_LIGNES = /^(?:[^\p{Cc}]|[\t\n\r])*$/u;
/** Texte sur une ligne : aucun caractère de contrôle. */
const ligne = (max: number) => z.string().trim().max(max).regex(SANS_CONTROLE, 'Caractère interdit.');
/** Texte long : tabulations et retours à la ligne admis, aucun autre caractère de contrôle. */
const texte = (max: number) => z.string().trim().max(max).regex(SANS_CONTROLE_SAUF_LIGNES, 'Caractère interdit.');

export const Year = z.number().int().min(2000).max(2100);
/** Date facultative : AAAA-MM-JJ valide, chaîne vide ou `null` (normalisées en `null`). */
export const OptionalDate = z
  .union([z.iso.date('Date invalide (AAAA-MM-JJ).'), z.literal('')])
  .nullable()
  .transform((v) => v || null);
/** Heure HH:MM (00:00 à 23:59). */
export const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM).');
/** Identifiant d'exigence du schéma 15 : `ISO-4.1`, `ISO-6.1.2`, `A-5.15`, `HDS-01`. */
export const RequirementId = z
  .string()
  .regex(/^(ISO-\d{1,2}(\.\d{1,2}){1,3}|A-\d{1,2}\.\d{1,2}|HDS-\d{2,3})$/, 'Identifiant d’exigence invalide.');
/** Identifiant d'écart : `F01`, `GAP-01`, `INC-AC-01`, `VEI-HDS21`… */
export const FindingId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/, 'Identifiant d’écart invalide.');
/** Identifiant d'un élément du plan (jour, créneau, personne). */
export const PlanItemId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Identifiant invalide.');
const Owner = ligne(AUDIT_LIMITS.owner);

const unique = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((l) => new Set(l).size === l.length, 'Élément en double.');
const auMoinsUn = (o: Record<string, unknown>) => Object.values(o).some((v) => v !== undefined);
const RIEN = 'Aucune modification.';

/** Champs de suivi communs aux enregistrements. */
const Meta = {
  version: z.number().int().nonnegative(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string(),
  updated_by: z.string(),
};

/* ---------------------------------------------------------------- Cycle (AUD-02) */
export const CycleSchema = z.object({
  year: Year,
  label: ligne(AUDIT_LIMITS.label),
  afnorDate: OptionalDate,
  internalDate: OptionalDate,
  findingsDeadline: OptionalDate,
  ...Meta,
});
export type Cycle = z.infer<typeof CycleSchema>;
export const CycleCreateBody = z.object({ year: Year, label: ligne(AUDIT_LIMITS.label).default('') });
export const CycleUpdateBody = z
  .object({
    label: ligne(AUDIT_LIMITS.label).optional(),
    afnorDate: OptionalDate.optional(),
    internalDate: OptionalDate.optional(),
    findingsDeadline: OptionalDate.optional(),
    /** Reporter la nouvelle échéance sur les écarts non clos sans échéance ou à l'ancienne (case cochée par défaut). */
    rescheduleFindings: z.boolean().default(true),
  })
  .refine(({ rescheduleFindings: _r, ...o }) => auMoinsUn(o), RIEN);
export const AuditSettingsBody = z
  .object({ nextYear: Year.optional(), iso27001Certified: z.boolean().optional() })
  .refine(auMoinsUn, RIEN);

/* ---------------------------------------------------------------- Référentiels (AUD-03) */
export const RequirementSchema = z.object({
  id: RequirementId,
  ref: z.enum(['ISO', 'A', 'HDS']),
  num: z.string().max(20),
  title: z.string().max(AUDIT_LIMITS.title),
  group: z.string().max(20),
  depth: z.number().int().min(1).max(3),
  refText: z.string().max(AUDIT_LIMITS.longText).nullable(),
  position: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
});
export type Requirement = z.infer<typeof RequirementSchema>;
export const RequirementUpdateBody = z
  .object({
    title: ligne(AUDIT_LIMITS.title).min(1, 'Titre obligatoire.').optional(),
    refText: texte(AUDIT_LIMITS.longText).optional(),
  })
  .refine(auMoinsUn, RIEN);

/* ---------------------------------------------------------------- Couverture et préparation (AUD-04) */
export const CoverageValueSchema = z.enum(COVERAGE_VALUES);
export const CoverageSchema = z.object({
  requirement: RequirementId,
  year: Year,
  afnor: CoverageValueSchema,
  internal: CoverageValueSchema,
  version: z.number().int().nonnegative(),
});
export const CoverageUpdateBody = z
  .object({ afnor: CoverageValueSchema.optional(), internal: CoverageValueSchema.optional() })
  .refine(auMoinsUn, RIEN);
export const PrepValueSchema = z.enum(PREP_VALUES);
export const PreparationSchema = z.object({
  requirement: RequirementId,
  year: Year,
  status: PrepValueSchema,
  owner: z.string().max(AUDIT_LIMITS.owner),
  notes: z.string().max(AUDIT_LIMITS.note),
  remAfnor: z.string().max(AUDIT_LIMITS.longText),
  remInternal: z.string().max(AUDIT_LIMITS.longText),
  version: z.number().int().nonnegative(),
});
/** Les remarques AFNOR et interne viennent de l'import du fichier de préparation : elles ne se saisissent pas. */
export const PreparationUpdateBody = z
  .object({
    status: PrepValueSchema.optional(),
    owner: Owner.optional(),
    notes: texte(AUDIT_LIMITS.note).optional(),
  })
  .refine(auMoinsUn, RIEN);
/** « Reprendre la préparation de l'année précédente » : pilote et notes, pas le statut. */
export const PreparationCopyBody = z.object({ from: Year, to: Year }).refine((b) => b.from !== b.to, {
  message: 'Années identiques.',
  path: ['to'],
});

/* ---------------------------------------------------------------- Écarts et tâches (AUD-09, AUD-10) */
export const FindingTypeSchema = z.enum(FINDING_TYPES);
export const FindingStatusSchema = z.enum(FINDING_STATUSES);
export const FindingSourceSchema = z.enum(FINDING_SOURCES);

export const TaskSchema = z.object({
  id: z.string(),
  text: z.string().max(AUDIT_LIMITS.task),
  done: z.boolean(),
  createdAt: z.string().nullable(),
  due: z.iso.date().nullable(),
  owner: z.string().max(AUDIT_LIMITS.owner).nullable(),
  doneAt: z.string().nullable(),
  doneBy: z.string().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;
export const TaskCreateBody = z.object({
  text: texte(AUDIT_LIMITS.task).min(1, 'Action obligatoire.'),
  due: OptionalDate.optional(),
  owner: Owner.optional(),
});
export const TaskUpdateBody = z
  .object({
    text: texte(AUDIT_LIMITS.task).min(1, 'Action obligatoire.').optional(),
    done: z.boolean().optional(),
    due: OptionalDate.optional(),
    owner: Owner.optional(),
  })
  .refine(auMoinsUn, RIEN);

export const FindingSchema = z.object({
  id: FindingId,
  source: FindingSourceSchema,
  year: Year,
  type: FindingTypeSchema,
  status: FindingStatusSchema,
  title: z.string().max(AUDIT_LIMITS.title),
  description: z.string().max(AUDIT_LIMITS.longText),
  correctiveAction: z.string().max(AUDIT_LIMITS.action),
  comment: z.string().max(AUDIT_LIMITS.note),
  owner: z.string().max(AUDIT_LIMITS.owner),
  dueDate: z.iso.date().nullable(),
  proof: z.string().max(AUDIT_LIMITS.note),
  requirements: z.array(RequirementId).max(AUDIT_LIMITS.requirementsPerFinding),
  tasks: z.array(TaskSchema).max(AUDIT_LIMITS.tasksPerFinding),
  closedAt: z.string().nullable(),
  closedBy: z.string().nullable(),
  ...Meta,
});
export type Finding = z.infer<typeof FindingSchema>;

const findingFields = {
  source: FindingSourceSchema,
  year: Year,
  type: FindingTypeSchema,
  title: ligne(AUDIT_LIMITS.title),
  description: texte(AUDIT_LIMITS.longText),
  correctiveAction: texte(AUDIT_LIMITS.action),
  comment: texte(AUDIT_LIMITS.note),
  owner: Owner,
  dueDate: OptionalDate,
  proof: texte(AUDIT_LIMITS.note),
  requirements: unique(RequirementId, AUDIT_LIMITS.requirementsPerFinding),
};
/** Création : identifiant attribué par le serveur (`F01`…) ; valeurs par défaut de l'outil historique. */
export const FindingCreateBody = z.object({
  source: findingFields.source.default('AFNOR'),
  year: findingFields.year,
  type: findingFields.type.default('PS'),
  title: findingFields.title.default(''),
  description: findingFields.description.default(''),
  correctiveAction: findingFields.correctiveAction.default(''),
  comment: findingFields.comment.default(''),
  owner: findingFields.owner.default(''),
  dueDate: findingFields.dueDate.optional(),
  proof: findingFields.proof.default(''),
  requirements: findingFields.requirements.default([]),
  tasks: z.array(TaskCreateBody).max(AUDIT_LIMITS.tasksPerFinding).default([]),
});
/** Modification des champs (le statut passe par `FindingStatusBody`, qui applique les règles). */
export const FindingUpdateBody = z
  .object({
    source: findingFields.source.optional(),
    year: findingFields.year.optional(),
    type: findingFields.type.optional(),
    title: findingFields.title.optional(),
    description: findingFields.description.optional(),
    correctiveAction: findingFields.correctiveAction.optional(),
    comment: findingFields.comment.optional(),
    owner: findingFields.owner.optional(),
    dueDate: findingFields.dueDate.optional(),
    proof: findingFields.proof.optional(),
    requirements: findingFields.requirements.optional(),
  })
  .refine(auMoinsUn, RIEN);
/** Changement de statut ; quitter « Clos » exige un motif (réouverture). */
export const FindingStatusBody = z.object({
  status: FindingStatusSchema,
  motif: texte(REOPEN_REASON_MAX).optional(),
});
export const FindingReopenBody = z.object({
  motif: texte(REOPEN_REASON_MAX).min(1, 'Le motif de réouverture est obligatoire.'),
  status: z.enum(['Ouvert', 'En cours']).default('En cours'),
});

/* ---------------------------------------------------------------- Plan d'audit (AUD-11) */
export const PlanStatusSchema = z.enum(PLAN_STATUSES);
export const SlotKindSchema = z.enum(SLOT_KINDS);
export const PlanUpdateBody = z
  .object({ status: PlanStatusSchema.optional(), note: texte(AUDIT_LIMITS.action).optional() })
  .refine(auMoinsUn, RIEN);
export const PlanDayBody = z.object({ label: ligne(60), date: OptionalDate.optional() });
export const PlanPersonBody = z.object({
  name: ligne(AUDIT_LIMITS.owner).min(1, 'Nom obligatoire.'),
  role: ligne(AUDIT_LIMITS.owner).default(''),
});
const ProofSchema = z.object({ t: texte(1000).min(1), done: z.boolean() });

const slotFields = z.object({
  day: PlanItemId,
  type: SlotKindSchema,
  start: Time,
  end: Time,
  title: ligne(200),
  detail: texte(5000),
  place: ligne(200),
  requirements: unique(RequirementId, AUDIT_LIMITS.slotRequirements),
  people: unique(PlanItemId, AUDIT_LIMITS.slotPeople),
  proofs: z.array(ProofSchema).max(AUDIT_LIMITS.slotProofs),
  questions: z.array(texte(1000).min(1)).max(AUDIT_LIMITS.slotQuestions),
});
const finApresDebut = (s: { start?: string; end?: string }) => !s.start || !s.end || s.end >= s.start;
const FIN = { message: 'La fin du créneau précède son début.', path: ['end'] };

/** Créneau enregistré. */
export const SlotSchema = slotFields
  .extend({ id: PlanItemId, version: z.number().int().nonnegative() })
  .refine(finApresDebut, FIN);
export type Slot = z.infer<typeof SlotSchema>;
export const SlotCreateBody = slotFields
  .extend({
    type: SlotKindSchema.default('audit'),
    title: ligne(200).default(''),
    detail: texte(5000).default(''),
    place: ligne(200).default(''),
    requirements: unique(RequirementId, AUDIT_LIMITS.slotRequirements).default([]),
    people: unique(PlanItemId, AUDIT_LIMITS.slotPeople).default([]),
    proofs: z.array(ProofSchema).max(AUDIT_LIMITS.slotProofs).default([]),
    questions: z.array(texte(1000).min(1)).max(AUDIT_LIMITS.slotQuestions).default([]),
  })
  .refine(finApresDebut, FIN);
export const SlotUpdateBody = slotFields.partial().refine(auMoinsUn, RIEN).refine(finApresDebut, FIN);
