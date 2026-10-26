/* Fournisseurs de l'organisation (ADR 0032, lot M4). Le registre reste celui de l'état historique (sans copie) ; ce
   service y ajoute des critères définis par l'organisme, des évaluations immuables SANS périmètre et le rattachement
   des fournisseurs à des périmètres. Aucune grille, aucun seuil, aucun critère n'est fourni.
   Accès aux données en Kysely (ADR 0062) ; le registre reste dans l'état historique (LegacyStore). */
import {
  SupplierBody,
  SupplierCriterionBody,
  SupplierEvaluationBody,
  SupplierFollowUpBody,
  SupplierUpdateBody,
  etatCertificats,
  resumeControles,
  type EtatSuivi,
  type FrameworkDefinition,
  type ResumeControles,
} from '@suivi/shared';
import { isObject, type JsonObject } from '@suivi/shared/legacy';
import type { SessionUser } from '../auth.js';
import { sql, type ExpressionBuilder } from 'kysely';
import { surConnexion, type Client, type Kdb } from '../db/db.js';
import type { DB } from '../db/types.generated.js';
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
  notes: string;
  sso: string;
  mfa: string;
  certs: Record<string, unknown>[];
  controls: Record<string, unknown>[];
  /** États calculés comme l'outil de suivi historique (aucune valeur estimée). */
  certificateState: EtatSuivi;
  controlSummary: ResumeControles;
  current: EvaluationSummary | null;
  toReview: boolean;
  scopes: string[];
}
/** Colonnes d'un critère ; la date de mise à jour est rendue en ISO, comme sa sérialisation JSON d'origine. */
const criteres = (k: Kdb) =>
  k
    .selectFrom('sup_criteria')
    .select([
      'id',
      'label',
      'description',
      'purposes',
      'requirement_refs as requirementRefs',
      'version',
      'archived',
      'created_by as createdBy',
      'updated_by as updatedBy',
      'updated_at',
    ]);
const critere = ({
  updated_at,
  ...r
}: { updated_at: Date } & Omit<SupplierCriterion, 'updatedAt'>): SupplierCriterion => ({
  ...r,
  updatedAt: updated_at.toISOString(),
});
/** Nombre d'éléments d'une évaluation « e », éventuellement filtré sur « meets ». */
const compte = (eb: ExpressionBuilder<DB & { e: DB['sup_evaluations'] }, 'e'>, meets?: boolean | null) => {
  let q = eb
    .selectFrom('sup_evaluation_items as i')
    .select(sql<number>`count(*)::int`.as('n'))
    .whereRef('i.evaluation_id', '=', 'e.id');
  if (meets !== undefined) q = q.where('i.meets', 'is', meets);
  return q;
};
/** Résumé d'évaluation ; les dates restent au format AAAA-MM-JJ calculé par PostgreSQL (::text). */
const evaluations = (k: Kdb) =>
  k
    .selectFrom('sup_evaluations as e')
    .select((eb) => [
      'e.id',
      'e.supplier_id as supplierId',
      sql<string>`e.evaluated_at::text`.as('evaluatedAt'),
      'e.evaluator',
      sql<string | null>`e.next_review_at::text`.as('nextReviewAt'),
      compte(eb).as('items'),
      compte(eb, true).as('meets'),
      compte(eb, false).as('notMeets'),
      compte(eb, null).as('notAssessed'),
    ]);
