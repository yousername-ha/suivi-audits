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
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import type { Links } from '../db/types.generated.js';
import { scanFile, validateFile, type FileRejected } from '../files.js';
import { conflict, requireIfMatch, setEtag } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { route, type Ctx } from '../http/route.js';
import { totalUsages, usagesPreuve } from '../documents-usage.js';
import { CSP_FILE } from '../http/security.js';
import { sha256hex } from '../security/crypto.js';
import type { Services } from '../services.js';

const IdParams = z.object({ id: Uuid });
const like = (q: string) => '%' + q.replace(/[\\%_]/g, '\\$&') + '%';

/** Document avec sa version courante (fichier, empreinte, analyse antivirale). */
const documents = (k: Kdb) =>
  k
    .selectFrom('documents as d')
    .leftJoin('document_versions as v', (j) =>
      j.onRef('v.document_id', '=', 'd.id').onRef('v.version', '=', 'd.current_version'),
    )
    .select([
      'd.id',
      'd.title',
      'd.description',
      'd.category',
      'd.refs',
      'd.tags',
      'd.classification',
      'd.current_version',
      'd.version',
      'd.created_by',
      'd.created_at',
      'd.updated_by',
      'd.updated_at',
      'd.deleted_at',
      'd.deleted_by',
      'v.filename',
      'v.mime',
      'v.size',
      'v.sha256',
      'v.scan_status',
      'v.uploaded_by',
      'v.uploaded_at',
    ]);
type DocumentLigne = z.infer<typeof DocumentOut>;

