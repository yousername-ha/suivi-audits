-- Module Vulnérabilités (ADR 0100, lot CPE-1 ; décisions du RSSI du 22/11/2026) : saisie assistée d'un produit surveillé par
-- le dictionnaire CPE 2.3 de la NVD. Migration additive : cinq tables nouvelles, vides ; aucune donnée reprise (consigne du
-- 14/11/2026), aucune table existante modifiée. Rien n'est chargé tant que la source n'est pas activée par qui administre le
-- module ; le flux « veille-vulnerabilites » (ADR 0097) reste seul à ouvrir la sortie vers la NVD.
-- Éditeur, produit et version sont rangés tels que la NVD les écrit, échappements du CPE 2.3 retirés (comme
-- vulnerabilites_veille_cve_produits, migration 076) ; les bornes recopient CPE_BORNES (packages/shared/src/dictionnaire-cpe.ts).
-- Aucune extension : la recherche (sans casse ni accent) porte sur une forme normalisée calculée par l'API (`cle`).

-- Produits distincts du dictionnaire (partie, éditeur, produit), entrées obsolètes exclues ; intitulé anglais de la NVD sans
-- la version, texte simple borné. `cle` : éditeur, produit et intitulé sous la forme comparée par la recherche ;
-- `cle_produit` : le produit seul, sous la même forme (correspondance exacte d'abord).
CREATE TABLE vulnerabilites_cpe_produits (
  partie      text NOT NULL CHECK (partie IN ('a', 'o', 'h')),
  editeur     text NOT NULL CHECK (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:][:space:]<>]'
                AND editeur NOT IN ('*', '-')),
  produit     text NOT NULL CHECK (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:][:space:]<>]'
                AND produit NOT IN ('*', '-')),
  intitule    text CHECK (intitule IS NULL OR (char_length(intitule) BETWEEN 1 AND 300 AND intitule !~ '[[:cntrl:]]')),
  cle         text NOT NULL CHECK (char_length(cle) <= 600 AND cle ~ '^[a-z0-9 ]*$'),
  cle_produit text NOT NULL CHECK (char_length(cle_produit) <= 100 AND cle_produit ~ '^[a-z0-9 ]*$'),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partie, editeur, produit)
);
CREATE INDEX vulnerabilites_cpe_produits_cle_produit ON vulnerabilites_cpe_produits (cle_produit text_pattern_ops);

-- État de la source et curseur du chargement par lots (une seule ligne). `mode` : chargement en cours, complet (tout le
-- dictionnaire, par pages depuis `curseur`) ou nouveautés (entrées modifiées entre `fenetre_debut` et `fenetre_fin`) ;
-- `avec_versions` : le chargement en cours remplit aussi la copie complète. `tranche_id` et `tranche_le` : tranche remise à
-- l'exécutant et pas encore close (une seule à la fois). `a_jour_le` : date jusqu'à laquelle la liste est à jour.
-- `saisie_le` : dernière activité de saisie d'un produit surveillé (fenêtre « saisie en cours », deux minutes), sans
-- personne désignée. `version` : If-Match des réglages.
CREATE TABLE vulnerabilites_cpe_dictionnaire (
  id                smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  activee           boolean NOT NULL DEFAULT false,
  frequence_heures  integer CHECK (frequence_heures IS NULL OR frequence_heures IN (24, 168)),
  planifiee_le      timestamptz,
  mode              text CHECK (mode IS NULL OR mode IN ('complet', 'nouveautes')),
  avec_versions     boolean NOT NULL DEFAULT false,
  curseur           integer NOT NULL DEFAULT 0 CHECK (curseur BETWEEN 0 AND 10000000),
  total             integer CHECK (total IS NULL OR total BETWEEN 0 AND 10000000),
  debut_chargement  timestamptz,
  fenetre_debut     timestamptz,
  fenetre_fin       timestamptz,
  tranche_id        uuid,
  tranche_le        timestamptz,
  complet_le        timestamptz,
  a_jour_le         timestamptz,
  dernier_essai     timestamptz,
  erreur            text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  copie_voulue      boolean NOT NULL DEFAULT false,
  copie_complete_le timestamptz,
  saisie_le         timestamptz,
  version           integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((tranche_id IS NULL) = (tranche_le IS NULL)),
  CHECK (mode IS DISTINCT FROM 'nouveautes' OR (fenetre_debut IS NOT NULL AND fenetre_fin IS NOT NULL AND fenetre_debut < fenetre_fin)),
  CHECK (copie_complete_le IS NULL OR copie_voulue)
);

