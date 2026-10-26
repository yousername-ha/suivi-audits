-- Retrait de la page « Conformité IA » de l'outil de suivi et de ses données (décision du 26/10/2026, ADR 0057) : registre des
-- usages de l'IA, scénarios évalués, plan d'action et politiques. Le suivi des contrôles IA passe désormais par le référentiel
-- « Contrôles IA internes » du kit d'intégration IA (ADR 0055) et par l'assistant « Analyser un service » (ADR 0056).
-- Suppression DÉFINITIVE des lignes (la sauvegarde automatique de la mise à jour précède cette migration). Les tables restent,
-- vides, parce que la forme de l'état historique (import et export au format v2) les décrit encore ; les champs
-- complémentaires de la clé `ai` (contexte, date de début) sont vidés. Le journal d'audit et les décisions immuables ne sont
-- pas touchés.
TRUNCATE suivi_ia_usages, suivi_ia_evaluations, suivi_ia_etapes, suivi_ia_politiques;
UPDATE suivi_presence SET reste = '{}'::jsonb WHERE cle = 'ai';

-- Le module de droits « ia » disparaît avec sa page : ses permissions sont retirées des rôles personnalisés, ses restrictions des
-- attributions directes et son activation du réglage des modules (les contraintes de liste sont recréées sans lui).
UPDATE roles SET permissions = ARRAY(SELECT p FROM unnest(permissions) AS p WHERE p NOT LIKE 'ia:%'), version = version + 1
  WHERE EXISTS (SELECT 1 FROM unnest(permissions) AS p WHERE p LIKE 'ia:%');
UPDATE user_roles SET modules = array_remove(modules, 'ia') WHERE 'ia' = ANY(modules);
UPDATE module_activation SET disabled = array_remove(disabled, 'ia') WHERE 'ia' = ANY(disabled);
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'module_activation'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%''ia''%'
  LOOP EXECUTE format('ALTER TABLE module_activation DROP CONSTRAINT %I', c.conname); END LOOP;
END $$;
ALTER TABLE module_activation DROP CONSTRAINT IF EXISTS module_activation_disabled_connus;
ALTER TABLE module_activation ADD CONSTRAINT module_activation_disabled_connus
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','crrc','investissements','incidents','cartographie','documents','import_export']::text[]);
