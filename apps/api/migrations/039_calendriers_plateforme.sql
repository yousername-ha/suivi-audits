-- Calendriers de plateforme (décision 4 du 25/10/2026) : jours fériés français calculés et calendriers iCalendar importés par
-- l'administrateur, réutilisables par les séries de tâches. Les jours se complètent d'année en année (clé : calendrier + jour) ;
-- chaque mise à jour est consignée dans un journal immuable avec sa provenance. Migration additive.
CREATE TABLE calendriers_plateforme (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  kind        text NOT NULL CHECK (kind IN ('feries', 'autre')),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX calendriers_plateforme_nom ON calendriers_plateforme (lower(name));

CREATE TABLE calendriers_plateforme_jours (
  calendrier_id uuid NOT NULL REFERENCES calendriers_plateforme(id) ON DELETE CASCADE,
  day           date NOT NULL,
  label         text NOT NULL DEFAULT '' CHECK (char_length(label) <= 200),
  origin        text NOT NULL CHECK (origin IN ('calcul', 'ical')),
  added_by      text NOT NULL,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (calendrier_id, day)
);

-- Journal des mises à jour : sans clé étrangère, pour survivre à la suppression d'un calendrier vide.
CREATE TABLE calendriers_plateforme_journal (
  seq           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  calendrier_id uuid NOT NULL,
  operation     text NOT NULL CHECK (operation IN ('creer', 'generer', 'importer', 'retirer_annee', 'supprimer')),
  year          integer,
  days_added    integer NOT NULL DEFAULT 0 CHECK (days_added >= 0),
  days_removed  integer NOT NULL DEFAULT 0 CHECK (days_removed >= 0),
  provenance    text NOT NULL DEFAULT '' CHECK (char_length(provenance) <= 300),
  reason        text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendriers_plateforme_journal_cal ON calendriers_plateforme_journal (calendrier_id, seq DESC);
CREATE TRIGGER calendriers_plateforme_journal_immutable BEFORE UPDATE OR DELETE ON calendriers_plateforme_journal
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER calendriers_plateforme_journal_no_truncate BEFORE TRUNCATE ON calendriers_plateforme_journal
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
