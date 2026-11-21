-- Purge des journaux (lot PRIO-1, apps/api/src/vulnerabilites/purge-journaux.ts et veille.ts purgerJournal) : les deux
-- requêtes exactes du code (90 jours, JOURNAUX_CONSERVATION_JOURS), exécutées avec EXPLAIN (ANALYZE, BUFFERS) dans une
-- transaction ANNULÉE : rien n'est effacé, la durée et le plan sont ceux de la première purge sur dix ans de journal.
\timing on
SELECT count(*) AS collectes_avant FROM vulnerabilites_veille_collectes;
SELECT count(*) AS executions_avant FROM integration_executions;
BEGIN;

      WITH effacees AS (
        DELETE FROM vulnerabilites_veille_collectes x
        WHERE x.etat NOT IN ('en_file', 'en_cours')
          AND x.demande_le < now() - make_interval(days => 90)
          AND x.id <> (SELECT y.id FROM vulnerabilites_veille_collectes y WHERE y.source = x.source
                       ORDER BY y.demande_le DESC, y.id LIMIT 1)
        RETURNING 1)
      SELECT count(*)::int AS n FROM effacees;

    WITH effacees AS (
      DELETE FROM integration_executions x
      WHERE x.etat NOT IN ('en_file', 'en_cours')
        AND x.demande_le < now() - make_interval(days => 90)
        AND x.id <> (SELECT y.id FROM integration_executions y
                     WHERE y.integration_id = x.integration_id AND y.operation = x.operation
                     ORDER BY y.demande_le DESC, y.id LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM vulnerabilites_imports vi WHERE vi.execution_id = x.id)
        AND NOT EXISTS (SELECT 1 FROM vulnerabilites_silene_imports si WHERE si.execution_id = x.id)
      RETURNING 1)
    SELECT count(*)::int AS n FROM effacees;
COMMIT;
