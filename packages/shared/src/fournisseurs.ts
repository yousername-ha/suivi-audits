/* Fournisseurs de l'organisation (ADR 0032, lot M4) : critères définis par l'organisme, évaluations immuables sans
   périmètre, rattachement à des périmètres. Aucune grille, aucun seuil, aucun critère n'est fourni. */
import { z } from 'zod';

/** Usages d'un critère, repris de l'ISO 9001:2015, 8.4.1 : sélection, évaluation, surveillance des performances, réévaluation. */
export const USAGES_CRITERE = ['selection', 'evaluation', 'surveillance', 'reevaluation'] as const;
export type UsageCritere = (typeof USAGES_CRITERE)[number];
export const USAGES_CRITERE_LIBELLES: Record<UsageCritere, string> = {
  selection: 'Sélection',
  evaluation: 'Évaluation',
  surveillance: 'Surveillance des performances',
  reevaluation: 'Réévaluation',
};
const EXIGENCE_BIBLIOTHEQUE = z
  .string()
  .regex(/^requirement:[0-9a-f-]{36}:[1-9][0-9]{0,8}:[^\p{Cc}]{1,120}$/u, 'Exigence de la bibliothèque attendue.');

export const SupplierBody = z.object({ name: z.string().trim().min(2).max(200) }).strict();
export type SupplierBody = z.infer<typeof SupplierBody>;

export const SupplierCriterionBody = z
  .object({
    label: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).default(''),
    purposes: z
      .array(z.enum(USAGES_CRITERE))
      .max(USAGES_CRITERE.length)
      .refine((v) => new Set(v).size === v.length, 'Usages en double.')
      .default([]),
    requirementRefs: z
      .array(EXIGENCE_BIBLIOTHEQUE)
      .max(50)
      .refine((v) => new Set(v).size === v.length, 'Exigences en double.')
      .default([]),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();
export type SupplierCriterionBody = z.infer<typeof SupplierCriterionBody>;

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ.');
export const SupplierEvaluationBody = z
  .object({
    evaluatedAt: DATE,
    conclusion: z.string().trim().max(5000).default(''),
    nextReviewAt: DATE.nullable().default(null),
    items: z
      .array(
        z
          .object({
            criterionId: z.uuid(),
            /** Oui, non ou non évalué (null) : ce n'est pas une échelle. */
            meets: z.boolean().nullable(),
            result: z.string().trim().max(2000).default(''),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine((v) => new Set(v.map((i) => i.criterionId)).size === v.length, 'Critère en double.'),
    confirm: z.literal('ENREGISTRER'),
  })
  .strict();
export type SupplierEvaluationBody = z.infer<typeof SupplierEvaluationBody>;
