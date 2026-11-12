-- Assistant RSSI intégré (ADR 0086, point 9) : synthèse hebdomadaire et ronde déclenchée par un événement (action qui vient
-- de dépasser son échéance, écart créé). Migration additive et rejouable. Les deux sont inactifs par défaut.
ALTER TABLE assistant_reglages ADD COLUMN IF NOT EXISTS jour_synthese smallint NOT NULL DEFAULT 0 CHECK (jour_synthese BETWEEN 0 AND 7);
ALTER TABLE assistant_reglages ADD COLUMN IF NOT EXISTS rondes_sur_evenement boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_rondes DROP CONSTRAINT IF EXISTS assistant_rondes_declencheur_check;
ALTER TABLE assistant_rondes ADD CONSTRAINT assistant_rondes_declencheur_check
  CHECK (declencheur IN ('planifiee', 'manuelle', 'synthese', 'evenement'));
