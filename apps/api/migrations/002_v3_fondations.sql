-- Suivi des audits SMSI — v3 (refonte, phase 0) : fondations.
-- S'applique aussi bien à une base neuve qu'à une base v2 existante (aucune perte : uniquement des ajouts).

-- ---------------------------------------------------------------- Lots d'import legacy
CREATE TABLE import_batches (
  id              bigserial PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL,
  filename        text NOT NULL,
  size            bigint NOT NULL,
  sha256          text NOT NULL,                 -- empreinte du fichier brut déposé
  source_schema   integer NOT NULL,
  envelope        boolean NOT NULL DEFAULT false,
  mode            text NOT NULL CHECK (mode IN ('init','merge','replace')),
  module          text,
  modules         text[] NOT NULL DEFAULT '{}',  -- modules effectivement modifiés
  report          jsonb NOT NULL,
  raw_key_id      text NOT NULL,                 -- fichier brut chiffré (AES-256-GCM, clé maître)
  raw_iv          bytea NOT NULL,
  raw_tag         bytea NOT NULL,
  raw_content     bytea NOT NULL,
  before_state    jsonb NOT NULL,                -- valeurs des modules modifiés avant l'import (annulation)
  after_state     jsonb NOT NULL,                -- valeurs après l'import (contrôle avant annulation)
  state_version_before integer,
  state_version_after  integer,
  status          text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','undone')),
  undone_at       timestamptz,
  undone_by       text,
  version         integer NOT NULL DEFAULT 1
);
ALTER TABLE import_batches ALTER COLUMN raw_content SET STORAGE EXTERNAL;
CREATE INDEX import_batches_created ON import_batches (created_at DESC);

-- ---------------------------------------------------------------- Colonnes communes des tables métier
-- version : contrôle de concurrence par enregistrement (PATCH avec If-Match) ;
-- legacy_id / import_batch_id / extra : traçabilité de l'import legacy, champs non modélisés conservés.
ALTER TABLE documents
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN legacy_id text,
  ADD COLUMN import_batch_id bigint REFERENCES import_batches(id) ON DELETE SET NULL,
  ADD COLUMN extra jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX documents_legacy_id ON documents (legacy_id) WHERE legacy_id IS NOT NULL;

ALTER TABLE links
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN legacy_id text,
  ADD COLUMN import_batch_id bigint REFERENCES import_batches(id) ON DELETE SET NULL,
  ADD COLUMN extra jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX links_legacy_id ON links (legacy_id) WHERE legacy_id IS NOT NULL;

ALTER TABLE users ADD COLUMN version integer NOT NULL DEFAULT 1;

ALTER TABLE app_state ADD COLUMN import_batch_id bigint REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE state_history ADD COLUMN import_batch_id bigint REFERENCES import_batches(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- Temps réel : LISTEN/NOTIFY
-- Chaque modification publie sur le canal « suivi_events » : entité, identifiant, version, opération, auteur.
-- Aucune donnée métier dans la notification : le client recharge ce qui le concerne, selon ses droits.
-- Arguments du déclencheur : nom d'entité, colonne identifiant, colonne version ('' si aucune).
CREATE FUNCTION suivi_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rec jsonb;
  actor text := NULLIF(current_setting('suivi.actor', true), '');
BEGIN
  IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
  PERFORM pg_notify('suivi_events', json_build_object(
    'entity', TG_ARGV[0],
    'id', COALESCE(rec->>TG_ARGV[1], ''),
    'version', CASE WHEN TG_ARGV[2] = '' THEN NULL ELSE (rec->>TG_ARGV[2])::int END,
    'op', lower(TG_OP),
    'author', COALESCE(actor, rec->>'updated_by', rec->>'created_by', rec->>'uploaded_by', ''),
    'ts', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )::text);
  RETURN NULL;
END $$;

CREATE TRIGGER documents_notify AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('documents', 'id', 'version');
CREATE TRIGGER document_versions_notify AFTER INSERT OR DELETE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('document_versions', 'document_id', 'version');
CREATE TRIGGER links_notify AFTER INSERT OR UPDATE OR DELETE ON links
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('links', 'id', 'version');
CREATE TRIGGER users_notify AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('users', 'id', 'version');
-- Sessions : uniquement ouverture et fermeture (la prolongation d'inactivité ne notifie pas).
CREATE TRIGGER sessions_notify AFTER INSERT OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('sessions', 'user_id', '');
CREATE TRIGGER settings_notify AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('settings', 'key', '');
CREATE TRIGGER app_state_notify AFTER INSERT OR UPDATE ON app_state
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('legacy_state', 'id', 'version');
CREATE TRIGGER import_batches_notify AFTER INSERT OR UPDATE ON import_batches
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('import_batches', 'id', 'version');
