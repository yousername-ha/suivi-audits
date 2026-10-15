/* Plans du SMSI (formation, sensibilisation, audit interne, exercices PRA et crise) : types, états, statistiques et
   occurrences des tâches récurrentes, repris à l'identique de l'outil de suivi historique (`PLAN_T`, `planLate`,
   `planState`, `planStats`, `recAdd`, `recNext`, `recOccurrences`). Rien n'est estimé : sans date, un plan n'est jamais
   « en retard ». Dates au format AAAA-MM-JJ, comparées comme des chaînes (même résultat que l'outil historique). */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export const TYPES_ACTION_PLAN = ['formation', 'sensi', 'audit', 'exo'] as const;
export type TypePlan = (typeof TYPES_ACTION_PLAN)[number];

export interface DefinitionPlan {
  /** Libellé court (onglet, graphique). */
  libelle: string;
  /** Libellé du plan. */
  plan: string;
  /** Préfixe des identifiants : PL-<code>-001. */
  code: string;
  /** Références normatives affichées sous le plan. */
  reference: string;
  /** Valeurs proposées pour le type de l'action. */
  genres: readonly string[];
  /** Libellé du champ « type » selon le plan. */
  libelleGenre: string;
}
export const PLANS: Record<TypePlan, DefinitionPlan> = {
  formation: {
    libelle: 'Formation',
    plan: 'Plan de formation',
    code: 'FOR',
    reference: 'ISO 27001 § 7.2 ; Annexe A 6.3 ; ReCyF 4.5',
    genres: ['Présentiel', 'Distanciel', 'E-learning'],
    libelleGenre: 'Modalité',
  },
  sensi: {
    libelle: 'Sensibilisation',
    plan: 'Plan de sensibilisation',
    code: 'SEN',
    reference: 'ISO 27001 § 7.3 ; Annexe A 6.3 ; ReCyF 4.2',
    genres: ['Module e-learning', 'Campagne d’hameçonnage simulé', 'Communication', 'Atelier'],
    libelleGenre: 'Type de campagne',
  },
  audit: {
    libelle: 'Audit interne',
    plan: "Programme d'audit interne",
    code: 'AUD',
    reference: 'ISO 27001 § 9.2 ; HDS EXI 16',
    genres: ['Audit SMSI', 'Audit HDS', 'Audit des traces d’accès', 'Audit technique'],
    libelleGenre: "Type d'audit",
  },
  exo: {
    libelle: 'Exercice',
    plan: 'Plan d’exercices PRA et crise',
    code: 'EXO',
    reference: 'Annexe A 5.29, 5.30, 8.13 ; ReCyF 13.2, 14.5, 15.1',
    genres: [
      'Test de restauration',
      'Exercice PRA / PCA',
      'Test de bascule',
      'Exercice de crise sur table',
      'Exercice de crise grandeur nature',
    ],
    libelleGenre: "Type d'exercice",
  },
};

export const STATUTS_PLAN = ['Planifié', 'En préparation', 'Réalisé', 'Reporté', 'Annulé'] as const;
export type StatutPlan = (typeof STATUTS_PLAN)[number];
export const RESULTATS_EXERCICE = ['Atteint', 'Partiellement atteint', 'Non atteint'] as const;

/** Niveau d'état d'un plan (couleur) : mêmes familles que le suivi des fournisseurs, plus « hi » (reporté). */
export type NiveauPlan = 'ok' | 'mid' | 'hi' | 'bad' | 'na';
const NIVEAU_STATUT: Record<string, NiveauPlan> = {
  Planifié: 'na',
  'En préparation': 'mid',
  Réalisé: 'ok',
  Reporté: 'hi',
  Annulé: 'na',
};

/** Action d'un plan, telle que stockée dans la clé `plans` de l'état historique. Les champs numériques sont des
    chaînes (saisie libre dans l'outil historique : « 12 », « 85 % »). */
export interface ActionPlan {
  id: string;
  type: TypePlan;
  title: string;
  kind: string;
  start: string;
  end: string;
  done: string;
  status: string;
  owner: string;
  provider: string;
  audience: string;
  notes: string;
  proof: string;
  planned: string;
  attended: string;
  duration: string;
  participation: string;
  success: string;
  indicator: string;
  items: string[];
  scope: string;
  auditor: string;
  scenario: string;
  systems: string;
  objectives: string;
  result: string;
  retex: string;
  findings: string[];
  pushedAt: string;
  createdAt: string;
}

const taille = (max: number) => z.string().trim().max(max);
const date = z.union([z.literal(''), z.iso.date()]);
/** Champs modifiables d'une action de plan (tous facultatifs en modification). Les champs non listés de la source
    historique sont conservés tels quels. */
