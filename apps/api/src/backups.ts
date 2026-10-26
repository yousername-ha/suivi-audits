/* A1a : file transactionnelle. Seule la CLI du serveur peut annoncer, réclamer et terminer une tâche. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BackupJobOut, BackupReportOut } from '@suivi/shared';
import { z } from 'zod';
import type { Config } from './config.js';
import { sql, type Selectable } from 'kysely';
import type { Actor, Client, Db } from './db/db.js';
import type { BackupJobs } from './db/types.generated.js';
import { HttpError } from './http/errors.js';
import { exploitationOccupee, readHost } from './operations.js';

const LOCK = 727275;
const UUID = z.string().uuid();
const IDLE_MS = 120_000;
interface Row {
  id: string;
  request_id: string;
  status: BackupJobOut['status'];
  requested_by: string;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  version: number;
  report: BackupJobOut['report'];
  message: string;
}
/** Rapport écrit par finish() après validation (BackupReportOut) : relu tel quel. */
const ligne = (r: Selectable<BackupJobs>): Row => ({ ...r, report: r.report as BackupJobOut['report'] });
const out = (r: Row): BackupJobOut =>
  BackupJobOut.parse({
    id: r.id,
    status: r.status,
    requestedBy: r.requested_by,
    createdAt: r.created_at.toISOString(),
    startedAt: r.started_at?.toISOString() ?? null,
    finishedAt: r.finished_at?.toISOString() ?? null,
    version: r.version,
    report: r.report,
    message: r.message,
  });
