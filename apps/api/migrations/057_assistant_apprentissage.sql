-- Assistant RSSI intégré (ADR 0086, point 13 ; addendum du 12/11/2026) : amélioration avec l'usage, sous contrôle d'une
-- personne. Fiches de méthode proposées par l'assistant et validées par le RSSI, contexte de l'organisation, avis sur les
-- rondes et sur les rappels. Migration additive et rejouable : aucune donnée existante n'est modifiée. Aucun entraînement
-- de modèle : ces textes sont seulement relus par l'assistant.

-- Contexte de l'organisation, rédigé par le RSSI, relu à chaque ronde et à chaque conversation.
ALTER TABLE assistant_reglages ADD COLUMN IF NOT EXISTS contexte text NOT NULL DEFAULT '' CHECK (length(contexte) <= 4000);

-- Fiches de méthode : seules les fiches validées sont relues par l'assistant.
CREATE TABLE IF NOT EXISTS assistant_methodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil     text NOT NULL REFERENCES assistant_profils (id),
  titre      text NOT NULL CHECK (length(titre) BETWEEN 1 AND 120),
  contenu    text NOT NULL CHECK (length(contenu) BETWEEN 1 AND 2000),
  etat       text NOT NULL DEFAULT 'proposee' CHECK (etat IN ('proposee', 'validee', 'refusee')),
  origine    text NOT NULL DEFAULT 'assistant' CHECK (origine IN ('assistant', 'personne')),
  ronde_id   uuid REFERENCES assistant_rondes (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by text NOT NULL DEFAULT '',
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS assistant_methodes_profil ON assistant_methodes (profil, etat, created_at DESC);

-- Avis du référent ou d'un administrateur de l'assistant sur une ronde.
ALTER TABLE assistant_rondes ADD COLUMN IF NOT EXISTS avis text CHECK (avis IN ('utile', 'inutile'));
ALTER TABLE assistant_rondes ADD COLUMN IF NOT EXISTS avis_motif text NOT NULL DEFAULT '' CHECK (length(avis_motif) <= 500);
ALTER TABLE assistant_rondes ADD COLUMN IF NOT EXISTS avis_par text NOT NULL DEFAULT '';
ALTER TABLE assistant_rondes ADD COLUMN IF NOT EXISTS methodes integer NOT NULL DEFAULT 0;

-- Avis du destinataire sur un rappel de l'assistant (seul ce type de notification le porte).
ALTER TABLE grc_notifications ADD COLUMN IF NOT EXISTS avis text CHECK (avis IN ('utile', 'inutile'));
ALTER TABLE grc_notifications DROP CONSTRAINT IF EXISTS grc_notifications_avis_assistant;
ALTER TABLE grc_notifications ADD CONSTRAINT grc_notifications_avis_assistant CHECK (avis IS NULL OR kind = 'assistant_rappel');
