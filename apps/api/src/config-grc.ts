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
  MappingDefinition,
  MatrixDefinition,
  methodBindingRefs,
  parseCfgDefinition,
  resolveMethodBindings,
  type RiskMethod,
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
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from './auth.js';
import { surConnexion, type Client, type Db, type Kdb } from './db/db.js';
import { HttpError } from './http/errors.js';
import type { Grc } from './grc/core.js';
import { hash } from './grc/core.js';

const COLONNES_ELEMENT = [
  'i.id',
  'i.kind',
  'i.key',
  'i.scope',
  'i.smsi_id as smsiId',
  'i.state',
  'i.draft',
  'i.current_version as currentVersion',
  'i.derived_from_id as derivedFromId',
  'i.derived_from_version as derivedFromVersion',
  'i.origin',
  'i.version',
  'i.created_by as createdBy',
  'i.updated_by as updatedBy',
  'i.created_at as createdAt',
  'i.updated_at as updatedAt',
] as const;
/** Brouillon et origine ne sont écrits qu'après validation (parseCfgDefinition) ou par ce module : relus tels quels. */
const versLigne = <T extends { draft: unknown; origin: unknown }>(r: T) =>
  ({ ...r, draft: r.draft as Record<string, unknown> | null, origin: r.origin as Record<string, unknown> }) as Omit<
    T,
    'draft' | 'origin'
  > & { draft: Record<string, unknown> | null; origin: Record<string, unknown> };
/** Élément épinglé dans une version donnée, avec la définition de cette version. */
const elementEpingle = async (k: Kdb, ref: CfgRef) => {
  const r = await k
    .selectFrom('cfg_items as i')
    .innerJoin('cfg_versions as v', 'v.item_id', 'i.id')
    .select(['i.kind', 'i.key', 'i.scope', 'i.smsi_id as smsiId', 'i.state', 'v.definition'])
    .where('i.id', '=', ref.item)
    .where('v.version', '=', ref.version)
    .executeTakeFirst();
  return r ? { ...r, definition: r.definition as Record<string, unknown> } : undefined;
};
/** Un identifiant est unique par type et par périmètre (l'organisation comptant comme un périmètre). */
const identifiantPris = (k: Kdb, kind: CfgKind, key: string, smsiId: string | null) =>
  k
    .selectFrom('cfg_items')
    .select('id')
    .where('kind', '=', kind)
    .where('key', '=', key)
    .where((eb) => (smsiId === null ? eb('smsi_id', 'is', null) : eb('smsi_id', '=', smsiId)))
    .executeTakeFirst();