export class Backups {
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
  ) {}
  // Verrou consultatif transactionnel partagé avec les opérations : appel SQL direct (ADR 0062 §5).
  private async lock(c: Client) {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK]);
  }
  async list() {
    const w = await this.db.k.selectFrom('backup_worker').selectAll().where('id', '=', 1).executeTakeFirst();
    return {
      worker: {
        available: !!w?.ready && Date.now() - w.seen_at.getTime() < IDLE_MS,
        seenAt: w?.seen_at.toISOString() ?? null,
        message: w ? w.message : 'Exécutant serveur non configuré.',
      },
      jobs: (
        await this.db.k
          .selectFrom('backup_jobs')
          .selectAll()
          .orderBy('created_at', 'desc')
          .orderBy('id')
          .limit(50)
          .execute()
      )
        .map(ligne)
        .map(out),
    };
  }
  async request(requestId: string, actor: Actor, ip: string) {
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      const existing = await k
        .selectFrom('backup_jobs')
        .selectAll()
        .where('request_id', '=', requestId)
        .executeTakeFirst();
      if (existing) {
        if (existing.requested_by !== actor.username) throw new HttpError(409, 'Identifiant de requête déjà utilisé.');
        return out(ligne(existing));
      }
      const w = await k
        .selectFrom('backup_worker')
        .select('id')
        .where('id', '=', 1)
        .where('ready', '=', true)
        .where('seen_at', '>', sql<Date>`now() - interval '120 seconds'`)
        .executeTakeFirst();
      if (!w) throw new HttpError(503, 'Exécutant serveur indisponible. Vérifiez sa configuration.');
      if (
        readHost(this.cfg)?.jobs.some((j) => ['en_cours', 'intervention'].includes(j.status)) ||
        (await exploitationOccupee(k, ['en_attente', 'en_cours', 'intervention'], ['en_attente', 'en_cours']))
      )
        throw new HttpError(409, 'Une sauvegarde est déjà en attente ou en cours.');
      const r = ligne(
        await k
          .insertInto('backup_jobs')
          .values({ request_id: requestId, requested_by: actor.username })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
      await this.db.audit(actor, ip, 'backup.request', r.id, {}, c);
      return out(r);
    });
  }
  async cancel(id: string, version: number, actor: Actor, ip: string) {
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      const r = await k.selectFrom('backup_jobs').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
      if (!r) throw new HttpError(404, 'Demande introuvable.');
      if (r.version !== version) throw new HttpError(412, 'La demande a changé. Rechargez son état.');
      if (r.status !== 'en_attente') throw new HttpError(409, 'Seule une demande en attente peut être annulée.');
      const changed = await k
        .updateTable('backup_jobs')
        .set((eb) => ({ status: 'annulee', finished_at: sql<Date>`now()`, version: eb('version', '+', 1) }))
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.db.audit(actor, ip, 'backup.cancel', id, {}, c);
      return out(ligne(changed));
    });
  }
  /** CLI hôte : un créneau refusé devient un échec consultable, jamais une tâche cachée à rejouer. */
  async schedule(requestId: string) {
    const actor = { username: 'planification' };
    try {
      return await this.request(requestId, actor, '127.0.0.1');
    } catch (e) {
      if (!(e instanceof HttpError) || ![409, 503].includes(e.status)) throw e;
      return this.db.tx(async (c, k) => {
        await this.lock(c);
        const existing = await k
          .selectFrom('backup_jobs')
          .selectAll()
          .where('request_id', '=', requestId)
          .executeTakeFirst();
        if (existing) {
          if (existing.requested_by !== actor.username) throw e;
          return out(ligne(existing));
        }
        const r = ligne(
          await k
            .insertInto('backup_jobs')
            .values({
              request_id: requestId,
              requested_by: actor.username,
              status: 'echec',
              finished_at: sql<Date>`now()`,
              message: 'Créneau manqué : opération active ou exécutant indisponible. Aucune relance automatique.',
            })
            .returningAll()
            .executeTakeFirstOrThrow(),
        );
        await this.db.audit(actor, null, 'backup.schedule_failed', r.id, {}, c);
        return out(r);
      });
    }
  }
  async heartbeat(ready: boolean) {
    await this.db.k
      .insertInto('backup_worker')
      .values({
        id: 1,
        seen_at: sql<Date>`now()`,
        ready,
        message: ready
          ? 'Exécutant serveur prêt ; chiffrement obligatoire.'
          : 'Configuration serveur incomplète : destination ou clé indisponible.',
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          seen_at: eb.ref('excluded.seen_at'),
          ready: eb.ref('excluded.ready'),
          message: eb.ref('excluded.message'),
        })),
      )
      .execute();
  }
  /** Appelé uniquement après prise du verrou local du worker. Aucun retry automatique d'une tâche interrompue. */
  async claim() {
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      if (await exploitationOccupee(k, ['en_attente', 'en_cours', 'intervention'], [])) return null;
      const broken = await k
        .updateTable('backup_jobs')
        .set((eb) => ({
          status: 'echec',
          finished_at: sql<Date>`now()`,
          version: eb('version', '+', 1),
          message: 'Exécutant interrompu ; aucune relance automatique.',
        }))
        .where('status', '=', 'en_cours')
        .returning('id')
        .execute();
      for (const r of broken)
        await this.db.audit({ username: 'exécutant sauvegardes' }, null, 'backup.interrupted', r.id, {}, c);
      // La plus ancienne demande en attente, prise sous le verrou consultatif : une seule à la fois.
      const r = await k
        .updateTable('backup_jobs')
        .set((eb) => ({ status: 'en_cours', started_at: sql<Date>`now()`, version: eb('version', '+', 1) }))
        .where('id', '=', (eb) =>
          eb.selectFrom('backup_jobs').select('id').where('status', '=', 'en_attente').orderBy('created_at').limit(1),
        )
        .returning('id')
        .executeTakeFirst();
      if (r) await this.db.audit({ username: 'exécutant sauvegardes' }, null, 'backup.start', r.id, {}, c);
      return r?.id ?? null;
    });
  }
  async finish(id: string, code: number) {
    UUID.parse(id);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
      throw new HttpError(422, 'Identifiant de demande invalide.');
    z.number().int().min(0).max(255).parse(code);
    let report: BackupJobOut['report'] = null;
    if (code === 0) {
      try {
        const raw = JSON.parse(
          readFileSync(path.join(this.cfg.etatDir, 'sauvegardes', 'jobs', `${id}.json`), 'utf8'),
        ) as Record<string, unknown>;
        if (raw.jobId === id && raw.resultat === 'reussie')
          report = BackupReportOut.parse({
            fichier: path.basename(String(raw.fichier ?? '')),
            tailleOctets: raw.tailleOctets,
            dureeSecondes: raw.dureeSecondes,
            sha256: raw.sha256,
            chiffree: raw.chiffree,
            integriteVerifiee: raw.integriteVerifiee,
          });
        if (report && !/^[a-zA-Z0-9_.-]+\.tar\.enc$/.test(report.fichier)) report = null;
      } catch {
        report = null;
      }
    }
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      const fini = await k
        .updateTable('backup_jobs')
        .set((eb) => ({
          status: report ? 'reussie' : 'echec',
          finished_at: sql<Date>`now()`,
          version: eb('version', '+', 1),
          report: report ? JSON.stringify(report) : null,
          message: report
            ? ''
            : code
              ? `Exécutant en échec (code ${code}).`
              : 'Rapport absent, incohérent ou contrôle d’intégrité incomplet.',
        }))
        .where('id', '=', id)
        .where('status', '=', 'en_cours')
        .returningAll()
        .executeTakeFirst();
      if (!fini) throw new HttpError(409, 'Cette demande n’est pas en cours.');
      const r = ligne(fini);
      await this.db.audit(
        { username: 'exécutant sauvegardes' },
        null,
        report ? 'backup.success' : 'backup.failed',
        id,
        { code },
        c,
      );
      return out(r);
    });
  }
}
