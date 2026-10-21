/* Documents (GED chiffrée, versions) et liens. */
import {
  DocumentDetailOut,
  DocumentMeta,
  DocumentOut,
  DocumentQuery,
  LinkCreateBody,
  LinkOut,
  LinkPatchBody,
  Uuid,
} from '@suivi/shared';
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Session } from '../auth.js';
import type { Client } from '../db/db.js';
import { links } from '../db/schema.js';
import { scanFile, validateFile, type FileRejected } from '../files.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route, type Ctx } from '../http/route.js';
import { CSP_FILE } from '../http/security.js';
import { sha256hex } from '../security/crypto.js';
import type { Services } from '../services.js';

const IdParams = z.object({ id: Uuid });
const like = (q: string) => '%' + q.replace(/[\\%_]/g, '\\$&') + '%';

const DOC_SELECT = `SELECT d.id, d.title, d.description, d.category, d.refs, d.tags, d.classification, d.current_version, d.version,
  d.created_by, d.created_at, d.updated_by, d.updated_at, d.deleted_at, d.deleted_by,
  v.filename, v.mime, v.size, v.sha256, v.scan_status, v.uploaded_by, v.uploaded_at
  FROM documents d LEFT JOIN document_versions v ON v.document_id = d.id AND v.version = d.current_version`;

async function docById(svc: Services, id: string, c?: Client) {
  const r = await (c ?? svc.db.pool).query<z.infer<typeof DocumentOut>>(`${DOC_SELECT} WHERE d.id = $1`, [id]);
  return r.rows[0] ?? null;
}

