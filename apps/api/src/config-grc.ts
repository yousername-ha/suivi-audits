/* Catalogue de configuration GRC transversal (ADR 0038) : échelles, matrices, correspondances, critères, taxonomies.
   Versions immuables, aperçu → publication confirmée (motif, If-Match, verrou), références épinglées (élément, version),
   registre des usages, variantes dérivées, modèles adoptés à la demande. Les évaluations et méthodes existantes ne sont
   jamais modifiées : un consommateur cite une version et conserve son résultat. */
import crypto from 'node:crypto';
import {
  appliesToFamily,
  CFG_KINDS,
  cfgRefs,
  cfgTemplates,
  diffScales,
  instantiateTemplateDefinition,
  parseCfgDefinition,
  ScaleDefinition,
  validateMapping,
  validateMatrix,
  type AppliesTo,
  type CfgDefinition,
  type CfgFamily,
  type CfgKind,
  type CfgRef,
  type CfgScope,
  type CfgState,
  type MappingDefinition,
  type MatrixDefinition,
} from '@suivi/shared';
import type { SessionUser } from './auth.js';
import type { Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import type { Grc } from './grc/core.js';
import { hash } from './grc/core.js';

const ITEM_COLUMNS = `i.id,i.kind,i.key,i.scope,i.smsi_id AS "smsiId",i.state,i.draft,i.current_version AS "currentVersion",
  i.derived_from_id AS "derivedFromId",i.derived_from_version AS "derivedFromVersion",i.origin,i.version,
  i.created_by AS "createdBy",i.updated_by AS "updatedBy",i.created_at AS "createdAt",i.updated_at AS "updatedAt"`;
interface ItemRow {
  id: string;
  kind: CfgKind;
  key: string;
  scope: CfgScope;
  smsiId: string | null;
  state: CfgState;
  draft: Record<string, unknown> | null;
  currentVersion: number | null;
  derivedFromId: string | null;
  derivedFromVersion: number | null;
  origin: Record<string, unknown>;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface CfgItem {
  id: string;
  kind: CfgKind;
  key: string;
  scope: CfgScope;
  smsiId: string | null;
  state: CfgState;
  currentVersion: number | null;
  derivedFrom: { id: string; version: number } | null;
  origin: Record<string, unknown>;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
const toItem = (r: ItemRow): CfgItem => ({
  id: r.id,
  kind: r.kind,
  key: r.key,
  scope: r.scope,
  smsiId: r.smsiId,
  state: r.state,
  currentVersion: r.currentVersion,
  derivedFrom: r.derivedFromId ? { id: r.derivedFromId, version: r.derivedFromVersion! } : null,
  origin: r.origin,
  version: r.version,
  createdBy: r.createdBy,
  updatedBy: r.updatedBy,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
const KEY = /^[a-z][a-z0-9_]{0,63}$/;
type Meta = { name: string; category: string; appliesTo: AppliesTo };
const metaOf = (kind: CfgKind, def: Record<string, unknown> | null): Meta => ({
  name: String(def?.name ?? ''),
  category: String(def?.category ?? def?.purpose ?? kind),
  appliesTo: (def?.appliesTo as AppliesTo | undefined) ?? 'all',
});

export interface CfgFilters {
  kind?: CfgKind;
  state?: CfgState;
  scope?: CfgScope;
  smsi?: string;
  family?: CfgFamily;
  category?: string;
  q?: string;
}

export class ConfigGrc {
  constructor(
    private readonly db: Db,
    private readonly grc: Grc,
  ) {}

  /* ------------------------------------------------------------ Droits (aucune nouvelle permission) */
  /** Lecture : toute personne qui consulte le pilotage, les paramètres ou l'administration. */
  private canRead(user: SessionUser) {
    return (
      user.rights.can('pilotage', 'lire') ||
      user.rights.can('parametres', 'lire') ||
      user.rights.can('administration', 'lire')
    );
  }
  private async assertRead(user: SessionUser, item?: { scope: CfgScope; smsiId: string | null }) {
    if (!this.canRead(user))
      throw new HttpError(403, 'Droit requis : pilotage:lire, parametres:lire ou administration:lire');
    if (item?.scope === 'smsi') await this.grc.access(item.smsiId!, user);
  }
  /** Écriture d'un brouillon (edit) ou publication, archivage, suppression (publish). */
  private async assertWrite(
    user: SessionUser,
    item: { scope: CfgScope; smsiId: string | null },
    level: 'edit' | 'publish',
  ) {
    if (item.scope === 'instance')
      await this.grc.permission(user, 'parametres', level === 'edit' ? 'modifier' : 'administrer');
    else {
      await this.grc.permission(user, 'pilotage', 'administrer');
      await this.grc.access(item.smsiId!, user, true);
    }
  }

  /* ------------------------------------------------------------ Lecture */
  private async row(id: string, c?: Client, lock = false): Promise<ItemRow> {
    const r = (
      await (c ?? this.db.pool).query<ItemRow>(
        `SELECT ${ITEM_COLUMNS} FROM cfg_items i WHERE i.id=$1${lock ? ' FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
    if (!r) throw new HttpError(404, 'Élément de configuration introuvable.');
    return r;
  }
  private async versionDef(id: string, version: number, c?: Client) {
    const r = (
      await (c ?? this.db.pool).query<{
        definition: Record<string, unknown>;
        reason: string;
        createdBy: string;
        createdAt: Date;
      }>(
        'SELECT definition,reason,created_by AS "createdBy",created_at AS "createdAt" FROM cfg_versions WHERE item_id=$1 AND version=$2',
        [id, version],
      )
    ).rows[0];
    if (!r) throw new HttpError(404, 'Version introuvable.');
    return r;
  }

  async list(user: SessionUser, f: CfgFilters = {}) {
    await this.assertRead(user);
    const rows = (
      await this.db.q<ItemRow & { definition: Record<string, unknown> | null; usages: number; children: number }>(
        `SELECT ${ITEM_COLUMNS}, v.definition,
           (SELECT count(DISTINCT (u.consumer_kind,u.consumer_id))::int FROM cfg_usages u WHERE u.item_id=i.id) AS usages,
           (SELECT count(*)::int FROM cfg_items d WHERE d.derived_from_id=i.id) AS children
         FROM cfg_items i LEFT JOIN cfg_versions v ON v.item_id=i.id AND v.version=i.current_version
         WHERE ($1::text IS NULL OR i.kind=$1) AND ($2::text IS NULL OR i.state=$2) AND ($3::text IS NULL OR i.scope=$3)
           AND ($4::uuid IS NULL OR i.smsi_id=$4 OR i.scope='instance')
         ORDER BY i.kind, i.key, i.created_at`,
        [f.kind ?? null, f.state ?? null, f.scope ?? null, f.smsi ?? null],
      )
    ).rows;
    const visible = new Map<string, boolean>();
    const out = [];
    for (const r of rows) {
      if (r.scope === 'smsi') {
        if (!visible.has(r.smsiId!)) visible.set(r.smsiId!, await this.grc.visible(user, r.smsiId!));
        if (!visible.get(r.smsiId!)) continue;
      }
      const meta = metaOf(r.kind, r.definition ?? r.draft);
      if (f.family && !appliesToFamily(meta.appliesTo, f.family)) continue;
      if (f.category && meta.category !== f.category) continue;
      if (f.q && !(meta.name + ' ' + r.key).toLowerCase().includes(f.q.toLowerCase())) continue;
      out.push({ ...toItem(r), ...meta, usages: r.usages, derivedCount: r.children });
    }
    return out;
  }

  async get(user: SessionUser, id: string) {
    const r = await this.row(id);
    await this.assertRead(user, r);
    const versions = (
      await this.db.q<{ version: number; reason: string; createdBy: string; createdAt: Date }>(
        'SELECT version,reason,created_by AS "createdBy",created_at AS "createdAt" FROM cfg_versions WHERE item_id=$1 ORDER BY version DESC',
        [id],
      )
    ).rows.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }));
    const current = r.currentVersion ? await this.versionDef(id, r.currentVersion) : null;
    const usages = (await this.db.one<{ n: number }>(
      'SELECT count(DISTINCT (consumer_kind,consumer_id))::int AS n FROM cfg_usages WHERE item_id=$1',
      [id],
    ))!.n;
    return {
      ...toItem(r),
      ...metaOf(r.kind, current?.definition ?? r.draft),
      draft: r.draft,
      definition: current?.definition ?? null,
      versions,
      usages,
    };
  }

  async version(user: SessionUser, id: string, version: number) {
    const r = await this.row(id);
    await this.assertRead(user, r);
    const v = await this.versionDef(id, version);
    return {
      id,
      version,
      kind: r.kind,
      key: r.key,
      definition: v.definition,
      reason: v.reason,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
    };
  }

  /* ------------------------------------------------------------ Création et brouillon */
  private parse(kind: CfgKind, input: unknown): CfgDefinition {
    const p = parseCfgDefinition(kind, input);
    if (!p.ok) throw new HttpError(422, p.errors.join(' ; '));
    return p.definition;
  }
  private checkTarget(scope: CfgScope, smsiId: string | null | undefined) {
    if (scope === 'smsi' && !smsiId) throw new HttpError(422, 'Un élément de périmètre exige ce périmètre.');
    if (scope === 'instance' && smsiId) throw new HttpError(422, 'Un élément d’organisation n’a pas de périmètre.');
  }
  async create(
    user: SessionUser,
    ip: string,
    input: { kind: CfgKind; key: string; scope: CfgScope; smsiId?: string | null; definition: unknown },
  ) {
    if (!CFG_KINDS.includes(input.kind)) throw new HttpError(422, 'Type d’élément inconnu.');
    if (!KEY.test(input.key))
      throw new HttpError(422, 'Identifiant : minuscules, chiffres et tirets bas, commençant par une lettre.');
    this.checkTarget(input.scope, input.smsiId);
    await this.assertWrite(user, { scope: input.scope, smsiId: input.smsiId ?? null }, 'edit');
    const definition = this.parse(input.kind, input.definition);
    return this.db.tx(async (c) => {
      const exists = await c.query(
        `SELECT 1 FROM cfg_items WHERE kind=$1 AND key=$2 AND COALESCE(smsi_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE($3::uuid,'00000000-0000-0000-0000-000000000000'::uuid)`,
        [input.kind, input.key, input.smsiId ?? null],
      );
      if (exists.rowCount) throw new HttpError(409, 'Cet identifiant existe déjà pour ce type d’élément.');
      const id = (
        await c.query<{ id: string }>(
          'INSERT INTO cfg_items(kind,key,scope,smsi_id,draft,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING id',
          [input.kind, input.key, input.scope, input.smsiId ?? null, definition, user.username],
        )
      ).rows[0]!.id;
      await this.db.audit(user, ip, 'config.create', id, { kind: input.kind, key: input.key, scope: input.scope }, c);
      return this.row(id, c).then(toItem);
    }, user.username);
  }

  async saveDraft(user: SessionUser, ip: string, id: string, expected: number, definition: unknown) {
    return this.db.tx(async (c) => {
      const r = await this.row(id, c, true);
      await this.assertWrite(user, r, 'edit');
      if (r.state === 'archived')
        throw new HttpError(409, 'Cet élément est archivé : restaurez-le avant de le modifier.');
      if (r.version !== expected)
        throw new HttpError(412, 'L’élément a changé. Votre brouillon est conservé ; rechargez avant d’enregistrer.', {
          current: toItem(r),
        });
      const def = this.parse(r.kind, definition);
      await c.query('UPDATE cfg_items SET draft=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1', [
        id,
        def,
        user.username,
      ]);
      await this.db.audit(user, ip, 'config.draft', id, { kind: r.kind, key: r.key }, c);
      return toItem(await this.row(id, c));
    }, user.username);
  }

  /* ------------------------------------------------------------ Validation croisée (références épinglées) */
  /** Charge les échelles épinglées par un élément ; renvoie aussi les erreurs de résolution (introuvable, type, portée, archivé). */
  private async scalesOf(
    owner: { id: string; scope: CfgScope; smsiId: string | null },
    refs: CfgRef[],
    c: Client,
    already: Set<string>,
  ) {
    const scales = new Map<string, ScaleDefinition>();
    const errors: string[] = [];
    for (const ref of refs) {
      const k = ref.item + '@' + ref.version;
      const row = (
        await c.query<{
          kind: CfgKind;
          key: string;
          scope: CfgScope;
          smsiId: string | null;
          state: CfgState;
          definition: Record<string, unknown>;
        }>(
          `SELECT i.kind,i.key,i.scope,i.smsi_id AS "smsiId",i.state,v.definition FROM cfg_items i JOIN cfg_versions v ON v.item_id=i.id
           WHERE i.id=$1 AND v.version=$2`,
          [ref.item, ref.version],
        )
      ).rows[0];
      if (!row) {
        errors.push(`Référence introuvable : ${ref.item} version ${ref.version}.`);
        continue;
      }
      if (row.kind !== 'scale') errors.push(`« ${row.key} » n’est pas une échelle.`);
      if (row.scope === 'smsi' && (owner.scope !== 'smsi' || owner.smsiId !== row.smsiId))
        errors.push(`« ${row.key} » est propre à un autre périmètre.`);
      if (row.state === 'archived' && !already.has(k))
        errors.push(`« ${row.key} » est archivée : elle ne peut plus recevoir de nouveau usage.`);
      const parsed = ScaleDefinition.safeParse(row.definition);
      if (parsed.success) scales.set(k, parsed.data);
    }
    return { scales, errors };
  }

  /** Erreurs de validation d'une définition par rapport aux éléments épinglés (résolus dans la transaction en cours). */
  private async validate(
    owner: { id: string; scope: CfgScope; smsiId: string | null; currentVersion: number | null },
    kind: CfgKind,
    def: CfgDefinition,
    c: Client,
  ) {
    const refs = cfgRefs(kind, def);
    if (!refs.length) return [] as string[];
    // Les références déjà épinglées par la version courante restent valables même si l'élément cible est archivé.
    const already = new Set<string>();
    if (owner.currentVersion) {
      const cur = await this.versionDef(owner.id, owner.currentVersion, c);
      const parsed = parseCfgDefinition(kind, cur.definition);
      if (parsed.ok) for (const r of cfgRefs(kind, parsed.definition)) already.add(r.item + '@' + r.version);
    }
    const { scales, errors } = await this.scalesOf(owner, refs, c, already);
    const get = (r: CfgRef) => scales.get(r.item + '@' + r.version);
    if (kind === 'matrix') {
      const m = def as MatrixDefinition;
      const rows = get(m.rows.scale),
        cols = get(m.columns.scale),
        res = get(m.result.scale);
      if (rows && cols && res) errors.push(...validateMatrix(m, { rows, columns: cols, result: res }));
    } else if (kind === 'mapping') {
      const m = def as MappingDefinition;
      const from = get(m.from),
        to = get(m.to);
      if (from && to) errors.push(...validateMapping(m, from, to));
    }
    return errors;
  }

  private fingerprint(id: string, currentVersion: number | null, definition: unknown) {
    return hash({ id, currentVersion, definition });
  }

  /* ------------------------------------------------------------ Aperçu d'impact et publication */
  async preview(user: SessionUser, id: string) {
    const r = await this.row(id);
    await this.assertWrite(user, r, 'edit');
    if (r.state === 'archived') throw new HttpError(409, 'Cet élément est archivé.');
    if (!r.draft) throw new HttpError(422, 'Aucun brouillon à simuler : enregistrez d’abord une définition.');
    const definition = this.parse(r.kind, r.draft);
    const current = r.currentVersion ? await this.versionDef(id, r.currentVersion) : null;
    const errors = await this.db.tx((c) => this.validate(r, r.kind, definition, c));
    const currentParsed = current ? parseCfgDefinition(r.kind, current.definition) : null;
    const same = !!currentParsed && currentParsed.ok && hash(currentParsed.definition) === hash(definition);
    let diff = null;
    if (current && r.kind === 'scale') {
      const before = ScaleDefinition.safeParse(current.definition);
      if (before.success) diff = diffScales(before.data, definition as ScaleDefinition);
    }
    const pinned = r.currentVersion
      ? (await this.db.one<{ n: number }>(
          'SELECT count(DISTINCT (consumer_kind,consumer_id,consumer_version))::int AS n FROM cfg_usages WHERE item_id=$1 AND item_version=$2',
          [id, r.currentVersion],
        ))!.n
      : 0;
    return {
      valid: errors.length === 0,
      errors,
      definition,
      changed: !same,
      currentVersion: r.currentVersion,
      nextVersion: (r.currentVersion ?? 0) + 1,
      previewId: this.fingerprint(id, r.currentVersion, definition),
      impact: {
        pinnedConsumers: pinned,
        scaleDiff: diff,
        note: pinned
          ? 'Les consommateurs actuels restent épinglés à la version courante ; la nouvelle version ne les modifie pas. Leur migration est une action explicite.'
          : 'Aucun consommateur n’utilise la version courante.',
      },
    };
  }

  async publish(user: SessionUser, ip: string, id: string, expected: number, previewId: string, reason: string) {
    return this.db.tx(async (c) => {
      const r = await this.row(id, c, true);
      await this.assertWrite(user, r, 'publish');
      if (r.state === 'archived') throw new HttpError(409, 'Cet élément est archivé : restaurez-le avant de publier.');
      if (r.version !== expected)
        throw new HttpError(412, 'L’élément a changé. Votre brouillon est conservé ; rechargez avant de publier.', {
          current: toItem(r),
        });
      if (!r.draft) throw new HttpError(422, 'Aucun brouillon à publier.');
      const definition = this.parse(r.kind, r.draft);
      if (previewId !== this.fingerprint(id, r.currentVersion, definition))
        throw new HttpError(422, 'La définition ne correspond plus à la simulation. Relancez la simulation.');
      const errors = await this.validate(r, r.kind, definition, c);
      if (errors.length) throw new HttpError(422, errors.join(' ; '));
      if (r.currentVersion) {
        const cur = await this.versionDef(id, r.currentVersion, c);
        const parsed = parseCfgDefinition(r.kind, cur.definition);
        if (parsed.ok && hash(parsed.definition) === hash(definition))
          throw new HttpError(422, 'Aucun changement à publier.');
      }
      const version = (r.currentVersion ?? 0) + 1;
      await c.query('INSERT INTO cfg_versions(item_id,version,definition,reason,created_by) VALUES($1,$2,$3,$4,$5)', [
        id,
        version,
        definition,
        reason,
        user.username,
      ]);
      for (const ref of cfgRefs(r.kind, definition))
        await c.query(
          "INSERT INTO cfg_usages(item_id,item_version,consumer_kind,consumer_id,consumer_version,created_by) VALUES($1,$2,'cfg_version',$3,$4,$5) ON CONFLICT DO NOTHING",
          [ref.item, ref.version, id, version, user.username],
        );
      await c.query(
        "UPDATE cfg_items SET current_version=$2,state='active',draft=NULL,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1",
        [id, version, user.username],
      );
      await this.db.audit(
        user,
        ip,
        'config.publish',
        id,
        { kind: r.kind, key: r.key, version, previousVersion: r.currentVersion, reason, previewId },
        c,
      );
      return toItem(await this.row(id, c));
    }, user.username);
  }

  /* ------------------------------------------------------------ Variantes, archivage, suppression */
  async derive(
    user: SessionUser,
    ip: string,
    id: string,
    input: { key: string; name?: string; scope: CfgScope; smsiId?: string | null },
  ) {
    if (!KEY.test(input.key))
      throw new HttpError(422, 'Identifiant : minuscules, chiffres et tirets bas, commençant par une lettre.');
    this.checkTarget(input.scope, input.smsiId);
    const src = await this.row(id);
    await this.assertRead(user, src);
    if (!src.currentVersion) throw new HttpError(409, 'Seule une version publiée peut être dérivée.');
    await this.assertWrite(user, { scope: input.scope, smsiId: input.smsiId ?? null }, 'edit');
    const base = (await this.versionDef(id, src.currentVersion)).definition;
    const definition = this.parse(src.kind, { ...base, ...(input.name ? { name: input.name } : {}) });
    return this.db.tx(async (c) => {
      const exists = await c.query(
        `SELECT 1 FROM cfg_items WHERE kind=$1 AND key=$2 AND COALESCE(smsi_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE($3::uuid,'00000000-0000-0000-0000-000000000000'::uuid)`,
        [src.kind, input.key, input.smsiId ?? null],
      );
      if (exists.rowCount) throw new HttpError(409, 'Cet identifiant existe déjà pour ce type d’élément.');
      const nid = (
        await c.query<{ id: string }>(
          `INSERT INTO cfg_items(kind,key,scope,smsi_id,draft,derived_from_id,derived_from_version,origin,created_by,updated_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`,
          [
            src.kind,
            input.key,
            input.scope,
            input.smsiId ?? null,
            definition,
            id,
            src.currentVersion,
            { type: 'derived' },
            user.username,
          ],
        )
      ).rows[0]!.id;
      await this.db.audit(user, ip, 'config.derive', nid, { from: id, version: src.currentVersion, key: input.key }, c);
      return toItem(await this.row(nid, c));
    }, user.username);
  }

  async setArchived(user: SessionUser, ip: string, id: string, archived: boolean) {
    return this.db.tx(async (c) => {
      const r = await this.row(id, c, true);
      await this.assertWrite(user, r, 'publish');
      if (archived && r.state === 'archived') throw new HttpError(409, 'Cet élément est déjà archivé.');
      if (!archived && r.state !== 'archived') throw new HttpError(409, 'Cet élément n’est pas archivé.');
      const next: CfgState = archived ? 'archived' : r.currentVersion ? 'active' : 'draft';
      await c.query('UPDATE cfg_items SET state=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1', [
        id,
        next,
        user.username,
      ]);
      await this.db.audit(user, ip, archived ? 'config.archive' : 'config.restore', id, { key: r.key }, c);
      return toItem(await this.row(id, c));
    }, user.username);
  }

  async remove(user: SessionUser, ip: string, id: string) {
    await this.db.tx(async (c) => {
      const r = await this.row(id, c, true);
      await this.assertWrite(user, r, 'publish');
      if (r.currentVersion) throw new HttpError(409, 'Un élément publié est immuable : archivez-le.');
      const child = await c.query('SELECT 1 FROM cfg_items WHERE derived_from_id=$1', [id]);
      if (child.rowCount) throw new HttpError(409, 'Des variantes dérivent de cet élément.');
      await c.query('DELETE FROM cfg_items WHERE id=$1', [id]);
      await this.db.audit(user, ip, 'config.delete', id, { key: r.key }, c);
    }, user.username);
  }

  /* ------------------------------------------------------------ Usages et migration */
  async usages(user: SessionUser, id: string) {
    const r = await this.row(id);
    await this.assertRead(user, r);
    const rows = (
      await this.db.q<{
        itemVersion: number;
        consumerKind: string;
        consumerId: string;
        consumerVersion: number;
        createdBy: string;
        createdAt: Date;
        label: string | null;
      }>(
        `SELECT u.item_version AS "itemVersion",u.consumer_kind AS "consumerKind",u.consumer_id AS "consumerId",u.consumer_version AS "consumerVersion",
           u.created_by AS "createdBy",u.created_at AS "createdAt",
           CASE u.consumer_kind
             WHEN 'cfg_version' THEN (SELECT ci.kind||' '||ci.key FROM cfg_items ci WHERE ci.id::text=u.consumer_id)
             WHEN 'method_version' THEN (SELECT mv.definition->>'name' FROM grc_method_versions mv WHERE mv.id::text=u.consumer_id)
             ELSE NULL END AS label
         FROM cfg_usages u WHERE u.item_id=$1 ORDER BY u.item_version DESC,u.created_at DESC`,
        [id],
      )
    ).rows;
    return rows.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
  }

  /** Étude d'impact d'un passage de la version « from » à la version « to » d'une échelle, sans aucune écriture. */
  async impact(user: SessionUser, id: string, from: number, to: number) {
    const r = await this.row(id);
    await this.assertRead(user, r);
    if (r.kind !== 'scale') throw new HttpError(422, 'L’étude d’impact structurelle concerne les échelles.');
    const a = ScaleDefinition.parse((await this.versionDef(id, from)).definition);
    const b = ScaleDefinition.parse((await this.versionDef(id, to)).definition);
    const consumers = (
      await this.db.q<{ consumerKind: string; consumerId: string; consumerVersion: number }>(
        'SELECT consumer_kind AS "consumerKind",consumer_id AS "consumerId",consumer_version AS "consumerVersion" FROM cfg_usages WHERE item_id=$1 AND item_version=$2',
        [id, from],
      )
    ).rows;
    return { from, to, diff: diffScales(a, b), consumers, consumersCount: consumers.length };
  }

  /** Épingle des éléments pour un consommateur (méthode publiée, analyse) : enregistre les usages, sans les modifier ensuite. */
  async recordUsage(
    c: Client,
    user: { username: string },
    consumer: { kind: 'method_version' | 'analysis'; id: string; version: number },
    refs: CfgRef[],
  ) {
    for (const ref of refs)
      await c.query(
        'INSERT INTO cfg_usages(item_id,item_version,consumer_kind,consumer_id,consumer_version,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [ref.item, ref.version, consumer.kind, consumer.id, consumer.version, user.username],
      );
  }

  /* ------------------------------------------------------------ Modèles */
  templates() {
    return cfgTemplates().map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      note: t.note,
      items: t.items.map((i) => ({ ref: i.ref, kind: i.kind, key: i.key })),
    }));
  }

  /** Adopte un modèle : crée ses éléments d'organisation, publiés en version 1 à relire et valider. Refuse si un identifiant existe. */
  async adoptTemplate(user: SessionUser, ip: string, templateId: string) {
    const tpl = cfgTemplates().find((t) => t.id === templateId);
    if (!tpl) throw new HttpError(404, 'Modèle introuvable.');
    await this.assertWrite(user, { scope: 'instance', smsiId: null }, 'publish');
    const ids = new Map(tpl.items.map((i) => [i.ref, crypto.randomUUID()]));
    return this.db.tx(async (c) => {
      for (const i of tpl.items) {
        const clash = await c.query('SELECT 1 FROM cfg_items WHERE kind=$1 AND key=$2 AND smsi_id IS NULL', [
          i.kind,
          i.key,
        ]);
        if (clash.rowCount)
          throw new HttpError(409, `L’identifiant « ${i.key} » existe déjà : le modèle n’est pas adopté.`);
      }
      const created: CfgItem[] = [];
      for (const i of tpl.items) {
        const id = ids.get(i.ref)!;
        const definition = this.parse(
          i.kind,
          instantiateTemplateDefinition(i.definition, (r) => {
            const target = ids.get(r);
            if (!target) throw new HttpError(500, 'Modèle invalide : référence locale inconnue.');
            return { item: target, version: 1 };
          }),
        );
        const errors = await this.validate(
          { id, scope: 'instance', smsiId: null, currentVersion: null },
          i.kind,
          definition,
          c,
        );
        if (errors.length) throw new HttpError(500, 'Modèle invalide : ' + errors.join(' ; '));
        await c.query(
          "INSERT INTO cfg_items(id,kind,key,scope,state,current_version,origin,created_by,updated_by) VALUES($1,$2,$3,'instance','draft',NULL,$4,$5,$5)",
          [id, i.kind, i.key, { type: 'template', template: tpl.id, note: tpl.note }, user.username],
        );
        await c.query('INSERT INTO cfg_versions(item_id,version,definition,reason,created_by) VALUES($1,1,$2,$3,$4)', [
          id,
          definition,
          `Adoption du modèle « ${tpl.label} » : à relire et à valider.`,
          user.username,
        ]);
        await c.query("UPDATE cfg_items SET current_version=1,state='active' WHERE id=$1", [id]);
        for (const ref of cfgRefs(i.kind, definition))
          await c.query(
            "INSERT INTO cfg_usages(item_id,item_version,consumer_kind,consumer_id,consumer_version,created_by) VALUES($1,$2,'cfg_version',$3,1,$4) ON CONFLICT DO NOTHING",
            [ref.item, ref.version, id, user.username],
          );
        created.push(toItem(await this.row(id, c)));
      }
      await this.db.audit(user, ip, 'config.adopt', tpl.id, { items: created.map((x) => x.key) }, c);
      return created;
    }, user.username);
  }
}
