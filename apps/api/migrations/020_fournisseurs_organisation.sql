-- Fournisseurs de l'organisation (ADR 0032, lot M4) : critères définis par l'organisme (aucun fourni), évaluations
-- immuables sans périmètre, rattachement des fournisseurs à plusieurs périmètres. Le registre des fournisseurs reste
-- celui de l'état historique (app_state) ; un fournisseur se désigne par son identifiant historique. Tables additives.
CREATE TABLE sup_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (char_length(label) BETWEEN 3 AND 200),
  description text NOT NULL DEFAULT '',
  -- usages repris de l'ISO 9001:2015, 8.4.1 : critères de sélection, d'évaluation, de surveillance, de réévaluation
  purposes text[] NOT NULL DEFAULT '{}' CHECK (purposes <@ ARRAY['selection','evaluation','surveillance','reevaluation']),
  requirement_refs text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  archived boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sup_criteria_label ON sup_criteria (lower(label)) WHERE NOT archived;
CREATE TABLE sup_criterion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id uuid NOT NULL REFERENCES sup_criteria(id),
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (criterion_id, version)
);
-- Évaluation : datée, immuable, sans périmètre. Le nom du fournisseur est figé : il survit au retrait du registre.
CREATE TABLE sup_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id text NOT NULL CHECK (char_length(supplier_id) BETWEEN 1 AND 200),
  supplier_name text NOT NULL,
  evaluated_at date NOT NULL,
  evaluator text NOT NULL,
  conclusion text NOT NULL DEFAULT '',
  next_review_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sup_evaluations_supplier ON sup_evaluations (supplier_id, evaluated_at DESC, created_at DESC);
CREATE TABLE sup_evaluation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES sup_evaluations(id),
  criterion_id uuid NOT NULL REFERENCES sup_criteria(id),
  criterion_version integer NOT NULL,
  criterion_label text NOT NULL,
  requirement_refs text[] NOT NULL DEFAULT '{}',
  -- « répond » : oui, non, ou non évalué (null). Ce n'est pas une échelle : aucun score, aucun seuil.
  meets boolean,
  result text NOT NULL DEFAULT '',
  UNIQUE (evaluation_id, criterion_id)
);
-- Rattachement d'un fournisseur à un périmètre : sans donnée d'évaluation.
CREATE TABLE sup_scope_links (
  smsi_id uuid NOT NULL REFERENCES grc_smsis(id),
  supplier_id text NOT NULL CHECK (char_length(supplier_id) BETWEEN 1 AND 200),
  attached_by text NOT NULL,
  attached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (smsi_id, supplier_id)
);
CREATE TRIGGER sup_criterion_history_immutable BEFORE UPDATE OR DELETE ON sup_criterion_history
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER sup_criterion_history_no_truncate BEFORE TRUNCATE ON sup_criterion_history
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER sup_evaluations_immutable BEFORE UPDATE OR DELETE ON sup_evaluations
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER sup_evaluations_no_truncate BEFORE TRUNCATE ON sup_evaluations
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER sup_evaluation_items_immutable BEFORE UPDATE OR DELETE ON sup_evaluation_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER sup_evaluation_items_no_truncate BEFORE TRUNCATE ON sup_evaluation_items
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
