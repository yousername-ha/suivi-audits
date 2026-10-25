-- D3 : deux nouveaux modes de certificat demandés depuis l'interface (autorité interne du serveur, ACME).
ALTER TABLE operation_jobs DROP CONSTRAINT IF EXISTS operation_jobs_kind_check;
ALTER TABLE operation_jobs ADD CONSTRAINT operation_jobs_kind_check
  CHECK (kind IN ('verify','restore','tls_install','tls_reset','tls_internal','tls_acme'));
