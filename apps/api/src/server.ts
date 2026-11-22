/* Suivi des audits SMSI ISO 27001 / HDS — serveur d'API. */
import { buildApp } from './app.js';
import { rappelsDeclarationsIncidents } from './automate-declarations.js';
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
    // Rappels des déclarations réglementaires des incidents (ADR 0105) : en premier et à part, pour ne pas dépendre du module
    // des écarts (dont l'absence arrête la suite de l'automate).
    void rappelsDeclarationsIncidents(svc)
      .catch((e: unknown) => log.warn({ err: String(e) }, 'rappels des déclarations d’incident'))
      .then(() =>
        svc.modules.run(true, async () => {
          await svc.modules.assert('ecarts');
          await svc.grc.tasks.tick();
        }),
      )
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
      // Veille des vulnérabilités (ADR 0100, lots V2 et V3) : au plus une collecte par source et par période réglée (lot F1), rien si le module
      // est désactivé ou son flux fermé. L'exécutant d'exploitation lit les sources ; l'API ne fait qu'inscrire.
      .then(() =>
        svc.modules
          .run(true, async () => {
            if ((await svc.modules.state()).disabled.includes('vulnerabilites')) return;
            // Lot PRIO-1 : journal des collectes et des exécutions purgé au-delà de 90 jours, au plus une fois par heure.
            await svc.vulnerabilites.purgeJournaux
              .tic()
              .catch((e: unknown) => log.warn({ err: String(e) }, 'purge des journaux des vulnérabilités'));
            await svc.vulnerabilites.veille.planifier();
            // Lot CVE-INC : sources facultatives activées (Cloudflare Radar, tldrcve), à leur fréquence en minutes.
            await svc.vulnerabilites.annonces.planifier();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'veille des vulnérabilités')),
      )
      // Veille réglementaire (ADR 0110) : au plus une collecte par source activée et par période réglée, rien si le module est
      // désactivé ou son flux fermé. L'exécutant d'exploitation lit les sources ; l'API ne fait qu'inscrire.
      .then(() =>
        svc.modules
          .run(true, async () => {
            if ((await svc.modules.state()).disabled.includes('veille_reglementaire')) return;
            await svc.veilleReglementaire.planifier();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'veille réglementaire')),
      )
      // Synchronisation de Tenable (ADR 0100, lot V5) : une par période réglée (lot F1) et par instance active, rien si le module Intégrations
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
      // Synchronisation d'AlgoLightHouse (ADR 0100, lot ALH1) : une par période réglée (lot F1) et par instance active, rien si le module
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
      // Imports de scans Nessus et de rapports Silène abandonnés (ADR 0100, lots N1 et SI1) : clos après trente minutes sans
      // lot. Rien si le module est désactivé.
      .then(() =>
        svc.modules
          .run(true, async () => {
            if ((await svc.modules.state()).disabled.includes('vulnerabilites')) return;
            await svc.vulnerabilites.importNessus.tic();
            // Lot SI1 : imports de rapports Silène abandonnés, même règle.
            await svc.vulnerabilites.importSilene.tic();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'imports de fichiers')),
      )
      // Délais de correction et exceptions à échéance (ADR 0100, lot S1) : au plus une évaluation par quart d'heure ;
      // expiration et rappel des exceptions, failles entrées en dépassement, résumés notifiés. Rien si le module est
      // désactivé.
      .then(() =>
        svc.modules
          .run(true, async () => {
            if ((await svc.modules.state()).disabled.includes('vulnerabilites')) return;
            await svc.vulnerabilites.delais.tic();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'délais des vulnérabilités')),
      )
      // Instantané quotidien de la situation (ADR 0100, lot S2) : au plus un par jour, créneau consommé avant le calcul,
      // aucun rattrapage après une panne ; purge des instantanés plus anciens que la rétention. Rien si le module est
      // désactivé.
      .then(() =>
        svc.modules
          .run(true, async () => {
            if ((await svc.modules.state()).disabled.includes('vulnerabilites')) return;
            await svc.vulnerabilites.tendances.tic();
          })
          .catch((e: unknown) => log.warn({ err: String(e) }, 'instantané des vulnérabilités')),
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
