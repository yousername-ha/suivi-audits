/* Gestion des risques (lot U3, ADR 0027) : étude EBIOS RM organisée en ateliers d'objets typés, processus
   ISO/IEC 27005 sur la fiche de risque, références typées, calculs d'aide à la décision et état d'acceptation.
   Démarches « inspirées » des méthodes : aucune conformité n'est revendiquée, aucun texte normatif n'est reproduit. */
import { z } from 'zod';
import { CfgRef } from './config-grc.js';
import { GrcKey, GrcRef, validDate, type GrcKind } from './grc.js';

const text = z.string().max(10000);
const date = z
  .string()
  .refine((s) => !s || validDate(s), 'Date invalide.')
  .default('');
const ref = GrcRef.nullable().default(null);
const refs = z.array(GrcRef).max(100).default([]);
/** Niveau sur une échelle à quatre niveaux (gravité, vraisemblance, critères des parties prenantes). */
const niveau = z.number().int().min(1).max(4).nullable().default(null);
const common = z.object({
  description: text.default(''),
  ownerId: z.uuid().nullable().default(null),
  refs,
  /** Étude EBIOS RM de rattachement. */
  studyRef: ref,
});

/* ---------------------------------------------------------------- Ateliers */

export const EBIOS_ATELIERS = [
  {
    id: 'a1',
    label: 'Atelier 1 — Cadrage et socle de sécurité',
    court: 'Cadrage et socle',
    aide: 'Valeurs métier, biens supports, événements redoutés et leur gravité ; écarts au socle de sécurité.',
    kinds: ['business_asset', 'support_asset', 'feared_event'],
  },
  {
    id: 'a2',
    label: 'Atelier 2 — Sources de risque',
    court: 'Sources de risque',
    aide: 'Sources de risque et objectifs visés ; couples retenus et justification.',
    kinds: ['risk_source', 'sr_ov'],
  },
  {
    id: 'a3',
    label: 'Atelier 3 — Scénarios stratégiques',
    court: 'Scénarios stratégiques',
    aide: 'Parties prenantes de l’écosystème et menace ; chemins d’attaque et gravité.',
    kinds: ['ecosystem_party', 'strategic_scenario'],
  },
  {
    id: 'a4',
    label: 'Atelier 4 — Scénarios opérationnels',
    court: 'Scénarios opérationnels',
    aide: 'Modes opératoires sur les biens supports et vraisemblance.',
    kinds: ['operational_scenario'],
  },
  {
    id: 'a5',
    label: 'Atelier 5 — Traitement du risque',
    court: 'Traitement',
    aide: 'Risques retenus, stratégie, mesures de traitement et plan d’amélioration.',
    kinds: ['risk', 'treatment'],
  },
] as const satisfies readonly { id: string; label: string; court: string; aide: string; kinds: readonly GrcKind[] }[];
export type AtelierId = (typeof EBIOS_ATELIERS)[number]['id'];

/** Échelles à quatre niveaux par défaut (libellés usuels ; l'organisation peut publier les siens dans sa méthode). */
export const ECHELLE_GRAVITE = ['Mineure', 'Significative', 'Grave', 'Critique'] as const;
export const ECHELLE_VRAISEMBLANCE = ['Peu vraisemblable', 'Vraisemblable', 'Très vraisemblable', 'Quasi certain'];

/* ---------------------------------------------------------------- Schémas des objets */

/** Liaison de configuration de l'étude (ADR 0038) : éléments du catalogue épinglés à une version précise. Facultative :
    une étude sans liaison garde l'échelle d'origine à quatre niveaux. */
export const StudyConfiguration = z
  .object({
    /** Matrice de pertinence des couples source de risque / objectif visé (lignes : ressources, colonnes : motivation). */
    relevanceMatrix: CfgRef.nullable().default(null),
    /** Correspondance impact → gravité (atelier 1) : l'échelle de départ porte les niveaux d'impact, celle d'arrivée la gravité. */
    severityMapping: CfgRef.nullable().default(null),
  })
  .strict();
export type StudyConfiguration = z.infer<typeof StudyConfiguration>;
export const RiskStudyData = common
  .extend({
    configuration: StudyConfiguration.nullable().default(null),
    objective: text.default(''),
    scope: text.default(''),
    participants: text.default(''),
    startAt: date,
    endAt: date,
    /** Processus, contexte ou périmètre étudiés. */
    scopeRefs: refs,
    /** Socle de sécurité : référentiels appliqués et écarts constatés (atelier 1). */
    baseline: z
      .array(
        z
          .object({
            referential: z.string().trim().min(1).max(200),
            status: z.enum(['applied', 'partial', 'gap']),
            gap: z.string().max(5000).default(''),
            requirementRefs: refs,
          })
          .strict(),
      )
      .max(200)
      .default([]),
  })
  .passthrough();
