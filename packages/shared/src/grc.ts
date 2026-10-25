import { z } from 'zod';
import { NIVEAUX_PERIMETRE } from './hierarchie-perimetres.js';
import type { Module } from './permissions.js';
import { ResponsableRef } from './responsables.js';
export const GRC_KINDS = [
  'framework',
  'requirement',
  'measure',
  'mapping',
  'risk',
  'risk_source',
  'feared_event',
  'business_asset',
  'process',
  'support_asset',
  'strategic_scenario',
  'operational_scenario',
  'treatment',
  'action',
  'task_series',
  'control',
  'evidence',
  'audit',
  'incident',
  'nonconformity',
  'objective',
  'indicator',
  'soa',
  'context',
  'stakeholder',
  'swot',
  'governance',
  'management_review',
  'journey',
  'bia',
  'continuity_plan',
  'continuity_exercise',
  'risk_study',
  'sr_ov',
  'ecosystem_party',
  'opportunity',
] as const;
export type GrcKind = (typeof GRC_KINDS)[number];
export const GRC_MODULES: Record<GrcKind, Module> = {
  framework: 'conformite',
  requirement: 'audit',
  measure: 'audit',
  mapping: 'conformite',
  risk: 'pilotage',
  risk_source: 'pilotage',
  feared_event: 'pilotage',
  business_asset: 'pilotage',
  process: 'pilotage',
  support_asset: 'pilotage',
  strategic_scenario: 'pilotage',
  operational_scenario: 'pilotage',
  treatment: 'pilotage',
  action: 'ecarts',
  task_series: 'ecarts',
  control: 'pilotage',
  evidence: 'documents',
  audit: 'plan_audit',
  incident: 'incidents',
  nonconformity: 'ecarts',
  objective: 'pilotage',
  indicator: 'pilotage',
  soa: 'pilotage',
  context: 'pilotage',
  stakeholder: 'pilotage',
  swot: 'pilotage',
  governance: 'pilotage',
  management_review: 'pilotage',
  journey: 'pilotage',
  bia: 'pilotage',
  continuity_plan: 'pilotage',
  continuity_exercise: 'pilotage',
  risk_study: 'pilotage',
  sr_ov: 'pilotage',
  ecosystem_party: 'pilotage',
  opportunity: 'pilotage',
};
export const GRC_LABELS: Record<GrcKind, string> = {
  framework: 'Référentiel',
  requirement: 'Exigence',
  measure: 'Mesure',
  mapping: 'Correspondance',
  risk: 'Risque',
  risk_source: 'Source de risque',
  feared_event: 'Événement redouté',
  business_asset: 'Valeur métier',
  process: 'Processus',
  support_asset: 'Bien support',
  strategic_scenario: 'Scénario stratégique',
  operational_scenario: 'Scénario opérationnel',
  treatment: 'Traitement',
  action: 'Action',
  task_series: 'Tâche récurrente',
  control: 'Contrôle',
  evidence: 'Preuve',
  audit: 'Audit',
  incident: 'Incident',
  nonconformity: 'Non-conformité',
  objective: 'Objectif',
  indicator: 'Indicateur',
  soa: 'Déclaration d’applicabilité',
  context: 'Périmètre et contexte',
  stakeholder: 'Partie intéressée',
  swot: 'Analyse SWOT',
  governance: 'Responsabilité',
  management_review: 'Revue de direction',
  journey: 'Parcours guidé',
  bia: 'Analyse d’impact sur l’activité',
  continuity_plan: 'Plan de continuité ou de reprise',
  continuity_exercise: 'Exercice et retour d’expérience',
  risk_study: 'Étude EBIOS RM',
  sr_ov: 'Couple source de risque / objectif visé',
  ecosystem_party: 'Partie prenante de l’écosystème',
  opportunity: 'Opportunité',
};
export const GrcKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/)
  .refine((k) => !['constructor', 'prototype', '__proto__'].includes(k));
const label = z.string().trim().min(1).max(200);
export const GrcRef = z
  .string()
  .max(300)
  .regex(
    /^(object:[0-9a-f-]{36}|legacy:[a-z_]+:[^\p{Cc}]{1,200}|document:[0-9a-f-]{36}:[1-9][0-9]{0,8}|requirement:[0-9a-f-]{36}:[1-9][0-9]{0,8}:[^\p{Cc}]{1,120})$/u,
  )
  .superRefine((ref, c) => {
    if (['object', 'document', 'requirement'].includes(ref.split(':')[0]!)) {
      if (!z.uuid().safeParse(ref.split(':')[1]).success)
        c.addIssue({ code: 'custom', message: 'UUID de référence invalide.' });
    }
  });
