/* État du suivi : recomposition de la forme historique (schéma 15) à partir des tables, et écriture depuis la nouvelle
   interface. Une seule source modifiable par module (docs/legacy/IMPORT-LEGACY.md § 4) :
   - module repris (un « mapper » est enregistré) : ses données vivent dans des tables, `recompose` les relit et
     `nativeWrite` les y enregistre ;
   - reste de l'état : app_state (clés techniques et version de l'état). */
import { canonicalJson, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { Config } from '../config.js';
import { sql } from 'kysely';
import { surConnexion, type Actor, type Client, type Db, type Kdb } from '../db/db.js';
import { sha256hex } from '../security/crypto.js';

/** Correspondance d'un module legacy repris vers ses tables (phases 1 à 3). */
export interface ModuleMapper {
  key: string;
  /** Valeur du module au format legacy, reconstruite à partir des tables (undefined : clé absente de l'état). */
  read(c: Client): Promise<Json | undefined>;
  /** Enregistre la valeur legacy du module dans les tables (import), dans la transaction fournie.
      undefined : le module est absent (annulation d'un import qui l'avait créé). */
  write(c: Client, value: Json | undefined, batchId: number | null): Promise<void>;
}

/** Version courante d'app_state, verrouillée jusqu'à la fin de la transaction. */
const versionVerrouillee = (k: Kdb) =>
  k
    .selectFrom('app_state')
    .select(['version', 'updated_by', 'updated_at'])
    .where('id', '=', 1)
    .forUpdate()
    .executeTakeFirst();

export interface StateRow {
  version: number;
  data: JsonObject;
  sha256: string;
  updated_by: string;
  updated_at: Date;
}

/** Correspondance d'un lot de clés lues en une seule requête (réglages scalaires), pour ne pas multiplier les lectures. */
export interface BatchMapper {
  keys: readonly string[];
  readAll(c: Client): Promise<Map<string, Json>>;
  write(c: Client, key: string, value: Json | undefined, batchId: number | null): Promise<void>;
}

export class LegacyStore {
  private readonly mappers = new Map<string, ModuleMapper>();
  private batch: BatchMapper | null = null;
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
  ) {}

  /* ---------------------------------------------------------------- Modules repris */
  register(m: ModuleMapper) {
    this.mappers.set(m.key, m);
  }
  registerBatch(b: BatchMapper) {
    this.batch = b;
    for (const key of b.keys)
      this.mappers.set(key, {
        key,
        read: async (c) => (await b.readAll(c)).get(key),
        write: (c, value, batchId) => b.write(c, key, value, batchId),
      });
  }
  /** Valeur actuelle de chaque module repris (le lot de réglages est lu en une requête). */
  private async lireTous(c: Client): Promise<Map<string, Json | undefined>> {
    const lot = this.batch ? await this.batch.readAll(c) : null;
    const out = new Map<string, Json | undefined>();
    for (const m of this.mappers.values())
      out.set(m.key, lot && this.batch!.keys.includes(m.key) ? lot.get(m.key) : await m.read(c));
    return out;
  }
  unregister(key: string) {
    this.mappers.delete(key);
  }
  takenOver(): string[] {
    return [...this.mappers.keys()].sort();
  }
  mapper(key: string) {
    return this.mappers.get(key);
  }

  /* ---------------------------------------------------------------- Lecture */
  async row(c?: Client): Promise<StateRow | null> {
    const r = await (c ? surConnexion(c) : this.db.k)
      .selectFrom('app_state')
      .select(['version', 'data', 'sha256', 'updated_by', 'updated_at'])
      .where('id', '=', 1)
      .executeTakeFirst();
    return (r as StateRow | undefined) ?? null;
  }
  /** État servi à /legacy : app_state + modules repris, reconstruits depuis leurs tables. */
  async recompose(c?: Client): Promise<{ version: number; data: JsonObject } | null> {
    const run = async (cl: Client) => {
      const r = await this.row(cl);
      if (!r) return null;
      const data: JsonObject = { ...r.data };
      for (const [key, v] of await this.lireTous(cl)) {
        if (v === undefined) delete data[key];
        else data[key] = v;
      }
      return { version: r.version, data };
    };
    if (c) return run(c);
    const cl = await this.db.pool.connect();
    try {
      return await run(cl);
    } finally {
      cl.release();
    }
  }

  /* ---------------------------------------------------------------- Écriture */
  /** Enregistre une nouvelle version d'app_state. Historique : un instantané par utilisateur et par tranche de 10 minutes.
      expected : version attendue (contrôle optimiste) ou null pour forcer. */
  async save(
    c: Client,
    incoming: JsonObject,
    user: Actor | null,
    expected: number | null,
    note: string,
    batchId: number | null = null,
  ): Promise<
    { conflict: true; by: string; at: Date; version: number } | { conflict: false; version: number; sha256: string }
  > {
    // Les modules repris vivent dans leurs tables : jamais de copie dans app_state, quel que soit l'appelant.
    const obj: JsonObject = { ...incoming };
    for (const m of this.mappers.values()) delete obj[m.key];
    const sha = sha256hex(JSON.stringify(obj));
    const k = surConnexion(c);
    const cur = await versionVerrouillee(k);
    if (cur && expected != null && expected !== cur.version)
      return { conflict: true, by: cur.updated_by, at: cur.updated_at, version: cur.version };
    const version = cur ? cur.version + 1 : 1;
    const by = user ? user.username : 'système';
    const data = JSON.stringify(obj);
    if (cur) {
      await k
        .updateTable('app_state')
        .set({ version, data, sha256: sha, updated_at: sql<Date>`now()`, updated_by: by, import_batch_id: batchId })
        .where('id', '=', 1)
        .execute();
    } else {
      await k
        .insertInto('app_state')
        .values({ id: 1, version, data, sha256: sha, updated_by: by, import_batch_id: batchId })
        .execute();
    }
    const last = await k
      .selectFrom('state_history')
      .select(['version', 'updated_by', 'updated_at', 'note'])
      .orderBy('version', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (
      !note &&
      last &&
      !last.note &&
      last.updated_by === by &&
      Date.now() - new Date(last.updated_at).getTime() < 10 * 60e3 &&
      last.version === version - 1
    ) {
      await k.deleteFrom('state_history').where('version', '=', last.version).execute();
    }
    await k
      .insertInto('state_history')
      .values({
        version,
        data,
        sha256: sha,
        updated_at: sql<Date>`now()`,
        updated_by: by,
        note: note || '',
        import_batch_id: batchId,
      })
      .execute();
    await k
      .deleteFrom('state_history')
      .where('version', 'in', (eb) =>
        eb.selectFrom('state_history').select('version').orderBy('version', 'desc').offset(this.cfg.stateHistoryKeep),
      )
      .execute();
    return { conflict: false, version, sha256: sha };
  }

  /** Écriture depuis la nouvelle interface : les modules repris dans des tables sont enregistrés dans leurs tables (par
      leur correspondance) quand leur valeur change ; seul le reste de l'état va dans app_state. Rien n'est refusé :
      c'est la source de vérité relationnelle qui est modifiée. */
  async nativeWrite(
    c: Client,
    incoming: JsonObject,
    user: Actor | null,
    expected: number | null,
    note = '',
    opts: { retirerAbsents?: boolean } = {},
  ) {
    const stored: JsonObject = { ...incoming };
    // Conflit détecté avant toute écriture dans les tables des modules repris.
    const cur = await versionVerrouillee(surConnexion(c));
    if (cur && expected != null && expected !== cur.version)
      return { conflict: true as const, by: cur.updated_by, at: cur.updated_at, version: cur.version };
    const actuel = await this.lireTous(c);
    for (const m of this.mappers.values()) {
      if (m.key in incoming) {
        const current = actuel.get(m.key);
        const value = incoming[m.key] as Json;
        // Contrairement à /legacy, un conteneur vide explicite est enregistré (l'outil historique attend la clé présente).
        const same = current === undefined ? value === null : canonicalJson(value) === canonicalJson(current);
        if (!same) await m.write(c, value, null);
      } else if (opts.retirerAbsents && actuel.get(m.key) !== undefined) {
        // Appelant qui fournit l'état complet : une clé absente est une clé retirée (amorçage, restauration).
        await m.write(c, undefined, null);
      }
      delete stored[m.key];
    }
    return this.save(c, stored, user, expected, note);
  }
}
