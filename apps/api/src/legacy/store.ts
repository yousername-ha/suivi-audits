/* État de l'outil historique (/legacy) pendant la transition.
   Une seule source modifiable par module (docs/legacy/IMPORT-LEGACY.md § 4) :
   - module pas encore repris : ses données vivent dans app_state, /legacy les modifie comme avant ;
   - module repris (un « mapper » est enregistré) : ses données vivent dans des tables ; /legacy les affiche
     (état recomposé) mais le serveur refuse toute modification les concernant. */
import { canonicalJson, isObject, moduleLabel, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { Config } from '../config.js';
import type { Actor, Client, Db } from '../db/db.js';
import { HttpError } from '../http/errors.js';
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

export interface StateRow {
  version: number;
  data: JsonObject;
  sha256: string;
  updated_by: string;
  updated_at: Date;
}

export class LegacyStore {
  private readonly mappers = new Map<string, ModuleMapper>();
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
  ) {}

  /* ---------------------------------------------------------------- Modules repris */
  register(m: ModuleMapper) {
    this.mappers.set(m.key, m);
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
    const r = await (c ?? this.db.pool).query<StateRow>(
      'SELECT version, data, sha256, updated_by, updated_at FROM app_state WHERE id=1',
    );
    return r.rows[0] ?? null;
  }
  /** État servi à /legacy : app_state + modules repris, reconstruits depuis leurs tables. */
  async recompose(c?: Client): Promise<{ version: number; data: JsonObject } | null> {
    const run = async (cl: Client) => {
      const r = await this.row(cl);
      if (!r) return null;
      const data: JsonObject = { ...r.data };
      for (const m of this.mappers.values()) {
        const v = await m.read(cl);
        if (v === undefined) delete data[m.key];
        else data[m.key] = v;
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
    const cur = (
      await c.query<{ version: number; updated_by: string; updated_at: Date }>(
        'SELECT version, updated_by, updated_at FROM app_state WHERE id=1 FOR UPDATE',
      )
    ).rows[0];
    if (cur && expected != null && expected !== cur.version)
      return { conflict: true, by: cur.updated_by, at: cur.updated_at, version: cur.version };
    const version = cur ? cur.version + 1 : 1;
    const by = user ? user.username : 'système';
    if (cur) {
      await c.query(
        'UPDATE app_state SET version=$1, data=$2, sha256=$3, updated_at=now(), updated_by=$4, import_batch_id=$5 WHERE id=1',
        [version, obj, sha, by, batchId],
      );
    } else {
      await c.query(
        'INSERT INTO app_state(id, version, data, sha256, updated_by, import_batch_id) VALUES (1,$1,$2,$3,$4,$5)',
        [version, obj, sha, by, batchId],
      );
    }
    const last = (
      await c.query<{ version: number; updated_by: string; updated_at: Date; note: string }>(
        'SELECT version, updated_by, updated_at, note FROM state_history ORDER BY version DESC LIMIT 1',
      )
    ).rows[0];
    if (
      !note &&
      last &&
      !last.note &&
      last.updated_by === by &&
      Date.now() - new Date(last.updated_at).getTime() < 10 * 60e3 &&
      last.version === version - 1
    ) {
      await c.query('DELETE FROM state_history WHERE version=$1', [last.version]);
    }
    await c.query(
      'INSERT INTO state_history(version, data, sha256, updated_at, updated_by, note, import_batch_id) VALUES ($1,$2,$3,now(),$4,$5,$6)',
      [version, obj, sha, by, note || '', batchId],
    );
    await c.query(
      'DELETE FROM state_history WHERE version IN (SELECT version FROM state_history ORDER BY version DESC OFFSET $1)',
      [this.cfg.stateHistoryKeep],
    );
    return { conflict: false, version, sha256: sha };
  }

  /** Écriture depuis /legacy : refusée si elle modifie un module repris ; les modules repris ne sont jamais stockés dans app_state. */
  async legacyWrite(c: Client, incoming: JsonObject, user: Actor, expected: number | null) {
    const blocked: string[] = [];
    const stored: JsonObject = { ...incoming };
    for (const m of this.mappers.values()) {
      if (m.key in incoming) {
        const current = await m.read(c);
        const value = incoming[m.key] as Json;
        // Module absent des tables : seule une valeur vide (null, objet ou liste vide) est acceptée (l'outil historique crée la clé à la volée).
        const same =
          current === undefined
            ? value === null ||
              (isObject(value) && !Object.keys(value).length) ||
              (Array.isArray(value) && !value.length)
            : canonicalJson(value) === canonicalJson(current);
        if (!same) blocked.push(m.key);
      }
      delete stored[m.key];
    }
    if (blocked.length) {
      throw new HttpError(
        409,
        `Module géré dans la nouvelle interface : ${blocked.map(moduleLabel).join(', ')}. Ces données ne peuvent plus être modifiées ici.`,
        {
          reason: 'module_taken_over',
          modules: blocked,
        },
      );
    }
    return this.save(c, stored, user, expected, '');
  }

  /** Écriture depuis la nouvelle interface : les modules repris dans des tables sont enregistrés dans leurs tables (par
      leur correspondance) quand leur valeur change ; seul le reste de l'état va dans app_state. Contrairement à
      `legacyWrite`, rien n'est refusé : c'est la source de vérité relationnelle qui est modifiée. */
  async nativeWrite(c: Client, incoming: JsonObject, user: Actor | null, expected: number | null, note = '') {
    const stored: JsonObject = { ...incoming };
    // Conflit détecté avant toute écriture dans les tables des modules repris.
    const cur = (
      await c.query<{ version: number; updated_by: string; updated_at: Date }>(
        'SELECT version, updated_by, updated_at FROM app_state WHERE id=1 FOR UPDATE',
      )
    ).rows[0];
    if (cur && expected != null && expected !== cur.version)
      return { conflict: true as const, by: cur.updated_by, at: cur.updated_at, version: cur.version };
    for (const m of this.mappers.values()) {
      if (m.key in incoming) {
        const current = await m.read(c);
        const value = incoming[m.key] as Json;
        const same =
          current === undefined
            ? value === null ||
              (isObject(value) && !Object.keys(value).length) ||
              (Array.isArray(value) && !value.length)
            : canonicalJson(value) === canonicalJson(current);
        if (!same) await m.write(c, value, null);
      }
      delete stored[m.key];
    }
    return this.save(c, stored, user, expected, note);
  }
}
