-- Assistant RSSI intégré (ADR 0086, point 8) : propositions déposées par l'assistant pendant une ronde, puis décision d'une
-- personne. Rien n'entre dans un registre avant la confirmation ; celle-ci crée l'élément sous l'identité de la personne qui
-- décide, avec ses droits. Une proposition rejetée n'est pas redéposée tant que sa source n'a pas changé. Migration additive
-- et rejouable.
CREATE TABLE IF NOT EXISTS assistant_propositions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil         text NOT NULL REFERENCES assistant_profils (id),
  ronde_id       uuid REFERENCES assistant_rondes (id) ON DELETE SET NULL,
  referent_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  smsi_id        uuid NOT NULL REFERENCES grc_smsis (id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('action')),
  titre          text NOT NULL CHECK (length(titre) BETWEEN 1 AND 200),
  description    text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  echeance       date,
  -- Élément qui motive la proposition, et sa version au moment du dépôt.
  source_id      uuid REFERENCES grc_objects (id) ON DELETE SET NULL,
  source_nom     text NOT NULL DEFAULT '',
  source_version integer,
  etat           text NOT NULL DEFAULT 'en_attente' CHECK (etat IN ('en_attente', 'confirmee', 'rejetee')),
  decided_by     text NOT NULL DEFAULT '',
  decided_at     timestamptz,
  decision_note  text NOT NULL DEFAULT '' CHECK (length(decision_note) <= 500),
  objet_cree     uuid REFERENCES grc_objects (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_propositions_profil ON assistant_propositions (profil, etat, created_at DESC);
CREATE INDEX IF NOT EXISTS assistant_propositions_source ON assistant_propositions (source_id, etat);
ALTER TABLE assistant_rondes ADD COLUMN IF NOT EXISTS propositions integer NOT NULL DEFAULT 0;
