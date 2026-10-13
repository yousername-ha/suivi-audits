/* Fournisseurs de l'organisation (ADR 0032, lot M4). Le registre reste celui de l'état historique (sans copie) ; ce
   service y ajoute des critères définis par l'organisme, des évaluations immuables SANS périmètre et le rattachement
   des fournisseurs à des périmètres. Aucune grille, aucun seuil, aucun critère n'est fourni. */
import {
  SupplierBody,
  SupplierCriterionBody,
  SupplierEvaluationBody,
  SupplierFollowUpBody,
  type FrameworkDefinition,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import type { Client } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { DEFAULT_SMSI, type Grc } from './core.js';
import { parseRequirementRef } from './rapprochements.js';

export interface SupplierCriterion {
  id: string;
  label: string;
  description: string;
  purposes: string[];
  requirementRefs: string[];
  version: number;
  archived: boolean;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
}
export interface EvaluationSummary {
  id: string;
  supplierId: string;
  evaluatedAt: string;
  evaluator: string;
  nextReviewAt: string | null;
  items: number;
  meets: number;
  notMeets: number;
  notAssessed: number;
}
export interface SupplierRow {
  id: string;
  name: string;
  saas: boolean;
  rattachement: string;
  critical: string;
  hds: string;
  contact: string;
  current: EvaluationSummary | null;
  toReview: boolean;
  scopes: string[];
}
const CRITERION_COLUMNS = `id,label,description,purposes,requirement_refs AS "requirementRefs",version,archived,
  created_by AS "createdBy",updated_by AS "updatedBy",updated_at AS "updatedAt"`;
const EVALUATION_COLUMNS = `e.id,e.supplier_id AS "supplierId",e.evaluated_at::text AS "evaluatedAt",e.evaluator,
  e.next_review_at::text AS "nextReviewAt",
  (SELECT count(*)::int FROM sup_evaluation_items i WHERE i.evaluation_id=e.id) AS items,
  (SELECT count(*)::int FROM sup_evaluation_items i WHERE i.evaluation_id=e.id AND i.meets IS TRUE) AS meets,
  (SELECT count(*)::int FROM sup_evaluation_items i WHERE i.evaluation_id=e.id AND i.meets IS FALSE) AS "notMeets",
  (SELECT count(*)::int FROM sup_evaluation_items i WHERE i.evaluation_id=e.id AND i.meets IS NULL) AS "notAssessed"`;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** Date du jour (AAAA-MM-JJ) dans le fuseau donné. */
const today = (timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

export class GrcSuppliers {
  constructor(private readonly g: Grc) {}

  private async registry(c?: Client) {
    const state = await this.g.legacy.recompose(c);
    const suppliers = (Array.isArray(state?.data.suppliers) ? state!.data.suppliers : [])
      .filter(isObject)
      .filter((s): s is JsonObject & { id: string } => typeof s.id === 'string' && !!s.id);
    return { state, suppliers };
  }
  private async supplier(id: string, c?: Client) {
    const s = (await this.registry(c)).suppliers.find((x) => x.id === id);
    if (!s) throw new HttpError(404, 'Fournisseur absent du registre.');
    return s;
  }
  private current(c?: Client) {
    return (c ?? this.g.db.pool).query<EvaluationSummary>(
      `SELECT DISTINCT ON (e.supplier_id) ${EVALUATION_COLUMNS} FROM sup_evaluations e
        ORDER BY e.supplier_id,e.evaluated_at DESC,e.created_at DESC`,
    );
  }
  private row(s: JsonObject & { id: string }, current: EvaluationSummary | null, scopes: string[], day: string) {
    return {
      id: s.id,
      name: str(s.name),
      saas: s.saas === true,
      rattachement: str(s.rattachement),
      critical: str(s.critical),
      hds: str(s.hds),
      contact: str(s.contact),
      current,
      toReview: !!current?.nextReviewAt && current.nextReviewAt < day,
      scopes,
    } satisfies SupplierRow;
  }

  /** Registre de l'organisation, avec l'évaluation courante (la plus récente) et les périmètres où chacun est rattaché
      (limités à ceux que la personne peut voir). */
  async list(user: SessionUser): Promise<SupplierRow[]> {
    await this.g.permission(user, 'fournisseurs', 'lire');
    const { suppliers } = await this.registry();
    const current = new Map((await this.current()).rows.map((e) => [e.supplierId, e]));
    const links = (
      await this.g.db.q<{ supplier_id: string; smsi_id: string }>('SELECT supplier_id,smsi_id FROM sup_scope_links')
    ).rows;
    const visible = new Set<string>();
    for (const smsi of new Set(links.map((l) => l.smsi_id)))
      try {
        await this.g.access(smsi, user);
        visible.add(smsi);
      } catch {
        // périmètre non accessible : le rattachement n'est pas affiché
      }
    const day = today('UTC');
    return suppliers
      .map((s) =>
        this.row(
          s,
          current.get(s.id) ?? null,
          links.filter((l) => l.supplier_id === s.id && visible.has(l.smsi_id)).map((l) => l.smsi_id),
          day,
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  /** Crée un fournisseur dans le registre historique, sous verrou ; les autres champs se complètent dans l'outil historique. */
  async create(input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    const body = SupplierBody.parse(input);
    return this.g.db.tx(async (c) => {
      await c.query('SELECT id FROM app_state WHERE id=1 FOR UPDATE');
      const { state, suppliers } = await this.registry(c);
      if (!state) throw new HttpError(409, 'Registre historique indisponible.');
      if (suppliers.some((s) => str(s.name).trim().toLowerCase() === body.name.toLowerCase()))
        throw new HttpError(409, 'Un fournisseur porte déjà ce nom.');
      const used = suppliers.map((s) => /^SUP-(\d+)$/.exec(s.id)?.[1]).filter((n): n is string => !!n);
      const next = used.reduce((m, n) => Math.max(m, Number(n)), 0) + 1;
      const id = `SUP-${String(next).padStart(3, '0')}`;
      const created = { id, name: body.name, saas: false, controls: [], certs: [] } as JsonObject;
      const r = await this.g.legacy.legacyWrite(
        c,
        { ...state.data, suppliers: [...suppliers, created] },
        user,
        state.version,
      );
      if (r.conflict) throw new HttpError(412, 'Le registre a changé. Rechargez avant de créer.');
      await this.g.db.audit(user, ip, 'supplier.created', `legacy:suppliers:${id}`, { version: r.version }, c);
      await this.g.notify(c, `legacy:suppliers:${id}`, r.version, DEFAULT_SMSI, 'fournisseurs', user.username);
      return this.row(created as JsonObject & { id: string }, null, [], today('UTC'));
    }, user.username);
  }

  /* ------------------------------------------------------------------ Critères définis par l'organisme */
  async criteria(user: SessionUser, includeArchived = false): Promise<SupplierCriterion[]> {
    await this.g.permission(user, 'fournisseurs', 'lire');
    return (
      await this.g.db.q<SupplierCriterion>(
        `SELECT ${CRITERION_COLUMNS} FROM sup_criteria WHERE ($1 OR NOT archived) ORDER BY lower(label),id`,
        [includeArchived],
      )
    ).rows;
  }
  private async criterion(id: string, c: Client, lock = false) {
    const r = (
      await c.query<SupplierCriterion>(
        `SELECT ${CRITERION_COLUMNS} FROM sup_criteria WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
    if (!r) throw new HttpError(404, 'Critère introuvable.');
    return r;
  }
  /** Chaque exigence visée doit exister dans la version publiée de la bibliothèque. */
  private async checkRequirements(refs: string[], c: Client) {
    const definitions = new Map<string, FrameworkDefinition | null>();
    for (const ref of refs) {
      const p = parseRequirementRef(ref);
      if (!p) throw new HttpError(422, `Référence d'exigence invalide : ${ref}`);
      const key = `${p.frameworkId}:${p.version}`;
      if (!definitions.has(key))
        definitions.set(
          key,
          (
            await c.query<{ definition: FrameworkDefinition }>(
              'SELECT definition FROM lib_framework_versions WHERE framework_id=$1 AND version=$2',
              [p.frameworkId, p.version],
            )
          ).rows[0]?.definition ?? null,
        );
      const def = definitions.get(key);
      if (!def) throw new HttpError(404, 'Version de la bibliothèque introuvable.');
      if (!def.requirements.some((r) => r.id === p.requirementId))
        throw new HttpError(422, `Exigence « ${p.requirementId} » absente de cette version publiée.`);
    }
  }
  private async history(c: Client, k: SupplierCriterion, reason: string, user: SessionUser) {
    await c.query(
      'INSERT INTO sup_criterion_history(criterion_id,version,snapshot,reason,created_by) VALUES($1,$2,$3,$4,$5)',
      [k.id, k.version, k, reason, user.username],
    );
  }
  private duplicateLabel(e: unknown): never {
    if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'Un critère actif porte déjà ce libellé.');
    throw e;
  }
  async createCriterion(input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'administrer');
    const body = SupplierCriterionBody.parse(input);
    return this.g.db
      .tx(async (c) => {
        await this.checkRequirements(body.requirementRefs, c);
        const id = (
          await c.query<{ id: string }>(
            `INSERT INTO sup_criteria(label,description,purposes,requirement_refs,created_by,updated_by)
             VALUES($1,$2,$3,$4,$5,$5) RETURNING id`,
            [body.label, body.description, body.purposes, body.requirementRefs, user.username],
          )
        ).rows[0]!.id;
        const k = await this.criterion(id, c);
        await this.history(c, k, 'Critère créé : ' + body.reason, user);
        await this.g.db.audit(user, ip, 'supplier.criterion.created', id, { label: k.label }, c);
        return k;
      }, user.username)
      .catch((e: unknown) => this.duplicateLabel(e));
  }
  async updateCriterion(id: string, input: unknown, expected: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'administrer');
    const body = SupplierCriterionBody.parse(input);
    return this.g.db
      .tx(async (c) => {
        const current = await this.criterion(id, c, true);
        if (current.version !== expected)
          throw new HttpError(412, 'Le critère a changé. Rechargez avant d’enregistrer.');
        if (current.archived) throw new HttpError(409, 'Un critère retiré ne se modifie pas.');
        await this.checkRequirements(body.requirementRefs, c);
        await c.query(
          `UPDATE sup_criteria SET label=$2,description=$3,purposes=$4,requirement_refs=$5,version=version+1,
             updated_by=$6,updated_at=now() WHERE id=$1`,
          [id, body.label, body.description, body.purposes, body.requirementRefs, user.username],
        );
        const k = await this.criterion(id, c);
        await this.history(c, k, 'Critère modifié : ' + body.reason, user);
        await this.g.db.audit(user, ip, 'supplier.criterion.updated', id, { version: k.version }, c);
        return k;
      }, user.username)
      .catch((e: unknown) => this.duplicateLabel(e));
  }
  /** Retire un critère des nouvelles évaluations ; les évaluations passées gardent son libellé et sa version figés. */
  async archiveCriterion(id: string, expected: number, reason: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'administrer');
    return this.g.db.tx(async (c) => {
      const current = await this.criterion(id, c, true);
      if (current.version !== expected) throw new HttpError(412, 'Le critère a changé.');
      if (current.archived) throw new HttpError(409, 'Critère déjà retiré.');
      await c.query(
        'UPDATE sup_criteria SET archived=true,version=version+1,updated_by=$2,updated_at=now() WHERE id=$1',
        [id, user.username],
      );
      const k = await this.criterion(id, c);
      await this.history(c, k, 'Critère retiré : ' + reason, user);
      await this.g.db.audit(user, ip, 'supplier.criterion.archived', id, { version: k.version }, c);
      return k;
    }, user.username);
  }

  /* ------------------------------------------------------------------ Évaluations (immuables, sans périmètre) */
  async evaluate(supplierId: string, input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    const body = SupplierEvaluationBody.parse(input);
    const limit = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (body.evaluatedAt > limit) throw new HttpError(422, 'La date d’évaluation ne peut pas être dans le futur.');
    if (body.nextReviewAt && body.nextReviewAt < body.evaluatedAt)
      throw new HttpError(422, 'La réévaluation ne peut pas précéder l’évaluation.');
    return this.g.db.tx(async (c) => {
      const supplier = await this.supplier(supplierId, c);
      const criteria = new Map(
        (
          await c.query<SupplierCriterion>(
            `SELECT ${CRITERION_COLUMNS} FROM sup_criteria WHERE id=ANY($1::uuid[]) FOR SHARE`,
            [body.items.map((i) => i.criterionId)],
          )
        ).rows.map((k) => [k.id, k]),
      );
      for (const item of body.items) {
        const k = criteria.get(item.criterionId);
        if (!k) throw new HttpError(404, 'Critère introuvable.');
        if (k.archived) throw new HttpError(422, `Le critère « ${k.label} » est retiré.`);
      }
      const id = (
        await c.query<{ id: string }>(
          `INSERT INTO sup_evaluations(supplier_id,supplier_name,evaluated_at,evaluator,conclusion,next_review_at)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
          [supplierId, str(supplier.name), body.evaluatedAt, user.username, body.conclusion, body.nextReviewAt],
        )
      ).rows[0]!.id;
      for (const item of body.items) {
        const k = criteria.get(item.criterionId)!;
        await c.query(
          `INSERT INTO sup_evaluation_items(evaluation_id,criterion_id,criterion_version,criterion_label,requirement_refs,meets,result)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [id, k.id, k.version, k.label, k.requirementRefs, item.meets, item.result],
        );
      }
      await this.g.db.audit(
        user,
        ip,
        'supplier.evaluated',
        supplierId,
        { evaluation: id, items: body.items.length },
        c,
      );
      return this.evaluationIn(id, c);
    }, user.username);
  }
  private async evaluationIn(id: string, c: Client) {
    const e = (
      await c.query<EvaluationSummary & { supplierName: string; conclusion: string }>(
        `SELECT ${EVALUATION_COLUMNS},e.supplier_name AS "supplierName",e.conclusion FROM sup_evaluations e WHERE e.id=$1`,
        [id],
      )
    ).rows[0]!;
    const items = (
      await c.query(
        `SELECT criterion_id AS "criterionId",criterion_version AS "criterionVersion",criterion_label AS "criterionLabel",
                requirement_refs AS "requirementRefs",meets,result FROM sup_evaluation_items
          WHERE evaluation_id=$1 ORDER BY lower(criterion_label),id`,
        [id],
      )
    ).rows;
    return { ...e, items };
  }
  /** Historique complet des évaluations d'un fournisseur, la plus récente d'abord (la première est la courante). */
  async evaluations(supplierId: string, user: SessionUser) {
    await this.g.permission(user, 'fournisseurs', 'lire');
    const ids = (
      await this.g.db.q<{ id: string }>(
        'SELECT id FROM sup_evaluations WHERE supplier_id=$1 ORDER BY evaluated_at DESC,created_at DESC LIMIT 200',
        [supplierId],
      )
    ).rows;
    const client = await this.g.db.pool.connect();
    try {
      const out = [];
      for (const { id } of ids) out.push(await this.evaluationIn(id, client));
      return out;
    } finally {
      client.release();
    }
  }

  /* ------------------------------------------------------------------ Suite d'une évaluation (D11) */
  /** Crée, dans le périmètre choisi, une action liée au fournisseur ou une série de réévaluation qui le référence.
      L'évaluation reste sans périmètre : seul l'objet créé en dépend. Droits : fournisseurs:modifier et ecarts:modifier. */
  async followUp(supplierId: string, evaluationId: string, input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    const body = SupplierFollowUpBody.parse(input);
    const scope = await this.g.access(body.smsi, user, true);
    const evaluation = (
      await this.g.db.q<{ id: string; supplier_name: string; evaluated_at: string }>(
        'SELECT id,supplier_name,evaluated_at::text FROM sup_evaluations WHERE id=$1 AND supplier_id=$2',
        [evaluationId, supplierId],
      )
    ).rows[0];
    if (!evaluation) throw new HttpError(404, 'Évaluation introuvable pour ce fournisseur.');
    await this.supplier(supplierId);
    const ref = `legacy:suppliers:${supplierId}`;
    const policy = (await this.g.policy(body.smsi, user)).definition;
    const status = policy.statuses.find((s) => !s.terminal)?.id,
      category = policy.catalogues.actionCategories[0]?.id;
    if (!status || !category) throw new HttpError(422, 'La politique du périmètre ne permet pas de créer cet objet.');
    const origin = `Suite à l’évaluation du fournisseur « ${evaluation.supplier_name} » du ${evaluation.evaluated_at} (évaluation ${evaluation.id}).${body.note ? '\n' + body.note : ''}`;
    if (body.kind === 'action') {
      if (body.dueAt && body.dueAt < evaluation.evaluated_at)
        throw new HttpError(422, 'L’échéance ne peut pas précéder l’évaluation.');
      const created = await this.g.createObject(
        body.smsi,
        {
          kind: 'action',
          name: body.name,
          data: {
            description: origin,
            status,
            ownerId: null,
            startAt: null,
            dueAt: body.dueAt ? `${body.dueAt}T12:00:00.000Z` : null,
            priority: 'normal',
            category,
            justification: '',
            reminderDays: 0,
            dependencies: [],
          },
        },
        user,
        ip,
      );
      await this.g.link(body.smsi, 'object:' + created.id, ref, 'related_to', `Évaluation ${evaluation.id}`, user, ip);
      return { id: created.id, smsiId: body.smsi, kind: 'action', name: created.name, scope: scope.name };
    }
    const created = await this.g.createObject(
      body.smsi,
      {
        kind: 'task_series',
        name: body.name,
        data: {
          description: origin,
          ownerId: null,
          category,
          priority: 'normal',
          recurrence: {
            start: body.start!,
            time: body.time,
            timezone: scope.timezone,
            unit: body.unit!,
            interval: body.interval!,
            until: null,
            count: null,
            reminderDays: 0,
            active: true,
          },
          refs: [ref],
        },
      },
      user,
      ip,
    );
    return { id: created.id, smsiId: body.smsi, kind: 'task_series', name: created.name, scope: scope.name };
  }

  /* ------------------------------------------------------------------ Rattachement aux périmètres */
  async attach(smsi: string, supplierId: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    return this.g.db.tx(async (c) => {
      await this.g.access(smsi, user, true, c);
      await this.supplier(supplierId, c);
      const r = await c.query(
        'INSERT INTO sup_scope_links(smsi_id,supplier_id,attached_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [smsi, supplierId, user.username],
      );
      if (!r.rowCount) throw new HttpError(409, 'Fournisseur déjà rattaché à ce périmètre.');
      await this.g.db.audit(user, ip, 'supplier.attached', supplierId, { smsi }, c);
      return { smsiId: smsi, supplierId };
    }, user.username);
  }
  /** Retire seulement le rattachement : ni le fournisseur ni ses évaluations ne sont touchés. */
  async detach(smsi: string, supplierId: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    await this.g.db.tx(async (c) => {
      await this.g.access(smsi, user, true, c);
      const r = await c.query('DELETE FROM sup_scope_links WHERE smsi_id=$1 AND supplier_id=$2', [smsi, supplierId]);
      if (!r.rowCount) throw new HttpError(404, 'Rattachement introuvable.');
      await this.g.db.audit(user, ip, 'supplier.detached', supplierId, { smsi }, c);
    }, user.username);
  }
  /** Lecture par périmètre, sans copie : la même évaluation courante quel que soit le périmètre. */
  async forScope(smsi: string, user: SessionUser) {
    await this.g.permission(user, 'fournisseurs', 'lire');
    const scope = await this.g.access(smsi, user);
    const links = new Set(
      (
        await this.g.db.q<{ supplier_id: string }>('SELECT supplier_id FROM sup_scope_links WHERE smsi_id=$1', [smsi])
      ).rows.map((l) => l.supplier_id),
    );
    const { suppliers } = await this.registry();
    const current = new Map((await this.current()).rows.map((e) => [e.supplierId, e]));
    const day = today(scope.timezone);
    const rows = suppliers
      .filter((s) => links.has(s.id))
      .map((s) => this.row(s, current.get(s.id) ?? null, [smsi], day))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return {
      suppliers: rows,
      summary: {
        attached: rows.length,
        evaluated: rows.filter((r) => r.current).length,
        notEvaluated: rows.filter((r) => !r.current).length,
        toReview: rows.filter((r) => r.toReview).length,
      },
    };
  }
}
