-- Connexion unique SAML 2.0 (ADR 0114 ; décisions du RSSI du 25/11/2026) : fournisseurs d'identité (Microsoft Entra ID,
-- Keycloak, SAML générique), demandes de connexion à usage unique, cache anti-rejeu des assertions, mode de connexion des
-- comptes (« local » ou « sso ») et rapprochement par (fournisseur, identifiant attendu).
-- Migration additive, aucune donnée reprise (consigne du 14/11/2026) : trois tables nouvelles et vides ; les colonnes
-- ajoutées aux comptes et aux sessions prennent leur valeur par défaut (tout compte existant reste « local », toute session
-- existante reste une session locale). password_hash reste NOT NULL : un compte « sso » reçoit une empreinte inutilisable.

CREATE TABLE sso_fournisseurs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                    text NOT NULL CHECK (type IN ('entra', 'keycloak', 'saml')),
  libelle                 text NOT NULL CHECK (char_length(libelle) BETWEEN 1 AND 120 AND libelle !~ '[[:cntrl:]]'),
  actif                   boolean NOT NULL DEFAULT false,
  -- Identifiant (entityID) attendu : les métadonnées et les assertions doivent le porter.
  entity_id               text NOT NULL UNIQUE
                          CHECK (char_length(entity_id) BETWEEN 1 AND 2000 AND entity_id !~ '[[:cntrl:]]'),
  -- Adresse des métadonnées, lue par l'exécutant (flux « sso-saml ») : HTTPS seulement ; null = import manuel.
  url_metadonnees         text CHECK (url_metadonnees IS NULL
                                      OR (url_metadonnees ~ '^https://' AND char_length(url_metadonnees) <= 2000
                                          AND url_metadonnees !~ '[[:cntrl:][:space:]]')),
  autorite_tls            text CHECK (autorite_tls IS NULL OR char_length(autorite_tls) <= 20000),
  mfa_source              text NOT NULL CHECK (mfa_source IN ('attribut', 'authn_context')),
  mfa_attribut            text NOT NULL DEFAULT '' CHECK (char_length(mfa_attribut) <= 500),
  mfa_valeurs             text[] NOT NULL CHECK (cardinality(mfa_valeurs) BETWEEN 1 AND 10),
  rapprochement           text NOT NULL DEFAULT 'nameid' CHECK (rapprochement IN ('nameid', 'attribut')),
  rapprochement_attribut  text NOT NULL DEFAULT '' CHECK (char_length(rapprochement_attribut) <= 500),
  -- Lu dans les métadonnées : adresse de connexion (HTTP-Redirect) et certificats de signature (PEM, empreinte, sujet,
  -- expiration).
  sso_url                 text CHECK (sso_url IS NULL OR (sso_url ~ '^https://' AND char_length(sso_url) <= 2000)),
  certificats             jsonb NOT NULL DEFAULT '[]'
                          CHECK (jsonb_typeof(certificats) = 'array' AND jsonb_array_length(certificats) <= 10),
  certificat_expire_le    timestamptz,
  metadonnees_source      text CHECK (metadonnees_source IN ('url', 'import')),
  metadonnees_lues_le     timestamptz,
  metadonnees_signees     boolean NOT NULL DEFAULT false,
  metadonnees_empreinte   text CHECK (metadonnees_empreinte IS NULL OR metadonnees_empreinte ~ '^[0-9a-f]{64}$'),
  metadonnees_erreur      text CHECK (metadonnees_erreur IS NULL OR char_length(metadonnees_erreur) <= 300),
  metadonnees_erreur_le   timestamptz,
  -- Lecture en cours, réclamée par l'exécutant, et relecture demandée par un administrateur.
  lecture_id              uuid,
  lecture_reclamee_le     timestamptz,
  relecture_demandee      boolean NOT NULL DEFAULT false,
  -- Empreinte du certificat déjà signalé « expire bientôt » (une alerte par certificat).
  alerte_expiration       text,
  version                 integer NOT NULL DEFAULT 1 CHECK (version > 0),
  cree_le                 timestamptz NOT NULL DEFAULT now(),
  modifie_le              timestamptz NOT NULL DEFAULT now()
);

