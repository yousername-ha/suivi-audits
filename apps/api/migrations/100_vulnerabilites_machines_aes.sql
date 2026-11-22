-- Module Vulnérabilités (ADR 0100, lot TEN-SCORES ; décision du RSSI du 22/11/2026) : score d'exposition de l'actif selon
-- Tenable (AES, Asset Exposure Score, de 0 à 1000), lu dans le champ `assetExposureScore` de l'analyse `vulndetails` par le
-- script du connecteur (liste blanche), revalidé par l'API. Affiché seulement, comme l'ACR (colonne `acr`, migration 075) :
-- ni la priorité, ni le rang, ni les alertes n'en dépendent.
-- - NULL : non fourni (Tenable ne le calcule pas, actif non licencié, machine importée d'un fichier .nessus).
-- Migration additive : une colonne qui admet NULL et sa contrainte ; aucune donnée reprise ni recopiée (consigne du
-- 14/11/2026). La valeur apparaît à la prochaine synchronisation de Tenable.
ALTER TABLE vulnerabilites_machines ADD COLUMN IF NOT EXISTS aes smallint;

ALTER TABLE vulnerabilites_machines DROP CONSTRAINT IF EXISTS vulnerabilites_machines_aes;
ALTER TABLE vulnerabilites_machines
  ADD CONSTRAINT vulnerabilites_machines_aes CHECK (aes IS NULL OR aes BETWEEN 0 AND 1000);
