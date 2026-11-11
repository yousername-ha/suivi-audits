-- Retrait définitif des modules CRRC et Investissements (« Plan d'investissement », rubrique Budget), ancien et nouveau code
-- (décision du RSSI du 11/11/2026, ADR 0084). Suppression DÉFINITIVE des tables et de leurs données : la sauvegarde automatique
-- de la mise à jour précède cette migration, c'est le seul retour arrière. Le journal d'audit et les décisions immuables ne sont
-- pas touchés.
DROP TABLE IF EXISTS suivi_crrc_alertes;
DROP TABLE IF EXISTS suivi_crrc_restaurations;
DROP TABLE IF EXISTS suivi_crrc_sauvegardes;
DROP TABLE IF EXISTS suivi_crrc_ressources;
DROP TABLE IF EXISTS suivi_crrc_offres;
DROP TABLE IF EXISTS suivi_crrc_etablissements;
DROP TABLE IF EXISTS invest_lines;
DROP TABLE IF EXISTS invest_settings;
DELETE FROM suivi_presence WHERE cle IN ('crrc', 'invest');
UPDATE app_state SET data = data - 'crrc' - 'invest' WHERE id = 1 AND (data ? 'crrc' OR data ? 'invest');
DELETE FROM grc_links
  WHERE source_ref LIKE 'legacy:crrc:%' OR target_ref LIKE 'legacy:crrc:%'
     OR source_ref LIKE 'legacy:invest:%' OR target_ref LIKE 'legacy:invest:%';

-- Les modules de droits « crrc » et « investissements » disparaissent avec leurs pages : leurs permissions sont retirées des
-- rôles personnalisés, leurs restrictions des attributions directes et des écrans muraux, et leur activation du réglage des
-- modules (la contrainte de liste est recréée sans eux).
UPDATE roles SET permissions = ARRAY(SELECT p FROM unnest(permissions) AS p WHERE p NOT LIKE 'crrc:%' AND p NOT LIKE 'investissements:%'), version = version + 1
  WHERE EXISTS (SELECT 1 FROM unnest(permissions) AS p WHERE p LIKE 'crrc:%' OR p LIKE 'investissements:%');
UPDATE user_roles SET modules = ARRAY(SELECT m FROM unnest(modules) AS m WHERE m NOT IN ('crrc', 'investissements'))
  WHERE modules && ARRAY['crrc', 'investissements']::text[];
UPDATE wall_screens SET modules = ARRAY(SELECT m FROM unnest(modules) AS m WHERE m NOT IN ('crrc', 'investissements'))
  WHERE modules && ARRAY['crrc', 'investissements']::text[];
UPDATE module_activation SET disabled = ARRAY(SELECT m FROM unnest(disabled) AS m WHERE m NOT IN ('crrc', 'investissements'))
  WHERE disabled && ARRAY['crrc', 'investissements']::text[];
ALTER TABLE module_activation DROP CONSTRAINT IF EXISTS module_activation_disabled_connus;
ALTER TABLE module_activation ADD CONSTRAINT module_activation_disabled_connus
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','incidents','cartographie','documents','import_export','tableau_de_bord']::text[]);
