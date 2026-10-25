-- Contributions d'un collaborateur à une action : commentaire et preuve jointe (ADR 0043, addendum). Journal immuable : une
-- contribution ne se modifie ni ne se supprime. Chaque commande porte un identifiant de requête : la rejouer renvoie le même
-- enregistrement sans en créer un second (idempotence). Migration additive.
CREATE TABLE contributions_elements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objet_id    uuid NOT NULL REFERENCES grc_objects(id),
  request_id  uuid NOT NULL,
  seq         integer NOT NULL CHECK (seq >= 1),
  kind        text NOT NULL CHECK (kind IN ('commentaire', 'preuve')),
  comment     text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 5000),
  proof_ref   text NOT NULL DEFAULT '' CHECK (char_length(proof_ref) <= 500),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (objet_id, request_id),
  UNIQUE (objet_id, seq),
  CONSTRAINT contenu_selon_nature CHECK (
    (kind = 'commentaire' AND char_length(btrim(comment)) >= 1 AND proof_ref = '')
    OR (kind = 'preuve' AND proof_ref <> ''))
);
CREATE INDEX contributions_elements_objet ON contributions_elements (objet_id, seq DESC);
CREATE TRIGGER contributions_elements_immutable BEFORE UPDATE OR DELETE ON contributions_elements
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER contributions_elements_no_truncate BEFORE TRUNCATE ON contributions_elements
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
