import { z } from 'zod';
import { GrcRef, validDate, type GrcKind } from './grc.js';

const text = z.string().max(10000);
const date = z
  .string()
  .refine((s) => !s || validDate(s), 'Date invalide.')
  .default('');
const refs = z.array(GrcRef).max(100).default([]);
const common = z.object({ description: text.default(''), ownerId: z.uuid().nullable().default(null), refs });
export const ProofData = common
  .extend({
    category: z.string().max(64).default(''),
    source: text.default(''),
    validUntil: date,
    status: z.enum(['draft', 'review', 'validated', 'rejected']).default('draft'),
    documentRefs: z
      .array(GrcRef.refine((r) => r.startsWith('document:'), 'Version de document requise.'))
      .max(100)
      .default([]),
    justification: text.default(''),
  })
  .passthrough();
export const ControlData = common
  .extend({
    objective: text.default(''),
    scope: text.default(''),
    method: text.default(''),
    criteria: text.default(''),
    category: z.string().max(64).default(''),
    frequency: z.string().max(64).default(''),
    dueAt: date,
    status: z.enum(['draft', 'scheduled', 'active', 'paused']).default('draft'),
  })
  .passthrough();
export const ManagementReviewData = common
  .extend({
    heldAt: date,
    participants: text.default(''),
    inputs: text.default(''),
    decisions: text.default(''),
    followup: text.default(''),
    status: z.enum(['draft', 'review', 'validated']).default('draft'),
  })
  .passthrough();
export const ImprovementData = common
  .extend({
    origin: z.enum(['audit', 'risk', 'incident', 'measure', 'control', 'review', 'other']).default('other'),
    findingType: z.enum(['observation', 'nonconformity', 'opportunity']).default('nonconformity'),
    cause: text.default(''),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    dueAt: date,
    status: z.enum(['draft', 'open', 'progress', 'effectiveness', 'closed']).default('open'),
    effectiveness: z.enum(['pending', 'effective', 'ineffective']).default('pending'),
    effectivenessNote: text.default(''),
    closureNote: text.default(''),
    closedAt: date,
  })
  .passthrough();
export const BiaData = common
  .extend({
    scope: text.default(''),
    activity: text.default(''),
    service: text.default(''),
    scenario: text.default(''),
    criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    maxInterruptionHours: z.number().min(0).max(87600).nullable().default(null),
    recoveryHours: z.number().min(0).max(87600).nullable().default(null),
    dataLossHours: z.number().min(0).max(87600).nullable().default(null),
    minimumService: text.default(''),
    resources: text.default(''),
    dependencies: text.default(''),
    impacts: z
      .array(
        z
          .object({
            hours: z.number().min(0).max(87600),
            business: text,
            financial: text,
            legal: text,
            reputation: text,
          })
          .strict(),
      )
      .max(30)
      .default([]),
    status: z.enum(['draft', 'review', 'validated']).default('draft'),
    justification: text.default(''),
  })
  .passthrough()
  .superRefine((d, c) => {
    if (d.recoveryHours !== null && d.maxInterruptionHours !== null && d.recoveryHours > d.maxInterruptionHours)
      c.addIssue({ code: 'custom', message: 'L’objectif de reprise doit respecter la durée maximale d’interruption.' });
    if (new Set(d.impacts.map((i) => i.hours)).size !== d.impacts.length)
      c.addIssue({ code: 'custom', message: 'Un seul impact par durée d’interruption.' });
  });
export const ContinuityData = common
  .extend({
    planType: z.enum(['pca', 'pra', 'pcra', 'activity']).default('pca'),
    scope: text.default(''),
    trigger: text.default(''),
    strategy: text.default(''),
    procedures: text.default(''),
    roles: text.default(''),
    workaround: text.default(''),
    returnToNormal: text.default(''),
    testedAt: date,
    reviewAt: date,
    status: z.enum(['draft', 'review', 'validated']).default('draft'),
    justification: text.default(''),
  })
  .passthrough();
