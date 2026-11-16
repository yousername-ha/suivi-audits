-- Module Vulnérabilités (ADR 0100, lot V4a) : rapprochement par version (V21), produits reliés à la main aux machines (V20).
-- Migration additive : une contrainte et une colonne ajoutées, trois tables nouvelles ; aucune donnée reprise (consigne du
-- 14/11/2026). Remise à vide (apps/api/src/remise-a-vide.ts) : les trois tables avec le travail.

-- Version obligatoire d'un produit surveillé (V21). NOT VALID : la contrainte s'applique à toute ligne écrite désormais, sans
-- relire les fiches déjà enregistrées (aucune reprise de données) ; l'API refuse une fiche sans version.
ALTER TABLE vulnerabilites_produits
  ADD CONSTRAINT vulnerabilites_produits_version_obligatoire CHECK (char_length(btrim(version_produit)) >= 1) NOT VALID;

-- Produits touchés par une CVE, tirés du champ `configurations` de NVD : éditeur et produit du CPE (et leur forme normalisée
-- pour le rapprochement par nom), version exacte du CPE si elle existe, bornes de la plage, drapeau « vulnérable ». Vingt
-- au plus par CVE (les vulnérables d'abord) ; au-delà, `produits_tronques` est vrai et aucun rapprochement n'est écarté
-- sur ces données. Remplacés en bloc à chaque collecte NVD de la CVE.
ALTER TABLE vulnerabilites_veille_cve ADD COLUMN produits_tronques boolean NOT NULL DEFAULT false;

CREATE TABLE vulnerabilites_veille_cve_produits (
  cve          text NOT NULL REFERENCES vulnerabilites_veille_cve(cve) ON DELETE CASCADE,
  rang         smallint NOT NULL CHECK (rang BETWEEN 0 AND 19),
  partie       text NOT NULL CHECK (partie IN ('a', 'o', 'h')),
  editeur      text NOT NULL CHECK (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:][:space:]<>]'),
  produit      text NOT NULL CHECK (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:][:space:]<>]'),
  editeur_norm text NOT NULL CHECK (editeur_norm ~ '^[a-z0-9_]{0,100}$'),
  produit_norm text NOT NULL CHECK (produit_norm ~ '^[a-z0-9_]{0,100}$'),
  version      text CHECK (version IS NULL OR (char_length(version) BETWEEN 1 AND 60 AND version !~ '[[:cntrl:][:space:]<>]')),
  debut_inclus text CHECK (debut_inclus IS NULL OR (char_length(debut_inclus) BETWEEN 1 AND 60 AND debut_inclus !~ '[[:cntrl:][:space:]<>]')),
  debut_exclus text CHECK (debut_exclus IS NULL OR (char_length(debut_exclus) BETWEEN 1 AND 60 AND debut_exclus !~ '[[:cntrl:][:space:]<>]')),
  fin_inclus   text CHECK (fin_inclus IS NULL OR (char_length(fin_inclus) BETWEEN 1 AND 60 AND fin_inclus !~ '[[:cntrl:][:space:]<>]')),
  fin_exclus   text CHECK (fin_exclus IS NULL OR (char_length(fin_exclus) BETWEEN 1 AND 60 AND fin_exclus !~ '[[:cntrl:][:space:]<>]')),
  vulnerable   boolean NOT NULL,
  CHECK (debut_inclus IS NULL OR debut_exclus IS NULL),
  CHECK (fin_inclus IS NULL OR fin_exclus IS NULL),
  PRIMARY KEY (cve, rang)
);
CREATE INDEX vulnerabilites_veille_cve_produits_cpe ON vulnerabilites_veille_cve_produits (lower(editeur), lower(produit));
CREATE INDEX vulnerabilites_veille_cve_produits_nom ON vulnerabilites_veille_cve_produits (editeur_norm, produit_norm);

-- Produit surveillé relié à la main à une machine de l'inventaire (V20) : la personne voit la machine par son périmètre.
-- Une CVE rattachée au produit apparaît sur la machine avec la mention « déclaré ».
CREATE TABLE vulnerabilites_produits_machines (
  produit_id uuid NOT NULL REFERENCES vulnerabilites_produits(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES vulnerabilites_machines(id) ON DELETE CASCADE,
  relie_par  text NOT NULL,
  relie_le   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (produit_id, machine_id)
);
CREATE INDEX vulnerabilites_produits_machines_machine ON vulnerabilites_produits_machines (machine_id);

-- Rapprochement entre un produit surveillé et une CVE de la veille (ADR 0100, point 8), recalculé après chaque collecte NVD
-- et à chaque modification du produit. Modèle « proposition puis décision » (comme grc_rapprochements, migration 019) :
-- rattachée d'office, écartée, proposée (à décider), confirmée ou rejetée par une personne (auteur, date, note), retirée
-- (la correspondance n'existe plus). Empreintes du produit (version, identifiant, noms) et des données de la CVE : un rejet
-- n'est pas reproposé tant qu'elles n'ont pas changé ; une confirmation tient tant que la version décidée reste celle du
-- produit. `version` : If-Match des décisions.
CREATE TABLE vulnerabilites_rapprochements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id         uuid NOT NULL REFERENCES vulnerabilites_produits(id) ON DELETE CASCADE,
  cve                text NOT NULL REFERENCES vulnerabilites_veille_cve(cve) ON DELETE CASCADE,
  statut             text NOT NULL CHECK (statut IN ('rattachee', 'ecartee', 'proposee', 'confirmee', 'rejetee', 'retiree')),
  motif              text CHECK (motif IS NULL OR motif IN ('nom_seulement', 'sans_plage', 'non_comparable', 'donnees_tronquees')),
  version_dans_plage text CHECK (version_dans_plage IS NULL OR version_dans_plage IN ('oui', 'non', 'inconnu')),
  par_identifiant    boolean NOT NULL,
  empreinte_produit  text NOT NULL CHECK (empreinte_produit ~ '^[0-9a-f]{64}$'),
  empreinte_cve      text NOT NULL CHECK (empreinte_cve ~ '^[0-9a-f]{64}$'),
  version_decidee    text CHECK (version_decidee IS NULL OR char_length(version_decidee) <= 100),
  decide_par         text,
  decide_le          timestamptz,
  note               text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  version            integer NOT NULL DEFAULT 1 CHECK (version > 0),
  calcule_le         timestamptz NOT NULL DEFAULT now(),
  cree_le            timestamptz NOT NULL DEFAULT now(),
  CHECK (statut <> 'proposee' OR motif IS NOT NULL),
  CHECK ((statut IN ('confirmee', 'rejetee')) = (decide_par IS NOT NULL)),
  CHECK ((decide_par IS NULL) = (decide_le IS NULL) AND (decide_par IS NULL) = (version_decidee IS NULL)),
  UNIQUE (produit_id, cve)
);
CREATE INDEX vulnerabilites_rapprochements_statut ON vulnerabilites_rapprochements (produit_id, statut);
CREATE INDEX vulnerabilites_rapprochements_cve ON vulnerabilites_rapprochements (cve) WHERE statut IN ('rattachee', 'confirmee');
