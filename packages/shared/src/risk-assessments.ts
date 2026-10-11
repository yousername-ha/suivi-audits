import { z } from 'zod';
import { RiskExample, EnvironmentVersion } from './environment.js';

export const AssessmentIntent = z
  .object({
    sourceSha: z.string().regex(/^[a-f0-9]{64}$/),
    configurationVersion: z.number().int().min(1).max(2147483647),
    ratings: RiskExample,
  })
  .strict();
export type AssessmentIntent = z.infer<typeof AssessmentIntent>;
export const AssessmentPublication = z
  .object({
    requestId: z.uuid(),
    intent: AssessmentIntent,
    previewId: z.string().regex(/^[a-f0-9]{64}$/),
    rationale: z.string().trim().min(10).max(2000),
    confirm: z.literal('ENREGISTRER'),
  })
  .strict();
export type AssessmentPublication = z.infer<typeof AssessmentPublication>;
export const RiskResult = z.object({
  initial: z.number(),
  residual: z.number(),
  reduction: z.number(),
  criticality: z.object({
    id: z.string(),
    label: z.string(),
    minimum: z.number(),
    tone: z.enum(['neutral', 'low', 'medium', 'high']),
  }),
});
export const RiskAssessment = z.object({
  id: z.uuid(),
  sourceId: z.string(),
  sourceSha: z.string(),
  sourceSnapshot: z.record(z.string(), z.unknown()),
  configuration: EnvironmentVersion,
  revision: z.number().int(),
  ratings: RiskExample,
  result: RiskResult,
  rationale: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
});
export type RiskAssessment = z.infer<typeof RiskAssessment>;
export interface AssessmentSource {
  id: string;
  domain: string;
  scenario: string;
  sourcePresent: boolean;
  ambiguous: boolean;
  sourceSha: string | null;
  revision: number;
  lastAssessment:
    (Pick<RiskAssessment, 'id' | 'revision' | 'result' | 'createdAt'> & { configurationVersion: number }) | null;
}

/** Parité avec aiEval v2. Ce résultat explique la source courante ; il n'est pas une décision historisée. */
export function legacyAiRisk(e: Record<string, unknown>) {
  if (/^conditionnel/i.test(String(e.app ?? ''))) return { level: 'N/A conditionnel', idx: null, res: null };
  const n = (key: string) => Number(e[key]) || 0;
  const impact = Math.max(n('c'), n('i'), n('a'), n('audit'), n('patient'));
  const residual = Math.min(25, impact * n('prob') * (e.dscp === 'Oui' ? 1.25 : 1)) * (1 - n('maturity') / 5);
  const idx = Math.round((0.7 * residual + 0.3 * n('effort')) * 10) / 10;
  return {
    idx,
    res: Math.round(residual * 10) / 10,
    level: idx >= 16 ? 'Critique' : idx >= 10 ? 'Élevé' : idx >= 5 ? 'Modéré' : 'Faible',
  };
}