export const ExerciseData = common
  .extend({
    plannedAt: date,
    performedAt: date,
    scenario: text.default(''),
    criteria: text.default(''),
    result: z.enum(['pending', 'success', 'partial', 'failure']).default('pending'),
    observations: text.default(''),
    lessons: text.default(''),
    improvements: text.default(''),
    status: z.enum(['planned', 'done']).default('planned'),
  })
  .passthrough();
export const JourneyData = common
  .extend({
    organisation: z.string().max(200).default(''),
    scope: text.default(''),
    goals: text.default(''),
    approach: z.enum(['quality', 'security', 'hds', 'integrated', 'custom']).default('integrated'),
    hdsActivities: text.default(''),
    hdsApplicability: text.default(''),
  })
  .passthrough();
export const PILOTAGE_SCHEMAS = {
  evidence: ProofData,
  control: ControlData,
  management_review: ManagementReviewData,
  nonconformity: ImprovementData,
  bia: BiaData,
  continuity_plan: ContinuityData,
  continuity_exercise: ExerciseData,
  journey: JourneyData,
};
export type PilotageKind = keyof typeof PILOTAGE_SCHEMAS;
export const PilotageRecord = z
  .object({
    operation: z.enum([
      'proof_review',
      'control_execution',
      'effectiveness',
      'close',
      'step_validation',
      'approval',
      'action_create',
    ]),
    requestId: z.uuid(),
    note: z.string().trim().min(10).max(10000),
    date: z.string().refine(validDate, 'Date réelle requise.'),
    result: z.enum(['accepted', 'rejected', 'pass', 'partial', 'fail', 'effective', 'ineffective', 'completed']),
    refs,
    step: z.string().max(64).default(''),
    createFinding: z.boolean().default(false),
    createAction: z.boolean().default(false),
    confirm: z.literal('ENREGISTRER'),
  })
  .strict();
export type PilotageRecord = z.infer<typeof PilotageRecord>;

