-- Suivi des audits SMSI — cartographie du SMSI (ADR 0013, CARTO-03, CARTO-14).
-- Une carte ne stocke que la présentation (positions, tailles, cadres, relations graphiques, masquages) : les objets
-- métier sont relus dans la plateforme à chaque affichage.

CREATE TABLE maps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view            text NOT NULL CHECK (view IN ('context', 'process')),
  name            text NOT NULL,
  layout          jsonb NOT NULL,                  -- { nodes, edges, hide, ignored } (contrat S.maps, sans versions)
  settings        jsonb NOT NULL DEFAULT '{}',     -- issueKind (nature des enjeux corrigée, carte de contexte)
  version         integer NOT NULL DEFAULT 1,      -- If-Match (ADR 0004)
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL,
  legacy_id       text,
  import_batch_id bigint REFERENCES import_batches(id) ON DELETE SET NULL,
  extra           jsonb NOT NULL DEFAULT '{}'      -- champs legacy non modélisés (updatedAt…)
);
-- Une carte par vue au départ (point à arbitrer n° 6) : index à supprimer quand plusieurs cartes par vue seront permises.
CREATE UNIQUE INDEX maps_one_per_view ON maps (view);
CREATE UNIQUE INDEX maps_legacy_id ON maps (legacy_id) WHERE legacy_id IS NOT NULL;

-- Versions figées d'une carte (20 au plus par carte : la plus ancienne est supprimée par l'API).
CREATE TABLE map_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id          uuid NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  label           text NOT NULL,
  layout          jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL,
  legacy_id       text,
  import_batch_id bigint REFERENCES import_batches(id) ON DELETE SET NULL,
  extra           jsonb NOT NULL DEFAULT '{}'      -- identifiant et date d'origine (outil historique)
);
CREATE INDEX map_versions_map ON map_versions (map_id, created_at);

CREATE TRIGGER maps_notify AFTER INSERT OR UPDATE OR DELETE ON maps
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('maps', 'id', 'version');
CREATE TRIGGER map_versions_notify AFTER INSERT OR DELETE ON map_versions
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('maps', 'map_id', '');

-- ---------------------------------------------------------------- Reprise des cartes de la bêta (S.maps)
-- Les cartes déjà dessinées dans l'outil historique (clé « maps » d'app_state) sont recopiées dans les tables.
-- La clé reste dans app_state jusqu'au prochain enregistrement (elle est alors retirée, comme pour tout module
-- repris) ; l'état servi à /legacy est recomposé à partir des tables.
INSERT INTO maps (view, name, layout, settings, created_by, updated_by, legacy_id, extra)
SELECT v.view,
       CASE v.view WHEN 'context' THEN 'Carte du contexte' ELSE 'Carte des processus' END,
       jsonb_build_object(
         'nodes',   COALESCE(m.map -> 'nodes', '{}'::jsonb),
         'edges',   CASE WHEN jsonb_typeof(m.map -> 'edges') = 'array' THEN m.map -> 'edges' ELSE '[]'::jsonb END,
         'hide',    CASE WHEN jsonb_typeof(m.map -> 'hide') = 'object' THEN m.map -> 'hide' ELSE '{}'::jsonb END,
         'ignored', CASE WHEN jsonb_typeof(m.map -> 'ignored') = 'object' THEN m.map -> 'ignored' ELSE '{}'::jsonb END),
       CASE WHEN v.view = 'context' AND jsonb_typeof(s.data -> 'maps' -> 'issueKind') = 'object'
            THEN jsonb_build_object('issueKind', s.data -> 'maps' -> 'issueKind') ELSE '{}'::jsonb END,
       'migration', 'migration', 'maps.' || v.view,
       -- Même forme que l'import (apps/api/src/carto/maps.ts) : autres clés, clés absentes, versions absentes.
       jsonb_strip_nulls(jsonb_build_object(
         'champs', m.map - 'nodes' - 'edges' - 'hide' - 'ignored' - 'versions',
         'absents', (SELECT jsonb_agg(k) FROM unnest(ARRAY['edges', 'hide', 'ignored']) AS k WHERE NOT m.map ? k),
         'sansVersions', CASE WHEN jsonb_typeof(m.map -> 'versions') = 'array' THEN NULL ELSE true END))
FROM app_state s
CROSS JOIN (VALUES ('context'), ('process')) AS v(view)
CROSS JOIN LATERAL (SELECT s.data -> 'maps' -> v.view AS map) m
WHERE s.id = 1 AND jsonb_typeof(m.map) = 'object' AND jsonb_typeof(m.map -> 'nodes') = 'object';

INSERT INTO map_versions (map_id, label, layout, created_at, created_by, legacy_id, extra)
SELECT mp.id, COALESCE(x.ver ->> 'label', ''), COALESCE(x.ver -> 'map', '{}'::jsonb),
       now() + (x.n || ' milliseconds')::interval, 'migration', x.ver ->> 'id',
       jsonb_strip_nulls(jsonb_build_object('id', x.ver -> 'id', 'at', x.ver -> 'at'))
FROM maps mp
JOIN app_state s ON s.id = 1
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.data -> 'maps' -> mp.view -> 'versions') = 'array'
       THEN s.data -> 'maps' -> mp.view -> 'versions' ELSE '[]'::jsonb END) WITH ORDINALITY AS x(ver, n)
WHERE mp.legacy_id IS NOT NULL;

-- Nature des enjeux corrigée sans carte de contexte : carte « vide » (masquée) qui porte les réglages.
INSERT INTO maps (view, name, layout, settings, created_by, updated_by, legacy_id, extra)
SELECT 'context', 'Carte du contexte', '{"nodes": {}, "edges": [], "hide": {}, "ignored": {}}'::jsonb,
       jsonb_build_object('issueKind', s.data -> 'maps' -> 'issueKind'), 'migration', 'migration', 'maps.context',
       '{"vide": true}'::jsonb
FROM app_state s
WHERE s.id = 1 AND jsonb_typeof(s.data -> 'maps' -> 'issueKind') = 'object'
  AND NOT EXISTS (SELECT 1 FROM maps WHERE view = 'context');
