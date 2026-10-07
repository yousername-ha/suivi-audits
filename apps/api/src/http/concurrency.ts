/* Concurrence optimiste par enregistrement : ETag = "<version>", PATCH avec If-Match.
   Une réponse 412 n'est renvoyée que si CET enregistrement a changé ; elle contient sa version courante. */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from './errors.js';

/** Version attendue lue dans If-Match ("3", W/"3" ou 3). Lève 428 si l'en-tête est absent ou illisible. */
export function requireIfMatch(req: FastifyRequest): number {
  const raw = String(req.headers['if-match'] ?? '').trim();
  const m = /^(?:W\/)?"?(\d+)"?$/.exec(raw);
  if (!m) {
    throw new HttpError(428, 'Version attendue manquante (en-tête If-Match) : rechargez l’élément avant de le modifier.', {
      reason: 'precondition_required',
    });
  }
  return parseInt(m[1] as string, 10);
}

export const etag = (version: number) => `"${version}"`;

export function setEtag(reply: FastifyReply, version: number) {
  reply.header('ETag', etag(version));
}

/** Conflit : l'enregistrement a été modifié depuis sa lecture par le client. */
export function conflict(current: Record<string, unknown> & { version: number; updated_by?: string }): HttpError {
  return new HttpError(
    412,
    `Cet élément a été modifié par ${current.updated_by || 'un autre utilisateur'} depuis son ouverture. Rechargez-le pour voir la version actuelle.`,
    { reason: 'conflict', current },
  );
}
