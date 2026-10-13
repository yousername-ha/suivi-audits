-- Périmètres de management (ADR 0030, lot M1) : nature libre d'un périmètre (SMSI, SMQ, SMI…). Simple étiquette, sans
-- règle de comportement. Colonne additive à valeur par défaut : les périmètres existants restent inchangés.
ALTER TABLE grc_smsis ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT '' CHECK (char_length(nature) <= 60);
