/* Cartographie du SMSI (CARTO-02, ADR 0013) : modèle partagé entre l'API et l'interface.
   Portage fidèle du module bêta de l'outil historique (docs/cartographie/reference-beta-legacy/carto.js) :
   mêmes références d'objets, mêmes types, mêmes règles. Les couleurs ne sont pas ici : l'interface les prend dans
   les jetons « carte » de packages/ui (aucune couleur codée en dur). */
import type { Module } from '../permissions.js';

export const MAP_VIEWS = ['context', 'process'] as const;
export type MapView = (typeof MAP_VIEWS)[number];
export const MAP_VIEW_LABELS: Record<MapView, string> = {
  context: 'Vue contexte',
  process: 'Vue processus',
};
export const MAP_VIEW_TITLES: Record<MapView, string> = {
  context: 'Cartographie du contexte SMSI',
  process: 'Cartographie des processus',
};

/** Référentiels proposés dans les filtres (spécification § 6, point 7 : pas d'ISO 9001). */
export const REFERENTIELS = ['ISO 27001', 'HDS'] as const;
export type Referentiel = (typeof REFERENTIELS)[number];

/* ---------------------------------------------------------------- Objets */
export const OBJECT_TYPES = [
  'isms',
  'scope',
  'process',
  'subprocess',
  'stakeholder',
  'external_issue',
  'internal_issue',
  'application',
  'infrastructure',
  'site',
  'supplier',
  'grc',
] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];
export const FRAME_TYPES = ['lane', 'band', 'zone', 'frame', 'note'] as const;
export type FrameType = (typeof FRAME_TYPES)[number];
export type NodeType = ObjectType | FrameType;

export const TYPE_LABELS: Record<NodeType | 'missing', string> = {
  isms: 'SMSI',
  scope: 'Périmètre SMSI',
  lane: 'Zone de processus',
  band: 'Bande d’enjeux',
  zone: 'Zone hors périmètre',
  frame: 'Cadre',
  note: 'Note',
  process: 'Processus',
  subprocess: 'Sous-processus',
  stakeholder: 'Partie intéressée',
  external_issue: 'Enjeu externe',
  internal_issue: 'Enjeu interne',
  application: 'Application / service',
  infrastructure: 'Infrastructure',
  site: 'Site',
  supplier: 'Fournisseur',
  missing: 'Objet indisponible',
  grc: 'Objet du registre SMSI',
};
/** Types qui sont des cadres (ils emportent leur contenu quand on les déplace). */
export const CONTAINER_TYPES: ReadonlySet<string> = new Set(['scope', 'lane', 'band', 'zone', 'frame']);
/** Icône par défaut de chaque type (noms d'icônes dessinées par l'interface). */
export const TYPE_ICONS: Partial<Record<NodeType | 'missing', string>> = {
  stakeholder: 'users',
  external_issue: 'alert',
  internal_issue: 'target',
  application: 'app',
  infrastructure: 'server',
  site: 'pin',
  supplier: 'box',
  missing: 'ghost',
};

/* ---------------------------------------------------------------- Familles de processus */
export const FAMILY_KEYS = ['pil', 'rea', 'sup', 'oth'] as const;
export type FamilyKey = (typeof FAMILY_KEYS)[number];
export interface FamilyDef {
  k: FamilyKey;
  /** Valeur du champ « famille » dans la plateforme. */
  family: string;
  l: string;
  sub: string;
  ic: string;
}
export const FAMILIES: Record<FamilyKey, FamilyDef> = {
  pil: {
    k: 'pil',
    family: 'Management',
    l: 'Processus de pilotage',
    sub: 'Diriger, piloter et améliorer le système de management',
    ic: 'compass',
  },
  rea: {
    k: 'rea',
    family: 'Réalisation',
    l: 'Processus de réalisation',
    sub: 'Concevoir, déployer et exploiter les services et usages',
    ic: 'gear',
  },
  sup: {
    k: 'sup',
    family: 'Support',
    l: 'Processus de support',
    sub: 'Fournir les ressources et fonctions support',
    ic: 'tools',
  },
  oth: {
    k: 'oth',
    family: '',
    l: 'Autres processus',
    sub: 'Famille non renseignée dans la plateforme',
    ic: 'layers',
  },
};
/** Famille d'un processus d'après son champ « famille » (valeur inconnue : « Autres processus »). */
export function familyOf(family: string | undefined): FamilyDef {
  for (const f of Object.values(FAMILIES)) if (f.family && f.family === family) return f;
  return FAMILIES.oth;
}

