/* État du suivi en lecture pour la nouvelle interface (recomposé depuis les tables, filtré selon les droits), modules
   repris et référentiels de rattachement. */
import { legacyKeyModule, RefOut, type Module, type Rights } from '@suivi/shared';
import { isObject, LEGACY_MODULES, type Json, type JsonObject } from '@suivi/shared/legacy';
import { z } from 'zod';
import type { Session } from '../auth.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import type { Services } from '../services.js';

/** Contrôle minimal d'un état legacy reçu de /legacy (identique à la v2). */
export const validLegacyState = (o: unknown): o is JsonObject =>
  isObject(o as Json) &&
  (o as JsonObject).v === 1 &&
  Array.isArray((o as JsonObject).items) &&
  Array.isArray((o as JsonObject).findings) &&
  Array.isArray((o as JsonObject).years);

async function legacyState(svc: Services) {
  const r = await svc.legacy.recompose();
  if (!r) throw new HttpError(404, 'Aucune donnée.');
  return r;
}

const emptyLike = (v: Json): Json =>
  Array.isArray(v)
    ? []
    : isObject(v)
      ? {}
      : typeof v === 'string'
        ? ''
        : typeof v === 'number'
          ? 0
          : typeof v === 'boolean'
            ? false
            : null;

/** État vu par un utilisateur : les modules qu'il ne peut pas lire sont remplacés par une valeur vide du même type. */
export function redactLegacy(data: JsonObject, rights: Rights): JsonObject {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      const m = legacyKeyModule(k);
      return [k, !m || rights.can(m, 'lire') ? v : emptyLike(v)];
    }),
  );
}

export const suiviRoutes = [
  route({
    method: ['GET', 'HEAD'],
    url: '/api/suivi/etat',
    summary: 'État du suivi (lecture seule, recomposé depuis les tables) filtré selon les droits ; ETag = version',
    tags: ['Suivi'],
    access: 'metier',
    handler: async ({ svc, s, reply }) => {
      const r = await legacyState(svc);
      reply
        .header('ETag', `"v${r.version}"`)
        .header('Cache-Control', 'no-store')
        .header('Content-Type', 'application/json; charset=utf-8');
      return reply.send(JSON.stringify(redactLegacy(r.data, (s as Session).user.rights)));
    },
  }),
  route({
    method: 'GET',
    url: '/api/suivi/modules',
    summary: 'Modules de l’outil de suivi et leur statut (repris dans la nouvelle interface, activés ou non)',
    tags: ['Suivi'],
    access: 'metier',
    handler: async ({ svc }) => {
      const taken = new Set(svc.legacy.takenOver());
      const disabled = (await svc.modules.state()).disabled;
      return LEGACY_MODULES.map((m) => ({
        ...m,
        takenOver: taken.has(m.key),
        enabled: !disabled.includes(legacyKeyModule(m.key) as Module),
      }));
    },
  }),
  route({
    method: 'GET',
    url: '/api/refs',
    summary: 'Référentiels pour les rattachements (mesures, écarts, processus, fournisseurs, objectifs)',
    tags: ['Documents'],
    access: 'metier',
    response: z.array(RefOut),
    handler: async ({ svc, s }) => {
      const r = await svc.legacy.recompose();
      const d = redactLegacy(r?.data ?? {}, (s as Session).user.rights) as Record<string, JsonObject[] | undefined>;
      const code = (it: JsonObject) =>
        it.ref === 'A' ? `A.${String(it.num)}` : it.ref === 'HDS' ? `HDS ${String(it.num)}` : String(it.num);
      const out: { ref: string; label: string; kind: string }[] = [];
      for (const it of d.items ?? [])
        out.push({
          ref: code(it),
          label: String(it.title ?? ''),
          kind: 'Mesure ' + (it.ref === 'A' ? 'Annexe A' : it.ref === 'HDS' ? 'HDS' : 'ISO 27001'),
        });
      for (const f of d.findings ?? [])
        out.push({
          ref: String(f.id),
          label: String(f.text ?? ''),
          kind: `Écart ${String(f.source ?? '')} ${String(f.year ?? '')}`.trim(),
        });
      for (const p of d.processes ?? [])
        out.push({ ref: String(p.id), label: String(p.name ?? ''), kind: 'Processus' });
      for (const s of d.suppliers ?? [])
        out.push({ ref: String(s.id), label: String(s.name ?? ''), kind: 'Fournisseur' });
      for (const o of d.objectives ?? [])
        if (o && o.id) out.push({ ref: String(o.id), label: String(o.name ?? o.title ?? ''), kind: 'Objectif' });
      return out;
    },
  }),
];
