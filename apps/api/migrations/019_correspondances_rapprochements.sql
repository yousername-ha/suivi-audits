-- Déclarer une fois (ADR 0031, lot M3) : correspondances entre exigences de la bibliothèque, validées une fois pour
-- toute l'organisation, et propositions de rapprochement décidées par le pilote de chaque périmètre. Tables additives.
CREATE TABLE lib_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_framework_id uuid NOT NULL,
  source_version integer NOT NULL,
  source_requirement_id text NOT NULL CHECK (char_length(source_requirement_id) BETWEEN 1 AND 120),
  target_framework_id uuid NOT NULL,
  target_version integer NOT NULL,
  target_requirement_id text NOT NULL CHECK (char_length(target_requirement_id) BETWEEN 1 AND 120),
  type text NOT NULL CHECK (type IN ('identical','equivalent','partial','complementary','related','none')),
  justification text NOT NULL CHECK (char_length(justification) >= 10),
  coverage integer NOT NULL CHECK (coverage BETWEEN 0 AND 100),
  origin text NOT NULL CHECK (origin IN ('human','ai')),
  status text NOT NULL CHECK (status IN ('proposed','validated','withdrawn')),
  source_url text NOT NULL,
  review_note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  validated_by text,
  validated_at timestamptz,
  FOREIGN KEY (source_framework_id, source_version) REFERENCES lib_framework_versions(framework_id, version),
  FOREIGN KEY (target_framework_id, target_version) REFERENCES lib_framework_versions(framework_id, version),
  CHECK (NOT (source_framework_id = target_framework_id AND source_version = target_version AND source_requirement_id = target_requirement_id))
);
CREATE UNIQUE INDEX lib_mappings_pair ON lib_mappings(source_framework_id, source_version, source_requirement_id,
  target_framework_id, target_version, target_requirement_id) WHERE status <> 'withdrawn';
CREATE INDEX lib_mappings_source ON lib_mappings(source_framework_id, status);
CREATE INDEX lib_mappings_target ON lib_mappings(target_framework_id, status);
-- Historique immuable : un instantané par changement de la correspondance.
CREATE TABLE lib_mapping_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id uuid NOT NULL REFERENCES lib_mappings(id),
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mapping_id, version)
);
CREATE TRIGGER lib_mapping_history_immutable BEFORE UPDATE OR DELETE ON lib_mapping_history
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER lib_mapping_history_no_truncate BEFORE TRUNCATE ON lib_mapping_history
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
-- Proposition de rapprochement : une mesure reliée à une exigence peut couvrir l'exigence équivalente d'un autre
-- référentiel rattaché, selon une correspondance validée. Jamais affirmée : le pilote la confirme ou la rejette.
CREATE TABLE grc_rapprochements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smsi_id uuid NOT NULL REFERENCES grc_smsis(id),
  measure_ref text NOT NULL,
  source_ref text NOT NULL,
  target_ref text NOT NULL,
  mapping_id uuid NOT NULL REFERENCES lib_mappings(id),
  mapping_type text NOT NULL,
  coverage integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','confirmed','rejected','withdrawn')),
  decided_by text,
  decided_at timestamptz,
  decision_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (smsi_id, measure_ref, target_ref, mapping_id)
);
CREATE INDEX grc_rapprochements_status ON grc_rapprochements(smsi_id, status);
