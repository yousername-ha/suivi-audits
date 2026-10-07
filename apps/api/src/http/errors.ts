/* Erreurs HTTP : messages en français, jamais de détail interne côté client. */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const zodText = (e: ZodError) =>
  e.issues
    .slice(0, 5)
    .map((i) => (i.path.length ? `${i.path.join('.')} : ${i.message}` : i.message))
    .join(' ; ');

const FASTIFY_MESSAGES: Record<string, [number, string]> = {
  FST_ERR_CTP_BODY_TOO_LARGE: [413, 'Contenu trop volumineux.'],
  FST_ERR_CTP_INVALID_MEDIA_TYPE: [415, 'Type de contenu non pris en charge.'],
  FST_ERR_CTP_EMPTY_JSON_BODY: [400, 'Corps de requête JSON vide.'],
  FST_ERR_CTP_INVALID_JSON_BODY: [400, 'JSON invalide.'],
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: [400, 'Longueur de contenu invalide.'],
};

export function errorHandler(log: Logger) {
  return (err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message, ...(err.extra ?? {}) });
    if (err instanceof ZodError) return reply.code(422).send({ error: `Données invalides — ${zodText(err)}` });
    const code = (err as FastifyError).code;
    const known = code ? FASTIFY_MESSAGES[code] : undefined;
    if (known) return reply.code(known[0]).send({ error: known[1] });
    if (err instanceof SyntaxError || code === 'FST_ERR_CTP_INVALID_JSON_BODY') return reply.code(400).send({ error: 'JSON invalide.' });
    const status = (err as FastifyError).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: 'Requête invalide.' });
    log.error({ err: err.stack || String(err), path: req.url }, 'request failed');
    return reply.code(500).send({ error: 'Erreur interne.' });
  };
}
