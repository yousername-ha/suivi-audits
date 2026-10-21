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
  const objects = (
    await g.db.q<{ ref: string; name: string; kind: string }>(
      `SELECT 'object:'||id ref,name,kind FROM grc_objects WHERE smsi_id=$1 AND NOT archived AND module=ANY($2) AND name ILIKE $3 AND ($4::text[] IS NULL OR kind=ANY($4)) AND (registre_id IS NULL OR registre_id<>ALL($5::uuid[])) ORDER BY name,id LIMIT 100`,
      [smsi, modules, pattern, typesObjets ?? null, masques],
    )
  ).rows;
  // Versions de documents (preuves) : proposées sans filtre, ou quand le champ typé les autorise.
  if ((!cibles || cibles.includes('document')) && user.rights.can('documents', 'lire'))
    objects.push(
      ...(
        await g.db.q<{ ref: string; name: string; kind: string }>(
          `SELECT 'document:'||d.id||':'||v.version ref,d.title||' · preuve v'||v.version name,'evidence' kind FROM documents d JOIN document_versions v ON v.document_id=d.id WHERE d.deleted_at IS NULL AND d.title ILIKE $1 ORDER BY d.title,v.version DESC LIMIT 100`,
          [pattern],
        )
      ).rows,
    );
  // Exigences publiées : proposées sans filtre, ou quand le champ typé les autorise (mesures d'un traitement).
  if (
    (!cibles || cibles.includes('requirement')) &&
    user.rights.can('audit', 'lire') &&
    user.rights.can('conformite', 'lire')
  ) {
    const publications = (
      await g.db.q<{
        framework_id: string;
        version: number;
        definition: { requirements: { id: string; title: string }[] };
      }>(
        `SELECT DISTINCT ON(v.framework_id) v.framework_id,v.version,v.definition FROM grc_framework_versions v JOIN grc_objects o ON o.id=v.framework_id WHERE v.smsi_id=$1 AND NOT o.archived AND o.data->>'enabled'='true' ORDER BY v.framework_id,v.version DESC`,
        [smsi],
      )
    ).rows;
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
      ? (
          await g.db.q<{
            framework_id: string;
            version: number;
            definition: { requirements: { id: string; title: string }[] };
          }>(
            `SELECT v.framework_id,v.version,v.definition FROM lib_framework_versions v
               JOIN unnest($1::uuid[],$2::int[]) AS e(id,version) ON e.id=v.framework_id AND e.version=v.version`,
            [effectifs.map((e) => e.frameworkId), effectifs.map((e) => e.version)],
          )
        ).rows
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
