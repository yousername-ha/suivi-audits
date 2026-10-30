-- Clés de sécurité FIDO2 / WebAuthn (ADR 0079) : second facteur après le mot de passe, à côté du TOTP qui reste obligatoire.
-- Migration additive : aucune donnée existante n'est modifiée ; une version antérieure ignore ces tables et colonnes.

-- Clés enregistrées. La clé publique n'est pas un secret : elle est stockée en clair (format COSE). Une clé révoquée est
-- conservée (trace), jamais supprimée ; une clé suspecte (compteur de signature qui ne progresse pas) est refusée tant
-- qu'un administrateur ne l'a pas réactivée ou révoquée.
CREATE TABLE webauthn_credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE CHECK (credential_id ~ '^[A-Za-z0-9_-]{16,1366}$'),
  public_key    bytea NOT NULL,
  sign_count    bigint NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  transports    jsonb NOT NULL DEFAULT '[]'::jsonb,
  aaguid        uuid NOT NULL,
  device_type   text NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up     boolean NOT NULL DEFAULT false,
  label         text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 64),
  -- Format d'attestation reçu à l'enrôlement (none, packed…), pour la politique « clés matérielles uniquement ».
  attestation_fmt text NOT NULL DEFAULT 'none',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  revoked_by    text NOT NULL DEFAULT '',
  suspect_at    timestamptz
);
CREATE INDEX webauthn_credentials_user ON webauthn_credentials (user_id);

-- Challenges : côté serveur, liés à la session (supprimés avec elle), un seul par session et par usage, usage unique et
-- durée de vie de 5 minutes au plus. Seule l'empreinte SHA-256 est conservée, jamais le challenge.
CREATE TABLE webauthn_challenges (
  session_hash   bytea NOT NULL REFERENCES sessions(id_hash) ON DELETE CASCADE,
  usage          text NOT NULL CHECK (usage IN ('enrolement', 'connexion', 'reauth')),
  challenge_hash bytea NOT NULL,
  expires_at     timestamptz NOT NULL,
  PRIMARY KEY (session_hash, usage)
);

-- Codes de récupération : dix codes à usage unique, empreinte HMAC-SHA-256 (clé dérivée de la clé maître) seulement.
CREATE TABLE recovery_codes (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,
  PRIMARY KEY (user_id, code_hash)
);

-- Identifiant WebAuthn du compte (32 octets aléatoires, jamais l'UUID interne), créé au premier enrôlement : prépare la
-- connexion sans mot de passe (phase 2, désactivée). Ré-enrôlement imposé par un administrateur après réinitialisation.
ALTER TABLE users ADD COLUMN webauthn_user_handle bytea UNIQUE;
ALTER TABLE users ADD COLUMN webauthn_reenrolement boolean NOT NULL DEFAULT false;

-- Ré-authentification récente (mot de passe et second facteur) : exigée pour enrôler ou révoquer une clé.
ALTER TABLE sessions ADD COLUMN reauth_at timestamptz;
