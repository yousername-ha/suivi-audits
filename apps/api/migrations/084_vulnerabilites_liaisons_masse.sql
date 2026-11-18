-- Module Vulnérabilités (ADR 0100, lot ALH5 ; décision C du RSSI du 17/11/2026) : liaison en masse des actifs exposés aux
-- machines internes, par motif à joker « * » et sur un aperçu validé par une personne. Les liaisons créées sont des liaisons
-- confirmées de la table de la migration 083, d'origine nouvelle « masse » (manuelle en masse).
-- Migration additive : la liste des origines admises s'élargit d'une valeur ; aucune donnée n'est modifiée ni reprise
-- (consigne du 14/11/2026). Une proposition reste d'origine « proposition » (contrainte de la migration 083 inchangée).
ALTER TABLE vulnerabilites_alh_liaisons_machines
  DROP CONSTRAINT vulnerabilites_alh_liaisons_machines_origine_check;
ALTER TABLE vulnerabilites_alh_liaisons_machines
  ADD CONSTRAINT vulnerabilites_alh_liaisons_machines_origine_check
  CHECK (origine IN ('proposition', 'manuelle', 'masse'));
