import crypto from 'node:crypto';
import {
  GRC_MODULES,
  GrcObjectBody,
  GrcRef,
  grcReferences,
  TaskData,
  SeriesData,
  RiskData,
  MappingData,
  PILOTAGE_SCHEMAS,
  type GrcKind,
  type GrcObject,
  type Action,
  type Module,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import type { Client, Db } from '../db/db.js';
import type { LegacyStore } from '../legacy/store.js';
import type { BusinessPolicies } from '../business-policy.js';
import type { Modules } from '../modules.js';
import { HttpError } from '../http/errors.js';
import { loadGrants } from '../rights.js';
import { validDate } from '@suivi/shared';
import { GrcFrameworks } from './frameworks.js';
import { GrcRisks } from './risks.js';
import { LegacyTasks } from './legacy-tasks.js';
import { GrcTasks } from './tasks.js';
export const DEFAULT_SMSI = '00000000-0000-4000-8000-000000000001';
export const objectColumns = `id,smsi_id AS "smsiId",kind,name,data,version,archived,legacy_key AS "legacyKey",legacy_id AS "legacyId",created_by AS "createdBy",updated_by AS "updatedBy",created_at AS "createdAt",updated_at AS "updatedAt"`;
export type ObjectRow = Omit<GrcObject, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date };
export const objectDto = (r: ObjectRow): GrcObject => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
export const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : isObject(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        )
      : v;
export const hash = (v: unknown) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(v)))
    .digest('hex');
