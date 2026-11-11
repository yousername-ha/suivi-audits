-- Retrait définitif du module « Revues des accès » (décision du RSSI du 11/11/2026, ADR 0087) : les revues d'accès se suivent
-- désormais par une tâche récurrente du Pilotage. Suppression DÉFINITIVE de la table et de ses données : la sauvegarde
-- automatique de la mise à jour précède cette migration, c'est le seul retour arrière. Le module n'avait pas de droit propre
-- (il relevait de « pilotage ») : aucun rôle ni attribution à modifier. Le journal d'audit n'est pas touché.
DROP TABLE IF EXISTS suivi_access_reviews;
DELETE FROM suivi_presence WHERE cle = 'accessReviews';
UPDATE app_state SET data = data - 'accessReviews' WHERE id = 1 AND data ? 'accessReviews';
