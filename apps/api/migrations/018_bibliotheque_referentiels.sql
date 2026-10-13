-- Bibliothèque de référentiels de l'organisation (ADR 0031, lot M2) : un référentiel s'importe une fois, hors périmètre,
-- par versions immuables, puis se rattache à plusieurs périmètres. Tables additives : les référentiels publiés dans un
-- périmètre (grc_objects, grc_framework_versions) restent inchangés et continuent de fonctionner.
CREATE TABLE lib_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL UNIQUE CHECK (char_length(identifier) BETWEEN 1 AND 100),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lib_framework_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES lib_frameworks(id),
  version integer NOT NULL,
  definition jsonb NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (framework_id, version)
);
-- Rattachement d'une version précise d'un référentiel de la bibliothèque à un périmètre.
CREATE TABLE grc_scope_frameworks (
  smsi_id uuid NOT NULL REFERENCES grc_smsis(id),
  framework_id uuid NOT NULL,
  version integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  attached_by text NOT NULL,
  attached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (smsi_id, framework_id),
  FOREIGN KEY (framework_id, version) REFERENCES lib_framework_versions(framework_id, version)
);
-- Promotion explicite d'un référentiel publié dans un périmètre vers la bibliothèque (copie, alias conservé).
CREATE TABLE lib_framework_promotions (
  source_framework_id uuid NOT NULL REFERENCES grc_objects(id),
  source_version integer NOT NULL,
  smsi_id uuid NOT NULL REFERENCES grc_smsis(id),
  library_framework_id uuid NOT NULL REFERENCES lib_frameworks(id),
  library_version integer NOT NULL,
  promoted_by text NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_framework_id, source_version)
);
CREATE TRIGGER lib_framework_versions_immutable BEFORE UPDATE OR DELETE ON lib_framework_versions
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER lib_framework_versions_no_truncate BEFORE TRUNCATE ON lib_framework_versions
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER lib_framework_promotions_immutable BEFORE UPDATE OR DELETE ON lib_framework_promotions
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE INDEX grc_scope_frameworks_framework ON grc_scope_frameworks(framework_id);
