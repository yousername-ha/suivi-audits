/* Cartographie du SMSI (CARTO-01 à CARTO-19, ADR 0013 et 0016) : objets de la plateforme (lecture, création et
   renommage depuis la carte), cartes, versions, nature des enjeux, journal des exports. Chaque route déclare sa permission « cartographie:* » ; un enregistrement exige
   If-Match (412 si la carte a changé, avec l'auteur et la date). */
import { verifierTypeProcessus } from '../types-processus.js';
import { Uuid, perm } from '@suivi/shared';
import {
  CREATABLE,
  CreateObjectBody,
  CreateObjectOut,
  CreationError,
  ExportBody,
  MapSettingsSchema,
  RenameBody,
  buildObjects,
  createInLegacy,
  refModule,
  renameInLegacy,
  type MapIssue,
  IssueKindBody,
  MapCreateBody,
  MapLayoutSchema,
  MapOut,
  MapSaveBody,
  MapVersionDetailOut,
  MapVersionOut,
  ObjectsOut,
  VersionCreateBody,
  pruneEdges,
  type MapLayout,
} from '@suivi/shared/carto';
import { randomBytes } from 'node:crypto';
import type { JsonObject } from '@suivi/shared/legacy';
import { z } from 'zod';
import type { Session } from '../auth.js';
import {
  MAP_NAMES,
  getMap,
  listMaps,
  listVersions,
  trimVersions,
  type MapRow,
  type VersionRow,
} from '../carto/maps.js';
import { LegacyCartoSource, SOURCE_MODULES } from '../carto/sources.js';
import type { Client } from '../db/db.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { permissionDenied } from '../rights.js';
import type { Services } from '../services.js';

const MapParams = z.object({ id: Uuid });
const VersionParams = z.object({ id: Uuid, v: Uuid });

const toOut = (m: MapRow): MapOut => ({
  id: m.id,
  view: m.view,
  name: m.name,
  layout: m.layout as unknown as MapOut['layout'],
  settings: m.settings as MapOut['settings'],
  version: m.version,
  created_at: m.created_at.toISOString(),
  created_by: m.created_by,
  updated_at: m.updated_at.toISOString(),
  updated_by: m.updated_by,
  versions: m.versions,
});
const versionOut = (v: VersionRow): MapVersionOut => ({
  id: v.id,
  label: v.label,
  created_at: v.created_at.toISOString(),
  created_by: v.created_by,
  nodes: Object.keys((v.layout?.nodes as object) ?? {}).length,
});

/** Carte existante (une carte « vide » ne porte que des réglages : elle n'est pas proposée). */
async function existing(c: Pick<Client, 'query'>, id: string, lock = false): Promise<MapRow> {
  const m = await getMap(c, id, lock);
  if (!m || m.extra?.vide) throw new HttpError(404, 'Carte introuvable.');
  return m;
}
/** Champs legacy après un enregistrement depuis la nouvelle interface : date de mise à jour (lue par /legacy). */
const EXTRA_SAVED = `(extra - 'absents' - 'sansVersions' - 'vide') ||
  jsonb_build_object('champs', COALESCE(extra -> 'champs', '{}'::jsonb) || jsonb_build_object('updatedAt', $2::text))`;

/** Disposition valide pour l'enregistrement : relations orphelines retirées (versions de la bêta). */
function cleanLayout(raw: unknown): MapLayout {
  const parsed = MapLayoutSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const r = raw as MapLayout;
  const retry = MapLayoutSchema.safeParse(
    pruneEdges({ nodes: r?.nodes ?? {}, edges: r?.edges ?? [], hide: r?.hide ?? {}, ignored: r?.ignored ?? {} }),
  );
  if (!retry.success) throw new HttpError(422, 'Cette version ne peut pas être restaurée : disposition invalide.');
  return retry.data;
}

/** Identifiant court d'un objet créé (comme l'outil historique : horodatage en base 36), sans collision. */
const uid = () => Date.now().toString(36) + randomBytes(2).toString('hex');
const creationError = (e: unknown) =>
  e instanceof CreationError ? new HttpError(e.status, e.message, { reason: 'carto_object' }) : e;

