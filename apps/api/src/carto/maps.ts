/* Cartographie (ADR 0013) : accès aux tables maps et map_versions, et reprise du module legacy « maps » (CARTO-14).
   Le mapper reconstruit S.maps à l'identique pour /legacy et l'export, et écrit S.maps dans les tables à l'import. */
import { MAP_VIEWS, type MapView } from '@suivi/shared/carto';
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { Client } from '../db/db.js';
import type { ModuleMapper } from '../legacy/store.js';

const MAX_VERSIONS = 20;
export const MAP_NAMES: Record<MapView, string> = { context: 'Carte du contexte', process: 'Carte des processus' };
const LAYOUT_KEYS = ['nodes', 'edges', 'hide', 'ignored', 'free'] as const;

export interface MapRow {
  id: string;
  view: MapView;
  name: string;
  layout: JsonObject;
  settings: JsonObject;
  version: number;
  created_at: Date;
  created_by: string;
  updated_at: Date;
  updated_by: string;
  extra: MapExtra;
  versions: number;
}
/** Champs legacy conservés : autres clés de la carte (updatedAt…), clés de disposition absentes à l'import,
 *  carte « vide » (réglages sans carte de contexte), versions absentes. */
interface MapExtra {
  champs?: JsonObject;
  absents?: string[];
  sansVersions?: boolean;
  vide?: boolean;
}
export interface VersionRow {
  id: string;
  map_id: string;
  label: string;
  layout: JsonObject;
  created_at: Date;
  created_by: string;
  extra: { id?: Json; at?: Json };
}

const MAP_COLUMNS = `m.id, m.view, m.name, m.layout, m.settings, m.version, m.created_at, m.created_by, m.updated_at,
  m.updated_by, m.extra, (SELECT count(*)::int FROM map_versions v WHERE v.map_id = m.id) AS versions`;

export async function listMaps(c: Pick<Client, 'query'>, withEmpty = false): Promise<MapRow[]> {
  const r = await c.query<MapRow>(`SELECT ${MAP_COLUMNS} FROM maps m ORDER BY m.view, m.created_at`);
  return withEmpty ? r.rows : r.rows.filter((m) => !m.extra?.vide);
}
export async function getMap(c: Pick<Client, 'query'>, id: string, lock = false): Promise<MapRow | null> {
  const r = await c.query<MapRow>(`SELECT ${MAP_COLUMNS} FROM maps m WHERE m.id = $1${lock ? ' FOR UPDATE' : ''}`, [
    id,
  ]);
  return r.rows[0] ?? null;
}
export async function listVersions(c: Pick<Client, 'query'>, mapId: string): Promise<VersionRow[]> {
  const r = await c.query<VersionRow>(
    'SELECT id, map_id, label, layout, created_at, created_by, extra FROM map_versions WHERE map_id = $1 ORDER BY created_at, id',
    [mapId],
  );
  return r.rows;
}
/** Supprime les versions au-delà des 20 plus récentes. */
export async function trimVersions(c: Client, mapId: string): Promise<number> {
  const r = await c.query(
    `DELETE FROM map_versions WHERE id IN (
       SELECT id FROM map_versions WHERE map_id = $1 ORDER BY created_at DESC, id DESC OFFSET $2)`,
    [mapId, MAX_VERSIONS],
  );
  return r.rowCount ?? 0;
}

/* ---------------------------------------------------------------- Module legacy « maps » */
const ACTOR = "COALESCE(NULLIF(current_setting('suivi.actor', true), ''), 'import')";

/** S.maps reconstruit depuis les tables (undefined : aucune carte, la clé est absente de l'état). */
async function readLegacyMaps(c: Client): Promise<Json | undefined> {
  const rows = await listMaps(c, true);
  if (!rows.length) return undefined;
  const out: JsonObject = {};
  for (const m of rows) {
    const extra = (m.extra ?? {}) as MapExtra;
    if (m.view === 'context' && isObject(m.settings) && 'issueKind' in m.settings)
      out.issueKind = m.settings.issueKind as Json;
    if (m.view === 'context' && isObject(m.settings) && 'issues' in m.settings) out.issues = m.settings.issues as Json;
    if (extra.vide) continue;
    const versions = (await listVersions(c, m.id)).map((v) => ({
      id: v.extra?.id ?? v.id,
      at: v.extra?.at ?? v.created_at.toISOString(),
      label: v.label,
      map: v.layout,
    })) as Json[];
    const map: JsonObject = { ...m.layout };
    for (const k of extra.absents ?? []) {
      const val = map[k];
      if ((Array.isArray(val) && !val.length) || (isObject(val) && !Object.keys(val).length)) delete map[k];
    }
    if (!(extra.sansVersions && !versions.length)) map.versions = versions;
    Object.assign(map, extra.champs ?? {});
    out[m.view] = map;
  }
  return out;
}

