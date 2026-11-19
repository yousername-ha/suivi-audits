-- Module Vulnérabilités (ADR 0100, lot F1 ; décision du RSSI du 19/11/2026) : fréquence de synchronisation réglable par
-- source de veille et par instance de connecteur. Migration additive : colonnes nouvelles et contraintes seulement ; aucune
-- donnée reprise ni recopiée (consigne du 14/11/2026).
-- - Fréquence en heures, en liste fermée par source et par type (packages/shared/src/frequences-synchronisation.ts, recopiée
--   ici ; concordance vérifiée par apps/api/test/vulnerabilites-frequences.test.ts). NULL : valeur par défaut du tableau du
--   RSSI, lue dans le code (deux heures pour la veille, sauf EPSS : vingt-quatre ; vingt-quatre pour un connecteur). Le
--   plancher de NVD (deux heures) et la fréquence fixe d'EPSS (vingt-quatre heures) sont garantis ici, pas seulement par
--   l'interface ni par l'API.
-- - `planifiee_le` : référence de la dernière demande AUTOMATIQUE (planificateur), consommée avant l'inscription comme
--   l'ancien créneau quotidien : la suivante n'est due qu'une période plus tard, que la précédente ait réussi, échoué ou
--   expiré. L'ancien créneau (`creneau`, une date) n'est plus lu ; il reste en place (migration additive).
-- - Version d'une source de la veille : concurrence optimiste (If-Match) du réglage de sa fréquence ; celle d'une instance de
--   connecteur reste `integrations.version`.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : inchangée ; les sources de la veille partent avec le travail (leur
-- fréquence revient alors à la valeur par défaut), les instances de connecteur avec la configuration.

ALTER TABLE vulnerabilites_veille_sources
  ADD COLUMN frequence_heures integer,
  ADD COLUMN planifiee_le     timestamptz,
  ADD COLUMN version          integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD CONSTRAINT vulnerabilites_veille_sources_frequence CHECK (
    frequence_heures IS NULL
    OR (source IN ('cisa-kev', 'cert-fr', 'cert-sante') AND frequence_heures IN (1, 2, 4, 12, 24))
    OR (source = 'nvd' AND frequence_heures IN (2, 4, 12, 24))
    OR (source = 'epss' AND frequence_heures = 24)
  );

ALTER TABLE integrations
  ADD COLUMN frequence_heures integer,
  ADD CONSTRAINT integrations_frequence CHECK (
    frequence_heures IS NULL
    OR (type = 'tenable' AND frequence_heures IN (6, 12, 24, 168))
    OR (type = 'algolighthouse' AND frequence_heures IN (12, 24, 168))
  );

ALTER TABLE vulnerabilites_tenable_etat ADD COLUMN planifiee_le timestamptz;
ALTER TABLE vulnerabilites_alh_etat ADD COLUMN planifiee_le timestamptz;
