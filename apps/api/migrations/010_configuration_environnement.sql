-- B2a : aucune modification de l'état historique ni des évaluations antérieures.
CREATE TABLE environment_versions (
  version integer PRIMARY KEY CHECK (version > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);
CREATE TRIGGER environment_versions_immutable BEFORE UPDATE OR DELETE ON environment_versions
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER environment_versions_no_truncate BEFORE TRUNCATE ON environment_versions
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
CREATE TABLE environment_configuration (
  id integer PRIMARY KEY CHECK (id = 1),
  version integer NOT NULL REFERENCES environment_versions(version)
);
CREATE TRIGGER environment_configuration_notify AFTER INSERT OR UPDATE ON environment_configuration
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('environment_configuration', 'id', 'version');
