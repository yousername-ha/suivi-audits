import crypto from 'node:crypto';
import {
  GRC_MODULES,
  REGISTRE_KINDS,
  registreKindOf,
  ContributionAction,
  GrcObjectBody,
  GrcRef,
  grcReferences,
  TaskData,
  SeriesData,
  RiskData,
  MappingData,
  PILOTAGE_SCHEMAS,
  GRC_LABELS,
  cibleAutorisee,
  referencesTypees,
  RISK_REF_KINDS,
  relationAutorisee,
  RELATIONS,
  StudyConfiguration,
  effectivePermissions,
  MESSAGES_REFUS,
  refusRattachement,
  type NiveauPerimetre,
  type NoeudPerimetre,
  type RattachementReferentiel,
  type Permission,
  type GrcKind,
  type GrcObject,
  type SmsiUpdate,
  type Action,
  type CfgRef,
  type Module,
  type RiskMethod,
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
import { GrcLibrary } from './library.js';
import { GrcKitIa } from './kit-ia.js';
import { GrcLibraryMappings } from './library-mappings.js';
import { GrcEvaluationsExigences } from './evaluations-exigences.js';
import { GrcRapprochements } from './rapprochements.js';
import { GrcSuppliers } from './suppliers.js';
import { GrcRisks } from './risks.js';
import { GrcStudyConfig } from './study-config.js';
import { LegacyTasks } from './legacy-tasks.js';
import { GrcRegistres } from './registres.js';
import { GrcContributions } from './contributions.js';
import { GrcParcours } from './parcours.js';
import { GrcValidations } from './validations.js';
import { GrcAnnuaires } from './annuaires.js';
import { GrcTasks } from './tasks.js';
export const DEFAULT_SMSI = '00000000-0000-4000-8000-000000000001';
/** Champs de liaison typés des risques (sauf l'appartenance à l'étude, trop large pour un lien) : une fiche citée par l'un
    d'eux affiche ce lien dans l'autre sens (mesure ou exigence → traitement, risque → traitement…). */
const CHAMPS_LIES = [
  ...new Set(
    Object.values(RISK_REF_KINDS)
      .flatMap((champs) => Object.keys(champs ?? {}))
      .filter((c) => c !== 'studyRef'),
  ),
];
/** Fiche de l'outil de suivi propre au périmètre commun. Les fournisseurs (`legacy:suppliers:`) sont à l'échelle de
    l'organisation (ADR 0032) : ils se relient depuis n'importe quel périmètre. */
const ficheHistorique = (ref: string) => ref.startsWith('legacy:') && !ref.startsWith('legacy:suppliers:');
/** Droits qui rendent un compte éligible comme responsable d'une fiche du pilotage. */
const LECTURE_PILOTAGE: Permission[] = [
  'pilotage:lire',
  'ecarts:lire',
  'audit:lire',
  'plan_audit:lire',
  'conformite:lire',
];
export const objectColumns = `id,smsi_id AS "smsiId",kind,name,data,version,archived,legacy_key AS "legacyKey",legacy_id AS "legacyId",registre_id AS "registreId",created_by AS "createdBy",updated_by AS "updatedBy",created_at AS "createdAt",updated_at AS "updatedAt"`;
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
  nature: string;
  parentId: string | null;
  entityKind: NiveauPerimetre;
  inheritFrameworks: boolean;
  visibility: 'instance' | 'restricted';
  timezone: string;
  businessVersion: number;
  riskMethodId: string | null;
  riskMethodVersion: number | null;
  version: number;
  createdBy: string;
}
const smsiColumns = `s.id,s.name,s.scope,s.nature,s.parent_id AS "parentId",s.entity_kind AS "entityKind",s.inherit_frameworks AS "inheritFrameworks",s.visibility,s.timezone,s.business_version AS "businessVersion",s.risk_method_id AS "riskMethodId",s.risk_method_version AS "riskMethodVersion",s.version,s.created_by AS "createdBy"`;
/** Résolution des épinglages d'une méthode de risque sur le catalogue de configuration (ADR 0038), branchée par services.ts. */
export interface MethodBindingsResolver {
  resolveMethod(
    smsi: string,
    method: RiskMethod,
    c?: Client,
    already?: CfgRef[],
  ): Promise<{ definition: RiskMethod; refs: CfgRef[] }>;
  pinnedRefs(method: RiskMethod | undefined): CfgRef[];
  checkAnalysisPin(
    smsi: string,
    ref: CfgRef,
    kind: 'scale' | 'matrix' | 'mapping',
    family: 'ebios_rm' | 'iso27005' | 'mehari' | 'custom',
    already: CfgRef | null,
    c: Client,
  ): Promise<void>;
  recordUsage(
    c: Client,
    user: { username: string },
    consumer: { kind: 'method_version' | 'analysis'; id: string; version: number },
    refs: CfgRef[],
  ): Promise<void>;
}
/** Éléments du catalogue épinglés par une étude (champ facultatif `configuration`) : matrice de pertinence et correspondance
    impact → gravité. */