-- Demandes de connexion (AuthnRequest, HTTP-Redirect) : usage unique, cinq minutes ; InResponseTo obligatoire. Le chemin
-- de retour est un chemin relatif interne. Une ré-authentification (ForceAuthn) nomme le compte et la session concernés.
-- Le cookie de session (SameSite=Strict) ne passe pas sur le POST du fournisseur : la demande est liée au navigateur par un
-- témoin dédié (SameSite=None, Secure, HttpOnly, chemin /api/auth/sso/, cinq minutes), dont seule l'empreinte est gardée.
CREATE TABLE sso_requetes (
  id              text PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 100 AND id ~ '^[A-Za-z_][A-Za-z0-9_.-]*$'),
  fournisseur_id  uuid NOT NULL REFERENCES sso_fournisseurs(id) ON DELETE CASCADE,
  but             text NOT NULL CHECK (but IN ('connexion', 'reauth')),
  retour          text NOT NULL CHECK (retour ~ '^/' AND retour !~ '^//' AND retour !~ '[[:cntrl:]\\]'
                                       AND char_length(retour) <= 500),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  session_hash    bytea,
  -- Liaison au navigateur qui a lancé la demande (décision du RSSI du 25/11/2026) : SHA-256 du témoin à usage unique posé au
  -- départ (32 octets aléatoires, jamais stockés en clair), comparé à l'adresse de retour.
  liaison         bytea NOT NULL CHECK (octet_length(liaison) = 32),
  cree_le         timestamptz NOT NULL DEFAULT now(),
  expire_le       timestamptz NOT NULL,
  consommee_le    timestamptz,
  CHECK ((but = 'reauth') = (user_id IS NOT NULL AND session_hash IS NOT NULL))
);
CREATE INDEX sso_requetes_expire ON sso_requetes (expire_le);

-- Anti-rejeu : identifiant de chaque assertion acceptée, gardé jusqu'à son NotOnOrAfter (tolérance d'horloge comprise).
CREATE TABLE sso_assertions_vues (
  cle             text PRIMARY KEY CHECK (char_length(cle) BETWEEN 1 AND 3000),
  fournisseur_id  uuid NOT NULL REFERENCES sso_fournisseurs(id) ON DELETE CASCADE,
  expire_le       timestamptz NOT NULL
);
CREATE INDEX sso_assertions_vues_expire ON sso_assertions_vues (expire_le);

-- Comptes : mode de connexion, fournisseur et identifiant attendu. Un compte « sso » a les deux ; un compte « local » aucun.
ALTER TABLE users
  ADD COLUMN mode_connexion text NOT NULL DEFAULT 'local' CHECK (mode_connexion IN ('local', 'sso')),
  ADD COLUMN sso_fournisseur_id uuid REFERENCES sso_fournisseurs(id) ON DELETE RESTRICT,
  ADD COLUMN sso_identifiant text CHECK (sso_identifiant IS NULL
                                         OR (char_length(sso_identifiant) BETWEEN 1 AND 500
                                             AND sso_identifiant !~ '[[:cntrl:]]')),
  ADD CONSTRAINT users_sso_coherent
    CHECK ((mode_connexion = 'sso') = (sso_fournisseur_id IS NOT NULL AND sso_identifiant IS NOT NULL)
           AND (sso_fournisseur_id IS NULL) = (sso_identifiant IS NULL));
-- Unicité (fournisseur, identifiant), sans distinction de casse.
CREATE UNIQUE INDEX users_sso_identifiant ON users (sso_fournisseur_id, lower(sso_identifiant))
  WHERE sso_fournisseur_id IS NOT NULL;

-- Sessions ouvertes par la connexion unique (les seules admises pour un compte « sso »).
ALTER TABLE sessions ADD COLUMN par_sso boolean NOT NULL DEFAULT false;
