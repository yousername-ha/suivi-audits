-- A1a : file opérationnelle, aucune donnée métier modifiée.
CREATE TABLE backup_worker (
  id integer PRIMARY KEY CHECK (id = 1),
  seen_at timestamptz NOT NULL,
  ready boolean NOT NULL,
  message text NOT NULL
);
CREATE TABLE backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente','en_cours','reussie','echec','annulee')),
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  report jsonb,
  message text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX backup_jobs_one_active ON backup_jobs ((true)) WHERE status IN ('en_attente','en_cours');