const studyPins = (data: Record<string, unknown>): { ref: CfgRef; kind: 'matrix' | 'mapping' | 'scale' }[] => {
  const c = StudyConfiguration.safeParse(data.configuration);
  if (!c.success) return [];
  return [
    ...(c.data.relevanceMatrix ? [{ ref: c.data.relevanceMatrix, kind: 'matrix' as const }] : []),
    ...(c.data.severityMapping ? [{ ref: c.data.severityMapping, kind: 'mapping' as const }] : []),
    ...(c.data.likelihoodScale ? [{ ref: c.data.likelihoodScale, kind: 'scale' as const }] : []),
    ...(c.data.scenarioSeverityScale ? [{ ref: c.data.scenarioSeverityScale, kind: 'scale' as const }] : []),
  ];
};
export class Grc {
  methodBindings?: MethodBindingsResolver;
  readonly legacyTasks: LegacyTasks;
  readonly frameworks: GrcFrameworks;
  readonly library: GrcLibrary;
  readonly libraryMappings: GrcLibraryMappings;
  readonly kitIa: GrcKitIa;
  readonly rapprochements: GrcRapprochements;
  readonly evaluations: GrcEvaluationsExigences;
  readonly suppliers: GrcSuppliers;
  readonly risks: GrcRisks;
  readonly studyConfig: GrcStudyConfig;
  readonly tasks: GrcTasks;
  readonly registres: GrcRegistres;
  readonly validations: GrcValidations;
  readonly contributions: GrcContributions;
  readonly parcours: GrcParcours;
  readonly annuaires: GrcAnnuaires;
  constructor(
    readonly db: Db,
    readonly legacy: LegacyStore,
    readonly business: BusinessPolicies,
    readonly modules: Modules,
  ) {
    this.legacyTasks = new LegacyTasks(this);
    this.frameworks = new GrcFrameworks(this);
    this.library = new GrcLibrary(this);
    this.libraryMappings = new GrcLibraryMappings(this);
    this.kitIa = new GrcKitIa(this);
    this.rapprochements = new GrcRapprochements(this);
    this.evaluations = new GrcEvaluationsExigences(this);
    this.suppliers = new GrcSuppliers(this);
    this.risks = new GrcRisks(this);
    this.studyConfig = new GrcStudyConfig(this);
    this.tasks = new GrcTasks(this);
    this.registres = new GrcRegistres(this);
    this.validations = new GrcValidations(this);
    this.contributions = new GrcContributions(this);
    this.parcours = new GrcParcours(this);
    this.annuaires = new GrcAnnuaires(this);
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
    // Registres « Pilotage commun » (ADR 0043) : accueillent les éléments du périmètre commun, historiques compris.
    await this.db.tx(async (c) => {
      for (const kind of REGISTRE_KINDS) await this.registres.defautPour(c, DEFAULT_SMSI, kind);
    });
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
      nature: r.nature,
      parentId: r.parentId,
      entityKind: r.entityKind,
      inheritFrameworks: r.inheritFrameworks,
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
  async createSmsi(
    input: {
      name: string;
      scope: string;
      nature: string;
      timezone: string;
      parentId?: string | null;
      entityKind?: NiveauPerimetre;
      inheritFrameworks?: boolean;
    },
    user: SessionUser,
    ip: string,
  ) {
    await this.permission(user, 'pilotage', 'administrer');
    return this.db.tx(async (c) => {
      const parentId = input.parentId ?? null;
      if (parentId) await this.verifierParent('', parentId, user, c);
      const row = (
        await c.query<{ id: string }>(
          `INSERT INTO grc_smsis(name,scope,nature,timezone,parent_id,entity_kind,inherit_frameworks,business_version,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT version FROM business_policy_configuration WHERE id=1),$8) RETURNING id`,
          [
            input.name,
            input.scope,
            input.nature,
            input.timezone,
            parentId,
            input.entityKind ?? 'perimetre',
            parentId ? (input.inheritFrameworks ?? false) : false,
            user.username,
          ],
        )
      ).rows[0]!;
      await c.query('INSERT INTO grc_members(smsi_id,user_id,can_write) VALUES($1,$2,true)', [row.id, user.id]);
      await this.db.audit(user, ip, 'grc.smsi.created', row.id, { parentId }, c);
      if (parentId && input.inheritFrameworks) await this.rapprochements.sync(row.id, c);
      await this.notify(c, row.id, 1, row.id, 'pilotage', user.username);
      return this.access(row.id, user, true, c);
    }, user.username);
  }
  /** Contrôle d'un rattachement : parent connu, accessible en écriture, sans boucle ni profondeur excessive. */
  private async verifierParent(id: string, parentId: string, user: SessionUser, c: Client) {
    // L'accès est contrôlé avant tout le reste : un parent inaccessible reçoit la même réponse qu'un parent inconnu.
    await this.access(parentId, user, true, c).catch((e: unknown) => {
      if (e instanceof HttpError && e.status === 404) throw new HttpError(422, MESSAGES_REFUS.inconnu);
      throw e;
    });
    const noeuds = (
      await c.query<NoeudPerimetre>(
        'SELECT id,parent_id AS "parentId",inherit_frameworks AS "inheritFrameworks" FROM grc_smsis',
      )
    ).rows;
    const refus = refusRattachement(noeuds, id, parentId);
    if (refus) throw new HttpError(422, MESSAGES_REFUS[refus]);
  }
  /** Référentiels effectifs d'un périmètre : les siens et ceux hérités (chaîne d'héritage explicite), le plus proche l'emporte. */
  async effectiveFrameworks(smsi: string, c?: Client): Promise<RattachementReferentiel[]> {
    return (
      await (c ?? this.db.pool).query<RattachementReferentiel>(
        `WITH RECURSIVE chaine(id,parent_id,inherit,profondeur) AS (
           SELECT id,parent_id,inherit_frameworks,0 FROM grc_smsis WHERE id=$1
           UNION ALL
           SELECT p.id,p.parent_id,p.inherit_frameworks,c.profondeur+1
             FROM chaine c JOIN grc_smsis p ON p.id=c.parent_id WHERE c.inherit AND c.profondeur<64)
         SELECT DISTINCT ON (s.framework_id) s.framework_id AS "frameworkId",s.version,s.enabled,ch.id AS "origineId"
           FROM chaine ch JOIN grc_scope_frameworks s ON s.smsi_id=ch.id
          ORDER BY s.framework_id,ch.profondeur`,
        [smsi],
      )
    ).rows;
  }
  /** Périmètres qui héritent (directement ou non) des référentiels de `smsi` : à recalculer quand ils changent. */
  async heritiers(smsi: string, c?: Client): Promise<string[]> {
    return (
      await (c ?? this.db.pool).query<{ id: string }>(
        `WITH RECURSIVE d(id,profondeur) AS (
           SELECT id,1 FROM grc_smsis WHERE parent_id=$1 AND inherit_frameworks
           UNION
           SELECT s.id,d.profondeur+1 FROM grc_smsis s JOIN d ON s.parent_id=d.id WHERE s.inherit_frameworks AND d.profondeur<64)
         SELECT DISTINCT id FROM d`,
        [smsi],
      )
    ).rows.map((r) => r.id);
  }
  /** Recalcule les rapprochements du périmètre et de ceux qui héritent de lui. */
  async resynchroniser(smsi: string, c: Client) {
    await this.rapprochements.sync(smsi, c);
    for (const h of await this.heritiers(smsi, c)) await this.rapprochements.sync(h, c);
  }
  /** Modifie le nom, le texte, la nature et le fuseau d'un périmètre (version attendue ; membres et rattachements inchangés). */
  async updateSmsi(id: string, input: SmsiUpdate, expected: number, user: SessionUser, ip: string) {
    await this.permission(user, 'pilotage', 'administrer');
    await this.access(id, user, true);
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM grc_smsis WHERE id=$1 FOR UPDATE', [id]);
      const current = await this.access(id, user, true, c);
      if (current.version !== expected)
        throw new HttpError(412, 'Le périmètre a changé : rechargez-le avant de le modifier.');
      const parentId = input.parentId === undefined ? current.parentId : input.parentId;
      const entityKind = input.entityKind ?? current.entityKind;
      const inheritFrameworks = parentId ? (input.inheritFrameworks ?? current.inheritFrameworks) : false;
      if (parentId !== current.parentId && parentId) await this.verifierParent(id, parentId, user, c);
      await c.query(
        'UPDATE grc_smsis SET name=$2,scope=$3,nature=$4,timezone=$5,parent_id=$6,entity_kind=$7,inherit_frameworks=$8,version=version+1,updated_at=now() WHERE id=$1',
        [id, input.name, input.scope, input.nature, input.timezone, parentId, entityKind, inheritFrameworks],
      );
      const changed: string[] = (['name', 'scope', 'nature', 'timezone'] as const).filter(
        (k) => current[k] !== input[k],
      );
      if (parentId !== current.parentId) changed.push('parentId');
      if (entityKind !== current.entityKind) changed.push('entityKind');
      if (inheritFrameworks !== current.inheritFrameworks) changed.push('inheritFrameworks');
      await this.db.audit(
        user,
        ip,
        'grc.smsi.updated',
        id,
        { changed, previousName: current.name, previousNature: current.nature, previousParentId: current.parentId },
        c,
      );
      if (parentId !== current.parentId || inheritFrameworks !== current.inheritFrameworks)
        await this.resynchroniser(id, c);
      await this.notify(c, id, current.version + 1, id, 'pilotage', user.username);
      return this.access(id, user, false, c);
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
  /** Politique métier épinglée d'un périmètre, sans contrôle d'accès : l'appelant a déjà autorisé l'opération. */
  async politiqueDe(smsi: string, c?: Client) {
    const r = await (c ?? this.db.pool).query<{ v: number }>(
      'SELECT business_version AS v FROM grc_smsis WHERE id=$1',
      [smsi],
    );
    if (!r.rows[0]) throw new HttpError(404, 'Périmètre introuvable.');
    return this.business.version(r.rows[0].v);
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
    const brut = await this.raw(id, c);
    // Élément d'un registre : l'accès suit le registre (droits attribués, module, périmètres), pas un périmètre seul.
    if (brut?.registreId && brut.smsiId === smsi) {
      await this.registres.exigerElement(user, brut, write ? 'gerer' : 'lire', c);
      return brut;
    }
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
    // Éléments des registres partagés avec ce périmètre (référence ailleurs) : visibles aussi ici, une seule fois.
    const partages = ['action', 'nonconformity', 'task_series'].includes(kind)
      ? await this.registres.partagesLisibles(user, smsi)
      : [];
    const dansLePerimetre = partages.length
      ? `(smsi_id=$1 OR registre_id=ANY($${args.push(partages)}::uuid[]))`
      : 'smsi_id=$1';
    let where = `${dansLePerimetre} AND kind=$2 AND NOT archived AND name ILIKE $3`;
    const masques = await this.registres.inaccessibles(user, smsi);
    if (masques.length) where += ` AND (registre_id IS NULL OR registre_id<>ALL($${args.push(masques)}::uuid[]))`;
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
  /** Responsables proposés : comptes actifs du périmètre qui peuvent consulter le pilotage (lot U4). Un compte réduit
      à l'écran mural, aux évaluations IA ou aux documents n'est pas proposé. */
  async owners(smsi: string, user: SessionUser) {
    const s = await this.access(smsi, user);
    const rows = (
      await this.db.q<{ id: string; username: string; displayName: string }>(
        `SELECT u.id,u.username,u.display_name AS "displayName" FROM users u WHERE NOT u.disabled AND (u.expires_at IS NULL OR u.expires_at>now()) AND ( $2 OR EXISTS(SELECT 1 FROM grc_members m WHERE m.smsi_id=$1 AND m.user_id=u.id)) ORDER BY u.username LIMIT 1000`,
        [smsi, s.visibility === 'instance'],
      )
    ).rows;
    const out = [];
    for (const r of rows) {
      const eff = effectivePermissions(await loadGrants(this.db.pool, r.id));
      if (LECTURE_PILOTAGE.some((p) => eff.has(p))) out.push(r);
    }
    return out;
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
      const policy = (await this.politiqueDe(smsi, c)).definition;
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
      await this.annuaires.normaliser(smsi, d, c);
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
      const policy = (await this.politiqueDe(smsi, c)).definition;
      if (!policy.catalogues.actionCategories.some((x) => x.id === d.category))
        throw new HttpError(422, 'Catégorie de récurrence inconnue.');
      await this.annuaires.normaliser(smsi, d, c);
      await this.checkOwner(smsi, d.ownerId, c);
      for (const ref of d.refs) await this.resolve(smsi, ref, user, c);
      return d;
    }
    if (kind === 'risk') {
      const d = RiskData.parse(data);
      await this.checkOwner(smsi, d.ownerId, c);
      await this.checkTypedRefs(smsi, kind, d, user, c);
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
      await this.checkTypedRefs(smsi, kind, data, user, c);
      if (kind === 'risk_study') await this.checkStudyConfiguration(smsi, data, previous, c);
      if (
        kind === 'sr_ov' ||
        kind === 'feared_event' ||
        kind === 'strategic_scenario' ||
        kind === 'operational_scenario'
      )
        await this.studyConfig.verifierNiveaux(smsi, kind, data, previous?.data, c);
      if (kind === 'nonconformity' && previous?.data.status === 'closed')
        throw new HttpError(409, 'Conservez la clôture : rouvrez le constat avec un motif ou créez-en un nouveau.');
      if (kind === 'nonconformity' && previous && data.recidiveRef === 'object:' + previous.id)
        throw new HttpError(422, 'Un constat ne peut pas être la récidive de lui-même.');
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
      if (
        kind === 'nonconformity' &&
        (data.closedAt || data.closureNote || data.effectivenessNote || data.closureOpenLinksReason)
      )
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
  /** Liaison de configuration d'une étude EBIOS RM (ADR 0038) : chaque élément épinglé doit exister, être visible et convenir. */
  private async checkStudyConfiguration(
    smsi: string,
    data: Record<string, unknown>,
    previous: GrcObject | undefined,
    c: Client,
  ) {
    const pins = studyPins(data);
    if (!pins.length) return;
    if (!this.methodBindings) throw new HttpError(503, 'Catalogue de configuration indisponible.');
    const before = previous ? studyPins(previous.data) : [];
    for (const { ref, kind } of pins)
      await this.methodBindings.checkAnalysisPin(
        smsi,
        ref,
        kind,
        'ebios_rm',
        // « Déjà épinglé » : même élément déjà lié par l'étude (un archivage ultérieur ne bloque pas une étude qui l'utilise).
        before.find((x) => x.ref.item === ref.item && x.ref.version === ref.version)?.ref ?? null,
        c,
      );
  }
  /** Usage « analyse » du catalogue : l'étude épingle (élément, version) ; l'enregistrement est immuable. */
  async recordStudyUsage(c: Client, o: GrcObject, user: { username: string }) {
    const pins = o.kind === 'risk_study' ? studyPins(o.data) : [];
    if (pins.length && this.methodBindings)
      await this.methodBindings.recordUsage(
        c,
        user,
        { kind: 'analysis', id: o.id, version: o.version },
        pins.map((x) => x.ref),
      );
  }
  async createObject(smsi: string, input: GrcObjectBody, user: SessionUser, ip: string) {
    const body = GrcObjectBody.parse(input);
    const famille = registreKindOf(body.kind, body.data);
    if (body.registreId && !famille) throw new HttpError(422, 'Ce type d’objet n’appartient à aucun registre.');
    return this.db.tx(async (c) => {
      const registreId = await this.registreDeCreation(c, smsi, body.kind, famille, body.registreId, user);
      const data = await this.normalize(smsi, body.kind, body.data, user, c);
      const o = await this.insert(c, smsi, body.kind, body.name, data, user, ip, registreId);
      await this.recordStudyUsage(c, o, user);
      return o;
    }, user.username);
  }
  /** Registre d'accueil d'une création : celui qui est choisi (gestion du registre exigée, périmètre de référence = périmètre
      de l'URL) ou, sans choix, le registre par défaut (droit de module et accès au périmètre exigés). */
  async registreDeCreation(
    c: Client,
    smsi: string,
    kind: GrcKind,
    famille: ReturnType<typeof registreKindOf>,
    registreId: string | null | undefined,
    user: SessionUser,
  ): Promise<string | null> {
    if (!registreId) {
      await this.access(smsi, user, true, c);
      await this.permission(user, GRC_MODULES[kind], 'modifier');
      return null;
    }
    if (!famille) throw new HttpError(422, 'Ce type d’objet n’appartient à aucun registre.');
    const reg = await this.registres.brut(registreId, c);
    if (!reg || reg.archived) throw new HttpError(404, 'Registre introuvable, archivé ou non accessible.');
    if (reg.kind !== famille || reg.referenceId !== smsi)
      throw new HttpError(422, 'Ce registre n’accueille pas ce type d’élément pour ce périmètre.');
    await this.registres.exiger(user, reg, null, 'gerer', c, GRC_MODULES[kind]);
    return reg.id;
  }
  async insert(
    c: Client,
    smsi: string,
    kind: GrcKind,
    name: string,
    data: unknown,
    user: { id?: string; username: string },
    ip: string,
    registreId: string | null = null,
  ) {
    // Tout élément d'une famille de registre en a un : à défaut de choix, le registre par défaut du périmètre.
    const famille = registreKindOf(kind, isObject(data) ? data : {});
    const registre = famille ? (registreId ?? (await this.registres.defautPour(c, smsi, famille))) : null;
    const row = (
      await c.query<ObjectRow>(
        `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by,registre_id) VALUES($1,$2,$3,$4,$5,$6,$6,$7) RETURNING ${objectColumns}`,
        [smsi, kind, GRC_MODULES[kind], name, data, user.username, registre],
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
      if (body.registreId && body.registreId !== current.registreId)
        throw new HttpError(422, 'Le registre d’un élément ne se change pas par une modification.');
      const data = await this.normalize(smsi, body.kind, body.data, user, c, current);
      const o = await this.write(c, current, body.name, data, user, ip, 'Modification');
      await this.recordStudyUsage(c, o, user);
      return o;
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
  /** Contribution à une action : avancement seulement (statut et compte rendu), jamais la définition de l'élément.
      Réservée aux éléments d'un registre ; le rôle de contributeur suffit, sans droit de modification de module. */
  async contribuer(
    smsi: string,
    id: string,
    input: ContributionAction,
    expected: number,
    user: SessionUser,
    ip: string,
  ) {
    const b = ContributionAction.parse(input);
    return this.db.tx(async (c) => {
      const current = await this.raw(id, c, true);
      if (!current || current.smsiId !== smsi || !current.registreId) throw new HttpError(404, 'Objet introuvable.');
      await this.registres.exigerElement(user, current, 'contribuer', c);
      if (current.kind !== 'action') throw new HttpError(422, 'La contribution concerne les actions.');
      if (current.archived) throw new HttpError(409, 'Fiche archivée.');
      if (current.version !== expected) throw new HttpError(412, 'La fiche a changé. Rechargez avant de confirmer.');
      const policy = (await this.politiqueDe(smsi, c)).definition;
      const etat = policy.statuses.find((s) => s.id === b.status);
      if (!etat) throw new HttpError(422, 'État inconnu de la politique publiée.');
      if (
        current.data.status !== b.status &&
        !policy.transitions.some((t) => t.from === current.data.status && t.to === b.status)
      )
        throw new HttpError(409, 'Cette transition n’est pas autorisée par le workflow.');
      const justification = b.justification ?? String(current.data.justification ?? '');
      if (etat.terminal && justification.trim().length < 10)
        throw new HttpError(422, 'Une clôture doit conserver sa justification.');
      const dependances = Array.isArray(current.data.dependencies) ? (current.data.dependencies as string[]) : [];
      if (etat.terminal && dependances.length) {
        const ouvertes = (
          await c.query<{ s: string }>("SELECT data->>'status' AS s FROM grc_objects WHERE id=ANY($1::uuid[])", [
            dependances,
          ])
        ).rows.filter((r) => !policy.statuses.find((x) => x.id === r.s)?.terminal);
        if (ouvertes.length) throw new HttpError(409, 'Terminez les dépendances avant de clôturer.');
      }
      return this.write(
        c,
        current,
        current.name,
        { ...current.data, status: b.status, justification },
        user,
        ip,
        'Contribution : avancement',
      );
    }, user.username);
  }
  async archive(smsi: string, id: string, expected: number, user: SessionUser, ip: string) {
    return this.db.tx(async (c) => {
      const current = await this.object(smsi, id, user, true, c);
      if (current.registreId) await this.registres.exigerElement(user, current, 'gerer', c, 'supprimer');
      else await this.permission(user, GRC_MODULES[current.kind], 'supprimer');
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
  /** Références typées des risques (lot U3, ADR 0027) : type de la cible, périmètre et droit de lecture vérifiés ;
      les références historiques n'existent que dans le périmètre commun. */
  async checkTypedRefs(smsi: string, kind: GrcKind, data: Record<string, unknown>, user: SessionUser, c?: Client) {
    for (const { champ, ref, cibles } of referencesTypees(kind, data)) {
      if (!GrcRef.safeParse(ref).success) throw new HttpError(422, `Référence invalide (${champ}).`);
      if (ficheHistorique(ref) && smsi !== DEFAULT_SMSI)
        throw new HttpError(422, 'Les fiches historiques ne se relient que dans le périmètre commun.');
      const r = await this.resolve(smsi, ref, user, c);
      if (!cibleAutorisee(ref, ref.startsWith('object:') ? (r.kind as GrcKind) : null, cibles))
        throw new HttpError(422, `Cible non autorisée (${champ}) : ${GRC_LABELS[r.kind as GrcKind] ?? r.kind}.`);
    }
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
    archived?: boolean;
  }> {
    if (ref.startsWith('object:')) {
      const o = await this.object(smsi, ref.slice(7), user, false, c);
      return {
        ref,
        name: o.name,
        module: GRC_MODULES[o.kind],
        kind: o.kind,
        version: o.version,
        data: o.data,
        archived: o.archived,
      };
    }
    if (ref.startsWith('requirement:')) {
      await this.permission(user, 'audit', 'lire');
      const [, id, version, ...rest] = ref.split(':');
      const f = await this.frameworks.version(smsi, id!, Number(version), user, c);
      const r = f.definition.requirements.find((r) => r.id === rest.join(':'));
      if (!r) throw new HttpError(404, 'Exigence publiée introuvable.');
      return { ref, name: r.title, module: 'audit', kind: 'requirement', version: Number(version), data: r };
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
        `SELECT ${objectColumns} FROM grc_objects WHERE smsi_id=$1 AND NOT archived AND (jsonb_path_exists(data,'$.stages.*.values.*[*] ? (@ == $ref)',jsonb_build_object('ref',$2::text)) OR data->'refs' @> $3::jsonb OR data->'documentRefs' @> $3::jsonb OR data->>'auditRef'=$2 OR data->>'recidiveRef'=$2 OR EXISTS (SELECT 1 FROM unnest($4::text[]) f WHERE data->f @> $3::jsonb OR data->>f=$2)) ORDER BY id LIMIT 500`,
        [smsi, ref, JSON.stringify([ref]), CHAMPS_LIES],
      )
    ).rows;
    const historicalParents: { source_ref: string; target_ref: string }[] = [];
    if (smsi === DEFAULT_SMSI) {
      const state = (await this.legacy.recompose())?.data ?? {};
      for (const key of [
        'items',
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
        visible.push({
          ...r,
          sens: r.source_ref === ref ? ('sortant' as const) : ('entrant' as const),
          other: {
            ref: other.ref,
            name: other.name,
            kind: other.kind,
            archived: other.archived === true,
            ...(other.kind === 'requirement'
              ? { applicabilite: await this.applicabiliteExigence(smsi, other.ref, user) }
              : {}),
          },
        });
      } catch {
        /* Aucun libellé ni identifiant inaccessible transmis. */
      }
    }
    return visible;
  }
  /** Applicabilité de l'exigence dans CE périmètre (version courante de son évaluation), pour la lire à côté d'un lien ; un
      lien ne vaut ni couverture ni conformité. Null sans droit de lecture de la conformité ; « non évaluée » sans évaluation. */
  private async applicabiliteExigence(smsi: string, ref: string, user: SessionUser) {
    if (!user.rights.can('conformite', 'lire')) return null;
    const [, frameworkId, , ...rest] = ref.split(':');
    const e = (
      await this.db.q<{ applicability: string }>(
        'SELECT applicability FROM grc_requirement_assessments WHERE smsi_id=$1 AND framework_id=$2 AND requirement_id=$3 ORDER BY version DESC LIMIT 1',
        [smsi, frameworkId, rest.join(':')],
      )
    ).rows[0];
    return e?.applicability ?? 'non_evaluee';
  }
  async link(smsi: string, source: string, target: string, type: string, note: string, user: SessionUser, ip: string) {
    await this.access(smsi, user, true);
    return this.db.tx((c) => this.linkIn(c, smsi, source, target, type, note, user, ip), user.username);
  }
  /** Crée la relation dans la transaction de l'appelant (une décision de rapprochement la partage). */
  async linkIn(
    c: Client,
    smsi: string,
    source: string,
    target: string,
    type: string,
    note: string,
    user: SessionUser,
    ip: string,
  ) {
    {
      await this.access(smsi, user, true, c);
      if (source === target) throw new HttpError(422, 'Une relation relie deux objets distincts.');
      if (smsi !== DEFAULT_SMSI && [source, target].some(ficheHistorique))
        throw new HttpError(
          422,
          'Les données de l’outil de suivi ne se relient que dans le périmètre de l’organisation.',
        );
      const from = await this.resolve(smsi, source, user, c);
      await this.permission(user, from.module, 'modifier');
      const to = await this.resolve(smsi, target, user, c);
      if (from.archived || to.archived)
        throw new HttpError(422, 'Un objet archivé ne reçoit plus de nouvelle relation.');
      if (!relationAutorisee(type, from.kind, to.kind))
        throw new HttpError(
          422,
          `Relation « ${(RELATIONS as Record<string, { libelle: string }>)[type]?.libelle ?? type} » non prévue de ${GRC_LABELS[from.kind as GrcKind] ?? from.kind} vers ${GRC_LABELS[to.kind as GrcKind] ?? to.kind} : choisissez une autre relation ou « Lié à ».`,
        );
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
      await this.rapprochements.sync(smsi, c);
      return r;
    }
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
      await this.rapprochements.sync(smsi, c);
    }, user.username);
  }
}
