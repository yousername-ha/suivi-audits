import crypto from 'node:crypto';
import {
  GRC_MODULES,
  grcReferences,
  RiskMethod,
  RiskRatings,
  evaluateMethod,
  validDate,
  type CfgRef,
  type RiskData,
} from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import { sql } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { hash, objectDto, type ObjectRow, type Grc } from './core.js';
export interface MethodVersion {
  id: string;
  methodId: string;
  version: number;
  definition: RiskMethod;
  createdBy: string;
  createdAt: Date;
  reason: string;
}
/* Accès aux données en Kysely (ADR 0062), sauf la projection à une date passée (deux requêtes, SQL paramétré, voir
   projection()). */
const methodes = (k: Kdb) =>
  k
    .selectFrom('grc_method_versions')
    .select([
      'id',
      'method_id as methodId',
      'version',
      'definition',
      'reason',
      'created_by as createdBy',
      'created_at as createdAt',
    ]);
// La définition n'est écrite que par publishMethod(), après validation (RiskMethod) : relue telle quelle.
const versMethode = (r: Omit<MethodVersion, 'definition'> & { definition: unknown }): MethodVersion => ({
  ...r,
  definition: r.definition as RiskMethod,
});
export class GrcRisks {
  constructor(private readonly g: Grc) {}
  async methods(smsi: string, user: SessionUser) {
    await this.g.access(smsi, user);
    await this.g.permission(user, 'pilotage', 'lire');
    const rows = await methodes(this.g.db.k)
      .distinctOn('method_id')
      .where('smsi_id', '=', smsi)
      .orderBy('method_id')
      .orderBy('version', 'desc')
      .execute();
    return rows.map(versMethode);
  }
  async method(smsi: string, id: string, version: number, user: SessionUser, c?: Client) {
    await this.g.access(smsi, user, false, c);
    await this.g.permission(user, 'pilotage', 'lire');
    const r = await methodes(c ? surConnexion(c) : this.g.db.k)
      .where('smsi_id', '=', smsi)
      .where('method_id', '=', id)
      .where('version', '=', version)
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Version de méthode introuvable.');
    return versMethode(r);
  }
  async methodHistory(smsi: string, id: string, user: SessionUser) {
    await this.g.access(smsi, user);
    await this.g.permission(user, 'pilotage', 'lire');
    const rows = await methodes(this.g.db.k)
      .where('smsi_id', '=', smsi)
      .where('method_id', '=', id)
      .orderBy('version', 'desc')
      .limit(100)
      .execute();
    return rows.map(versMethode);
  }
  /** Définition à publier : épinglages résolus sur le catalogue de configuration, ou définition inchangée sans épinglage. */
  private async resolved(smsi: string, definition: RiskMethod, current: MethodVersion | null | undefined, c?: Client) {
    const resolver = this.g.methodBindings;
    if (!definition.bindings) return { definition, refs: [] as CfgRef[] };
    if (!resolver) throw new HttpError(503, 'Catalogue de configuration indisponible.');
    return resolver.resolveMethod(smsi, definition, c, resolver.pinnedRefs(current?.definition));
  }
  async previewMethod(smsi: string, id: string | null, input: unknown, user: SessionUser) {
    await this.g.access(smsi, user, true);
    await this.g.permission(user, 'pilotage', 'administrer');
    const parsed = RiskMethod.parse(input);
    const current = id ? (await this.methods(smsi, user)).find((m) => m.methodId === id) : null;
    if (id && !current) throw new HttpError(404, 'Méthode introuvable.');
    const version = current?.version ?? 0;
    const { definition, refs } = await this.resolved(smsi, parsed, current);
    return { definition, version, pinned: refs, previewId: hash({ smsi, id, version, definition }) };
  }
  async publishMethod(
    smsi: string,
    id: string | null,
    input: unknown,
    expected: number,
    previewId: string,
    reason: string,
    user: SessionUser,
    ip: string,
  ) {
    const p = await this.previewMethod(smsi, id, input, user);
    if (p.version !== expected) throw new HttpError(412, 'Version obsolète.');
    if (previewId !== p.previewId) throw new HttpError(422, 'Simulation différente du contenu publié.');
    return this.g.db.tx(async (c, k) => {
      await k.selectFrom('grc_smsis').select('id').where('id', '=', smsi).forUpdate().execute();
      await this.g.access(smsi, user, true, c);
      const methodId = id ?? crypto.randomUUID();
      const current =
        (
          await k
            .selectFrom('grc_method_versions')
            .select(sql<number | null>`max(version)::int`.as('version'))
            .where('smsi_id', '=', smsi)
            .where('method_id', '=', methodId)
            .executeTakeFirst()
        )?.version ?? 0;
      if (current !== expected) throw new HttpError(412, 'Publication concurrente.');
      // Les éléments épinglés sont relus dans la transaction : un archivage survenu depuis l'aperçu est pris en compte.
      const lue = current
        ? await methodes(k)
            .where('smsi_id', '=', smsi)
            .where('method_id', '=', methodId)
            .where('version', '=', current)
            .executeTakeFirst()
        : null;
      const previous = lue ? versMethode(lue) : null;
      const fresh = await this.resolved(smsi, RiskMethod.parse(input), previous, c);
      if (hash({ smsi, id, version: current, definition: fresh.definition }) !== previewId)
        throw new HttpError(422, 'Simulation différente du contenu publié.');
      const row = versMethode(
        await k
          .insertInto('grc_method_versions')
          .values({
            smsi_id: smsi,
            method_id: methodId,
            version: current + 1,
            definition: JSON.stringify(fresh.definition),
            reason,
            created_by: user.username,
          })
          .returning([
            'id',
            'method_id as methodId',
            'version',
            'definition',
            'reason',
            'created_by as createdBy',
            'created_at as createdAt',
          ])
          .executeTakeFirstOrThrow(),
      );
      if (fresh.refs.length)
        await this.g.methodBindings!.recordUsage(
          c,
          user,
          { kind: 'method_version', id: row.id, version: row.version },
          fresh.refs,
        );
      await this.g.db.audit(
        user,
        ip,
        'grc.method.published',
        methodId,
        { smsiId: smsi, version: row.version, previewId, pinned: fresh.refs.length },
        c,
      );
      await this.g.notify(c, methodId, row.version, smsi, 'pilotage', user.username);
      return row;
    }, user.username);
  }
  validateStages(method: RiskMethod, stages: RiskData['stages']) {
    for (const [id, s] of Object.entries(stages)) {
      const step = method.stages.find((x) => x.id === id);
      if (!step) throw new HttpError(422, 'Étape inconnue.');
      if (s.status !== 'draft' && step.requires.some((r) => stages[r]?.status !== 'validated'))
        throw new HttpError(409, 'Validez les étapes préalables avant cette étape.');
      for (const [key, v] of Object.entries(s.values)) {
        const f = method.fields.find((x) => x.id === key && x.stage === id);
        if (!f) throw new HttpError(422, 'Champ inconnu de cette étape.');
        const valid =
          f.type === 'number'
            ? typeof v === 'number' && Number.isFinite(v)
            : f.type === 'boolean'
              ? typeof v === 'boolean'
              : f.type === 'references'
                ? Array.isArray(v)
                : typeof v === 'string' &&
                  (f.type !== 'choice' || f.options.some((o) => o.id === v)) &&
                  (f.type !== 'date' || validDate(v));
        if (!valid) throw new HttpError(422, 'Valeur incompatible avec le champ ' + f.label);
      }
      if (
        s.status !== 'draft' &&
        method.fields.some(
          (f) =>
            f.stage === id &&
            f.required &&
            (s.values[f.id] === undefined ||
              s.values[f.id] === '' ||
              (Array.isArray(s.values[f.id]) && (s.values[f.id] as unknown[]).length === 0)),
        )
      )
        throw new HttpError(422, 'Complétez les champs obligatoires avant de valider.');
    }
  }
  async history(smsi: string, id: string, user: SessionUser, before = 2147483647) {
    const o = await this.g.object(smsi, id, user);
    if (o.kind !== 'risk') throw new HttpError(422, 'Risque attendu.');
    return this.g.db.k
      .selectFrom('grc_risk_evaluations as e')
      .innerJoin('grc_method_versions as m', 'm.id', 'e.method_version_id')
      .selectAll('e')
      .select('m.definition as method')
      .where('e.risk_id', '=', id)
      .where('e.revision', '<', before)
      .orderBy('e.revision', 'desc')
      .limit(50)
      .execute();
  }
  async preview(
    smsi: string,
    id: string,
    ratings: unknown,
    rationale: string,
    decision: string,
    user: SessionUser,
    c?: Client,
  ) {
    const risk = await this.g.object(smsi, id, user, true, c);
    if (risk.kind !== 'risk' || risk.archived) throw new HttpError(422, 'Risque actif attendu.');
    const data = risk.data as RiskData;
    const method = await this.method(smsi, data.methodId, data.methodVersion, user, c);
    const parsed = RiskRatings.parse(ratings);
    let result;
    try {
      result = {
        gross: evaluateMethod(method.definition, parsed.gross),
        residual: evaluateMethod(method.definition, parsed.residual),
      };
    } catch (e) {
      throw new HttpError(422, (e as Error).message);
    }
    if (method.definition.reevaluation.requireApproval && decision === 'approved') {
      await this.g.permission(user, 'pilotage', 'administrer');
      if (method.definition.stages.some((s) => data.stages[s.id]?.status !== 'validated'))
        throw new HttpError(409, 'Validez toutes les étapes avant d’approuver l’appréciation.');
    }
    if (data.strategy === 'accept' && decision === 'approved' && result.residual.acceptability === 'unacceptable')
      throw new HttpError(409, 'Le risque résiduel dépasse les critères d’acceptabilité de cette méthode.');
    return {
      version: risk.version,
      risk,
      method,
      ratings: parsed,
      result,
      previewId: hash({ risk, methodId: method.id, ratings: parsed, rationale, decision }),
    };
  }
  async evaluate(
    smsi: string,
    id: string,
    ratings: unknown,
    rationale: string,
    decision: string,
    expected: number,
    previewId: string,
    requestId: string,
    user: SessionUser,
    ip: string,
  ) {
    return this.g.db.tx(async (c, k) => {
      // Verrou consultatif par identifiant de requête : appel SQL direct (ADR 0062).
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,727282))', [requestId]);
      await this.g.object(smsi, id, user, true, c);
      await this.g.raw(id, c, true);
      const existing = await k
        .selectFrom('grc_risk_evaluations')
        .selectAll()
        .where('request_id', '=', requestId)
        .executeTakeFirst();
      if (existing) {
        if (
          existing.user_id !== user.id ||
          existing.risk_id !== id ||
          hash(existing.ratings) !== hash(RiskRatings.parse(ratings)) ||
          existing.rationale !== rationale ||
          existing.decision !== decision ||
          (existing.risk_snapshot as { version?: number } | null)?.version !== expected ||
          hash({
            risk: existing.risk_snapshot,
            methodId: existing.method_version_id,
            ratings: existing.ratings,
            rationale,
            decision,
          }) !== previewId
        )
          throw new HttpError(409, 'Identifiant de requête déjà utilisé.');
        return existing;
      }
      const p = await this.preview(smsi, id, ratings, rationale, decision, user, c);
      if (p.version !== expected) throw new HttpError(412, 'La fiche a changé.');
      if (p.previewId !== previewId) throw new HttpError(422, 'Relancez la simulation.');
      const revision = Number(
        (
          await k
            .selectFrom('grc_risk_evaluations')
            .select(sql<number>`coalesce(max(revision), 0) + 1`.as('n'))
            .where('risk_id', '=', id)
            .executeTakeFirstOrThrow()
        ).n,
      );
      const row = await k
        .insertInto('grc_risk_evaluations')
        .values({
          risk_id: id,
          smsi_id: smsi,
          method_version_id: p.method.id,
          revision,
          risk_snapshot: JSON.stringify(p.risk),
          ratings: JSON.stringify(p.ratings),
          result: JSON.stringify(p.result),
          rationale,
          decision,
          request_id: requestId,
          user_id: user.id,
          created_by: user.username,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.g.db.audit(
        user,
        ip,
        'grc.risk.evaluated',
        id,
        { smsiId: smsi, revision, methodVersion: p.method.version, decision, previewId },
        c,
      );
      await this.g.notify(c, id, p.version, smsi, 'pilotage', user.username);
      return row;
    }, user.username);
  }
  async treatmentAction(
    smsi: string,
    id: string,
    name: string,
    dueAt: string | null,
    ownerId: string | null,
    user: SessionUser,
    ip: string,
    registreId: string | null = null,
  ) {
    await this.g.permission(user, 'ecarts', 'modifier');
    return this.g.db.tx(async (c) => {
      const o = await this.g.object(smsi, id, user, true, c);
      if (o.kind !== 'treatment' || o.archived) throw new HttpError(422, 'Mesure de traitement active attendue.');
      await this.g.checkOwner(smsi, ownerId, c);
      // Plan d'actions d'accueil : celui qui est choisi (gestion exigée), sinon le registre par défaut du périmètre.
      const accueil = registreId
        ? await this.g.registreDeCreation(c, smsi, 'action', 'plan_actions', registreId, user)
        : null;
      const policy = (await this.g.policy(smsi, user)).definition;
      const action = await this.g.insert(
        c,
        smsi,
        'action',
        name,
        {
          description: o.name,
          status: policy.statuses[0]!.id,
          ownerId,
          startAt: null,
          dueAt,
          priority: 'normal',
          category: policy.catalogues.actionCategories[0]!.id,
          justification: '',
          reminderDays: policy.notifications.leadDays,
          dependencies: [],
        },
        user,
        ip,
        accueil,
      );
      await surConnexion(c)
        .insertInto('grc_links')
        .values({
          smsi_id: smsi,
          source_id: action.id,
          source_ref: 'object:' + action.id,
          target_ref: 'object:' + id,
          type: 'implements',
          note: 'Action issue du traitement ; risque résiduel inchangé',
          created_by: user.username,
        })
        .execute();
      return action;
    }, user.username);
  }
  async projection(
    smsi: string,
    user: SessionUser,
    filters: {
      basis?: 'gross' | 'residual';
      methodId?: string;
      domain?: string;
      entity?: string;
      strategy?: string;
      scope?: string;
      relatedRef?: string;
      at?: string;
      compareAt?: string;
      search?: string;
      limit?: number;
    },
  ) {
    await this.g.access(smsi, user);
    await this.g.permission(user, 'pilotage', 'lire');
    await this.g.permission(user, 'cartographie', 'lire');
    const args: unknown[] = [smsi, filters.at ?? new Date().toISOString()];
    const baseRows = filters.at
      ? `(SELECT b.id,b.smsi_id,b.kind,b.legacy_key,b.legacy_id,b.created_by,b.created_at,b.updated_by,b.updated_at,
      v.snapshot->>'name' name,v.snapshot->'data' data,(v.snapshot->>'version')::int version,(v.snapshot->>'archived')::boolean archived
      FROM grc_objects b JOIN LATERAL(SELECT snapshot FROM grc_object_versions v WHERE v.object_id=b.id AND v.created_at<=$2::timestamptz ORDER BY version DESC LIMIT 1)v ON true
      WHERE b.smsi_id=$1 AND b.kind='risk') o`
      : 'grc_objects o';
    let where = `o.smsi_id=$1 AND o.kind='risk' AND NOT o.archived AND $2::timestamptz IS NOT NULL`;
    for (const k of ['methodId', 'domain', 'entity', 'scope', 'strategy'] as const)
      if (filters[k]) {
        args.push(filters[k]);
        where += ` AND o.data->>'${k}'=$${args.length}`;
      }
    if (filters.relatedRef) {
      await this.g.resolve(smsi, filters.relatedRef, user);
      const seen = new Set<string>(),
        ids = new Set<string>();
      let frontier = [filters.relatedRef];
      for (let depth = 0; depth <= 6 && frontier.length; depth++) {
        const objectIds = frontier.filter((r) => r.startsWith('object:')).map((r) => r.slice(7));
        const objects = objectIds.length
          ? (
              await this.g.db.k
                .selectFrom('grc_objects')
                .select(['id', 'kind', 'data'])
                .where('smsi_id', '=', smsi)
                .where('id', 'in', objectIds)
                .where('archived', '=', false)
                .execute()
            ).map((o) => ({
              id: o.id,
              kind: o.kind as keyof typeof GRC_MODULES,
              data: o.data as Record<string, unknown>,
            }))
          : [];
        const allowed = new Map(
          objects.filter((o) => user.rights.can(GRC_MODULES[o.kind], 'lire')).map((o) => ['object:' + o.id, o]),
        );
        const visible: string[] = [],
          forward: string[] = [];
        for (const ref of frontier) {
          if (seen.has(ref)) continue;
          seen.add(ref);
          if (seen.size > 1000) throw new HttpError(422, 'Affinez le filtre : trop d’objets liés.');
          if (ref.startsWith('object:')) {
            const o = allowed.get(ref);
            if (!o) continue;
            if (o.kind === 'risk') ids.add(o.id);
            forward.push(...grcReferences(o.data));
          } else
            try {
              await this.g.resolve(smsi, ref, user);
            } catch {
              continue;
            }
          visible.push(ref);
        }
        if (!visible.length || depth === 6) break;
        const links = await this.g.db.k
          .selectFrom('grc_links')
          .select(['source_ref', 'target_ref'])
          .where('smsi_id', '=', smsi)
          .where((eb) => eb.or([eb('source_ref', 'in', visible), eb('target_ref', 'in', visible)]))
          .limit(2501)
          .execute();
        if (links.length > 2500) throw new HttpError(422, 'Affinez le filtre : trop de relations liées.');
        const cibles = JSON.stringify(visible);
        const fieldSources = await this.g.db.k
          .selectFrom('grc_objects')
          .select('id')
          .where('smsi_id', '=', smsi)
          .where('archived', '=', false)
          .where(
            sql<boolean>`(jsonb_path_exists(data, '$.stages.*.values.*[*] ? (@ == $targets[*])', jsonb_build_object('targets', ${cibles}::jsonb))
              OR jsonb_path_exists(data, '$.refs[*] ? (@ == $targets[*])', jsonb_build_object('targets', ${cibles}::jsonb)))`,
          )
          .limit(1001)
          .execute();
        frontier = [
          ...new Set([
            ...forward,
            ...links.flatMap((l) => [l.source_ref, l.target_ref]),
            ...fieldSources.map((o) => 'object:' + o.id),
          ]),
        ].filter((ref) => !seen.has(ref));
      }
      args.push([...ids]);
      where += ` AND o.id=ANY($${args.length}::uuid[])`;
    }
    if (filters.search) {
      args.push('%' + filters.search.replace(/[\\%_]/g, '\\$&') + '%');
      where += ` AND o.name ILIKE $${args.length}`;
    }
    // Projection : les fiches courantes, ou reconstituées à la date « at » depuis l'historique des versions (LATERAL,
    // snapshot->>…), avec l'appréciation retenue à cette date (to_jsonb). Cette requête à source dynamique reste en SQL
    // paramétré (ADR 0062, §5) ; les clés de filtre viennent d'une liste fermée, toutes les valeurs sont liées.
    const total = Number(
      (await this.g.db.one<{ n: number }>(`SELECT count(*)::int n FROM ${baseRows} WHERE ${where}`, args))!.n,
    );
    args.push(filters.limit ?? 500);
    const rows = (
      await this.g.db.q<ObjectRow & { assessment: Record<string, unknown> | null; method: RiskMethod | null }>(
        `SELECT o.id,o.smsi_id AS "smsiId",o.kind,o.name,o.data,o.version,o.archived,o.legacy_key AS "legacyKey",o.legacy_id AS "legacyId",o.created_by AS "createdBy",o.updated_by AS "updatedBy",o.created_at AS "createdAt",o.updated_at AS "updatedAt",to_jsonb(e) assessment,m.definition method FROM ${baseRows} LEFT JOIN LATERAL(SELECT * FROM grc_risk_evaluations e WHERE e.risk_id=o.id AND e.created_at<=$2::timestamptz ORDER BY (e.decision='approved') DESC,revision DESC LIMIT 1)e ON true LEFT JOIN grc_method_versions m ON m.id=e.method_version_id WHERE ${where} ORDER BY o.name,o.id LIMIT $${args.length}`,
        args,
      )
    ).rows;
    const previousRows =
      filters.compareAt && rows.length
        ? await this.g.db.k
            .selectFrom('grc_risk_evaluations')
            .distinctOn('risk_id')
            .select(['risk_id', 'result', 'method_version_id', 'revision'])
            .where('smsi_id', '=', smsi)
            .where(
              'risk_id',
              'in',
              rows.map((r) => r.id),
            )
            .where('created_at', '<=', sql<Date>`${filters.compareAt}::timestamptz`)
            .orderBy('risk_id')
            .orderBy(sql`(decision = 'approved')`, 'desc')
            .orderBy('revision', 'desc')
            .execute()
        : [];
    const previousById = new Map(previousRows.map((r) => [r.risk_id, r]));
    const items = [];
    for (const r of rows) {
      let comparison: unknown = null;
      if (filters.compareAt) {
        const previous = previousById.get(r.id);
        comparison = previous
          ? { ...previous, compatible: previous.method_version_id === r.assessment?.method_version_id }
          : null;
      }
      items.push({ ...objectDto(r), comparison });
    }
    // Un seul registre : les nœuds liés sont relus, jamais enregistrés comme copies cartographiques.
    const refs = rows.map((r) => 'object:' + r.id);
    const nodes = new Map<string, Awaited<ReturnType<Grc['resolve']>>>();
    for (const r of rows)
      nodes.set('object:' + r.id, {
        ref: 'object:' + r.id,
        name: r.name,
        module: 'pilotage',
        kind: r.kind,
        version: r.version,
        data: r.data,
      });
    const edges: { source_ref: string; target_ref: string; type: string }[] = [];
    const seenEdges = new Set<string>();
    let frontier = refs;
    let graphTruncated = false;
    for (let depth = 0; depth < 6 && frontier.length; depth++) {
      const links: { id: string; source_ref: string; target_ref: string; type: string }[] = await this.g.db.k
        .selectFrom('grc_links')
        .select(['id', 'source_ref', 'target_ref', 'type'])
        .where('smsi_id', '=', smsi)
        .where((eb) => eb.or([eb('source_ref', 'in', frontier), eb('target_ref', 'in', frontier)]))
        .orderBy('id')
        .limit(2501)
        .execute();
      for (const ref of frontier) {
        const node = nodes.get(ref);
        if (!node) continue;
        for (const target of grcReferences(node.data))
          if (target !== ref)
            links.push({ id: 'field:' + ref + ':' + target, source_ref: ref, target_ref: target, type: 'related_to' });
      }
      if (links.length > 2500) graphTruncated = true;
      const next: string[] = [];
      const candidateIds = [
        ...new Set(
          links
            .flatMap((l) => [l.source_ref, l.target_ref])
            .filter((ref) => ref.startsWith('object:') && !nodes.has(ref))
            .map((ref) => ref.slice(7)),
        ),
      ];
      const candidates = candidateIds.length
        ? (
            await this.g.db.k
              .selectFrom('grc_objects')
              .select(['id', 'kind', 'name', 'data', 'version'])
              .where('smsi_id', '=', smsi)
              .where('id', 'in', candidateIds)
              .execute()
          ).map((o) => ({
            ...o,
            kind: o.kind as keyof typeof GRC_MODULES,
            data: o.data as Record<string, unknown>,
          }))
        : [];
      const objectsById = new Map(
        candidates.filter((o) => user.rights.can(GRC_MODULES[o.kind], 'lire')).map((o) => [o.id, o]),
      );
      for (const l of links.slice(0, 2500)) {
        if (seenEdges.has(l.id)) continue;
        seenEdges.add(l.id);
        try {
          for (const ref of [l.source_ref, l.target_ref])
            if (!nodes.has(ref)) {
              if (nodes.size >= 1000) {
                graphTruncated = true;
                continue;
              }
              if (ref.startsWith('object:')) {
                const o = objectsById.get(ref.slice(7));
                if (!o) throw new HttpError(404, 'Objet inaccessible.');
                nodes.set(ref, {
                  ref,
                  name: o.name,
                  module: GRC_MODULES[o.kind],
                  kind: o.kind,
                  version: o.version,
                  data: o.data,
                });
              } else nodes.set(ref, await this.g.resolve(smsi, ref, user));
              next.push(ref);
            }
          if (nodes.has(l.source_ref) && nodes.has(l.target_ref) && edges.length < 2500)
            edges.push({ source_ref: l.source_ref, target_ref: l.target_ref, type: l.type });
        } catch {
          /* On ne poursuit pas l’exploration au travers d’une donnée inaccessible. */
        }
      }
      frontier = next;
      if (depth === 5 && next.length) graphTruncated = true;
    }
    const adjacency = new Map<string, string[]>();
    for (const e of edges) {
      adjacency.set(e.source_ref, [...(adjacency.get(e.source_ref) ?? []), e.target_ref]);
      adjacency.set(e.target_ref, [...(adjacency.get(e.target_ref) ?? []), e.source_ref]);
    }
    const facets: Record<string, Record<string, string[]>> = {};
    for (const risk of rows) {
      const start = 'object:' + risk.id,
        seen = new Set([start]),
        pending = [start];
      const groups: Record<'asset' | 'process' | 'scenario' | 'security_domain', string[]> = {
        asset: [],
        process: [],
        scenario: [],
        security_domain: [],
      };
      for (let i = 0; i < pending.length; i++)
        for (const ref of adjacency.get(pending[i]!) ?? []) {
          if (seen.has(ref)) continue;
          seen.add(ref);
          const node = nodes.get(ref);
          if (!node || node.kind === 'risk') continue;
          pending.push(ref);
          if (['business_asset', 'support_asset', 'items'].includes(node.kind)) groups.asset.push(node.name);
          if (['process', 'processes'].includes(node.kind)) groups.process.push(node.name);
          if (['strategic_scenario', 'operational_scenario'].includes(node.kind)) groups.scenario.push(node.name);
          const domain = node.data.securityDomain ?? node.data.domain;
          if (typeof domain === 'string' && domain) groups.security_domain.push(domain);
        }
      facets[risk.id] = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, [...new Set(v)].sort()]));
    }
    return {
      items,
      facets,
      total,
      truncated: total > rows.length,
      graphTruncated,
      relationsAsOf: 'current',
      basis: filters.basis ?? 'residual',
      nodes: [...nodes.values()],
      edges,
      generatedAt: new Date().toISOString(),
    };
  }
}