/** Écrit S.maps dans les tables (import legacy, annulation d'un import). null ou absent : aucune carte. */
async function writeLegacyMaps(c: Client, value: Json | undefined, batchId: number | null): Promise<void> {
  const S = isObject(value ?? null) ? (value as JsonObject) : null;
  const issueKind = S && isObject(S.issueKind ?? null) ? (S.issueKind as JsonObject) : null;
  const issues = S && Array.isArray(S.issues) ? (S.issues as Json[]) : null;
  for (const view of MAP_VIEWS) {
    const m = S && isObject(S[view] ?? null) ? (S[view] as JsonObject) : null;
    const valid = !!m && isObject(m.nodes ?? null);
    const settings: JsonObject =
      view === 'context' ? { ...(issueKind ? { issueKind } : {}), ...(issues ? { issues } : {}) } : {};
    if (!valid && !(view === 'context' && (issueKind || issues))) {
      await c.query('DELETE FROM maps WHERE view = $1', [view]);
      continue;
    }
    let layout: JsonObject = { nodes: {}, edges: [], hide: {}, ignored: {} };
    let extra: MapExtra = { vide: true };
    if (valid) {
      // « free » (notes et cadres de la nouvelle interface) n'est écrit que s'il existe : jamais « absent ».
      const absents = LAYOUT_KEYS.filter((k) => k !== 'free' && !(k in m));
      layout = {
        nodes: m.nodes as Json,
        edges: Array.isArray(m.edges) ? m.edges : [],
        hide: isObject(m.hide ?? null) ? (m.hide as Json) : {},
        ignored: isObject(m.ignored ?? null) ? (m.ignored as Json) : {},
        ...(isObject(m.free ?? null) ? { free: m.free as Json } : {}),
      };
      const champs = Object.fromEntries(
        Object.entries(m).filter(([k]) => !(LAYOUT_KEYS as readonly string[]).includes(k) && k !== 'versions'),
      ) as JsonObject;
      extra = {
        champs,
        ...(absents.length ? { absents } : {}),
        ...(Array.isArray(m.versions) ? {} : { sansVersions: true }),
      };
    }
    const r = await c.query<{ id: string }>(
      `INSERT INTO maps (view, name, layout, settings, created_by, updated_by, legacy_id, import_batch_id, extra)
       VALUES ($1, $2, $3, $4, ${ACTOR}, ${ACTOR}, $5, $6, $7)
       ON CONFLICT (view) DO UPDATE SET layout = EXCLUDED.layout, settings = EXCLUDED.settings, extra = EXCLUDED.extra,
         import_batch_id = EXCLUDED.import_batch_id, legacy_id = EXCLUDED.legacy_id, version = maps.version + 1,
         updated_at = now(), updated_by = EXCLUDED.updated_by
       RETURNING id`,
      [view, MAP_NAMES[view], layout, settings, `maps.${view}`, batchId, extra],
    );
    const id = r.rows[0]!.id;
    await c.query('DELETE FROM map_versions WHERE map_id = $1', [id]);
    const versions = valid && Array.isArray(m.versions) ? m.versions.filter(isObject) : [];
    for (const [i, v] of versions.entries()) {
      await c.query(
        `INSERT INTO map_versions (map_id, label, layout, created_at, created_by, legacy_id, import_batch_id, extra)
         VALUES ($1, $2, $3, now() + ($4 || ' milliseconds')::interval, ${ACTOR}, $5, $6, $7)`,
        [
          id,
          typeof v.label === 'string' ? v.label : '',
          isObject(v.map ?? null) ? v.map : {},
          String(i),
          typeof v.id === 'string' ? v.id : null,
          batchId,
          Object.fromEntries(Object.entries({ id: v.id, at: v.at }).filter(([, x]) => x !== undefined)),
        ],
      );
    }
  }
}

export const mapsMapper: ModuleMapper = {
  key: 'maps',
  read: readLegacyMaps,
  write: (c, value, batchId) => writeLegacyMaps(c, value, batchId),
};
