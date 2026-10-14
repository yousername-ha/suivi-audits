-- Catalogue de configuration GRC transversal (ADR 0038). Additif : aucune table, aucune donnée ni aucune évaluation existante
-- n'est modifiée. Les définitions publiées sont immuables ; un consommateur épingle (élément, version).
CREATE TABLE cfg_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('scale','matrix','mapping','criteria','taxonomy')),
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  scope text NOT NULL DEFAULT 'instance' CHECK (scope IN ('instance','smsi')),
  smsi_id uuid REFERENCES grc_smsis(id),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','active','archived')),
  draft jsonb CHECK (draft IS NULL OR jsonb_typeof(draft) = 'object'),
  current_version integer CHECK (current_version IS NULL OR current_version > 0),
  derived_from_id uuid REFERENCES cfg_items(id),
  derived_from_version integer CHECK (derived_from_version IS NULL OR derived_from_version > 0),
  origin jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(origin) = 'object'),
  version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'smsi') = (smsi_id IS NOT NULL)),
  CHECK (state <> 'active' OR current_version IS NOT NULL),
  CHECK ((derived_from_id IS NULL) = (derived_from_version IS NULL))
);
CREATE UNIQUE INDEX cfg_items_key ON cfg_items (kind, key, COALESCE(smsi_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX cfg_items_list ON cfg_items (kind, state, scope, updated_at DESC);
CREATE TABLE cfg_versions (
  item_id uuid NOT NULL REFERENCES cfg_items(id),
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 1000),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, version)
);
ALTER TABLE cfg_items ADD CONSTRAINT cfg_items_current FOREIGN KEY (id, current_version) REFERENCES cfg_versions(item_id, version);
CREATE TRIGGER cfg_versions_immutable BEFORE UPDATE OR DELETE ON cfg_versions
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER cfg_versions_no_truncate BEFORE TRUNCATE ON cfg_versions
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
-- Registre des usages : qui épingle quelle version de quel élément (méthode publiée, autre élément, analyse).
CREATE TABLE cfg_usages (
  item_id uuid NOT NULL,
  item_version integer NOT NULL,
  consumer_kind text NOT NULL CHECK (consumer_kind IN ('cfg_version','method_version','analysis')),
  consumer_id text NOT NULL CHECK (length(consumer_id) BETWEEN 1 AND 120),
  consumer_version integer NOT NULL DEFAULT 0 CHECK (consumer_version >= 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, item_version, consumer_kind, consumer_id, consumer_version),
  FOREIGN KEY (item_id, item_version) REFERENCES cfg_versions(item_id, version)
);
CREATE INDEX cfg_usages_consumer ON cfg_usages (consumer_kind, consumer_id, consumer_version);
CREATE TRIGGER cfg_usages_immutable BEFORE UPDATE OR DELETE ON cfg_usages
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER cfg_usages_no_truncate BEFORE TRUNCATE ON cfg_usages
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER cfg_items_notify AFTER INSERT OR UPDATE ON cfg_items
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('config_grc', 'id', 'version');
