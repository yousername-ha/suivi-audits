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
      antivirus: `${cfg.clamav.host}:${cfg.clamav.port}, selon le flux « antivirus »`,
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
      // Rondes de l'assistant (ADR 0086) : après l'automate, qui n'en dépend pas. La ronde tourne en tâche de fond.
      .then(() =>
        svc.modules
          .run(true, async () => {
            if ((await svc.modules.state()).disabled.includes('assistant')) return;
            await svc.assistantRondes.tic();
            await svc.assistantDocuments.indexer();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'rondes de l’assistant')),
      )
      // Veille des vulnérabilités (ADR 0100, lots V2 et V3) : au plus une collecte par source et par jour, rien si le module
      // est désactivé ou son flux fermé. L'exécutant d'exploitation lit les sources ; l'API ne fait qu'inscrire.
      .then(() =>
        svc.modules
          .run(true, async () => {
            if ((await svc.modules.state()).disabled.includes('vulnerabilites')) return;
            await svc.vulnerabilites.veille.planifier();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'veille des vulnérabilités')),
      )
      // Synchronisation de Tenable (ADR 0100, lot V5) : une par jour et par instance active, rien si le module Intégrations
      // ou le module Vulnérabilités est désactivé, ou si le flux « tenable » est fermé.
      .then(() =>
        svc.modules
          .run(true, async () => {
            const { disabled } = await svc.modules.state();
            if (disabled.includes('vulnerabilites') || disabled.includes('integrations')) return;
            await svc.vulnerabilites.tenable.planifier();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'synchronisation de Tenable')),
      )
      // Synchronisation d'AlgoLightHouse (ADR 0100, lot ALH1) : une par jour et par instance active, rien si le module
      // Intégrations ou le module Vulnérabilités est désactivé, ou si le flux « algolighthouse » est fermé.
      .then(() =>
        svc.modules
          .run(true, async () => {
            const { disabled } = await svc.modules.state();
            if (disabled.includes('vulnerabilites') || disabled.includes('integrations')) return;
            await svc.vulnerabilites.surfaceExterne.planifier();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'synchronisation d’AlgoLightHouse')),
      )
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
