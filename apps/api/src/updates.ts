/* L'API ne lance aucune commande : demandes auditées, exécutées uniquement par la CLI locale. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { effectivePermissions, UpdateState, type UpdateRequest } from '@suivi/shared';
import type { SessionUser } from './auth.js';
import type { Config } from './config.js';
import type { Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import { loadGrants } from './rights.js';
import { compareVersions } from './systeme.js';

export class Updates {
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
  ) {}
  state(): UpdateState {
    try {
      const state = UpdateState.parse(
        JSON.parse(readFileSync(path.join(this.cfg.etatDir, 'updates/status.json'), 'utf8')),
      );
      // Un rapport ancien ne peut autoriser une opération privilégiée.
      if (Date.now() - new Date(state.updatedAt).getTime() > 90_000) state.ready = false;
      return { ...state, installed: this.cfg.version };
    } catch {
      return {
        installed: this.cfg.version,
        available: null,
        checkedAt: null,
        notes: null,
        checking: false,
        checkError: false,
        ready: false,
        maintenance: false,
        id: null,
        target: null,
        status: 'idle',
        phase: 'idle',
        message: 'Le service de mise à jour est indisponible.',
        startedAt: null,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  async assertAdmin(user: SessionUser, c?: Client) {
    const grants = await loadGrants(c ?? this.db.pool, user.id);
    if (!grants.some((g) => g.roleId === 'administrateur') || !user.rights.can('administration', 'administrer'))
      throw new HttpError(403, 'Seul le rôle Administrateur peut commander une mise à jour.');
  }
  async request(user: SessionUser, ip: string, input?: UpdateRequest) {
    return this.db.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727277)');
      await this.assertAdmin(user, c);
      const requestId = input?.requestId ?? randomUUID();
      const previous = (
        await c.query('SELECT id, kind, target, status, user_id FROM update_jobs WHERE request_id=$1', [requestId])
      ).rows[0];
      if (previous) {
        if (previous.user_id !== user.id || previous.target !== (input?.version ?? null))
          throw new HttpError(409, 'Cet identifiant désigne une autre demande.');
        return { id: previous.id as string, status: previous.status as string };
      }
      const state = this.state();
      if (!state.ready) throw new HttpError(503, 'Le service de mise à jour est indisponible.');
      if (state.maintenance || state.status === 'intervention')
        throw new HttpError(409, 'Une opération requiert déjà le service de mise à jour.');
      if ((await c.query("SELECT 1 FROM update_jobs WHERE status IN ('queued','running','intervention')")).rowCount)
        throw new HttpError(409, 'Une opération de mise à jour est déjà en cours.');
      if (
        input &&
        (state.available !== input.version ||
          compareVersions(this.cfg.version, input.version) >= 0 ||
          !state.checkedAt ||
          Date.now() - new Date(state.checkedAt).getTime() > 24 * 3600e3)
      )
        throw new HttpError(
          409,
          'La version disponible a changé ou sa vérification est trop ancienne. Vérifiez à nouveau.',
        );
      if (
        input &&
        (
          await c.query(
            "SELECT 1 FROM operation_jobs WHERE status IN ('en_attente','en_cours','intervention') UNION ALL SELECT 1 FROM backup_jobs WHERE status IN ('en_attente','en_cours')",
          )
        ).rowCount
      )
        throw new HttpError(409, 'Une sauvegarde, restauration ou opération serveur est déjà active.');
      const kind = input ? 'install' : 'check';
      const row = (
        await c.query(
          'INSERT INTO update_jobs(request_id,kind,target,requested_by,user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,status',
          [requestId, kind, input?.version ?? null, user.username, user.id],
        )
      ).rows[0]!;
      await this.db.audit(user, ip, `update.${kind}.requested`, row.id, { target: input?.version ?? null }, c);
      return { id: row.id as string, status: row.status as string };
    }, user.username);
  }
  /** Pas de route HTTP pour ces opérations ; l'exécutant doit détenir le verrou hôte. */
  async claim() {
    return this.db.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727277)');
      const job = (
        await c.query(
          "SELECT id,kind,target,user_id,created_at FROM update_jobs WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE",
        )
      ).rows[0];
      if (!job) return null;
      const u = (await c.query('SELECT id,disabled,expires_at FROM users WHERE id=$1', [job.user_id])).rows[0];
      const grants = u ? await loadGrants(c, u.id) : [];
      if (
        !u ||
        u.disabled ||
        (u.expires_at && new Date(u.expires_at) <= new Date()) ||
        !grants.some((g) => g.roleId === 'administrateur') ||
        !effectivePermissions(grants).has('administration:administrer') ||
        Date.now() - new Date(job.created_at).getTime() > 15 * 60e3
      ) {
        await c.query("UPDATE update_jobs SET status='failed', finished_at=now() WHERE id=$1", [job.id]);
        return null;
      }
      await c.query("UPDATE update_jobs SET status='running',started_at=now() WHERE id=$1", [job.id]);
      return { id: job.id as string, kind: job.kind as 'check' | 'install', target: job.target as string | null };
    });
  }
  /** Une restauration ne doit jamais remettre en file des intentions anciennes. */
  async synchronize() {
    let epoch: string;
    try {
      const report = JSON.parse(
        readFileSync(path.join(this.cfg.etatDir, 'sauvegardes/derniere-restauration.json'), 'utf8'),
      );
      epoch = z.string().datetime().parse(report.date);
    } catch {
      return;
    }
    const state = this.state();
    const keep = state.maintenance ? state.id : null;
    await this.db.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727277)');
      const old = await c.query(
        "UPDATE update_jobs SET status='failed',finished_at=now() WHERE created_at <= $1 AND id IS DISTINCT FROM $2::uuid AND status IN ('queued','running','intervention') RETURNING id",
        [epoch, keep],
      );
      for (const row of old.rows)
        await this.db.audit(
          { username: 'exploitation serveur' },
          null,
          'update.neutralized',
          row.id,
          { reason: 'restoration' },
          c,
        );
    });
  }
  async finish(id: string, status: string) {
    if (!/^[a-f0-9-]{36}$/.test(id) || !['success', 'rolled_back', 'failed', 'intervention'].includes(status))
      throw new Error('Résultat de mise à jour invalide.');
    await this.db.tx(async (c) => {
      const job = (
        await c.query(
          "UPDATE update_jobs SET status=$2,finished_at=now() WHERE id=$1 AND status IN ('queued','running','intervention') RETURNING requested_by,target",
          [id, status],
        )
      ).rows[0];
      if (job)
        await this.db.audit(
          { username: job.requested_by },
          null,
          'update.finished',
          id,
          { status, target: job.target },
          c,
        );
    });
  }
}
