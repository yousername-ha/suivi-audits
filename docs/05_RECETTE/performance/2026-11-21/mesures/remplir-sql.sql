-- Remplissage direct en base du banc de performance (pile jetable uniquement). Schéma, contraintes et déclencheurs
-- respectés (aucun désactivé). Données fictives : noms « fictif », domaines .example, adresses de documentation.
-- Les échantillons créés par l'API servent de modèle (formes de `data`, registres par défaut, méthodes publiées).
\timing on
\set ON_ERROR_STOP 1
SELECT setseed(0.42);

-- Périmètres pondérés (Zipf doux) et rédacteurs par périmètre.
DROP TABLE IF EXISTS banc_perimetres;
CREATE TABLE banc_perimetres AS
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rang FROM grc_smsis;
ALTER TABLE banc_perimetres ADD COLUMN poids float8;
UPDATE banc_perimetres SET poids = 1 / power(rang, 0.8);
ALTER TABLE banc_perimetres ADD COLUMN borne_basse float8, ADD COLUMN borne_haute float8;
WITH c AS (SELECT id, sum(poids) OVER (ORDER BY rang) / sum(poids) OVER () AS cum, poids / sum(poids) OVER () AS p FROM banc_perimetres)
UPDATE banc_perimetres b SET borne_haute = c.cum, borne_basse = c.cum - c.p FROM c WHERE c.id = b.id;
CREATE OR REPLACE FUNCTION pg_temp.perimetre(r float8) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT id FROM banc_perimetres WHERE r >= borne_basse AND r < borne_haute UNION ALL SELECT id FROM banc_perimetres WHERE rang = 1 LIMIT 1 $$;
DROP TABLE IF EXISTS banc_redacteurs;
CREATE TABLE banc_redacteurs AS
  SELECT smsi_id, array_agg(user_id ORDER BY user_id) AS ids FROM grc_members WHERE can_write GROUP BY smsi_id;

\echo == Plan d actions : 5 000 actions (hors occurrences récurrentes)
INSERT INTO grc_objects (smsi_id, kind, module, name, data, registre_id, created_by, updated_by, created_at, updated_at)
SELECT p.smsi, 'action', 'ecarts', 'Action fictive du plan ' || g,
  jsonb_build_object('description', 'Action fictive issue d''un audit ou d''un écart', 'status', st.s,
    'ownerId', (SELECT r.ids[1 + floor(random() * cardinality(r.ids))::int] FROM banc_redacteurs r WHERE r.smsi_id = p.smsi),
    'startAt', NULL, 'dueAt', to_char(d.due AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"'),
    'priority', (ARRAY['low','normal','normal','high','urgent'])[1 + floor(random() * 5)::int], 'category', 'action',
    'justification', CASE WHEN st.s = 'cancelled' THEN 'Abandonnée (fictif)' ELSE '' END, 'reminderDays', 7, 'dependencies', '[]'::jsonb),
  (SELECT id FROM registres WHERE kind = 'plan_actions' AND par_defaut AND reference_smsi_id = p.smsi),
  'banc-perf', 'banc-perf', d.due - interval '60 days', LEAST(now(), d.due + interval '10 days')
FROM generate_series(1, 5000 - (SELECT count(*) FROM grc_objects WHERE kind = 'action' AND NOT data ? 'seriesId')) g
CROSS JOIN LATERAL (SELECT pg_temp.perimetre(random() + 0 * g) AS smsi) p
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (random() + 0 * g) * (timestamptz '2027-06-30' - timestamptz '2016-12-01') AS due) d
CROSS JOIN LATERAL (SELECT CASE WHEN d.due > now() THEN (ARRAY['todo','todo','progress','blocked'])[1 + floor(random() * 4)::int]
  WHEN random() < 0.86 THEN 'done' WHEN random() < 0.4 THEN 'cancelled' ELSE (ARRAY['todo','progress','blocked'])[1 + floor(random() * 3)::int] END AS s) st;

\echo == Occurrences récurrentes : statuts réalistes (anciennes réalisées, quelques retards)
UPDATE grc_objects SET data = jsonb_set(data, '{status}', to_jsonb(CASE WHEN random() < 0.93 THEN 'done' WHEN random() < 0.3 THEN 'cancelled' ELSE 'todo' END)),
  updated_at = (data->>'dueAt')::timestamptz + interval '3 days', updated_by = 'banc-perf'
