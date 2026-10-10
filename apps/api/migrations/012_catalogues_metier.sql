CREATE TABLE business_policy_versions (
 version integer PRIMARY KEY CHECK(version>0), definition jsonb NOT NULL,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL
);
CREATE TABLE business_policy_configuration (id integer PRIMARY KEY CHECK(id=1),version integer NOT NULL REFERENCES business_policy_versions(version));
CREATE TRIGGER business_policy_versions_immutable BEFORE UPDATE OR DELETE ON business_policy_versions FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER business_policy_versions_no_truncate BEFORE TRUNCATE ON business_policy_versions FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
