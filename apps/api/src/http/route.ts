/* Définition déclarative des routes : contrôle d'accès, protection CSRF, validation zod et documentation OpenAPI
   à partir d'une seule description. Toute route passe par ici : aucune route ne peut oublier un contrôle. */
import { type Permission } from '@suivi/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z, type ZodType } from 'zod';
import type { Session } from '../auth.js';
import type { Config } from '../config.js';
import { safeEqual } from '../security/crypto.js';
import type { Services } from '../services.js';
import { HttpError } from './errors.js';
import { sameOrigin } from './security.js';

type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** public : sans session ; session : session ouverte à n'importe quelle étape ; auth : session complète
    (compte personnel) ; metier : au moins un module métier lisible ; « module:action » : permission exigée. */
export type Access = 'public' | 'session' | 'auth' | 'metier' | Permission;

export interface Ctx<B = unknown, Q = unknown, P = unknown> {
  req: FastifyRequest;
  reply: FastifyReply;
  s: Session | null;
  ip: string;
  body: B;
  query: Q;
  params: P;
  svc: Services;
}

export interface RouteDef<B = unknown, Q = unknown, P = unknown> {
  method: Method | Method[];
  url: string;
  summary: string;
  tags: string[];
  access: Access;
  /** Jeton CSRF exigé sur les méthodes modifiantes (par défaut : oui). Désactivé seulement avant toute session (connexion, installation). */
  csrf?: boolean;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  params?: ZodType<P>;
  /** Corps binaire (application/octet-stream), reçu sous forme de Buffer. */
  raw?: boolean;
  /** Taille maximale du corps en octets (par défaut 1 Mio), éventuellement calculée depuis la configuration. */
  bodyLimit?: number | ((cfg: Config) => number);
  response?: ZodType;
  status?: number;
  /** Route exclue de la documentation OpenAPI (pages, fichiers statiques). */
  hidden?: boolean;
  handler: (ctx: Ctx<B, Q, P>) => Promise<unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const route = <B = undefined, Q = undefined, P = undefined>(d: RouteDef<B, Q, P>): RouteDef<any, any, any> => d;

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRoutes(app: FastifyInstance, svc: Services, defs: RouteDef<any, any, any>[]) {
  for (const d of defs) {
    const methods = Array.isArray(d.method) ? d.method : [d.method];
    app.route({
      method: methods,
      url: d.url,
      ...(d.bodyLimit ? { bodyLimit: typeof d.bodyLimit === 'function' ? d.bodyLimit(svc.cfg) : d.bodyLimit } : {}),
      handler: async (req, reply) => {
        // Limite globale par adresse IP, avant toute lecture en base (session, droits) : toutes les routes passent ici.
        if (!svc.limits.global(req.ip)) {
          reply.header('Retry-After', '60');
          throw new HttpError(429, 'Trop de requêtes. Réessayez dans une minute.');
        }
        const s = await svc.auth.load(req);
        if (UNSAFE.has(req.method)) {
          if (!sameOrigin(req, svc.cfg)) throw new HttpError(403, 'Origine refusée.');
          if (d.csrf !== false) {
            if (!s) throw new HttpError(401, 'Session expirée. Reconnectez-vous.', { stage: 'anon' });
            if (!safeEqual(req.headers['x-csrf-token'] || '', s.csrf))
              throw new HttpError(403, 'Jeton CSRF invalide. Rechargez la page.');
          }
        }
        if (d.access === 'session') {
          if (!s) throw new HttpError(401, 'Session expirée. Reconnectez-vous.', { stage: 'anon' });
        } else if (d.access === 'auth') svc.auth.requireAuth(s);
        else if (d.access === 'metier') svc.auth.requireBusinessRead(s);
        else if (d.access !== 'public') svc.auth.requirePermission(s, d.access);
        const body = d.raw ? req.body : d.body ? d.body.parse(req.body ?? {}) : undefined;
        const query = d.query ? d.query.parse(req.query ?? {}) : undefined;
        const params = d.params ? d.params.parse(req.params ?? {}) : undefined;
        const out = await d.handler({ req, reply, s, ip: req.ip, body, query, params, svc });
        if (reply.sent) return reply;
        if (out === undefined) return reply.code(204).send();
        return reply.code(d.status ?? 200).send(out);
      },
    });
  }
}

/* ---------------------------------------------------------------- OpenAPI 3.1 */
const toSchema = (s: ZodType) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOpenApi(defs: RouteDef<any, any, any>[], info: { title: string; version: string }) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const d of defs) {
    if (d.hidden) continue;
    const p = d.url.replace(/:(\w+)/g, '{$1}');
    const methods = Array.isArray(d.method) ? d.method : [d.method];
    for (const m of methods) {
      if (m === 'HEAD') continue;
      const parameters: unknown[] = [];
      for (const [where, sch] of [
        ['path', d.params],
        ['query', d.query],
      ] as const) {
        if (sch instanceof z.ZodObject) {
          for (const [name, prop] of Object.entries(sch.shape as Record<string, ZodType>)) {
            parameters.push({
              name,
              in: where,
              required: where === 'path' || !prop.safeParse(undefined).success,
              schema: toSchema(prop),
            });
          }
        }
      }
      const op: Record<string, unknown> = {
        summary: d.summary,
        tags: d.tags,
        operationId: `${m.toLowerCase()}_${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}`,
        security: d.access === 'public' ? [] : [{ session: [] }],
        'x-access': d.access,
        parameters,
        responses: {
          [String(d.status ?? 200)]: {
            description: 'Succès',
            ...(d.response ? { content: { 'application/json': { schema: toSchema(d.response) } } } : {}),
          },
          '4XX': { description: 'Erreur (message en français dans « error »)' },
        },
      };
      if (d.body) op.requestBody = { required: true, content: { 'application/json': { schema: toSchema(d.body) } } };
      if (d.raw)
        op.requestBody = {
          required: true,
          content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
        };
      (paths[p] ??= {})[m.toLowerCase()] = op;
    }
  }
  return {
    openapi: '3.1.0',
    info: {
      ...info,
      description:
        'API du suivi des audits SMSI ISO 27001 / HDS. Toute requête modifiante exige l’en-tête X-CSRF-Token et une origine identique.',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        session: { type: 'apiKey', in: 'cookie', name: '__Host-suivi_sid' },
        csrf: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
      },
    },
    paths,
  };
}
