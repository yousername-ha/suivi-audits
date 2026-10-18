/* Schéma Drizzle : reflet exact des tables créées par migrations/*.sql (un test compare avec la base réelle).
   Les migrations restent écrites en SQL et versionnées (ADR 0004) ; ce fichier sert au typage des requêtes. */
import {
  bigint,
  bigserial,
  boolean,
  customType,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
const inet = customType<{ data: string; driverData: string }>({ dataType: () => 'inet' });
const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const schemaMigrations = pgTable('schema_migrations', {
  name: text('name').primaryKey(),
  appliedAt: tstz('applied_at').notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull(),
  displayName: text('display_name').notNull().default(''),
  email: text('email').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  totpSecret: bytea('totp_secret'),
  totpPending: bytea('totp_pending'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  totpLastStep: bigint('totp_last_step', { mode: 'number' }).notNull().default(0),
  disabled: boolean('disabled').notNull().default(false),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: tstz('locked_until'),
  lastLoginAt: tstz('last_login_at'),
  passwordChangedAt: tstz('password_changed_at').notNull().defaultNow(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  expiresAt: tstz('expires_at'),
  preferences: jsonb('preferences').notNull().default({}),
});

/* ---------------------------------------------------------------- Écrans muraux (migration 004) */
export const wallScreens = pgTable('wall_screens', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  modules: text('modules').array().notNull(),
  activationHash: bytea('activation_hash'),
  activationExpires: tstz('activation_expires'),
  deviceHash: bytea('device_hash').unique(),
  activatedAt: tstz('activated_at'),
  expiresAt: tstz('expires_at').notNull(),
  revokedAt: tstz('revoked_at'),
  revokedBy: text('revoked_by'),
  lastSeenAt: tstz('last_seen_at'),
  lastIp: inet('last_ip'),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
});

/* ---------------------------------------------------------------- Droits (migration 003) */
export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  system: boolean('system').notNull().default(false),
  permissions: text('permissions').array().notNull().default([]),
  basedOn: text('based_on'),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().default(''),
  updatedBy: text('updated_by').notNull().default(''),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
});
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().default(''),
  updatedBy: text('updated_by').notNull().default(''),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
});
export const groupRoles = pgTable(
  'group_roles',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.roleId] })],
);
export const userGroups = pgTable(
  'user_groups',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    modules: text('modules').array(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const sessions = pgTable('sessions', {
  idHash: bytea('id_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  csrf: text('csrf').notNull(),
  mfaOk: boolean('mfa_ok').notNull().default(false),
  ip: inet('ip'),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: tstz('created_at').notNull().defaultNow(),
  lastSeenAt: tstz('last_seen_at').notNull().defaultNow(),
  expiresAt: tstz('expires_at').notNull(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ts: tstz('ts').notNull().defaultNow(),
  userId: uuid('user_id'),
  username: text('username').notNull().default(''),
  ip: inet('ip'),
  action: text('action').notNull(),
  target: text('target').notNull().default(''),
  details: jsonb('details').notNull().default({}),
});

export const importBatches = pgTable('import_batches', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  filename: text('filename').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  sha256: text('sha256').notNull(),
  sourceSchema: integer('source_schema').notNull(),
  envelope: boolean('envelope').notNull().default(false),
  mode: text('mode', { enum: ['init', 'merge', 'replace'] }).notNull(),
  module: text('module'),
  modules: text('modules').array().notNull().default([]),
  report: jsonb('report').notNull(),
  rawKeyId: text('raw_key_id').notNull(),
  rawIv: bytea('raw_iv').notNull(),
  rawTag: bytea('raw_tag').notNull(),
  rawContent: bytea('raw_content').notNull(),
  beforeState: jsonb('before_state').notNull(),
  afterState: jsonb('after_state').notNull(),
  stateVersionBefore: integer('state_version_before'),
  stateVersionAfter: integer('state_version_after'),
  status: text('status', { enum: ['applied', 'undone'] })
    .notNull()
    .default('applied'),
  undoneAt: tstz('undone_at'),
  undoneBy: text('undone_by'),
  version: integer('version').notNull().default(1),
});

export const appState = pgTable('app_state', {
  id: smallint('id').primaryKey().default(1),
  version: integer('version').notNull(),
  data: jsonb('data').notNull(),
  sha256: text('sha256').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by').notNull().default(''),
  importBatchId: bigint('import_batch_id', { mode: 'number' }).references(() => importBatches.id, {
    onDelete: 'set null',
  }),
});

export const stateHistory = pgTable('state_history', {
  version: integer('version').primaryKey(),
  data: jsonb('data').notNull(),
  sha256: text('sha256').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
  note: text('note').notNull().default(''),
  importBatchId: bigint('import_batch_id', { mode: 'number' }).references(() => importBatches.id, {
    onDelete: 'set null',
  }),
});

/** Colonnes communes à toutes les tables métier (concurrence et traçabilité de l'import legacy). */
const businessColumns = () => ({
  version: integer('version').notNull().default(1),
  legacyId: text('legacy_id'),
  importBatchId: bigint('import_batch_id', { mode: 'number' }).references(() => importBatches.id, {
    onDelete: 'set null',
  }),
  extra: jsonb('extra').notNull().default({}),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default(''),
  refs: text('refs').array().notNull().default([]),
  tags: text('tags').array().notNull().default([]),
  classification: text('classification', { enum: ['public', 'interne', 'restreint', 'confidentiel'] })
    .notNull()
    .default('interne'),
  currentVersion: integer('current_version').notNull().default(0),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  deletedAt: tstz('deleted_at'),
  deletedBy: text('deleted_by'),
  ...businessColumns(),
});

export const documentVersions = pgTable(
  'document_versions',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    keyId: text('key_id').notNull(),
    iv: bytea('iv').notNull(),
    authTag: bytea('auth_tag').notNull(),
    content: bytea('content').notNull(),
    scanStatus: text('scan_status').notNull().default('non_analysé'),
    uploadedBy: text('uploaded_by').notNull(),
    uploadedAt: tstz('uploaded_at').notNull().defaultNow(),
    comment: text('comment').notNull().default(''),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.version] })],
);

