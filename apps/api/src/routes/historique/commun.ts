import { z } from 'zod';
import type { Session } from '../../auth.js';

export const tags = ['Outil de suivi (reprise)'];
export const user = (s: unknown) => (s as Session).user;
export const idPlan = z.object({ id: z.string().trim().min(1).max(80) });
export const idElement = z.object({ id: z.string().trim().min(1).max(64) });
export const creneau = z.object({ day: z.string().trim().min(1).max(64).optional() }).strict();
export const souple = z.record(z.string(), z.unknown());
export const indice = z.coerce.number().int().min(0).max(100000);
export const idIndice = z.object({ id: z.string().trim().min(1).max(64), k: indice });
export const idEvenement = z.object({ id: z.string().trim().min(1).max(64), eid: z.string().trim().min(1).max(32) });
export const idProposition = z.object({ id: z.string().trim().min(1).max(64), pid: z.string().trim().min(1).max(32) });
export const idContributeur = z.object({ id: z.string().trim().min(1).max(64), uid: z.uuid() });
export const indiceSeul = z.object({ k: indice });
