-- Retrait définitif des correspondances entre référentiels et des rapprochements qui en découlent (décision du RSSI du
-- 12/11/2026, ADR 0089, lot 3). Suppression DÉFINITIVE des tables et de leurs données : la sauvegarde automatique de la mise à
-- jour précède cette migration, c'est le seul retour arrière. Les référentiels, les liens « met en œuvre » faits à la main entre
-- une mesure et une exigence et le kit IA ne sont pas touchés. Le journal d'audit non plus.
-- Ordre imposé par les clés étrangères : les rapprochements et l'historique référencent les correspondances. L'historique des
-- correspondances est protégé par des déclencheurs d'immutabilité : il disparaît avec sa table entière (DROP TABLE), sans
-- jamais contourner ces déclencheurs.
DROP TABLE IF EXISTS grc_rapprochements;
DROP TABLE IF EXISTS lib_mapping_history;
DROP TABLE IF EXISTS lib_mappings;

-- Notifications « Rapprochements à valider » : le type n'est plus émis. Les rappels déjà reçus (et leurs demandes de courriel,
-- supprimées en cascade) et les réglages de notification de ce type (groupes, rôles, comptes) deviennent sans objet.
DELETE FROM grc_notifications WHERE kind = 'rapprochement';
DELETE FROM notification_reglages WHERE type = 'rapprochement';

-- Les fiches de type « mapping » (correspondances importées avec un référentiel) vivent dans l'historique immuable des objets
-- (grc_objects et ses versions) : elles ne sont pas supprimées. Le code ne les lit plus (le type n'existe plus), elles restent
-- inertes. Le module « conformite » et ses droits sont inchangés : aucun rôle ni attribution à modifier.
