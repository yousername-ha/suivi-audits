-- Assistant RSSI intégré (ADR 0086, point 12 ; décision A9) : texte extrait des documents et index de recherche en texte
-- intégral, tenus dans la base. Le texte est rattaché à la VERSION du document et disparaît avec elle (clé étrangère en
-- cascade). Il est en clair dans la base, alors que les fichiers y sont chiffrés : accepté par le RSSI (A9). Rien n'est
-- extrait tant qu'aucun profil de l'assistant n'est autorisé à lire les documents. Migration additive et rejouable.
ALTER TABLE assistant_profils ADD COLUMN IF NOT EXISTS documents boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_profils ADD COLUMN IF NOT EXISTS classification_max text NOT NULL DEFAULT 'interne'
  CHECK (classification_max IN ('public', 'interne', 'restreint', 'confidentiel'));

CREATE TABLE IF NOT EXISTS document_textes (
  document_id uuid NOT NULL,
  version     integer NOT NULL,
  etat        text NOT NULL CHECK (etat IN ('extrait', 'non_lu', 'echec')),
  motif       text NOT NULL DEFAULT '',
  texte       text NOT NULL DEFAULT '',
  -- Recherche en français sur le début du texte (la taille d'un vecteur de recherche est bornée par PostgreSQL).
  recherche   tsvector GENERATED ALWAYS AS (to_tsvector('french', left(texte, 200000))) STORED,
  extrait_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, version),
  FOREIGN KEY (document_id, version) REFERENCES document_versions (document_id, version) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS document_textes_recherche ON document_textes USING gin (recherche);
