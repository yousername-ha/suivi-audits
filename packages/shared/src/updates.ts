import { z } from 'zod';

export const ReleaseVersion = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .max(40);
export const UpdateRequest = z
  .object({
    requestId: z.string().uuid(),
    version: ReleaseVersion,
    confirm: z.literal('METTRE À JOUR'),
  })
  .strict();
export const UpdateState = z.object({
  installed: z.string().max(80),
  available: ReleaseVersion.nullable(),
  checkedAt: z.string().datetime().nullable(),
  notes: z.string().url().startsWith('https://github.com/yousername-ha/suivi-audits/releases/tag/v').nullable(),
  checking: z.boolean(),
  checkError: z.boolean(),
  ready: z.boolean(),
  maintenance: z.boolean(),
  id: z.string().uuid().nullable(),
  target: ReleaseVersion.nullable(),
  status: z.enum(['idle', 'queued', 'running', 'success', 'rolled_back', 'failed', 'intervention']),
  phase: z.enum(['idle', 'checking', 'preparing', 'backup', 'installing', 'verifying', 'rollback', 'complete']),
  message: z.string().max(500),
  startedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type UpdateState = z.infer<typeof UpdateState>;
export type UpdateRequest = z.infer<typeof UpdateRequest>;
