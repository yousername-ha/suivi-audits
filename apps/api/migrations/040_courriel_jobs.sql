-- Courriel (décision 1 du 25/10/2026, ADR 0049) : demandes d'envoi traitées par l'exécutant d'exploitation du serveur, jamais par
-- l'API (qui n'a pas d'accès réseau sortant). Une demande garde seulement son état et sa trace par étapes : ni mot de passe, ni
-- contenu secret. Migration additive.
CREATE TABLE courriel_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('test')),
  status       text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'en_cours', 'reussie', 'echec')),
  requested_by text NOT NULL,
  to_address   text NOT NULL CHECK (char_length(to_address) <= 200),
  result       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
CREATE INDEX courriel_jobs_etat ON courriel_jobs (status, created_at);
