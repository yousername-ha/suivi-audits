-- Assistant RSSI intégré (ADR 0086, points 9 et 10) : questions posées par l'assistant pendant une ronde, réponse de la
-- personne depuis la notification, relance après un délai réglable. Une question n'écrit dans aucun registre. Migration
-- additive et rejouable.
ALTER TABLE assistant_reglages ADD COLUMN IF NOT EXISTS delai_relance_jours smallint NOT NULL DEFAULT 3 CHECK (delai_relance_jours BETWEEN 1 AND 30);

CREATE TABLE IF NOT EXISTS assistant_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil          text NOT NULL REFERENCES assistant_profils (id),
  ronde_id        uuid REFERENCES assistant_rondes (id) ON DELETE SET NULL,
  referent_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  smsi_id         uuid NOT NULL REFERENCES grc_smsis (id) ON DELETE CASCADE,
  object_id       uuid NOT NULL REFERENCES grc_objects (id) ON DELETE CASCADE,
  objet_nom       text NOT NULL DEFAULT '',
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  notification_id uuid REFERENCES grc_notifications (id) ON DELETE SET NULL,
  texte           text NOT NULL CHECK (length(texte) BETWEEN 1 AND 400),
  etat            text NOT NULL DEFAULT 'ouverte' CHECK (etat IN ('ouverte', 'repondue', 'sans_reponse')),
  reponse         text NOT NULL DEFAULT '' CHECK (length(reponse) <= 2000),
  repondue_at     timestamptz,
  -- La réponse a été remise à l'assistant lors d'une ronde (elle ne l'est qu'une fois).
  lue_at          timestamptz,
  relances        smallint NOT NULL DEFAULT 0,
  relancee_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_questions_profil ON assistant_questions (profil, etat, created_at DESC);
CREATE INDEX IF NOT EXISTS assistant_questions_personne ON assistant_questions (user_id, created_at DESC);
-- Une seule question ouverte par élément et par personne.
CREATE UNIQUE INDEX IF NOT EXISTS assistant_questions_ouverte ON assistant_questions (object_id, user_id) WHERE etat = 'ouverte';
