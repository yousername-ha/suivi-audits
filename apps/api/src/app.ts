/* Construction de l'application Fastify (sans écoute réseau : utilisée telle quelle par les tests). */
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, errorHandler } from './http/errors.js';
import { buildOpenApi, registerRoutes, route, type RouteDef } from './http/route.js';
import { isHttps, setBaseHeaders } from './http/security.js';
import { expireAccounts } from './rights.js';
import { accessRoutes } from './routes/access.js';
import { moduleRoutes } from './routes/modules.js';
import { adminRoutes } from './routes/admin.js';
import { updateRoutes } from './routes/updates.js';
import { operationRoutes } from './routes/operations.js';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { eventRoutes } from './routes/events.js';
import { importRoutes } from './routes/import.js';
import { tenacyRoutes } from './routes/tenacy.js';
import { suiviRoutes } from './routes/suivi.js';
import { exportSuiviRoutes } from './routes/export-suivi.js';
import { settingsRoutes } from './routes/settings.js';
import { configGrcRoutes } from './routes/config-grc.js';
import { historiqueRoutes } from './routes/historique.js';
import { environmentRoutes } from './routes/environment.js';
import { riskAssessmentRoutes } from './routes/risk-assessments.js';
import { businessPolicyRoutes } from './routes/business-policy.js';
import { grcRoutes } from './routes/grc.js';
import { registresRoutes } from './routes/registres.js';
import { pilotageRoutes } from './routes/pilotage.js';
import { affichageRoutes } from './routes/affichage.js';
import { cartoRoutes } from './routes/carto.js';
import { lastMigration, pendingMigrations } from './systeme.js';
import { ReadyOut, VersionOut } from '@suivi/shared';
import { MAX_SCHEMA, MIN_SCHEMA } from '@suivi/shared/legacy';
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
    url: '/api/health/ready',
    summary:
      'Disponibilité complète (base joignable, migrations appliquées, version) — réservée aux appels locaux (script de mise à jour)',
    tags: ['Système'],
    access: 'public',
    response: ReadyOut,
    handler: async ({ svc, req, reply }) => {
      // Uniquement depuis le conteneur lui-même (docker compose exec app …), jamais au travers du frontal.
      if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.raw.socket.remoteAddress ?? ''))
        throw new HttpError(404, 'Introuvable.');
      let base: boolean;
      let attente: string[] = [];
      try {
        await svc.db.q('SELECT 1');
        base = true;
        attente = await pendingMigrations(svc.db);
      } catch {
        base = false;
      }
      const pret = base && attente.length === 0;
      reply.code(pret ? 200 : 503).header('Cache-Control', 'no-store');
      return { pret, version: svc.cfg.version, base, migrationsEnAttente: attente };
    },
  }),
  route({
    method: 'GET',
    url: '/api/version',
    summary: 'Version en service, dernière migration appliquée, schémas de l’outil historique acceptés',
    tags: ['Système'],
    access: 'auth',
    response: VersionOut,
    handler: async ({ svc }) => ({
      version: svc.cfg.version,
      derniereMigration: await lastMigration(svc.db),
      schemaLegacy: { min: MIN_SCHEMA, max: MAX_SCHEMA },
    }),
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
    ...moduleRoutes,
    ...operationRoutes,
    ...updateRoutes,
    ...eventRoutes,
    ...suiviRoutes,
    ...exportSuiviRoutes,
    ...importRoutes,
    ...tenacyRoutes,
    ...settingsRoutes,
    ...environmentRoutes,
    ...businessPolicyRoutes,
    ...configGrcRoutes,
    ...historiqueRoutes,
    ...grcRoutes,
    ...registresRoutes,
    ...pilotageRoutes,
    ...riskAssessmentRoutes,
    ...affichageRoutes,
    ...cartoRoutes,
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
    await svc.modules.end();
    clearInterval(purge);
    clearInterval(expiry);
  });
  return app;
}

export { HttpError };