async function docById(svc: Services, id: string, c?: Client): Promise<DocumentLigne | null> {
  // Dates relues telles quelles (sérialisées en ISO par la réponse), comme avant la conversion.
  const r = await documents(c ? surConnexion(c) : svc.db.k)
    .where('d.id', '=', id)
    .executeTakeFirst();
  return (r as unknown as DocumentLigne | undefined) ?? null;
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
    scan = await scanFile(svc.cfg, buf, {
      surEchec: () => void svc.alertesSecurite.antivirus(svc.cfg.clamav?.required ?? true),
    });
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
  await surConnexion(c)
    .insertInto('document_versions')
    .values({
      document_id: docId,
      version,
      filename: f.filename,
      mime: f.mime,
      size: f.buf.length,
      sha256: f.sha,
      key_id: e.keyId,
      iv: e.iv,
      auth_tag: e.tag,
      content: e.content,
      scan_status: f.scan,
      uploaded_by: user,
      comment,
    })
    .execute();
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
  // Version demandée, sinon la version courante.
  const row = await svc.db.k
    .selectFrom('documents as d')
    .innerJoin('document_versions as v', (j) =>
      j
        .onRef('v.document_id', '=', 'd.id')
        .on('v.version', '=', v !== null ? sql<number>`${v}::int` : sql<number>`d.current_version`),
    )
    .selectAll('v')
    .select('d.deleted_at')
    .where('d.id', '=', params.id)
    .executeTakeFirst();
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

type LinkRow = Selectable<Links>;
const linkOut = (r: LinkRow) => ({
  id: r.id,
  title: r.title,
  url: r.url,
  description: r.description,
  category: r.category,
  refs: r.refs,
  tags: r.tags,
  version: r.version,
  created_by: r.created_by,
  created_at: r.created_at.toISOString(),
  updated_by: r.updated_by,
  updated_at: r.updated_at.toISOString(),
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
      const motif = query.q ? like(query.q) : '';
      return (await documents(svc.db.k)
        .where('d.deleted_at', query.trash === '1' ? 'is not' : 'is', null)
        .$if(!!query.ref, (q) => q.where(sql<boolean>`${query.ref} = ANY(d.refs)`))
        .$if(!!query.category, (q) => q.where('d.category', '=', query.category!))
        .$if(!!query.q, (q) =>
          q.where((eb) =>
            eb.or([
              eb('d.title', 'ilike', motif),
              eb('d.description', 'ilike', motif),
              eb('v.filename', 'ilike', motif),
              eb(sql<string>`array_to_string(d.refs, ' ')`, 'ilike', motif),
              eb(sql<string>`array_to_string(d.tags, ' ')`, 'ilike', motif),
            ]),
          ),
        )
        .orderBy('d.updated_at', 'desc')
        .limit(1000)
        .execute()) as unknown as DocumentLigne[];
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
        await svc.db.k
          .selectFrom((eb) =>
            eb
              .selectFrom('documents')
              .select('category')
              .where('deleted_at', 'is', null)
              .union(eb.selectFrom('links').select('category').where('deleted_at', 'is', null))
              .as('x'),
          )
          .select('x.category')
          .distinct()
          .where('x.category', '<>', '')
          .orderBy('x.category')
          .execute()
      ).map((x) => x.category),
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
      const doc = await svc.db.tx(async (c, k) => {
        const d = await k
          .insertInto('documents')
          .values({
            title: meta.title || f.filename.replace(/\.[^.]+$/, ''),
            description: meta.description || '',
            category: meta.category || '',
            refs: meta.refs || [],
            tags: meta.tags || [],
            classification: meta.classification || 'interne',
            current_version: 1,
            created_by: by,
            updated_by: by,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
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
      const v = await svc.db.k
        .selectFrom('document_versions')
        .select([
          'version',
          'filename',
          'mime',
          'size',
          'sha256',
          'scan_status',
          'uploaded_by',
          'uploaded_at',
          'comment',
        ])
        .where('document_id', '=', d.id)
        .orderBy('version', 'desc')
        .execute();
      setEtag(reply, d.version);
      return { ...d, versions: v } as unknown as z.infer<typeof DocumentDetailOut>;
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
      const out = await svc.db.tx(async (c, k) => {
        const cur = await docById(svc, params.id, c);
        if (!cur || cur.deleted_at) throw new HttpError(404, 'Document introuvable.');
        if (cur.version !== expected) throw conflict(cur);
        if (!keys.length) return cur;
        // Champs modifiables : ceux du schéma DocumentMeta (liste fermée), typés par la base ; version attendue liée.
        const r = await k
          .updateTable('documents')
          .set((eb) => ({
            ...body,
            version: eb('version', '+', 1),
            updated_by: sess.user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', params.id)
          .where('version', '=', expected)
          .executeTakeFirst();
        if (!Number(r.numUpdatedRows)) throw conflict((await docById(svc, params.id, c))!);
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
      const r = await svc.db.tx(async (c, k) => {
        const d = await k
          .selectFrom('documents')
          .select(['current_version', 'deleted_at'])
          .where('id', '=', params.id)
          .forUpdate()
          .executeTakeFirst();
        if (!d || d.deleted_at) throw new HttpError(404, 'Document introuvable.');
        const nv = d.current_version + 1;
        await insertVersion(svc, c, params.id, nv, f, s.user.username, comment);
        const u = await k
          .updateTable('documents')
          .set((eb) => ({
            current_version: nv,
            version: eb('version', '+', 1),
            updated_by: s.user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', params.id)
          .returning('version')
          .executeTakeFirstOrThrow();
        return { version: nv, documentVersion: u.version };
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
      const r = await svc.db.tx(async (c, k) => {
        if (purge) {
          // Une version de document citée comme preuve (fiche, lien, décision, validation d'occurrence) ne se purge pas :
          // l'historique des preuves est conservé.
          const usages = await usagesPreuve(c, params.id);
          const total = totalUsages(usages);
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
          ? Number(
              (
                await k
                  .deleteFrom('documents')
                  .where('id', '=', params.id)
                  .where('deleted_at', 'is not', null)
                  .executeTakeFirst()
              ).numDeletedRows,
            )
          : Number(
              (
                await k
                  .updateTable('documents')
                  .set((eb) => ({
                    deleted_at: sql<Date>`now()`,
                    deleted_by: sess.user.username,
                    version: eb('version', '+', 1),
                  }))
                  .where('id', '=', params.id)
                  .where('deleted_at', 'is', null)
                  .executeTakeFirst()
              ).numUpdatedRows,
            );
      }, sess.user.username);
      if (!r)
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
        (_c, k) =>
          k
            .updateTable('documents')
            .set((eb) => ({
              deleted_at: null,
              deleted_by: null,
              version: eb('version', '+', 1),
              updated_by: sess.user.username,
              updated_at: sql<Date>`now()`,
            }))
            .where('id', '=', params.id)
            .where('deleted_at', 'is not', null)
            .executeTakeFirst(),
        sess.user.username,
      );
      if (!Number(r.numUpdatedRows)) throw new HttpError(404, 'Document introuvable.');
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
      let req = svc.db.k.selectFrom('links').selectAll().where('deleted_at', 'is', null);
      if (query.ref) req = req.where(sql<boolean>`${query.ref} = ANY(refs)`);
      if (query.category) req = req.where('category', '=', query.category);
      if (query.q) {
        const q = like(query.q);
        req = req.where(({ eb, or }) =>
          or([
            eb('title', 'ilike', q),
            eb('url', 'ilike', q),
            eb('description', 'ilike', q),
            eb(sql<string>`array_to_string(refs, ' ')`, 'ilike', q),
            eb(sql<string>`array_to_string(tags, ' ')`, 'ilike', q),
          ]),
        );
      }
      const rows = await req.orderBy('updated_at', 'desc').limit(1000).execute();
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
      const row = await svc.db.tx(
        (_c, k) =>
          k
            .insertInto('links')
            .values({
              title: body.title || body.url,
              url: body.url,
              description: body.description ?? '',
              category: body.category ?? '',
              refs: body.refs ?? [],
              tags: body.tags ?? [],
              created_by: by,
              updated_by: by,
            })
            .returningAll()
            .executeTakeFirstOrThrow(),
        by,
      );
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
      const row = await svc.db.tx(async (_c, k) => {
        const cur = await k
          .selectFrom('links')
          .selectAll()
          .where('id', '=', params.id)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();
        if (!cur) throw new HttpError(404, 'Lien introuvable.');
        if (cur.version !== expected) throw conflict(linkOut(cur));
        if (!fields.length) return cur;
        return k
          .updateTable('links')
          .set((eb) => ({
            ...body,
            version: eb('version', '+', 1),
            updated_by: sess.user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', params.id)
          .where('version', '=', expected)
          .returningAll()
          .executeTakeFirstOrThrow();
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
        (_c, k) =>
          k
            .updateTable('links')
            .set((eb) => ({
              deleted_at: sql<Date>`now()`,
              deleted_by: sess.user.username,
              version: eb('version', '+', 1),
            }))
            .where('id', '=', params.id)
            .where('deleted_at', 'is', null)
            .executeTakeFirst(),
        sess.user.username,
      );
      if (!Number(r.numUpdatedRows)) throw new HttpError(404, 'Lien introuvable.');
      await svc.db.audit(sess.user, ip, 'link.delete', params.id);
      return undefined;
    },
  }),
];
