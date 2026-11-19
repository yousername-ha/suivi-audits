-- Conservation des sauvegardes (ADR 0106, décisions du RSSI du 19/11/2026) : deux réglages de la politique de sauvegarde, à
-- côté de la durée de conservation (retention_days), lus par l'exécutant d'exploitation comme elle (« suivi ops-policy »).
-- - `max_backups` : nombre maximal de sauvegardes régulières gardées dans le dossier de destination (de 7 à 365, 30 par
--   défaut), en plus de la durée ; les BACKUP_GARDER_MIN plus récentes restent toujours gardées (scripts/backup.sh).
-- - `pre_update_backups` : nombre de sauvegardes d'avant mise à jour gardées (de 1 à 10, 3 par défaut ;
--   scripts/mettre-a-jour.sh).
-- Migration additive : deux colonnes avec valeur par défaut et bornes ; la ligne unique existante reçoit les valeurs par
-- défaut. Rangées dans backup_policy, comme la durée, et non dans `settings` : la remise à vide « tout » efface `settings`
-- mais garde backup_policy (apps/api/src/remise-a-vide.ts), et un retour aux valeurs par défaut pourrait supprimer des archives.
ALTER TABLE backup_policy
  ADD COLUMN IF NOT EXISTS max_backups integer NOT NULL DEFAULT 30 CHECK (max_backups BETWEEN 7 AND 365),
  ADD COLUMN IF NOT EXISTS pre_update_backups integer NOT NULL DEFAULT 3 CHECK (pre_update_backups BETWEEN 1 AND 10);
