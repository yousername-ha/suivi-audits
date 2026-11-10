import { z } from 'zod';

export const base = { tags: ['SMSI GRC'], access: 'metier' as const };
export const scope = z.object({ smsi: z.uuid() });
export const object = scope.extend({ id: z.uuid() });
export const supplierParam = z.object({ id: z.string().min(1).max(200) });
export const criterionParam = z.object({ id: z.uuid() });
export const publication = z
  .object({
    definition: z.unknown(),
    previewId: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.string().trim().min(10).max(1000),
    confirm: z.literal('PUBLIER'),
  })
  .strict();
export const evaluation = z
  .object({
    ratings: z.unknown(),
    rationale: z.string().trim().min(10).max(10000),
    decision: z.enum(['draft', 'approved']),
  })
  .strict();
