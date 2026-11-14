-- Déclaration d'applicabilité par périmètre (BUG-062) : le périmètre commun garde la déclaration de l'outil de suivi
-- (clé `dda` de l'état) ; chaque autre périmètre a la sienne, une ligne par mesure décidée. Une mesure sans ligne reste
-- « non examinée » dans ce périmètre (6.1.3 d). Table additive : une version antérieure l'ignore.
CREATE TABLE IF NOT EXISTS dda_perimetres (
  smsi_id    uuid NOT NULL REFERENCES grc_smsis(id) ON DELETE CASCADE,
  mesure_id  text NOT NULL CHECK (char_length(mesure_id) BETWEEN 1 AND 200),
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (smsi_id, mesure_id)
);
