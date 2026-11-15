-- Critères rattachés aux fournisseurs (ADR 0098, complète l'ADR 0032) : le registre des critères reste commun à
-- l'organisation ; chaque fournisseur reçoit les critères qui le concernent. Le fournisseur se désigne par son
-- identifiant historique, comme dans sup_evaluations et sup_scope_links. Un critère retiré reste rattaché (il n'est
-- plus proposé). Le rattachement ne porte aucune réponse : la dernière réponse se lit dans les évaluations immuables.
-- Table additive, sans reprise de données.
CREATE TABLE sup_criterion_links (
  criterion_id uuid NOT NULL REFERENCES sup_criteria(id),
  supplier_id text NOT NULL CHECK (char_length(supplier_id) BETWEEN 1 AND 200),
  attached_by text NOT NULL,
  attached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (criterion_id, supplier_id)
);
CREATE INDEX sup_criterion_links_supplier ON sup_criterion_links (supplier_id);
