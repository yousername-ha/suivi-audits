-- Hiérarchie des périmètres (organisation → entité → périmètre) et héritage explicite des référentiels (lot H1).
-- Migration additive : colonnes à valeur par défaut, les périmètres existants restent à plat et n'héritent de rien.
ALTER TABLE grc_smsis ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES grc_smsis(id) ON DELETE RESTRICT;
ALTER TABLE grc_smsis ADD COLUMN IF NOT EXISTS entity_kind text NOT NULL DEFAULT 'perimetre'
  CHECK (entity_kind IN ('organisation','entite','perimetre'));
ALTER TABLE grc_smsis ADD COLUMN IF NOT EXISTS inherit_frameworks boolean NOT NULL DEFAULT false;
ALTER TABLE grc_smsis ADD CONSTRAINT grc_smsis_pas_son_parent CHECK (parent_id IS NULL OR parent_id <> id);
CREATE INDEX IF NOT EXISTS grc_smsis_parent ON grc_smsis(parent_id) WHERE parent_id IS NOT NULL;

-- Garde-fou de dernier recours (l'API contrôle aussi, avec un message lisible) : aucune boucle dans la hiérarchie.
CREATE OR REPLACE FUNCTION grc_smsis_sans_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    WITH RECURSIVE amont(id, profondeur) AS (
      SELECT s.parent_id, 1 FROM grc_smsis s WHERE s.id = NEW.parent_id
      UNION ALL
      SELECT s.parent_id, a.profondeur + 1 FROM grc_smsis s JOIN amont a ON s.id = a.id WHERE a.profondeur < 64
    )
    SELECT 1 FROM amont WHERE id = NEW.id
  ) OR NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Hiérarchie des périmètres : boucle interdite' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS grc_smsis_sans_cycle ON grc_smsis;
CREATE TRIGGER grc_smsis_sans_cycle BEFORE INSERT OR UPDATE OF parent_id ON grc_smsis
  FOR EACH ROW EXECUTE FUNCTION grc_smsis_sans_cycle();
