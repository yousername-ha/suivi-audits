-- Module Vulnérabilités (ADR 0100, lot QF-TEN ; demande du RSSI du 22/11/2026) : correctifs regroupés de Tenable, lus par la
-- vue `sumremediation` de l'analyse (`POST /rest/analysis`, même appel et mêmes filtres que les failles) par le script du
-- connecteur, en liste blanche (`solutionID`, `solution`, `pluginID`, `hostTotal`, `cveTotal`, `total`, `vprScore`,
-- `cvssV3BaseScore`, `epssScore` ; jamais `remediationList`), revalidés par l'API. Un correctif = un texte de solution qui
-- corrige un ensemble de contrôles de Tenable (`pluginID`), rattaché ici aux constats déjà rangés de la même instance.
-- - `vu_numero` : numéro de la dernière synchronisation qui a rapporté le correctif. Seuls les correctifs de la dernière
--   synchronisation reçue en entier (`vulnerabilites_tenable_etat.correctifs_numero`) sont montrés ; rien n'est supprimé.
-- - `machines`, `cves`, `detections` : nombres de Tenable sur tout ce qu'il analyse (`hostTotal`, `cveTotal`, `total`) ;
--   le nombre de machines montré à une personne est celui qu'elle lit, calculé par la plateforme.
-- Ni la priorité ni les alertes n'en dépendent. Migration additive : deux tables et une colonne qui admet NULL ; aucune donnée
-- reprise (consigne du 14/11/2026). Les correctifs apparaissent à la prochaine synchronisation de Tenable.
CREATE TABLE IF NOT EXISTS vulnerabilites_tenable_correctifs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  solution_id    text NOT NULL CHECK (solution_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  solution       text NOT NULL CHECK (char_length(solution) BETWEEN 1 AND 2000),
  machines       integer CHECK (machines IS NULL OR machines >= 0),
  cves           integer CHECK (cves IS NULL OR cves >= 0),
  detections     integer CHECK (detections IS NULL OR detections >= 0),
  vpr_score      numeric(3,1) CHECK (vpr_score IS NULL OR vpr_score BETWEEN 0 AND 10),
  cvss3_score    numeric(3,1) CHECK (cvss3_score IS NULL OR cvss3_score BETWEEN 0 AND 10),
  epss_score     numeric(6,5) CHECK (epss_score IS NULL OR epss_score BETWEEN 0 AND 1),
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  vu_le          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, solution_id)
);

-- Contrôles corrigés par un correctif : les constats déjà rangés de la même instance (un numéro de contrôle inconnu n'est pas
-- gardé). Remplacés à chaque synchronisation qui rapporte le correctif.
CREATE TABLE IF NOT EXISTS vulnerabilites_tenable_correctif_constats (
  correctif_id uuid NOT NULL REFERENCES vulnerabilites_tenable_correctifs(id) ON DELETE CASCADE,
  constat_id   uuid NOT NULL REFERENCES vulnerabilites_constats(id) ON DELETE CASCADE,
  PRIMARY KEY (correctif_id, constat_id)
);
CREATE INDEX IF NOT EXISTS vulnerabilites_tenable_correctif_constats_constat
  ON vulnerabilites_tenable_correctif_constats (constat_id);

-- Numéro de la dernière synchronisation dont les correctifs ont tous été reçus (fin acceptée) ; NULL : aucune.
ALTER TABLE vulnerabilites_tenable_etat ADD COLUMN IF NOT EXISTS correctifs_numero integer;
ALTER TABLE vulnerabilites_tenable_etat DROP CONSTRAINT IF EXISTS vulnerabilites_tenable_etat_correctifs_numero;
ALTER TABLE vulnerabilites_tenable_etat
  ADD CONSTRAINT vulnerabilites_tenable_etat_correctifs_numero
  CHECK (correctifs_numero IS NULL OR (correctifs_numero > 0 AND correctifs_numero <= numero));
