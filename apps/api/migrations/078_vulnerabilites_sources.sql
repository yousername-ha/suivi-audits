-- Module Vulnérabilités (ADR 0100, décisions V23, V24, V26 et V27 ; lot V4c) : mentions structurées des fiches du CERT Santé,
-- produit cité par une publication (rapprochement par le nom d'une CVE absente de NVD), annulation d'une décision de
-- rapprochement. Migration additive : colonnes ajoutées, une contrainte de liste recréée avec une valeur de plus ; aucune
-- donnée reprise (consigne du 14/11/2026). Remise à vide : rien de nouveau (colonnes de tables déjà effacées avec le travail).

-- Publication du CERT Santé : produit cité par le titre (« Produit - CVE-… ») et sa forme normalisée (comme
-- normaliserNom), mentions de la fiche lues par l'exécutant (null : non renseignée), score CVSS v3.1 de la fiche, date de
-- lecture et titre lu (une fiche n'est relue que si le titre change, ou après le délai de relecture). `fiche_exploitee_le`
-- et `fiche_preuve_le` : date du premier signalement par la source (date de publication si la mention figurait dès la
-- première lecture, sinon date de la lecture qui l'a vue), gardée tant que la source ne change pas d'avis. Ces colonnes ne
-- concernent que le CERT Santé.
ALTER TABLE vulnerabilites_veille_avis
  ADD COLUMN produit             text CHECK (produit IS NULL OR char_length(produit) BETWEEN 1 AND 200),
  ADD COLUMN produit_norm        text CHECK (produit_norm IS NULL OR produit_norm ~ '^[a-z0-9_]{0,200}$'),
  ADD COLUMN fiche_lue_le        timestamptz,
  ADD COLUMN fiche_titre         text CHECK (fiche_titre IS NULL OR char_length(fiche_titre) BETWEEN 1 AND 300),
  ADD COLUMN fiche_exploitee     text CHECK (fiche_exploitee IS NULL OR fiche_exploitee IN ('oui', 'non')),
  ADD COLUMN fiche_correctif     text CHECK (fiche_correctif IS NULL OR fiche_correctif IN ('oui', 'non')),
  ADD COLUMN fiche_contournement text CHECK (fiche_contournement IS NULL OR fiche_contournement IN ('oui', 'non')),
  ADD COLUMN fiche_preuve        text CHECK (fiche_preuve IS NULL OR fiche_preuve IN ('disponible', 'indisponible')),
  ADD COLUMN fiche_cvss31        numeric(3,1) CHECK (fiche_cvss31 IS NULL OR fiche_cvss31 BETWEEN 0 AND 10),
  ADD COLUMN fiche_exploitee_le  timestamptz,
  ADD COLUMN fiche_preuve_le     timestamptz,
  ADD CONSTRAINT vulnerabilites_veille_avis_fiche_cert_sante CHECK (
    source = 'cert-sante' OR (produit IS NULL AND fiche_lue_le IS NULL AND fiche_exploitee IS NULL AND fiche_correctif IS NULL
      AND fiche_contournement IS NULL AND fiche_preuve IS NULL AND fiche_cvss31 IS NULL)),
  ADD CONSTRAINT vulnerabilites_veille_avis_fiche_lue CHECK ((fiche_lue_le IS NULL) = (fiche_titre IS NULL));
CREATE INDEX vulnerabilites_veille_avis_produit ON vulnerabilites_veille_avis (produit_norm)
  WHERE source = 'cert-sante' AND produit_norm IS NOT NULL;

-- Rapprochement d'une CVE connue seulement par un avis (V26) : motif « avis_seulement » (publiée par le CERT Santé, NVD
-- n'en donne pas encore les produits touchés), toujours à décider. La contrainte de liste est recréée avec cette valeur.
ALTER TABLE vulnerabilites_rapprochements DROP CONSTRAINT vulnerabilites_rapprochements_motif_check;
ALTER TABLE vulnerabilites_rapprochements ADD CONSTRAINT vulnerabilites_rapprochements_motif_check CHECK (
  motif IS NULL OR motif IN ('nom_seulement', 'sans_plage', 'non_comparable', 'donnees_tronquees', 'avis_seulement'));

-- Annulation d'une confirmation ou d'un rejet (V24) : décision annulée, auteur, date, note (la dernière annulation ; chaque
-- annulation est aussi au journal d'audit, avec la décision annulée et son auteur).
ALTER TABLE vulnerabilites_rapprochements
  ADD COLUMN annulation_decision text CHECK (annulation_decision IS NULL OR annulation_decision IN ('confirmee', 'rejetee')),
  ADD COLUMN annule_par          text,
  ADD COLUMN annule_le           timestamptz,
  ADD COLUMN annulation_note     text NOT NULL DEFAULT '' CHECK (char_length(annulation_note) <= 1000),
  ADD CONSTRAINT vulnerabilites_rapprochements_annulation CHECK (
    (annulation_decision IS NULL) = (annule_par IS NULL) AND (annule_par IS NULL) = (annule_le IS NULL));
