-- Retrait définitif du module « Applications à intégrer » (analyse d'écart GAP) et des applications de la cartographie :
-- décision du RSSI du 12/11/2026, ADR 0089 (lot 2). Suppression DÉFINITIVE de la table et de ses données : la sauvegarde
-- automatique de la mise à jour précède cette migration, c'est le seul retour arrière. Le module n'avait pas de droit propre
-- (il relevait de « conformite ») : aucun rôle ni attribution à modifier. Le journal d'audit n'est pas touché.
DROP TABLE IF EXISTS suivi_app_gaps;
DELETE FROM suivi_presence WHERE cle = 'appGaps';
UPDATE app_state SET data = data - 'appGaps' WHERE id = 1 AND data ? 'appGaps';

-- Cartographie : les nœuds « application » (références « app:… ») disparaissent des cartes enregistrées et de leurs versions
-- figées, avec leurs relations graphiques et leurs masquages ou relations ignorées. Les autres objets ne sont pas touchés.
CREATE FUNCTION pg_temp.sans_applications(l jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT l
    || CASE WHEN jsonb_typeof(l -> 'nodes') = 'object' THEN jsonb_build_object('nodes',
         (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(l -> 'nodes') AS e(k, v) WHERE k NOT LIKE 'app:%'))
       ELSE '{}'::jsonb END
    || CASE WHEN jsonb_typeof(l -> 'edges') = 'array' THEN jsonb_build_object('edges',
         (SELECT COALESCE(jsonb_agg(x.e ORDER BY x.n), '[]'::jsonb) FROM jsonb_array_elements(l -> 'edges') WITH ORDINALITY AS x(e, n)
           WHERE COALESCE(x.e ->> 's', '') NOT LIKE 'app:%' AND COALESCE(x.e ->> 't', '') NOT LIKE 'app:%'))
       ELSE '{}'::jsonb END
    || CASE WHEN jsonb_typeof(l -> 'ignored') = 'object' THEN jsonb_build_object('ignored',
         (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(l -> 'ignored') AS e(k, v) WHERE k NOT LIKE 'app:%'))
       ELSE '{}'::jsonb END
    || CASE WHEN jsonb_typeof(l -> 'hide') = 'object' THEN jsonb_build_object('hide',
         (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(l -> 'hide') AS e(k, v)
           WHERE k NOT LIKE 'd:app:%' AND k NOT LIKE '%>app:%'))
       ELSE '{}'::jsonb END
$$;
UPDATE maps SET layout = pg_temp.sans_applications(layout), version = version + 1
  WHERE jsonb_typeof(layout) = 'object' AND pg_temp.sans_applications(layout) <> layout;
UPDATE map_versions SET layout = pg_temp.sans_applications(layout)
  WHERE jsonb_typeof(layout) = 'object' AND pg_temp.sans_applications(layout) <> layout;