WHERE kind = 'action' AND data ? 'seriesId' AND (data->>'dueAt')::timestamptz < now() - interval '45 days';

\echo == Risques : 2 000
INSERT INTO grc_objects (smsi_id, kind, module, name, data, created_by, updated_by, created_at, updated_at)
SELECT p.smsi, 'risk', 'pilotage', 'Risque fictif ' || g,
  jsonb_build_object('description', 'Risque fictif du registre', 'code', 'RF-' || g,
    'ownerId', (SELECT r.ids[1 + floor(random() * cardinality(r.ids))::int] FROM banc_redacteurs r WHERE r.smsi_id = p.smsi),
    'methodId', m.method_id::text, 'methodVersion', m.version, 'domain', 'information', 'entity', 'Entité fictive ' || (g % 25),
    'scope', 'Recette', 'strategy', (ARRAY['reduce','reduce','reduce','accept','transfer','avoid','treated'])[1 + floor(random() * 7)::int],
    'acceptanceReason', 'Acceptation fictive justifiée', 'reviewAt', to_char(now() + (random() * 700 - 200) * interval '1 day', 'YYYY-MM-DD'), 'stages', '{}'::jsonb),
  'banc-perf', 'banc-perf', c.t, c.t + random() * (now() - c.t)
FROM generate_series(1, 2000 - (SELECT count(*) FROM grc_objects WHERE kind = 'risk')) g
CROSS JOIN LATERAL (SELECT pg_temp.perimetre(random() + 0 * g) AS smsi) p
CROSS JOIN LATERAL (SELECT method_id, version FROM grc_method_versions WHERE smsi_id = p.smsi ORDER BY version DESC LIMIT 1) m
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (random() + 0 * g) * (now() - timestamptz '2016-12-01') AS t) c;

\echo == Documents : 2 000 fiches
INSERT INTO documents (title, description, category, refs, tags, classification, created_by, created_at, updated_by, updated_at)
SELECT 'Document fictif ' || g, 'Fiche documentaire fictive', (ARRAY['Procédure','Politique','Compte rendu','Preuve','Contrat','Plan'])[1 + floor(random() * 6)::int],
  ARRAY['A.5.' || (1 + g % 37)], ARRAY[]::text[], (ARRAY['public','interne','interne','restreint','confidentiel'])[1 + floor(random() * 5)::int],
  'banc-perf', c.t, 'banc-perf', c.t + random() * (now() - c.t)
FROM generate_series(1, 2000 - (SELECT count(*) FROM documents)) g
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (random() + 0 * g) * (now() - timestamptz '2016-12-01') AS t) c;

\echo == Incidents : 3 000 avec chronologies (registre historique, table suivi_incidents)
INSERT INTO suivi_incidents (position, id, detected_at, reporter, title, description, kind, category, impact, urgency, status, owner,
  actions, cause, resolved_at, retex, answers, notified, finding_id, created_iso, extra)