export const links = pgTable('links', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default(''),
  refs: text('refs').array().notNull().default([]),
  tags: text('tags').array().notNull().default([]),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  deletedAt: tstz('deleted_at'),
  deletedBy: text('deleted_by'),
  ...businessColumns(),
});

/* ---------------------------------------------------------------- Cartographie (migration 005, ADR 0013) */
export const maps = pgTable('maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  view: text('view', { enum: ['context', 'process'] }).notNull(),
  name: text('name').notNull(),
  layout: jsonb('layout').notNull(),
  settings: jsonb('settings').notNull().default({}),
  createdAt: tstz('created_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by').notNull(),
  ...businessColumns(),
});

export const mapVersions = pgTable('map_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id')
    .notNull()
    .references(() => maps.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  layout: jsonb('layout').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  legacyId: text('legacy_id'),
  importBatchId: bigint('import_batch_id', { mode: 'number' }).references(() => importBatches.id, {
    onDelete: 'set null',
  }),
  extra: jsonb('extra').notNull().default({}),
});

/** Tables métier : chacune porte version, legacy_id, import_batch_id et extra (vérifié par les tests). */
export const BUSINESS_TABLES = { documents, links, maps } as const;

export const backupWorker = pgTable('backup_worker', {
  id: integer('id').primaryKey(),
  seenAt: tstz('seen_at').notNull(),
  ready: boolean('ready').notNull(),
  message: text('message').notNull(),
});
export const backupJobs = pgTable('backup_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().unique(),
  status: text('status').notNull().default('en_attente'),
  requestedBy: text('requested_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  startedAt: tstz('started_at'),
  finishedAt: tstz('finished_at'),
  version: integer('version').notNull().default(1),
  report: jsonb('report'),
  message: text('message').notNull().default(''),
});

/** Lot A : suivi opérationnel, sans duplication des objets métier. */
export const backupPolicy = pgTable('backup_policy', {
  id: integer('id').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  hourUtc: integer('hour_utc').notNull().default(2),
  minuteUtc: integer('minute_utc').notNull().default(15),
  days: integer('days').array().notNull().default([1, 2, 3, 4, 5, 6, 7]),
  retentionDays: integer('retention_days').notNull().default(90),
  version: integer('version').notNull().default(1),
});
export const operationJobs = pgTable('operation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().unique(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('en_attente'),
  requestedBy: text('requested_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  startedAt: tstz('started_at'),
  finishedAt: tstz('finished_at'),
  version: integer('version').notNull().default(1),
  certificateFingerprint: text('certificate_fingerprint'),
  archiveId: text('archive_id'),
  sha256: text('sha256'),
  payload: jsonb('payload').notNull().default({}),
  secret: bytea('secret'),
  phase: text('phase').notNull().default('demande'),
  message: text('message').notNull().default(''),
});
export const operationReceipts = pgTable('operation_receipts', {
  id: uuid('id').primaryKey(),
  status: text('status').notNull(),
});

