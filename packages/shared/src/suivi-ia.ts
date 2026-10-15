/* Conformité IA de l'outil de suivi (registre des usages, évaluation des scénarios, plan d'action, politiques) :
   indice d'impact, niveau, alerte des étapes et statistiques, repris à l'identique de l'outil historique (`aiEval`,
   `aiStep`, `aiStats`, listes `AI_*`). Dates au format AAAA-MM-JJ ; rien n'est estimé : sans date de début, une étape n'a
   ni début ni échéance. */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const nombre = (v: unknown) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : 0);

export const CATEGORIES_IA = [
  'Service IA web externe',
  'IA intégrée à la bureautique',
  'IA intégrée à un outil métier',
  'IA intégrée à un outil de sécurité',
  'IA interne (développée ou hébergée)',
] as const;
export const AUTORISATIONS_IA = [
  'En qualification',
  'Autorisé',
  'Autorisé sous conditions',
  'Bloqué',
  'Suspendu',
  'Interdit',
] as const;
export const PERIMETRES_IA = [
  'Services IA web externes',
  'IA intégrée (Copilot, outils)',
  'Tous les usages externes',
  'Future IA interne',
] as const;
export const MATURITES_IA = [
  'Absent',
  'Ad hoc',
  'Défini partiellement',
  'Déployé et documenté',
  'Mesuré et contrôlé',
  'Optimisé',
] as const;
export const STATUTS_IA = ['À faire', 'En cours', 'Bloqué', 'En validation', 'Terminé', 'Non applicable'] as const;
export const PRESENCES_IA = ['À vérifier', 'Oui', 'Non'] as const;
export const QUALIFICATIONS_IA = ['Non', 'Oui', 'À qualifier'] as const;
export const AVANCEMENTS_IA = [0, 10, 25, 50, 75, 90, 100] as const;
/** Champs d'un usage à qualifier (affichés dans la synthèse quand ils sont vides ou à confirmer). */
export const CHAMPS_A_QUALIFIER_IA: readonly [string, string][] = [
  ['owner', 'propriétaire'],
  ['purpose', 'finalité'],
  ['dscp', 'DSCP'],
  ['storage', 'pays de stockage'],
  ['remote', 'accès distant'],
  ['training', 'réutilisation pour entraînement'],
  ['aiact', 'classe AI Act'],
  ['aipd', 'AIPD'],
];

export interface UsageIa {
  id: string;
  aiPresence: string;
  category: string;
  provider: string;
  usecase: string;
  dscp: string;
  training: string;
  storage: string;
  authz: string;
  owner: string;
  purpose: string;
  remote: string;
  aiact: string;
  aipd: string;
}
export interface EvaluationIa {
  id: string;
  domain: string;
  scenario: string;
  app: string;
  iso: string;
  hds: string;
  measure: string;
  scope: string;
  prob: number;
  maturity: number;
  c: number;
  i: number;
  a: number;
  audit: number;
  patient: number;
  effort: number;
  dscp: string;
}
export interface EtapeIa {
  /** Identifiant stable (« AP-001 ») ou « @<rang> » pour une étape sans identifiant. */
  cle: string;
  step: string;
  phase: string;
  action: string;
  result: string;
  proof: string;
  iso: string;
  hds: string;
  owner: string;
  priority: string;
  status: string;
  progress: number;
  jStart: number;
  jEnd: number;
}
export interface PolitiqueIa {
  cle: string;
  policy: string;
  impact: string;
  change: string;
  iso: string;
  annex: string;
  hds: string;
  owner: string;
  target: string;
  status: string;
}
export interface DonneesIa {
  context: string;
  start: string;
  startValidated: boolean;
  register: UsageIa[];
  evals: EvaluationIa[];
  plan: EtapeIa[];
  policies: PolitiqueIa[];
}

const liste = (v: unknown) => (Array.isArray(v) ? v.map(obj) : []);
const cleDe = (o: Obj, i: number) => str(o.id) || '@' + i;

