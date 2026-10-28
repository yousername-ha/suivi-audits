-- Alertes de sécurité dans l'application (ADR 0074) : un évènement de compte (verrouillage) n'est rattaché ni à un SMSI ni à
-- un objet. Les deux colonnes deviennent facultatives POUR CE SEUL TYPE ; tout autre rappel garde ses deux références
-- (contrainte ci-dessous). Migration additive : aucune notification existante n'est modifiée.
ALTER TABLE grc_notifications ALTER COLUMN smsi_id DROP NOT NULL;
ALTER TABLE grc_notifications ALTER COLUMN object_id DROP NOT NULL;
ALTER TABLE grc_notifications
  ADD CONSTRAINT grc_notifications_portee
  CHECK (kind = 'alerte_securite' OR (smsi_id IS NOT NULL AND object_id IS NOT NULL));
-- Une seule alerte par compte destinataire et par évènement (le verrou, ou la synthèse horaire).
CREATE UNIQUE INDEX IF NOT EXISTS grc_notifications_alerte_securite
  ON grc_notifications (user_id, due_key) WHERE kind = 'alerte_securite';