export const moduleActivation = pgTable('module_activation', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull().default(1),
  disabled: text('disabled').array().notNull().default([]),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by').notNull().default(''),
});

export const updateJobs = pgTable('update_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().unique(),
  kind: text('kind').notNull(),
  target: text('target'),
  status: text('status').notNull().default('queued'),
  requestedBy: text('requested_by').notNull(),
  userId: uuid('user_id').references(() => users.id),
  createdAt: tstz('created_at').notNull().defaultNow(),
  startedAt: tstz('started_at'),
  finishedAt: tstz('finished_at'),
});

export const environmentVersions = pgTable('environment_versions', {
  version: integer('version').primaryKey(),
  definition: jsonb('definition').notNull(),
  reason: text('reason').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
});
export const environmentConfiguration = pgTable('environment_configuration', {
  id: integer('id').primaryKey(),
  version: integer('version')
    .notNull()
    .references(() => environmentVersions.version),
});
export const riskAssessments = pgTable('risk_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().unique(),
  sourceId: text('source_id').notNull(),
  sourceSha: text('source_sha').notNull(),
  sourceSnapshot: jsonb('source_snapshot').notNull(),
  configurationVersion: integer('configuration_version')
    .notNull()
    .references(() => environmentVersions.version),
  revision: integer('revision').notNull(),
  ratings: jsonb('ratings').notNull(),
  result: jsonb('result').notNull(),
  previewId: text('preview_id').notNull(),
  rationale: text('rationale').notNull(),
  userId: uuid('user_id').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
});

