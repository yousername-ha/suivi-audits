-- Module Vulnérabilités (ADR 0100, lots V2 et V3) : veille sur cinq sources publiques (CISA KEV, NVD, EPSS, CERT-FR,
-- CERT Santé). Migration additive : quatre tables nouvelles, aucune table existante modifiée. Sans reprise de données
-- (consigne du 14/11/2026) : la veille démarre vide, son flux est fermé.
-- Ce sont des données publiques recalculables : la remise à vide les efface avec le travail (apps/api/src/remise-a-vide.ts).
-- La liste des sources est fermée et écrite dans le code (packages/shared/src/veille-vulnerabilites.ts) ; la base la fige
-- aussi, pour qu'aucune autre source n'y entre.

-- État de chaque source : dernière collecte réussie, dernier essai, erreur sur une ligne. `creneau` : dernier jour
-- (Europe/Paris) dont la collecte planifiée a été inscrite, consommé avant l'inscription (aucun rejeu après une panne).
-- `fenetre_fin` : fin de la dernière fenêtre de dates NVD collectée avec succès (la suivante part de là).
CREATE TABLE vulnerabilites_veille_sources (
  source            text PRIMARY KEY CHECK (source IN ('cisa-kev', 'nvd', 'epss', 'cert-fr', 'cert-sante')),
  derniere_reussite timestamptz,
  dernier_essai     timestamptz,
  erreur            text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  creneau           date,
  fenetre_fin       timestamptz
);

