/* Construction de l'application Fastify (sans écoute réseau : utilisée telle quelle par les tests). */
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, errorHandler } from './http/errors.js';
import { buildOpenApi, registerRoutes, route, type RouteDef } from './http/route.js';
import { isHttps, setBaseHeaders } from './http/security.js';
import { expireAccounts } from './rights.js';
import { accessRoutes } from './routes/access.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { eventRoutes } from './routes/events.js';
import { importRoutes } from './routes/import.js';
import { legacyRoutes } from './routes/legacy.js';
import { settingsRoutes } from './routes/settings.js';
import type { Services } from './services.js';

// Messages de validation en français.
z.config(z.locales.fr());

const systemRoutes = (all: () => RouteDef[]) => [
  route({
    method: ['GET', 'HEAD'],
    url: '/healthz',
    summary: 'Sonde de santé (base de données joignable)',
    tags: ['Système'],
    access: 'public',
    handler: async ({ svc, reply }) => {
      await svc.db.q('SELECT 1');
      reply.header('Cache-Control', 'no-store').type('text/plain; charset=utf-8');
      return reply.send('ok');
    },
  }),
  route({
    method: 'GET',
    url: '/api/openapi.json',
    summary: 'Description OpenAPI 3.1 de l’API',
    tags: ['Système'],
    access: 'auth',
    handler: async ({ svc }) => buildOpenApi(all(), { title: 'Suivi des audits SMSI — API', version: svc.cfg.version }),
  }),
];

export function allRoutes(): RouteDef[] {
  const list: RouteDef[] = [];
  list.push(
    ...systemRoutes(() => list),
    ...authRoutes,
    ...documentRoutes,
    ...accessRoutes,
    ...adminRoutes,
    ...eventRoutes,
    ...legacyRoutes,
    ...importRoutes,
    ...settingsRoutes,
  );
  return list;
}

export async function buildApp(svc: Services): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: svc.log as unknown as FastifyBaseLogger,
    trustProxy: svc.cfg.trustProxy,
    bodyLimit: 1024 * 1024,
    requestIdHeader: false,
    return503OnClosing: true,
  });
  // Corps binaires (dépôt de documents, import) : reçus en Buffer, taille limitée route par route.
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
  app.addHook('onRequest', async (req, reply) => {
    setBaseHeaders(reply);
    reply.header('Cache-Control', 'no-store');
    if (svc.cfg.cookieSecure !== 'false' && isHttps(req))
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });
  app.setErrorHandler(errorHandler(svc.log));
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'Introuvable.' }));
  registerRoutes(app, svc, allRoutes());
  // Paramètres modifiés (ici ou par une autre instance) : rechargement du cache.
  const onSettings = (e: { entity: string }) => {
    if (e.entity === 'settings') svc.settings.load().catch(() => {});
  };
  svc.bus.on('change', onSettings);
  // Purge des sessions expirées.
  const purge = setInterval(() => svc.auth.purgeExpired().catch(() => {}), 10 * 60e3);
  purge.unref();
  // Comptes arrivés à expiration : désactivés automatiquement (et sessions fermées), au démarrage puis toutes les 5 min.
  const expire = () =>
    expireAccounts(svc.db)
      .then((names) => names.length && svc.log.info({ accounts: names }, 'accounts expired'))
      .catch((e: Error) => svc.log.warn({ err: e.message }, 'account expiry failed'));
  void expire();
  const expiry = setInterval(expire, 5 * 60e3);
  expiry.unref();
  app.addHook('onClose', async () => {
    svc.bus.off('change', onSettings);
    clearInterval(purge);
    clearInterval(expiry);
  });
  return app;
}

export { HttpError };
