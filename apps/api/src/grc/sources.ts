import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Module } from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { Grc } from './core.js';
import { DEFAULT_SMSI } from './core.js';
import { perimetreDe } from '../historique/registre.js';
/** Référence d'une mesure de la déclaration d'applicabilité : `A.8.13`, `HDS 12` ou le numéro de clause. */
const codeMesureSource = (m: JsonObject): string =>
  m.ref === 'A' ? `A.${String(m.num ?? '')}` : m.ref === 'HDS' ? `HDS ${String(m.num ?? '')}` : String(m.num ?? '');
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
    // Une exigence n'est proposée qu'une fois, qu'elle vienne de la publication ou de la copie du périmètre (BUG-060).
    const vues = new Set<string>();
    for (const p of publications)
      for (const r of p.definition.requirements)
        if (
          (r.title + ' ' + r.id).toLowerCase().includes(search.toLowerCase()) &&
          objects.length < 300 &&
          !vues.has(`${p.framework_id}:${p.version}:${r.id}`) &&
          vues.add(`${p.framework_id}:${p.version}:${r.id}`)
        )
          objects.push({
            ref: `requirement:${p.framework_id}:${p.version}:${r.id}`,
            name: r.id + ' · ' + r.title,
            kind: 'requirement',
          });
    // Référentiels appliqués et actifs dans ce périmètre (ADR 0031, ADR 0082) : exigences de la copie effective.
    const attached: Publication[] = [...(await g.copies.effectives(smsi)).values()].map((e) => ({
      framework_id: e.effectif.frameworkId,
      version: e.effectif.version,
      definition: e.definition,
    }));
    for (const p of attached)
      for (const r of p.definition.requirements)
        if (
          (r.title + ' ' + r.id).toLowerCase().includes(search.toLowerCase()) &&
          objects.length < 300 &&
          !vues.has(`${p.framework_id}:${p.version}:${r.id}`) &&
          vues.add(`${p.framework_id}:${p.version}:${r.id}`)
        )
          objects.push({
            ref: `requirement:${p.framework_id}:${p.version}:${r.id}`,
            name: r.id + ' · ' + r.title,
            kind: 'requirement',
          });
  }
  {
    // Mesures (liste commune, sur laquelle chaque périmètre décide dans sa DdA) ; processus, objectifs et indicateurs du périmètre
    // (ADR 0094) ; le reste de l'état historique relève du périmètre commun.
    const parPerimetre = ['processes', 'objectives', 'indicators'];
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
      if (smsi !== DEFAULT_SMSI && key !== 'items' && !parPerimetre.includes(key)) continue;
      // Sous un autre périmètre que le commun, ces listes longues (mesures, fiches de l'outil de suivi) ne sont proposées que sur
      // une recherche saisie : sans elle, elles noieraient les fiches du périmètre dans les sélecteurs (BUG-041, rejeu e2e).
      if (smsi !== DEFAULT_SMSI && !search.trim()) continue;
      const rows =
        key === 'scope' && isObject(state?.data.scope) ? [{ ...state.data.scope, id: 'instance' }] : state?.data[key];
      const entries: JsonObject[] = (Array.isArray(rows) ? (rows as unknown[]) : [])
        .filter(isObject)
        .filter((row) => !parPerimetre.includes(key) || perimetreDe(row) === smsi);
      for (const [index, row] of entries.entries()) {
        const id = typeof row.id === 'string' ? row.id : key === 'roles' ? '@' + index : null;
        if (!id) continue;
        const titre = String(row.title ?? row.name ?? row.text ?? row.org ?? id);
        // Une mesure se désigne par sa référence (A.8.13, HDS 12, 6.1…) avant son intitulé (BUG-060).
        const code = key === 'items' ? codeMesureSource(row) : '';
        const name = code && !titre.startsWith(code) ? `${code} · ${titre}` : titre;
        if (name.toLowerCase().includes(search.toLowerCase()) && objects.length < 400)
          objects.push({ ref: `legacy:${key}:${id}`, name, kind: key });
      }
    }
  }
  return { items: objects, truncated: objects.length >= 100 };
}
