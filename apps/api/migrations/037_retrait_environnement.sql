-- Retrait du catalogue « Environnement » (échelles et matrice d'environnement versionnées) et des évaluations des usages de
-- l'IA qui s'y rattachaient (décision du 25/10/2026, ADR 0046). Les échelles, matrices et correspondances se publient
-- désormais uniquement dans la Configuration GRC (`cfg_items`, `cfg_versions`) ; l'analyse d'écart d'un service ou d'un usage
-- de l'IA se fait dans « Applications à intégrer ».
-- Suppression définitive de ces tables, de leurs lignes et de leurs déclencheurs (l'immutabilité vaut tant que la table existe).
-- La sauvegarde automatique de la mise à jour précède cette migration. Aucune autre donnée n'est touchée : les scénarios et
-- usages du registre IA de l'outil de suivi, le journal d'audit et les décisions restent intacts.
DROP TABLE IF EXISTS risk_assessments;
DROP TABLE IF EXISTS environment_configuration;
DROP TABLE IF EXISTS environment_versions;
