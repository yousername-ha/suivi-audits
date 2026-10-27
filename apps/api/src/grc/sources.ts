import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Module } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { Grc } from './core.js';
import { DEFAULT_SMSI } from './core.js';
export async function sources(g: Grc, smsi: string, user: SessionUser, search: string, cibles?: string[]) {
  await g.access(smsi, user);
  // Champ typé (lot U3) : seuls les types d'objets et les clés historiques demandés sont proposés.
  const typesObjets = cibles?.filter((x) => x.startsWith('object:')).map((x) => x.slice(7));
  const clesHistoriques = cibles?.filter((x) => x.startsWith('legacy:')).map((x) => x.slice(7));
  const modules = ['audit', 'ecarts', 'plan_audit', 'pilotage', 'conformite', 'documents', 'incidents'].filter((m) =>
    user.rights.can(m as Module, 'lire'),
  );
  const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
  // Un registre restreint illisible ne propose aucun de ses éléments comme référence.
  const masques = await g.registres.inaccessibles(user, smsi);
  // Listes vides : aucune ligne (module, type demandé) ou aucun registre masqué, comme = ANY / <> ALL d'un tableau vide.
  const objects: { ref: string; name: string; kind: string }[] = await g.db.k
    .selectFrom('grc_objects')
    .select([sql<string>`'object:' || id`.as('ref'), 'name', 'kind'])
    .where('smsi_id', '=', smsi)
    .where('archived', '=', false)
    .where(modules.length ? (eb) => eb('module', 'in', modules) : sql<boolean>`false`)
    .where('name', 'ilike', pattern)
    .$if(typesObjets != null, (q) =>
      q.where(typesObjets!.length ? (eb) => eb('kind', 'in', typesObjets!) : sql<boolean>`false`),
    )
    .$if(masques.length > 0, (q) =>
      q.where((eb) => eb.or([eb('registre_id', 'is', null), eb('registre_id', 'not in', masques)])),
    )
    .orderBy('name')
    .orderBy('id')
    .limit(100)
    .execute();
  // Versions de documents (preuves) : proposées sans filtre, ou quand le champ typé les autorise.
  if ((!cibles || cibles.includes('document')) && user.rights.can('documents', 'lire'))
    objects.push(
      ...(await g.db.k
        .selectFrom('documents as d')
        .innerJoin('document_versions as v', 'v.document_id', 'd.id')
        .select([
          sql<string>`'document:' || d.id || ':' || v.version`.as('ref'),
          sql<string>`d.title || ' · preuve v' || v.version`.as('name'),
          sql<string>`'evidence'`.as('kind'),
        ])
        .where('d.deleted_at', 'is', null)
        .where('d.title', 'ilike', pattern)
        .orderBy('d.title')
        .orderBy('v.version', 'desc')
        .limit(100)
        .execute()),
    );
  // Exigences publiées : proposées sans filtre, ou quand le champ typé les autorise (mesures d'un traitement).
  if (
    (!cibles || cibles.includes('requirement')) &&
    user.rights.can('audit', 'lire') &&
    user.rights.can('conformite', 'lire')
  ) {
    type Publication = {
      framework_id: string;
      version: number;
      definition: { requirements: { id: string; title: string }[] };
    };
    const publications = (await g.db.k
      .selectFrom('grc_framework_versions as v')
      .innerJoin('grc_objects as o', 'o.id', 'v.framework_id')
      .select(['v.framework_id', 'v.version', 'v.definition'])
      .distinctOn('v.framework_id')
      .where('v.smsi_id', '=', smsi)
      .where('o.archived', '=', false)
      .where(sql<string>`o.data->>'enabled'`, '=', 'true')
      .orderBy('v.framework_id')
      .orderBy('v.version', 'desc')
      .execute()) as Publication[];
    for (const p of publications)
      for (const r of p.definition.requirements)
        if ((r.title + ' ' + r.id).toLowerCase().includes(search.toLowerCase()) && objects.length < 300)
          objects.push({
            ref: `requirement:${p.framework_id}:${p.version}:${r.id}`,
            name: r.id + ' · ' + r.title,
            kind: 'requirement',
          });
    // Référentiels de la bibliothèque rattachés et actifs dans ce périmètre (ADR 0031).
    const effectifs = (await g.effectiveFrameworks(smsi)).filter((e) => e.enabled);
    const attached = effectifs.length
      ? ((await g.db.k
          .selectFrom('lib_framework_versions')
          .select(['framework_id', 'version', 'definition'])
          .where((eb) =>
            eb.or(
              effectifs.map((e) => eb.and([eb('framework_id', '=', e.frameworkId), eb('version', '=', e.version)])),
            ),
          )
          .execute()) as Publication[])
      : [];
    for (const p of attached)
      for (const r of p.definition.requirements)
        if ((r.title + ' ' + r.id).toLowerCase().includes(search.toLowerCase()) && objects.length < 300)
          objects.push({
            ref: `requirement:${p.framework_id}:${p.version}:${r.id}`,
            name: r.id + ' · ' + r.title,
            kind: 'requirement',
          });
  }
  if (smsi === DEFAULT_SMSI) {
    const state = await g.legacy.recompose();
    const allowed: Record<string, Module> = {
      items: 'audit',
      processes: 'pilotage',
      objectives: 'pilotage',
      indicators: 'pilotage',
      recurring: 'pilotage',
      incidents: 'incidents',
      frameworks: 'conformite',
      evidences: 'pilotage',
      plans: 'pilotage',
      suppliers: 'fournisseurs',
      interested: 'pilotage',
      swots: 'pilotage',
      roles: 'pilotage',
      reviews: 'pilotage',
      scope: 'pilotage',
    };
    for (const [key, module] of Object.entries(allowed)) {
      if (!user.rights.can(module, 'lire') || (clesHistoriques && !clesHistoriques.includes(key))) continue;
      const rows =
        key === 'scope' && isObject(state?.data.scope) ? [{ ...state.data.scope, id: 'instance' }] : state?.data[key];
      const entries: JsonObject[] = (Array.isArray(rows) ? (rows as unknown[]) : []).filter(isObject);
      for (const [index, row] of entries.entries()) {
        const id = typeof row.id === 'string' ? row.id : key === 'roles' ? '@' + index : null;
        if (!id) continue;
        const name = String(row.title ?? row.name ?? row.text ?? row.org ?? id);
        if (name.toLowerCase().includes(search.toLowerCase()) && objects.length < 400)
          objects.push({ ref: `legacy:${key}:${id}`, name, kind: key });
      }
    }
  }
  return { items: objects, truncated: objects.length >= 100 };
}
