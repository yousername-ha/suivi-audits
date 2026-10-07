/* Accès à PostgreSQL : pool, transactions (avec auteur pour les notifications temps réel), migrations, journal d'audit. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Logger } from 'pino';
import type { Config } from '../config.js';
import { APP_ROOT } from '../config.js';
import * as schema from './schema.js';

// Les colonnes « bigint » (identifiants de lots, tailles) sont renvoyées en nombre : valeurs très inférieures à 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => parseInt(v, 10));

export type Orm = NodePgDatabase<typeof schema>;
export type Client = pg.PoolClient;
export interface Actor {
  id?: string | null;
  username: string;
}

export const MIGRATIONS_DIR = path.join(APP_ROOT, 'migrations');
const MIGRATION_LOCK = 727274; // même verrou consultatif que la v2

export class Db {
  readonly pool: pg.Pool;
  readonly orm: Orm;
  constructor(
    cfg: Config['db'],
    readonly log: Logger,
  ) {
    this.pool = new pg.Pool({
      ...cfg,
      application_name: 'suivi-audits',
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    });
    this.pool.on('error', (e) => log.error({ err: e.message }, 'db pool error'));
    this.orm = drizzle(this.pool, { schema });
  }

  q<R extends pg.QueryResultRow = Record<string, unknown>>(text: string, params?: unknown[]) {
    return this.pool.query<R>(text, params);
  }
  async one<R extends pg.QueryResultRow = Record<string, unknown>>(text: string, params?: unknown[]): Promise<R | null> {
    const r = await this.pool.query<R>(text, params);
    return r.rows[0] ?? null;
  }

  /** Transaction. « actor » renseigne l'auteur des notifications temps réel (déclencheurs suivi_notify). */
  async tx<T>(fn: (c: Client, orm: Orm) => Promise<T>, actor?: string): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      if (actor) await c.query("SELECT set_config('suivi.actor', $1, true)", [actor]);
      const r = await fn(c, drizzle(c, { schema }));
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  async waitReady(tries = 60, delayMs = 2000): Promise<void> {
    for (let i = 1; i <= tries; i++) {
      try {
        await this.pool.query('SELECT 1');
        return;
      } catch (e) {
        if (i === tries) throw e;
        this.log.info({ attempt: i, err: (e as { code?: string }).code || (e as Error).message }, 'waiting for database');
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  /** Migrations SQL versionnées (migrations/NNN_*.sql), table schema_migrations commune avec la v2. */
  async migrate(dir = MIGRATIONS_DIR): Promise<string[]> {
    await this.q('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = readdirSync(dir)
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort();
    const applied: string[] = [];
    for (const f of files) {
      if (await this.one('SELECT 1 FROM schema_migrations WHERE name=$1', [f])) continue;
      const did = await this.tx(async (c) => {
        await c.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
        if ((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f])).rowCount) return false;
        await c.query(readFileSync(path.join(dir, f), 'utf8'));
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
        return true;
      });
      if (did) {
        applied.push(f);
        this.log.info({ name: f }, 'migration applied');
      }
    }
    return applied;
  }

  /** Journal d'audit en ajout seul (déclencheur audit_log_immutable). Une erreur d'écriture est journalisée, jamais silencieuse. */
  async audit(who: Partial<Actor> | null, ip: string | null, action: string, target = '', details: Record<string, unknown> = {}, c?: Client): Promise<void> {
    try {
      await (c ?? this.pool).query(
        'INSERT INTO audit_log(user_id, username, ip, action, target, details) VALUES ($1,$2,$3,$4,$5,$6)',
        [who?.id || null, who?.username || '', ip || null, action, String(target || ''), details],
      );
    } catch (e) {
      this.log.error({ err: (e as Error).message, action }, 'audit write failed');
      if (c) throw e;
    }
  }

  end() {
    return this.pool.end();
  }
}