const CHAMPS_ACTION = {
  title: taille(300),
  kind: taille(120),
  start: date,
  end: date,
  done: date,
  status: z.enum(STATUTS_PLAN),
  owner: taille(200),
  provider: taille(200),
  audience: taille(500),
  notes: taille(5000),
  proof: taille(1000),
  planned: taille(40),
  attended: taille(40),
  duration: taille(40),
  participation: taille(40),
  success: taille(40),
  indicator: taille(80),
  items: z.array(z.string().trim().min(1).max(80)).max(500),
  scope: taille(500),
  auditor: taille(200),
  scenario: taille(5000),
  systems: taille(500),
  objectives: taille(2000),
  result: z.union([z.literal(''), z.enum(RESULTATS_EXERCICE)]),
  retex: taille(5000),
};
export const ActionPlanCreation = z
  .object({ type: z.enum(TYPES_ACTION_PLAN), ...z.object(CHAMPS_ACTION).partial().shape })
  .strict();
export type ActionPlanCreation = z.infer<typeof ActionPlanCreation>;
export const ActionPlanModification = z.object(CHAMPS_ACTION).partial().strict();
export type ActionPlanModification = z.infer<typeof ActionPlanModification>;
/** Décalage de dates (glisser une barre du planning) : nombre de jours, positif ou négatif. */
export const DecalagePlan = z.object({ jours: z.number().int().min(-3660).max(3660) }).strict();
export type DecalagePlan = z.infer<typeof DecalagePlan>;

/** Identifiant d'une nouvelle action : PL-<code>-001, le premier numéro libre (comme `planNew`). */
export function identifiantPlan(type: TypePlan, existants: readonly string[]): string {
  const pris = new Set(existants);
  const code = PLANS[type].code;
  let k = 1;
  while (pris.has(`PL-${code}-${String(k).padStart(3, '0')}`)) k++;
  return `PL-${code}-${String(k).padStart(3, '0')}`;
}

/** Valeurs d'une action neuve (`planNew`). */
export function actionPlanVierge(type: TypePlan, id: string, maintenant: string): ActionPlan {
  return {
    id,
    type,
    createdAt: maintenant,
    title: '',
    kind: PLANS[type].genres[0]!,
    start: '',
    end: '',
    done: '',
    status: 'Planifié',
    owner: '',
    provider: '',
    audience: '',
    notes: '',
    proof: '',
    planned: '',
    attended: '',
    duration: '',
    participation: '',
    success: '',
    indicator: '',
    items: [],
    scope: '',
    auditor: '',
    scenario: '',
    systems: '',
    objectives: '',
    result: '',
    retex: '',
    findings: [],
    pushedAt: '',
  };
}

/** Lit une entrée de la clé `plans` : type reconnu et identifiant obligatoires, le reste est normalisé. */
export function lireActionPlan(brut: unknown): ActionPlan | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  const type = str(o.type) as TypePlan;
  if (!TYPES_ACTION_PLAN.includes(type) || !str(o.id)) return null;
  const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const base = actionPlanVierge(type, str(o.id), str(o.createdAt));
  for (const k of Object.keys(base) as (keyof ActionPlan)[]) {
    if (k === 'items' || k === 'findings') base[k] = liste(o[k]);
    else if (k !== 'type' && k !== 'id') (base as unknown as Obj)[k] = str(o[k]);
  }
  return base;
}

/** Une action est en retard quand sa date de fin (à défaut de début) est passée sans réalisation ni annulation. */
export function actionPlanEnRetard(p: Pick<ActionPlan, 'status' | 'start' | 'end'>, aujourdhui: string): boolean {
  return p.status !== 'Réalisé' && p.status !== 'Annulé' && !!p.start && (p.end || p.start) < aujourdhui;
}
/** État affiché : « En retard » l'emporte sur le statut saisi. */
export function actionPlanEtat(
  p: Pick<ActionPlan, 'status' | 'start' | 'end'>,
  aujourdhui: string,
): [libelle: string, niveau: NiveauPlan] {
  return actionPlanEnRetard(p, aujourdhui)
    ? ['En retard', 'bad']
    : [p.status || 'Planifié', NIVEAU_STATUT[p.status] ?? 'na'];
}
/** Plans d'un type et d'une année (année de la date prévue, à défaut de réalisation). */
export function plansDe(plans: readonly ActionPlan[], type: TypePlan | null, annee: number | null): ActionPlan[] {
  return plans.filter((p) => (!type || p.type === type) && (!annee || (p.start || p.done).startsWith(String(annee))));
}
export interface StatistiquesPlan {
  total: number;
  realises: number;
  enRetard: number;
}
export function planStatistiques(
  plans: readonly ActionPlan[],
  type: TypePlan | null,
  annee: number | null,
  aujourdhui: string,
): StatistiquesPlan {
  const liste = plansDe(plans, type, annee).filter((p) => p.status !== 'Annulé');
  return {
    total: liste.length,
    realises: liste.filter((p) => p.status === 'Réalisé').length,
    enRetard: liste.filter((p) => actionPlanEnRetard(p, aujourdhui)).length,
  };
}

