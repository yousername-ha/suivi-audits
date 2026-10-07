/* Import et export du format legacy (docs/legacy/IMPORT-LEGACY.md).
   1. Dépôt et validation   2. Simulation (aucune écriture)   3. Confirmation et mode   4. Application en une transaction
   (sauvegarde préalable, fichier brut chiffré, journal d'audit, diffusion temps réel)   5. Annulation possible. */
import { ImportApplyQuery, ImportMode } from '@suivi/shared';
import {
  deepEqual,
  ENVELOPE_FORMAT,
  ENVELOPE_VERSION,
  CURRENT_SCHEMA,
  LegacyFileError,
  migrateToSchema15,
  moduleLabel,
  planImport,
  readLegacyFile,
  type Json,
  type JsonObject,
} from '@suivi/shared/legacy';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Session } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { sha256hex } from '../security/crypto.js';
import { assertLegacyKeys } from '../rights.js';
import type { Services } from '../services.js';

const SimulateQuery = z.object({ mode: ImportMode, module: z.string().max(40).optional() });
const BatchParams = z.object({ id: z.coerce.number().int().positive() });
const importLimit = (c: Services['cfg']) => c.maxImportMb * 1024 * 1024;

function fileName(req: FastifyRequest): string {
  try {
    return decodeURIComponent(String(req.headers['x-file-name'] || 'import.json')).slice(0, 200);
  } catch {
    return 'import.json';
  }
}

/** Décode et valide le fichier déposé. Erreurs : 422 avec le détail des problèmes. */
function readUpload(buf: unknown) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(422, 'Fichier vide ou illisible.');
  let raw: unknown;
  try {
    raw = JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw new HttpError(422, "Le fichier n'est pas un JSON valide.");
  }
  try {
    return readLegacyFile(raw, sha256hex);
  } catch (e) {
    if (e instanceof LegacyFileError) throw new HttpError(422, e.message, { details: e.details });
    throw e;
  }
}

function plan(
  current: JsonObject | null,
  file: ReturnType<typeof readUpload>,
  mode: z.infer<typeof ImportMode>,
  module?: string,
) {
  try {
    return planImport(current, file.data, {
      mode,
      module: module ?? null,
      sourceSchema: file.schema,
      envelope: !!file.envelope,
    });
  } catch (e) {
    if (e instanceof LegacyFileError) throw new HttpError(422, e.message, { details: e.details });
    throw e;
  }
}

/** Valeurs des modules avant import ; les modules absents sont listés à part (ils seront supprimés à l'annulation). */
interface Snapshot {
  values: Record<string, Json>;
  absent: string[];
}
const snapshot = (state: JsonObject | null, keys: string[]): Snapshot => {
  const s: Snapshot = { values: {}, absent: [] };
  for (const k of keys) {
    if (state && k in state) s.values[k] = state[k] as Json;
    else s.absent.push(k);
  }
  return s;
};

/** Écrit les modules donnés : tables pour les modules repris, app_state pour les autres. */
async function writeModules(
  svc: Services,
  c: Client,
  values: Snapshot,
  user: Session['user'],
  note: string,
  batchId: number,
) {
  const cur = await svc.legacy.row(c);
  const data: JsonObject = { ...(cur?.data ?? {}) };
  for (const [k, v] of Object.entries(values.values)) {
    const m = svc.legacy.mapper(k);
    if (m) await m.write(c, v, batchId);
    else data[k] = v;
  }
  for (const k of values.absent) delete data[k];
  for (const k of svc.legacy.takenOver()) delete data[k];
  return svc.legacy.save(c, data, user, null, note, batchId);
}

const batchSummary = `id, created_at, created_by, filename, size, sha256, source_schema, envelope, mode, module, modules,
  report->'totals' AS totals, state_version_before, state_version_after, status, undone_at, undone_by, version`;

