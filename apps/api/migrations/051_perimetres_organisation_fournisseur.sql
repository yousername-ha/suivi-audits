-- Type d'un périmètre : une organisation ou un fournisseur, rien d'autre (décision du RSSI du 01/11/2026, amendement de
-- l'ADR 0039). Les anciennes étiquettes de structure « entité » et « périmètre » deviennent « organisation ». Le rattachement
-- parent/enfant est inchangé : une organisation A peut avoir pour enfants les organisations B et C et le fournisseur F.
-- Aucune ligne supprimée ; seule l'étiquette change. Une version antérieure de l'application lit « organisation », valeur
-- qu'elle connaît, mais pas « fournisseur » : le retour arrière passe par la restauration de la sauvegarde d'avant mise à jour.
ALTER TABLE grc_smsis DROP CONSTRAINT IF EXISTS grc_smsis_entity_kind_check;
UPDATE grc_smsis SET entity_kind = 'organisation' WHERE entity_kind IN ('entite', 'perimetre');
ALTER TABLE grc_smsis ALTER COLUMN entity_kind SET DEFAULT 'organisation';
ALTER TABLE grc_smsis ADD CONSTRAINT grc_smsis_entity_kind_check CHECK (entity_kind IN ('organisation', 'fournisseur'));