/** Carte de contexte verrouillée (créée « vide » si besoin) : porte la nature et les enjeux créés sur la carte. */
async function lockedContextSettings(c: Client, actor: string) {
  await c.query(
    `INSERT INTO maps (view, name, layout, created_by, updated_by, extra)
     VALUES ('context', $1, '{"nodes": {}, "edges": [], "hide": {}, "ignored": {}}', $2, $2, '{"vide": true}')
     ON CONFLICT (view) DO NOTHING`,
    [MAP_NAMES.context, actor],
  );
  const r = await c.query<{ settings: unknown }>("SELECT settings FROM maps WHERE view = 'context' FOR UPDATE");
  return MapSettingsSchema.catch({}).parse(r.rows[0]?.settings ?? {});
}

/** Modifie l'état legacy sous verrou (une seule écriture à la fois, comme un enregistrement de /legacy). */
async function withLockedState<T>(
  svc: Services,
  sess: Session,
  note: string,
  fn: (data: Record<string, unknown>) => { data: Record<string, unknown>; out: T },
): Promise<T> {
  return svc.db.tx(async (c) => {
    await c.query('SELECT 1 FROM app_state WHERE id = 1 FOR UPDATE');
    const etat = await svc.legacy.recompose(c);
    const { data, out } = fn((etat?.data ?? {}) as Record<string, unknown>);
    await svc.legacy.nativeWrite(c, data as JsonObject, sess.user, null, note);
    return out;
  }, sess.user.username);
}

