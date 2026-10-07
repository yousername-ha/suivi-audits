-- Suivi des audits SMSI — schéma initial
-- Exécuté automatiquement au démarrage (table schema_migrations).

-- gen_random_uuid() est natif depuis PostgreSQL 13.

-- ---------------------------------------------------------------- Comptes
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL,
  display_name  text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  role          text NOT NULL CHECK (role IN ('admin','rw','ro')),
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  totp_secret   bytea,                 -- chiffré (AES-256-GCM, clé maître)
  totp_pending  bytea,                 -- secret en cours d'enrôlement, chiffré
  totp_enabled  boolean NOT NULL DEFAULT false,
  totp_last_step bigint NOT NULL DEFAULT 0,   -- anti-rejeu
  disabled      boolean NOT NULL DEFAULT false,
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_ci ON users (lower(username));

CREATE TABLE sessions (
  id_hash      bytea PRIMARY KEY,        -- SHA-256 du jeton de session (le jeton n'est jamais stocké)
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf         text NOT NULL,
  mfa_ok       boolean NOT NULL DEFAULT false,
  ip           inet,
  user_agent   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- Journal d'audit (append-only)
CREATE TABLE audit_log (
  id        bigserial PRIMARY KEY,
  ts        timestamptz NOT NULL DEFAULT now(),
  user_id   uuid,
  username  text NOT NULL DEFAULT '',
  ip        inet,
  action    text NOT NULL,
  target    text NOT NULL DEFAULT '',
  details   jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_log_ts ON audit_log (ts DESC);
CREATE INDEX audit_log_action ON audit_log (action);

CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log est en ajout seul';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- ---------------------------------------------------------------- Données de l'application
CREATE TABLE app_state (
  id         smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version    integer NOT NULL,
  data       jsonb NOT NULL,
  sha256     text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE TABLE state_history (
  version    integer PRIMARY KEY,
  data       jsonb NOT NULL,
  sha256     text NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL,
  note       text NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------- Documents (GED) et liens
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT '',
  refs        text[] NOT NULL DEFAULT '{}',    -- rattachements : mesures (A.5.15), écarts (26-DHA-84), processus (PRM02)…
  tags        text[] NOT NULL DEFAULT '{}',
  classification text NOT NULL DEFAULT 'interne' CHECK (classification IN ('public','interne','restreint','confidentiel')),
  current_version integer NOT NULL DEFAULT 0,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  deleted_by  text
);
CREATE INDEX documents_refs ON documents USING gin (refs);
CREATE INDEX documents_tags ON documents USING gin (tags);

CREATE TABLE document_versions (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version     integer NOT NULL,
  filename    text NOT NULL,
  mime        text NOT NULL,
  size        bigint NOT NULL,
  sha256      text NOT NULL,              -- empreinte du fichier en clair (intégrité / preuve)
  key_id      text NOT NULL,              -- identifiant de la clé de chiffrement
  iv          bytea NOT NULL,
  auth_tag    bytea NOT NULL,
  content     bytea NOT NULL,             -- contenu chiffré AES-256-GCM
  scan_status text NOT NULL DEFAULT 'non_analysé',
  uploaded_by text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  comment     text NOT NULL DEFAULT '',
  PRIMARY KEY (document_id, version)
);
ALTER TABLE document_versions ALTER COLUMN content SET STORAGE EXTERNAL;  -- déjà chiffré : pas de compression

CREATE TABLE links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  url         text NOT NULL,
  description text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT '',
  refs        text[] NOT NULL DEFAULT '{}',
  tags        text[] NOT NULL DEFAULT '{}',
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  deleted_by  text
);
CREATE INDEX links_refs ON links USING gin (refs);

-- ---------------------------------------------------------------- Vues de lecture (BI, requêtes SQL)
CREATE VIEW v_items AS
  SELECT i->>'id' AS id, i->>'ref' AS referentiel, i->>'num' AS num, i->>'title' AS intitule,
         i->>'owner' AS pilote, i->>'prep' AS preparation, i->>'notes' AS notes, i->'afnor' AS afnor, i->'interne' AS interne
  FROM app_state, jsonb_array_elements(data->'items') AS i;

CREATE VIEW v_findings AS
  SELECT f->>'id' AS id, f->>'source' AS source, (f->>'year')::int AS annee, f->>'type' AS type, f->>'status' AS statut,
         f->>'text' AS constat, f->>'desc' AS description, f->>'action' AS action, f->>'owner' AS pilote,
         NULLIF(f->>'due','') AS echeance, ARRAY(SELECT jsonb_array_elements_text(f->'items')) AS mesures
  FROM app_state, jsonb_array_elements(data->'findings') AS f;

CREATE VIEW v_documents AS
  SELECT d.id, d.title, d.category, d.refs, d.tags, d.classification, v.filename, v.mime, v.size, v.sha256,
         d.current_version, d.updated_by, d.updated_at
  FROM documents d JOIN document_versions v ON v.document_id = d.id AND v.version = d.current_version
  WHERE d.deleted_at IS NULL;
