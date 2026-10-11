-- Gestion des risques (lot U3, ADR 0027) : conditions propres à une décision immuable, par exemple l'échéance
-- d'une acceptation de risque. Colonne additive à valeur par défaut : les décisions existantes restent inchangées.
ALTER TABLE pilotage_decisions ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS pilotage_decisions_operation ON pilotage_decisions(smsi_id,operation,source_ref,created_at DESC);
