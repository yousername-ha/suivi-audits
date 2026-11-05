-- Référentiels du périmètre : copie modifiable, puis application (ADR 0082, décisions du RSSI du 05/11/2026).
-- La bibliothèque reste figée : ses versions sont immuables et on n'y personnalise plus rien. Attribuer un référentiel à un
-- périmètre en crée une COPIE propre à ce périmètre, que l'utilisateur modifie librement (chaque modification est une
-- version immuable de la copie). La copie est « en préparation » jusqu'à ce que le périmètre décide de l'« appliquer » :
-- elle devient alors un référentiel suivi en conformité (couverture, évaluations, rapprochements, plan d'écarts).
--
-- La copie garde l'identifiant du référentiel de la bibliothèque (clé : périmètre + référentiel) : les références
-- « requirement:<référentiel>:<édition>:<exigence> », les évaluations (immuables), les liens, les rapprochements et les
-- correspondances de l'organisation restent valables sans réécriture. L'édition est celle de la bibliothèque d'où la copie
-- est issue ; modifier la copie ne la change pas.
ALTER TABLE grc_scope_frameworks
  ADD COLUMN status text NOT NULL DEFAULT 'applique' CHECK (status IN ('preparation', 'applique')),
  ADD COLUMN status_by text,
  ADD COLUMN status_at timestamptz,
  -- Version courante de la copie du périmètre ; NULL : ligne de surcharge d'un référentiel hérité (activation locale
  -- seulement), dont le contenu et le statut sont ceux de la copie du périmètre ancêtre.
  ADD COLUMN copy_version integer;

CREATE TABLE grc_framework_copy_versions (
  smsi_id uuid NOT NULL REFERENCES grc_smsis(id),
  framework_id uuid NOT NULL REFERENCES lib_frameworks(id),
  version integer NOT NULL CHECK (version >= 1),
  -- Édition de la bibliothèque dont la copie est issue (celle des références d'exigences).
  source_version integer NOT NULL,
  definition jsonb NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (smsi_id, framework_id, version),
  FOREIGN KEY (framework_id, source_version) REFERENCES lib_framework_versions(framework_id, version)
);
CREATE TRIGGER grc_framework_copy_versions_immutable BEFORE UPDATE OR DELETE ON grc_framework_copy_versions
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER grc_framework_copy_versions_no_truncate BEFORE TRUNCATE ON grc_framework_copy_versions
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- Conversion des rattachements existants (décision du RSSI : convertir en copies, en tenant compte de l'héritage).
-- Un rattachement qui ne fait que reprendre, à la même édition, le référentiel hérité d'un ancêtre (typiquement
-- « Désactiver ici ») reste une surcharge : il suit la copie de l'ancêtre. Tout autre rattachement reçoit sa copie,
-- version 1, identique à l'édition rattachée, nommée « <référentiel> (PRIVE - <périmètre>) ». Les rattachements
-- existants étaient suivis : statut « appliqué ».
WITH RECURSIVE chaine (perimetre, ancetre, profondeur) AS (
  SELECT s.id, s.parent_id, 1 FROM grc_smsis s WHERE s.inherit_frameworks AND s.parent_id IS NOT NULL
  UNION ALL
  SELECT c.perimetre, p.parent_id, c.profondeur + 1
  FROM chaine c JOIN grc_smsis p ON p.id = c.ancetre
  WHERE p.inherit_frameworks AND p.parent_id IS NOT NULL AND c.profondeur < 64
),
herite AS (
  SELECT DISTINCT ON (c.perimetre, f.framework_id) c.perimetre, f.framework_id, f.version
  FROM chaine c JOIN grc_scope_frameworks f ON f.smsi_id = c.ancetre
  ORDER BY c.perimetre, f.framework_id, c.profondeur
)
INSERT INTO grc_framework_copy_versions (smsi_id, framework_id, version, source_version, definition, reason, created_by)
SELECT s.smsi_id, s.framework_id, 1, s.version,
       -- Nom de la copie : « <référentiel> (PRIVE - <périmètre>) », même règle que nomCopiePerimetre (packages/shared).
       jsonb_set(v.definition, '{name}', to_jsonb(
         left(btrim(v.definition->>'name'), 200 - char_length(' (PRIVE - ' || left(btrim(p.name), 100) || ')'))
         || ' (PRIVE - ' || left(btrim(p.name), 100) || ')')),
       'Copie créée à la mise à jour (rattachement existant converti).', 'migration 052'
FROM grc_scope_frameworks s
JOIN grc_smsis p ON p.id = s.smsi_id
JOIN lib_framework_versions v ON v.framework_id = s.framework_id AND v.version = s.version
WHERE NOT EXISTS (
  SELECT 1 FROM herite h WHERE h.perimetre = s.smsi_id AND h.framework_id = s.framework_id AND h.version = s.version
);
UPDATE grc_scope_frameworks s SET copy_version = 1
WHERE EXISTS (
  SELECT 1 FROM grc_framework_copy_versions c WHERE c.smsi_id = s.smsi_id AND c.framework_id = s.framework_id
);

ALTER TABLE grc_scope_frameworks ADD CONSTRAINT grc_scope_frameworks_copie
  FOREIGN KEY (smsi_id, framework_id, copy_version) REFERENCES grc_framework_copy_versions(smsi_id, framework_id, version);
