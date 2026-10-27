/* Types des tables et vues de la base, générés depuis la base migrée (ADR 0062). NE PAS MODIFIER À LA MAIN :
   pnpm --filter @suivi/api db:types ; la CI régénère ce fichier et échoue s’il diffère. */
import type { ColumnType, Generated } from 'kysely';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface AppState {
  id: Generated<number>;
  version: number;
  data: ColumnType<JsonValue, string, string>;
  sha256: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: Generated<string>;
  import_batch_id: number | null;
}

export interface AuditLog {
  id: Generated<number>;
  ts: ColumnType<Date, Date | string | undefined, Date | string>;
  user_id: string | null;
  username: Generated<string>;
  ip: string | null;
  action: string;
  target: Generated<string>;
  details: ColumnType<JsonValue, string | undefined, string>;
}

export interface BackupJobs {
  id: Generated<string>;
  request_id: string;
  status: Generated<"en_attente" | "en_cours" | "reussie" | "echec" | "annulee">;
  requested_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  started_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  finished_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  version: Generated<number>;
  report: ColumnType<JsonValue | null, string | null, string | null>;
  message: Generated<string>;
}

export interface BackupPolicy {
  id: number;
  enabled: Generated<boolean>;
  hour_utc: Generated<number>;
  minute_utc: Generated<number>;
  days: Generated<number[]>;
  retention_days: Generated<number>;
  version: Generated<number>;
}

export interface BackupWorker {
  id: number;
  seen_at: ColumnType<Date, Date | string, Date | string>;
  ready: boolean;
  message: string;
}

export interface BusinessPolicyConfiguration {
  id: number;
  version: number;
}

export interface BusinessPolicyVersions {
  version: number;
  definition: ColumnType<JsonValue, string, string>;
  reason: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  created_by: string;
}