export const JOURNEY_STEPS = [
  {
    id: 'context',
    label: 'Comprendre l’organisation',
    why: 'Identifier les enjeux et les personnes concernées.',
    todo: 'Décrire l’organisation, les enjeux et les attentes.',
    kinds: ['context', 'stakeholder', 'swot'],
    legacy: ['scope', 'interested', 'swots'],
    href: 'contexte',
    actors: 'Direction et responsables métier',
    document: 'Contexte et attentes',
  },
  {
    id: 'scope',
    label: 'Définir le périmètre',
    why: 'Savoir quelles activités et quels services piloter.',
    todo: 'Définir les entités, activités, services, interfaces et exclusions justifiées.',
    kinds: ['context', 'process'],
    legacy: ['scope', 'processes'],
    href: 'contexte',
    actors: 'Direction et responsables de processus',
    document: 'Périmètre justifié',
  },
  {
    id: 'governance',
    label: 'Organiser les responsabilités',
    why: 'Attribuer les décisions, ressources et objectifs.',
    todo: 'Identifier les responsables et formaliser la politique et les objectifs.',
    kinds: ['governance', 'objective'],
    legacy: ['roles', 'objectives'],
    href: 'responsabilites',
    actors: 'Direction et pilotes de processus',
    document: 'Politique, responsabilités et objectifs',
  },
  {
    id: 'risks',
    label: 'Apprécier les risques',
    why: 'Prioriser les situations qui affectent vos objectifs.',
    todo: 'Choisir une méthode, apprécier les risques et enregistrer des décisions justifiées.',
    kinds: ['risk'],
    legacy: [],
    href: 'risques',
    actors: 'Pilotes métier et responsable des risques',
    document: 'Registre et décisions de risque',
  },
  {
    id: 'treatment',
    label: 'Organiser le traitement',
    why: 'Transformer les décisions en mesures et actions.',
    todo: 'Choisir les traitements, responsables et échéances puis suivre les actions.',
    kinds: ['treatment', 'action', 'measure'],
    legacy: ['items', 'plans', 'findings'],
    href: 'actions',
    actors: 'Responsables des mesures',
    document: 'Plan de traitement et d’actions',
  },
  {
    id: 'applicability',
    label: 'Justifier l’applicabilité',
    why: 'Expliquer les exigences retenues ou écartées.',
    todo: 'Relier les exigences publiées, l’applicabilité et les décisions ; utiliser la DdA pour la démarche SSI.',
    kinds: ['soa'],
    legacy: ['dda'],
    href: 'applicabilite',
    actors: 'Responsable de la démarche',
    document: 'Applicabilité et justifications',
  },
  {
    id: 'documents',
    label: 'Rassembler les documents',
    why: 'Conserver les politiques, procédures et justificatifs utiles.',
    todo: 'Réutiliser des documents existants et examiner leurs versions exactes.',
    kinds: ['evidence'],
    legacy: ['evidences'],
    href: 'preuves',
    actors: 'Responsables documentaires',
    document: 'Politiques, procédures et preuves',
  },
  {
    id: 'monitoring',
    label: 'Mesurer et contrôler',
    why: 'Vérifier le fonctionnement réel du dispositif.',
    todo: 'Suivre objectifs, indicateurs, mesures et contrôles.',
    kinds: ['control', 'indicator', 'objective'],
    legacy: ['indicators', 'objectives'],
    href: 'controles',
    actors: 'Pilotes de processus',
    document: 'Indicateurs et résultats de contrôle',
  },
  {
    id: 'audit',
    label: 'Préparer l’audit interne',
    why: 'Évaluer la démarche et identifier des améliorations.',
    todo: 'Préparer le périmètre, les constats et les preuves de l’audit.',
    kinds: ['audit'],
    legacy: ['plan'],
    href: 'audits',
    actors: 'Responsable des audits',
    document: 'Programme et constats d’audit',
  },
  {
    id: 'review',
    label: 'Conduire la revue de direction',
    why: 'Décider avec les résultats et les moyens disponibles.',
    todo: 'Examiner les indicateurs, risques, audits et décisions puis assigner les actions.',
    kinds: ['management_review'],
    legacy: ['reviews'],
    href: 'revues',
    actors: 'Direction',
    document: 'Compte rendu de revue',
  },
  {
    id: 'improvement',
    label: 'Vérifier les améliorations',
    why: 'S’assurer que les actions corrigent effectivement les problèmes.',
    todo: 'Analyser les causes, vérifier l’efficacité et clôturer avec une justification.',
    kinds: ['nonconformity'],
    legacy: ['findings'],
    href: 'amelioration',
    actors: 'Pilotes d’actions et direction',
    document: 'Constats, actions et vérifications d’efficacité',
  },
] as const;

export interface PilotageField {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'select' | 'boolean' | 'refs';
  options?: { value: string; label: string }[];
  hint?: string;
}
const field = (
  key: string,
  label: string,
  type: PilotageField['type'] = 'text',
  options?: PilotageField['options'],
): PilotageField => ({ key, label, type, options });
const status = (values: [string, string][]) =>
  field(
    'status',
    'État',
    'select',
    values.map(([value, label]) => ({ value, label })),
  );
