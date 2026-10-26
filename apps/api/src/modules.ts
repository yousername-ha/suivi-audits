/* Configuration versionnée et verrouillage inter-instance des écritures métier. Lecture et écriture de la configuration en
   Kysely (ADR 0062) ; les verrous consultatifs restent des appels SQL directs sur leur pool dédié. */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import {
  activeRights,
  legacyKeyModule,
  planModules,
  type Module,
  type ModuleIntent,
  type ModuleState,
  type Rights,
} from '@suivi/shared';
import { sql } from 'kysely';
import pg from 'pg';
import type { Config } from './config.js';
import type { Actor, Db } from './db/db.js';

// Les noms désactivés ne sont écrits que par apply() (sortie de planModules) et par les migrations : relus tels quels.
const versEtat = (r: { version: number; disabled: string[] }): ModuleState => ({
  version: r.version,
  disabled: r.disabled as Module[],
});
import { HttpError } from './http/errors.js';

const LOCK = 727276;
export class Modules {
  private readonly context = new AsyncLocalStorage<ModuleState>();
  private readonly locks: pg.Pool;
  constructor(
    cfg: Config['db'],
    private readonly db: Db,
  ) {
    // Séparé des transactions métier : aucune saturation circulaire du pool principal.
    this.locks = new pg.Pool({
      ...cfg,
      max: 4,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
      application_name: 'suivi-modules-lock',
    });
    this.locks.on('error', (e) => db.log.error({ err: e.message }, 'module lock pool error'));
  }
  async state(fresh = false): Promise<ModuleState> {
    const cached = !fresh && this.context.getStore();
    if (cached) return cached;
    const r = await this.db.k
      .selectFrom('module_activation')
      .select(['version', 'disabled'])
      .where('id', '=', 1)
      .executeTakeFirst();
    if (!r) throw new HttpError(503, 'Configuration des modules indisponible.');
    return versEtat(r);
  }
  async rights(rights: Rights, fresh = false) {
    return activeRights(rights, (await this.state(fresh)).disabled);
  }
  async assert(id: Module) {
    if ((await this.state()).disabled.includes(id))
      throw new HttpError(409, 'Ce module est désactivé.', { reason: 'module_disabled', module: id });
  }
  async assertKeys(keys: readonly string[]) {
    for (const key of keys) {
      const id = legacyKeyModule(key);
      if (id) await this.assert(id);
    }
  }
  /** Snapshot sous verrou partagé : conservé jusqu'au terme de la mutation. */
  async run<T>(write: boolean, fn: () => Promise<T>): Promise<T> {
    const c = write ? await this.locks.connect() : null;
    let locked = false;
    let broken = false;
    try {
      if (c) {
        await c.query('SELECT pg_advisory_lock_shared($1)', [LOCK]);
        locked = true;
      }
      const state = await this.state(true);
      return await this.context.run(state, fn);
    } finally {
      if (c) {
        if (locked)
          await c.query('SELECT pg_advisory_unlock_shared($1)', [LOCK]).catch(() => {
            broken = true;
          });
        c.release(broken);
      }
    }
  }
  preview(state: ModuleState, intent: ModuleIntent) {
    const plan = planModules(state.disabled, intent);
    const previewId = createHash('sha256')
      .update(JSON.stringify({ version: state.version, plan, intent }))
      .digest('hex');
    return { ...plan, version: state.version, previewId };
  }
  async apply(intent: ModuleIntent, version: number, previewId: string, actor: Actor, ip: string) {
    const guard = await this.locks.connect();
    let locked = false;
    let broken = false;
    try {
      await guard.query('SELECT pg_advisory_lock($1)', [LOCK]);
      locked = true;
      return await this.db.tx(async (c, k) => {
        const current = versEtat(
          await k
            .selectFrom('module_activation')
            .select(['version', 'disabled'])
            .where('id', '=', 1)
            .forUpdate()
            .executeTakeFirstOrThrow(),
        );
        if (current.version !== version)
          throw new HttpError(412, 'La configuration a changé : relancez la prévisualisation.');
        const preview = this.preview(current, intent);
        if (preview.previewId !== previewId)
          throw new HttpError(409, 'La prévisualisation ne correspond pas à cette demande.');
        if (preview.blockers.length) throw new HttpError(409, preview.blockers.join(' '));
        if (!preview.changes.length) throw new HttpError(422, 'Aucun changement à appliquer.');
        const next = versEtat(
          await k
            .updateTable('module_activation')
            .set((eb) => ({
              disabled: preview.disabled,
              version: eb('version', '+', 1),
              updated_at: sql<Date>`now()`,
              updated_by: actor.username,
            }))
            .where('id', '=', 1)
            .returning(['version', 'disabled'])
            .executeTakeFirstOrThrow(),
        );
        await this.db.audit(
          actor,
          ip,
          'modules.update',
          'module_activation:1',
          { before: current, after: next, changes: preview.changes, cascade: intent.cascade, previewId },
          c,
        );
        return next;
      }, actor.username);
    } finally {
      if (locked)
        await guard.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => {
          broken = true;
        });
      guard.release(broken);
    }
  }

  end() {
    return this.locks.end();
  }
}
