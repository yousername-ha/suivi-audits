/* Audit (phase 1, AUD-03 à AUD-11, ADR 0025) : modèle partagé entre l'API et l'interface.
   Listes et libellés repris à l'identique de l'outil historique (app/public/index.html, schéma 15) : les numéros de
   ligne cités sont indicatifs. Les couleurs ne sont pas ici : l'interface les prend dans les jetons de packages/ui. */

/* ---------------------------------------------------------------- Référentiels (AUD-03) */
/** Référentiel d'une exigence dans l'état legacy (`items[].ref`, `groups[].ref`). */
export const AUDIT_REFS = ['ISO', 'A', 'HDS'] as const;
export type AuditRef = (typeof AUDIT_REFS)[number];
/** Libellés du filtre « référentiel » du registre des écarts (`fRef`, l. 1242). */
export const AUDIT_REF_LABELS: Record<AuditRef, string> = {
  ISO: 'Clauses ISO',
  A: 'Annexe A',
  HDS: 'HDS',
};
/** Libellés de la colonne « Référentiel » du rapport Excel (`refL`, l. 4871). */
export const AUDIT_REF_EXPORT_LABELS: Record<AuditRef, string> = {
  ISO: 'ISO 27001',
  A: 'Annexe A',
  HDS: 'HDS v2',
};
/** Référentiel et version en base (AUD-03 : `framework`, `framework_version`). */
export const AUDIT_FRAMEWORKS: Record<AuditRef, { framework: string; version: string }> = {
  ISO: { framework: 'ISO27001', version: '2022' },
  A: { framework: 'ANNEXE_A', version: '2022' },
  HDS: { framework: 'HDS', version: 'v2' },
};
/** Familles de mesures de l'Annexe A (`AGROUP`, l. 844). */
export const ANNEX_A_GROUPS: Record<string, string> = {
  'A-5': 'Organisationnelles',
  'A-6': 'Personnes',
  'A-7': 'Physiques',
  'A-8': 'Technologiques',
};

/* ---------------------------------------------------------------- Couverture (AUD-04) */
/** Statut de couverture d'une exigence pour une année : non auditée, prévue, auditée. */
export const COVERAGE_VALUES = ['', 'P', 'X'] as const;
export type CoverageValue = (typeof COVERAGE_VALUES)[number];
/** Libellés des pastilles (l. 1125 et 1288). */
export const COVERAGE_LABELS: Record<CoverageValue, string> = {
  '': 'Non auditée',
  P: 'Prévue',
  X: 'Auditée',
};
/** Sources de couverture (`items[].afnor`, `items[].interne`). */
export const COVERAGE_SOURCES = ['afnor', 'interne'] as const;
export type CoverageSource = (typeof COVERAGE_SOURCES)[number];
export const COVERAGE_SOURCE_LABELS: Record<CoverageSource, string> = { afnor: 'AFNOR', interne: 'Interne' };
/** Valeur suivante au clic sur une pastille : non auditée → prévue → auditée → non auditée (`mark`, l. 4911). */
export function nextCoverage(v: string | undefined): CoverageValue {
  const c = v || '';
  return c === '' ? 'P' : c === 'P' ? 'X' : '';
}

/* ---------------------------------------------------------------- Préparation (AUD-04) */
export const PREP_VALUES = ['', 'encours', 'pret'] as const;
export type PrepValue = (typeof PREP_VALUES)[number];
/** `PREP`, l. 841. */
export const PREP_LABELS: Record<PrepValue, string> = { '': 'À préparer', encours: 'En cours', pret: 'Prête' };

/* ---------------------------------------------------------------- Écarts (AUD-09) */
/** `TYPES`, l. 843 (ordre de l'outil historique). */
export const FINDING_TYPES = ['NC maj', 'NC min', 'PS', 'PP', 'Remarque'] as const;
export type FindingType = (typeof FINDING_TYPES)[number];
/** Libellés longs (`typeLabel`, l. 855). */
export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  'NC maj': 'NC majeure',
  'NC min': 'NC mineure',
  PS: 'Point sensible',
  PP: 'Piste de progrès',
  Remarque: 'Remarque',
};
/** `typeLabel` de l'outil historique : tout type inconnu s'affiche « Remarque ». */
export function findingTypeLabel(t: string): string {
  return t === 'NC maj'
    ? 'NC majeure'
    : t === 'NC min'
      ? 'NC mineure'
      : t === 'PS'
        ? 'Point sensible'
        : t === 'PP'
          ? 'Piste de progrès'
          : 'Remarque';
}
/** `STATUTS`, l. 842. */
export const FINDING_STATUSES = ['Ouvert', 'En cours', 'Clos'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];
/** Sources d'un écart (« Relevé par », l. 1182). */
export const FINDING_SOURCES = [
  'AFNOR',
  'Interne',
  'Tenacy',
  'Veille',
  'GAP',
  'Exercice',
  'Incident',
  'Fournisseur',
] as const;
export type FindingSource = (typeof FINDING_SOURCES)[number];
/** Préfixes d'identifiant des écarts créés par les autres modules (l. 2780, 3563, 3816, 3869) ; `F` = saisie. */
export const FINDING_ID_PREFIXES = {
  manuel: 'F',
  gap: 'GAP-',
  exercice: 'EXO-',
  incident: 'INC-AC-',
  fournisseur: 'FOU-',
} as const;

