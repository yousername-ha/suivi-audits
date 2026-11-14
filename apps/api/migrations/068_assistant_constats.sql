-- Assistant RSSI intégré (ADR 0086, points 8 et 14) : le profil « Audit interne » propose des constats (observation,
-- non-conformité, opportunité d'amélioration), jamais d'action corrective. Garde-fou d'indépendance : une proposition qui
-- porte sur un élément créé à partir d'une proposition de l'assistant le signale. Migration additive et rejouable.
ALTER TABLE assistant_propositions DROP CONSTRAINT IF EXISTS assistant_propositions_type_check;
ALTER TABLE assistant_propositions ADD CONSTRAINT assistant_propositions_type_check CHECK (type IN ('action', 'constat'));
ALTER TABLE assistant_propositions ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT ''
  CHECK (nature IN ('', 'observation', 'nonconformity', 'opportunity'));
ALTER TABLE assistant_propositions ADD COLUMN IF NOT EXISTS source_issue_assistant boolean NOT NULL DEFAULT false;
