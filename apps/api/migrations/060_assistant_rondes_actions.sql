-- Assistant RSSI intégré (ADR 0086) : ce qu'une ronde a réellement émis (rappels envoyés ou refusés, notes, fiches) est
-- constaté par la plateforme et gardé avec la ronde, pour ne pas dépendre de ce qu'en dit le modèle dans son rapport.
-- Migration additive et rejouable.
ALTER TABLE assistant_rondes ADD COLUMN IF NOT EXISTS actions jsonb NOT NULL DEFAULT '[]';