/* ---------------------------------------------------------------- Plan d'audit (AUD-11) */
/** Types de créneaux (`SKIND`, l. 1354). */
export const SLOT_KINDS = ['ouverture', 'audit', 'visite', 'synthese', 'cloture', 'pause'] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];
export const SLOT_KIND_LABELS: Record<SlotKind, string> = {
  ouverture: "Réunion d'ouverture",
  audit: 'Entretien',
  visite: 'Visite terrain',
  synthese: 'Synthèse',
  cloture: 'Réunion de clôture',
  pause: 'Pause',
};
/** Statuts du plan (`PLANST`, l. 1355). */
export const PLAN_STATUSES = ['Projet', "Plan reçu de l'AFNOR", 'Plan validé'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/* ---------------------------------------------------------------- Pronostic (AUD-05) */
/** Niveaux du pronostic, du plus au moins probable (`LV`, l. 840 ; `o` = ordre). */
export const LEVELS = ['certain', 'tres', 'probable', 'socle', 'faible'] as const;
export type Level = (typeof LEVELS)[number];
export const LV: Record<Level, { l: string; o: number }> = {
  certain: { l: 'Certain', o: 0 },
  tres: { l: 'Très probable', o: 1 },
  probable: { l: 'Probable', o: 2 },
  socle: { l: 'Systématique', o: 3 },
  faible: { l: 'Peu probable', o: 4 },
};
export const LEVEL_LABELS: Record<Level, string> = {
  certain: LV.certain.l,
  tres: LV.tres.l,
  probable: LV.probable.l,
  socle: LV.socle.l,
  faible: LV.faible.l,
};

/* ---------------------------------------------------------------- État legacy (même forme que `S`) */
/** Exigence (`items[]`). */
export interface AuditItem {
  id: string;
  ref: string;
  num: string;
  title: string;
  group: string;
  depth: number;
  afnor: Record<string, string>;
  interne: Record<string, string>;
  prep?: string;
  owner?: string;
  notes?: string;
  remAfnor?: string;
  remInterne?: string;
  refText?: string;
}
export interface AuditGroup {
  id: string;
  ref: string;
  num: string;
  title: string;
}
/** Tâche d'un écart (`findings[].tasks[]`) ; échéance et pilote facultatifs (AUD-09, AUD-10). */
export interface AuditTask {
  t: string;
  done: boolean;
  createdAt?: string;
  due?: string;
  owner?: string;
}
/** Écart (`findings[]`). */
export interface AuditFinding {
  id: string;
  source: string;
  year: number;
  type: string;
  status: string;
  text?: string;
  desc?: string;
  action?: string;
  tasks?: AuditTask[];
  comment?: string;
  items: string[];
  owner?: string;
  due?: string;
  proof?: string;
  createdAt?: string;
}
export interface AuditPlanDay {
  id: string;
  label: string;
  date: string;
}
export interface AuditPlanSlot {
  id: string;
  day: string;
  start: string;
  end: string;
  type: string;
  title: string;
  detail: string;
  place: string;
  items: string[];
  people: string[];
  proofs: { t: string; done: boolean }[];
  questions: string[];
}
export interface AuditPlanPerson {
  id: string;
  name: string;
  role: string;
}
export interface AuditPlan {
  status: string;
  note: string;
  days: AuditPlanDay[];
  slots: AuditPlanSlot[];
  people: AuditPlanPerson[];
}
/** Sous-ensemble de l'état legacy utilisé par le module Audit. */
export interface AuditState {
  years: number[];
  yearLabels?: Record<string, string>;
  nextYear: number;
  nextDate?: string;
  internalDate?: string;
  closeDeadline?: string;
  groups?: AuditGroup[];
  items: AuditItem[];
  findings: AuditFinding[];
  plan?: AuditPlan;
}

/** Code affiché d'une exigence (`code`, l. 847) : « 4.1 », « A.5.15 », « HDS 01 ». */
export function itemCode(it: Pick<AuditItem, 'ref' | 'num'>): string {
  return it.ref === 'A' ? 'A.' + it.num : it.ref === 'HDS' ? 'HDS ' + it.num : it.num;
}