/** Nombre de consommateurs distincts (type, identifiant[, version]). */
const consommateurs = (avecVersion: boolean) =>
  avecVersion
    ? sql<number>`count(DISTINCT (consumer_kind, consumer_id, consumer_version))::int`
    : sql<number>`count(DISTINCT (consumer_kind, consumer_id))::int`;
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
interface CfgItem {
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
  /** Kysely sur la transaction de l'appelant, sinon sur le pool. */
  private k(c?: Client): Kdb {
    return c ? surConnexion(c) : this.db.k;
  }

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
    const r = await this.k(c)
      .selectFrom('cfg_items as i')
      .select(COLONNES_ELEMENT)
      .where('i.id', '=', id)
      .$if(lock, (q) => q.forUpdate())
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Élément de configuration introuvable.');
    return versLigne(r);
  }
  private async versionDef(id: string, version: number, c?: Client) {
    const r = await this.k(c)
      .selectFrom('cfg_versions')
      .select(['definition', 'reason', 'created_by as createdBy', 'created_at as createdAt'])
      .where('item_id', '=', id)
      .where('version', '=', version)
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Version introuvable.');
    return { ...r, definition: r.definition as Record<string, unknown> };
  }

  async list(user: SessionUser, f: CfgFilters = {}) {
    await this.assertRead(user);
    const rows = (
      await this.db.k
        .selectFrom('cfg_items as i')
        .leftJoin('cfg_versions as v', (j) =>
          j.onRef('v.item_id', '=', 'i.id').onRef('v.version', '=', 'i.current_version'),
        )
        .select(COLONNES_ELEMENT)
        .select([
          'v.definition',
          (eb) =>
            eb
              .selectFrom('cfg_usages as u')
              .select(consommateurs(false).as('n'))
              .whereRef('u.item_id', '=', 'i.id')
              .as('usages'),
          (eb) =>
            eb
              .selectFrom('cfg_items as d')
              .select(sql<number>`count(*)::int`.as('n'))
              .whereRef('d.derived_from_id', '=', 'i.id')
              .as('children'),
        ])
        .$if(!!f.kind, (q) => q.where('i.kind', '=', f.kind!))
        .$if(!!f.state, (q) => q.where('i.state', '=', f.state!))
        .$if(!!f.scope, (q) => q.where('i.scope', '=', f.scope!))
        .$if(!!f.smsi, (q) => q.where((eb) => eb.or([eb('i.smsi_id', '=', f.smsi!), eb('i.scope', '=', 'instance')])))
        .orderBy('i.kind')
        .orderBy('i.key')
        .orderBy('i.created_at')
        .execute()
    ).map((r) => ({
      ...versLigne(r),
      definition: r.definition as Record<string, unknown> | null,
      usages: r.usages ?? 0,
      children: r.children ?? 0,
    }));
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
      await this.db.k
        .selectFrom('cfg_versions')
        .select(['version', 'reason', 'created_by as createdBy', 'created_at as createdAt'])
        .where('item_id', '=', id)
        .orderBy('version', 'desc')
        .execute()
    ).map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }));
    const current = r.currentVersion ? await this.versionDef(id, r.currentVersion) : null;
    const { n: usages } = await this.db.k
      .selectFrom('cfg_usages')
      .select(consommateurs(false).as('n'))
      .where('item_id', '=', id)
      .executeTakeFirstOrThrow();
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
    return this.db.tx(async (c, k) => {
      if (await identifiantPris(k, input.kind, input.key, input.smsiId ?? null))
        throw new HttpError(409, 'Cet identifiant existe déjà pour ce type d’élément.');
      const { id } = await k
        .insertInto('cfg_items')
        .values({
          kind: input.kind,
          key: input.key,
          scope: input.scope,
          smsi_id: input.smsiId ?? null,
          draft: JSON.stringify(definition),
          created_by: user.username,
          updated_by: user.username,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.db.audit(user, ip, 'config.create', id, { kind: input.kind, key: input.key, scope: input.scope }, c);
      return this.row(id, c).then(toItem);
    }, user.username);
  }

  async saveDraft(user: SessionUser, ip: string, id: string, expected: number, definition: unknown) {
    return this.db.tx(async (c, k) => {
      const r = await this.row(id, c, true);
      await this.assertWrite(user, r, 'edit');
      if (r.state === 'archived')
        throw new HttpError(409, 'Cet élément est archivé : restaurez-le avant de le modifier.');
      if (r.version !== expected)
        throw new HttpError(412, 'L’élément a changé. Votre brouillon est conservé ; rechargez avant d’enregistrer.', {
          current: toItem(r),
        });
      const def = this.parse(r.kind, definition);
      await this.ecrire(k, id, user.username, { draft: JSON.stringify(def) });
      await this.db.audit(user, ip, 'config.draft', id, { kind: r.kind, key: r.key }, c);
      return toItem(await this.row(id, c));
    }, user.username);
  }

  /** Nouvelle version d'un élément (champs donnés, version, auteur et date). */
  private async ecrire(
    k: Kdb,
    id: string,
    auteur: string,
    champs: { draft?: string | null; state?: CfgState; current_version?: number },
  ) {
    await k
      .updateTable('cfg_items')
      .set((eb) => ({ ...champs, version: eb('version', '+', 1), updated_by: auteur, updated_at: sql<Date>`now()` }))
      .where('id', '=', id)
      .execute();
  }
  /** Usages d'éléments par un consommateur ; un usage déjà enregistré est conservé tel quel. */
  private async usagesDe(
    k: Kdb,
    refs: CfgRef[],
    consommateur: { kind: 'cfg_version' | 'method_version' | 'analysis'; id: string; version: number },
    auteur: string,
  ) {
    for (const ref of refs)
      await k
        .insertInto('cfg_usages')
        .values({
          item_id: ref.item,
          item_version: ref.version,
          consumer_kind: consommateur.kind,
          consumer_id: consommateur.id,
          consumer_version: consommateur.version,
          created_by: auteur,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
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
      const row = await elementEpingle(surConnexion(c), ref);
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
      ? (
          await this.db.k
            .selectFrom('cfg_usages')
            .select(consommateurs(true).as('n'))
            .where('item_id', '=', id)
            .where('item_version', '=', r.currentVersion)
            .executeTakeFirstOrThrow()
        ).n
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
    return this.db.tx(async (c, k) => {
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
      await k
        .insertInto('cfg_versions')
        .values({ item_id: id, version, definition: JSON.stringify(definition), reason, created_by: user.username })
        .execute();
      await this.usagesDe(k, cfgRefs(r.kind, definition), { kind: 'cfg_version', id, version }, user.username);
      await this.ecrire(k, id, user.username, { current_version: version, state: 'active', draft: null });
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
    return this.db.tx(async (c, k) => {
      if (await identifiantPris(k, src.kind, input.key, input.smsiId ?? null))
        throw new HttpError(409, 'Cet identifiant existe déjà pour ce type d’élément.');
      const { id: nid } = await k
        .insertInto('cfg_items')
        .values({
          kind: src.kind,
          key: input.key,
          scope: input.scope,
          smsi_id: input.smsiId ?? null,
          draft: JSON.stringify(definition),
          derived_from_id: id,
          derived_from_version: src.currentVersion,
          origin: JSON.stringify({ type: 'derived' }),
          created_by: user.username,
          updated_by: user.username,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.db.audit(user, ip, 'config.derive', nid, { from: id, version: src.currentVersion, key: input.key }, c);
      return toItem(await this.row(nid, c));
    }, user.username);
  }

  async setArchived(user: SessionUser, ip: string, id: string, archived: boolean) {
    return this.db.tx(async (c, k) => {
      const r = await this.row(id, c, true);
      await this.assertWrite(user, r, 'publish');
      if (archived && r.state === 'archived') throw new HttpError(409, 'Cet élément est déjà archivé.');
      if (!archived && r.state !== 'archived') throw new HttpError(409, 'Cet élément n’est pas archivé.');
      const next: CfgState = archived ? 'archived' : r.currentVersion ? 'active' : 'draft';
      await this.ecrire(k, id, user.username, { state: next });
      await this.db.audit(user, ip, archived ? 'config.archive' : 'config.restore', id, { key: r.key }, c);
      return toItem(await this.row(id, c));
    }, user.username);
  }

  async remove(user: SessionUser, ip: string, id: string) {
    await this.db.tx(async (c, k) => {
      const r = await this.row(id, c, true);
      await this.assertWrite(user, r, 'publish');
      if (r.currentVersion) throw new HttpError(409, 'Un élément publié est immuable : archivez-le.');
      const child = await k.selectFrom('cfg_items').select('id').where('derived_from_id', '=', id).executeTakeFirst();
      if (child) throw new HttpError(409, 'Des variantes dérivent de cet élément.');
      await k.deleteFrom('cfg_items').where('id', '=', id).execute();
      await this.db.audit(user, ip, 'config.delete', id, { key: r.key }, c);
    }, user.username);
  }

  /* ------------------------------------------------------------ Usages et migration */
  async usages(user: SessionUser, id: string) {
    const r = await this.row(id);
    await this.assertRead(user, r);
    // Libellé du consommateur selon son type (identifiant stocké en texte) : expression SQL fixe, sans valeur extérieure.
    const rows = await this.db.k
      .selectFrom('cfg_usages as u')
      .select([
        'u.item_version as itemVersion',
        'u.consumer_kind as consumerKind',
        'u.consumer_id as consumerId',
        'u.consumer_version as consumerVersion',
        'u.created_by as createdBy',
        'u.created_at as createdAt',
        sql<string | null>`CASE u.consumer_kind
             WHEN 'cfg_version' THEN (SELECT ci.kind || ' ' || ci.key FROM cfg_items ci WHERE ci.id::text = u.consumer_id)
             WHEN 'method_version' THEN (SELECT mv.definition->>'name' FROM grc_method_versions mv WHERE mv.id::text = u.consumer_id)
             ELSE NULL END`.as('label'),
      ])
      .where('u.item_id', '=', id)
      .orderBy('u.item_version', 'desc')
      .orderBy('u.created_at', 'desc')
      .execute();
    return rows.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
  }

  /** Étude d'impact d'un passage de la version « from » à la version « to » d'une échelle, sans aucune écriture. */
  async impact(user: SessionUser, id: string, from: number, to: number) {
    const r = await this.row(id);
    await this.assertRead(user, r);
    if (r.kind !== 'scale') throw new HttpError(422, 'L’étude d’impact structurelle concerne les échelles.');
    const a = ScaleDefinition.parse((await this.versionDef(id, from)).definition);
    const b = ScaleDefinition.parse((await this.versionDef(id, to)).definition);
    const consumers = await this.db.k
      .selectFrom('cfg_usages')
      .select(['consumer_kind as consumerKind', 'consumer_id as consumerId', 'consumer_version as consumerVersion'])
      .where('item_id', '=', id)
      .where('item_version', '=', from)
      .execute();
    return { from, to, diff: diffScales(a, b), consumers, consumersCount: consumers.length };
  }

  /* ------------------------------------------------------------ Méthodes de risque (épinglages) */
  /** Résout les épinglages d'une méthode sur le catalogue (visibilité, type, famille, archivage) et renvoie la définition
      intégrée à publier ; `already` : références déjà épinglées par la version précédente de la méthode (restent valables archivées). */
  async resolveMethod(smsi: string, method: RiskMethod, c?: Client, already: CfgRef[] = []) {
    const refs = methodBindingRefs(method.bindings);
    if (!refs.length) return { definition: method, refs };
    const b = method.bindings!;
    const kdb = this.k(c);
    const expected = new Map<string, Set<CfgKind>>();
    const expect = (r: CfgRef, kind: CfgKind) =>
      expected.set(r.item + '@' + r.version, (expected.get(r.item + '@' + r.version) ?? new Set()).add(kind));
    for (const r of [
      ...Object.values(b.dimensions),
      ...(b.likelihood ? [b.likelihood] : []),
      ...(b.levels ? [b.levels] : []),
    ])
      expect(r, 'scale');
    if (b.matrix) expect(b.matrix.ref, 'matrix');
    const known = new Set(already.map((r) => r.item + '@' + r.version));
    const scales = new Map<string, ScaleDefinition>();
    const matrices = new Map<string, MatrixDefinition>();
    const errors: string[] = [];
    for (const ref of refs) {
      const k = ref.item + '@' + ref.version;
      const row = await elementEpingle(kdb, ref);
      if (!row) {
        errors.push(`Référence introuvable : ${ref.item} version ${ref.version}.`);
        continue;
      }
      const kinds = expected.get(k)!;
      if (kinds.size > 1 || !kinds.has(row.kind)) {
        errors.push(
          `« ${row.key} » est ${row.kind === 'scale' ? 'une échelle' : 'de type ' + row.kind} : ${kinds.size > 1 ? 'elle ne peut être épinglée à la fois comme échelle et comme matrice.' : kinds.has('matrix') ? 'une matrice est attendue.' : 'une échelle est attendue.'}`,
        );
        continue;
      }
      if (row.scope === 'smsi' && row.smsiId !== smsi) errors.push(`« ${row.key} » est propre à un autre périmètre.`);
      if (row.state === 'archived' && !known.has(k))
        errors.push(`« ${row.key} » est archivé : il ne peut plus recevoir de nouveau usage.`);
      const parsed =
        row.kind === 'scale' ? ScaleDefinition.safeParse(row.definition) : MatrixDefinition.safeParse(row.definition);
      if (!parsed.success) {
        errors.push(`« ${row.key} » : définition illisible.`);
        continue;
      }
      if (!appliesToFamily(parsed.data.appliesTo, method.family))
        errors.push(`« ${row.key} » ne s’applique pas à la famille de méthode « ${method.family} ».`);
      if (row.kind === 'scale') scales.set(k, parsed.data as ScaleDefinition);
      else matrices.set(k, parsed.data as MatrixDefinition);
    }
    if (errors.length) throw new HttpError(422, errors.join(' '));
    const r = resolveMethodBindings(method, { scales, matrices });
    if (!r.ok) throw new HttpError(422, r.errors.join(' '));
    return { definition: r.definition, refs };
  }

  /** Épinglage d'un élément du catalogue par une analyse (étude EBIOS RM) : existence, type attendu, visibilité du
      périmètre, famille de méthode et archivage (sauf si l'analyse l'épinglait déjà). Lève une erreur 422 sinon. */
  async checkAnalysisPin(
    smsi: string,
    ref: CfgRef,
    kind: CfgKind,
    family: CfgFamily,
    already: CfgRef | null,
    c: Client,
  ) {
    const row = await elementEpingle(surConnexion(c), ref);
    if (!row) throw new HttpError(422, `Référence de configuration introuvable : ${ref.item} version ${ref.version}.`);
    if (row.kind !== kind) throw new HttpError(422, `« ${row.key} » n’est pas du type attendu (${kind}).`);
    if (row.scope === 'smsi' && row.smsiId !== smsi)
      throw new HttpError(422, `« ${row.key} » est propre à un autre périmètre.`);
    const same = already && already.item === ref.item && already.version === ref.version;
    if (row.state === 'archived' && !same)
      throw new HttpError(422, `« ${row.key} » est archivé : il ne peut plus recevoir de nouvel usage.`);
    const parsed = (
      kind === 'matrix' ? MatrixDefinition : kind === 'mapping' ? MappingDefinition : ScaleDefinition
    ).safeParse(row.definition);
    if (!parsed.success) throw new HttpError(422, `« ${row.key} » : définition illisible.`);
    if (!appliesToFamily((parsed.data as { appliesTo: AppliesTo }).appliesTo, family))
      throw new HttpError(422, `« ${row.key} » ne s’applique pas à la famille « ${family} ».`);
  }

  /** Épinglages d'une méthode : lecture de la version publiée (immuable) pour les références déjà valides. */
  pinnedRefs(method: RiskMethod | undefined) {
    return methodBindingRefs(method?.bindings);
  }

  /** Épingle des éléments pour un consommateur (méthode publiée, analyse) : enregistre les usages, sans les modifier ensuite. */
  async recordUsage(
    c: Client,
    user: { username: string },
    consumer: { kind: 'method_version' | 'analysis'; id: string; version: number },
    refs: CfgRef[],
  ) {
    await this.usagesDe(surConnexion(c), refs, consumer, user.username);
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
    return this.db.tx(async (c, k) => {
      for (const i of tpl.items) {
        if (await identifiantPris(k, i.kind, i.key, null))
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
        await k
          .insertInto('cfg_items')
          .values({
            id,
            kind: i.kind,
            key: i.key,
            scope: 'instance',
            state: 'draft',
            current_version: null,
            origin: JSON.stringify({ type: 'template', template: tpl.id, note: tpl.note }),
            created_by: user.username,
            updated_by: user.username,
          })
          .execute();
        await k
          .insertInto('cfg_versions')
          .values({
            item_id: id,
            version: 1,
            definition: JSON.stringify(definition),
            reason: `Adoption du modèle « ${tpl.label} » : à relire et à valider.`,
            created_by: user.username,
          })
          .execute();
        // Sans nouvelle version de l'élément : l'adoption le crée publié en version 1.
        await k.updateTable('cfg_items').set({ current_version: 1, state: 'active' }).where('id', '=', id).execute();
        await this.usagesDe(k, cfgRefs(i.kind, definition), { kind: 'cfg_version', id, version: 1 }, user.username);
        created.push(toItem(await this.row(id, c)));
      }
      await this.db.audit(user, ip, 'config.adopt', tpl.id, { items: created.map((x) => x.key) }, c);
      return created;
    }, user.username);
  }
}