const draftReview = status([
  ['draft', 'Brouillon'],
  ['review', 'À valider'],
]);
export const PILOTAGE_FIELDS: Partial<Record<GrcKind, PilotageField[]>> = {
  treatment: [
    field('strategy', 'Stratégie', 'select', [
      { value: 'reduce', label: 'Réduire' },
      { value: 'accept', label: 'Accepter' },
      { value: 'avoid', label: 'Éviter' },
      { value: 'transfer', label: 'Transférer' },
    ]),
    field('expectedEffect', 'Effet attendu'),
    field('verification', 'Comment vérifier le traitement'),
    field('reviewAt', 'Prochaine revue', 'date'),
  ],
  risk_source: [
    field('motive', 'Motivations'),
    field('resources', 'Ressources et capacités'),
    field('targetObjective', 'Objectif visé'),
  ],
  feared_event: [
    field('consequences', 'Conséquences'),
    field('severity', 'Gravité'),
    field('businessValue', 'Valeur métier concernée'),
  ],
  business_asset: [field('mission', 'Mission'), field('entity', 'Entité'), field('scope', 'Périmètre')],
  support_asset: [field('assetType', 'Type de bien support'), field('location', 'Localisation')],
  strategic_scenario: [field('attackPath', 'Chemin d’attaque'), field('ecosystem', 'Écosystème concerné')],
  operational_scenario: [field('attackSequence', 'Séquence d’attaque'), field('likelihood', 'Vraisemblance')],
  context: [
    field('organisation', 'Organisation'),
    field('scope', 'Activités, entités et services concernés'),
    field('interfaces', 'Interfaces et dépendances'),
    field('issues', 'Enjeux internes et externes'),
    field('exclusions', 'Exclusions et justification'),
  ],
  stakeholder: [
    field('expectations', 'Besoins et attentes'),
    field('requirements', 'Exigences pertinentes'),
    field('contact', 'Contact'),
  ],
  swot: [
    field('strengths', 'Forces'),
    field('weaknesses', 'Faiblesses'),
    field('opportunities', 'Opportunités'),
    field('threats', 'Menaces'),
  ],
  governance: [
    field('holder', 'Titulaire'),
    field('deputy', 'Suppléant'),
    field('email', 'Adresse de contact'),
    field('phone', 'Téléphone'),
    field('role', 'Rôle'),
    field('responsibilities', 'Responsabilités'),
    field('resources', 'Ressources et compétences'),
    field('commitment', 'Engagement et délégation'),
  ],
  management_review: [
    field('heldAt', 'Date de la revue', 'date'),
    field('participants', 'Participants'),
    field('inputs', 'Résultats, risques et indicateurs examinés'),
    field('decisions', 'Décisions et moyens'),
    field('followup', 'Suivi des décisions'),
    draftReview,
  ],
  process: [field('mission', 'Mission'), field('entity', 'Entité'), field('scope', 'Périmètre')],
  objective: [field('target', 'Résultat attendu'), field('dueAt', 'Échéance', 'date')],
  indicator: [
    field('value', 'Valeur mesurée', 'number'),
    field('target', 'Cible', 'number'),
    field('unit', 'Unité'),
    field('measuredAt', 'Date de mesure', 'date'),
  ],
  soa: [
    field('applicable', 'Applicable', 'boolean'),
    field('reason', 'Justification de l’applicabilité'),
    field('implemented', 'Mis en œuvre', 'boolean'),
  ],
  measure: [field('implementation', 'Mise en œuvre'), field('verification', 'Vérification attendue')],
  audit: [
    field('scope', 'Périmètre de l’audit'),
    field('plannedAt', 'Date prévue', 'date'),
    field('method', 'Méthode et programme'),
    field('criteria', 'Critères et référentiels'),
  ],
  evidence: [
    field('source', 'Origine et objet de la preuve'),
    field('validUntil', 'À revoir avant le', 'date'),
    field('documentRefs', 'Versions des documents à examiner', 'refs'),
    status([
      ['draft', 'À produire'],
      ['review', 'À examiner'],
    ]),
    field('justification', 'Justification'),
  ],
  control: [
    field('objective', 'Objectif du contrôle'),
    field('scope', 'Périmètre contrôlé'),
    field('method', 'Comment réaliser le contrôle'),
    field('criteria', 'Critères de réussite'),
    field('dueAt', 'Prochaine échéance', 'date'),
    status([
      ['draft', 'À préparer'],
      ['scheduled', 'Planifié'],
      ['active', 'En cours'],
      ['paused', 'Suspendu'],
    ]),
  ],
  nonconformity: [
    field('findingType', 'Nature du constat', 'select', [
      { value: 'observation', label: 'Constat' },
      { value: 'nonconformity', label: 'Écart / non-conformité' },
      { value: 'opportunity', label: 'Opportunité d’amélioration' },
    ]),
    field(
      'origin',
      'Origine',
      'select',
      ['audit', 'risk', 'incident', 'measure', 'control', 'review', 'other'].map((v, i) => ({
        value: v,
        label: ['Audit', 'Risque', 'Incident', 'Mesure', 'Contrôle', 'Revue de direction', 'Autre'][i]!,
      })),
    ),
    field('cause', 'Analyse des causes'),
    field('dueAt', 'Échéance', 'date'),
    field('priority', 'Priorité', 'select', [
      { value: 'low', label: 'Faible' },
      { value: 'normal', label: 'Normale' },
      { value: 'high', label: 'Haute' },
      { value: 'urgent', label: 'Urgente' },
    ]),
    status([
      ['open', 'Ouvert'],
      ['progress', 'Actions en cours'],
      ['effectiveness', 'À vérifier'],
    ]),
  ],
  bia: [
    field('activity', 'Activité'),
    field('service', 'Service rendu'),
    field('scope', 'Périmètre'),
    field('scenario', 'Scénario d’interruption'),
    field('criticality', 'Criticité de l’activité', 'select', [
      { value: 'low', label: 'Faible' },
      { value: 'medium', label: 'Moyenne' },
      { value: 'high', label: 'Haute' },
      { value: 'critical', label: 'Critique' },
    ]),
    field('maxInterruptionHours', 'Durée maximale d’interruption (heures)', 'number'),
    field('recoveryHours', 'Objectif de reprise (heures)', 'number'),
    field('dataLossHours', 'Perte de données acceptable (heures)', 'number'),
    field('minimumService', 'Service minimum attendu'),
    field('resources', 'Ressources nécessaires'),
    field('dependencies', 'Dépendances et fournisseurs'),
    draftReview,
    field('justification', 'Justification'),
  ],
  continuity_plan: [
    field('planType', 'Type de plan', 'select', [
      { value: 'pca', label: 'PCA — continuité d’activité' },
      { value: 'pra', label: 'PRA — reprise informatique' },
      { value: 'pcra', label: 'PCRA — cadre de continuité et reprise' },
      { value: 'activity', label: 'Plan propre à une activité' },
    ]),
    field('scope', 'Activités et services concernés'),
    field('trigger', 'Quand déclencher le plan'),
    field('strategy', 'Stratégie de continuité ou reprise'),
    field('procedures', 'Procédures et ordre des opérations'),
    field('roles', 'Rôles et contacts'),
    field('workaround', 'Solutions de contournement'),
    field('returnToNormal', 'Retour au fonctionnement normal'),
    field('reviewAt', 'Prochaine revue', 'date'),
    draftReview,
    field('justification', 'Justification'),
  ],
  continuity_exercise: [
    field('plannedAt', 'Date prévue', 'date'),
    field('performedAt', 'Date de réalisation', 'date'),
    field('scenario', 'Scénario testé'),
    field('criteria', 'Critères de réussite'),
    field('result', 'Résultat', 'select', [
      { value: 'pending', label: 'Non réalisé' },
      { value: 'success', label: 'Réussi' },
      { value: 'partial', label: 'Partiellement réussi' },
      { value: 'failure', label: 'Échec' },
    ]),
    field('observations', 'Observations'),
    field('lessons', 'Retour d’expérience'),
    field('improvements', 'Améliorations à suivre'),
    status([
      ['planned', 'Planifié'],
      ['done', 'Réalisé'],
    ]),
  ],
  journey: [
    field('organisation', 'Organisation'),
    field('scope', 'Périmètre de la démarche'),
    field('goals', 'Objectifs de la démarche'),
    field('approach', 'Démarche', 'select', [
      { value: 'quality', label: 'Qualité — SMQ' },
      { value: 'security', label: 'Sécurité — SMSI' },
      { value: 'hds', label: 'Hébergement de données de santé' },
      { value: 'integrated', label: 'Pilotage intégré, plusieurs référentiels' },
      { value: 'custom', label: 'Démarche personnalisée' },
    ]),
    field('hdsActivities', 'Activités HDS retenues, si concerné'),
    field('hdsApplicability', 'Justification du périmètre HDS, si concerné'),
  ],
};
