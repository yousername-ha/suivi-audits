-- Contributions au RETEX d'un incident : l'invitation ou la relance d'un contributeur est une notification métier
-- (type `retex_contribution`) rattachée à un incident de l'état historique, ni à un SMSI ni à un objet du socle. Comme pour
-- les alertes de sécurité (046), les deux références restent facultatives POUR CES SEULS TYPES ; tout autre rappel garde ses
-- deux références. Migration additive : aucune notification existante n'est modifiée.
ALTER TABLE grc_notifications DROP CONSTRAINT IF EXISTS grc_notifications_portee;
ALTER TABLE grc_notifications
  ADD CONSTRAINT grc_notifications_portee
  CHECK (kind IN ('alerte_securite', 'retex_contribution') OR (smsi_id IS NOT NULL AND object_id IS NOT NULL));
-- Une seule notification par destinataire et par envoi (clé « incident:numéro d'envoi »).
CREATE UNIQUE INDEX IF NOT EXISTS grc_notifications_retex_contribution
  ON grc_notifications (user_id, due_key) WHERE kind = 'retex_contribution';
