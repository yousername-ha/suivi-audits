/* Lot A : file autorisée. L'état hôte en lecture seule survit au remplacement de PostgreSQL. */
import { randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BackupPolicyIn, BackupPolicyOut, HostState, OperationIn, OperationOut } from '@suivi/shared';
import { z } from 'zod';
import type { Config } from './config.js';
import { sql, type Selectable } from 'kysely';
import type { AlertesExploitation } from './alertes-exploitation.js';
import type { Actor, Client, Db, Kdb } from './db/db.js';
import type { OperationJobs } from './db/types.generated.js';
import { HttpError } from './http/errors.js';
import type { Vault } from './security/crypto.js';
import { certificateInfo } from './certificates.js';

const LOCK = 727275;
export function readHost(cfg: Config) {
  let fd: number | undefined;
  try {
    const file = path.join(cfg.etatDir, 'exploitation', 'etat.json');
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > 2 * 1024 * 1024) return null;
    return HostState.parse(JSON.parse(readFileSync(fd, 'utf8')));
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
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
/** Charge utile écrite par request() (chaînes uniquement) : relue telle quelle. */
const ligne = (r: Selectable<OperationJobs>): Row => ({ ...r, payload: r.payload as Record<string, string> });
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
const politique = (k: Kdb) =>
  k
    .selectFrom('backup_policy')
    .select([
      'enabled',
      'hour_utc as hourUtc',
      'minute_utc as minuteUtc',
      'days',
      'retention_days as retentionDays',
      'version',
    ])
    .where('id', '=', 1)
    .executeTakeFirst();
/** Une opération active ou en attente d'intervention, ou une sauvegarde en attente ou en cours, bloque toute nouvelle demande. */
export async function exploitationOccupee(
  k: Kdb,
  operations: ('en_attente' | 'en_cours' | 'intervention')[],
  sauvegardes: ('en_attente' | 'en_cours')[],
) {
  const op = operations.length
    ? await k.selectFrom('operation_jobs').select('id').where('status', 'in', operations).executeTakeFirst()
    : undefined;
  if (op) return true;
  return sauvegardes.length
    ? !!(await k.selectFrom('backup_jobs').select('id').where('status', 'in', sauvegardes).executeTakeFirst())
    : false;
}
export class Operations {
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
    private readonly vault: Vault,
    private readonly alertes: AlertesExploitation,
  ) {}
  // Verrou consultatif transactionnel partagé avec les sauvegardes : appel SQL direct (ADR 0062 §5).
  private lock(c: Client) {
    return c.query('SELECT pg_advisory_xact_lock($1)', [LOCK]);
  }
  async policy() {
    return BackupPolicyOut.parse(await politique(this.db.k));
  }
  async list() {
    const host = readHost(this.cfg);
    const rows = (
      await this.db.k.selectFrom('operation_jobs').selectAll().orderBy('created_at', 'desc').limit(50).execute()
    )
      .map(ligne)
      .map(out);
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
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      const r = await k
        .updateTable('backup_policy')
        .set((eb) => ({
          enabled: p.enabled,
          hour_utc: p.hourUtc,
          minute_utc: p.minuteUtc,
          days: [...p.days],
          retention_days: p.retentionDays,
          version: eb('version', '+', 1),
        }))
        .where('id', '=', 1)
        .where('version', '=', version)
        .returning('id')
        .executeTakeFirst();
      if (!r) throw new HttpError(412, 'La politique a changé. Rechargez-la avant de réessayer.');
      await this.db.audit(actor, ip, 'backup.policy', 'politique', p, c);
      return BackupPolicyOut.parse(await politique(k));
    });
  }
  async request(input: OperationIn, actor: Actor, ip: string | null) {
    const p = OperationIn.parse(input);
    const h = readHost(this.cfg);
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      const prior = await k
        .selectFrom('operation_jobs')
        .selectAll()
        .where('request_id', '=', p.requestId)
        .executeTakeFirst();
      const old = prior ? out(ligne(prior)) : h?.jobs.find((j) => j.requestId === p.requestId);
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
        (await exploitationOccupee(k, ['en_attente', 'en_cours', 'intervention'], ['en_attente', 'en_cours']))
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
        } else if (p.kind === 'tls_internal') {
          payload = { mode: 'interne' };
        } else if (p.kind === 'tls_acme') {
          payload = { mode: 'acme', email: p.email, directory: p.directory };
        }
      }
      const r = ligne(
        await k
          .insertInto('operation_jobs')
          .values({
            id,
            request_id: p.requestId,
            kind: p.kind,
            requested_by: actor.username,
            archive_id: 'archiveId' in p ? p.archiveId : null,
            sha256: 'sha256' in p ? p.sha256 : null,
            payload: JSON.stringify(payload),
            secret,
            certificate_fingerprint: payload.fingerprint ?? null,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
      await this.db.audit(
        actor,
        ip,
        `operation.${p.kind}.request`,
        id,
        {
          archiveId: r.archive_id,
          sha256: r.sha256,
          fingerprint: payload.fingerprint ?? null,
          ...(payload.mode ? { mode: payload.mode, directory: payload.directory ?? null } : {}),
        },
        c,
      );
      return out(r);
    });
  }
  async cancel(id: string, version: number, actor: Actor, ip: string) {
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      const r = await k.selectFrom('operation_jobs').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
      if (!r) throw new HttpError(404, 'Demande introuvable.');
      if (r.version !== version) throw new HttpError(412, 'La demande a changé.');
      if (r.status !== 'en_attente') throw new HttpError(409, 'Seule une demande en attente peut être annulée.');
      // Annulée : la clé privée chiffrée et la charge utile sont effacées.
      const changed = await k
        .updateTable('operation_jobs')
        .set((eb) => ({
          status: 'annulee',
          finished_at: sql<Date>`now()`,
          version: eb('version', '+', 1),
          secret: null,
          payload: '{}',
        }))
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.db.audit(actor, ip, 'operation.cancel', id, {}, c);
      return out(ligne(changed));
    });
  }
  /** CLI uniquement : le journal hôte est reconcilié avant toute prise en charge. */
  async synchronize(epoch: string | null = null) {
    const h = readHost(this.cfg);
    if (!h) return;
    if (epoch !== null) z.string().datetime().parse(epoch);
    await this.db.tx(async (c, k) => {
      await this.lock(c);
      if (epoch) {
        const neutralisee = 'Ancienne demande neutralisée après restauration.';
        await k
          .updateTable('operation_jobs')
          .set((eb) => ({
            status: 'echec',
            finished_at: sql<Date>`now()`,
            version: eb('version', '+', 1),
            secret: null,
            payload: '{}',
            message: neutralisee,
          }))
          .where('status', 'in', ['en_attente', 'en_cours'])
          .where('created_at', '<=', sql<Date>`${epoch}`)
          .execute();
        await k
          .updateTable('backup_jobs')
          .set((eb) => ({
            status: 'echec',
            finished_at: sql<Date>`now()`,
            version: eb('version', '+', 1),
            message: neutralisee,
          }))
          .where('status', 'in', ['en_attente', 'en_cours'])
          .where('created_at', '<=', sql<Date>`${epoch}`)
          .execute();
      }
      for (const j of h.jobs.filter((x) => ['reussie', 'echec', 'intervention'].includes(x.status))) {
        const receipt = await k
          .selectFrom('operation_receipts')
          .select('status')
          .where('id', '=', j.id)
          .executeTakeFirst();
        if (receipt?.status === j.status) continue;
        // Le journal hôte fait foi : état final repris, version jamais en recul, secret et charge utile effacés.
        await k
          .insertInto('operation_jobs')
          .values({
            id: j.id,
            request_id: j.requestId,
            kind: j.kind,
            status: j.status,
            requested_by: j.requestedBy,
            created_at: j.createdAt,
            started_at: j.startedAt,
            finished_at: j.finishedAt,
            version: j.version,
            archive_id: j.archiveId,
            sha256: j.sha256,
            phase: j.phase,
            message: j.message,
            certificate_fingerprint: j.certificateFingerprint ?? null,
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet((eb) => ({
              status: eb.ref('excluded.status'),
              finished_at: eb.ref('excluded.finished_at'),
              version: sql<number>`GREATEST(operation_jobs.version + 1, excluded.version)`,
              phase: eb.ref('excluded.phase'),
              message: eb.ref('excluded.message'),
              certificate_fingerprint: eb.ref('excluded.certificate_fingerprint'),
              secret: null,
              payload: '{}',
            })),
          )
          .execute();
        if (j.status === 'echec' || j.status === 'intervention')
          await this.alertes.signaler(k, 'operation', j.id.slice(0, 8));
        await this.db.audit(
          { username: j.requestedBy },
          null,
          `operation.${j.kind}.${j.status}`,
          j.id,
          { phase: j.phase, sha256: j.sha256 },
          c,
        );
        await k
          .insertInto('operation_receipts')
          .values({ id: j.id, status: j.status })
          .onConflict((oc) => oc.column('id').doUpdateSet((eb) => ({ status: eb.ref('excluded.status') })))
          .execute();
      }
    });
  }
  async claim() {
    return this.db.tx(async (c, k) => {
      await this.lock(c);
      if (await exploitationOccupee(k, ['intervention'], ['en_attente', 'en_cours'])) return null;
      // Une interruption n'est jamais une autorisation de relancer la commande demandée.
      await k
        .updateTable('operation_jobs')
        .set((eb) => ({
          status: 'echec',
          finished_at: sql<Date>`now()`,
          version: eb('version', '+', 1),
          secret: null,
          payload: '{}',
          message: 'Exécutant interrompu ; aucune relance automatique.',
        }))
        .where('status', '=', 'en_cours')
        .execute();
      // La plus ancienne demande en attente, prise sous le verrou consultatif : une seule à la fois.
      const prise = await k
        .updateTable('operation_jobs')
        .set((eb) => ({ status: 'en_cours', started_at: sql<Date>`now()`, version: eb('version', '+', 1) }))
        .where('id', '=', (eb) =>
          eb
            .selectFrom('operation_jobs')
            .select('id')
            .where('status', '=', 'en_attente')
            .orderBy('created_at')
            .limit(1),
        )
        .returningAll()
        .executeTakeFirst();
      if (!prise) return null;
      const r = ligne(prise);
      await this.db.audit({ username: 'exécutant exploitation' }, null, 'operation.start', r.id, {}, c);
      return {
        ...out(r),
        payload: r.payload,
        ...(r.secret ? { privateKey: this.vault.openSmall(r.secret, `operation:${r.id}`).toString('utf8') } : {}),
      };
    });
  }
}
