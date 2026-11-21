-- Remplissage direct propre à la v7.5.0 (pile jetable du banc, après la mise à jour) : tâches des actions (ADR 0111), veille
-- des vulnérabilités chargée (avis CERT-FR et CERT Santé, journal des collectes sur dix ans), exécutions du connecteur sur
-- dix ans, faits de priorité PRIO-1 (fin de support, rançongiciels, logiciel malveillant, kits d'exploitation), veille
-- réglementaire (ADR 0110, migration 098). Schéma, contraintes et déclencheurs respectés (aucun désactivé).
-- Données fictives : titres « fictif », CVE-2099-nnnnn. Seules exceptions imposées par le schéma : les liens des
-- publications réglementaires doivent commencer par l'hôte de leur source (contrainte de la migration 098) ; ils sont
-- construits avec un chemin fictif « /banc-fictif/… », jamais ouverts (flux fermé, aucune collecte). Les avis de la veille
-- des vulnérabilités n'ont pas d'adresse (colonne facultative).
\timing on
\set ON_ERROR_STOP 1
SELECT setseed(0.21);

\echo == Tâches des actions : 2 000 actions du plan avec 1 à 12 tâches, 200 avec 50 tâches (borne TACHES_ACTION_MAX)
WITH cibles AS (
  SELECT id, row_number() OVER (ORDER BY md5(id::text)) AS n, (data->>'dueAt')::timestamptz AS due
  FROM grc_objects WHERE kind = 'action' AND NOT data ? 'seriesId' AND NOT archived
), choisies AS (
  SELECT id, due, CASE WHEN n <= 200 THEN 50 ELSE 1 + (n % 12)::int END AS nb FROM cibles WHERE n <= 2200
)
UPDATE grc_objects o SET data = jsonb_set(o.data, '{taches}', (
    SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'intitule', 'Tâche fictive ' || t || ' de l''action',
      'faite', (t * 37 + length(o.id::text)) % 3 = 0 OR coalesce(c.due < now() - interval '60 days', false), 'responsable', NULL,
      'echeance', CASE WHEN c.due IS NULL THEN NULL ELSE to_char(c.due - (c.nb - t) * interval '2 days', 'YYYY-MM-DD') END) ORDER BY t)
    FROM generate_series(1, c.nb) t)),
  updated_at = now(), updated_by = 'banc-perf'
FROM choisies c WHERE c.id = o.id;

\echo == PRIO-1 : fin de support (5 % des constats), logiciel malveillant (1 %), kits d exploitation (10 %)
UPDATE vulnerabilites_constats SET fin_support_le = timestamptz '2019-01-01' + (plugin_id % 2500) * interval '1 day'
  WHERE plugin_id % 20 = 3;
UPDATE vulnerabilites_constats SET exploite_malware = true WHERE plugin_id % 100 = 7;
UPDATE vulnerabilites_constats SET kits_exploitation = CASE plugin_id % 3 WHEN 0 THEN ARRAY['metasploit'] WHEN 1 THEN ARRAY['metasploit','core_impact'] ELSE ARRAY['canvas'] END
  WHERE plugin_id % 10 = 1;

\echo == Veille : avis du CERT-FR (9 000 avis et 150 alertes sur dix ans) et du CERT Santé (5 000 publications)
INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, resume, adresse, publie_le, cves, cves_lues, vu_le, maj_le)
SELECT 'cert-fr', 'CERTFR-' || to_char(d.t, 'YYYY') || '-AVI-' || lpad((row_number() OVER (PARTITION BY to_char(d.t, 'YYYY') ORDER BY d.t))::text, 4, '0'),
  'avis', 'Multiples vulnérabilités dans le produit fictif ' || (g % 900), 'Résumé fictif de l''avis de sécurité ' || g, NULL, d.t,
  (SELECT array_agg(DISTINCT 'CVE-2099-' || lpad((10000 + floor(random() * 20000 + 0 * g + 0 * e)::int)::text, 5, '0')) FROM generate_series(1, 1 + (g % 6)) e),
  true, d.t, d.t
FROM generate_series(1, 9000) g
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (g::float8 / 9000 + random() * 0.0001) * (now() - interval '1 day' - timestamptz '2016-12-01') AS t) d;
INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, resume, adresse, publie_le, cves, cves_lues, vu_le, maj_le)
SELECT 'cert-fr', 'CERTFR-' || to_char(d.t, 'YYYY') || '-ALE-' || lpad((row_number() OVER (PARTITION BY to_char(d.t, 'YYYY') ORDER BY d.t))::text, 3, '0'),
  'alerte', 'Vulnérabilité exploitée dans le produit fictif ' || (g % 300), 'Résumé fictif de l''alerte ' || g, NULL, d.t,
  ARRAY['CVE-2099-' || lpad((10000 + (g * 131) % 20000)::text, 5, '0')], true, d.t, d.t