const resume = (
  r: Omit<EvaluationSummary, 'items' | 'meets' | 'notMeets' | 'notAssessed'> &
    Record<'items' | 'meets' | 'notMeets' | 'notAssessed', number | null>,
): EvaluationSummary => ({
  ...r,
  items: r.items ?? 0,
  meets: r.meets ?? 0,
  notMeets: r.notMeets ?? 0,
  notAssessed: r.notAssessed ?? 0,
});
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
  /** Évaluation la plus récente de chaque fournisseur. */
  private async current(): Promise<EvaluationSummary[]> {
    const rows = await evaluations(this.g.db.k)
      .distinctOn('e.supplier_id')
      .orderBy('e.supplier_id')
      .orderBy('e.evaluated_at', 'desc')
      .orderBy('e.created_at', 'desc')
      .execute();
    return rows.map(resume);
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
      notes: str(s.notes),
      sso: str(s.sso),
      mfa: str(s.mfa),
      certs: (Array.isArray(s.certs) ? s.certs : []).filter(isObject),
      controls: (Array.isArray(s.controls) ? s.controls : []).filter(isObject),
      certificateState: etatCertificats(s, day),
      controlSummary: resumeControles(s, day),
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
    const current = new Map((await this.current()).map((e) => [e.supplierId, e]));
    const links = await this.g.db.k.selectFrom('sup_scope_links').select(['supplier_id', 'smsi_id']).execute();
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
      await surConnexion(c).selectFrom('app_state').select('id').where('id', '=', 1).forUpdate().execute();
      const { state, suppliers } = await this.registry(c);
      if (!state) throw new HttpError(409, 'Registre historique indisponible.');
      if (suppliers.some((s) => str(s.name).trim().toLowerCase() === body.name.toLowerCase()))
        throw new HttpError(409, 'Un fournisseur porte déjà ce nom.');
      const used = suppliers.map((s) => /^SUP-(\d+)$/.exec(s.id)?.[1]).filter((n): n is string => !!n);
      const next = used.reduce((m, n) => Math.max(m, Number(n)), 0) + 1;
      const id = `SUP-${String(next).padStart(3, '0')}`;
      const created = { id, name: body.name, saas: false, controls: [], certs: [] } as JsonObject;
      const r = await this.g.legacy.nativeWrite(
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

  /** Modifie les champs d'un fournisseur du registre historique (sous verrou, sans copie). Contrôles et certificats sont
      remplacés tels quels ; un contrôle sans identifiant en reçoit un. */
  async update(id: string, input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    const body = SupplierUpdateBody.parse(input);
    return this.g.db.tx(async (c) => {
      await surConnexion(c).selectFrom('app_state').select('id').where('id', '=', 1).forUpdate().execute();
      const { state, suppliers } = await this.registry(c);
      if (!state) throw new HttpError(409, 'Registre historique indisponible.');
      const before = suppliers.find((s) => s.id === id);
      if (!before) throw new HttpError(404, 'Fournisseur absent du registre.');
      if (
        body.name &&
        suppliers.some((s) => s.id !== id && str(s.name).trim().toLowerCase() === body.name!.toLowerCase())
      )
        throw new HttpError(409, 'Un fournisseur porte déjà ce nom.');
      const next: JsonObject = { ...before };
      for (const [k, v] of Object.entries(body)) {
        if (k === 'controls')
          next.controls = (body.controls ?? []).map((ctl, i) => ({
            ...ctl,
            id: ctl.id ?? `ctl-${Date.now().toString(36)}-${i}`,
          }));
        else next[k] = v as never;
      }
      const r = await this.g.legacy.nativeWrite(
        c,
        { ...state.data, suppliers: suppliers.map((s) => (s.id === id ? next : s)) },
        user,
        state.version,
      );
      if (r.conflict) throw new HttpError(412, 'Le registre a changé. Rechargez avant de modifier.');
      await this.g.db.audit(user, ip, 'supplier.updated', `legacy:suppliers:${id}`, { fields: Object.keys(body) }, c);
      await this.g.notify(c, `legacy:suppliers:${id}`, r.version, DEFAULT_SMSI, 'fournisseurs', user.username);
      return this.row(next as JsonObject & { id: string }, null, [], today('UTC'));
    }, user.username);
  }

  /* ------------------------------------------------------------------ Critères définis par l'organisme */
  async criteria(user: SessionUser, includeArchived = false): Promise<SupplierCriterion[]> {
    await this.g.permission(user, 'fournisseurs', 'lire');
    let q = criteres(this.g.db.k);
    if (!includeArchived) q = q.where('archived', '=', false);
    return (
      await q
        .orderBy(sql`lower(label)`)
        .orderBy('id')
        .execute()
    ).map(critere);
  }
  private async criterion(id: string, k: Kdb, lock = false) {
    let q = criteres(k).where('id', '=', id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    if (!r) throw new HttpError(404, 'Critère introuvable.');
    return critere(r);
  }
  /** Chaque exigence visée doit exister dans la version publiée de la bibliothèque. */
  private async checkRequirements(refs: string[], k: Kdb) {
    const definitions = new Map<string, FrameworkDefinition | null>();
    for (const ref of refs) {
      const p = parseRequirementRef(ref);
      if (!p) throw new HttpError(422, `Référence d'exigence invalide : ${ref}`);
      const key = `${p.frameworkId}:${p.version}`;
      if (!definitions.has(key))
        definitions.set(
          key,
          // Définition publiée (validée à la publication), relue telle quelle.
          ((
            await k
              .selectFrom('lib_framework_versions')
              .select('definition')
              .where('framework_id', '=', p.frameworkId)
              .where('version', '=', p.version)
              .executeTakeFirst()
          )?.definition as FrameworkDefinition | undefined) ?? null,
        );
      const def = definitions.get(key);
      if (!def) throw new HttpError(404, 'Version de la bibliothèque introuvable.');
      if (!def.requirements.some((r) => r.id === p.requirementId))
        throw new HttpError(422, `Exigence « ${p.requirementId} » absente de cette version publiée.`);
    }
  }
  private async history(k: Kdb, crit: SupplierCriterion, reason: string, user: SessionUser) {
    await k
      .insertInto('sup_criterion_history')
      .values({
        criterion_id: crit.id,
        version: crit.version,
        snapshot: JSON.stringify(crit),
        reason,
        created_by: user.username,
      })
      .execute();
  }
  private duplicateLabel(e: unknown): never {
    if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'Un critère actif porte déjà ce libellé.');
    throw e;
  }
  async createCriterion(input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'administrer');
    const body = SupplierCriterionBody.parse(input);
    return this.g.db
      .tx(async (c, k) => {
        await this.checkRequirements(body.requirementRefs, k);
        const { id } = await k
          .insertInto('sup_criteria')
          .values({
            label: body.label,
            description: body.description,
            purposes: body.purposes,
            requirement_refs: body.requirementRefs,
            created_by: user.username,
            updated_by: user.username,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const crit = await this.criterion(id, k);
        await this.history(k, crit, 'Critère créé : ' + body.reason, user);
        await this.g.db.audit(user, ip, 'supplier.criterion.created', id, { label: crit.label }, c);
        return crit;
      }, user.username)
      .catch((e: unknown) => this.duplicateLabel(e));
  }
  async updateCriterion(id: string, input: unknown, expected: number, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'administrer');
    const body = SupplierCriterionBody.parse(input);
    return this.g.db
      .tx(async (c, k) => {
        const current = await this.criterion(id, k, true);
        if (current.version !== expected)
          throw new HttpError(412, 'Le critère a changé. Rechargez avant d’enregistrer.');
        if (current.archived) throw new HttpError(409, 'Un critère retiré ne se modifie pas.');
        await this.checkRequirements(body.requirementRefs, k);
        await k
          .updateTable('sup_criteria')
          .set((eb) => ({
            label: body.label,
            description: body.description,
            purposes: body.purposes,
            requirement_refs: body.requirementRefs,
            version: eb('version', '+', 1),
            updated_by: user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', id)
          .execute();
        const crit = await this.criterion(id, k);
        await this.history(k, crit, 'Critère modifié : ' + body.reason, user);
        await this.g.db.audit(user, ip, 'supplier.criterion.updated', id, { version: crit.version }, c);
        return crit;
      }, user.username)
      .catch((e: unknown) => this.duplicateLabel(e));
  }
  /** Retire un critère des nouvelles évaluations ; les évaluations passées gardent son libellé et sa version figés. */
  async archiveCriterion(id: string, expected: number, reason: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'administrer');
    return this.g.db.tx(async (c, k) => {
      const current = await this.criterion(id, k, true);
      if (current.version !== expected) throw new HttpError(412, 'Le critère a changé.');
      if (current.archived) throw new HttpError(409, 'Critère déjà retiré.');
      await k
        .updateTable('sup_criteria')
        .set((eb) => ({
          archived: true,
          version: eb('version', '+', 1),
          updated_by: user.username,
          updated_at: sql<Date>`now()`,
        }))
        .where('id', '=', id)
        .execute();
      const crit = await this.criterion(id, k);
      await this.history(k, crit, 'Critère retiré : ' + reason, user);
      await this.g.db.audit(user, ip, 'supplier.criterion.archived', id, { version: crit.version }, c);
      return crit;
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
    return this.g.db.tx(async (c, k) => {
      const supplier = await this.supplier(supplierId, c);
      // Au moins un élément (schéma .min(1)) : la liste « in » n'est jamais vide.
      const criteria = new Map(
        (
          await criteres(k)
            .where(
              'id',
              'in',
              body.items.map((i) => i.criterionId),
            )
            .forShare()
            .execute()
        ).map((r) => [r.id, critere(r)]),
      );
      for (const item of body.items) {
        const k = criteria.get(item.criterionId);
        if (!k) throw new HttpError(404, 'Critère introuvable.');
        if (k.archived) throw new HttpError(422, `Le critère « ${k.label} » est retiré.`);
      }
      const { id } = await k
        .insertInto('sup_evaluations')
        .values({
          supplier_id: supplierId,
          supplier_name: str(supplier.name),
          evaluated_at: body.evaluatedAt,
          evaluator: user.username,
          conclusion: body.conclusion,
          next_review_at: body.nextReviewAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      for (const item of body.items) {
        const crit = criteria.get(item.criterionId)!;
        await k
          .insertInto('sup_evaluation_items')
          .values({
            evaluation_id: id,
            criterion_id: crit.id,
            criterion_version: crit.version,
            criterion_label: crit.label,
            requirement_refs: crit.requirementRefs,
            meets: item.meets,
            result: item.result,
          })
          .execute();
      }
      await this.g.db.audit(
        user,
        ip,
        'supplier.evaluated',
        supplierId,
        { evaluation: id, items: body.items.length },
        c,
      );
      return this.evaluationIn(id, k);
    }, user.username);
  }
  private async evaluationIn(id: string, k: Kdb) {
    const e = await evaluations(k)
      .select(['e.supplier_name as supplierName', 'e.conclusion'])
      .where('e.id', '=', id)
      .executeTakeFirstOrThrow();
    const items = await k
      .selectFrom('sup_evaluation_items')
      .select([
        'criterion_id as criterionId',
        'criterion_version as criterionVersion',
        'criterion_label as criterionLabel',
        'requirement_refs as requirementRefs',
        'meets',
        'result',
      ])
      .where('evaluation_id', '=', id)
      .orderBy(sql`lower(criterion_label)`)
      .orderBy('id')
      .execute();
    const { supplierName, conclusion, ...r } = e;
    return { ...resume(r), supplierName, conclusion, items };
  }
  /** Historique complet des évaluations d'un fournisseur, la plus récente d'abord (la première est la courante). */
  async evaluations(supplierId: string, user: SessionUser) {
    await this.g.permission(user, 'fournisseurs', 'lire');
    const k = this.g.db.k;
    const ids = await k
      .selectFrom('sup_evaluations')
      .select('id')
      .where('supplier_id', '=', supplierId)
      .orderBy('evaluated_at', 'desc')
      .orderBy('created_at', 'desc')
      .limit(200)
      .execute();
    const out = [];
    for (const { id } of ids) out.push(await this.evaluationIn(id, k));
    return out;
  }

  /* ------------------------------------------------------------------ Suite d'une évaluation (D11) */
  /** Crée, dans le périmètre choisi, une action liée au fournisseur ou une série de réévaluation qui le référence.
      L'évaluation reste sans périmètre : seul l'objet créé en dépend. Droits : fournisseurs:modifier et ecarts:modifier. */
  async followUp(supplierId: string, evaluationId: string, input: unknown, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    const body = SupplierFollowUpBody.parse(input);
    const scope = await this.g.access(body.smsi, user, true);
    const evaluation = await this.g.db.k
      .selectFrom('sup_evaluations')
      .select(['id', 'supplier_name', sql<string>`evaluated_at::text`.as('evaluated_at')])
      .where('id', '=', evaluationId)
      .where('supplier_id', '=', supplierId)
      .executeTakeFirst();
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
    return this.g.db.tx(async (c, k) => {
      await this.g.access(smsi, user, true, c);
      await this.supplier(supplierId, c);
      const r = await k
        .insertInto('sup_scope_links')
        .values({ smsi_id: smsi, supplier_id: supplierId, attached_by: user.username })
        .onConflict((oc) => oc.doNothing())
        .executeTakeFirst();
      if (!Number(r.numInsertedOrUpdatedRows ?? 0n))
        throw new HttpError(409, 'Fournisseur déjà rattaché à ce périmètre.');
      await this.g.db.audit(user, ip, 'supplier.attached', supplierId, { smsi }, c);
      return { smsiId: smsi, supplierId };
    }, user.username);
  }
  /** Retire seulement le rattachement : ni le fournisseur ni ses évaluations ne sont touchés. */
  async detach(smsi: string, supplierId: string, user: SessionUser, ip: string) {
    await this.g.permission(user, 'fournisseurs', 'modifier');
    await this.g.db.tx(async (c, k) => {
      await this.g.access(smsi, user, true, c);
      const r = await k
        .deleteFrom('sup_scope_links')
        .where('smsi_id', '=', smsi)
        .where('supplier_id', '=', supplierId)
        .executeTakeFirst();
      if (!Number(r.numDeletedRows)) throw new HttpError(404, 'Rattachement introuvable.');
      await this.g.db.audit(user, ip, 'supplier.detached', supplierId, { smsi }, c);
    }, user.username);
  }
  /** Lecture par périmètre, sans copie : la même évaluation courante quel que soit le périmètre. */
  async forScope(smsi: string, user: SessionUser) {
    await this.g.permission(user, 'fournisseurs', 'lire');
    const scope = await this.g.access(smsi, user);
    const links = new Set(
      (await this.g.db.k.selectFrom('sup_scope_links').select('supplier_id').where('smsi_id', '=', smsi).execute()).map(
        (l) => l.supplier_id,
      ),
    );
    const { suppliers } = await this.registry();
    const current = new Map((await this.current()).map((e) => [e.supplierId, e]));
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