/* Socle métier et publications immuables du pilotage SMSI (012–013). */
export const businessPolicyVersions = pgTable('business_policy_versions', {
  version: integer('version').primaryKey(),
  definition: jsonb('definition').notNull(),
  reason: text('reason').notNull(),
  createdAt: tstz('created_at').notNull(),
  createdBy: text('created_by').notNull(),
});
export const businessPolicyConfiguration = pgTable('business_policy_configuration', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull(),
});
export const grcSmsis = pgTable('grc_smsis', {
  riskMethodId: uuid('risk_method_id'),
  riskMethodVersion: integer('risk_method_version'),
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
  nature: text('nature').notNull(),
  parentId: uuid('parent_id'),
  entityKind: text('entity_kind').notNull(),
  inheritFrameworks: boolean('inherit_frameworks').notNull(),
  visibility: text('visibility').notNull(),
  timezone: text('timezone').notNull(),
  businessVersion: integer('business_version').notNull(),
  version: integer('version').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
});
export const grcMembers = pgTable('grc_members', {
  smsiId: uuid('smsi_id').notNull(),
  userId: uuid('user_id').notNull(),
  canWrite: boolean('can_write').notNull(),
});
export const grcObjects = pgTable('grc_objects', {
  id: uuid('id').primaryKey(),
  smsiId: uuid('smsi_id').notNull(),
  kind: text('kind').notNull(),
  module: text('module').notNull(),
  name: text('name').notNull(),
  data: jsonb('data').notNull(),
  version: integer('version').notNull(),
  archived: boolean('archived').notNull(),
  legacyKey: text('legacy_key'),
  legacyId: text('legacy_id'),
  importBatchId: bigint('import_batch_id', { mode: 'number' }),
  extra: jsonb('extra').notNull(),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
});
export const grcObjectVersions = pgTable('grc_object_versions', {
  id: uuid('id').primaryKey(),
  objectId: uuid('object_id').notNull(),
  smsiId: uuid('smsi_id').notNull(),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const grcLinks = pgTable('grc_links', {
  id: uuid('id').primaryKey(),
  smsiId: uuid('smsi_id').notNull(),
  sourceId: uuid('source_id'),
  sourceRef: text('source_ref').notNull(),
  targetRef: text('target_ref').notNull(),
  type: text('type').notNull(),
  note: text('note').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const grcFrameworkVersions = pgTable('grc_framework_versions', {
  id: uuid('id').primaryKey(),
  frameworkId: uuid('framework_id').notNull(),
  smsiId: uuid('smsi_id').notNull(),
  version: integer('version').notNull(),
  definition: jsonb('definition').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const libFrameworks = pgTable('lib_frameworks', {
  id: uuid('id').primaryKey(),
  identifier: text('identifier').notNull(),
  name: text('name').notNull(),
  version: integer('version').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: tstz('updated_at').notNull(),
});
export const libFrameworkVersions = pgTable('lib_framework_versions', {
  id: uuid('id').primaryKey(),
  frameworkId: uuid('framework_id').notNull(),
  version: integer('version').notNull(),
  definition: jsonb('definition').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const grcScopeFrameworks = pgTable('grc_scope_frameworks', {
  smsiId: uuid('smsi_id').notNull(),
  frameworkId: uuid('framework_id').notNull(),
  version: integer('version').notNull(),
  enabled: boolean('enabled').notNull(),
  attachedBy: text('attached_by').notNull(),
  attachedAt: tstz('attached_at').notNull(),
});
export const libFrameworkPromotions = pgTable('lib_framework_promotions', {
  sourceFrameworkId: uuid('source_framework_id').notNull(),
  sourceVersion: integer('source_version').notNull(),
  smsiId: uuid('smsi_id').notNull(),
  libraryFrameworkId: uuid('library_framework_id').notNull(),
  libraryVersion: integer('library_version').notNull(),
  promotedBy: text('promoted_by').notNull(),
  promotedAt: tstz('promoted_at').notNull(),
});
export const libMappings = pgTable('lib_mappings', {
  id: uuid('id').primaryKey(),
  sourceFrameworkId: uuid('source_framework_id').notNull(),
  sourceVersion: integer('source_version').notNull(),
  sourceRequirementId: text('source_requirement_id').notNull(),
  targetFrameworkId: uuid('target_framework_id').notNull(),
  targetVersion: integer('target_version').notNull(),
  targetRequirementId: text('target_requirement_id').notNull(),
  type: text('type').notNull(),
  justification: text('justification').notNull(),
  coverage: integer('coverage').notNull(),
  origin: text('origin').notNull(),
  status: text('status').notNull(),
  sourceUrl: text('source_url').notNull(),
  reviewNote: text('review_note').notNull(),
  version: integer('version').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  validatedBy: text('validated_by'),
  validatedAt: tstz('validated_at'),
});
export const libMappingHistory = pgTable('lib_mapping_history', {
  id: uuid('id').primaryKey(),
  mappingId: uuid('mapping_id').notNull(),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const grcRapprochements = pgTable('grc_rapprochements', {
  id: uuid('id').primaryKey(),
  smsiId: uuid('smsi_id').notNull(),
  measureRef: text('measure_ref').notNull(),
  sourceRef: text('source_ref').notNull(),
  targetRef: text('target_ref').notNull(),
  mappingId: uuid('mapping_id').notNull(),
  mappingType: text('mapping_type').notNull(),
  coverage: integer('coverage').notNull(),
  status: text('status').notNull(),
  decidedBy: text('decided_by'),
  decidedAt: tstz('decided_at'),
  decisionNote: text('decision_note').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const supCriteria = pgTable('sup_criteria', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull(),
  description: text('description').notNull().default(''),
  purposes: text('purposes').array().notNull().default([]),
  requirementRefs: text('requirement_refs').array().notNull().default([]),
  version: integer('version').notNull().default(1),
  archived: boolean('archived').notNull().default(false),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
});
export const supCriterionHistory = pgTable('sup_criterion_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  criterionId: uuid('criterion_id').notNull(),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
});
export const supEvaluations = pgTable('sup_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  evaluatedAt: date('evaluated_at').notNull(),
  evaluator: text('evaluator').notNull(),
  conclusion: text('conclusion').notNull().default(''),
  nextReviewAt: date('next_review_at'),
  createdAt: tstz('created_at').notNull().defaultNow(),
});
export const supEvaluationItems = pgTable('sup_evaluation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  evaluationId: uuid('evaluation_id').notNull(),
  criterionId: uuid('criterion_id').notNull(),
  criterionVersion: integer('criterion_version').notNull(),
  criterionLabel: text('criterion_label').notNull(),
  requirementRefs: text('requirement_refs').array().notNull().default([]),
  meets: boolean('meets'),
  result: text('result').notNull().default(''),
});
export const supScopeLinks = pgTable(
  'sup_scope_links',
  {
    smsiId: uuid('smsi_id').notNull(),
    supplierId: text('supplier_id').notNull(),
    attachedBy: text('attached_by').notNull(),
    attachedAt: tstz('attached_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.smsiId, t.supplierId] })],
);
export const grcMethodVersions = pgTable('grc_method_versions', {
  id: uuid('id').primaryKey(),
  methodId: uuid('method_id').notNull(),
  smsiId: uuid('smsi_id').notNull(),
  version: integer('version').notNull(),
  definition: jsonb('definition').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const grcRiskEvaluations = pgTable('grc_risk_evaluations', {
  id: uuid('id').primaryKey(),
  riskId: uuid('risk_id').notNull(),
  smsiId: uuid('smsi_id').notNull(),
  methodVersionId: uuid('method_version_id').notNull(),
  revision: integer('revision').notNull(),
  riskSnapshot: jsonb('risk_snapshot').notNull(),
  ratings: jsonb('ratings').notNull(),
  result: jsonb('result').notNull(),
  rationale: text('rationale').notNull(),
  decision: text('decision').notNull(),
  requestId: uuid('request_id').notNull(),
  userId: uuid('user_id').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const grcSeries = pgTable('grc_series', {
  objectId: uuid('object_id').primaryKey(),
  checkedAt: tstz('checked_at'),
  nextIndex: integer('next_index').notNull(),
});
export const grcOccurrences = pgTable('grc_occurrences', {
  seriesId: uuid('series_id').notNull(),
  slot: text('slot').notNull(),
  actionId: uuid('action_id').notNull(),
  createdAt: tstz('created_at').notNull(),
});
export const grcNotifications = pgTable('grc_notifications', {
  id: uuid('id').primaryKey(),
  smsiId: uuid('smsi_id').notNull(),
  objectId: uuid('object_id').notNull(),
  userId: uuid('user_id').notNull(),
  kind: text('kind').notNull(),
  dueKey: text('due_key').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  readAt: tstz('read_at'),
  createdAt: tstz('created_at').notNull(),
});

export const pilotageDecisions = pgTable('pilotage_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  smsiId: uuid('smsi_id')
    .notNull()
    .references(() => grcSmsis.id),
  sourceRef: text('source_ref').notNull(),
  sourceVersion: integer('source_version').notNull(),
  operation: text('operation').notNull(),
  step: text('step').notNull().default(''),
  result: text('result').notNull(),
  performedOn: date('performed_on').notNull(),
  note: text('note').notNull(),
  refs: jsonb('refs').notNull().default([]),
  snapshot: jsonb('snapshot').notNull(),
  generatedRefs: jsonb('generated_refs').notNull().default([]),
  terms: jsonb('terms').notNull().default({}),
  requestId: uuid('request_id').notNull().unique(),
  intentHash: text('intent_hash').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
});

/* Catalogue de configuration GRC transversal (migration 021, ADR 0038). */
export const cfgItems = pgTable('cfg_items', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  key: text('key').notNull(),
  scope: text('scope').notNull(),
  smsiId: uuid('smsi_id'),
  state: text('state').notNull(),
  draft: jsonb('draft'),
  currentVersion: integer('current_version'),
  derivedFromId: uuid('derived_from_id'),
  derivedFromVersion: integer('derived_from_version'),
  origin: jsonb('origin').notNull(),
  version: integer('version').notNull(),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
});
export const cfgVersions = pgTable(
  'cfg_versions',
  {
    itemId: uuid('item_id').notNull(),
    version: integer('version').notNull(),
    definition: jsonb('definition').notNull(),
    reason: text('reason').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.version] })],
);
export const cfgUsages = pgTable(
  'cfg_usages',
  {
    itemId: uuid('item_id').notNull(),
    itemVersion: integer('item_version').notNull(),
    consumerKind: text('consumer_kind').notNull(),
    consumerId: text('consumer_id').notNull(),
    consumerVersion: integer('consumer_version').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.itemVersion, t.consumerKind, t.consumerId, t.consumerVersion] })],
);

/* Plan d'investissement (ADR 0040) : réglages de l'année de référence et lignes budgétaires. */
export const investSettings = pgTable('invest_settings', {
  id: smallint('id').primaryKey().default(1),
  baseYear: integer('base_year').notNull(),
  extra: jsonb('extra').notNull().default({}),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
});

export const investLines = pgTable('invest_lines', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  position: integer('position').notNull(),
  id: text('id'),
  company: text('company').notNull().default(''),
  priority: text('priority').notNull().default(''),
  type: text('type').notNull().default(''),
  description: text('description').notNull().default(''),
  n0: doublePrecision('n0').notNull().default(0),
  n1: doublePrecision('n1').notNull().default(0),
  n2: doublePrecision('n2').notNull().default(0),
  comment: text('comment').notNull().default(''),
  alt: text('alt').notNull().default(''),
  account: text('account').notNull().default(''),
  perimeter: text('perimeter').notNull().default(''),
  status: text('status').notNull().default('À qualifier'),
  nature: text('nature').notNull().default('Abonnement'),
  renewal: text('renewal').notNull().default(''),
  notice: integer('notice').notNull().default(60),
  supplier: text('supplier').notNull().default(''),
  extra: jsonb('extra').notNull().default({}),
});

/* Collections de l'outil de suivi reprises en tables (ADR 0040, lot H2b). */
export const suiviPresence = pgTable('suivi_presence', { cle: text('cle').primaryKey() });

export const suiviIncidents = pgTable('suivi_incidents', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  position: integer('position').notNull(),
  id: text('id'),
  detectedAt: text('detected_at'),
  reporter: text('reporter'),
  title: text('title'),
  description: text('description'),
  kind: text('kind'),
  category: text('category'),
  impact: text('impact'),
  urgency: text('urgency'),
  status: text('status'),
  owner: text('owner'),
  actions: text('actions'),
  cause: text('cause'),
  resolvedAt: text('resolved_at'),
  retex: text('retex'),
  answers: jsonb('answers'),
  notified: jsonb('notified'),
  findingId: text('finding_id'),
  createdIso: text('created_iso'),
  extra: jsonb('extra').notNull().default({}),
});

export const suiviPlans = pgTable('suivi_plans', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  position: integer('position').notNull(),
  id: text('id'),
  type: text('type'),
  title: text('title'),
  kind: text('kind'),
  dateStart: text('date_start'),
  dateEnd: text('date_end'),
  done: text('done'),
  status: text('status'),
  owner: text('owner'),
  provider: text('provider'),
  audience: text('audience'),
  notes: text('notes'),
  proof: text('proof'),
  planned: text('planned'),
  attended: text('attended'),
  duration: text('duration'),
  participation: text('participation'),
  success: text('success'),
  indicator: text('indicator'),
  items: jsonb('items'),
  scope: text('scope'),
  auditor: text('auditor'),
  scenario: text('scenario'),
  systems: text('systems'),
  objectives: text('objectives'),
  result: text('result'),
  retex: text('retex'),
  findings: jsonb('findings'),
  pushedAt: text('pushed_at'),
  createdIso: text('created_iso'),
  extra: jsonb('extra').notNull().default({}),
});

export const suiviAccessReviews = pgTable('suivi_access_reviews', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  position: integer('position').notNull(),
  id: text('id'),
  app: text('app'),
  supplier: text('supplier'),
  month: text('month'),
  freq: doublePrecision('freq'),
  source: text('source'),
  comment: text('comment'),
  extra: jsonb('extra').notNull().default({}),
});

export const suiviAppGaps = pgTable('suivi_app_gaps', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  position: integer('position').notNull(),
  id: text('id'),
  name: text('name'),
  supplier: text('supplier'),
  dscp: text('dscp'),
  cloud: text('cloud'),
  status: text('status'),
  owner: text('owner'),
  target: text('target'),
  description: text('description'),
  lines: jsonb('lines'),
  custom: jsonb('custom'),
  planFd: text('plan_fd'),
  profile: jsonb('profile'),
  profileAt: text('profile_at'),
  extra: jsonb('extra').notNull().default({}),
});

export const suiviClausierEvals = pgTable('suivi_clausier_evals', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  position: integer('position').notNull(),
  id: text('id'),
  supplier: text('supplier'),
  product: text('product'),
  evalDate: text('eval_date'),
  evaluator: text('evaluator'),
  source: text('source'),
  cases: jsonb('cases'),
  answers: jsonb('answers'),
  extra: jsonb('extra').notNull().default({}),
});
