/* A1a : file transactionnelle. Seule la CLI du serveur peut annoncer, réclamer et terminer une tâche. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BackupJobOut, BackupReportOut } from '@suivi/shared';
import { z } from 'zod';
import type { Config } from './config.js';
import type { Actor, Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';

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
  private async lock(c: Client) {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK]);
  }
  async list() {
    const w = await this.db.one<{ seen_at: Date; ready: boolean; message: string }>(
      'SELECT * FROM backup_worker WHERE id=1',
    );
    return {
      worker: {
        available: !!w?.ready && Date.now() - w.seen_at.getTime() < IDLE_MS,
        seenAt: w?.seen_at.toISOString() ?? null,
        message: w ? w.message : 'Exécutant serveur non configuré.',
      },
      jobs: (await this.db.q<Row>('SELECT * FROM backup_jobs ORDER BY created_at DESC, id LIMIT 50')).rows.map(out),
    };
  }
  async request(requestId: string, actor: Actor, ip: string) {
    return this.db.tx(async (c) => {
      await this.lock(c);
      const existing = (await c.query<Row>('SELECT * FROM backup_jobs WHERE request_id=$1', [requestId])).rows[0];
      if (existing) {
        if (existing.requested_by !== actor.username) throw new HttpError(409, 'Identifiant de requête déjà utilisé.');
        return out(existing);
      }
      const w = (
        await c.query("SELECT 1 FROM backup_worker WHERE id=1 AND ready AND seen_at > now() - interval '120 seconds'")
      ).rowCount;
      if (!w) throw new HttpError(503, 'Exécutant serveur indisponible. Vérifiez sa configuration.');
      if ((await c.query("SELECT 1 FROM backup_jobs WHERE status IN ('en_attente','en_cours')")).rowCount)
        throw new HttpError(409, 'Une sauvegarde est déjà en attente ou en cours.');
      const r = (
        await c.query<Row>('INSERT INTO backup_jobs(request_id,requested_by) VALUES ($1,$2) RETURNING *', [
          requestId,
          actor.username,
        ])
      ).rows[0]!;
      await this.db.audit(actor, ip, 'backup.request', r.id, {}, c);
      return out(r);
    });
  }
  async cancel(id: string, version: number, actor: Actor, ip: string) {
    return this.db.tx(async (c) => {
      await this.lock(c);
      const r = (await c.query<Row>('SELECT * FROM backup_jobs WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!r) throw new HttpError(404, 'Demande introuvable.');
      if (r.version !== version) throw new HttpError(412, 'La demande a changé. Rechargez son état.');
      if (r.status !== 'en_attente') throw new HttpError(409, 'Seule une demande en attente peut être annulée.');
      const changed = (
        await c.query<Row>(
          "UPDATE backup_jobs SET status='annulee',finished_at=now(),version=version+1 WHERE id=$1 RETURNING *",
          [id],
        )
      ).rows[0]!;
      await this.db.audit(actor, ip, 'backup.cancel', id, {}, c);
      return out(changed);
    });
  }
  async heartbeat(ready: boolean) {
    await this.db.q(
      'INSERT INTO backup_worker(id,seen_at,ready,message) VALUES (1,now(),$1,$2) ON CONFLICT(id) DO UPDATE SET seen_at=excluded.seen_at,ready=excluded.ready,message=excluded.message',
      [
        ready,
        ready
          ? 'Exécutant serveur prêt ; chiffrement obligatoire.'
          : 'Configuration serveur incomplète : destination ou clé indisponible.',
      ],
    );
  }
  /** Appelé uniquement après prise du verrou local du worker. Aucun retry automatique d'une tâche interrompue. */
  async claim() {
    return this.db.tx(async (c) => {
      await this.lock(c);
      const broken = (
        await c.query<Row>(
          "UPDATE backup_jobs SET status='echec',finished_at=now(),version=version+1,message='Exécutant interrompu ; aucune relance automatique.' WHERE status='en_cours' RETURNING *",
        )
      ).rows;
      for (const r of broken)
        await this.db.audit({ username: 'exécutant sauvegardes' }, null, 'backup.interrupted', r.id, {}, c);
      const r = (
        await c.query<Row>(
          "UPDATE backup_jobs SET status='en_cours',started_at=now(),version=version+1 WHERE id=(SELECT id FROM backup_jobs WHERE status='en_attente' ORDER BY created_at LIMIT 1) RETURNING *",
        )
      ).rows[0];
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
    return this.db.tx(async (c) => {
      await this.lock(c);
      const r = (
        await c.query<Row>(
          "UPDATE backup_jobs SET status=$2,finished_at=now(),version=version+1,report=$3,message=$4 WHERE id=$1 AND status='en_cours' RETURNING *",
          [
            id,
            report ? 'reussie' : 'echec',
            report,
            report
              ? ''
              : code
                ? `Exécutant en échec (code ${code}).`
                : 'Rapport absent, incohérent ou contrôle d’intégrité incomplet.',
          ],
        )
      ).rows[0];
      if (!r) throw new HttpError(409, 'Cette demande n’est pas en cours.');
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