FROM generate_series(1, 150) g
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (g::float8 / 150) * (now() - interval '2 days' - timestamptz '2016-12-01') AS t) d;
INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, resume, adresse, publie_le, cves, cves_lues, vu_le, maj_le,
  produit, produit_norm, fiche_lue_le, fiche_titre, fiche_exploitee, fiche_correctif, fiche_contournement, fiche_preuve, fiche_cvss31, fiche_exploitee_le, fiche_preuve_le)
SELECT 'cert-sante', (100000 + g)::text, 'alerte', 'Produit fictif ' || (g % 700) || ' - CVE-2099-' || lpad((10000 + (g * 7) % 20000)::text, 5, '0'),
  'Résumé fictif de la fiche ' || g, NULL, d.t,
  ARRAY['CVE-2099-' || lpad((10000 + (g * 7) % 20000)::text, 5, '0')] || CASE WHEN g % 3 = 0 THEN ARRAY['CVE-2099-' || lpad((10000 + (g * 11) % 20000)::text, 5, '0')] ELSE '{}' END,
  true, d.t, d.t, 'Produit fictif ' || (g % 700), 'produit_fictif_' || (g % 700), d.t + interval '1 hour',
  'Produit fictif ' || (g % 700) || ' - CVE-2099-' || lpad((10000 + (g * 7) % 20000)::text, 5, '0'),
  CASE WHEN g % 25 = 0 THEN 'oui' ELSE 'non' END, CASE WHEN g % 4 = 0 THEN 'non' ELSE 'oui' END, CASE WHEN g % 5 = 0 THEN 'oui' ELSE 'non' END,
  CASE WHEN g % 9 = 0 THEN 'disponible' ELSE 'indisponible' END, 4 + (g % 60) / 10.0,
  CASE WHEN g % 25 = 0 THEN d.t END, CASE WHEN g % 9 = 0 THEN d.t END
FROM generate_series(1, 5000) g
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (g::float8 / 5000) * (now() - interval '1 day' - timestamptz '2016-12-01') AS t) d
ON CONFLICT DO NOTHING;
UPDATE vulnerabilites_veille_cve c SET avis_le = x.le FROM (
  SELECT unnest(cves) AS cve, max(publie_le) AS le FROM vulnerabilites_veille_avis GROUP BY 1) x WHERE x.cve = c.cve;

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
CROSS JOIN LATERAL generate_series(0, (extract(epoch FROM now() - timestamptz '2016-12-01') / 3600 / s.pas)::int - 1) h
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + h * s.pas * interval '1 hour' AS t, random() + 0 * h AS r) t
CROSS JOIN LATERAL (SELECT CASE WHEN t.r > 0.99 THEN 'expire' WHEN t.r > 0.97 THEN 'echec' ELSE 'recu' END AS etat) e;

\echo == Connecteur : exécutions sur dix ans (une synchronisation par jour et une vérification par semaine)
INSERT INTO integration_executions (integration_id, operation, origine, etat, demande_par, demande_le, debute_le, termine_le, resultat, erreur)
SELECT i.id, o.op, 'planifie', e.etat, 'système', t.t, t.t + interval '30 seconds', t.t + interval '20 minutes',
  CASE WHEN e.etat = 'recu' THEN jsonb_build_object('pages', 100, 'constats', 3000, 'detections', 20000, 'machines', 1000) END,
  CASE WHEN e.etat = 'echec' THEN 'Erreur fictive du connecteur' WHEN e.etat = 'expire' THEN 'Exécution expirée (fictif)' END
FROM integrations i
CROSS JOIN (VALUES ('synchroniser', 24), ('tester', 168)) o(op, pas)
CROSS JOIN LATERAL generate_series(1, (extract(epoch FROM now() - interval '3 days' - timestamptz '2016-12-01') / 3600 / o.pas)::int) h
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + h * o.pas * interval '1 hour' AS t, random() + 0 * h AS r) t
CROSS JOIN LATERAL (SELECT CASE WHEN t.r > 0.99 THEN 'expire' WHEN t.r > 0.97 THEN 'echec' ELSE 'recu' END AS etat) e
WHERE i.type = 'tenable';