/** Lit la clé `ai` de l'état historique ; `null` si elle est absente ou incomplète (aucune donnée IA initialisée). */
export function lireDonneesIa(brut: unknown): DonneesIa | null {
  const o = obj(brut);
  if (!Array.isArray(o.register) || !Array.isArray(o.evals) || !Array.isArray(o.plan) || !Array.isArray(o.policies))
    return null;
  return {
    context: str(o.context),
    start: str(o.start),
    startValidated: o.startValidated !== false,
    register: liste(o.register)
      .filter((r) => str(r.id))
      .map((r) => ({
        id: str(r.id),
        aiPresence: str(r.aiPresence) || 'À vérifier',
        category: str(r.category),
        provider: str(r.provider),
        usecase: str(r.usecase),
        dscp: str(r.dscp),
        training: str(r.training),
        storage: str(r.storage),
        authz: str(r.authz),
        owner: str(r.owner),
        purpose: str(r.purpose),
        remote: str(r.remote),
        aiact: str(r.aiact),
        aipd: str(r.aipd),
      })),
    evals: liste(o.evals)
      .filter((e) => str(e.id))
      .map((e) => ({
        id: str(e.id),
        domain: str(e.domain),
        scenario: str(e.scenario),
        app: str(e.app),
        iso: str(e.iso),
        hds: str(e.hds),
        measure: str(e.measure),
        scope: str(e.scope),
        prob: nombre(e.prob),
        maturity: nombre(e.maturity),
        c: nombre(e.c),
        i: nombre(e.i),
        a: nombre(e.a),
        audit: nombre(e.audit),
        patient: nombre(e.patient),
        effort: nombre(e.effort),
        dscp: str(e.dscp),
      })),
    plan: liste(o.plan).map((p, i) => ({
      cle: cleDe(p, i),
      step: str(p.step),
      phase: str(p.phase),
      action: str(p.action),
      result: str(p.result),
      proof: str(p.proof),
      iso: str(p.iso),
      hds: str(p.hds),
      owner: str(p.owner),
      priority: str(p.priority),
      status: str(p.status),
      progress: nombre(p.progress),
      jStart: nombre(p.jStart),
      jEnd: nombre(p.jEnd),
    })),
    policies: liste(o.policies).map((p, i) => ({
      cle: cleDe(p, i),
      policy: str(p.policy),
      impact: str(p.impact),
      change: str(p.change),
      iso: str(p.iso),
      annex: str(p.annex),
      hds: str(p.hds),
      owner: str(p.owner),
      target: str(p.target),
      status: str(p.status),
    })),
  };
}

export type NiveauIa = 'ok' | 'mid' | 'hi' | 'bad' | 'na';
export interface ResultatEvaluationIa {
  niveau: string;
  /** Indice d'impact ou `null` (scénario conditionnel : non applicable). */
  indice: number | null;
  residuel?: number;
  cls: NiveauIa;
}
/** Indice = 70 % du risque résiduel + 30 % de l'effort de révision ; risque résiduel = min(25, impact maximal ×
    probabilité × facteur HDS) × (1 − maturité / 5). Seuils : 16 critique, 10 élevé, 5 modéré. */
export function evaluationIa(
  e: Pick<EvaluationIa, 'app' | 'c' | 'i' | 'a' | 'audit' | 'patient' | 'prob' | 'dscp' | 'maturity' | 'effort'>,
): ResultatEvaluationIa {
  if (/^conditionnel/i.test(e.app)) return { niveau: 'N/A conditionnel', indice: null, cls: 'na' };
  const impact = Math.max(e.c, e.i, e.a, e.audit, e.patient),
    brut = impact * e.prob,
    f = e.dscp === 'Oui' ? 1.25 : 1;
  const res = Math.min(25, brut * f) * (1 - e.maturity / 5),
    indice = Math.round((0.7 * res + 0.3 * e.effort) * 10) / 10;
  const niveau = indice >= 16 ? 'Critique' : indice >= 10 ? 'Élevé' : indice >= 5 ? 'Modéré' : 'Faible';
  return {
    niveau,
    indice,
    residuel: Math.round(res * 10) / 10,
    cls: { Critique: 'bad', Élevé: 'hi', Modéré: 'mid', Faible: 'ok' }[niveau] as NiveauIa,
  };
}

const analyser = (s: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) : null;
};
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export interface ResultatEtapeIa {
  debut: string | null;
  echeance: string | null;
  alerte: [libelle: string, niveau: NiveauIa];
}
/** Début et échéance (date de début du plan + jours) et alerte d'une étape. Une date de début « indicative » (non
    validée) ne déclenche aucune alerte de retard. */
