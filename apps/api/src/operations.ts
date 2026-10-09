/* Lot A : file autorisée. L'état hôte en lecture seule survit au remplacement de PostgreSQL. */
import { randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { BackupPolicyIn, BackupPolicyOut, HostState, OperationIn, OperationOut } from '@suivi/shared';
import { z } from 'zod';
import type { Config } from './config.js';
import type { Actor, Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import type { Vault } from './security/crypto.js';
import { certificateInfo } from './certificates.js';

const LOCK = 727275;
export function readHost(cfg: Config) {
  try {
    const file = path.join(cfg.etatDir, 'exploitation', 'etat.json');
    const st = statSync(file);
    if (!st.isFile() || st.size > 2 * 1024 * 1024) return null;
    return HostState.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}
const fresh = (h: ReturnType<typeof readHost>) =>
  !!h && Date.now() - Date.parse(h.seenAt) < 120000 && Date.parse(h.seenAt) <= Date.now() + 10000;
interface Row {
  id: string;
  request_id: string;
  kind: OperationOut['kind'];
  status: OperationOut['status'];
  requested_by: string;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  version: number;
  certificate_fingerprint: string | null;
  archive_id: string | null;
  sha256: string | null;
  phase: string;
  message: string;
  payload: Record<string, string>;
  secret: Buffer | null;
}
const out = (r: Row): OperationOut =>
  OperationOut.parse({
    id: r.id,
    requestId: r.request_id,
    kind: r.kind,
    status: r.status,
    requestedBy: r.requested_by,
    createdAt: r.created_at.toISOString(),
    startedAt: r.started_at?.toISOString() ?? null,
    finishedAt: r.finished_at?.toISOString() ?? null,
    version: r.version,
    certificateFingerprint: r.certificate_fingerprint,
    archiveId: r.archive_id,
    sha256: r.sha256,
    phase: r.phase,
    message: r.message,
  });
const policySelect =
  'SELECT enabled,hour_utc AS "hourUtc",minute_utc AS "minuteUtc",days,retention_days AS "retentionDays",version FROM backup_policy WHERE id=1';
export class Operations {
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
    private readonly vault: Vault,
  ) {}
  private lock(c: Client) {
    return c.query('SELECT pg_advisory_xact_lock($1)', [LOCK]);
  }
  async policy() {
    return BackupPolicyOut.parse(await this.db.one(policySelect));
  }
  async list() {
    const host = readHost(this.cfg);
    const rows = (await this.db.q<Row>('SELECT * FROM operation_jobs ORDER BY created_at DESC LIMIT 50')).rows.map(out);
    const jobs = new Map(rows.map((r) => [r.id, r]));
    for (const r of host?.jobs ?? []) jobs.set(r.id, r);
    return {
      host,
      available: fresh(host),
      policy: await this.policy(),
      jobs: [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 250),
    };
  }
  async setPolicy(input: z.infer<typeof BackupPolicyIn>, version: number, actor: Actor, ip: string) {
    const p = BackupPolicyIn.parse(input);
    return this.db.tx(async (c) => {
      await this.lock(c);
      const r = await c.query(
        'UPDATE backup_policy SET enabled=$2,hour_utc=$3,minute_utc=$4,days=$5,retention_days=$6,version=version+1 WHERE id=1 AND version=$1 RETURNING id',
        [version, p.enabled, p.hourUtc, p.minuteUtc, p.days, p.retentionDays],
      );
      if (!r.rowCount) throw new HttpError(412, 'La politique a changé. Rechargez-la avant de réessayer.');
      await this.db.audit(actor, ip, 'backup.policy', 'politique', p, c);
      return BackupPolicyOut.parse((await c.query(policySelect)).rows[0]);
    });
  }
  async request(input: OperationIn, actor: Actor, ip: string | null) {
    const p = OperationIn.parse(input);
    const h = readHost(this.cfg);
    return this.db.tx(async (c) => {
      await this.lock(c);
      const prior = (await c.query<Row>('SELECT * FROM operation_jobs WHERE request_id=$1', [p.requestId])).rows[0];
      const old = prior ? out(prior) : h?.jobs.find((j) => j.requestId === p.requestId);
      if (old) {
        if (
          old.requestedBy !== actor.username ||
          old.kind !== p.kind ||
          (p.kind === 'tls_install' &&
            old.certificateFingerprint !==
              certificateInfo(p.certificate, new URL(this.cfg.publicUrl).hostname).fingerprint) ||
          ('sha256' in p && (old.sha256 !== p.sha256 || old.archiveId !== p.archiveId))
        )
          throw new HttpError(409, 'Identifiant de requête déjà utilisé.');
        return old;
      }
      if (!fresh(h)) throw new HttpError(503, 'Exécutant d’exploitation indisponible.');
      if (
        h!.jobs.some((j) => ['en_cours', 'intervention'].includes(j.status)) ||
        (
          await c.query(
            "SELECT 1 FROM operation_jobs WHERE status IN ('en_attente','en_cours','intervention') UNION ALL SELECT 1 FROM backup_jobs WHERE status IN ('en_attente','en_cours')",
          )
        ).rowCount
      )
        throw new HttpError(409, 'Une opération est active ou une intervention est requise.');
      let payload: Record<string, string> = {};
      let secret: Buffer | null = null;
      const id = randomUUID();
      if ('archiveId' in p) {
        const archive = h!.archives.find((a) => a.id === p.archiveId && a.sha256 === p.sha256);
        if (!archive || !archive.integrity)
          throw new HttpError(409, 'Archive absente ou empreinte incohérente. Rafraîchissez le catalogue.');
        if (!h!.backupReady || (p.kind === 'restore' && !h!.restoreReady))
          throw new HttpError(503, 'Configuration de sauvegarde/restauration indisponible.');
        if (p.kind === 'restore') {
          if (!archive.encrypted) throw new HttpError(422, 'Une restauration web exige une archive chiffrée.');
          if (
            !h!.jobs.some(
              (j) =>
                j.kind === 'verify' && j.status === 'reussie' && j.archiveId === p.archiveId && j.sha256 === p.sha256,
            )
          )
            throw new HttpError(409, 'Vérifiez cette archive avant de demander sa restauration.');
        }
        payload = { name: archive.name };
      } else {
        if (!h!.tlsManaged || h!.tlsMode === 'external')
          throw new HttpError(409, 'TLS est géré par la configuration serveur ou une infrastructure externe.');
        if (p.kind === 'tls_install') {
          const cert = certificateInfo(p.certificate, new URL(this.cfg.publicUrl).hostname, p.privateKey);
          payload = { certificate: p.certificate, fingerprint: cert.fingerprint };
          secret = this.vault.sealSmall(Buffer.from(p.privateKey), `operation:${id}`);
        }
      }
      const r = (
        await c.query<Row>(
          'INSERT INTO operation_jobs(id,request_id,kind,requested_by,archive_id,sha256,payload,secret,certificate_fingerprint) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
          [
            id,
            p.requestId,
            p.kind,
            actor.username,
            'archiveId' in p ? p.archiveId : null,
            'sha256' in p ? p.sha256 : null,
            payload,
            secret,
            payload.fingerprint ?? null,
          ],
        )
      ).rows[0]!;
      await this.db.audit(
        actor,
        ip,
        `operation.${p.kind}.request`,
        id,
        { archiveId: r.archive_id, sha256: r.sha256, fingerprint: payload.fingerprint ?? null },
        c,
      );
      return out(r);
    });
  }
  async cancel(id: string, version: number, actor: Actor, ip: string) {
    return this.db.tx(async (c) => {
      await this.lock(c);
      const r = (await c.query<Row>('SELECT * FROM operation_jobs WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!r) throw new HttpError(404, 'Demande introuvable.');
      if (r.version !== version) throw new HttpError(412, 'La demande a changé.');
      if (r.status !== 'en_attente') throw new HttpError(409, 'Seule une demande en attente peut être annulée.');
      const changed = (
        await c.query<Row>(
          "UPDATE operation_jobs SET status='annulee',finished_at=now(),version=version+1,secret=NULL,payload='{}' WHERE id=$1 RETURNING *",
          [id],
        )
      ).rows[0]!;
      await this.db.audit(actor, ip, 'operation.cancel', id, {}, c);
      return out(changed);
    });
  }
  /** CLI uniquement : le journal hôte est reconcilié avant toute prise en charge. */
  async synchronize(epoch: string | null = null) {
    const h = readHost(this.cfg);
    if (!h) return;
    if (epoch !== null) z.string().datetime().parse(epoch);
    await this.db.tx(async (c) => {
      await this.lock(c);
      if (epoch) {
        await c.query(
          "UPDATE operation_jobs SET status='echec',finished_at=now(),version=version+1,secret=NULL,payload='{}',message='Ancienne demande neutralisée après restauration.' WHERE status IN ('en_attente','en_cours') AND created_at <= $1",
          [epoch],
        );
        await c.query(
          "UPDATE backup_jobs SET status='echec',finished_at=now(),version=version+1,message='Ancienne demande neutralisée après restauration.' WHERE status IN ('en_attente','en_cours') AND created_at <= $1",
          [epoch],
        );
      }
      for (const j of h.jobs.filter((x) => ['reussie', 'echec', 'intervention'].includes(x.status))) {
        const receipt = (await c.query<{ status: string }>('SELECT status FROM operation_receipts WHERE id=$1', [j.id]))
          .rows[0];
        if (receipt?.status === j.status) continue;
        await c.query(
          `INSERT INTO operation_jobs(id,request_id,kind,status,requested_by,created_at,started_at,finished_at,version,archive_id,sha256,phase,message,certificate_fingerprint)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT(id) DO UPDATE SET status=excluded.status,finished_at=excluded.finished_at,version=GREATEST(operation_jobs.version+1,excluded.version),phase=excluded.phase,message=excluded.message,certificate_fingerprint=excluded.certificate_fingerprint,secret=NULL,payload='{}'`,
          [
            j.id,
            j.requestId,
            j.kind,
            j.status,
            j.requestedBy,
            j.createdAt,
            j.startedAt,
            j.finishedAt,
            j.version,
            j.archiveId,
            j.sha256,
            j.phase,
            j.message,
            j.certificateFingerprint ?? null,
          ],
        );
        await this.db.audit(
          { username: j.requestedBy },
          null,
          `operation.${j.kind}.${j.status}`,
          j.id,
          { phase: j.phase, sha256: j.sha256 },
          c,
        );
        await c.query(
          'INSERT INTO operation_receipts(id,status) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET status=excluded.status',
          [j.id, j.status],
        );
      }
    });
  }
  async claim() {
    return this.db.tx(async (c) => {
      await this.lock(c);
      if (
        (
          await c.query(
            "SELECT 1 FROM operation_jobs WHERE status='intervention' UNION ALL SELECT 1 FROM backup_jobs WHERE status IN ('en_attente','en_cours')",
          )
        ).rowCount
      )
        return null;
      // Une interruption n'est jamais une autorisation de relancer la commande demandée.
      await c.query(
        "UPDATE operation_jobs SET status='echec',finished_at=now(),version=version+1,secret=NULL,payload='{}',message='Exécutant interrompu ; aucune relance automatique.' WHERE status='en_cours'",
      );
      const r = (
        await c.query<Row>(
          "UPDATE operation_jobs SET status='en_cours',started_at=now(),version=version+1 WHERE id=(SELECT id FROM operation_jobs WHERE status='en_attente' ORDER BY created_at LIMIT 1) RETURNING *",
        )
      ).rows[0];
      if (!r) return null;
      await this.db.audit({ username: 'exécutant exploitation' }, null, 'operation.start', r.id, {}, c);
      return {
        ...out(r),
        payload: r.payload,
        ...(r.secret ? { privateKey: this.vault.openSmall(r.secret, `operation:${r.id}`).toString('utf8') } : {}),
      };
    });
  }
}
