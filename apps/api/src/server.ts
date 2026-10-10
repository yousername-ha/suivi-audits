/* Suivi des audits SMSI ISO 27001 / HDS — serveur d'API. */
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { log } from './log.js';
import { createServices } from './services.js';
import { prepareDatabase } from './startup.js';

async function main() {
  const cfg = loadConfig();
  if (!cfg.db.password) log.warn('no database password configured (db_app_password)');
  const svc = createServices(cfg, log);
  await prepareDatabase(svc);
  await svc.bus.start();
  const app = await buildApp(svc);
  await app.listen({ port: cfg.port, host: cfg.host });
  log.info(
    {
      port: cfg.port,
      mfaRequired: cfg.mfaRequired,
      clamav: !!cfg.clamav,
      keyId: svc.vault.keyId,
      version: cfg.version,
    },
    'listening',
  );

  let working = false;
  const schedule = setInterval(() => {
    if (working || svc.updates.state().maintenance) return;
    working = true;
    void svc.modules
      .run(true, async () => {
        await svc.modules.assert('ecarts');
        await svc.grc.tasks.tick();
      })
      .catch((e: unknown) => log.warn({ err: String(e) }, 'task scheduler'))
      .finally(() => {
        working = false;
      });
  }, 60_000);
  schedule.unref();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(schedule);
    log.info('shutting down');
    setTimeout(() => process.exit(0), 8000).unref();
    await app.close().catch(() => {});
    svc.presence.stop();
    await svc.bus.stop();
    await svc.db.end().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
}

main().catch((e) => {
  log.fatal({ err: (e as Error).stack || String(e) }, 'fatal');
  process.exit(1);
});
