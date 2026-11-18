-- Module Intégrations (ADR 0076, sous-ensemble des lots I1 et I4) : module de droits « integrations », instances de
-- connecteur et file des exécutions. Migration additive : aucune table existante n'est modifiée hors de la contrainte des
-- modules, recréée pour admettre le nouveau module (comme 055 et 072). Sans reprise de données (consigne du 14/11/2026).
-- Les tables de propositions, de correspondances et de liaisons d'indicateurs viendront avec leurs lots.

-- Nouveau module de droits, désactivable (ADR 0019). Les rôles prédéfinis sont définis dans le code
-- (packages/shared/src/permissions.ts) ; les rôles personnalisés ne reçoivent pas ce droit d'office.
ALTER TABLE module_activation DROP CONSTRAINT IF EXISTS module_activation_disabled_connus;
ALTER TABLE module_activation ADD CONSTRAINT module_activation_disabled_connus
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','incidents','cartographie','vulnerabilites','documents','import_export','tableau_de_bord','assistant','integrations']::text[]);

-- Instances de connecteur. Le type vient du catalogue en code (packages/shared/src/integrations.ts) : la base n'en fige pas la
-- liste. Le périmètre (smsi_id) est facultatif et contrôlé par l'API selon la portée du type (« organisation » : aucun ;
-- « smsi » : obligatoire) ; sans clé étrangère, pour que la remise à vide du travail (grc_smsis) ne bute pas sur cette table
-- de configuration. La configuration est non secrète, validée par le schéma du type ; les secrets sont scellés à part
-- (settings, clé « secret:integration:<id> »), jamais ici.
CREATE TABLE integrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type ~ '^[a-z][a-z0-9-]{1,39}$'),
  nom           text NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 1 AND 120),
  smsi_id       uuid,
  configuration jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(configuration) = 'object' AND octet_length(configuration::text) <= 32768),
  actif         boolean NOT NULL DEFAULT false,
  version       integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Deux instances ne portent pas le même nom (à la casse près).
CREATE UNIQUE INDEX integrations_nom ON integrations (lower(btrim(nom)));

-- File et journal des exécutions : l'API inscrit, l'exécutant d'exploitation réclame (« suivi integrations-claim ») puis
-- rapporte (« suivi integrations-finish »). Résultat borné ; erreur nettoyée, sur une ligne, sans secret ni contenu de
-- réponse. L'opération vient du catalogue (« tester » dans ce lot).
CREATE TABLE integration_executions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  operation      text NOT NULL CHECK (operation ~ '^[a-z][a-z0-9_-]{1,39}$'),
  origine        text NOT NULL DEFAULT 'manuel' CHECK (origine IN ('manuel', 'planifie')),
  etat           text NOT NULL DEFAULT 'en_file' CHECK (etat IN ('en_file', 'en_cours', 'recu', 'echec', 'expire')),
  demande_par    text NOT NULL,
  demande_le     timestamptz NOT NULL DEFAULT now(),
  debute_le      timestamptz,
  termine_le     timestamptz,
  resultat       jsonb CHECK (resultat IS NULL OR (jsonb_typeof(resultat) = 'object' AND octet_length(resultat::text) <= 4096)),
  erreur         text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  -- Une exécution terminée a une date de fin ; un résultat n'accompagne que l'état « recu », une erreur seulement un échec
  -- ou une expiration.
  CHECK ((etat IN ('recu', 'echec', 'expire')) = (termine_le IS NOT NULL)),
  CHECK ((etat = 'recu') = (resultat IS NOT NULL)),
  CHECK ((etat IN ('echec', 'expire')) = (erreur IS NOT NULL)),
  -- Un échec peut être prononcé avant la prise en charge (flux fermé, connecteur désactivé) : pas de date de début.
  CHECK (etat NOT IN ('en_cours', 'recu') OR debute_le IS NOT NULL)
);
CREATE INDEX integration_executions_file ON integration_executions (demande_le) WHERE etat IN ('en_file', 'en_cours');
CREATE INDEX integration_executions_instance ON integration_executions (integration_id, demande_le DESC);
