/* Accès à PostgreSQL : pool, transactions (avec auteur pour les notifications temps réel), migrations, journal d'audit. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Logger } from 'pino';
import type { Config } from '../config.js';
import { APP_ROOT } from '../config.js';
import type { DB } from './types.generated.js';

// Les colonnes « bigint » (identifiants de lots, tailles) sont renvoyées en nombre : valeurs très inférieures à 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => parseInt(v, 10));

/** Accès typé à la base (ADR 0062) : requêtes construites et paramétrées par Kysely, types générés des migrations. */
export type Kdb = Kysely<DB>;
export type Client = pg.PoolClient;
export interface Actor {
  id?: string | null;
  username: string;
}

export const MIGRATIONS_DIR = path.join(APP_ROOT, 'migrations');
const MIGRATION_LOCK = 727274; // même verrou consultatif que la v2

/** Kysely lié à une connexion déjà ouverte (transaction en cours) ou au pool : la connexion n'est jamais rendue par
    Kysely. Sert aux fonctions qui reçoivent un client de leur appelant (même transaction). */
export function surConnexion(c: Pick<Client, 'query'>): Kdb {
  const connexion = { query: c.query.bind(c), release: () => {} } as unknown as pg.PoolClient;
  const pool = { connect: async () => connexion, end: async () => {} } as unknown as pg.Pool;
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

/** Délai d'inactivité toléré dans une transaction ouverte. */
export const DELAI_TRANSACTION_INACTIVE_MS = 60_000;
/** Deadlock détecté (40P01) ou échec de sérialisation (40001) : PostgreSQL annule la transaction, qui peut être rejouée entière. */
const CODES_RELANCE = new Set(['40P01', '40001']);
export const RELANCES_MAX = 2;
/** Courte attente aléatoire (50 à 200 ms) avant de rejouer : deux transactions qui se sont bloquées ne repartent pas ensemble. */
const attenteAleatoire = () => 50 + Math.floor(Math.random() * 151);

export class Db {
  readonly pool: pg.Pool;
  readonly k: Kdb;
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
      // Une transaction restée ouverte sans activité (appelant planté, attente d'un service) est coupée au bout d'une minute :
      // sinon elle garde ses verrous et une connexion du pool (max 10, suffisant pour une quinzaine d'utilisateurs).
      idle_in_transaction_session_timeout: DELAI_TRANSACTION_INACTIVE_MS,
    });
    this.pool.on('error', (e) => log.error({ err: e.message }, 'db pool error'));
    this.k = new Kysely<DB>({ dialect: new PostgresDialect({ pool: this.pool }) });
  }

  q<R extends pg.QueryResultRow = Record<string, unknown>>(text: string, params?: unknown[]) {
    return this.pool.query<R>(text, params);
  }
  async one<R extends pg.QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<R | null> {
    const r = await this.pool.query<R>(text, params);
    return r.rows[0] ?? null;
  }

  /** Transaction. « actor » renseigne l'auteur des notifications temps réel (déclencheurs suivi_notify).
      « k » exécute ses requêtes sur la même connexion, donc dans la même transaction que « c ».
      Sur deadlock ou échec de sérialisation (40P01, 40001), la transaction ENTIÈRE est rejouée au plus RELANCES_MAX fois, après
      une courte attente aléatoire, et chaque relance est journalisée : « fn » doit donc n'avoir aucun effet hors de la base
      (pg_notify, déclencheurs et courriels en file sont transactionnels ; un appel réseau ou fichier ne doit pas s'y trouver). */
  async tx<T>(fn: (c: Client, k: Kdb) => Promise<T>, actor?: string): Promise<T> {
    for (let essai = 0; ; essai++) {
      const c = await this.pool.connect();
      try {
        await c.query('BEGIN');
        if (actor) await c.query("SELECT set_config('suivi.actor', $1, true)", [actor]);
        const r = await fn(c, surConnexion(c));
        await c.query('COMMIT');
        return r;
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        const code = (e as { code?: string }).code;
        if (!code || !CODES_RELANCE.has(code) || essai >= RELANCES_MAX) throw e;
        this.log.warn({ code, essai: essai + 1, max: RELANCES_MAX }, 'transaction rejouée après conflit');
      } finally {
        c.release();
      }
      await new Promise((r) => setTimeout(r, attenteAleatoire()));
    }
  }

  async waitReady(tries = 60, delayMs = 2000): Promise<void> {
    for (let i = 1; i <= tries; i++) {
      try {
        await this.pool.query('SELECT 1');
        return;
      } catch (e) {
        if (i === tries) throw e;
        this.log.info(
          { attempt: i, err: (e as { code?: string }).code || (e as Error).message },
          'waiting for database',
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  /** Migrations SQL versionnées (migrations/NNN_*.sql), table schema_migrations commune avec la v2. */
  async migrate(dir = MIGRATIONS_DIR): Promise<string[]> {
    await this.q(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
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
  async audit(
    who: Partial<Actor> | null,
    ip: string | null,
    action: string,
    target = '',
    details: Record<string, unknown> = {},
    c?: Client,
  ): Promise<void> {
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
