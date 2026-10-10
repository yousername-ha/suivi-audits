-- Demandes limitées aux publications stables ; journal final également conservé hors base par l'exécutant.
CREATE TABLE update_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('check', 'install')),
  target text CHECK (target ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'rolled_back', 'failed', 'intervention')),
  requested_by text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CHECK ((kind='check' AND target IS NULL) OR (kind='install' AND target IS NOT NULL))
);
CREATE UNIQUE INDEX update_jobs_active ON update_jobs ((true)) WHERE status IN ('queued','running','intervention');
CREATE TRIGGER update_jobs_notify AFTER INSERT OR UPDATE OR DELETE ON update_jobs FOR EACH ROW EXECUTE FUNCTION suivi_notify();
