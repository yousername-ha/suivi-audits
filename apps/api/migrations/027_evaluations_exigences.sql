-- Évaluation des exigences d'un référentiel dans un périmètre (ADR 0041, lot H3) : applicabilité, mise en œuvre, test
-- d'efficacité et validation métier, en versions immuables (l'historique des évaluations est conservé). Migration
-- additive : aucune donnée existante n'est modifiée ; sans évaluation, une exigence est « non implémentée ».
CREATE TABLE grc_requirement_assessments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smsi_id              uuid NOT NULL REFERENCES grc_smsis(id),
  framework_id         uuid NOT NULL,
  framework_version    integer NOT NULL,
  requirement_id       text NOT NULL CHECK (char_length(requirement_id) BETWEEN 1 AND 200),
  version              integer NOT NULL CHECK (version >= 1),
  applicability        text NOT NULL DEFAULT 'a_determiner' CHECK (applicability IN ('a_determiner','applicable','exclue')),
  justification        text NOT NULL DEFAULT '' CHECK (char_length(justification) <= 2000),
  implementation       text NOT NULL DEFAULT 'aucune' CHECK (implementation IN ('aucune','partielle','complete')),
  implementation_note  text NOT NULL DEFAULT '' CHECK (char_length(implementation_note) <= 5000),
  tested_at            date,
  test_result          text CHECK (test_result IN ('conforme','non_conforme')),
  test_note            text NOT NULL DEFAULT '' CHECK (char_length(test_note) <= 5000),
  test_ref             text NOT NULL DEFAULT '' CHECK (char_length(test_ref) <= 500),
  validated_at         date,
  validated_by         text,
  validation_note      text NOT NULL DEFAULT '' CHECK (char_length(validation_note) <= 5000),
  reason               text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_by           text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (smsi_id, framework_id, requirement_id, version),
  FOREIGN KEY (framework_id, framework_version) REFERENCES lib_framework_versions(framework_id, version),
  -- Mêmes règles que packages/shared/src/couverture.ts (incoherencesEvaluation).
  CONSTRAINT exclue_justifiee CHECK (applicability <> 'exclue' OR btrim(justification) <> ''),
  CONSTRAINT test_complet CHECK ((tested_at IS NULL) = (test_result IS NULL)),
  CONSTRAINT test_sur_applicable CHECK (test_result IS NULL OR (applicability = 'applicable' AND implementation <> 'aucune')),
  CONSTRAINT validation_etablie CHECK (
    validated_at IS NULL OR (applicability = 'applicable' AND implementation = 'complete' AND COALESCE(test_result, '') = 'conforme'
                             AND validated_by IS NOT NULL AND (tested_at IS NULL OR validated_at >= tested_at)))
);
CREATE INDEX grc_requirement_assessments_courante
  ON grc_requirement_assessments (smsi_id, framework_id, requirement_id, version DESC);
CREATE TRIGGER grc_requirement_assessments_immutable BEFORE UPDATE OR DELETE ON grc_requirement_assessments
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER grc_requirement_assessments_no_truncate BEFORE TRUNCATE ON grc_requirement_assessments
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
