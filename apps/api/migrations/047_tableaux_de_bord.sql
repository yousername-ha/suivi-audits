-- Disposition du tableau de bord de l'accueil (ADR 0078, lot 2a) : ordre, largeur et état masqué des dalles, par compte,
-- et disposition proposée par défaut à l'organisation (proprietaire NULL). Une disposition ne contient aucune donnée
-- métier. Migration additive et rejouable : aucune donnée existante n'est modifiée ; sans disposition enregistrée,
-- l'accueil garde la disposition standard.
CREATE TABLE IF NOT EXISTS tableaux_de_bord (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietaire uuid REFERENCES users (id) ON DELETE CASCADE,
  nom          text NOT NULL DEFAULT 'Tableau de bord' CHECK (char_length(nom) BETWEEN 1 AND 120),
  disposition  jsonb NOT NULL CHECK (jsonb_typeof(disposition) = 'object' AND pg_column_size(disposition) <= 16384),
  version      integer NOT NULL DEFAULT 1,
  updated_by   text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Lot 2a : une disposition personnelle par compte, une seule disposition par défaut.
CREATE UNIQUE INDEX IF NOT EXISTS tableaux_de_bord_proprietaire
  ON tableaux_de_bord (proprietaire) WHERE proprietaire IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tableaux_de_bord_defaut
  ON tableaux_de_bord ((true)) WHERE proprietaire IS NULL;