SELECT (SELECT coalesce(max(position), -1) FROM suivi_incidents) + g,
  'INC-' || to_char(d.t, 'YYYY') || '-B' || lpad(g::text, 4, '0'), to_char(d.t, 'YYYY-MM-DD"T"HH24:MI'), 'Agent fictif ' || (g % 50),
  'Incident fictif ' || g, 'Description fictive de l''incident ' || g,
  (ARRAY['Incident de sécurité','Incident','Événement de sécurité'])[1 + floor(random() * 3)::int],
  (ARRAY['Hameçonnage','Logiciel malveillant ou rançongiciel','Compte compromis ou accès non autorisé','Fuite ou perte de données','Indisponibilité de service','Vulnérabilité exploitée','Perte ou vol de matériel','Erreur humaine','Incident fournisseur','Autre'])[1 + floor(random() * 10)::int],
  (ARRAY['Élevé','Moyen','Faible'])[1 + floor(random() * 3)::int], (ARRAY['Élevé','Moyen','Faible'])[1 + floor(random() * 3)::int],
  CASE WHEN d.t < now() - interval '90 days' THEN (ARRAY['Clos','Clos','Clos','Résolu'])[1 + floor(random() * 4)::int]
       ELSE (ARRAY['Nouveau','Qualifié','En cours','Résolu'])[1 + floor(random() * 4)::int] END,
  'Agent fictif ' || (g % 30), 'Actions fictives menées', 'Cause fictive', to_char(d.t + interval '3 days', 'YYYY-MM-DD"T"HH24:MI'), '',
  '{}'::jsonb, '{}'::jsonb, '', to_char(d.t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"'),
  jsonb_build_object('smsi', pg_temp.perimetre(random() + 0 * g)::text, 'timelineSeq', 8, 'timeline', (
    SELECT jsonb_agg(jsonb_build_object('id', 'EV-' || lpad(e::text, 3, '0'), 'ts', to_char(d.t + e * interval '3 hours', 'YYYY-MM-DD"T"HH24:MI'),
      'type', (ARRAY['Détection','Qualification','Alerte et escalade','Analyse'])[1 + (e % 4)], 'titre', 'Étape fictive ' || e,
      'description', 'Déroulé fictif de l''étape ' || e || ' de l''incident.', 'acteur', 'Agent fictif', 'gravite', 'Modérée', 'source', '', 'apport', ''))
    FROM generate_series(1, 8 + 0 * g) e))
FROM generate_series(1, 3000 - (SELECT count(*) FROM suivi_incidents)) g
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (random() + 0 * g) * (now() - timestamptz '2016-12-01') AS t) d;

\echo == Notifications : 200 000
INSERT INTO grc_notifications (smsi_id, object_id, user_id, kind, due_key, title, message, read_at, created_at)
SELECT x.smsi_id, x.id, x.user_id, 'task_due', x.due, 'Échéance proche', 'Une action arrive à échéance (fictif).',
  CASE WHEN random() < 0.9 THEN x.cree + interval '2 days' END, x.cree
FROM (
  SELECT o.smsi_id, o.id, m.user_id, o.data->>'dueAt' AS due, (o.data->>'dueAt')::timestamptz - interval '7 days' AS cree,
    row_number() OVER (ORDER BY random()) AS n
  FROM grc_objects o JOIN grc_members m ON m.smsi_id = o.smsi_id
  WHERE o.kind = 'action' AND o.data->>'dueAt' IS NOT NULL
) x WHERE x.n <= 200000 - (SELECT count(*) FROM grc_notifications)
ON CONFLICT DO NOTHING;

\echo == Journal d audit : 2 000 000
INSERT INTO audit_log (ts, user_id, username, ip, action, target, details)
SELECT t.ts, u.id, u.username, ('198.51.100.' || (1 + floor(random() * 250)::int))::inet, a.action,
  CASE WHEN a.action LIKE 'grc.%' THEN gen_random_uuid()::text WHEN a.action LIKE 'document.%' THEN gen_random_uuid()::text ELSE '' END,
  CASE WHEN a.action LIKE 'grc.%' THEN jsonb_build_object('kind', 'action', 'version', 1 + floor(random() * 5)::int) ELSE '{}'::jsonb END
FROM generate_series(1, 2000000 - (SELECT count(*) FROM audit_log)) g
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + sqrt(random() + 0 * g) * (now() - timestamptz '2016-12-01') AS ts) t
CROSS JOIN LATERAL (SELECT 0 * g + 0 AS z, (ARRAY['auth.login','auth.login','auth.login','auth.logout','auth.logout','grc.object.updated','grc.object.updated',
  'grc.object.created','document.download','auth.login_failed','legacy.state_saved','incident.updated','vulnerabilites.constat.suivi',
  'auth.account_locked','admin.audit_export','modules.update','document.scan_alerte','securite.alerte_cle'])[
  CASE WHEN random() + 0 * g < 0.995 THEN 1 + floor(random() * 13)::int ELSE 14 + floor(random() * 5)::int END] AS action) a
CROSS JOIN (SELECT array_agg(id ORDER BY id) AS ids, array_agg(username ORDER BY id) AS noms, count(*)::int AS n FROM users) uu
CROSS JOIN LATERAL (SELECT 1 + floor((random() + 0 * g) * uu.n)::int AS i) ui
CROSS JOIN LATERAL (SELECT uu.ids[ui.i] AS id, uu.noms[ui.i] AS username) u;

DROP TABLE banc_perimetres;
DROP TABLE banc_redacteurs;