export interface CalendriersPlateforme {
  id: Generated<string>;
  name: string;
  kind: "feries" | "autre";
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface CalendriersPlateformeJournal {
  seq: Generated<number>;
  calendrier_id: string;
  operation: "creer" | "generer" | "importer" | "retirer_annee" | "supprimer";
  year: number | null;
  days_added: Generated<number>;
  days_removed: Generated<number>;
  provenance: Generated<string>;
  reason: Generated<string>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface CalendriersPlateformeJours {
  calendrier_id: string;
  day: ColumnType<Date, Date | string, Date | string>;
  label: Generated<string>;
  origin: "calcul" | "ical";
  added_by: string;
  added_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface CfgItems {
  id: Generated<string>;
  kind: "scale" | "matrix" | "mapping" | "criteria" | "taxonomy";
  key: string;
  scope: Generated<"instance" | "smsi">;
  smsi_id: string | null;
  state: Generated<"draft" | "active" | "archived">;
  draft: ColumnType<JsonValue | null, string | null, string | null>;
  current_version: number | null;
  derived_from_id: string | null;
  derived_from_version: number | null;
  origin: ColumnType<JsonValue, string | undefined, string>;
  version: Generated<number>;
  created_by: string;
  updated_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface CfgUsages {
  item_id: string;
  item_version: number;
  consumer_kind: "cfg_version" | "method_version" | "analysis";
  consumer_id: string;
  consumer_version: Generated<number>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface CfgVersions {
  item_id: string;
  version: number;
  definition: ColumnType<JsonValue, string, string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface ContributionsElements {
  id: Generated<string>;
  objet_id: string;
  request_id: string;
  seq: number;
  kind: "commentaire" | "preuve";
  comment: Generated<string>;
  proof_ref: Generated<string>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface CourrielJobs {
  id: Generated<string>;
  kind: "test" | "notification";
  status: Generated<"en_attente" | "en_cours" | "reussie" | "echec">;
  requested_by: string;
  to_address: string;
  result: ColumnType<JsonValue | null, string | null, string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  started_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  finished_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  notification_id: string | null;
  user_id: string | null;
  subject: string | null;
  body: string | null;
  attempts: Generated<number>;
  next_attempt_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface DocumentVersions {
  document_id: string;
  version: number;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  key_id: string;
  iv: Buffer;
  auth_tag: Buffer;
  content: Buffer;
  scan_status: Generated<string>;
  uploaded_by: string;
  uploaded_at: ColumnType<Date, Date | string | undefined, Date | string>;
  comment: Generated<string>;
}

export interface Documents {
  id: Generated<string>;
  title: string;
  description: Generated<string>;
  category: Generated<string>;
  refs: Generated<string[]>;
  tags: Generated<string[]>;
  classification: Generated<"public" | "interne" | "restreint" | "confidentiel">;
  current_version: Generated<number>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  deleted_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  deleted_by: string | null;
  version: Generated<number>;
  legacy_id: string | null;
  import_batch_id: number | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface DroitsRessources {
  id: Generated<string>;
  resource_type: "registre" | "objet";
  resource_id: string;
  subject_type: "utilisateur" | "groupe";
  subject_id: string;
  role: "lecteur" | "contributeur" | "gestionnaire";
  granted_by: string;
  granted_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface FonctionMembres {
  fonction_id: string;
  user_id: string;
}

export interface Fonctions {
  id: Generated<string>;
  name: string;
  description: Generated<string>;
  archived: Generated<boolean>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcFrameworkVersions {
  id: Generated<string>;
  framework_id: string;
  smsi_id: string;
  version: number;
  definition: ColumnType<JsonValue, string, string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcLinks {
  id: Generated<string>;
  smsi_id: string;
  source_id: string | null;
  source_ref: string;
  target_ref: string;
  type: string;
  note: Generated<string>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcMembers {
  smsi_id: string;
  user_id: string;
  can_write: Generated<boolean>;
}

export interface GrcMethodVersions {
  id: Generated<string>;
  method_id: string;
  smsi_id: string;
  version: number;
  definition: ColumnType<JsonValue, string, string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcNotifications {
  id: Generated<string>;
  smsi_id: string;
  object_id: string;
  user_id: string;
  kind: string;
  due_key: string;
  title: string;
  message: string;
  read_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  canal_application: Generated<boolean>;
}

export interface GrcObjectVersions {
  id: Generated<string>;
  object_id: string;
  smsi_id: string;
  version: number;
  snapshot: ColumnType<JsonValue, string, string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcObjects {
  id: Generated<string>;
  smsi_id: string;
  kind: string;
  module: string;
  name: string;
  data: ColumnType<JsonValue, string | undefined, string>;
  version: Generated<number>;
  archived: Generated<boolean>;
  legacy_key: string | null;
  legacy_id: string | null;
  import_batch_id: number | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
  created_by: string;
  updated_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  registre_id: string | null;
  rang: number | null;
}

export interface GrcOccurrences {
  series_id: string;
  slot: string;
  action_id: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcRapprochements {
  id: Generated<string>;
  smsi_id: string;
  measure_ref: string;
  source_ref: string;
  target_ref: string;
  mapping_id: string;
  mapping_type: string;
  coverage: number;
  status: "pending" | "confirmed" | "rejected" | "withdrawn";
  decided_by: string | null;
  decided_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  decision_note: Generated<string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcRequirementAssessments {
  id: Generated<string>;
  smsi_id: string;
  framework_id: string;
  framework_version: number;
  requirement_id: string;
  version: number;
  applicability: Generated<"a_determiner" | "applicable" | "exclue">;
  justification: Generated<string>;
  implementation: Generated<"aucune" | "partielle" | "complete">;
  implementation_note: Generated<string>;
  tested_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  test_result: "conforme" | "non_conforme" | null;
  test_note: Generated<string>;
  test_ref: Generated<string>;
  validated_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  validated_by: string | null;
  validation_note: Generated<string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcRiskEvaluations {
  id: Generated<string>;
  risk_id: string;
  smsi_id: string;
  method_version_id: string;
  revision: number;
  risk_snapshot: ColumnType<JsonValue, string, string>;
  ratings: ColumnType<JsonValue, string, string>;
  result: ColumnType<JsonValue, string, string>;
  rationale: string;
  decision: string;
  request_id: string;
  user_id: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcScopeFrameworks {
  smsi_id: string;
  framework_id: string;
  version: number;
  enabled: Generated<boolean>;
  attached_by: string;
  attached_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface GrcSeries {
  object_id: string;
  next_index: Generated<number>;
  checked_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface GrcSmsis {
  id: Generated<string>;
  name: string;
  scope: Generated<string>;
  visibility: Generated<"instance" | "restricted">;
  risk_method_id: string | null;
  risk_method_version: number | null;
  timezone: Generated<string>;
  business_version: number;
  version: Generated<number>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  nature: Generated<string>;
  parent_id: string | null;
  entity_kind: Generated<"organisation" | "entite" | "perimetre">;
  inherit_frameworks: Generated<boolean>;
}

export interface GroupRoles {
  group_id: string;
  role_id: string;
}

export interface Groups {
  id: Generated<string>;
  name: string;
  description: Generated<string>;
  version: Generated<number>;
  created_by: Generated<string>;
  updated_by: Generated<string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface ImportBatches {
  id: Generated<number>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  created_by: string;
  filename: string;
  size: number;
  sha256: string;
  source_schema: number;
  envelope: Generated<boolean>;
  mode: "init" | "merge" | "replace";
  module: string | null;
  modules: Generated<string[]>;
  report: ColumnType<JsonValue, string, string>;
  raw_key_id: string;
  raw_iv: Buffer;
  raw_tag: Buffer;
  raw_content: Buffer;
  before_state: ColumnType<JsonValue, string, string>;
  after_state: ColumnType<JsonValue, string, string>;
  state_version_before: number | null;
  state_version_after: number | null;
  status: Generated<"applied" | "undone">;
  undone_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  undone_by: string | null;
  version: Generated<number>;
}

export interface InvestLines {
  seq: Generated<number>;
  position: number;
  id: string | null;
  company: Generated<string>;
  priority: Generated<string>;
  type: Generated<string>;
  description: Generated<string>;
  n0: Generated<number>;
  n1: Generated<number>;
  n2: Generated<number>;
  comment: Generated<string>;
  alt: Generated<string>;
  account: Generated<string>;
  perimeter: Generated<string>;
  status: Generated<string>;
  nature: Generated<string>;
  renewal: Generated<string>;
  notice: Generated<number>;
  supplier: Generated<string>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface InvestSettings {
  id: Generated<number>;
  base_year: number;
  extra: ColumnType<JsonValue, string | undefined, string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface JournalTechniqueConfig {
  id: number;
  niveau: Generated<"info" | "warn">;
  debug_jusqua: ColumnType<Date | null, Date | string | null, Date | string | null>;
  modifie_par: Generated<string>;
  modifie_le: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface LibFrameworkPromotions {
  source_framework_id: string;
  source_version: number;
  smsi_id: string;
  library_framework_id: string;
  library_version: number;
  promoted_by: string;
  promoted_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface LibFrameworkVersions {
  id: Generated<string>;
  framework_id: string;
  version: number;
  definition: ColumnType<JsonValue, string, string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface LibFrameworks {
  id: Generated<string>;
  identifier: string;
  name: string;
  version: Generated<number>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface LibKitIa {
  id: Generated<string>;
  sha256: string;
  kit_version: string;
  framework_id: string;
  framework_version: number;
  annexes: ColumnType<JsonValue, string, string>;
  reason: string;
  imported_by: string;
  imported_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface LibMappingHistory {
  id: Generated<string>;
  mapping_id: string;
  version: number;
  snapshot: ColumnType<JsonValue, string, string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface LibMappings {
  id: Generated<string>;
  source_framework_id: string;
  source_version: number;
  source_requirement_id: string;
  target_framework_id: string;
  target_version: number;
  target_requirement_id: string;
  type: "identical" | "equivalent" | "partial" | "complementary" | "related" | "none";
  justification: string;
  coverage: number;
  origin: "human" | "ai";
  status: "proposed" | "validated" | "withdrawn";
  source_url: string;
  review_note: Generated<string>;
  version: Generated<number>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  validated_by: string | null;
  validated_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface Links {
  id: Generated<string>;
  title: string;
  url: string;
  description: Generated<string>;
  category: Generated<string>;
  refs: Generated<string[]>;
  tags: Generated<string[]>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  deleted_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  deleted_by: string | null;
  version: Generated<number>;
  legacy_id: string | null;
  import_batch_id: number | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface MapVersions {
  id: Generated<string>;
  map_id: string;
  label: string;
  layout: ColumnType<JsonValue, string, string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  created_by: string;
  legacy_id: string | null;
  import_batch_id: number | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface Maps {
  id: Generated<string>;
  view: "context" | "process";
  name: string;
  layout: ColumnType<JsonValue, string, string>;
  settings: ColumnType<JsonValue, string | undefined, string>;
  version: Generated<number>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  created_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  legacy_id: string | null;
  import_batch_id: number | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface ModuleActivation {
  id: number;
  version: Generated<number>;
  disabled: Generated<string[]>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: Generated<string>;
}

export interface NotificationPortees {
  portee_kind: "groupe" | "role" | "utilisateur";
  portee_id: string;
  version: Generated<number>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface NotificationReglages {
  portee_kind: "groupe" | "role" | "utilisateur";
  portee_id: string;
  type: string;
  canal: "application" | "courriel";
  valeur: boolean;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface OccurrenceValidations {
  id: Generated<string>;
  objet_id: string;
  request_id: string;
  seq: number;
  kind: "validation" | "reouverture";
  result: "ok" | "ko" | "na" | null;
  comment: Generated<string>;
  proof_ref: Generated<string>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface OperationJobs {
  id: Generated<string>;
  request_id: string;
  kind: "verify" | "restore" | "tls_install" | "tls_reset" | "tls_internal" | "tls_acme";
  status: Generated<"en_attente" | "en_cours" | "reussie" | "echec" | "annulee" | "intervention">;
  requested_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  started_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  finished_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  version: Generated<number>;
  certificate_fingerprint: string | null;
  archive_id: string | null;
  sha256: string | null;
  payload: ColumnType<JsonValue, string | undefined, string>;
  secret: Buffer | null;
  phase: Generated<string>;
  message: Generated<string>;
}

export interface OperationReceipts {
  id: string;
  status: string;
}

export interface ParcoursAssociations {
  seq: Generated<number>;
  smsi_id: string;
  request_id: string;
  sous_action: string;
  operation: "associer" | "retirer";
  target_ref: string;
  note: Generated<string>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface PilotageDecisions {
  id: Generated<string>;
  smsi_id: string;
  source_ref: string;
  source_version: number;
  operation: string;
  step: Generated<string>;
  result: string;
  performed_on: ColumnType<Date, Date | string, Date | string>;
  note: string;
  refs: ColumnType<JsonValue, string | undefined, string>;
  snapshot: ColumnType<JsonValue, string, string>;
  generated_refs: ColumnType<JsonValue, string | undefined, string>;
  request_id: string;
  intent_hash: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  terms: ColumnType<JsonValue, string | undefined, string>;
}

export interface RegistrePerimetres {
  registre_id: string;
  smsi_id: string;
}

export interface Registres {
  id: Generated<string>;
  kind: "plan_actions" | "ecarts" | "recurrences";
  name: string;
  description: Generated<string>;
  reference_smsi_id: string;
  restricted: Generated<boolean>;
  archived: Generated<boolean>;
  par_defaut: Generated<boolean>;
  version: Generated<number>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  date_debut: ColumnType<Date | null, Date | string | null, Date | string | null>;
  date_fin: ColumnType<Date | null, Date | string | null, Date | string | null>;
  statut: Generated<"prevu" | "en_cours" | "termine" | "abandonne">;
  responsable: ColumnType<JsonValue | null, string | null, string | null>;
}

export interface Roles {
  id: string;
  name: string;
  description: Generated<string>;
  system: Generated<boolean>;
  permissions: Generated<string[]>;
  based_on: string | null;
  version: Generated<number>;
  created_by: Generated<string>;
  updated_by: Generated<string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface SchemaMigrations {
  name: string;
  applied_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface Sessions {
  id_hash: Buffer;
  user_id: string;
  csrf: string;
  mfa_ok: Generated<boolean>;
  ip: string | null;
  user_agent: Generated<string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  last_seen_at: ColumnType<Date, Date | string | undefined, Date | string>;
  expires_at: ColumnType<Date, Date | string, Date | string>;
}

export interface Settings {
  key: string;
  value: ColumnType<JsonValue, string, string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface StateHistory {
  version: number;
  data: ColumnType<JsonValue, string, string>;
  sha256: string;
  updated_at: ColumnType<Date, Date | string, Date | string>;
  updated_by: string;
  note: Generated<string>;
  import_batch_id: number | null;
}

export interface SuiviAccessReviews {
  seq: Generated<number>;
  position: number;
  id: string | null;
  app: string | null;
  supplier: string | null;
  month: string | null;
  freq: number | null;
  source: string | null;
  comment: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviAppGaps {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  supplier: string | null;
  dscp: string | null;
  cloud: string | null;
  status: string | null;
  owner: string | null;
  target: string | null;
  description: string | null;
  lines: ColumnType<JsonValue | null, string | null, string | null>;
  custom: ColumnType<JsonValue | null, string | null, string | null>;
  plan_fd: string | null;
  profile: ColumnType<JsonValue | null, string | null, string | null>;
  profile_at: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviClausierEvals {
  seq: Generated<number>;
  position: number;
  id: string | null;
  supplier: string | null;
  product: string | null;
  eval_date: string | null;
  evaluator: string | null;
  source: string | null;
  cases: ColumnType<JsonValue | null, string | null, string | null>;
  answers: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCriseCellules {
  seq: Generated<number>;
  position: number;
  id: string | null;
  title: string | null;
  mode: string | null;
  scenario: string | null;
  plan: string | null;
  date_start: string | null;
  date_end: string | null;
  status: string | null;
  log: ColumnType<JsonValue | null, string | null, string | null>;
  checks: ColumnType<JsonValue | null, string | null, string | null>;
  deadlines: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCriseContacts {
  seq: Generated<number>;
  position: number;
  created_iso: string | null;
  name: string | null;
  org: string | null;
  role: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  avail: string | null;
  notes: string | null;
  is_key: boolean | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCriseScenarios {
  seq: Generated<number>;
  position: number;
  id: string | null;
  title: string | null;
  ref: string | null;
  description: string | null;
  items: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCrrcAlertes {
  seq: Generated<number>;
  position: number;
  id: string | null;
  alert_date: string | null;
  severity: string | null;
  est: string | null;
  res: string | null;
  message: string | null;
  status: string | null;
  incident: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCrrcEtablissements {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  finess: string | null;
  status: string | null;
  admin_contact: string | null;
  admin_email: string | null;
  tech_contact: string | null;
  tech_email: string | null;
  prestataire: string | null;
  alerts: string | null;
  signed: string | null;
  service_date: string | null;
  renewal: string | null;
  capacity_gb: number | null;
  retention_days: number | null;
  offers: ColumnType<JsonValue | null, string | null, string | null>;
  scopes: ColumnType<JsonValue | null, string | null, string | null>;
  notes: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCrrcOffres {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  status: string | null;
  partner: string | null;
  description: string | null;
  perimeters: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCrrcRessources {
  seq: Generated<number>;
  position: number;
  id: string | null;
  est: string | null;
  name: string | null;
  tech: string | null;
  freq: string | null;
  retention: number | null;
  notes: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCrrcRestaurations {
  seq: Generated<number>;
  position: number;
  id: string | null;
  restore_date: string | null;
  est: string | null;
  res: string | null;
  scope: string | null;
  type: string | null;
  status: string | null;
  owner: string | null;
  duration: string | null;
  dest: string | null;
  path: string | null;
  conflict: string | null;
  point: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviCrrcSauvegardes {
  seq: Generated<number>;
  position: number;
  id: string | null;
  res: string | null;
  run_date: string | null;
  type: string | null;
  status: string | null;
  volume_gb: number | null;
  duration_min: number | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviDda {
  seq: Generated<number>;
  position: number;
  cle: string;
  app: string | null;
  level: string | null;
  just: string | null;
  risk: string | null;
  actions: string | null;
  docs: string | null;
  url: string | null;
  comment: string | null;
  req: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviFournisseurs {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  rattachement: string | null;
  saas: boolean | null;
  sso: string | null;
  critical: string | null;
  hds: string | null;
  contact: string | null;
  last_review: string | null;
  notes: string | null;
  controls: ColumnType<JsonValue | null, string | null, string | null>;
  certs: ColumnType<JsonValue | null, string | null, string | null>;
  created_iso: string | null;
  mfa: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviGroupes {
  seq: Generated<number>;
  position: number;
  id: string | null;
  ref: string | null;
  num: string | null;
  title: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviIaEtapes {
  seq: Generated<number>;
  position: number;
  id: string | null;
  step: number | null;
  phase: string | null;
  action: string | null;
  result: string | null;
  proof: string | null;
  iso: string | null;
  hds: string | null;
  owner: string | null;
  priority: string | null;
  status: string | null;
  progress: number | null;
  j_start: number | null;
  j_end: number | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviIaEvaluations {
  seq: Generated<number>;
  position: number;
  id: string | null;
  domain: string | null;
  scenario: string | null;
  app: string | null;
  iso: string | null;
  hds: string | null;
  measure: string | null;
  scope: string | null;
  prob: number | null;
  maturity: number | null;
  c: number | null;
  i: number | null;
  a: number | null;
  audit: number | null;
  patient: number | null;
  effort: number | null;
  dscp: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviIaPolitiques {
  seq: Generated<number>;
  position: number;
  id: string | null;
  policy: string | null;
  impact: string | null;
  change: string | null;
  iso: string | null;
  annex: string | null;
  hds: string | null;
  owner: string | null;
  target: string | null;
  status: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviIaUsages {
  seq: Generated<number>;
  position: number;
  id: string | null;
  ai_presence: string | null;
  category: string | null;
  provider: string | null;
  usecase: string | null;
  dscp: string | null;
  training: string | null;
  storage: string | null;
  authz: string | null;
  owner: string | null;
  purpose: string | null;
  remote: string | null;
  aiact: string | null;
  aipd: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviIncidents {
  seq: Generated<number>;
  position: number;
  id: string | null;
  detected_at: string | null;
  reporter: string | null;
  title: string | null;
  description: string | null;
  kind: string | null;
  category: string | null;
  impact: string | null;
  urgency: string | null;
  status: string | null;
  owner: string | null;
  actions: string | null;
  cause: string | null;
  resolved_at: string | null;
  retex: string | null;
  answers: ColumnType<JsonValue | null, string | null, string | null>;
  notified: ColumnType<JsonValue | null, string | null, string | null>;
  finding_id: string | null;
  created_iso: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviIndicateurs {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  obj: string | null;
  target: ColumnType<JsonValue | null, string | null, string | null>;
  action: string | null;
  last_review: string | null;
  due: string | null;
  owner: string | null;
  valeurs: ColumnType<JsonValue | null, string | null, string | null>;
  dir: string | null;
  freq: string | null;
  calc: string | null;
  auto: boolean | null;
  action_owner: string | null;
  action_due: string | null;
  category: string | null;
  source: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviIndicateursValeurs {
  seq: Generated<number>;
  parent_seq: number;
  position: number;
  id: string | null;
  date: string | null;
  v: number | null;
  note: string | null;
  hist: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviMesures {
  seq: Generated<number>;
  position: number;
  id: string | null;
  ref: string | null;
  num: string | null;
  title: string | null;
  grp: string | null;
  depth: number | null;
  afnor: ColumnType<JsonValue | null, string | null, string | null>;
  interne: ColumnType<JsonValue | null, string | null, string | null>;
  prep: string | null;
  owner: string | null;
  notes: string | null;
  rem_interne: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviObjectifs {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  due: string | null;
  owner: string | null;
  processes: ColumnType<JsonValue | null, string | null, string | null>;
  enjeux: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviPartiesInteressees {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  type: string | null;
  cat: string | null;
  needs: string | null;
  req: string | null;
  addressed: string | null;
  reviewed: string | null;
  how: string | null;
  owner: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviPlans {
  seq: Generated<number>;
  position: number;
  id: string | null;
  type: string | null;
  title: string | null;
  kind: string | null;
  date_start: string | null;
  date_end: string | null;
  done: string | null;
  status: string | null;
  owner: string | null;
  provider: string | null;
  audience: string | null;
  notes: string | null;
  proof: string | null;
  planned: string | null;
  attended: string | null;
  duration: string | null;
  participation: string | null;
  success: string | null;
  indicator: string | null;
  items: ColumnType<JsonValue | null, string | null, string | null>;
  scope: string | null;
  auditor: string | null;
  scenario: string | null;
  systems: string | null;
  objectives: string | null;
  result: string | null;
  retex: string | null;
  findings: ColumnType<JsonValue | null, string | null, string | null>;
  pushed_at: string | null;
  created_iso: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviPresence {
  cle: string;
  kind: Generated<"liste" | "objet">;
  champs: Generated<string[]>;
  reste: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviPreuves {
  seq: Generated<number>;
  position: number;
  id: string | null;
  title: string | null;
  source: string | null;
  review: string | null;
  valid_until: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviProcessus {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  owner: string | null;
  indicators: ColumnType<JsonValue | null, string | null, string | null>;
  family: string | null;
  parent: string | null;
  purpose: string | null;
  inputs: string | null;
  outputs: string | null;
  sequence: string | null;
  control_criteria: string | null;
  resources: string | null;
  evaluation: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviReferentielsSuivi {
  seq: Generated<number>;
  position: number;
  id: string | null;
  name: string | null;
  version: string | null;
  source: string | null;
  scope_mode: string | null;
  requirements: ColumnType<JsonValue | null, string | null, string | null>;
  objectives: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviReglages {
  cle: string;
  valeur: ColumnType<JsonValue, string, string>;
  position: Generated<number>;
}

export interface SuiviRevues {
  seq: Generated<number>;
  position: number;
  id: string | null;
  type: string | null;
  created_iso: string | null;
  date: string | null;
  title: string | null;
  period: string | null;
  participants: string | null;
  classification: string | null;
  sections: ColumnType<JsonValue | null, string | null, string | null>;
  inputs: ColumnType<JsonValue | null, string | null, string | null>;
  decisions: ColumnType<JsonValue | null, string | null, string | null>;
  cs: ColumnType<JsonValue | null, string | null, string | null>;
  followup: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviRoles {
  seq: Generated<number>;
  position: number;
  id: string | null;
  created_iso: string | null;
  name: string | null;
  holder: string | null;
  deputy: string | null;
  email: string | null;
  phone: string | null;
  resp: string | null;
  refs: string | null;
  role: string | null;
  resources: string | null;
  commitment: string | null;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviSwot {
  seq: Generated<number>;
  position: number;
  id: string | null;
  created_iso: string | null;
  process: string | null;
  date: string | null;
  author: string | null;
  version: string | null;
  strengths: ColumnType<JsonValue | null, string | null, string | null>;
  weaknesses: ColumnType<JsonValue | null, string | null, string | null>;
  opportunities: ColumnType<JsonValue | null, string | null, string | null>;
  threats: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SuiviTachesRecurrentes {
  seq: Generated<number>;
  position: number;
  id: string | null;
  title: string | null;
  active: boolean | null;
  n: number | null;
  u: string | null;
  start: string | null;
  last: string | null;
  history: ColumnType<JsonValue | null, string | null, string | null>;
  extra: ColumnType<JsonValue, string | undefined, string>;
}

export interface SupCriteria {
  id: Generated<string>;
  label: string;
  description: Generated<string>;
  purposes: Generated<string[]>;
  requirement_refs: Generated<string[]>;
  version: Generated<number>;
  archived: Generated<boolean>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface SupCriterionHistory {
  id: Generated<string>;
  criterion_id: string;
  version: number;
  snapshot: ColumnType<JsonValue, string, string>;
  reason: string;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface SupEvaluationItems {
  id: Generated<string>;
  evaluation_id: string;
  criterion_id: string;
  criterion_version: number;
  criterion_label: string;
  requirement_refs: Generated<string[]>;
  meets: boolean | null;
  result: Generated<string>;
}

export interface SupEvaluations {
  id: Generated<string>;
  supplier_id: string;
  supplier_name: string;
  evaluated_at: ColumnType<Date, Date | string, Date | string>;
  evaluator: string;
  conclusion: Generated<string>;
  next_review_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface SupScopeLinks {
  smsi_id: string;
  supplier_id: string;
  attached_by: string;
  attached_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface TypesProcessus {
  id: Generated<string>;
  code: string;
  label: string;
  description: Generated<string>;
  tint: Generated<"vert" | "bleu" | "violet" | "orange" | "rouge" | "gris">;
  rank: Generated<number>;
  archived: Generated<boolean>;
  created_by: Generated<string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: Generated<string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface UpdateJobs {
  id: Generated<string>;
  request_id: string;
  kind: "check" | "install";
  target: string | null;
  status: Generated<"queued" | "running" | "success" | "rolled_back" | "failed" | "intervention">;
  requested_by: string;
  user_id: string | null;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  started_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  finished_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface UserGroups {
  user_id: string;
  group_id: string;
}

export interface UserRoles {
  user_id: string;
  role_id: string;
  modules: string[] | null;
}

export interface Users {
  id: Generated<string>;
  username: string;
  display_name: Generated<string>;
  email: Generated<string>;
  password_hash: string;
  must_change_password: Generated<boolean>;
  totp_secret: Buffer | null;
  totp_pending: Buffer | null;
  totp_enabled: Generated<boolean>;
  totp_last_step: Generated<number>;
  disabled: Generated<boolean>;
  failed_logins: Generated<number>;
  locked_until: ColumnType<Date | null, Date | string | null, Date | string | null>;
  last_login_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  password_changed_at: ColumnType<Date, Date | string | undefined, Date | string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  version: Generated<number>;
  expires_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  preferences: ColumnType<JsonValue, string | undefined, string>;
}

export interface VDocuments {
  id: string | null;
  title: string | null;
  category: string | null;
  refs: string[] | null;
  tags: string[] | null;
  classification: string | null;
  filename: string | null;
  mime: string | null;
  size: number | null;
  sha256: string | null;
  current_version: number | null;
  updated_by: string | null;
  updated_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface WallScreens {
  id: Generated<string>;
  name: string;
  modules: string[];
  activation_hash: Buffer | null;
  activation_expires: ColumnType<Date | null, Date | string | null, Date | string | null>;
  device_hash: Buffer | null;
  activated_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  revoked_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  revoked_by: string | null;
  last_seen_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  last_ip: string | null;
  version: Generated<number>;
  created_by: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface DB {
  app_state: AppState;
  audit_log: AuditLog;
  backup_jobs: BackupJobs;
  backup_policy: BackupPolicy;
  backup_worker: BackupWorker;
  business_policy_configuration: BusinessPolicyConfiguration;
  business_policy_versions: BusinessPolicyVersions;
  calendriers_plateforme: CalendriersPlateforme;
  calendriers_plateforme_journal: CalendriersPlateformeJournal;
  calendriers_plateforme_jours: CalendriersPlateformeJours;
  cfg_items: CfgItems;
  cfg_usages: CfgUsages;
  cfg_versions: CfgVersions;
  contributions_elements: ContributionsElements;
  courriel_jobs: CourrielJobs;
  document_versions: DocumentVersions;
  documents: Documents;
  droits_ressources: DroitsRessources;
  fonction_membres: FonctionMembres;
  fonctions: Fonctions;
  grc_framework_versions: GrcFrameworkVersions;
  grc_links: GrcLinks;
  grc_members: GrcMembers;
  grc_method_versions: GrcMethodVersions;
  grc_notifications: GrcNotifications;
  grc_object_versions: GrcObjectVersions;
  grc_objects: GrcObjects;
  grc_occurrences: GrcOccurrences;
  grc_rapprochements: GrcRapprochements;
  grc_requirement_assessments: GrcRequirementAssessments;
  grc_risk_evaluations: GrcRiskEvaluations;
  grc_scope_frameworks: GrcScopeFrameworks;
  grc_series: GrcSeries;
  grc_smsis: GrcSmsis;
  group_roles: GroupRoles;
  groups: Groups;
  import_batches: ImportBatches;
  invest_lines: InvestLines;
  invest_settings: InvestSettings;
  journal_technique_config: JournalTechniqueConfig;
  lib_framework_promotions: LibFrameworkPromotions;
  lib_framework_versions: LibFrameworkVersions;
  lib_frameworks: LibFrameworks;
  lib_kit_ia: LibKitIa;
  lib_mapping_history: LibMappingHistory;
  lib_mappings: LibMappings;
  links: Links;
  map_versions: MapVersions;
  maps: Maps;
  module_activation: ModuleActivation;
  notification_portees: NotificationPortees;
  notification_reglages: NotificationReglages;
  occurrence_validations: OccurrenceValidations;
  operation_jobs: OperationJobs;
  operation_receipts: OperationReceipts;
  parcours_associations: ParcoursAssociations;
  pilotage_decisions: PilotageDecisions;
  registre_perimetres: RegistrePerimetres;
  registres: Registres;
  roles: Roles;
  schema_migrations: SchemaMigrations;
  sessions: Sessions;
  settings: Settings;
  state_history: StateHistory;
  suivi_access_reviews: SuiviAccessReviews;
  suivi_app_gaps: SuiviAppGaps;
  suivi_clausier_evals: SuiviClausierEvals;
  suivi_crise_cellules: SuiviCriseCellules;
  suivi_crise_contacts: SuiviCriseContacts;
  suivi_crise_scenarios: SuiviCriseScenarios;
  suivi_crrc_alertes: SuiviCrrcAlertes;
  suivi_crrc_etablissements: SuiviCrrcEtablissements;
  suivi_crrc_offres: SuiviCrrcOffres;
  suivi_crrc_ressources: SuiviCrrcRessources;
  suivi_crrc_restaurations: SuiviCrrcRestaurations;
  suivi_crrc_sauvegardes: SuiviCrrcSauvegardes;
  suivi_dda: SuiviDda;
  suivi_fournisseurs: SuiviFournisseurs;
  suivi_groupes: SuiviGroupes;
  suivi_ia_etapes: SuiviIaEtapes;
  suivi_ia_evaluations: SuiviIaEvaluations;
  suivi_ia_politiques: SuiviIaPolitiques;
  suivi_ia_usages: SuiviIaUsages;
  suivi_incidents: SuiviIncidents;
  suivi_indicateurs: SuiviIndicateurs;
  suivi_indicateurs_valeurs: SuiviIndicateursValeurs;
  suivi_mesures: SuiviMesures;
  suivi_objectifs: SuiviObjectifs;
  suivi_parties_interessees: SuiviPartiesInteressees;
  suivi_plans: SuiviPlans;
  suivi_presence: SuiviPresence;
  suivi_preuves: SuiviPreuves;
  suivi_processus: SuiviProcessus;
  suivi_referentiels_suivi: SuiviReferentielsSuivi;
  suivi_reglages: SuiviReglages;
  suivi_revues: SuiviRevues;
  suivi_roles: SuiviRoles;
  suivi_swot: SuiviSwot;
  suivi_taches_recurrentes: SuiviTachesRecurrentes;
  sup_criteria: SupCriteria;
  sup_criterion_history: SupCriterionHistory;
  sup_evaluation_items: SupEvaluationItems;
  sup_evaluations: SupEvaluations;
  sup_scope_links: SupScopeLinks;
  types_processus: TypesProcessus;
  update_jobs: UpdateJobs;
  user_groups: UserGroups;
  user_roles: UserRoles;
  users: Users;
  v_documents: VDocuments;
  wall_screens: WallScreens;
}