/* ---------------------------------------------------------------- Relations */
export const RELATION_TYPES = [
  'part_of',
  'flows_to',
  'depends_on',
  'supports',
  'interacts_with',
  'impacts',
  'applies_to',
  'contains',
  'related_to',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];
export type RelationStyle = 'primary' | 'dependency' | 'secondary' | 'issue' | 'structural';
export const RELATIONS: Record<RelationType, { l: string; st: RelationStyle; dir: boolean }> = {
  part_of: { l: 'Fait partie du SMSI', st: 'primary', dir: true },
  flows_to: { l: 'Flux principal', st: 'primary', dir: true },
  depends_on: { l: 'Dépendance', st: 'dependency', dir: true },
  supports: { l: 'Supporte', st: 'dependency', dir: true },
  interacts_with: { l: 'Interaction', st: 'secondary', dir: false },
  impacts: { l: 'Impacte', st: 'issue', dir: true },
  applies_to: { l: 'S’applique à', st: 'secondary', dir: true },
  contains: { l: 'Contient', st: 'structural', dir: true },
  related_to: { l: 'Lié à', st: 'secondary', dir: false },
};
/** Types proposés pour une relation graphique (« Fait partie du SMSI » est réservé aux données). */
export const GRAPHIC_RELATION_TYPES = RELATION_TYPES.filter((t) => t !== 'part_of');

/* ---------------------------------------------------------------- Objets métier (normalisés par l'API) */
export type ScopeState = 'in' | 'out' | 'unk';
export interface IssueSource {
  /** obj : enjeu d'un objectif ; swot : élément du SWOT le plus récent d'un processus ; map : créé sur la carte. */
  k: 'obj' | 'swot' | 'map';
  id: string;
  l: string;
  proc?: string;
  q?: 'S' | 'W' | 'O' | 'T';
}
export interface IndicatorBrief {
  id: string;
  name: string;
  st: 'ok' | 'ko' | 'na' | 'undef';
}
/** Champs de la fiche détaillée, choisis un par un (jamais l'objet legacy brut). */
export interface ObjectDetails {
  statement?: string;
  processes?: string[];
  hdsCount?: number;
  exclCount?: number;
  validatedOn?: string;
  validatedBy?: string;
  counts?: { label: string; value: number }[];
  objectives?: { id: string; name: string }[];
  indicators?: IndicatorBrief[];
  swot?: { id: string; date: string; S: number; W: number; O: number; T: number } | null;
  children?: { code: string; name: string }[];
  nature?: string;
  category?: string;
  needs?: string;
  requirements?: string[];
  addressed?: string;
  reviewed?: string;
  sso?: string;
  mfa?: string;
  certs?: string[];
  apps?: { id: string; name: string }[];
  status?: string;
  supplier?: string;
  healthData?: string;
  hosting?: string;
}
export interface CartoObject {
  riskColor?: string;
  ref: string;
  type: ObjectType;
  name: string;
  sub?: string;
  code?: string;
  owner?: string;
  family?: string;
  parent?: string;
  scope?: ScopeState;
  scopeLabel?: string;
  std: Referentiel[];
  ic?: string;
  nObj?: number;
  nInd?: number;
  nKo?: number;
  ext?: boolean;
  crit?: boolean;
  hds?: boolean;
  saas?: boolean;
  supRef?: string;
  src?: IssueSource[];
  procs?: string[];
  /** Nature déduite d'un enjeu, avant correction manuelle (CARTO-12). */
  auto?: 'ext' | 'int';
  /** Périmètre : processus du périmètre renseignés. */
  scDef?: boolean;
  details?: ObjectDetails;
}
/** Teintes proposées pour les notes et les cadres libres (jetons « carte » de packages/ui). */
export const TINTS = ['marine', 'bleu', 'violet', 'orange', 'vert', 'gris', 'rouge'] as const;
export type Tint = (typeof TINTS)[number];
export const TINT_LABELS: Record<Tint, string> = {
  marine: 'Marine',
  bleu: 'Bleu',
  violet: 'Violet',
  orange: 'Orange',
  vert: 'Vert',
  gris: 'Gris',
  rouge: 'Rouge',
};

