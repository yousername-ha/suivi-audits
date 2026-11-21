-- Journal des collectes de la veille des vulnérabilités et exécutions du connecteur sur dix ans, réinsérés après la première
-- purge (lot PRIO-1) pour mesurer les routes avec dix ans de journal, dans l'heure qui précède la purge suivante. Mêmes
-- formes que remplir-v750.sql (extrait). Pile jetable du banc seulement.
\timing on
\set ON_ERROR_STOP 1
SELECT setseed(0.22);
DELETE FROM vulnerabilites_veille_collectes WHERE demande_le < now() - interval '90 days';
DELETE FROM integration_executions WHERE demande_le < now() - interval '90 days' AND operation IN ('synchroniser', 'tester') AND demande_par = 'système';
\echo == Veille : sources et journal des collectes sur dix ans (toutes les 2 h ; EPSS une fois par jour)
INSERT INTO vulnerabilites_veille_sources (source, derniere_reussite, dernier_essai)
SELECT s, now() - interval '1 hour', now() - interval '1 hour' FROM unnest(ARRAY['cisa-kev','nvd','epss','cert-fr','cert-sante']) s
ON CONFLICT (source) DO UPDATE SET derniere_reussite = excluded.derniere_reussite, dernier_essai = excluded.dernier_essai;
INSERT INTO vulnerabilites_veille_collectes (source, origine, etat, demande_par, demande_le, debute_le, termine_le, fenetre_debut, fenetre_fin,
  lots, elements, ecartes, tronque, erreur)
SELECT s.source, CASE WHEN r < 0.02 THEN 'manuel' ELSE 'planifie' END, e.etat, CASE WHEN r < 0.02 THEN 'recette.admin' ELSE 'système' END,
  t.t, t.t + interval '20 seconds', t.t + interval '80 seconds',
  CASE WHEN s.source = 'nvd' THEN t.t - interval '2 hours' END, CASE WHEN s.source = 'nvd' THEN t.t END,
  CASE WHEN e.etat = 'recu' THEN 1 + (h % 3) ELSE 0 END, CASE WHEN e.etat = 'recu' THEN (h * 17) % 400 ELSE 0 END, 0, false,
  CASE WHEN e.etat = 'echec' THEN 'Erreur fictive de lecture de la source' WHEN e.etat = 'expire' THEN 'Collecte expirée (fictif)' END
FROM (VALUES ('cisa-kev', 2), ('nvd', 2), ('cert-fr', 2), ('cert-sante', 2), ('epss', 24)) s(source, pas)
CROSS JOIN LATERAL generate_series(0, (extract(epoch FROM now() - interval '90 days' - timestamptz '2016-12-01') / 3600 / s.pas)::int - 1) h
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + h * s.pas * interval '1 hour' AS t, random() + 0 * h AS r) t
CROSS JOIN LATERAL (SELECT CASE WHEN t.r > 0.99 THEN 'expire' WHEN t.r > 0.97 THEN 'echec' ELSE 'recu' END AS etat) e;

\echo == Connecteur : exécutions sur dix ans (une synchronisation par jour et une vérification par semaine)
INSERT INTO integration_executions (integration_id, operation, origine, etat, demande_par, demande_le, debute_le, termine_le, resultat, erreur)
SELECT i.id, o.op, 'planifie', e.etat, 'système', t.t, t.t + interval '30 seconds', t.t + interval '20 minutes',
  CASE WHEN e.etat = 'recu' THEN jsonb_build_object('pages', 100, 'constats', 3000, 'detections', 20000, 'machines', 1000) END,
  CASE WHEN e.etat = 'echec' THEN 'Erreur fictive du connecteur' WHEN e.etat = 'expire' THEN 'Exécution expirée (fictif)' END
FROM integrations i
CROSS JOIN (VALUES ('synchroniser', 24), ('tester', 168)) o(op, pas)
CROSS JOIN LATERAL generate_series(1, (extract(epoch FROM now() - interval '91 days' - timestamptz '2016-12-01') / 3600 / o.pas)::int) h
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + h * o.pas * interval '1 hour' AS t, random() + 0 * h AS r) t
CROSS JOIN LATERAL (SELECT CASE WHEN t.r > 0.99 THEN 'expire' WHEN t.r > 0.97 THEN 'echec' ELSE 'recu' END AS etat) e
WHERE i.type = 'tenable';

ANALYZE vulnerabilites_veille_collectes;
ANALYZE integration_executions;
SELECT (SELECT count(*) FROM vulnerabilites_veille_collectes) collectes, (SELECT count(*) FROM integration_executions) executions;
