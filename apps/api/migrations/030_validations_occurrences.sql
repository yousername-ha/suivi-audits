-- Validation d'une occurrence de tâche récurrente : OK, KO ou non applicable (NA), avec compte rendu et référence de preuve.
-- Journal immuable : une validation ne se modifie ni ne se supprime ; la reprise d'une occurrence déjà validée passe par une
-- réouverture motivée, inscrite au même journal (aucune réouverture silencieuse). Chaque commande porte un identifiant de
-- requête : la rejouer renvoie le même enregistrement sans en créer un second (idempotence). Migration additive.
CREATE TABLE occurrence_validations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objet_id    uuid NOT NULL REFERENCES grc_objects(id),
  request_id  uuid NOT NULL,
  seq         integer NOT NULL CHECK (seq >= 1),
  kind        text NOT NULL CHECK (kind IN ('validation', 'reouverture')),
  result      text CHECK (result IN ('ok', 'ko', 'na')),
  comment     text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 5000),
  proof_ref   text NOT NULL DEFAULT '' CHECK (char_length(proof_ref) <= 500),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (objet_id, request_id),
  UNIQUE (objet_id, seq),
  CONSTRAINT resultat_selon_nature CHECK ((kind = 'validation') = (result IS NOT NULL)),
  -- Un KO, un NA et toute réouverture se justifient ; l'OK peut se passer de commentaire.
  CONSTRAINT justification_exigee CHECK (
    (kind = 'validation' AND result = 'ok') OR char_length(btrim(comment)) >= 10)
);
CREATE INDEX occurrence_validations_objet ON occurrence_validations (objet_id, seq DESC);
CREATE TRIGGER occurrence_validations_immutable BEFORE UPDATE OR DELETE ON occurrence_validations
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER occurrence_validations_no_truncate BEFORE TRUNCATE ON occurrence_validations
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