/** Réception d'un fichier : en-tête X-File-Name, contrôles (type, signature, macros), analyse antivirale. */
async function receiveFile(ctx: Ctx<Buffer, unknown, unknown>) {
  const { req, svc, ip } = ctx;
  const s = ctx.s as Session;
  const raw = req.headers['x-file-name'];
  if (!raw) throw new HttpError(400, 'Nom de fichier manquant.');
  let name: string;
  try {
    name = decodeURIComponent(String(raw));
  } catch {
    throw new HttpError(400, 'Nom de fichier invalide.');
  }
  const buf = ctx.body;
  if (!Buffer.isBuffer(buf)) throw new HttpError(415, 'Contenu binaire attendu (application/octet-stream).');
  let info;
  try {
    info = validateFile(name, buf);
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
  let scan;
  try {
    scan = await scanFile(svc.cfg, buf);
  } catch (e) {
    await svc.db.audit(
      s.user,
      ip,
      (e as FileRejected).infected ? 'document.malware_blocked' : 'document.scan_unavailable',
      info.filename,
      {
        message: (e as Error).message,
      },
    );
    throw new HttpError(422, (e as Error).message);
  }
  return { ...info, buf, scan, sha: sha256hex(buf) };
}
type ReceivedFile = Awaited<ReturnType<typeof receiveFile>>;

async function insertVersion(
  svc: Services,
  c: Client,
  docId: string,
  version: number,
  f: ReceivedFile,
  user: string,
  comment: string,
) {
  const e = svc.vault.encrypt(f.buf, `doc:${docId}:${version}`);
  await c.query(
    `INSERT INTO document_versions(document_id, version, filename, mime, size, sha256, key_id, iv, auth_tag, content, scan_status, uploaded_by, comment)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [docId, version, f.filename, f.mime, f.buf.length, f.sha, e.keyId, e.iv, e.tag, e.content, f.scan, user, comment],
  );
}

function headerMeta(raw: unknown) {
  try {
    return DocumentMeta.parse(JSON.parse(decodeURIComponent(String(raw || '%7B%7D'))));
  } catch (e) {
    if (e instanceof z.ZodError) throw e;
    throw new HttpError(400, 'Métadonnées invalides.');
  }
}

async function download(ctx: Ctx<unknown, { v?: string; inline?: string }, { id: string }>) {
  const { svc, reply, ip, params, query } = ctx;
  const s = ctx.s as Session;
  const v = query.v && /^\d+$/.test(query.v) ? parseInt(query.v, 10) : null;
  const row = await svc.db.one<{
    version: number;
    filename: string;
    mime: string;
    sha256: string;
    key_id: string;
    iv: Buffer;
    auth_tag: Buffer;
    content: Buffer;
    deleted_at: Date | null;
  }>(
    `SELECT v.*, d.deleted_at FROM documents d JOIN document_versions v ON v.document_id=d.id
       AND v.version = COALESCE($2::int, d.current_version) WHERE d.id=$1`,
    [params.id, v],
  );
  if (!row || (row.deleted_at && !s.user.rights.can('documents', 'supprimer')))
    throw new HttpError(404, 'Document introuvable.');
  let plain: Buffer;
  try {
    plain = svc.vault.decrypt(
      { iv: row.iv, tag: row.auth_tag, content: row.content, keyId: row.key_id },
      `doc:${params.id}:${row.version}`,
    );
  } catch (e) {
    svc.log.error({ id: params.id, version: row.version, err: (e as Error).message }, 'document decrypt failed');
    throw new HttpError(500, 'Le document ne peut pas être déchiffré (clé maître différente ?).');
  }
  if (sha256hex(plain) !== row.sha256) throw new HttpError(500, "Échec du contrôle d'intégrité du document.");
  await svc.db.audit(s.user, ip, 'document.download', params.id, { version: row.version });
  const inline = query.inline === '1' && /^(application\/pdf|image\/(png|jpeg|gif)|text\/plain)$/.test(row.mime);
  const ascii = row.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  reply
    .header('Content-Security-Policy', CSP_FILE)
    .header('Content-Type', row.mime)
    .header('Cache-Control', 'private, no-store')
    .header(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    )
    .header('X-Document-SHA256', row.sha256);
  return reply.send(plain);
}
const DownloadQuery = z.object({ v: z.string().regex(/^\d+$/).optional(), inline: z.enum(['0', '1']).optional() });

const linkOut = (r: typeof links.$inferSelect) => ({
  id: r.id,
  title: r.title,
  url: r.url,
  description: r.description,
  category: r.category,
  refs: r.refs,
  tags: r.tags,
  version: r.version,
  created_by: r.createdBy,
  created_at: r.createdAt.toISOString(),
  updated_by: r.updatedBy,
  updated_at: r.updatedAt.toISOString(),
});

export const documentRoutes = [
  route({
    method: 'GET',
    url: '/api/documents',
    summary: 'Liste des documents (recherche, rattachement, catégorie, corbeille)',
    tags: ['Documents'],
    access: 'documents:lire',
    query: DocumentQuery,
    response: z.array(DocumentOut),
    handler: async ({ svc, s, query }) => {
      if (query.trash === '1' && !(s as Session).user.rights.can('documents', 'supprimer'))
        throw new HttpError(403, 'Droits insuffisants (lecture seule).');
      const where = [query.trash === '1' ? 'd.deleted_at IS NOT NULL' : 'd.deleted_at IS NULL'];
      const args: unknown[] = [];
      if (query.ref) {
        args.push(query.ref);
        where.push(`$${args.length} = ANY(d.refs)`);
      }
      if (query.category) {
        args.push(query.category);
        where.push(`d.category = $${args.length}`);
      }
      if (query.q) {
        args.push(like(query.q));
        const n = `$${args.length}`;
        where.push(
          `(d.title ILIKE ${n} OR d.description ILIKE ${n} OR v.filename ILIKE ${n} OR array_to_string(d.refs,' ') ILIKE ${n} OR array_to_string(d.tags,' ') ILIKE ${n})`,
        );
      }
      return (await svc.db.q(`${DOC_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.updated_at DESC LIMIT 1000`, args))
        .rows;
    },
  }),
  route({
    method: 'GET',
    url: '/api/documents/categories',
    summary: 'Catégories utilisées (documents et liens)',
    tags: ['Documents'],
    access: 'documents:lire',
    response: z.array(z.string()),
    handler: async ({ svc }) =>
      (
        await svc.db.q<{ category: string }>(
          `SELECT DISTINCT category FROM (SELECT category FROM documents WHERE deleted_at IS NULL
           UNION SELECT category FROM links WHERE deleted_at IS NULL) x WHERE category <> '' ORDER BY 1`,
        )
      ).rows.map((x) => x.category),
  }),
  route({
    method: 'POST',
    url: '/api/documents',
    summary: 'Dépôt d’un document (corps binaire, en-têtes X-File-Name et X-Meta)',
    tags: ['Documents'],
    access: 'documents:modifier',
    raw: true,
    bodyLimit: (c) => c.maxUploadMb * 1024 * 1024,
    status: 201,
    response: DocumentOut,
    handler: async (ctx) => {
      const { svc, req, ip, reply } = ctx;
      const s = ctx.s as Session;
      const meta = headerMeta(req.headers['x-meta']);
      const f = await receiveFile(ctx as unknown as Ctx<Buffer>);
      const by = s.user.username;
      const doc = await svc.db.tx(async (c) => {
        const d = (
          await c.query<{ id: string }>(
            `INSERT INTO documents(title, description, category, refs, tags, classification, current_version, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,1,$7,$7) RETURNING id`,
            [
              meta.title || f.filename.replace(/\.[^.]+$/, ''),
              meta.description || '',
              meta.category || '',
              meta.refs || [],
              meta.tags || [],
              meta.classification || 'interne',
              by,
            ],
          )
        ).rows[0]!;
        await insertVersion(svc, c, d.id, 1, f, by, '');
        return d;
      }, by);
      await svc.db.audit(s.user, ip, 'document.create', doc.id, {
        filename: f.filename,
        size: f.buf.length,
        sha256: f.sha,
        scan: f.scan,
      });
      const out = (await docById(svc, doc.id))!;
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'GET',
    url: '/api/documents/:id',
    summary: 'Fiche d’un document et ses versions (ETag = version)',
    tags: ['Documents'],
    access: 'documents:lire',
    params: IdParams,
    response: DocumentDetailOut,
    handler: async ({ svc, params, reply, s }) => {
      const d = await docById(svc, params.id);
      if (!d || (d.deleted_at && !(s as Session).user.rights.can('documents', 'supprimer')))
        throw new HttpError(404, 'Document introuvable.');
      const v = await svc.db.q(
        'SELECT version, filename, mime, size, sha256, scan_status, uploaded_by, uploaded_at, comment FROM document_versions WHERE document_id=$1 ORDER BY version DESC',
        [d.id],
      );
      setEtag(reply, d.version);
      return { ...d, versions: v.rows };
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/documents/:id',
    summary: 'Modification des métadonnées (If-Match obligatoire, 412 si le document a changé)',
    tags: ['Documents'],
    access: 'documents:modifier',
    params: IdParams,
    body: DocumentMeta,
    response: DocumentOut,
    handler: async ({ svc, req, reply, s, ip, params, body }) => {
      const expected = requireIfMatch(req);
      const keys = Object.keys(body) as (keyof typeof body)[];
      const sess = s as Session;
      const out = await svc.db.tx(async (c) => {
        const cur = await docById(svc, params.id, c);
        if (!cur || cur.deleted_at) throw new HttpError(404, 'Document introuvable.');
        if (cur.version !== expected) throw conflict(cur);
        if (!keys.length) return cur;
        const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
        const r = await c.query(
          `UPDATE documents SET ${sets}, version = version + 1, updated_by = $2, updated_at = now() WHERE id = $1 AND version = ${expected}`,
          [params.id, sess.user.username, ...keys.map((k) => body[k])],
        );
        if (!r.rowCount) throw conflict((await docById(svc, params.id, c))!);
        return (await docById(svc, params.id, c))!;
      }, sess.user.username);
      if (keys.length)
        await svc.db.audit(sess.user, ip, 'document.update', params.id, { fields: keys, version: out.version });
      setEtag(reply, out.version);
      return out;
    },
  }),
  route({
    method: 'POST',
    url: '/api/documents/:id/versions',
    summary: 'Nouvelle version d’un document (corps binaire, X-File-Name, X-Comment)',
    tags: ['Documents'],
    access: 'documents:modifier',
    params: IdParams,
    raw: true,
    bodyLimit: (c) => c.maxUploadMb * 1024 * 1024,
    status: 201,
    response: z.object({ version: z.number(), documentVersion: z.number() }),
    handler: async (ctx) => {
      const { svc, req, ip, params } = ctx;
      const s = ctx.s as Session;
      const f = await receiveFile(ctx as unknown as Ctx<Buffer>);
      let comment = '';
      try {
        comment = decodeURIComponent(String(req.headers['x-comment'] || ''))
          .trim()
          .slice(0, 500);
      } catch {
        /* commentaire ignoré s'il est mal encodé */
      }
      const r = await svc.db.tx(async (c) => {
        const d = (
          await c.query<{ current_version: number; deleted_at: Date | null }>(
            'SELECT current_version, deleted_at FROM documents WHERE id=$1 FOR UPDATE',
            [params.id],
          )
        ).rows[0];
        if (!d || d.deleted_at) throw new HttpError(404, 'Document introuvable.');
        const nv = d.current_version + 1;
        await insertVersion(svc, c, params.id, nv, f, s.user.username, comment);
        const u = await c.query<{ version: number }>(
          'UPDATE documents SET current_version=$2, version = version + 1, updated_by=$3, updated_at=now() WHERE id=$1 RETURNING version',
          [params.id, nv, s.user.username],
        );
        return { version: nv, documentVersion: u.rows[0]!.version };
      }, s.user.username);
      await svc.db.audit(s.user, ip, 'document.version', params.id, {
        version: r.version,
        filename: f.filename,
        sha256: f.sha,
        scan: f.scan,
      });
      return r;
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/documents/:id',
    summary: 'Mise à la corbeille (purge=1 : suppression définitive, permission documents:administrer)',
    tags: ['Documents'],
    access: 'documents:supprimer',
    params: IdParams,
    query: z.object({ purge: z.enum(['0', '1']).optional() }),
    handler: async ({ svc, s, ip, params, query }) => {
      const sess = s as Session;
      const purge = query.purge === '1';
      if (purge) svc.auth.requirePermission(sess, 'documents:administrer');
      const r = await svc.db.tx(async (c) => {
        if (purge) {
          // Une version de document citée comme preuve (fiche, lien, décision, validation d'occurrence) ne se purge pas :
          // l'historique des preuves est conservé.
          const usages = (
            await c.query<{ liens: number; fiches: number; decisions: number; validations: number }>(
              `SELECT (SELECT count(*)::int FROM grc_links WHERE source_ref LIKE $1 OR target_ref LIKE $1) liens,
                        (SELECT count(*)::int FROM grc_objects WHERE data::text LIKE $2) fiches,
                        (SELECT count(*)::int FROM pilotage_decisions WHERE refs::text LIKE $2 OR snapshot::text LIKE $2) decisions,
                        (SELECT count(*)::int FROM occurrence_validations WHERE proof_ref LIKE $1) validations`,
              [`document:${params.id}:%`, `%document:${params.id}:%`],
            )
          ).rows[0]!;
          const total = usages.liens + usages.fiches + usages.decisions + usages.validations;
          if (total)
            throw new HttpError(
              409,
              'Ce document est cité comme preuve (' +
                [
                  usages.fiches && `${usages.fiches} fiche(s)`,
                  usages.liens && `${usages.liens} lien(s)`,
                  usages.decisions && `${usages.decisions} décision(s)`,
                  usages.validations && `${usages.validations} validation(s)`,
                ]
                  .filter(Boolean)
                  .join(', ') +
                ') : il reste dans la corbeille, sa suppression définitive est refusée.',
              { reason: 'document_reference', usages },
            );
        }
        return purge
          ? c.query('DELETE FROM documents WHERE id=$1 AND deleted_at IS NOT NULL', [params.id])
          : c.query(
              'UPDATE documents SET deleted_at=now(), deleted_by=$2, version = version + 1 WHERE id=$1 AND deleted_at IS NULL',
              [params.id, sess.user.username],
            );
      }, sess.user.username);
      if (!r.rowCount)
        throw new HttpError(
          404,
          purge
            ? 'Seul un document déjà dans la corbeille peut être supprimé définitivement.'
            : 'Document introuvable.',
        );
      await svc.db.audit(sess.user, ip, purge ? 'document.purge' : 'document.delete', params.id);
      return undefined;
    },
  }),
  route({
    method: 'POST',
    url: '/api/documents/:id/restore',
    summary: 'Restauration depuis la corbeille',
    tags: ['Documents'],
    access: 'documents:supprimer',
    params: IdParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const r = await svc.db.tx(
        (c) =>
          c.query(
            'UPDATE documents SET deleted_at=NULL, deleted_by=NULL, version = version + 1, updated_by=$2, updated_at=now() WHERE id=$1 AND deleted_at IS NOT NULL',
            [params.id, sess.user.username],
          ),
        sess.user.username,
      );
      if (!r.rowCount) throw new HttpError(404, 'Document introuvable.');
      await svc.db.audit(sess.user, ip, 'document.restore', params.id);
      return undefined;
    },
  }),
  route({
    method: 'GET',
    url: '/api/documents/:id/download',
    summary: 'Téléchargement (déchiffrement, contrôle d’intégrité SHA-256)',
    tags: ['Documents'],
    access: 'documents:lire',
    params: IdParams,
    query: DownloadQuery,
    handler: download,
  }),
  route({
    method: 'GET',
    url: '/d/:id',
    summary: 'Lien interne vers un document (à coller dans l’outil de suivi)',
    tags: ['Documents'],
    access: 'documents:lire',
    params: IdParams,
    query: DownloadQuery,
    hidden: true,
    handler: download,
  }),

  /* ---------------------------------------------------------------- Liens */
  route({
    method: 'GET',
    url: '/api/links',
    summary: 'Liste des liens',
    tags: ['Liens'],
    access: 'documents:lire',
    query: DocumentQuery.omit({ trash: true }),
    response: z.array(LinkOut),
    handler: async ({ svc, query }) => {
      const conds: SQL[] = [isNull(links.deletedAt)];
      if (query.ref) conds.push(sql`${query.ref} = ANY(${links.refs})`);
      if (query.category) conds.push(eq(links.category, query.category));
      if (query.q) {
        const q = like(query.q);
        conds.push(
          sql`(${links.title} ILIKE ${q} OR ${links.url} ILIKE ${q} OR ${links.description} ILIKE ${q} OR array_to_string(${links.refs},' ') ILIKE ${q} OR array_to_string(${links.tags},' ') ILIKE ${q})`,
        );
      }
      const rows = await svc.db.orm
        .select()
        .from(links)
        .where(and(...conds))
        .orderBy(desc(links.updatedAt))
        .limit(1000);
      return rows.map(linkOut);
    },
  }),
  route({
    method: 'POST',
    url: '/api/links',
    summary: 'Ajout d’un lien',
    tags: ['Liens'],
    access: 'documents:modifier',
    body: LinkCreateBody,
    status: 201,
    response: LinkOut,
    handler: async ({ svc, s, ip, body, reply }) => {
      const by = (s as Session).user.username;
      const row = await svc.db.tx(async (_c, orm) => {
        const [r] = await orm
          .insert(links)
          .values({
            title: body.title || body.url,
            url: body.url,
            description: body.description ?? '',
            category: body.category ?? '',
            refs: body.refs ?? [],
            tags: body.tags ?? [],
            createdBy: by,
            updatedBy: by,
          })
          .returning();
        return r!;
      }, by);
      await svc.db.audit((s as Session).user, ip, 'link.create', row.id, { url: body.url });
      setEtag(reply, row.version);
      return linkOut(row);
    },
  }),
  route({
    method: 'PATCH',
    url: '/api/links/:id',
    summary: 'Modification d’un lien (If-Match obligatoire, 412 si le lien a changé)',
    tags: ['Liens'],
    access: 'documents:modifier',
    params: IdParams,
    body: LinkPatchBody,
    response: LinkOut,
    handler: async ({ svc, req, reply, s, ip, params, body }) => {
      const expected = requireIfMatch(req);
      const sess = s as Session;
      const fields = Object.keys(body);
      const row = await svc.db.tx(async (_c, orm) => {
        const [cur] = await orm
          .select()
          .from(links)
          .where(and(eq(links.id, params.id), isNull(links.deletedAt)));
        if (!cur) throw new HttpError(404, 'Lien introuvable.');
        if (cur.version !== expected) throw conflict(linkOut(cur));
        if (!fields.length) return cur;
        const [r] = await orm
          .update(links)
          .set({ ...body, version: sql`${links.version} + 1`, updatedBy: sess.user.username, updatedAt: sql`now()` })
          .where(and(eq(links.id, params.id), eq(links.version, expected)))
          .returning();
        return r!;
      }, sess.user.username);
      if (fields.length) await svc.db.audit(sess.user, ip, 'link.update', params.id, { fields, version: row.version });
      setEtag(reply, row.version);
      return linkOut(row);
    },
  }),
  route({
    method: 'DELETE',
    url: '/api/links/:id',
    summary: 'Suppression d’un lien',
    tags: ['Liens'],
    access: 'documents:supprimer',
    params: IdParams,
    handler: async ({ svc, s, ip, params }) => {
      const sess = s as Session;
      const r = await svc.db.tx(
        (c) =>
          c.query(
            'UPDATE links SET deleted_at=now(), deleted_by=$2, version = version + 1 WHERE id=$1 AND deleted_at IS NULL',
            [params.id, sess.user.username],
          ),
        sess.user.username,
      );
      if (!r.rowCount) throw new HttpError(404, 'Lien introuvable.');
      await svc.db.audit(sess.user, ip, 'link.delete', params.id);
      return undefined;
    },
  }),
];
