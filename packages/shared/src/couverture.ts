/* Évaluation d'une exigence dans un périmètre (ADR 0041, lot H3) : cinq dimensions séparées — applicabilité, mise en
   œuvre, test d'efficacité, validation métier — et l'état de couverture qui en découle. Fonctions pures partagées par
   l'API (contrôle avant écriture) et l'interface. Aucun taux de conformité : l'état décrit ce qui est établi, pas ce
   qui est certifié. */
import { z } from 'zod';

export const APPLICABILITES = ['a_determiner', 'applicable', 'exclue'] as const;
export const MISES_EN_OEUVRE = ['aucune', 'partielle', 'complete'] as const;
export const RESULTATS_TEST = ['conforme', 'non_conforme'] as const;
export type Applicabilite = (typeof APPLICABILITES)[number];
export type MiseEnOeuvre = (typeof MISES_EN_OEUVRE)[number];
export type ResultatTest = (typeof RESULTATS_TEST)[number];

export const LIBELLES_APPLICABILITE: Record<Applicabilite, string> = {
  a_determiner: 'À déterminer',
  applicable: 'Applicable',
  exclue: 'Exclue (justifiée)',
};
export const LIBELLES_MISE_EN_OEUVRE: Record<MiseEnOeuvre, string> = {
  aucune: 'Aucune',
  partielle: 'Partielle',
  complete: 'Complète',
};
export const LIBELLES_RESULTAT_TEST: Record<ResultatTest, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
};

/** États de couverture, du moins au plus établi. `non_applicable` est à part : hors du calcul. */
export const ETATS_EXIGENCE = [
  'non_implemente',
  'partiel',
  'implemente',
  'teste',
  'valide_metier',
  'non_applicable',
] as const;
export type EtatExigence = (typeof ETATS_EXIGENCE)[number];
export const LIBELLES_ETAT: Record<EtatExigence, string> = {
  non_implemente: 'Non implémenté',
  partiel: 'Partiellement implémenté',
  implemente: 'Implémenté',
  teste: 'Testé',
  valide_metier: 'Validé métier',
  non_applicable: 'Non applicable',
};

export interface EvaluationExigence {
  version: number;
  applicability: Applicabilite;
  justification: string;
  implementation: MiseEnOeuvre;
  implementationNote: string;
  testedAt: string | null;
  testResult: ResultatTest | null;
  testNote: string;
  testRef: string;
  validatedAt: string | null;
  validatedBy: string | null;
  validationNote: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}
type Dimensions = Pick<
  EvaluationExigence,
  'applicability' | 'justification' | 'implementation' | 'testedAt' | 'testResult' | 'validatedAt'
>;

/** État de couverture. Sans évaluation : non implémenté (l'applicabilité reste « à déterminer »). */
export function etatExigence(e: Dimensions | null): EtatExigence {
  if (!e) return 'non_implemente';
  if (e.applicability === 'exclue') return 'non_applicable';
  const complete = e.implementation === 'complete';
  if (complete && e.testResult === 'conforme' && e.validatedAt) return 'valide_metier';
  if (complete && e.testResult === 'conforme') return 'teste';
  if (complete) return 'implemente';
  return e.implementation === 'partielle' ? 'partiel' : 'non_implemente';
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Incohérences d'une évaluation (liste vide : cohérente). Mêmes règles que les contraintes de la base. */
export function incoherencesEvaluation(
  e: Pick<
    EvaluationExigence,
    'applicability' | 'justification' | 'implementation' | 'testedAt' | 'testResult' | 'validatedAt'
  >,
): string[] {
  const p: string[] = [];
  if (e.applicability === 'exclue' && !e.justification.trim()) p.push('Une exigence exclue doit être justifiée.');
  if ((e.testedAt === null) !== (e.testResult === null))
    p.push('Le résultat du test et sa date vont ensemble : renseignez les deux ou aucun.');
  if (e.testResult !== null && e.applicability !== 'applicable')
    p.push('Un test ne s’enregistre que sur une exigence applicable.');
  if (e.testResult !== null && e.implementation === 'aucune')
    p.push('Une exigence sans mise en œuvre ne peut pas être testée.');
  if (e.validatedAt !== null) {
    if (e.applicability !== 'applicable' || e.implementation !== 'complete' || e.testResult !== 'conforme')
      p.push('La validation métier suppose une exigence applicable, complètement mise en œuvre et testée conforme.');
  }
  for (const d of [e.testedAt, e.validatedAt]) if (d !== null && !DATE.test(d)) p.push('Date invalide (AAAA-MM-JJ).');
  if (e.validatedAt && e.testedAt && e.validatedAt < e.testedAt) p.push('La validation ne peut pas précéder le test.');
  return p;
}

const texte = (n: number) => z.string().trim().max(n);
const date = z.union([z.null(), z.string().regex(DATE, 'Date invalide (AAAA-MM-JJ).')]);
/** Corps d'une nouvelle version d'évaluation : la version complète, pas un patch (aucune dimension n'est héritée). */
export const EvaluationExigenceCorps = z
  .object({
    applicability: z.enum(APPLICABILITES),
    justification: texte(2000).default(''),
    implementation: z.enum(MISES_EN_OEUVRE),
    implementationNote: texte(5000).default(''),
    testedAt: date.default(null),
    testResult: z.enum(RESULTATS_TEST).nullable().default(null),
    testNote: texte(5000).default(''),
    testRef: texte(500).default(''),
    validatedAt: date.default(null),
    validationNote: texte(5000).default(''),
    reason: texte(500).min(1, 'Un motif est requis.'),
    confirm: z.literal('EVALUER'),
  })
  .strict()
  .superRefine((e, ctx) => {
    for (const m of incoherencesEvaluation(e)) ctx.addIssue({ code: 'custom', message: m });
  });
export type EvaluationExigenceCorps = z.infer<typeof EvaluationExigenceCorps>;

export type SyntheseEtats = Record<EtatExigence, number>;
/** Dénombrement par état. `applicables` exclut les exigences non applicables. */
export function syntheseEtats(etats: readonly EtatExigence[]): SyntheseEtats & { applicables: number } {
  const s = Object.fromEntries(ETATS_EXIGENCE.map((k) => [k, 0])) as SyntheseEtats;
  for (const e of etats) s[e]++;
  return { ...s, applicables: etats.length - s.non_applicable };
}