/* ----------------------------------------------------------------------------------------------- Dates */
const analyser = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)) : null;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Décale une date de n jours (AAAA-MM-JJ), comme `sh` du glisser de barre de l'outil historique. */
export function decalerDate(date: string, jours: number): string {
  const d = analyser(date);
  if (!d) return date;
  d.setUTCDate(d.getUTCDate() + jours);
  return iso(d);
}
/** Décale début et fin d'une action (la fin seulement si elle est renseignée). */
export function decalerAction<T extends Pick<ActionPlan, 'start' | 'end'>>(p: T, jours: number): T {
  return { ...p, start: decalerDate(p.start, jours), ...(p.end ? { end: decalerDate(p.end, jours) } : {}) };
}

/* ------------------------------------------------------------------------- Tâches récurrentes (calendrier) */
export const UNITES_RECURRENCE = ['j', 's', 'm', 'a'] as const;
export interface TacheRecurrente {
  id: string;
  title: string;
  active: boolean;
  n: number;
  u: string;
  start: string;
  last: string;
  history: string[];
}
export function lireTacheRecurrente(brut: unknown): TacheRecurrente | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  if (!str(o.id)) return null;
  const h = Array.isArray(o.history) ? o.history : [];
  return {
    id: str(o.id),
    title: str(o.title) || str(o.id),
    active: o.active !== false,
    n: Number(o.n) || 1,
    u: str(o.u) || 'a',
    start: str(o.start),
    last: str(o.last),
    history: h.map((x) => (x && typeof x === 'object' ? str((x as Obj).date) : '')).filter(Boolean),
  };
}
function ajouterPeriode(d: Date, n: number, u: string): Date {
  const x = new Date(d.getTime());
  if (u === 'j') x.setUTCDate(x.getUTCDate() + n);
  else if (u === 's') x.setUTCDate(x.getUTCDate() + 7 * n);
  else if (u === 'm') x.setUTCMonth(x.getUTCMonth() + n);
  else x.setUTCFullYear(x.getUTCFullYear() + n);
  return x;
}
const JOURS_UNITE: Record<string, number> = { j: 1, s: 7, m: 30, a: 365 };
/** Prochaine échéance : dernière réalisation + période, à défaut date de début, à défaut aujourd'hui. */
export function recurrenceSuivante(r: Pick<TacheRecurrente, 'last' | 'start' | 'n' | 'u'>, aujourdhui: string): string {
  const base = analyser(r.last);
  if (base) return iso(ajouterPeriode(base, r.n || 1, r.u || 'a'));
  return analyser(r.start) ? iso(analyser(r.start)!) : aujourdhui;
}
/** Échéances d'une tâche récurrente sur une année civile. */
export function recurrenceOccurrences(r: TacheRecurrente, annee: number, aujourdhui: string): string[] {
  const debut = new Date(Date.UTC(annee, 0, 1)),
    fin = new Date(Date.UTC(annee + 1, 0, 1));
  const n = r.n || 1,
    u = r.u || 'a';
  let d = analyser(recurrenceSuivante(r, aujourdhui))!;
  for (let k = 0; k < 400 && d >= debut; k++) {
    const precedent = ajouterPeriode(d, -n, u);
    if (precedent < debut) break;
    d = precedent;
  }
  const out: string[] = [];
  for (let k = 0; k < 400 && d < fin; k++) {
    if (d >= debut) out.push(iso(d));
    d = ajouterPeriode(d, n, u);
  }
  return out;
}
/** Une occurrence est « réalisée » si une réalisation tombe dans une demi-période autour d'elle. */
export function occurrenceRealisee(r: TacheRecurrente, occurrence: string): boolean {
  const d = analyser(occurrence)!.getTime();
  const periode = (r.n || 1) * (JOURS_UNITE[r.u || 'a'] ?? 365) * 864e5;
  return r.history.some((h) => {
    const x = analyser(h);
    return !!x && x.getTime() >= d - periode / 2 && x.getTime() <= d + periode / 2;
  });
}
