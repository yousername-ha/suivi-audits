-- Module Vulnérabilités (ADR 0100, lot V1) : module de droits « vulnerabilites » et registre des produits surveillés.
-- Migration additive : aucune table existante n'est modifiée hors de la contrainte des modules, recréée pour admettre le
-- nouveau module (comme 055_assistant.sql). Sans reprise de données (consigne du 14/11/2026) : le registre démarre vide.

-- Nouveau module de droits : il peut être désactivé comme les autres modules non protégés (ADR 0019). Les rôles prédéfinis
-- sont définis dans le code (packages/shared/src/permissions.ts) ; les rôles personnalisés ne reçoivent pas ce droit d'office.
ALTER TABLE module_activation DROP CONSTRAINT IF EXISTS module_activation_disabled_connus;
ALTER TABLE module_activation ADD CONSTRAINT module_activation_disabled_connus
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','incidents','cartographie','vulnerabilites','documents','import_export','tableau_de_bord','assistant']::text[]);

-- Produits surveillés : registre de l'organisation, sans périmètre, comme les fournisseurs (ADR 0032). Le fournisseur est un
-- identifiant du registre historique des fournisseurs, sans clé étrangère (ce registre vit dans l'état historique, comme
-- grc_smsis.supplier_id, migration 051) ; l'éditeur est toujours saisi en texte. Le responsable suit le modèle des registres
-- (migration 032) : une personne, un groupe ou une fonction, en jsonb { type, id }.
CREATE TABLE vulnerabilites_produits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fournisseur_id  text CHECK (fournisseur_id IS NULL OR char_length(fournisseur_id) BETWEEN 1 AND 200),
  editeur         text NOT NULL CHECK (char_length(btrim(editeur)) BETWEEN 1 AND 200),
  nom             text NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 1 AND 200),
  version_produit text NOT NULL DEFAULT '' CHECK (char_length(version_produit) <= 100),
  cpe             text CHECK (cpe IS NULL OR (char_length(cpe) <= 500 AND cpe ~ '^cpe:2\.3:[aho*-]:')),
  famille         text NOT NULL CHECK (famille IN ('systemes', 'reseau', 'messagerie', 'applications_metier', 'postes_de_travail', 'web')),
  criticite       text NOT NULL CHECK (criticite IN ('faible', 'moyenne', 'elevee')),
  responsable     jsonb CHECK (responsable IS NULL OR (jsonb_typeof(responsable) = 'object'
                    AND responsable->>'type' IN ('utilisateur', 'groupe', 'fonction') AND responsable ? 'id')),
  origine         text NOT NULL DEFAULT 'saisie' CHECK (origine IN ('saisie', 'ekialis', 'tenable')),
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- Doublon refusé : même éditeur, même produit, même version, sans tenir compte de la casse.
CREATE UNIQUE INDEX vulnerabilites_produits_doublon
  ON vulnerabilites_produits (lower(editeur), lower(nom), lower(version_produit));
CREATE INDEX vulnerabilites_produits_famille ON vulnerabilites_produits (famille);
