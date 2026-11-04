-- Type d'un périmètre : une organisation ou un fournisseur, rien d'autre (décision du RSSI du 01/11/2026, amendement de
-- l'ADR 0039). Les anciennes étiquettes de structure « entité » et « périmètre » deviennent « organisation ». Le rattachement
-- parent/enfant reste le même : une organisation A peut avoir pour enfants les organisations B et C et le fournisseur F ;
-- seule règle ajoutée, un fournisseur n'a pour enfants que des fournisseurs (ses sous-traitants).
-- Aucune ligne supprimée ; seule l'étiquette change. Une version antérieure de l'application lit « organisation », valeur
-- qu'elle connaît, mais pas « fournisseur » : le retour arrière passe par la restauration de la sauvegarde d'avant mise à jour.
ALTER TABLE grc_smsis DROP CONSTRAINT IF EXISTS grc_smsis_entity_kind_check;
UPDATE grc_smsis SET entity_kind = 'organisation' WHERE entity_kind IN ('entite', 'perimetre');
ALTER TABLE grc_smsis ALTER COLUMN entity_kind SET DEFAULT 'organisation';
ALTER TABLE grc_smsis ADD CONSTRAINT grc_smsis_entity_kind_check CHECK (entity_kind IN ('organisation', 'fournisseur'));

-- Périmètre fournisseur relié à sa fiche du registre des fournisseurs (identifiant historique, comme sup_scope_links) :
-- facultatif, réservé au type fournisseur, une fiche reliée à un seul périmètre.
ALTER TABLE grc_smsis ADD COLUMN IF NOT EXISTS supplier_id text
  CHECK (supplier_id IS NULL OR char_length(supplier_id) BETWEEN 1 AND 200);
ALTER TABLE grc_smsis ADD CONSTRAINT grc_smsis_fiche_fournisseur CHECK (supplier_id IS NULL OR entity_kind = 'fournisseur');
CREATE UNIQUE INDEX IF NOT EXISTS grc_smsis_supplier ON grc_smsis(supplier_id) WHERE supplier_id IS NOT NULL;

-- Sous un fournisseur, seulement des fournisseurs (ses sous-traitants) : jamais une organisation. Garde-fou de dernier
-- recours ; l'API contrôle aussi, avec un message lisible.
CREATE OR REPLACE FUNCTION grc_smsis_types_rattachement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_kind = 'organisation' AND NEW.parent_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM grc_smsis p WHERE p.id = NEW.parent_id AND p.entity_kind = 'fournisseur') THEN
    RAISE EXCEPTION 'Hiérarchie des périmètres : une organisation ne se rattache pas à un fournisseur' USING ERRCODE = '23514';
  END IF;
  IF NEW.entity_kind = 'fournisseur'
     AND EXISTS (SELECT 1 FROM grc_smsis e WHERE e.parent_id = NEW.id AND e.entity_kind = 'organisation') THEN
    RAISE EXCEPTION 'Hiérarchie des périmètres : un fournisseur n''a pas d''organisation enfant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS grc_smsis_types_rattachement ON grc_smsis;
CREATE TRIGGER grc_smsis_types_rattachement BEFORE INSERT OR UPDATE OF parent_id, entity_kind ON grc_smsis
  FOR EACH ROW EXECUTE FUNCTION grc_smsis_types_rattachement();