export const GrcObjectBody = z
  .object({
    kind: z.enum(GRC_KINDS),
    name: label,
    data: z.record(z.string().max(100), z.unknown()).default({}),
    /** Registre d'accueil (actions, écarts, séries) ; à défaut, le registre par défaut du périmètre. */
    registreId: z.uuid().optional(),
  })
  .strict();
export type GrcObjectBody = z.infer<typeof GrcObjectBody>;
export interface GrcObject {
  id: string;
  smsiId: string;
  kind: GrcKind;
  name: string;
  data: Record<string, unknown>;
  version: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  legacyKey: string | null;
  legacyId: string | null;
  archived: boolean;
  /** Registre qui contient l'élément (actions, écarts, séries) ; null pour les autres types d'objets. */
  registreId?: string | null;
}
/** Natures proposées à la création d'un périmètre : de simples suggestions, la nature reste un libellé libre. */
export const NATURES_PERIMETRE = ['SMSI', 'SMQ', 'SMI'] as const;
const natureLibelle = z.string().trim().max(60);
const fuseau = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('fr', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Fuseau inconnu.');
export const SmsiCreate = z
  .object({
    name: label,
    scope: z.string().max(5000),
    nature: natureLibelle.default(''),
    parentId: z.uuid().nullable().default(null),
    entityKind: z.enum(NIVEAUX_PERIMETRE).default('perimetre'),
    inheritFrameworks: z.boolean().default(false),
    visibility: z.literal('restricted').default('restricted'),
    timezone: fuseau,
  })
  .strict();
/** Modification d'un périmètre : nom, texte du périmètre, nature et fuseau (version attendue en If-Match). */
export const SmsiUpdate = z
  .object({
    name: label,
    scope: z.string().max(5000),
    nature: natureLibelle,
    timezone: fuseau,
    /** Absents : inchangés. `parentId: null` détache le périmètre de son parent. */
    parentId: z.uuid().nullable().optional(),
    entityKind: z.enum(NIVEAUX_PERIMETRE).optional(),
    inheritFrameworks: z.boolean().optional(),
    confirm: z.literal('ENREGISTRER'),
  })
  .strict();
export type SmsiUpdate = z.infer<typeof SmsiUpdate>;
export const SmsiMember = z.object({ userId: z.uuid(), write: z.boolean() }).strict();
export const OfficialSource = z
  .object({
    organisation: z.string().min(1).max(120),
    document: z.string().min(1).max(300),
    url: z.url().refine((x) => new URL(x).protocol === 'https:'),
    version: z.string().min(1).max(100),
    date: z.string().max(30),
    license: z.string().min(1).max(1000),
    verifiedAt: z.string().max(30),
    normative: z.boolean(),
    status: z.enum(['official_verified', 'licensed_import', 'organisation', 'unverified']),
  })
  .strict();
export const FrameworkDefinition = z
  .object({
    name: label,
    identifier: z.string().min(1).max(100),
    source: OfficialSource,
    /** Présent seulement sur une copie de l'organisation : référentiel d'origine. Une version sans cette marque est une
        version source, verrouillée : on ne la modifie pas, on en crée une copie. */
    derivedFrom: z
      .object({ identifier: z.string().min(1).max(100), name: label, version: z.number().int().positive() })
      .strict()
      .optional(),
    domains: z.array(z.object({ id: GrcKey, label }).strict()).max(1000),
    requirements: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            domain: GrcKey,
            title: label,
            description: z.string().max(20000),
            applicability: z.string().max(2000),
            measureRefs: z.array(GrcRef).max(100).default([]),
            /** Champs facultatifs des contrôles de l'organisation (kit IA, ADR 0055) ; absents des référentiels officiels. */
            auditQuestion: z.string().max(2000).optional(),
            expectedEvidence: z.string().max(2000).optional(),
            eligibleScopes: z
              .array(z.enum(['external', 'business']))
              .max(2)
              .optional(),
            priority: z.string().max(40).optional(),
            ownerFunction: z.string().max(200).optional(),
            reviewFrequency: z.string().max(100).optional(),
            themeIso42001: z.string().max(200).optional(),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict()
  .superRefine((d, c) => {
    const domains = new Set(d.domains.map((x) => x.id));
    if (domains.size !== d.domains.length || new Set(d.requirements.map((x) => x.id)).size !== d.requirements.length)
      c.addIssue({ code: 'custom', message: 'Domaines et exigences : identifiants uniques requis.' });
    if (d.requirements.some((r) => !domains.has(r.domain)))
      c.addIssue({ code: 'custom', message: 'Domaine d’exigence inconnu.' });
    if (d.source.normative && d.source.status === 'organisation')
      c.addIssue({ code: 'custom', message: 'Un choix organisationnel ne peut être présenté comme normatif.' });
  });
export type FrameworkDefinition = z.infer<typeof FrameworkDefinition>;
/** Définition d'un référentiel de la bibliothèque (ADR 0031) : celle d'un périmètre, sans lien vers des mesures. Un lien
    entre une exigence et une mesure est une donnée de périmètre : il ne figure jamais dans la bibliothèque. */
export const LibraryFrameworkDefinition = FrameworkDefinition.superRefine((d, c) => {
  if (d.requirements.some((r) => r.measureRefs.length))
    c.addIssue({
      code: 'custom',
      message:
        'Une exigence de la bibliothèque ne porte aucun lien vers une mesure : ces liens sont propres à un périmètre.',
    });
});
export type LibraryFrameworkDefinition = z.infer<typeof LibraryFrameworkDefinition>;
/** Copie personnalisable d'un référentiel de la bibliothèque : nom de la copie, identifiant facultatif. */
export const LibraryCopyBody = z
  .object({ name: label, identifier: z.string().trim().min(1).max(100).optional() })
  .strict();
export type LibraryCopyBody = z.infer<typeof LibraryCopyBody>;
/** Ajout ou modification d'une exigence (mesure) dans une copie : domaine existant, ou nouveau domaine par son libellé. */
export const LibraryRequirementBody = z
  .object({
    expectedVersion: z.number().int().positive(),
    domain: GrcKey.optional(),
    newDomainLabel: label.optional(),
    id: z.string().trim().min(1).max(120),
    title: label,
    description: z.string().max(20000).default(''),
    applicability: z.string().max(2000).default(''),
  })
  .strict()
  .refine((b) => !!b.domain !== !!b.newDomainLabel, 'Indiquez un domaine existant ou le libellé d’un nouveau domaine.');
export type LibraryRequirementBody = z.infer<typeof LibraryRequirementBody>;

/** Correspondance organisationnelle entre deux exigences de la bibliothèque (ADR 0031) : validée une fois pour toute
    l'organisation. La validation est une décision humaine, jamais une conséquence d'une importation ni d'une IA. */
const ExtremiteCorrespondance = z
  .object({ frameworkId: z.uuid(), version: z.number().int().positive(), requirementId: z.string().min(1).max(120) })
  .strict();
export const LibraryMappingBody = z
  .object({
    source: ExtremiteCorrespondance,
    target: ExtremiteCorrespondance,
    type: z.enum(['identical', 'equivalent', 'partial', 'complementary', 'related', 'none']),
    justification: z.string().trim().min(10).max(5000),
    coverage: z.number().int().min(0).max(100),
    origin: z.enum(['human', 'ai']),
    sourceUrl: z.url(),
  })
  .strict();
export type LibraryMappingBody = z.infer<typeof LibraryMappingBody>;
/** Décision du pilote sur des propositions de rapprochement : confirmer crée un lien explicite, rejeter garde le motif. */
export const RapprochementDecision = z
  .object({
    ids: z.array(z.uuid()).min(1).max(100),
    decision: z.enum(['confirm', 'reject']),
    note: z.string().trim().max(2000).default(''),
    confirm: z.literal('DECIDER'),
  })
  .strict()
  .refine((d) => d.decision === 'confirm' || d.note.length >= 5, {
    message: 'Un rejet exige un motif d’au moins 5 caractères.',
    path: ['note'],
  });
export type RapprochementDecision = z.infer<typeof RapprochementDecision>;
export const MappingData = z
  .object({
    source: z
      .object({ frameworkId: z.uuid(), version: z.number().int().positive(), requirementId: z.string().max(120) })
      .strict(),
    target: z
      .object({ frameworkId: z.uuid(), version: z.number().int().positive(), requirementId: z.string().max(120) })
      .strict(),
    type: z.enum(['identical', 'equivalent', 'partial', 'complementary', 'related', 'none']),
    justification: z.string().trim().min(10).max(5000),
    coverage: z.number().min(0).max(100),
    origin: z.enum(['human', 'ai']),
    status: z.enum(['proposed', 'reviewed', 'validated']),
    sourceUrl: z.url(),
    reviewNote: z.string().max(5000).default(''),
  })
  .strict();
export type MappingData = z.infer<typeof MappingData>;
export const Recurrence = z
  .object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat('fr', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, 'Fuseau inconnu.'),
    unit: z.enum(['day', 'week', 'month', 'year']),
    interval: z.number().int().min(1).max(365),
    until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    count: z.number().int().min(1).max(100000).nullable(),
    reminderDays: z.number().int().min(0).max(365),
    active: z.boolean(),
    /** Fenêtre de réalisation d'une occurrence autour de son échéance : ouverte `openDays` jours avant, fermée `closeDays`
        jours après. Sans fenêtre, une occurrence reste ouverte tant qu'elle n'est pas validée. */
    window: z
      .object({ openDays: z.number().int().min(0).max(365), closeDays: z.number().int().min(0).max(365) })
      .strict()
      .nullable()
      .optional(),
    /** Jours exclus : une échéance qui tombe un jour exclu (date précise ou jour de la semaine, 0 = dimanche) est reportée
        au prochain jour disponible ; deux échéances reportées sur le même jour n'en font qu'une. */
    excludedDays: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .max(1000)
      .optional(),
    excludedWeekdays: z.array(z.number().int().min(0).max(6)).max(6).optional(),
  })
  .strict()
  .superRefine((r, c) => {
    if (!validDate(r.start) || (r.until && (!validDate(r.until) || r.until < r.start)))
      c.addIssue({ code: 'custom', message: 'Dates réelles et fin postérieure au début requises.' });
    if (r.excludedDays?.some((d) => !validDate(d)))
      c.addIssue({ code: 'custom', path: ['excludedDays'], message: 'Jours exclus : dates réelles requises.' });
    if (r.excludedDays && new Set(r.excludedDays).size !== r.excludedDays.length)
      c.addIssue({
        code: 'custom',
        path: ['excludedDays'],
        message: 'Jours exclus : un jour ne peut figurer deux fois.',
      });
    if (r.excludedWeekdays && new Set(r.excludedWeekdays).size !== r.excludedWeekdays.length)
      c.addIssue({ code: 'custom', path: ['excludedWeekdays'], message: 'Jours de la semaine exclus en double.' });
  });
export type Recurrence = z.infer<typeof Recurrence>;
export function validDate(s: string) {
  const d = new Date(s + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export const TaskData = z
  .object({
    description: z.string().max(10000),
    status: GrcKey,
    ownerId: z.uuid().nullable(),
    /** Responsable typé (personne, groupe ou fonction) ; pour une personne, `ownerId` en reprend l'identifiant. */
    responsable: ResponsableRef.nullable().optional(),
    startAt: z.iso.datetime().nullable(),
    dueAt: z.iso.datetime().nullable(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    category: GrcKey,
    justification: z.string().max(10000),
    reminderDays: z.number().int().min(0).max(365),
    dependencies: z.array(z.uuid()).max(100),
    seriesId: z.uuid().optional(),
    occurrenceKey: z.string().max(200).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.startAt && v.dueAt && v.startAt > v.dueAt)
      c.addIssue({ code: 'custom', message: 'Le début doit précéder l’échéance.' });
  });
export type TaskData = z.infer<typeof TaskData>;
export const SeriesData = z
  .object({
    description: z.string().max(10000),
    ownerId: z.uuid().nullable(),
    responsable: ResponsableRef.nullable().optional(),
    category: GrcKey,
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    recurrence: Recurrence,
    refs: z.array(GrcRef).max(100),
  })
  .strict();
export type SeriesData = z.infer<typeof SeriesData>;
export const RiskData = z
  .object({
    description: z.string().max(10000),
    code: z.string().max(100),
    ownerId: z.uuid().nullable(),
    methodId: z.uuid(),
    methodVersion: z.number().int().positive(),
    domain: z.string().max(120),
    entity: z.string().max(200),
    scope: z.string().max(2000),
    strategy: z.enum(['reduce', 'accept', 'transfer', 'avoid', 'treated']),
    acceptanceReason: z.string().max(5000),
    reviewAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    // Processus ISO/IEC 27005 et filiation EBIOS RM (lot U3) : champs facultatifs, absents des fiches antérieures.
    studyRef: GrcRef.nullable().optional(),
    scenarioRef: GrcRef.nullable().optional(),
    assetRefs: z.array(GrcRef).max(100).optional(),
    threat: z.string().max(10000).optional(),
    vulnerability: z.string().max(10000).optional(),
    consequences: z.string().max(10000).optional(),
    stages: z.record(
      GrcKey,
      z
        .object({
          status: z.enum(['draft', 'reviewed', 'validated']),
          values: z.record(
            GrcKey,
            z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.array(GrcRef).max(100)]),
          ),
          comment: z.string().max(5000),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.strategy === 'accept' && v.acceptanceReason.trim().length < 10)
      c.addIssue({ code: 'custom', message: 'Une acceptation doit être justifiée.' });
  });
export type RiskData = z.infer<typeof RiskData>;
export const LinkBody = z
  .object({
    target: GrcRef,
    type: z.enum([
      'related_to',
      'supports',
      'impacts',
      'applies_to',
      'depends_on',
      'implements',
      'demonstrates',
      'treats',
    ]),
    note: z.string().max(2000),
  })
  .strict();
export const FrameworkImport = z
  .object({ definition: FrameworkDefinition, mappings: z.array(MappingData).max(1000).default([]) })
  .strict();

/** Champs de liaison typés des risques (lot U3) : leurs références sont résolues et contrôlées comme « refs ». */
export const CHAMPS_REF_RISQUES = [
  'studyRef',
  'scopeRefs',
  'processRefs',
  'businessAssetRefs',
  'businessAssetRef',
  'sourceRef',
  'fearedEventRefs',
  'partyRefs',
  'srOvRef',
  'strategicScenarioRef',
  'supportAssetRefs',
  'riskRefs',
  'measureRefs',
  'scenarioRef',
  'assetRefs',
  'auditRef',
  'recidiveRef',
];

export function grcReferences(data: Record<string, unknown>): string[] {
  const pilotage = data.pilotage && typeof data.pilotage === 'object' ? (data.pilotage as Record<string, unknown>) : {};
  const historic =
    !Array.isArray(pilotage.refs) && data.links && typeof data.links === 'object' && !Array.isArray(data.links)
      ? Object.entries(data.links).flatMap(([key, ids]) =>
          ['items', 'findings', 'plans', 'recurring', 'indicators', 'suppliers'].includes(key) && Array.isArray(ids)
            ? ids.filter((id) => typeof id === 'string').map((id) => `legacy:${key}:${id}`)
            : [],
        )
      : [];
  const stages =
    data.stages && typeof data.stages === 'object'
      ? Object.values(data.stages as Record<string, { values?: Record<string, unknown> }>)
      : [];
  // Champs de liaison typés des risques (lot U3, RISK_REF_KINDS) et socle d'une étude EBIOS RM.
  const typees = Object.entries(data).flatMap(([key, v]) =>
    CHAMPS_REF_RISQUES.includes(key) ? (typeof v === 'string' ? [v] : Array.isArray(v) ? v : []) : [],
  );
  const socle = Array.isArray(data.baseline)
    ? data.baseline.flatMap((b) =>
        b && typeof b === 'object' && Array.isArray((b as Record<string, unknown>).requirementRefs)
          ? ((b as Record<string, unknown>).requirementRefs as unknown[])
          : [],
      )
    : [];
  return [
    ...(Array.isArray(data.refs) ? data.refs : []),
    ...(Array.isArray(data.documentRefs) ? data.documentRefs : []),
    ...typees,
    ...socle,
    ...(Array.isArray(pilotage.refs) ? pilotage.refs : []),
    ...(Array.isArray(pilotage.documentRefs) ? pilotage.documentRefs : []),
    ...historic,
    ...stages.flatMap((stage) => Object.values(stage.values ?? {}).flatMap((v) => (Array.isArray(v) ? v : []))),
  ].filter((ref): ref is string => GrcRef.safeParse(ref).success);
}