export const importRoutes = [
  route({
    method: 'POST',
    url: '/api/admin/import/simulate',
    summary: 'Simulation d’un import legacy : validation et rapport par module, AUCUNE écriture en base',
    tags: ['Import legacy'],
    access: 'import_export:modifier',
    raw: true,
    bodyLimit: importLimit,
    query: SimulateQuery,
    handler: async ({ svc, req, body, query }) => {
      const file = readUpload(body);
      const current = (await svc.legacy.recompose())?.data ?? null;
      const { report } = plan(current, file, query.mode, query.module);
      return {
        filename: fileName(req),
        size: (body as unknown as Buffer).length,
        sha256: sha256hex(body as unknown as Buffer),
        envelope: file.envelope,
        report,
      };
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/import/apply',
    summary: 'Application d’un import simulé (transaction, sauvegarde préalable, traçabilité, temps réel)',
    tags: ['Import legacy'],
    access: 'import_export:modifier',
    raw: true,
    bodyLimit: importLimit,
    query: ImportApplyQuery,
    status: 201,
    handler: async ({ svc, s, ip, req, body, query }) => {
      const sess = s as Session;
      const buf = body as unknown as Buffer;
      const sha = sha256hex(buf);
      if (sha !== query.sha256)
        throw new HttpError(409, 'Le fichier diffère de celui qui a été simulé : relancez la simulation.');
      if (query.mode === 'replace') svc.auth.requirePermission(sess, 'import_export:supprimer');
      if (query.mode === 'replace' && query.confirm !== query.module) {
        throw new HttpError(
          422,
          `Confirmation requise : ressaisissez le nom du module (« ${query.module ?? ''} ») pour le remplacer.`,
        );
      }
      const file = readUpload(buf);
      const filename = fileName(req);
      const out = await svc.db.tx(async (c) => {
        // Verrou sur l'état : aucune autre écriture entre la lecture et l'application.
        await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
        const before = await svc.legacy.recompose(c);
        const { next, report } = plan(before?.data ?? null, file, query.mode, query.module);
        if (!report.affected.length) throw new HttpError(422, 'Ce fichier ne modifie aucune donnée : rien à importer.');
        // L'import écrit dans les modules métier : il faut aussi les droits sur chacun d'eux.
        assertLegacyKeys(sess.user.rights, report.affected, 'modifier');
        if (query.mode === 'replace') assertLegacyKeys(sess.user.rights, report.affected, 'supprimer');
        const id = (await c.query<{ id: number }>("SELECT nextval('import_batches_id_seq')::int AS id")).rows[0]!.id;
        // Sauvegarde : la version courante est conservée dans l'historique (protégée de la fusion des versions).
        if (before) {
          await c.query("UPDATE state_history SET note = $2 WHERE version = $1 AND note = ''", [
            before.version,
            `Sauvegarde avant l'import n°${id}`,
          ]);
        }
        const keys = [...report.affected, 'schema'];
        const beforeSnap = snapshot(before?.data ?? null, keys);
        const afterSnap = snapshot(next, keys);
        const enc = svc.vault.encrypt(buf, `import:${id}`);
        await c.query(
          `INSERT INTO import_batches(id, created_by, filename, size, sha256, source_schema, envelope, mode, module, modules, report,
             raw_key_id, raw_iv, raw_tag, raw_content, before_state, after_state, state_version_before)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            id,
            sess.user.username,
            filename,
            buf.length,
            sha,
            file.schema,
            !!file.envelope,
            query.mode,
            query.module ?? null,
            report.affected,
            report,
            enc.keyId,
            enc.iv,
            enc.tag,
            enc.content,
            beforeSnap,
            afterSnap,
            before?.version ?? null,
          ],
        );
        const saved = await writeModules(
          svc,
          c,
          afterSnap,
          sess.user,
          `Import n°${id} (${query.mode}${query.module ? ' : ' + query.module : ''})`,
          id,
        );
        const version = saved.conflict ? null : saved.version;
        await c.query('UPDATE import_batches SET state_version_after=$2 WHERE id=$1', [id, version]);
        await svc.db.audit(
          sess.user,
          ip,
          'import.apply',
          `import:${id}`,
          {
            mode: query.mode,
            module: query.module ?? null,
            sha256: sha,
            modules: report.affected,
            totals: report.totals,
          },
          c,
        );
        return { id, version, report };
      }, sess.user.username);
      return { batch: out.id, stateVersion: out.version, report: out.report };
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/import',
    summary: 'Historique des imports',
    tags: ['Import legacy'],
    access: 'import_export:lire',
    handler: async ({ svc }) =>
      (await svc.db.q(`SELECT ${batchSummary} FROM import_batches ORDER BY id DESC LIMIT 200`)).rows,
  }),
  route({
    method: 'GET',
    url: '/api/admin/import/:id',
    summary: 'Détail d’un import (rapport complet)',
    tags: ['Import legacy'],
    access: 'import_export:lire',
    params: BatchParams,
    handler: async ({ svc, params }) => {
      const r = await svc.db.one(`SELECT ${batchSummary}, report FROM import_batches WHERE id=$1`, [params.id]);
      if (!r) throw new HttpError(404, 'Import introuvable.');
      return r;
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/import/:id/file',
    summary: 'Fichier brut d’un import (déchiffré)',
    tags: ['Import legacy'],
    access: 'import_export:exporter',
    params: BatchParams,
    handler: async ({ svc, s, ip, params, reply }) => {
      const r = await svc.db.one<{
        filename: string;
        sha256: string;
        raw_key_id: string;
        raw_iv: Buffer;
        raw_tag: Buffer;
        raw_content: Buffer;
      }>('SELECT filename, sha256, raw_key_id, raw_iv, raw_tag, raw_content FROM import_batches WHERE id=$1', [
        params.id,
      ]);
      if (!r) throw new HttpError(404, 'Import introuvable.');
      const plain = svc.vault.decrypt(
        { iv: r.raw_iv, tag: r.raw_tag, content: r.raw_content, keyId: r.raw_key_id },
        `import:${params.id}`,
      );
      if (sha256hex(plain) !== r.sha256) throw new HttpError(500, "Échec du contrôle d'intégrité du fichier importé.");
      // Le fichier source contient des données métier : droit d'exporter chacun de ses modules.
      let parsed: Record<string, unknown> = {};
      try {
        const o = JSON.parse(plain.toString('utf8')) as Record<string, unknown>;
        parsed = (o && typeof o.data === 'object' && o.format ? o.data : o) as Record<string, unknown>;
      } catch {
        /* fichier refusé à l'import : déjà sans contenu exploitable */
      }
      assertLegacyKeys((s as Session).user.rights, Object.keys(parsed ?? {}), 'exporter');
      await svc.db.audit((s as Session).user, ip, 'import.file_download', `import:${params.id}`);
      reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .header('Content-Disposition', `attachment; filename="import-${params.id}.json"`);
      return reply.send(plain);
    },
  }),
  route({
    method: 'POST',
    url: '/api/admin/import/:id/undo',
    summary: 'Annulation d’un import (si aucune modification ultérieure n’a touché les mêmes modules)',
    tags: ['Import legacy'],
    access: 'import_export:modifier',
    params: BatchParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const r = await svc.db.tx(async (c) => {
        await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
        const b = (
          await c.query<{ status: string; modules: string[]; before_state: Snapshot; after_state: Snapshot }>(
            'SELECT status, modules, before_state, after_state FROM import_batches WHERE id=$1 FOR UPDATE',
            [params.id],
          )
        ).rows[0];
        if (!b) throw new HttpError(404, 'Import introuvable.');
        if (b.status !== 'applied') throw new HttpError(409, 'Cet import a déjà été annulé.');
        const cur = (await svc.legacy.recompose(c))?.data ?? {};
        const changed = b.modules.filter((k) => {
          const expected = k in b.after_state.values ? b.after_state.values[k] : undefined;
          return !deepEqual(cur[k] as Json | undefined, expected);
        });
        assertLegacyKeys(sess.user.rights, b.modules, 'modifier');
        if (changed.length) {
          throw new HttpError(
            409,
            `Annulation impossible : ${changed.map(moduleLabel).join(', ')} modifié(s) depuis l'import.`,
            { reason: 'changed_since', modules: changed },
          );
        }
        const keys = [...b.modules, 'schema'];
        const restore: Snapshot = { values: {}, absent: [] };
        for (const k of keys) {
          if (k in b.before_state.values) restore.values[k] = b.before_state.values[k] as Json;
          else if (b.before_state.absent.includes(k)) restore.absent.push(k);
        }
        const saved = await writeModules(
          svc,
          c,
          restore,
          sess.user,
          `Annulation de l'import n°${params.id}`,
          params.id,
        );
        await c.query(
          "UPDATE import_batches SET status='undone', undone_at=now(), undone_by=$2, version = version + 1 WHERE id=$1",
          [params.id, sess.user.username],
        );
        await svc.db.audit(sess.user, ip, 'import.undo', `import:${params.id}`, { modules: b.modules }, c);
        return { stateVersion: saved.conflict ? null : saved.version };
      }, sess.user.username);
      return r;
    },
  }),
  route({
    method: 'GET',
    url: '/api/admin/export/legacy',
    summary: 'Export au format legacy (enveloppe, schéma 15), relisible par l’outil historique',
    tags: ['Import legacy'],
    access: 'import_export:exporter',
    handler: async ({ svc, s, ip, reply }) => {
      const r = await svc.legacy.recompose();
      if (!r) throw new HttpError(404, 'Aucune donnée.');
      // Export complet : il faut le droit d'exporter chacun des modules qu'il contient.
      assertLegacyKeys((s as Session).user.rights, Object.keys(r.data), 'exporter');
      const data = migrateToSchema15(r.data);
      const json = JSON.stringify(data);
      const env = {
        format: ENVELOPE_FORMAT,
        formatVersion: ENVELOPE_VERSION,
        schema: CURRENT_SCHEMA,
        exportedAt: new Date().toISOString(),
        appVersion: svc.cfg.version,
        sha256: sha256hex(json),
        data,
      };
      await svc.db.audit((s as Session).user, ip, 'export.legacy', `v${r.version}`, { sha256: env.sha256 });
      reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .header(
          'Content-Disposition',
          `attachment; filename="suivi-audits-legacy-${env.exportedAt.slice(0, 10).replace(/-/g, '')}.json"`,
        );
      return reply.send(JSON.stringify(env));
    },
  }),
];
