-- Kit d'intégration IA (décision du 25/10/2026, ADR 0055) : trace immuable de chaque import et annexes de veille
-- (questionnaire de qualification, actions et scénarios illustratifs, deltas préparatoires HDS 2.1, mémos, sources).
-- Les contrôles eux-mêmes vivent dans la bibliothèque de référentiels (lib_frameworks) et les correspondances dans lib_mappings.
CREATE TABLE lib_kit_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  kit_version text NOT NULL,
  framework_id uuid NOT NULL REFERENCES lib_frameworks(id),
  framework_version integer NOT NULL,
  annexes jsonb NOT NULL,
  reason text NOT NULL,
  imported_by text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (framework_id, framework_version) REFERENCES lib_framework_versions(framework_id, version)
);
CREATE TRIGGER lib_kit_ia_immutable BEFORE UPDATE OR DELETE ON lib_kit_ia
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER lib_kit_ia_no_truncate BEFORE TRUNCATE ON lib_kit_ia
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
