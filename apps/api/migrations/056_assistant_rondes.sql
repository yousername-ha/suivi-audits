-- Assistant RSSI intégré (ADR 0086, lot A3, première tranche) : rondes autonomes, missions, mémoire par profil, rappels.
-- Migration additive et rejouable : aucune donnée existante n'est modifiée. Aucune ronde ne part tant qu'un administrateur
-- n'a pas activé la ronde quotidienne d'un profil et désigné son référent.

-- Pause immédiate, heure de la ronde quotidienne (heure de Paris) et plafond de rappels par personne et par jour.
ALTER TABLE assistant_reglages ADD COLUMN IF NOT EXISTS en_pause boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_reglages ADD COLUMN IF NOT EXISTS heure_ronde smallint NOT NULL DEFAULT 6 CHECK (heure_ronde BETWEEN 0 AND 23);
ALTER TABLE assistant_reglages ADD COLUMN IF NOT EXISTS plafond_rappels_jour smallint NOT NULL DEFAULT 5 CHECK (plafond_rappels_jour BETWEEN 0 AND 50);

-- Une ronde lit avec les droits de son référent, bornés aux périmètres du profil. Sans référent, pas de ronde.
ALTER TABLE assistant_profils ADD COLUMN IF NOT EXISTS ronde_quotidienne boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_profils ADD COLUMN IF NOT EXISTS referent_id uuid REFERENCES users (id) ON DELETE SET NULL;

-- Journal des rondes : déclencheur, résultat, lectures faites, consommation. Le rapport est lisible par le référent de la
-- ronde et par les administrateurs de l'assistant.
CREATE TABLE IF NOT EXISTS assistant_rondes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil        text NOT NULL REFERENCES assistant_profils (id),
  declencheur   text NOT NULL CHECK (declencheur IN ('planifiee', 'manuelle')),
  etat          text NOT NULL DEFAULT 'en_cours' CHECK (etat IN ('en_cours', 'terminee', 'echec')),
  referent_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  referent      text NOT NULL DEFAULT '',
  demandee_par  text NOT NULL DEFAULT '',
  debut         timestamptz NOT NULL DEFAULT now(),
  fin           timestamptz,
  rapport       text NOT NULL DEFAULT '',
  erreur        text NOT NULL DEFAULT '',
  sources       jsonb NOT NULL DEFAULT '[]',
  outils        jsonb NOT NULL DEFAULT '[]',
  rappels       integer NOT NULL DEFAULT 0,
  notes         integer NOT NULL DEFAULT 0,
  jetons_entree integer NOT NULL DEFAULT 0,
  jetons_sortie integer NOT NULL DEFAULT 0,
  appels        integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS assistant_rondes_recentes ON assistant_rondes (debut DESC);

-- Missions : consignes durables rédigées par le RSSI, reprises à chaque ronde jusqu'à leur clôture.
CREATE TABLE IF NOT EXISTS assistant_missions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil     text NOT NULL REFERENCES assistant_profils (id),
  consigne   text NOT NULL CHECK (length(consigne) BETWEEN 1 AND 2000),
  etat       text NOT NULL DEFAULT 'ouverte' CHECK (etat IN ('ouverte', 'close')),
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_by  text NOT NULL DEFAULT '',
  closed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS assistant_missions_profil ON assistant_missions (profil, etat, created_at);

-- Mémoire par profil : notes courtes que l'assistant écrit pendant une ronde, lisibles et supprimables par le RSSI.
CREATE TABLE IF NOT EXISTS assistant_memoire (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil     text NOT NULL REFERENCES assistant_profils (id),
  contenu    text NOT NULL CHECK (length(contenu) BETWEEN 1 AND 600),
  ronde_id   uuid REFERENCES assistant_rondes (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_memoire_profil ON assistant_memoire (profil, created_at DESC);