export interface GrcSmsi {
  id: string;
  name: string;
  scope: string;
  visibility: 'instance' | 'restricted';
  timezone: string;
  businessVersion: number;
  riskMethodId: string | null;
  riskMethodVersion: number | null;
  version: number;
  createdBy: string;
}
const smsiColumns = `s.id,s.name,s.scope,s.visibility,s.timezone,s.business_version AS "businessVersion",s.risk_method_id AS "riskMethodId",s.risk_method_version AS "riskMethodVersion",s.version,s.created_by AS "createdBy"`;
export class Grc {
  readonly legacyTasks: LegacyTasks;
  readonly frameworks: GrcFrameworks;
  readonly risks: GrcRisks;
  readonly tasks: GrcTasks;
  constructor(
    readonly db: Db,
    readonly legacy: LegacyStore,
    readonly business: BusinessPolicies,
    readonly modules: Modules,
  ) {
    this.legacyTasks = new LegacyTasks(this);
    this.frameworks = new GrcFrameworks(this);
    this.risks = new GrcRisks(this);
    this.tasks = new GrcTasks(this);
  }
  async isAdmin(user: SessionUser, c?: Client) {
    return (await loadGrants(c ?? this.db.pool, user.id)).some(
      (g) => g.roleId === 'administrateur' && (g.modules == null || g.modules.includes('administration')),
    );
  }
  async initialize() {
    await this.db.q(
      `INSERT INTO grc_smsis(id,name,scope,visibility,business_version,created_by) VALUES($1,'Pilotage de l’organisation','Données historiques et nouvelles relations communes','instance',(SELECT version FROM business_policy_configuration WHERE id=1),'système') ON CONFLICT DO NOTHING`,
      [DEFAULT_SMSI],
    );
  }
  async permission(user: SessionUser, module: Module, action: Action) {
    await this.modules.assert(module);
    if (!user.rights.can(module, action)) throw new HttpError(403, 'Droit requis : ' + module + ':' + action);
  }
  async access(id: string, user: SessionUser, write = false, c?: Client): Promise<GrcSmsi> {
    const r = (
      await (c ?? this.db.pool).query<GrcSmsi & { member: boolean; canWrite: boolean }>(
        `SELECT ${smsiColumns},EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=$2) AS member,EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=$2 AND m.can_write) AS "canWrite" FROM grc_smsis s WHERE s.id=$1${c ? ' FOR SHARE OF s' : ''}`,
        [id, user.id],
      )
    ).rows[0];
    const admin = await this.isAdmin(user, c);
    if (!r || (r.visibility === 'restricted' && !r.member && !admin))
      throw new HttpError(404, 'Périmètre introuvable ou non accessible.');
    if (write && r.visibility === 'restricted' && !r.canWrite && !admin)
      throw new HttpError(403, 'Votre accès à ce périmètre est en lecture seule.');
    return {
      id: r.id,
      name: r.name,
      scope: r.scope,
      visibility: r.visibility,
      timezone: r.timezone,
      businessVersion: r.businessVersion,
      riskMethodId: r.riskMethodId,
      riskMethodVersion: r.riskMethodVersion,
      version: r.version,
      createdBy: r.createdBy,
    };
  }
  async visible(user: SessionUser, scope: string, module?: Module) {
    try {
      if (module && !user.rights.can(module, 'lire')) return false;
      await this.access(scope, user);
      return true;
    } catch {
      return false;
    }
  }
  async listSmsis(user: SessionUser) {
    return (
      await this.db.q<GrcSmsi>(
        `SELECT ${smsiColumns} FROM grc_smsis s WHERE s.visibility='instance' OR $2 OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=$1) ORDER BY s.visibility='instance' DESC,s.name,s.id`,
        [user.id, await this.isAdmin(user)],
      )
    ).rows;
  }
  async createSmsi(input: { name: string; scope: string; timezone: string }, user: SessionUser, ip: string) {
    await this.permission(user, 'pilotage', 'administrer');
    return this.db.tx(async (c) => {
      const row = (
        await c.query<{ id: string }>(
          `INSERT INTO grc_smsis(name,scope,timezone,business_version,created_by) VALUES($1,$2,$3,(SELECT version FROM business_policy_configuration WHERE id=1),$4) RETURNING id`,
          [input.name, input.scope, input.timezone, user.username],
        )
      ).rows[0]!;
      await c.query('INSERT INTO grc_members(smsi_id,user_id,can_write) VALUES($1,$2,true)', [row.id, user.id]);
      await this.db.audit(user, ip, 'grc.smsi.created', row.id, {}, c);
      await this.notify(c, row.id, 1, row.id, 'pilotage', user.username);
      return this.access(row.id, user, true, c);
    }, user.username);
  }
  async members(id: string, user: SessionUser) {
    await this.permission(user, 'pilotage', 'administrer');
    await this.access(id, user, true);
    return (
      await this.db.q(
        `SELECT m.user_id AS "userId",u.username,u.display_name AS "displayName",m.can_write AS write FROM grc_members m JOIN users u ON u.id=m.user_id WHERE smsi_id=$1 ORDER BY u.username`,
        [id],
      )
    ).rows;
  }
  async setMember(id: string, target: string, write: boolean | null, user: SessionUser, ip: string) {
    await this.permission(user, 'pilotage', 'administrer');
    await this.access(id, user, true);
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [id]);
      await this.access(id, user, true, c);
      if (target === user.id && write !== true)
        throw new HttpError(
          409,
          'Conservez votre propre droit de gestion ; faites intervenir un autre administrateur pour le retirer.',
        );
      if (!(await c.query('SELECT 1 FROM users WHERE id=$1 AND NOT disabled', [target])).rowCount)
        throw new HttpError(404, 'Compte actif introuvable.');
      if (write === null) await c.query('DELETE FROM grc_members WHERE smsi_id=$1 AND user_id=$2', [id, target]);
      else
        await c.query(
          'INSERT INTO grc_members(smsi_id,user_id,can_write) VALUES($1,$2,$3) ON CONFLICT(smsi_id,user_id) DO UPDATE SET can_write=$3',
          [id, target, write],
        );
      if (target !== user.id) await c.query('DELETE FROM sessions WHERE user_id=$1', [target]);
      await this.db.audit(user, ip, 'grc.membership.changed', id, { userId: target, write }, c);
      await this.notify(c, id, 1, id, 'pilotage', user.username);
    }, user.username);
  }
  async policy(id: string, user: SessionUser) {
    const s = await this.access(id, user);
    return this.business.version(s.businessVersion);
  }
  async selectMethod(smsi: string, id: string, version: number, expected: number, user: SessionUser, ip: string) {
    await this.permission(user, 'pilotage', 'administrer');
    await this.risks.method(smsi, id, version, user);
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      const current = await this.access(smsi, user, true, c);
      if (current.version !== expected) throw new HttpError(412, 'Le périmètre a changé.');
      await c.query(
        'UPDATE grc_smsis SET risk_method_id=$2,risk_method_version=$3,version=version+1,updated_at=now() WHERE id=$1',
        [smsi, id, version],
      );
      await this.db.audit(
        user,
        ip,
        'grc.method.selected',
        smsi,
        { methodId: id, version, previousMethodId: current.riskMethodId, previousVersion: current.riskMethodVersion },
        c,
      );
      await this.notify(c, smsi, current.version + 1, smsi, 'pilotage', user.username);
      return this.access(smsi, user, false, c);
    }, user.username);
  }
  async adoptPolicy(smsi: string, version: number, expected: number, user: SessionUser, ip: string) {
    await this.permission(user, 'pilotage', 'administrer');
    const policy = await this.business.version(version);
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [smsi]);
      const current = await this.access(smsi, user, true, c);
      if (current.version !== expected) throw new HttpError(412, 'Le SMSI a changé.');
      const rows = (
        await c.query<{ kind: string; data: Record<string, unknown> }>(
          "SELECT kind,data FROM grc_objects WHERE smsi_id=$1 AND NOT archived AND kind IN ('action','task_series','measure','evidence','control')",
          [smsi],
        )
      ).rows;
      for (const o of rows) {
        if (
          (o.kind === 'action' && !policy.definition.statuses.some((s) => s.id === o.data.status)) ||
          (['action', 'task_series'].includes(o.kind) &&
            !policy.definition.catalogues.actionCategories.some((s) => s.id === o.data.category)) ||
          (o.kind === 'measure' &&
            !!o.data.category &&
            !policy.definition.catalogues.measureCategories.some((s) => s.id === o.data.category)) ||
          (o.kind === 'evidence' &&
            !!o.data.category &&
            !policy.definition.catalogues.proofCategories.some((s) => s.id === o.data.category)) ||
          (o.kind === 'control' &&
            !!o.data.category &&
            !policy.definition.catalogues.controlTypes.some((s) => s.id === o.data.category)) ||
          (o.kind === 'control' &&
            !!o.data.frequency &&
            !policy.definition.catalogues.frequencies.some((s) => s.id === o.data.frequency))
        )
          throw new HttpError(
            409,
            'Des fiches utilisent des états, catégories ou fréquences supprimés : publication incompatible.',
          );
      }
      await c.query('UPDATE grc_smsis SET business_version=$2,version=version+1,updated_at=now() WHERE id=$1', [
        smsi,
        version,
      ]);
      await this.db.audit(
        user,
        ip,
        'grc.policy.adopted',
        smsi,
        { previousVersion: current.businessVersion, version },
        c,
      );
      await this.notify(c, smsi, current.version + 1, smsi, 'pilotage', user.username);
      return this.access(smsi, user, false, c);
    }, user.username);
  }
  async raw(id: string, c?: Client, lock = false) {
    const row = (
      await (c ?? this.db.pool).query<ObjectRow>(
        `SELECT ${objectColumns} FROM grc_objects WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
    return row ? objectDto(row) : null;
  }
  async object(smsi: string, id: string, user: SessionUser, write = false, c?: Client) {
    await this.access(smsi, user, write, c);
    const o = await this.raw(id, c);
    if (!o || o.smsiId !== smsi) throw new HttpError(404, 'Objet introuvable.');
    await this.permission(user, GRC_MODULES[o.kind], write ? 'modifier' : 'lire');
    return o;
  }
  async listObjects(
    smsi: string,
    user: SessionUser,
    kind: GrcKind,
    search = '',
    offset = 0,
    filters: { status?: string; ownerId?: string; domain?: string; entity?: string } = {},
  ) {
    await this.access(smsi, user);
    await this.permission(user, GRC_MODULES[kind], 'lire');
    const args: unknown[] = [smsi, kind, '%' + search.replace(/[\\%_]/g, '\\$&') + '%'];
    let where = 'smsi_id=$1 AND kind=$2 AND NOT archived AND name ILIKE $3';
    for (const [k, v] of Object.entries(filters)) {
      if (!['status', 'ownerId', 'domain', 'entity'].includes(k)) continue;
      if (v) {
        args.push(v);
        where += ` AND data->>'${k}'=$${args.length}`;
      }
    }
    const total = Number(
      (await this.db.one<{ n: number }>(`SELECT count(*)::int n FROM grc_objects WHERE ${where}`, args))!.n,
    );
    args.push(offset);
    const rows = (
      await this.db.q<ObjectRow>(
        `SELECT ${objectColumns} FROM grc_objects WHERE ${where} ORDER BY updated_at DESC,id LIMIT 50 OFFSET $${args.length}`,
        args,
      )
    ).rows;
    return { items: rows.map(objectDto), total, nextOffset: offset + 50 < total ? offset + 50 : null };
  }
  async owners(smsi: string, user: SessionUser) {
    const s = await this.access(smsi, user);
    return (
      await this.db.q(
        `SELECT u.id,u.username,u.display_name AS "displayName" FROM users u WHERE NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND ( $2 OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=$1 AND m.user_id=u.id)) ORDER BY u.username LIMIT 1000`,
        [smsi, s.visibility === 'instance'],
      )
    ).rows;
  }
  async checkOwner(smsi: string, owner: unknown, c: Client) {
    if (owner == null) return;
    if (
      typeof owner !== 'string' ||
      !(
        await c.query(
          `SELECT 1 FROM users u JOIN grc_smsis s ON s.id=$2 WHERE u.id=$1 AND NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND (s.visibility='instance' OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=s.id AND m.user_id=u.id))`,
          [owner, smsi],
        )
      ).rowCount
    )
      throw new HttpError(422, 'Le responsable doit être un compte actif autorisé dans ce SMSI.');
  }
  async normalize(
    smsi: string,
    kind: GrcKind,
    data: Record<string, unknown>,
    user: SessionUser,
    c: Client,
    previous?: GrcObject,
  ) {
    if (Buffer.byteLength(JSON.stringify(data)) > 256 * 1024)
      throw new HttpError(413, 'Une fiche est limitée à 256 Ko.');
    if (kind === 'action') {
      const d = TaskData.parse(data);
      const policy = (await this.policy(smsi, user)).definition;
      const state = policy.statuses.find((s) => s.id === d.status);
      if (!state || !policy.catalogues.actionCategories.some((x) => x.id === d.category))
        throw new HttpError(422, 'État ou catégorie inconnus de la politique publiée.');
      if (
        previous &&
        previous.data.status !== d.status &&
        !policy.transitions.some((t) => t.from === previous.data.status && t.to === d.status)
      )
        throw new HttpError(409, 'Cette transition n’est pas autorisée par le workflow.');
      if (!previous && (d.seriesId || d.occurrenceKey))
        throw new HttpError(422, 'L’origine récurrente est réservée à l’automate.');
      if (!previous && state.terminal) throw new HttpError(422, 'Créer une action dans un état ouvert.');
      if (state.terminal && d.justification.trim().length < 10)
        throw new HttpError(422, 'Une clôture doit conserver sa justification.');
      if (previous && (previous.data.seriesId !== d.seriesId || previous.data.occurrenceKey !== d.occurrenceKey))
        throw new HttpError(422, 'L’origine de l’occurrence est immuable.');
      await this.checkOwner(smsi, d.ownerId, c);
      if (new Set(d.dependencies).size !== d.dependencies.length) throw new HttpError(422, 'Dépendances dupliquées.');
      if (previous && d.dependencies.length) {
        const cycle = await c.query(
          `WITH RECURSIVE chain(id) AS (SELECT unnest($1::uuid[]) UNION SELECT (jsonb_array_elements_text(o.data->'dependencies'))::uuid FROM grc_objects o JOIN chain ch ON ch.id=o.id WHERE o.smsi_id=$2 AND o.kind='action') SELECT 1 FROM chain WHERE id=$3 LIMIT 1`,
          [d.dependencies, smsi, previous.id],
        );
        if (cycle.rowCount) throw new HttpError(409, 'Dépendance circulaire interdite.');
      }
      for (const id of d.dependencies) {
        if (previous?.id === id) throw new HttpError(422, 'Une action ne dépend pas d’elle-même.');
        const a = await this.object(smsi, id, user, false, c);
        if (a.kind !== 'action') throw new HttpError(422, 'Dépendance : action attendue.');
        if (state.terminal && !policy.statuses.find((s) => s.id === a.data.status)?.terminal)
          throw new HttpError(409, 'Terminez les dépendances avant de clôturer.');
      }
      return d;
    }
    if (kind === 'task_series') {
      const d = SeriesData.parse(data);
      const policy = (await this.policy(smsi, user)).definition;
      if (!policy.catalogues.actionCategories.some((x) => x.id === d.category))
        throw new HttpError(422, 'Catégorie de récurrence inconnue.');
      await this.checkOwner(smsi, d.ownerId, c);
      for (const ref of d.refs) await this.resolve(smsi, ref, user, c);
      return d;
    }
    if (kind === 'risk') {
      const d = RiskData.parse(data);
      await this.checkOwner(smsi, d.ownerId, c);
      const method = await this.risks.method(smsi, d.methodId, d.methodVersion, user, c);
      this.risks.validateStages(method.definition, d.stages);
      if (d.reviewAt && !validDate(d.reviewAt)) throw new HttpError(422, 'Date de réévaluation invalide.');
      for (const [key, stage] of Object.entries(d.stages)) {
        if (
          method.definition.reevaluation.requireApproval &&
          stage.status === 'validated' &&
          (previous?.data.stages as RiskData['stages'] | undefined)?.[key]?.status !== 'validated'
        )
          await this.permission(user, 'pilotage', 'administrer');
        for (const value of Object.values(stage.values))
          if (Array.isArray(value)) for (const ref of value) await this.resolve(smsi, ref, user, c);
      }
      if (!method.definition.strategies.some((s) => s.kind === d.strategy))
        throw new HttpError(422, 'Stratégie absente de cette méthode.');
      return d;
    }
    if (kind === 'framework') throw new HttpError(409, 'Utilisez la publication versionnée du référentiel.');
    if (kind === 'mapping') {
      const d = MappingData.parse(data);
      if (d.status === 'validated')
        throw new HttpError(422, 'Validez le mapping par la commande de revue humaine dédiée.');
      await this.frameworks.validateMapping(smsi, d, user, c);
      return d;
    }
    if (kind === 'requirement')
      throw new HttpError(409, 'Les exigences se publient avec leur référentiel pour conserver la version exacte.');
    if (kind in PILOTAGE_SCHEMAS) {
      data = PILOTAGE_SCHEMAS[kind as keyof typeof PILOTAGE_SCHEMAS].parse(data);
      if (kind === 'nonconformity' && previous?.data.status === 'closed')
        throw new HttpError(409, 'Conservez la clôture : créez un nouveau constat pour une récidive.');
      if (kind === 'control') {
        for (const field of ['result', 'performedAt', 'seriesRef'])
          if (data[field] !== previous?.data[field])
            throw new HttpError(422, 'Les réalisations et la planification sont enregistrées par une commande dédiée.');
        if (
          previous &&
          ['objective', 'scope', 'method', 'criteria'].some((field) => data[field] !== previous.data[field])
        ) {
          delete data.result;
          delete data.performedAt;
        }
      }
      if (
        (kind === 'evidence' && ['validated', 'rejected'].includes(String(data.status))) ||
        (kind === 'nonconformity' && (data.status === 'closed' || data.effectiveness !== 'pending')) ||
        (['bia', 'continuity_plan', 'management_review'].includes(kind) && data.status === 'validated')
      ) {
        throw new HttpError(422, 'Utilisez la commande de vérification ou validation pour conserver la décision.');
      }
      if (kind === 'nonconformity' && (data.closedAt || data.closureNote || data.effectivenessNote))
        throw new HttpError(422, 'La clôture et l’efficacité sont enregistrées par une décision dédiée.');
      if (
        kind === 'continuity_exercise' &&
        data.status === 'done' &&
        (!data.performedAt || data.result === 'pending' || String(data.lessons).trim().length < 10)
      )
        throw new HttpError(422, 'Renseignez la date, le résultat et le retour d’expérience de l’exercice.');
      for (const ref of grcReferences(data)) await this.resolve(smsi, ref, user, c);
    }
    await this.checkOwner(smsi, data.ownerId, c);
    if (data.refs !== undefined) {
      if (!Array.isArray(data.refs) || data.refs.length > 100)
        throw new HttpError(422, 'Au plus 100 références par fiche.');
      for (const ref of data.refs) await this.resolve(smsi, GrcRef.parse(ref), user, c);
    }
    const catalogue =
      kind === 'measure'
        ? 'measureCategories'
        : kind === 'evidence'
          ? 'proofCategories'
          : kind === 'control'
            ? 'controlTypes'
            : null;
    if (catalogue && data.category) {
      const p = await this.policy(smsi, user);
      if (!p.definition.catalogues[catalogue].some((x) => x.id === data.category))
        throw new HttpError(422, 'Catégorie absente de la politique métier publiée.');
    }
    if (
      kind === 'control' &&
      data.frequency &&
      !(await this.policy(smsi, user)).definition.catalogues.frequencies.some((x) => x.id === data.frequency)
    )
      throw new HttpError(422, 'Fréquence absente de la politique publiée.');
    return data;
  }
  async createObject(smsi: string, input: GrcObjectBody, user: SessionUser, ip: string) {
    const body = GrcObjectBody.parse(input);
    await this.access(smsi, user, true);
    await this.permission(user, GRC_MODULES[body.kind], 'modifier');
    return this.db.tx(async (c) => {
      await this.access(smsi, user, true, c);
      const data = await this.normalize(smsi, body.kind, body.data, user, c);
      return this.insert(c, smsi, body.kind, body.name, data, user, ip);
    }, user.username);
  }
  async insert(
    c: Client,
    smsi: string,
    kind: GrcKind,
    name: string,
    data: unknown,
    user: { id?: string; username: string },
    ip: string,
  ) {
    const row = (
      await c.query<ObjectRow>(
        `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING ${objectColumns}`,
        [smsi, kind, GRC_MODULES[kind], name, data, user.username],
      )
    ).rows[0]!;
    const o = objectDto(row);
    await this.snapshot(c, o, 'Création');
    await this.db.audit(user, ip, 'grc.object.created', o.id, { smsiId: smsi, kind }, c);
    await this.notify(c, o.id, o.version, smsi, GRC_MODULES[kind], user.username);
    return o;
  }
  async updateObject(smsi: string, id: string, input: GrcObjectBody, expected: number, user: SessionUser, ip: string) {
    const body = GrcObjectBody.parse(input);
    return this.db.tx(async (c) => {
      const previous = await this.object(smsi, id, user, true, c);
      const current = await this.raw(id, c, true);
      if (!current || current.version !== expected)
        throw new HttpError(412, 'La fiche a changé. Rechargez avant de confirmer.');
      if (body.kind !== previous.kind || current.archived) throw new HttpError(409, 'Type immuable ou fiche archivée.');
      const data = await this.normalize(smsi, body.kind, body.data, user, c, current);
      return this.write(c, current, body.name, data, user, ip, 'Modification');
    }, user.username);
  }
  async write(
    c: Client,
    current: GrcObject,
    name: string,
    data: unknown,
    user: { id?: string; username: string },
    ip: string,
    reason: string,
  ) {
    const row = (
      await c.query<ObjectRow>(
        `UPDATE grc_objects SET name=$2,data=$3,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 RETURNING ${objectColumns}`,
        [current.id, name, data, user.username],
      )
    ).rows[0]!;
    const next = objectDto(row);
    if (next.kind === 'task_series' && hash(current.data.recurrence) !== hash(next.data.recurrence))
      await c.query('UPDATE grc_series SET next_index=0 WHERE object_id=$1', [next.id]);
    await this.snapshot(c, next, reason);
    await this.db.audit(
      user,
      ip,
      'grc.object.updated',
      next.id,
      { smsiId: next.smsiId, version: next.version, reason },
      c,
    );
    await this.notify(c, next.id, next.version, next.smsiId, GRC_MODULES[next.kind], user.username);
    return next;
  }
  async archive(smsi: string, id: string, expected: number, user: SessionUser, ip: string) {
    return this.db.tx(async (c) => {
      const current = await this.object(smsi, id, user, true, c);
      await this.permission(user, GRC_MODULES[current.kind], 'supprimer');
      await c.query('SELECT id FROM grc_objects WHERE id=$1 FOR UPDATE', [id]);
      const fresh = (await this.raw(id, c))!;
      if (fresh.version !== expected) throw new HttpError(412, 'Version obsolète.');
      await c.query('UPDATE grc_objects SET archived=true WHERE id=$1', [id]);
      return this.write(
        c,
        { ...fresh, archived: true },
        fresh.name,
        fresh.data,
        user,
        ip,
        'Archivage ; liens et historique conservés',
      );
    }, user.username);
  }
  async snapshot(c: Client, o: GrcObject, reason: string) {
    await c.query(
      'INSERT INTO grc_object_versions(object_id,smsi_id,version,snapshot,reason,created_by) VALUES($1,$2,$3,$4,$5,$6)',
      [o.id, o.smsiId, o.version, o, reason, o.updatedBy],
    );
  }
  async history(smsi: string, id: string, user: SessionUser, before = 2147483647) {
    await this.object(smsi, id, user);
    return (
      await this.db.q(
        'SELECT version,snapshot,reason,created_by AS "createdBy",created_at AS "createdAt" FROM grc_object_versions WHERE object_id=$1 AND version<$2 ORDER BY version DESC LIMIT 50',
        [id, before],
      )
    ).rows;
  }
  async notify(c: Client, id: string, version: number, smsi: string, module: Module, actor: string) {
    await c.query(`SELECT pg_notify('suivi_events',$1)`, [
      JSON.stringify({
        entity: 'grc',
        id,
        version,
        scope: smsi,
        module,
        author: actor,
        op: 'update',
        ts: new Date().toISOString(),
      }),
    ]);
  }
  async resolve(
    smsi: string,
    ref: string,
    user: SessionUser,
    c?: Client,
  ): Promise<{
    ref: string;
    name: string;
    module: Module;
    kind: string;
    version: number;
    data: Record<string, unknown>;
  }> {
    if (ref.startsWith('object:')) {
      const o = await this.object(smsi, ref.slice(7), user, false, c);
      return { ref, name: o.name, module: GRC_MODULES[o.kind], kind: o.kind, version: o.version, data: o.data };
    }
    if (ref.startsWith('requirement:')) {
      await this.permission(user, 'audit', 'lire');
      const [, id, version, ...rest] = ref.split(':');
      const f = await this.frameworks.version(smsi, id!, Number(version), user, c);
      const r = f.definition.requirements.find((r) => r.id === rest.join(':'));
      if (!r) throw new HttpError(404, 'Exigence publiée introuvable.');
      return { ref, name: r.title, module: 'audit', kind: 'requirement', version: Number(version), data: r };
    }
    if (ref.startsWith('legacy:tasks:')) {
      const task = (await this.legacyTasks.list(smsi, user)).find((x) => x.id === ref);
      if (!task) throw new HttpError(404, 'Action inaccessible.');
      return { ref, name: task.name, module: 'ecarts', kind: 'action', version: task.version, data: task.data };
    }
    if (ref.startsWith('document:')) {
      await this.permission(user, 'documents', 'lire');
      const [, id, version] = ref.split(':');
      const row = (
        await (c ?? this.db.pool).query<{ name: string; title: string }>(
          `SELECT d.title name,v.filename title FROM documents d JOIN document_versions v ON v.document_id=d.id WHERE d.id=$1 AND v.version=$2 AND d.deleted_at IS NULL`,
          [id, version],
        )
      ).rows[0];
      if (!row) throw new HttpError(404, 'Version de preuve inaccessible.');
      return {
        ref,
        name: row.name || row.title,
        module: 'documents',
        kind: 'evidence',
        version: Number(version),
        data: { documentId: id, version: Number(version) },
      };
    }
    const [, key, ...rest] = ref.split(':');
    if (!key) throw new HttpError(422, 'Référence invalide.');
    const id = rest.join(':');
    const data = (await this.legacy.recompose(c))?.data ?? {};
    const mapping: Record<string, { module: Module; kind: string; values: unknown }> = {
      items: { module: 'audit', kind: 'requirement', values: data.items },
      processes: { module: 'pilotage', kind: 'process', values: data.processes },
      objectives: { module: 'pilotage', kind: 'objective', values: data.objectives },
      indicators: { module: 'pilotage', kind: 'indicator', values: data.indicators },
      suppliers: { module: 'fournisseurs', kind: 'supplier', values: data.suppliers },
      findings: { module: 'ecarts', kind: 'nonconformity', values: data.findings },
      recurring: { module: 'pilotage', kind: 'task_series', values: data.recurring },
      incidents: { module: 'incidents', kind: 'incident', values: data.incidents },
      frameworks: { module: 'conformite', kind: 'framework', values: data.frameworks },
      evidences: { module: 'pilotage', kind: 'evidence', values: data.evidences },
      plans: { module: 'pilotage', kind: 'action', values: data.plans },
      scope: {
        module: 'pilotage',
        kind: 'context',
        values: [{ ...(isObject(data.scope) ? data.scope : {}), id: 'instance' }],
      },
      interested: { module: 'pilotage', kind: 'stakeholder', values: data.interested },
      swots: { module: 'pilotage', kind: 'swot', values: data.swots },
      roles: {
        module: 'pilotage',
        kind: 'governance',
        values: (Array.isArray(data.roles) ? data.roles : [])
          .filter(isObject)
          .map((r, i) => ({ ...r, id: typeof r.id === 'string' ? r.id : '@' + i })),
      },
      reviews: { module: 'pilotage', kind: 'management_review', values: data.reviews },
      soa: {
        module: 'pilotage',
        kind: 'soa',
        values: Object.entries(isObject(data.dda) ? data.dda : {}).map(([id, x]) => ({
          ...(isObject(x) ? x : {}),
          id,
        })),
      },
    };
    const source = mapping[key];
    if (!source) throw new HttpError(422, 'Origine de référence inconnue.');
    await this.permission(user, source.module, 'lire');
    const matches = (Array.isArray(source.values) ? source.values : []).filter(
      (v): v is JsonObject => isObject(v) && v.id === id,
    );
    if (matches.length !== 1) throw new HttpError(404, 'Source absente ou ambiguë.');
    const row = matches[0]!;
    return {
      ref,
      name: String(row.title ?? row.name ?? row.text ?? id),
      module: source.module,
      kind: source.kind,
      version: (await this.legacy.row(c))?.version ?? 0,
      data: row,
    };
  }
  async links(smsi: string, ref: string, user: SessionUser) {
    await this.access(smsi, user);
    const source = await this.resolve(smsi, ref, user);
    const rows = (
      await this.db.q<{ id: string; source_ref: string; target_ref: string; type: string; note: string }>(
        'SELECT id,source_ref,target_ref,type,note FROM grc_links WHERE smsi_id=$1 AND (source_ref=$2 OR target_ref=$2) ORDER BY created_at,id LIMIT 500',
        [smsi, ref],
      )
    ).rows;
    const parents = (
      await this.db.q<ObjectRow>(
        `SELECT ${objectColumns} FROM grc_objects WHERE smsi_id=$1 AND NOT archived AND (jsonb_path_exists(data,'$.stages.*.values.*[*] ? (@ == $ref)',jsonb_build_object('ref',$2::text)) OR data->'refs' @> $3::jsonb OR data->'documentRefs' @> $3::jsonb) ORDER BY id LIMIT 500`,
        [smsi, ref, JSON.stringify([ref])],
      )
    ).rows;
    const historicalParents: { source_ref: string; target_ref: string }[] = [];
    if (smsi === DEFAULT_SMSI) {
      const state = (await this.legacy.recompose())?.data ?? {};
      for (const key of [
        'items',
        'findings',
        'processes',
        'objectives',
        'indicators',
        'evidences',
        'plans',
        'recurring',
        'reviews',
      ]) {
        const values = (Array.isArray(state[key]) ? state[key] : []).filter(isObject);
        for (const row of values) {
          if (typeof row.id === 'string' && grcReferences(row).includes(ref) && historicalParents.length < 500)
            historicalParents.push({ source_ref: `legacy:${key}:${row.id}`, target_ref: ref });
        }
      }
    }
    const derived = [
      ...grcReferences(source.data).map((target) => ({ source_ref: ref, target_ref: target })),
      ...parents.map((o) => ({ source_ref: 'object:' + o.id, target_ref: ref })),
      ...historicalParents,
    ];
    const augmented = [
      ...rows.map((r) => ({ ...r, derived: false })),
      ...derived.map((r) => ({
        ...r,
        id: 'field:' + hash(r).slice(0, 32),
        type: 'related_to',
        note: 'Référence saisie dans la fiche source',
        derived: true,
      })),
    ];
    const visible = [];
    const seen = new Set<string>();
    for (const r of augmented.slice(0, 500)) {
      const key = JSON.stringify([r.source_ref, r.target_ref, r.type]);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const other = await this.resolve(smsi, r.source_ref === ref ? r.target_ref : r.source_ref, user);
        visible.push({ ...r, other: { ref: other.ref, name: other.name, kind: other.kind } });
      } catch {
        /* Aucun libellé ni identifiant inaccessible transmis. */
      }
    }
    return visible;
  }
  async link(smsi: string, source: string, target: string, type: string, note: string, user: SessionUser, ip: string) {
    await this.access(smsi, user, true);
    return this.db.tx(async (c) => {
      await this.access(smsi, user, true, c);
      const from = await this.resolve(smsi, source, user, c);
      await this.permission(user, from.module, 'modifier');
      await this.resolve(smsi, target, user, c);
      if (source === target) throw new HttpError(422, 'Une relation relie deux objets distincts.');
      const before =
        (
          await c.query(
            'SELECT note FROM grc_links WHERE smsi_id=$1 AND source_ref=$2 AND target_ref=$3 AND type=$4 FOR UPDATE',
            [smsi, source, target, type],
          )
        ).rows[0]?.note ?? null;
      const r = (
        await c.query<{ id: string }>(
          'INSERT INTO grc_links(smsi_id,source_id,source_ref,target_ref,type,note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(smsi_id,source_ref,target_ref,type) DO UPDATE SET note=$6 RETURNING id',
          [smsi, source.startsWith('object:') ? source.slice(7) : null, source, target, type, note, user.username],
        )
      ).rows[0]!;
      await this.db.audit(
        user,
        ip,
        'grc.link.saved',
        r.id,
        { smsiId: smsi, source, target, type, previousNote: before, note },
        c,
      );
      await this.notify(c, r.id, 1, smsi, from.module, user.username);
      return r;
    }, user.username);
  }
  async unlink(smsi: string, id: string, user: SessionUser, ip: string) {
    await this.access(smsi, user, true);
    return this.db.tx(async (c) => {
      const row = (
        await c.query<{ source_ref: string; target_ref: string; type: string; note: string }>(
          'SELECT source_ref,target_ref,type,note FROM grc_links WHERE id=$1 AND smsi_id=$2 FOR UPDATE',
          [id, smsi],
        )
      ).rows[0];
      if (!row) throw new HttpError(404, 'Relation introuvable.');
      const source = await this.resolve(smsi, row.source_ref, user, c);
      await this.permission(user, source.module, 'modifier');
      await c.query('DELETE FROM grc_links WHERE id=$1', [id]);
      await this.db.audit(user, ip, 'grc.link.deleted', id, { smsiId: smsi, ...row }, c);
      await this.notify(c, id, 1, smsi, source.module, user.username);
    }, user.username);
  }
}