export function etapeIa(
  p: Pick<EtapeIa, 'jStart' | 'jEnd' | 'status'>,
  debutPlan: string,
  validee: boolean,
  aujourdhui: string,
): ResultatEtapeIa {
  const t0 = analyser(debutPlan);
  const debut = t0 == null ? null : iso(t0 + p.jStart * 864e5),
    echeance = t0 == null ? null : iso(t0 + p.jEnd * 864e5);
  const jour = analyser(aujourdhui)!;
  let alerte: [string, NiveauIa];
  if (p.status === 'Non applicable') alerte = ['Déclencheur futur', 'na'];
  else if (p.status === 'Terminé') alerte = ['Clos', 'ok'];
  else if (echeance && analyser(echeance)! < jour) alerte = validee ? ['En retard', 'bad'] : ['Date à valider', 'na'];
  else if (echeance && analyser(echeance)! <= jour + 14 * 864e5) alerte = ['À traiter ≤ 14 j', 'mid'];
  else alerte = ['Planifié', 'na'];
  return { debut, echeance, alerte };
}
export interface StatistiquesIa {
  scenarios: number;
  applicables: number;
  niveaux: Record<string, number>;
  /** Scénarios applicables dont la maturité est d'au moins 3 (« Déployé et documenté »). */
  couverts: number;
  etapes: number;
  terminees: number;
  avancement: number;
  enRetard: number;
}
export function statistiquesIa(
  d: Pick<DonneesIa, 'evals' | 'plan' | 'start' | 'startValidated'>,
  aujourdhui: string,
): StatistiquesIa {
  const ev = d.evals.map((e) => ({ e, r: evaluationIa(e) })).filter((x) => x.r.indice != null);
  const niveaux: Record<string, number> = { Critique: 0, Élevé: 0, Modéré: 0, Faible: 0 };
  for (const x of ev) niveaux[x.r.niveau]!++;
  const etapes = d.plan.filter((p) => p.status !== 'Non applicable');
  return {
    scenarios: d.evals.length,
    applicables: ev.length,
    niveaux,
    couverts: ev.filter((x) => x.e.maturity >= 3).length,
    etapes: etapes.length,
    terminees: etapes.filter((p) => p.status === 'Terminé').length,
    avancement: etapes.length ? Math.round(etapes.reduce((m, p) => m + p.progress, 0) / etapes.length) : 0,
    enRetard: etapes.filter((p) => etapeIa(p, d.start, d.startValidated, aujourdhui).alerte[0] === 'En retard').length,
  };
}

/** Identifiant d'un nouvel usage : EXT-IA-01, premier numéro libre à partir du nombre d'usages plus un. */
export function identifiantUsageIa(existants: readonly string[]): string {
  const pris = new Set(existants);
  let k = existants.length + 1;
  while (pris.has('EXT-IA-' + String(k).padStart(2, '0'))) k++;
  return 'EXT-IA-' + String(k).padStart(2, '0');
}

/* ------------------------------------------------------------------------------------------------ requêtes */
const texte = (max: number) => z.string().trim().max(max);
export const UsageIaModification = z
  .object({
    aiPresence: z.enum(PRESENCES_IA),
    category: z.enum(CATEGORIES_IA),
    provider: texte(500),
    usecase: texte(2000),
    dscp: z.enum(QUALIFICATIONS_IA),
    training: texte(500),
    storage: texte(500),
    authz: z.enum(AUTORISATIONS_IA),
  })
  .partial()
  .strict();
export const EvaluationIaModification = z
  .object({
    scope: z.enum(PERIMETRES_IA),
    prob: z.number().int().min(0).max(5),
    maturity: z.number().int().min(0).max(5),
  })
  .partial()
  .strict();
export const EtapeIaModification = z
  .object({
    status: z.enum(STATUTS_IA),
    progress: z.union(
      AVANCEMENTS_IA.map((n) => z.literal(n)) as [
        z.ZodLiteral<number>,
        z.ZodLiteral<number>,
        ...z.ZodLiteral<number>[],
      ],
    ),
  })
  .partial()
  .strict();
export const PolitiqueIaModification = z.object({ status: z.enum(STATUTS_IA) }).strict();
export const PlanIaModification = z
  .object({ start: z.union([z.literal(''), z.iso.date()]), startValidated: z.boolean() })
  .partial()
  .strict();
