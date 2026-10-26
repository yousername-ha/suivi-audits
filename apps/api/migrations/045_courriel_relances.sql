-- Relance automatique des courriels (ADR 0059) : une notification dont l'envoi échoue de façon passagère (serveur SMTP injoignable,
-- exécutant interrompu) est remise en file avec un délai croissant, dans la limite fixée dans les réglages du courriel. Le message de
-- test n'est jamais relancé (il est lancé à la main). Migration additive : les demandes existantes comptent zéro tentative.
ALTER TABLE courriel_jobs
  ADD COLUMN attempts        integer     NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
DROP INDEX courriel_jobs_etat;
CREATE INDEX courriel_jobs_etat ON courriel_jobs (status, next_attempt_at, created_at);
