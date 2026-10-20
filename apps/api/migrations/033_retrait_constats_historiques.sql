-- Retrait des constats historiques du périmètre commun (outil de suivi d'origine). Les écarts vivent désormais dans les
-- registres (non-conformités natives) ; le module Audit, le tableau de bord et les exports lisent une projection de ces
-- écarts. Suppression définitive des anciennes lignes, de leurs tâches, des liens qui y renvoient et de la vue associée.
-- Le journal immuable des décisions n'est pas modifié.
DELETE FROM grc_links WHERE source_ref LIKE 'legacy:findings:%' OR target_ref LIKE 'legacy:findings:%';
-- `v_items` lisait l'ancien JSON de l'état (mesures désormais en tables) : elle est retirée avec `v_findings`.
DROP VIEW IF EXISTS v_findings;
DROP VIEW IF EXISTS v_items;
DROP TABLE IF EXISTS suivi_ecarts_taches;
DROP TABLE IF EXISTS suivi_ecarts;
DELETE FROM suivi_presence WHERE cle = 'findings';
DELETE FROM suivi_reglages WHERE cle = 'findingsRev';
UPDATE app_state SET data = data - 'findings' - 'findingsRev' WHERE id = 1 AND (data ? 'findings' OR data ? 'findingsRev');