\echo == Veille réglementaire : sources, 9 500 publications sur dix ans, journal des collectes quotidiennes
INSERT INTO veille_reglementaire_sources (source, activee, derniere_reussite, dernier_essai)
SELECT s, s NOT IN ('ans', 'legifrance'), now() - interval '3 hours', now() - interval '3 hours'
FROM unnest(ARRAY['cnil','cepd','eur-lex','anssi','ans','legifrance']) s
ON CONFLICT (source) DO UPDATE SET activee = excluded.activee, derniere_reussite = excluded.derniere_reussite, dernier_essai = excluded.dernier_essai;
WITH rssi AS (SELECT array_agg(u.id ORDER BY u.username) ids FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE ur.role_id = 'rssi')
INSERT INTO veille_reglementaire_publications (source, domaine, identifiant, titre, resume, lien, publie_le, collecte_le, maj_le, statut, qualifie_le, qualifie_par)
SELECT s.source, d.domaine, s.source || '-fictif-' || g, initcap(s.libelle) || ' : publication fictive ' || g || ' sur ' || (ARRAY['la sécurité des systèmes','les données de santé','la conservation','les sous-traitants','la journalisation','l''hébergement'])[1 + g % 6],
  CASE WHEN s.source = 'anssi' THEN NULL ELSE 'Résumé fictif de la publication ' || g || ' : obligations, recommandations et calendrier.' END,
  s.hote || 'banc-fictif/' || g, t.t, t.t + interval '6 hours', t.t + interval '6 hours',
  q.statut, CASE WHEN q.statut <> 'a-qualifier' THEN t.t + (1 + g % 30) * interval '1 day' END,
  CASE WHEN q.statut <> 'a-qualifier' THEN (SELECT ids[1 + g % cardinality(ids)] FROM rssi) END
FROM (VALUES ('cnil', 3500, 'cnil', 'https://www.cnil.fr/'), ('cepd', 1500, 'cepd', 'https://www.edpb.europa.eu/'),
             ('eur-lex', 3000, 'eur-lex', 'https://eur-lex.europa.eu/'), ('anssi', 1500, 'anssi', 'https://cyber.gouv.fr/')) s(source, n, libelle, hote)
CROSS JOIN LATERAL generate_series(1, s.n) g
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01' + (g::float8 / s.n) * (now() - interval '2 hours' - timestamptz '2016-12-01') AS t) t
CROSS JOIN LATERAL (SELECT CASE WHEN s.source IN ('cnil', 'cepd') THEN 'donnees-personnelles' WHEN s.source = 'anssi' THEN 'securite'
  WHEN g % 2 = 0 THEN 'securite' ELSE 'donnees-personnelles' END AS domaine) d
CROSS JOIN LATERAL (SELECT CASE WHEN t.t > now() - interval '90 days' AND g % 5 <> 0 THEN 'a-qualifier'
  WHEN g % 100 < 7 THEN 'impactant' WHEN g % 100 < 25 THEN 'a-suivre' ELSE 'sans-objet' END AS statut) q;
INSERT INTO veille_reglementaire_collectes (source, origine, etat, demande_par, demande_le, debute_le, termine_le, lots, elements, ecartes, tronque, erreur)
SELECT s, 'planifie', e.etat, 'système', t.t, t.t + interval '15 seconds', t.t + interval '40 seconds',
  CASE WHEN e.etat = 'recu' THEN 1 ELSE 0 END, CASE WHEN e.etat = 'recu' THEN (h * 7) % 20 ELSE 0 END, 0, false,
  CASE WHEN e.etat = 'echec' THEN 'Erreur fictive de lecture du flux' WHEN e.etat = 'expire' THEN 'Collecte expirée (fictif)' END
FROM unnest(ARRAY['cnil','cepd','eur-lex','anssi']) s
CROSS JOIN LATERAL generate_series(0, (now()::date - date '2016-12-01') - 1) h
CROSS JOIN LATERAL (SELECT timestamptz '2016-12-01 06:00' + h * interval '1 day' AS t, random() + 0 * h AS r) t
CROSS JOIN LATERAL (SELECT CASE WHEN t.r > 0.99 THEN 'expire' WHEN t.r > 0.97 THEN 'echec' ELSE 'recu' END AS etat) e;

ANALYZE;
SELECT (SELECT count(*) FROM grc_objects WHERE kind = 'action' AND data ? 'taches') actions_avec_taches,
  (SELECT count(*) FROM grc_objects WHERE kind = 'action' AND jsonb_array_length(data->'taches') = 50) actions_50_taches,
  (SELECT count(*) FROM vulnerabilites_veille_avis) avis, (SELECT count(*) FROM vulnerabilites_veille_collectes) collectes_veille,
  (SELECT count(*) FROM integration_executions) executions, (SELECT count(*) FROM veille_reglementaire_publications) publications_vr,
  (SELECT count(*) FROM veille_reglementaire_collectes) collectes_vr;
