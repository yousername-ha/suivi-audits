-- Décisions immuables rattachées aux scénarios IA existants ; aucune modification du JSON historique.
CREATE TABLE risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 120),
  source_sha text NOT NULL CHECK(source_sha ~ '^[a-f0-9]{64}$'),
  source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot) = 'object'),
  configuration_version integer NOT NULL REFERENCES environment_versions(version),
  revision integer NOT NULL CHECK(revision > 0),
  ratings jsonb NOT NULL,
  result jsonb NOT NULL,
  preview_id text NOT NULL CHECK(preview_id ~ '^[a-f0-9]{64}$'),
  rationale text NOT NULL CHECK(length(rationale) BETWEEN 10 AND 2000),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE(source_id, revision)
);
CREATE TRIGGER risk_assessments_immutable BEFORE UPDATE OR DELETE ON risk_assessments
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER risk_assessments_no_truncate BEFORE TRUNCATE ON risk_assessments
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER risk_assessments_notify AFTER INSERT ON risk_assessments
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('risk_assessments', 'source_id', 'revision');