/** Cadre propre à une carte (bande de processus, bande d'enjeux, zone hors périmètre, cadre libre, note). */
export interface FrameObject {
  ref: string;
  type: FrameType;
  name: string;
  sub?: string;
  fam?: string;
  kind?: 'ext' | 'int';
  /** Cadre libre ou note : teinte choisie (CARTO-19). */
  tint?: Tint;
  mapOnly: true;
}
export type MapObject = CartoObject | FrameObject;
export const isFrame = (o: MapObject | undefined | null): o is FrameObject => !!o && 'mapOnly' in o && o.mapOnly;

export interface DerivedRelation {
  s: string;
  t: string;
  type: RelationType;
  der: true;
  key: string;
  /** Relation secondaire (enjeu → processus), masquée par défaut. */
  sec?: boolean;
}

/* ---------------------------------------------------------------- Disposition d'une carte (présentation seule) */
export interface MapNode {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Dernier libellé connu, affiché si l'objet disparaît de la plateforme. */
  label: string;
  hidden?: boolean;
}
export interface MapEdge {
  id: string;
  s: string;
  t: string;
  type: RelationType;
  /** Proposition générée, à valider. */
  gen?: boolean;
}
/** Élément propre à la carte (note ou cadre libre, CARTO-19) : texte et teinte. */
export interface FreeElement {
  text: string;
  tint: Tint;
}
export interface MapLayout {
  nodes: Record<string, MapNode>;
  edges: MapEdge[];
  /** Relations métier masquées sur cette carte (clé de relation dérivée). */
  hide: Record<string, 1>;
  /** Objets volontairement absents (pas de bandeau « nouveaux objets »). */
  ignored: Record<string, 1>;
  /** Notes et cadres libres (références `note:<id>` et `frame:<id>`). Absent si la carte n'en a pas. */
  free?: Record<string, FreeElement>;
}
export const emptyLayout = (): MapLayout => ({ nodes: {}, edges: [], hide: {}, ignored: {} });

/* ---------------------------------------------------------------- Références */
const MAP_ONLY_PREFIXES = new Set(['lane', 'band', 'zone', 'note', 'frame']);
const FREE_PREFIXES = new Set(['note', 'frame']);
/** Préfixe d'une référence d'objet (« process », « pi »…, ou « isms », « scope »). */
export const refPrefix = (ref: string): string => {
  const i = ref.indexOf(':');
  return i < 0 ? ref : ref.slice(0, i);
};
export const isMapOnlyRef = (ref: string): boolean => MAP_ONLY_PREFIXES.has(refPrefix(ref));
/** Note ou cadre libre (élément propre à la carte, jamais recalculé par la disposition automatique). */
export const isFreeRef = (ref: string): boolean => FREE_PREFIXES.has(refPrefix(ref));
/** Module d'origine d'un objet (droits : un objet d'un module non lisible n'est pas envoyé, CARTO-01). */
export const REF_MODULES: Record<string, Module> = {
  process: 'pilotage',
  pi: 'pilotage',
  issue: 'pilotage',
  site: 'pilotage',
  infra: 'pilotage',
  scope: 'pilotage',
  sup: 'fournisseurs',
  app: 'conformite',
};
export const refModule = (ref: string): Module | null => REF_MODULES[refPrefix(ref)] ?? null;