export const BusinessAssetData = common
  .extend({
    nature: z.enum(['process', 'information', '']).default(''),
    mission: text.default(''),
    entity: text.default(''),
    scope: text.default(''),
    processRefs: refs,
  })
  .passthrough();
export const SupportAssetData = common
  .extend({
    assetType: text.default(''),
    location: text.default(''),
    businessAssetRefs: refs,
  })
  .passthrough();
export const FearedEventData = common
  .extend({
    businessAssetRef: ref,
    consequences: text.default(''),
    /** Impacts : disponibilité, intégrité, confidentialité, traçabilité, ou autre dimension. */
    impacts: z
      .array(z.enum(['D', 'I', 'C', 'P', 'autre']))
      .max(5)
      .default([]),
    gravity: niveau,
    /** Impacts relevés sur l'échelle de départ de la correspondance épinglée par l'étude (catégorie facultative). */
    impactLevels: z
      .array(z.object({ category: GrcKey.nullable().default(null), level: GrcKey }).strict())
      .max(50)
      .default([]),
    /** Gravité retenue sur l'échelle d'arrivée ; la gravité proposée est le résultat de l'agrégation des impacts. */
    severityLevel: GrcKey.nullable().default(null),
    // Champs texte historiques du formulaire générique, conservés tels quels.
    severity: z.string().max(10000).optional(),
    businessValue: z.string().max(10000).optional(),
  })
  .passthrough();
export const RiskSourceData = common
  .extend({
    category: text.default(''),
    motive: text.default(''),
    resources: text.default(''),
    targetObjective: text.default(''),
  })
  .passthrough();
export const SrOvData = common
  .extend({
    sourceRef: ref,
    objective: z.string().max(2000).default(''),
    motivation: niveau,
    resources: niveau,
    activity: niveau,
    /** Niveaux choisis sur les échelles épinglées par l'étude (identifiants de niveau) ; la pertinence retenue est
        décidée par l'analyste, la matrice n'en fait qu'une proposition. */
    resourcesLevel: GrcKey.nullable().default(null),
    motivationLevel: GrcKey.nullable().default(null),
    relevanceLevel: GrcKey.nullable().default(null),
    retained: z.boolean().default(false),
    justification: text.default(''),
  })
  .passthrough()
  .superRefine((d, c) => {
    if (d.retained && !d.sourceRef) c.addIssue({ code: 'custom', message: 'Un couple retenu nécessite sa source.' });
  });
export const EcosystemPartyData = common
  .extend({
    category: text.default(''),
    dependency: niveau,
    penetration: niveau,
    maturity: niveau,
    trust: niveau,
    measures: text.default(''),
  })
  .passthrough();
export const StrategicScenarioData = common
  .extend({
    srOvRef: ref,
    fearedEventRefs: refs,
    partyRefs: refs,
    attackPath: text.default(''),
    ecosystem: z.string().max(10000).optional(),
    gravity: niveau,
  })
  .passthrough();
export const OperationalScenarioData = common
  .extend({
    strategicScenarioRef: ref,
    supportAssetRefs: refs,
    attackSequence: text.default(''),
    likelihood: z.union([niveau, z.string().max(10000)]).default(null),
  })
  .passthrough();
export const TreatmentData = common
  .extend({
    strategy: z.enum(['reduce', 'accept', 'avoid', 'transfer', '']).default(''),
    expectedEffect: text.default(''),
    verification: text.default(''),
    reviewAt: date,
    riskRefs: refs,
    measureRefs: refs,
  })
  .passthrough();

export const RISK_SCHEMAS = {
  risk_study: RiskStudyData,
  business_asset: BusinessAssetData,
  support_asset: SupportAssetData,
  feared_event: FearedEventData,
  risk_source: RiskSourceData,
  sr_ov: SrOvData,
  ecosystem_party: EcosystemPartyData,
  strategic_scenario: StrategicScenarioData,
  operational_scenario: OperationalScenarioData,
  treatment: TreatmentData,
};

/* ---------------------------------------------------------------- Références typées */

/** Cible autorisée : « object:<type> » ou « legacy:<clé historique> ». */
export type CibleRef = `object:${GrcKind}` | `legacy:${string}`;
const PROCESSUS: CibleRef[] = ['object:process', 'legacy:processes'];
export const STUDY_REF: CibleRef[] = ['object:risk_study'];

