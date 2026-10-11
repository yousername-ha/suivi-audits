/* Liens transverses (lot U4, ADR 0028) : catalogue des relations autorisées entre types d'objets, avec leur sens.
   « Lié à » reste ouvert à toute paire ; les relations typées n'acceptent que les paires qui ont un sens métier.
   Le serveur contrôle chaque lien saisi par une personne. Les liens qu'il crée lui-même (action issue d'un traitement
   ou d'une décision du pilotage, occurrence récurrente) suivent leurs propres règles ; les liens déjà enregistrés
   restent lisibles et supprimables. */

/** Type d'objet d'une référence résolue : type GRC, ou type des données de l'outil de suivi (`supplier`…). */
export type TypeLie = string;
type Ensemble = readonly TypeLie[] | '*';

export interface Relation {
  libelle: string;
  /** Lecture depuis la cible : « Est traité par », « Est démontré par »… */
  inverse: string;
  sources: Ensemble;
  cibles: Ensemble;
}

const ACTIFS = ['business_asset', 'support_asset', 'process', 'supplier'] as const;
const EXIGENCES = ['requirement', 'soa', 'measure', 'framework'] as const;
const PILOTES = ['objective', 'indicator'] as const;
const TRAITANTS = ['treatment', 'action', 'task_series', 'measure', 'control', 'continuity_plan'] as const;
const A_TRAITER = [
  'risk',
  'nonconformity',
  'incident',
  'feared_event',
  'strategic_scenario',
  'operational_scenario',
] as const;

export const RELATIONS = {
  related_to: { libelle: 'Lié à', inverse: 'Lié à', sources: '*', cibles: '*' },
  supports: {
    libelle: 'Supporte',
    inverse: 'Est supporté par',
    sources: ['support_asset', 'supplier', 'process', 'governance', 'measure', 'control', 'ecosystem_party'],
    cibles: ['business_asset', 'process', 'objective', 'context', 'stakeholder', 'bia', 'continuity_plan'],
  },
  impacts: {
    libelle: 'Impacte',
    inverse: 'Est impacté par',
    sources: [...A_TRAITER, 'risk_source', 'sr_ov', 'swot'],
    cibles: [...ACTIFS, ...PILOTES, 'stakeholder', 'context', 'bia', 'continuity_plan'],
  },
  applies_to: {
    libelle: 'S’applique à',
    inverse: 'Est concerné par',
    sources: [...EXIGENCES, 'control', 'governance', 'context'],
    cibles: '*',
  },
  depends_on: {
    libelle: 'Dépend de',
    inverse: 'Est nécessaire à',
    sources: [...ACTIFS, ...TRAITANTS, 'bia', 'audit', 'continuity_exercise'],
    cibles: [...ACTIFS, ...TRAITANTS, 'bia', 'governance', 'ecosystem_party'],
  },
  implements: {
    libelle: 'Met en œuvre',
    inverse: 'Est mis en œuvre par',
    sources: [...TRAITANTS, 'process', 'governance'],
    cibles: [...EXIGENCES, ...PILOTES, 'risk', 'treatment', 'nonconformity', 'continuity_plan'],
  },
  demonstrates: {
    libelle: 'Démontre',
    inverse: 'Est démontré par',
    sources: ['evidence', 'control', 'audit', 'indicator', 'management_review', 'continuity_exercise'],
    cibles: [
      ...EXIGENCES,
      ...PILOTES,
      ...TRAITANTS,
      'nonconformity',
      'risk',
      'process',
      'audit',
      'continuity_exercise',
    ],
  },
  treats: {
    libelle: 'Traite',
    inverse: 'Est traité par',
    sources: TRAITANTS,
    cibles: [...A_TRAITER, 'audit'],
  },
} as const satisfies Record<string, Relation>;
export type TypeRelation = keyof typeof RELATIONS;
export const TYPES_RELATION = Object.keys(RELATIONS) as TypeRelation[];

const dans = (e: Ensemble, k: TypeLie) => e === '*' || e.includes(k);

/** La relation `type` peut-elle relier un objet `source` à un objet `cible` (dans ce sens) ? */
export function relationAutorisee(type: string, source: TypeLie, cible: TypeLie): boolean {
  const r = (RELATIONS as Record<string, Relation>)[type];
  return !!r && dans(r.sources, source) && dans(r.cibles, cible);
}

/** Relations proposées pour une paire, « Lié à » en premier. */
export function relationsPossibles(source: TypeLie, cible: TypeLie): TypeRelation[] {
  return TYPES_RELATION.filter((t) => relationAutorisee(t, source, cible));
}

/** Libellé lu depuis l'objet affiché : sens direct s'il est la source du lien, sens inverse sinon. */
export function libelleRelation(type: string, depuisSource: boolean): string {
  const r = (RELATIONS as Record<string, Relation>)[type];
  if (!r) return 'Relation';
  return depuisSource ? r.libelle : r.inverse;
}
