-- Module Vulnérabilités (ADR 0100, lot N1 ; décision du RSSI du 19/11/2026) : import d'un scan Nessus (.nessus) déposé dans la
-- carte « Intégrations » (connecteur « nessus-fichier », sans adresse, sans clé, sans flux, sans exécutant). Le fichier est lu
-- dans le navigateur ; l'API reçoit un extrait en JSON, par lots de machines entières, et le range dans les tables de Tenable
-- Security Center (migration 075 : machines, constats, CVE, détections, même numéro de passage dans
-- vulnerabilites_tenable_etat). Migration additive : une contrainte élargie, une table nouvelle ; aucune donnée reprise ni
-- recopiée (consigne du 14/11/2026).
-- - Source d'une machine : le type de son instance. La contrainte de la migration 075 n'admettait que 'tenable' ; elle est
--   recréée pour admettre aussi 'nessus-fichier'. Aucune autre contrainte de source n'est concernée : l'origine d'un produit
--   surveillé (migration 072, 'saisie', 'ekialis', 'tenable') n'est jamais écrite par un import.
-- - Fréquence (migration 090, contrainte integrations_frequence) : inchangée ; pour ce type, seule la valeur NULL passe
--   (aucune synchronisation automatique).
-- - Journal des imports : une ligne par import, rattachée à son exécution (integration_executions, opération « importer »),
--   qui en garde le bilan (nombres et gravités, ni nom de machine, ni adresse, ni nom de fichier) et que la carte montre dans
--   « Exécutions ». Chaque lot est un passage complet pour ses machines : `premier_numero` et `dernier_numero` bornent les
--   numéros de passage attribués à l'import. Les gravités retenues sont celles de la configuration de l'instance au début de
--   l'import, fixées pour tout l'import.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : le journal des imports part avec les instances et leurs exécutions (portée
-- « tout »), comme le journal des synchronisations.

ALTER TABLE vulnerabilites_machines DROP CONSTRAINT vulnerabilites_machines_source_check;
ALTER TABLE vulnerabilites_machines ADD CONSTRAINT vulnerabilites_machines_source_check
  CHECK (source IN ('tenable', 'nessus-fichier'));

CREATE TABLE vulnerabilites_imports (
  execution_id       uuid PRIMARY KEY REFERENCES integration_executions(id) ON DELETE CASCADE,
  integration_id     uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  gravites           text[] NOT NULL CHECK (cardinality(gravites) BETWEEN 1 AND 4
                       AND gravites <@ ARRAY['critique', 'elevee', 'moyenne', 'faible']::text[]),
  machines_annoncees integer NOT NULL CHECK (machines_annoncees BETWEEN 1 AND 10000),
  detections_annoncees integer NOT NULL CHECK (detections_annoncees >= 0),
  ecartes            jsonb NOT NULL CHECK (jsonb_typeof(ecartes) = 'object' AND octet_length(ecartes::text) <= 2048),
  lots               integer NOT NULL DEFAULT 0 CHECK (lots BETWEEN 0 AND 1000),
  machines           integer NOT NULL DEFAULT 0 CHECK (machines BETWEEN 0 AND 10000),
  detections         integer NOT NULL DEFAULT 0 CHECK (detections >= 0),
  disparues          integer NOT NULL DEFAULT 0 CHECK (disparues >= 0),
  premier_numero     integer CHECK (premier_numero IS NULL OR premier_numero > 0),
  dernier_numero     integer CHECK (dernier_numero IS NULL OR dernier_numero >= premier_numero),
  maj_le             timestamptz NOT NULL DEFAULT now(),
  CHECK ((lots = 0) = (premier_numero IS NULL)),
  CHECK ((premier_numero IS NULL) = (dernier_numero IS NULL))
);
CREATE INDEX vulnerabilites_imports_instance ON vulnerabilites_imports (integration_id, maj_le DESC);
