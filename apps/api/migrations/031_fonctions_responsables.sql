-- Fonctions de l'organisation (annuaire de responsables de type « fonction ») : une fonction (par exemple RSSI, DPO,
-- responsable qualité) regroupe les personnes qui l'exercent. Une action ou une série peut avoir pour responsable une
-- personne, un groupe ou une fonction ; les rappels vont aux personnes que la fonction ou le groupe désigne à ce moment-là.
-- Migration additive : aucune donnée existante n'est modifiée.
CREATE TABLE fonctions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  archived    boolean NOT NULL DEFAULT false,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fonctions_nom ON fonctions (lower(name)) WHERE NOT archived;
CREATE TABLE fonction_membres (
  fonction_id uuid NOT NULL REFERENCES fonctions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (fonction_id, user_id)
);
CREATE INDEX fonction_membres_user ON fonction_membres (user_id);
