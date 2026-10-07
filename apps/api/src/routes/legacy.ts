/* Outil historique servi sous /legacy pendant la migration progressive, et son état. */
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { RefOut } from '@suivi/shared';
import { isObject, LEGACY_MODULES, moduleLabel, type Json, type JsonObject } from '@suivi/shared/legacy';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { APP_ROOT } from '../config.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { CSP_LEGACY } from '../http/security.js';
import type { Services } from '../services.js';

/** Contrôle minimal d'un état legacy reçu de /legacy (identique à la v2). */
export const validLegacyState = (o: unknown): o is JsonObject =>
  isObject(o as Json) && (o as JsonObject).v === 1 && Array.isArray((o as JsonObject).items) && Array.isArray((o as JsonObject).findings) && Array.isArray((o as JsonObject).years);

const SHIM_FILE = path.join(APP_ROOT, 'legacy-shim', 'shim.js');
let INDEX_CACHE: { dir: string; html: string } | null = null;

/** Adapte le fichier unique historique : bibliothèques locales, pas de police externe, intégration (shim). */
export function buildLegacyIndex(dir: string): string {
  if (INDEX_CACHE?.dir === dir) return INDEX_CACHE.html;
  let h = readFileSync(path.join(dir, 'index.html'), 'utf8');
  h = h.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
  h = h.replace(/<script([^>]*)src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[^"]*\/xlsx\.full\.min\.js"/, '<script$1src="lib/xlsx.full.min.js"');
  h = h.replace("const LIB_MODE='cdn';", "const LIB_MODE='local';");
  const tag = '\n<!--SUIVI-CFG--><script src="shim.js"></script>';
  h = /<meta charset="utf-8">/i.test(h) ? h.replace(/<meta charset="utf-8">/i, (m) => m + tag) : h.replace(/<head>/i, (m) => m + tag);
  INDEX_CACHE = { dir, html: h };
  return h;
}

async function legacyState(svc: Services) {
  const r = await svc.legacy.recompose();
  if (!r) throw new HttpError(404, 'Aucune donnée.');
  return r;
}

const LIB_TYPES: Record<string, string> = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json' };

export const legacyRoutes = [
  route({
    method: ['GET', 'HEAD'],
    url: '/api/legacy/state',
    summary: 'État de l’outil historique (recomposé : app_state + modules repris) ; ETag = version',
    tags: ['Outil historique'],
    access: 'any',
    handler: async ({ svc, reply }) => {
      const r = await legacyState(svc);
      reply.header('ETag', `"v${r.version}"`).header('Cache-Control', 'no-store').header('Content-Type', 'application/json; charset=utf-8');
      return reply.send(JSON.stringify(r.data));
    },
  }),
  route({
    method: ['GET', 'HEAD'],
    url: '/legacy/data/state.json',
    summary: 'État (chemin relatif utilisé par le fichier historique)',
    tags: ['Outil historique'],
    access: 'any',
    hidden: true,
    handler: async ({ svc, reply }) => {
      const r = await legacyState(svc);
      reply.header('ETag', `"v${r.version}"`).header('Cache-Control', 'no-store').header('Content-Type', 'application/json; charset=utf-8');
      return reply.send(JSON.stringify(r.data));
    },
  }),
  route({
    method: 'PUT',
    url: '/api/legacy/state',
    summary: 'Enregistrement depuis /legacy (If-Match "vN" ; refusé sur les modules repris)',
    tags: ['Outil historique'],
    access: 'rw',
    bodyLimit: (c) => c.maxStateMb * 1024 * 1024,
    body: z.custom<JsonObject>(validLegacyState, 'Structure de données inattendue.'),
    handler: async ({ svc, s, ip, req, reply, body }) => {
      const sess = s as Session;
      const m = /^"v(\d+)"$/.exec(String(req.headers['if-match'] || ''));
      const expected = m ? parseInt(m[1] as string, 10) : null;
      const r = await svc.db.tx((c) => svc.legacy.legacyWrite(c, body, sess.user, expected), sess.user.username);
      if (r.conflict) {
        reply.code(412);
        return { error: 'conflict', by: r.by, at: r.at, version: r.version };
      }
      await svc.db.audit(sess.user, ip, 'state.write', `v${r.version}`, {
        sha256: r.sha256,
        forced: expected == null,
        items: (body.items as Json[]).length,
        findings: (body.findings as Json[]).length,
      });
      reply.header('ETag', `"v${r.version}"`);
      return undefined;
    },
  }),
  route({
    method: 'GET',
    url: '/api/legacy/modules',
    summary: 'Modules de l’outil historique et leur statut (repris dans la nouvelle interface ou non)',
    tags: ['Outil historique'],
    access: 'any',
    handler: async ({ svc }) => {
      const taken = new Set(svc.legacy.takenOver());
      return LEGACY_MODULES.map((m) => ({ ...m, takenOver: taken.has(m.key) }));
    },
  }),
  route({
    method: 'GET',
    url: '/api/refs',
    summary: 'Référentiels pour les rattachements (mesures, écarts, processus, fournisseurs, objectifs)',
    tags: ['Documents'],
    access: 'any',
    response: z.array(RefOut),
    handler: async ({ svc }) => {
      const r = await svc.legacy.recompose();
      const d = (r?.data ?? {}) as Record<string, JsonObject[] | undefined>;
      const code = (it: JsonObject) => (it.ref === 'A' ? `A.${String(it.num)}` : it.ref === 'HDS' ? `HDS ${String(it.num)}` : String(it.num));
      const out: { ref: string; label: string; kind: string }[] = [];
      for (const it of d.items ?? [])
        out.push({ ref: code(it), label: String(it.title ?? ''), kind: 'Mesure ' + (it.ref === 'A' ? 'Annexe A' : it.ref === 'HDS' ? 'HDS' : 'ISO 27001') });
      for (const f of d.findings ?? []) out.push({ ref: String(f.id), label: String(f.text ?? ''), kind: `Écart ${String(f.source ?? '')} ${String(f.year ?? '')}`.trim() });
      for (const p of d.processes ?? []) out.push({ ref: String(p.id), label: String(p.name ?? ''), kind: 'Processus' });
      for (const s of d.suppliers ?? []) out.push({ ref: String(s.id), label: String(s.name ?? ''), kind: 'Fournisseur' });
      for (const o of d.objectives ?? []) if (o && o.id) out.push({ ref: String(o.id), label: String(o.name ?? o.title ?? ''), kind: 'Objectif' });
      return out;
    },
  }),

  /* ---------------------------------------------------------------- Pages de l'outil historique */
  route({
    method: 'GET',
    url: '/legacy',
    summary: 'Redirection vers /legacy/',
    tags: ['Outil historique'],
    access: 'public',
    hidden: true,
    handler: async ({ reply }) => reply.redirect('/legacy/', 302),
  }),
  route({
    method: 'GET',
    url: '/legacy/',
    summary: 'Outil historique (fichier unique adapté)',
    tags: ['Outil historique'],
    access: 'public',
    hidden: true,
    handler: async ({ svc, s, req, reply }) => {
      if (svc.auth.stage(s) !== 'ok') return reply.redirect('/login?next=' + encodeURIComponent('/legacy/'), 302);
      const sess = s as Session;
      const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
      if (sess.user.role === 'ro' && !/(^|&)lecture\b/.test(search)) return reply.redirect('/legacy/?lecture', 302);
      const cfgJs = JSON.stringify({
        user: sess.user.username,
        name: sess.user.displayName,
        role: sess.user.role,
        csrf: sess.csrf,
        takenOver: svc.legacy.takenOver().map((k) => ({ key: k, label: moduleLabel(k) })),
      }).replace(/</g, '\\u003c');
      const html = buildLegacyIndex(svc.cfg.legacyDir).replace('<!--SUIVI-CFG-->', `<script>window.__SUIVI=${cfgJs};</script>`);
      reply.header('Content-Security-Policy', CSP_LEGACY).header('Cache-Control', 'no-store').header('Content-Type', 'text/html; charset=utf-8');
      return reply.send(html);
    },
  }),
  route({
    method: 'GET',
    url: '/legacy/index.html',
    summary: 'Outil historique',
    tags: ['Outil historique'],
    access: 'public',
    hidden: true,
    handler: async ({ reply }) => reply.redirect('/legacy/', 302),
  }),
  route({
    method: 'GET',
    url: '/legacy/shim.js',
    summary: 'Intégration de l’outil historique au serveur',
    tags: ['Outil historique'],
    access: 'public',
    hidden: true,
    handler: async ({ reply }) => {
      reply.header('Content-Type', 'text/javascript; charset=utf-8').header('Cache-Control', 'no-cache');
      return reply.send(await readFile(SHIM_FILE));
    },
  }),
  route({
    method: 'GET',
    url: '/legacy/lib/:file',
    summary: 'Bibliothèques locales de l’outil historique',
    tags: ['Outil historique'],
    access: 'public',
    hidden: true,
    params: z.object({ file: z.string().regex(/^[A-Za-z0-9._-]+$/) }),
    handler: async ({ svc, params, reply }) => {
      const base = path.join(svc.cfg.legacyDir, 'lib');
      const file = path.normalize(path.join(base, params.file));
      if (!file.startsWith(base + path.sep)) throw new HttpError(404, 'Introuvable.');
      try {
        if (!(await stat(file)).isFile()) throw new Error('not a file');
      } catch {
        throw new HttpError(404, 'Introuvable.');
      }
      reply.header('Content-Type', LIB_TYPES[path.extname(file)] || 'application/octet-stream').header('Cache-Control', 'public, max-age=3600');
      return reply.send(await readFile(file));
    },
  }),
];