/** Champs de liaison typés par type d'objet ; le serveur refuse toute autre cible. */
export const RISK_REF_KINDS: Partial<Record<GrcKind, Record<string, CibleRef[]>>> = {
  risk_study: { scopeRefs: [...PROCESSUS, 'object:context', 'legacy:scope', 'object:business_asset'] },
  business_asset: { studyRef: STUDY_REF, processRefs: PROCESSUS },
  support_asset: { studyRef: STUDY_REF, businessAssetRefs: ['object:business_asset'] },
  feared_event: { studyRef: STUDY_REF, businessAssetRef: ['object:business_asset'] },
  risk_source: { studyRef: STUDY_REF },
  sr_ov: { studyRef: STUDY_REF, sourceRef: ['object:risk_source'] },
  ecosystem_party: { studyRef: STUDY_REF },
  strategic_scenario: {
    studyRef: STUDY_REF,
    srOvRef: ['object:sr_ov'],
    fearedEventRefs: ['object:feared_event'],
    partyRefs: ['object:ecosystem_party'],
  },
  operational_scenario: {
    studyRef: STUDY_REF,
    strategicScenarioRef: ['object:strategic_scenario'],
    supportAssetRefs: ['object:support_asset'],
  },
  treatment: {
    studyRef: STUDY_REF,
    riskRefs: ['object:risk'],
    measureRefs: ['object:measure', 'object:soa', 'legacy:items', 'legacy:soa'],
  },
  risk: {
    studyRef: STUDY_REF,
    scenarioRef: ['object:operational_scenario'],
    assetRefs: [...PROCESSUS, 'object:business_asset', 'object:support_asset'],
  },
};

/** Valeurs d'un champ de liaison (référence seule ou liste), sans les vides. */
export function valeursRef(v: unknown): string[] {
  if (typeof v === 'string') return v ? [v] : [];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Références typées d'une fiche, avec leurs cibles autorisées. */
export function referencesTypees(kind: GrcKind, data: Record<string, unknown>) {
  return Object.entries(RISK_REF_KINDS[kind] ?? {}).flatMap(([champ, cibles]) =>
    valeursRef(data[champ]).map((r) => ({ champ, ref: r, cibles })),
  );
}

/** La cible convient-elle ? objKind : type de l'objet résolu (null pour une référence historique). */
export function cibleAutorisee(ref: string, objKind: GrcKind | null, cibles: readonly CibleRef[]) {
  if (ref.startsWith('object:')) return !!objKind && cibles.includes(`object:${objKind}`);
  if (ref.startsWith('legacy:')) return cibles.includes(`legacy:${ref.split(':')[1]}`);
  return false;
}

/* ---------------------------------------------------------------- Calculs d'aide à la décision */

/** Indice de menace d'une partie prenante : (dépendance × pénétration) / (maturité × confiance), formule du guide
    EBIOS RM ; null tant qu'un critère manque. Arrondi au centième. */
export function indiceMenace(p: {
  dependency?: number | null;
  penetration?: number | null;
  maturity?: number | null;
  trust?: number | null;
}) {
  const { dependency: d, penetration: e, maturity: m, trust: t } = p;
  if (!d || !e || !m || !t) return null;
  return Math.round(((d * e) / (m * t)) * 100) / 100;
}

/** Gravité proposée d'un scénario stratégique : la plus forte des événements redoutés liés (null sinon). */
export function graviteProposee(gravites: readonly (number | null | undefined)[]) {
  const g = gravites.filter((x): x is number => typeof x === 'number');
  return g.length ? Math.max(...g) : null;
}

/* ---------------------------------------------------------------- Acceptation (ISO/IEC 27005) */

export const RiskAcceptanceTerms = z
  .object({
    /** Échéance de l'acceptation : la décision est à revoir après cette date. */
    until: z.string().refine(validDate, 'Échéance réelle requise.'),
  })
  .strict();

export type EtatAcceptation = 'sans_objet' | 'a_decider' | 'acceptee' | 'refusee' | 'echue';
export const ETATS_ACCEPTATION: Record<EtatAcceptation, string> = {
  sans_objet: 'Sans objet',
  a_decider: 'Acceptation à décider',
  acceptee: 'Acceptée',
  refusee: 'Acceptation refusée',
  echue: 'Acceptation échue',
};

/** État d'acceptation d'un risque : stratégie « accepter » et dernière décision (résultat, échéance). */
export function etatAcceptation(
  strategie: string,
  derniere: { result: string; until: string | null } | null,
  aujourdhui: string,
): EtatAcceptation {
  if (strategie !== 'accept') return derniere?.result === 'accepted' ? 'acceptee' : 'sans_objet';
  if (!derniere) return 'a_decider';
  if (derniere.result !== 'accepted') return 'refusee';
  return derniere.until && derniere.until < aujourdhui ? 'echue' : 'acceptee';
}