export const cartoRoutes = [
  /* ---------------------------------------------------------------- Objets de la plateforme */
  route({
    method: 'GET',
    url: '/api/carto/objects',
    summary: 'Cartographie : objets de la plateforme (filtrés selon les droits de leur module d’origine)',
    tags: ['Cartographie'],
    access: 'cartographie:lire',
    response: ObjectsOut,
    handler: async ({ svc, s }) => {
      const rights = (s as Session).user.rights;
      const objects = await new LegacyCartoSource(svc).list({ rights });
      return {
        organisation: svc.settings.get('general').orgName,
        objects,
        hiddenModules: SOURCE_MODULES.filter((m) => !rights.can(m, 'lire')),
      };
    },
  }),

  route({
    method: 'POST',
    url: '/api/carto/objects',
    summary:
      'Cartographie : création d’un objet de la plateforme depuis la carte (enregistré dans son module, avec la permission de ce module)',
    tags: ['Cartographie'],
    access: 'cartographie:modifier',
    body: CreateObjectBody,
    response: CreateObjectOut,
    status: 201,
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const def = CREATABLE[body.type];
      if (def.module !== 'cartographie' && !sess.user.rights.can(def.module, 'modifier'))
        throw permissionDenied(perm(def.module, 'modifier'));
      const now = new Date().toISOString();
      if (body.type === 'process') await verifierTypeProcessus(svc.db.pool, body.family);
      try {
        let out: { ref: string; name: string };
        if (body.type === 'issue') {
          out = await svc.db.tx(async (c) => {
            const settings = await lockedContextSettings(c, sess.user.username);
            const st = await svc.legacy.recompose(c);
            const issues: MapIssue[] = settings.issues ?? [];
            const existants = new Set(
              [...buildObjects(st?.data ?? {}, { org: '', mapIssues: issues }).values()]
                .filter((o) => /issue/.test(o.type))
                .map((o) => o.ref),
            );
            const r = createInLegacy(st?.data ?? {}, body, { now, uid, existingIssues: existants });
            await c.query(
              `UPDATE maps SET settings = jsonb_set(settings, '{issues}', $1::jsonb) WHERE view = 'context'`,
              [JSON.stringify([...issues, r.issue])],
            );
            return { ref: r.ref, name: r.name };
          }, sess.user.username);
        } else
          out = await withLockedState(svc, sess, `Cartographie : création de « ${body.name} »`, (data) => {
            const r = createInLegacy(data, body, { now, uid });
            return { data: r.data, out: { ref: r.ref, name: r.name } };
          });
        await svc.db.audit(sess.user, ip, 'carto.object_create', out.ref, { type: body.type, name: out.name });
        return out;
      } catch (e) {
        throw creationError(e);
      }
    },
  }),
  route({
    method: 'PUT',
    url: '/api/carto/objects/name',
    summary: 'Cartographie : renommer un objet de la plateforme depuis la carte (modifie son module d’origine)',
    tags: ['Cartographie'],
    access: 'cartographie:modifier',
    body: RenameBody,
    response: CreateObjectOut,
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const m = refModule(body.ref);
      if (!m) throw new HttpError(422, 'Cet objet ne peut pas être renommé depuis la carte.');
      if (!sess.user.rights.can(m, 'modifier')) throw permissionDenied(perm(m, 'modifier'));
      try {
        const old = await withLockedState(svc, sess, `Cartographie : renommage en « ${body.name} »`, (data) => {
          const r = renameInLegacy(data, body.ref, body.name);
          return { data: r.data, out: r.old };
        });
        await svc.db.audit(sess.user, ip, 'carto.object_rename', body.ref, { old, name: body.name });
        return { ref: body.ref, name: body.name };
      } catch (e) {
        throw creationError(e);
      }
    },
  }),

  /* ---------------------------------------------------------------- Cartes */
  route({
    method: 'GET',
    url: '/api/carto/maps',
    summary: 'Cartographie : cartes (une par vue)',
    tags: ['Cartographie'],
    access: 'cartographie:lire',
    response: z.array(MapOut),
    handler: async ({ svc }) => (await listMaps(svc.db.pool)).map(toOut),
  }),
  route({
    method: 'GET',
    url: '/api/carto/maps/:id',
    summary: 'Cartographie : une carte (ETag = version)',
    tags: ['Cartographie'],
    access: 'cartographie:lire',
    params: MapParams,
    response: MapOut,
    handler: async ({ svc, params, reply }) => {
      const m = await existing(svc.db.pool, params.id);
      setEtag(reply, m.version);
      return toOut(m);
    },
  }),
  route({
    method: 'POST',
    url: '/api/carto/maps',
    summary: 'Cartographie : création d’une carte (vierge ou générée), une par vue',
    tags: ['Cartographie'],
    access: 'cartographie:modifier',
    body: MapCreateBody,
    response: MapOut,
    status: 201,
    handler: async ({ svc, s, ip, body, reply }) => {
      const sess = s as Session;
      const now = new Date().toISOString();
      const id = await svc.db.tx(async (c) => {
        const cur = (
          await c.query<{ id: string; extra: MapRow['extra'] }>(
            'SELECT id, extra FROM maps WHERE view = $1 FOR UPDATE',
            [body.view],
          )
        ).rows[0];
        if (cur && !cur.extra?.vide)
          throw new HttpError(409, 'Une carte existe déjà pour cette vue : rechargez la page.', { id: cur.id });
        if (cur) {
          await c.query(
            `UPDATE maps SET layout = $3, name = $4, extra = ${EXTRA_SAVED}, version = version + 1, updated_at = now(),
               updated_by = $5 WHERE id = $1`,
            [cur.id, now, body.layout, body.name ?? MAP_NAMES[body.view], sess.user.username],
          );
          return cur.id;
        }
        const r = await c.query<{ id: string }>(
          `INSERT INTO maps (view, name, layout, created_by, updated_by, extra)
           VALUES ($1, $2, $3, $4, $4, jsonb_build_object('champs', jsonb_build_object('updatedAt', $5::text)))
           RETURNING id`,
          [body.view, body.name ?? MAP_NAMES[body.view], body.layout, sess.user.username, now],
        );
        return r.rows[0]!.id;
      }, sess.user.username);
      const m = await existing(svc.db.pool, id);
      await svc.db.audit(sess.user, ip, 'carto.map_create', `map:${id}`, {
        view: m.view,
        nodes: Object.keys(body.layout.nodes).length,
      });
      setEtag(reply, m.version);
      return toOut(m);
    },
  }),
  route({
    method: 'PUT',
    url: '/api/carto/maps/:id',
    summary: 'Cartographie : enregistrement (If-Match obligatoire ; 412 si la carte a été modifiée entre-temps)',
    tags: ['Cartographie'],
    access: 'cartographie:modifier',
    params: MapParams,
    body: MapSaveBody,
    response: MapOut,
    handler: async ({ svc, s, ip, req, reply, params, body }) => {
      const sess = s as Session;
      const expected = requireIfMatch(req);
      await svc.db.tx(async (c) => {
        const cur = await existing(c, params.id, true);
        if (cur.version !== expected)
          throw conflict({
            version: cur.version,
            updated_by: cur.updated_by,
            updated_at: cur.updated_at.toISOString(),
          });
        await c.query(
          `UPDATE maps SET layout = $3, name = COALESCE($4, name), extra = ${EXTRA_SAVED}, version = version + 1,
             updated_at = now(), updated_by = $5 WHERE id = $1`,
          [params.id, new Date().toISOString(), body.layout, body.name ?? null, sess.user.username],
        );
      }, sess.user.username);
      const m = await existing(svc.db.pool, params.id);
      await svc.db.audit(sess.user, ip, body.overwrite ? 'carto.map_overwrite' : 'carto.map_save', `map:${m.id}`, {
        view: m.view,
        version: m.version,
        nodes: Object.keys(body.layout.nodes).length,
        edges: body.layout.edges.length,
      });
      setEtag(reply, m.version);
      return toOut(m);
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/carto/maps/:id',
    summary: 'Cartographie : suppression d’une carte et de ses versions (les objets de la plateforme sont conservés)',
    tags: ['Cartographie'],
    access: 'cartographie:supprimer',
    params: MapParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const m = await svc.db.tx(async (c) => {
        const cur = await existing(c, params.id, true);
        await c.query('DELETE FROM maps WHERE id = $1', [params.id]);
        return cur;
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'carto.map_delete', `map:${m.id}`, { view: m.view, versions: m.versions });
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Versions (CARTO-11) */
  route({
    method: 'GET',
    url: '/api/carto/maps/:id/versions',
    summary: 'Cartographie : versions figées d’une carte (la plus récente d’abord)',
    tags: ['Cartographie'],
    access: 'cartographie:lire',
    params: MapParams,
    response: z.array(MapVersionOut),
    handler: async ({ svc, params }) => {
      await existing(svc.db.pool, params.id);
      return (await listVersions(svc.db.pool, params.id)).reverse().map(versionOut);
    },
  }),
  route({
    method: 'GET',
    url: '/api/carto/maps/:id/versions/:v',
    summary: 'Cartographie : une version figée, avec sa disposition',
    tags: ['Cartographie'],
    access: 'cartographie:lire',
    params: VersionParams,
    response: MapVersionDetailOut,
    handler: async ({ svc, params }) => {
      const v = (await listVersions(svc.db.pool, params.id)).find((x) => x.id === params.v);
      if (!v) throw new HttpError(404, 'Version introuvable.');
      return { ...versionOut(v), layout: v.layout as unknown as MapLayout };
    },
  }),
  route({
    method: 'POST',
    url: '/api/carto/maps/:id/versions',
    summary: 'Cartographie : figer la carte enregistrée (20 versions au plus, la plus ancienne est supprimée)',
    tags: ['Cartographie'],
    access: 'cartographie:modifier',
    params: MapParams,
    body: VersionCreateBody,
    response: MapVersionOut,
    status: 201,
    handler: async ({ svc, s, ip, params, body }) => {
      const sess = s as Session;
      const label = body.label || `Version du ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`;
      const { v, removed } = await svc.db.tx(async (c) => {
        const m = await existing(c, params.id, true);
        const r = await c.query<VersionRow>(
          `INSERT INTO map_versions (map_id, label, layout, created_by) VALUES ($1, $2, $3, $4)
           RETURNING id, map_id, label, layout, created_at, created_by, extra`,
          [m.id, label, m.layout, sess.user.username],
        );
        return { v: r.rows[0]!, removed: await trimVersions(c, m.id) };
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'carto.version_create', `map:${params.id}`, {
        version: v.id,
        label,
        removed,
      });
      return versionOut(v);
    },
  }),
  route({
    method: 'POST',
    url: '/api/carto/maps/:id/versions/:v/restore',
    summary: 'Cartographie : restauration d’une version (If-Match de la carte ; nouvelle version de la carte)',
    tags: ['Cartographie'],
    access: 'cartographie:modifier',
    params: VersionParams,
    response: MapOut,
    handler: async ({ svc, s, ip, req, reply, params }) => {
      const sess = s as Session;
      const expected = requireIfMatch(req);
      const label = await svc.db.tx(async (c) => {
        const cur = await existing(c, params.id, true);
        if (cur.version !== expected)
          throw conflict({
            version: cur.version,
            updated_by: cur.updated_by,
            updated_at: cur.updated_at.toISOString(),
          });
        const v = (await listVersions(c, params.id)).find((x) => x.id === params.v);
        if (!v) throw new HttpError(404, 'Version introuvable.');
        await c.query(
          `UPDATE maps SET layout = $3, extra = ${EXTRA_SAVED}, version = version + 1, updated_at = now(),
             updated_by = $4 WHERE id = $1`,
          [params.id, new Date().toISOString(), cleanLayout(v.layout), sess.user.username],
        );
        return v.label;
      }, sess.user.username);
      const m = await existing(svc.db.pool, params.id);
      await svc.db.audit(sess.user, ip, 'carto.version_restore', `map:${m.id}`, {
        version: params.v,
        label,
        mapVersion: m.version,
      });
      setEtag(reply, m.version);
      return toOut(m);
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/carto/maps/:id/versions/:v',
    summary: 'Cartographie : suppression d’une version figée',
    tags: ['Cartographie'],
    access: 'cartographie:supprimer',
    params: VersionParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const r = await svc.db.tx(
        (c) =>
          c.query<{ label: string }>('DELETE FROM map_versions WHERE id = $1 AND map_id = $2 RETURNING label', [
            params.v,
            params.id,
          ]),
        sess.user.username,
      );
      if (!r.rowCount) throw new HttpError(404, 'Version introuvable.');
      await svc.db.audit(sess.user, ip, 'carto.version_delete', `map:${params.id}`, {
        version: params.v,
        label: r.rows[0]!.label,
      });
      return undefined;
    },
  }),

  /* ---------------------------------------------------------------- Nature des enjeux (CARTO-12) */
  route({
    method: 'PUT',
    url: '/api/carto/settings/issue-kind',
    summary: 'Cartographie : nature d’un enjeu (externe, interne ; null = nature déduite)',
    tags: ['Cartographie'],
    access: 'cartographie:modifier',
    body: IssueKindBody,
    response: z.object({ issueKind: z.record(z.string(), z.enum(['ext', 'int'])) }),
    handler: async ({ svc, s, ip, body }) => {
      const sess = s as Session;
      const issueKind = await svc.db.tx(async (c) => {
        // Réglage porté par la carte de contexte ; sans carte, une carte « vide » (non proposée) le conserve.
        await c.query(
          `INSERT INTO maps (view, name, layout, created_by, updated_by, extra)
           VALUES ('context', $1, '{"nodes": {}, "edges": [], "hide": {}, "ignored": {}}', $2, $2, '{"vide": true}')
           ON CONFLICT (view) DO NOTHING`,
          [MAP_NAMES.context, sess.user.username],
        );
        const r = await c.query<{ settings: { issueKind?: Record<string, 'ext' | 'int'> } }>(
          `UPDATE maps SET settings = CASE WHEN $2::text IS NULL
               THEN jsonb_set(settings, '{issueKind}', COALESCE(settings -> 'issueKind', '{}'::jsonb) - $1)
               ELSE jsonb_set(settings, '{issueKind}', COALESCE(settings -> 'issueKind', '{}'::jsonb) || jsonb_build_object($1::text, $2::text))
             END
           WHERE view = 'context' RETURNING settings`,
          [body.ref, body.kind],
        );
        return r.rows[0]!.settings.issueKind ?? {};
      }, sess.user.username);
      await svc.db.audit(sess.user, ip, 'carto.issue_kind', body.ref, { kind: body.kind });
      return { issueKind };
    },
  }),

  /* ---------------------------------------------------------------- Exports (CARTO-13) */
  route({
    method: 'POST',
    url: '/api/carto/exports',
    summary: 'Cartographie : journalisation d’un export (PNG, SVG, PDF, JSON produit par le navigateur)',
    tags: ['Cartographie'],
    access: 'cartographie:exporter',
    body: ExportBody,
    handler: async ({ svc, s, ip, body }) => {
      await svc.db.audit((s as Session).user, ip, 'carto.export', body.view, { format: body.format });
      return undefined;
    },
  }),
];
