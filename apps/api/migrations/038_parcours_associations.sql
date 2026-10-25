-- Parcours guidé ISO 27001 / HDS (ADR 0045, addendum) : associations explicites d'une fiche ou d'une preuve existante à une
-- sous-action du parcours, dans un périmètre. Journal immuable (associer, retirer avec motif) : l'état courant est la dernière
-- opération pour (périmètre, sous-action, cible). Chaque commande porte un identifiant de requête (idempotence). Une
-- association ne modifie jamais la fiche ou la preuve, et ne vaut ni revue, ni conformité. Migration additive.
CREATE TABLE parcours_associations (
  seq         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  smsi_id     uuid NOT NULL REFERENCES grc_smsis(id),
  request_id  uuid NOT NULL,
  sous_action text NOT NULL CHECK (char_length(sous_action) BETWEEN 1 AND 100),
  operation   text NOT NULL CHECK (operation IN ('associer', 'retirer')),
  target_ref  text NOT NULL CHECK (char_length(target_ref) BETWEEN 1 AND 500),
  note        text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (smsi_id, request_id),
  CONSTRAINT motif_du_retrait CHECK (operation = 'associer' OR char_length(btrim(note)) >= 5)
);
CREATE INDEX parcours_associations_etat ON parcours_associations (smsi_id, sous_action, target_ref, seq DESC);
CREATE TRIGGER parcours_associations_immutable BEFORE UPDATE OR DELETE ON parcours_associations
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER parcours_associations_no_truncate BEFORE TRUNCATE ON parcours_associations
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