-- File des demandes de versions d'un produit choisi pendant la saisie : l'API inscrit (une seule demande en file ou en
-- cours par produit), l'exécutant réclame (« suivi cpe-versions-claim ») puis clôt (« suivi cpe-versions-finish »).
-- `demande_par` : sert à la limite par personne ; purgées après sept jours.
CREATE TABLE vulnerabilites_cpe_demandes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partie      text NOT NULL CHECK (partie IN ('a', 'o', 'h')),
  editeur     text NOT NULL CHECK (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:][:space:]<>]'),
  produit     text NOT NULL CHECK (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:][:space:]<>]'),
  etat        text NOT NULL DEFAULT 'en_file' CHECK (etat IN ('en_file', 'en_cours', 'reussie', 'echec', 'expire')),
  demande_par uuid REFERENCES users(id) ON DELETE SET NULL,
  demande_le  timestamptz NOT NULL DEFAULT now(),
  debute_le   timestamptz,
  termine_le  timestamptz,
  erreur      text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  CHECK ((etat IN ('reussie', 'echec', 'expire')) = (termine_le IS NOT NULL)),
  CHECK ((etat IN ('echec', 'expire')) = (erreur IS NOT NULL)),
  CHECK (etat NOT IN ('en_cours', 'reussie') OR debute_le IS NOT NULL)
);
CREATE UNIQUE INDEX vulnerabilites_cpe_demandes_une_par_produit ON vulnerabilites_cpe_demandes (partie, editeur, produit)
  WHERE etat IN ('en_file', 'en_cours');
CREATE INDEX vulnerabilites_cpe_demandes_file ON vulnerabilites_cpe_demandes (demande_le) WHERE etat = 'en_file';
CREATE INDEX vulnerabilites_cpe_demandes_produit ON vulnerabilites_cpe_demandes (partie, editeur, produit, demande_le DESC);

-- Cache durable des versions obtenues de la NVD, par produit : de la plus récente à la plus ancienne, 2 000 au plus,
-- obsolètes exclues ; actualisé au plus une fois par jour, à la demande.
CREATE TABLE vulnerabilites_cpe_versions (
  partie    text NOT NULL CHECK (partie IN ('a', 'o', 'h')),
  editeur   text NOT NULL CHECK (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:][:space:]<>]'),
  produit   text NOT NULL CHECK (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:][:space:]<>]'),
  versions  text[] NOT NULL CHECK (cardinality(versions) <= 2000),
  tronque   boolean NOT NULL DEFAULT false,
  obtenu_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partie, editeur, produit)
);

-- Copie complète facultative (droit d'administrer le module) : une ligne par version distincte d'un produit, entrées
-- obsolètes exclues. Vidée par « Supprimer la copie complète ».
CREATE TABLE vulnerabilites_cpe_copie (
  partie  text NOT NULL CHECK (partie IN ('a', 'o', 'h')),
  editeur text NOT NULL CHECK (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:][:space:]<>]'),
  produit text NOT NULL CHECK (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:][:space:]<>]'),
  version text NOT NULL CHECK (char_length(version) BETWEEN 1 AND 60 AND version !~ '[[:cntrl:][:space:]<>]'
            AND version NOT IN ('*', '-')),
  PRIMARY KEY (partie, editeur, produit, version)
);
