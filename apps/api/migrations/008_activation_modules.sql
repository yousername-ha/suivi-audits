-- B1 : configuration additive, état initial entièrement actif ; aucune donnée métier modifiée.
CREATE TABLE module_activation (
  id integer PRIMARY KEY CHECK (id = 1),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  disabled text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT '',
  CHECK (NOT (disabled && ARRAY['administration', 'parametres']::text[])),
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','ia','crrc','investissements','incidents','cartographie','documents','import_export']::text[]),
  CHECK (NOT ('audit' = ANY(disabled)) OR 'plan_audit' = ANY(disabled))
);
INSERT INTO module_activation(id) VALUES (1);
CREATE TRIGGER module_activation_notify AFTER UPDATE ON module_activation
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('module_activation', 'id', 'version');