-- Failles (CVE) connues de la veille : champs NVD, score EPSS et sa date, champs du catalogue KEV. Une ligne par CVE, mise à
-- jour à chaque collecte (aucun doublon : clé primaire). Une CVE citée par un avis y entre sans autre champ, pour que son
-- score EPSS puisse être demandé. Textes repris tels quels (anglais), bornés.
CREATE TABLE vulnerabilites_veille_cve (
  cve              text PRIMARY KEY CHECK (cve ~ '^CVE-[12][0-9]{3}-[0-9]{4,9}$'),
  -- NVD
  description      text CHECK (description IS NULL OR char_length(description) <= 1000),
  publie_le        timestamptz,
  modifie_le       timestamptz,
  cvss31_score     numeric(3,1) CHECK (cvss31_score IS NULL OR cvss31_score BETWEEN 0 AND 10),
  cvss31_vecteur   text CHECK (cvss31_vecteur IS NULL OR (char_length(cvss31_vecteur) <= 400 AND cvss31_vecteur ~ '^CVSS:3\.1/')),
  cvss31_gravite   text CHECK (cvss31_gravite IS NULL OR cvss31_gravite IN ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  cvss40_score     numeric(3,1) CHECK (cvss40_score IS NULL OR cvss40_score BETWEEN 0 AND 10),
  cvss40_vecteur   text CHECK (cvss40_vecteur IS NULL OR (char_length(cvss40_vecteur) <= 400 AND cvss40_vecteur ~ '^CVSS:4\.0/')),
  cvss40_gravite   text CHECK (cvss40_gravite IS NULL OR cvss40_gravite IN ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  editeurs         text[] NOT NULL DEFAULT '{}' CHECK (cardinality(editeurs) <= 20),
  produits         text[] NOT NULL DEFAULT '{}' CHECK (cardinality(produits) <= 20),
  nvd_le           timestamptz,
  -- EPSS : probabilité publiée entre 0 et 1, centile, date du score
  epss_score       numeric(6,5) CHECK (epss_score IS NULL OR epss_score BETWEEN 0 AND 1),
  epss_centile     numeric(6,5) CHECK (epss_centile IS NULL OR epss_centile BETWEEN 0 AND 1),
  epss_date        date,
  epss_le          timestamptz,
  -- Catalogue KEV de la CISA
  kev_editeur      text CHECK (kev_editeur IS NULL OR char_length(kev_editeur) <= 200),
  kev_produit      text CHECK (kev_produit IS NULL OR char_length(kev_produit) <= 200),
  kev_nom          text CHECK (kev_nom IS NULL OR char_length(kev_nom) <= 300),
  kev_description  text CHECK (kev_description IS NULL OR char_length(kev_description) <= 1000),
  kev_action       text CHECK (kev_action IS NULL OR char_length(kev_action) <= 1000),
  kev_ajout        date,
  kev_echeance     date,
  kev_rancongiciel boolean,
  kev_le           timestamptz,
  -- Dernière citation par un avis du CERT-FR ou du CERT Santé (ordre des demandes EPSS)
  avis_le          timestamptz,
  cree_le          timestamptz NOT NULL DEFAULT now(),
  maj_le           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vulnerabilites_veille_cve_kev ON vulnerabilites_veille_cve (kev_ajout DESC) WHERE kev_ajout IS NOT NULL;
CREATE INDEX vulnerabilites_veille_cve_modifie ON vulnerabilites_veille_cve (modifie_le DESC NULLS LAST);

-- Alertes et avis du CERT-FR et du CERT Santé : identifiant contrôlé, titre et résumé nettoyés et bornés, adresse en https sur
-- l'hôte de la source, CVE citées. Une ligne par (source, identifiant) : une collecte rejouée met à jour sans doublon.
CREATE TABLE vulnerabilites_veille_avis (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL CHECK (source IN ('cert-fr', 'cert-sante')),
  identifiant text NOT NULL CHECK (
                (source = 'cert-fr' AND identifiant ~ '^CERTFR-20[0-9]{2}-(ALE|AVI)-[0-9]{2,4}$')
                OR (source = 'cert-sante' AND identifiant ~ '^[1-9][0-9]{0,9}$')),
  nature      text NOT NULL CHECK (nature IN ('alerte', 'avis')),
  titre       text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 300),
  resume      text NOT NULL DEFAULT '' CHECK (char_length(resume) <= 1000),
  adresse     text CHECK (adresse IS NULL OR (char_length(adresse) <= 300 AND (
                (source = 'cert-fr' AND adresse ~ '^https://cert\.cyber\.gouv\.fr/(alerte|avis)/CERTFR-')
                OR (source = 'cert-sante' AND adresse ~ '^https://cyberveille\.esante\.gouv\.fr/alertes/')))),
  publie_le   timestamptz,
  cves        text[] NOT NULL DEFAULT '{}' CHECK (cardinality(cves) <= 200),
  cves_lues   boolean NOT NULL DEFAULT false,
  vu_le       timestamptz NOT NULL DEFAULT now(),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, identifiant)
);
CREATE INDEX vulnerabilites_veille_avis_date ON vulnerabilites_veille_avis (publie_le DESC NULLS LAST);
CREATE INDEX vulnerabilites_veille_avis_cves ON vulnerabilites_veille_avis USING gin (cves);

-- File et journal des collectes : l'API inscrit (tic quotidien ou « Collecter maintenant »), l'exécutant d'exploitation
-- réclame (« suivi veille-claim »), rapporte par lots bornés (« suivi veille-lot ») puis termine (« suivi veille-finish »).
-- Erreur nettoyée, sur une ligne, sans contenu de réponse. Fenêtre de dates : collectes NVD seulement.
CREATE TABLE vulnerabilites_veille_collectes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL CHECK (source IN ('cisa-kev', 'nvd', 'epss', 'cert-fr', 'cert-sante')),
  origine       text NOT NULL CHECK (origine IN ('manuel', 'planifie')),
  etat          text NOT NULL DEFAULT 'en_file' CHECK (etat IN ('en_file', 'en_cours', 'recu', 'echec', 'expire')),
  demande_par   text NOT NULL,
  demande_le    timestamptz NOT NULL DEFAULT now(),
  debute_le     timestamptz,
  termine_le    timestamptz,
  fenetre_debut timestamptz,
  fenetre_fin   timestamptz,
  lots          integer NOT NULL DEFAULT 0 CHECK (lots BETWEEN 0 AND 40),
  elements      integer NOT NULL DEFAULT 0 CHECK (elements BETWEEN 0 AND 20000),
  ecartes       integer NOT NULL DEFAULT 0 CHECK (ecartes >= 0),
  tronque       boolean NOT NULL DEFAULT false,
  erreur        text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  CHECK ((etat IN ('recu', 'echec', 'expire')) = (termine_le IS NOT NULL)),
  CHECK ((etat IN ('echec', 'expire')) = (erreur IS NOT NULL)),
  CHECK (etat NOT IN ('en_cours', 'recu') OR debute_le IS NOT NULL),
  CHECK ((fenetre_debut IS NULL) = (fenetre_fin IS NULL) AND (fenetre_debut IS NULL OR source = 'nvd')),
  CHECK (fenetre_debut IS NULL OR fenetre_debut < fenetre_fin)
);
CREATE INDEX vulnerabilites_veille_collectes_file ON vulnerabilites_veille_collectes (demande_le) WHERE etat IN ('en_file', 'en_cours');
CREATE INDEX vulnerabilites_veille_collectes_source ON vulnerabilites_veille_collectes (source, demande_le DESC);
