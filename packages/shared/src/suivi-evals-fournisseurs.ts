/* Évaluations de sécurité des fournisseurs par le clausier (reprise de la page « Évaluations sécurité » de l'outil de
   suivi) : points du clausier selon les chapitres applicables, état de chaque point, note A à E indicative et écarts.
   Calculs repris à l'identique de l'outil historique (`sevPoints`, `sevScore`). Les données du clausier (licence CC BY-NC-SA 4.0)
   sont fournies par l'API : ce module n'en contient aucune. */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export interface ExigenceClausier {
  ref: string;
  sec: string;
  sub: string | null;
  title: string;
  text: string;
  page?: number | null;
  removed?: boolean;
}
export interface Clausier {
  version: string;
  source: string;
  sections: Record<string, string>;
  /** Chapitre → cas qui le rend applicable (les chapitres sans cas sont toujours applicables). */
  cases: Record<string, string>;
  reqs: ExigenceClausier[];
}
export const CAS_CLAUSIER = [
  ['rgpd', 'Le titulaire traite des données personnelles pour le compte de l’établissement (chapitre 2)'],
  ['wifi', 'Équipements wi-fi (chapitre 10)'],
  ['mob', 'Dispositifs mobiles (12.1)'],
  ['dm', 'Dispositifs médicaux connectés (12.2)'],
  ['cloud', 'Service hébergé hors du SI, SaaS ou IaaS (12.3)'],
  ['admin', 'Service hébergé par l’établissement et administré par le titulaire (12.4)'],
  ['dev', 'Prestation de développement (12.5)'],
  ['ia', 'Solution utilisant l’intelligence artificielle (13)'],
] as const;
export const ETATS_POINT_CLAUSIER = ['À évaluer', 'Conforme', 'Partiel', 'Non conforme', 'Non applicable'] as const;
export type EtatPoint = (typeof ETATS_POINT_CLAUSIER)[number];

export interface PointClausier {
  id: string;
  chapitre: string;
  libelleChapitre: string;
  sousChapitre: string | null;
  titre: string;
  texte: string;
}
export interface EvaluationClausier {
  id: string;
  supplier: string;
  product: string;
  date: string;
  evaluator: string;
  source: string;
  cases: string[];
  ans: Record<string, { st: string; c: string }>;
}
export function lireEvaluationClausier(brut: unknown): EvaluationClausier | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  if (!str(o.id)) return null;
  const ans: EvaluationClausier['ans'] = {};
  if (o.ans && typeof o.ans === 'object' && !Array.isArray(o.ans))
    for (const [k, v] of Object.entries(o.ans as Obj)) {
      const a = v && typeof v === 'object' ? (v as Obj) : {};
      ans[k] = { st: str(a.st), c: str(a.c) };
    }
  return {
    id: str(o.id),
    supplier: str(o.supplier),
    product: str(o.product),
    date: str(o.date),
    evaluator: str(o.evaluator),
    source: str(o.source),
    cases: Array.isArray(o.cases) ? (o.cases as unknown[]).map(str) : [],
    ans,
  };
}

/** Points applicables : exigences non supprimées dont le chapitre n'est propre à aucun cas ou dont le cas est coché. */
export function pointsEvaluation(c: Clausier, cases: readonly string[]): PointClausier[] {
  return c.reqs
    .filter((r) => !r.removed)
    .filter((r) => {
      const cas = c.cases[r.sec];
      return !cas || cases.includes(cas);
    })
    .map((r) => ({
      id: r.ref,
      chapitre: r.sec,
      libelleChapitre: c.sections[r.sec] ?? r.sec,
      sousChapitre: r.sub,
      titre: r.title,
      texte: r.text,
    }));
}
export const etatPoint = (ev: Pick<EvaluationClausier, 'ans'>, id: string): string => ev.ans[id]?.st || 'À évaluer';

export interface ScoreEvaluation {
  /** Points applicables (hors « Non applicable »). */
  n: number;
  done: number;
  pc: number | null;
  note: string;
  nc: number;
  pa: number;
}
/** Note indicative : part pondérée des points évalués (conforme 1, partiel 0,5), de A (90 %) à E (moins de 40 %). */
export function scoreEvaluation(
  points: readonly { id: string }[],
  ev: Pick<EvaluationClausier, 'ans'>,
): ScoreEvaluation {
  const st = (p: { id: string }) => etatPoint(ev, p.id);
  const ap = points.filter((p) => st(p) !== 'Non applicable'),
    evalues = ap.filter((p) => st(p) !== 'À évaluer');
  const pts = evalues.reduce((a, p) => a + (st(p) === 'Conforme' ? 1 : st(p) === 'Partiel' ? 0.5 : 0), 0);
  const pc = evalues.length ? Math.round((pts / evalues.length) * 100) : null;
  const note = pc == null ? '–' : pc >= 90 ? 'A' : pc >= 75 ? 'B' : pc >= 60 ? 'C' : pc >= 40 ? 'D' : 'E';
  return {
    n: ap.length,
    done: evalues.length,
    pc,
    note,
    nc: evalues.filter((p) => st(p) === 'Non conforme').length,
    pa: evalues.filter((p) => st(p) === 'Partiel').length,
  };
}
/** Écarts : points partiels ou non conformes. */
export const ecartsEvaluation = (points: readonly PointClausier[], ev: Pick<EvaluationClausier, 'ans'>) =>
  points.filter((p) => ['Partiel', 'Non conforme'].includes(etatPoint(ev, p.id)));

/** Identifiant d'une action des écarts d'une évaluation : FOU-nn, premier numéro libre. */
export function identifiantActionFournisseur(existants: readonly string[]): string {
  let k = 1;
  while (existants.includes(`FOU-${String(k).padStart(2, '0')}`)) k++;
  return `FOU-${String(k).padStart(2, '0')}`;
}

const t = (n: number) => z.string().trim().max(n);
export const EvaluationClausierModification = z
  .object({
    supplier: t(100).min(1),
    product: t(300),
    date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).')]),
    evaluator: t(200),
    source: t(500),
    cases: z.array(z.enum(CAS_CLAUSIER.map((c) => c[0]) as [string, ...string[]])).max(8),
  })
  .partial()
  .strict();
export type EvaluationClausierModification = z.infer<typeof EvaluationClausierModification>;
export const EvaluationClausierCreation = z.object({ supplier: t(100).optional() }).strict();
export const ReponsePoint = z
  .object({ st: z.enum(ETATS_POINT_CLAUSIER), c: t(5000) })
  .partial()
  .strict();
export type ReponsePoint = z.infer<typeof ReponsePoint>;
