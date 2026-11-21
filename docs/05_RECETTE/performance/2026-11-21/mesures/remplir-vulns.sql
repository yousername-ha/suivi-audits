-- Complément des vulnérabilités au profil (après une synchronisation simulée à la borne de 20 000 détections) :
-- 10 000 constats (contrôles), 100 000 détections présentes (numéro de la dernière synchronisation complète),
-- 80 % des détections sur 20 % des machines ; 20 000 CVE de veille (CVE-2099-nnnnn), 5 % au catalogue KEV fictif.
\timing on
\set ON_ERROR_STOP 1
SELECT setseed(0.17);
INSERT INTO vulnerabilites_constats (integration_id, plugin_id, nom, gravite, famille, synopsis, correctif, cvss3_vecteur, cvss3_score, vpr_score, epss_score,
  exploitable, faille_publiee_le, correctif_publie_le, voir_aussi, vu_numero, vu_le, cree_le)
SELECT i.id, 100000 + g, 'Faille fictive du composant ' || g, (ARRAY['critique','elevee','moyenne','faible'])[1 + g % 4], 'Famille fictive',
  'Synopsis fictif de la faille.', 'Appliquer la mise à jour fictive.', 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 4 + (g % 60) / 10.0, 3 + (g % 70) / 10.0,
  (g % 100) / 1000.0, g % 7 = 0, timestamptz '2017-01-01' + (g % 3300) * interval '1 day', timestamptz '2017-01-15' + (g % 3300) * interval '1 day',
  'https://editeur.example/avis/' || g, 1, now(), now()
FROM integrations i, generate_series(3000, 9999) g WHERE i.type = 'tenable'
ON CONFLICT DO NOTHING;
INSERT INTO vulnerabilites_constat_cves (constat_id, cve)
SELECT c.id, 'CVE-2099-' || lpad((10000 + (c.plugin_id - 100000) % 20000)::text, 5, '0') FROM vulnerabilites_constats c
ON CONFLICT DO NOTHING;
WITH m AS (SELECT array_agg(id ORDER BY identifiant_source) ids, count(*)::int n FROM vulnerabilites_machines),
     c AS (SELECT array_agg(id ORDER BY plugin_id) ids, count(*)::int n FROM vulnerabilites_constats)
INSERT INTO vulnerabilites_detections (constat_id, machine_id, port, protocole, premiere_detection, derniere_detection, vu_numero, vu_le)
SELECT c.ids[1 + floor(power(random() + 0 * g, 1.5) * c.n)::int], m.ids[1 + floor(CASE WHEN random() + 0 * g < 0.8 THEN random() * 0.2 ELSE random() END * m.n)::int],
  (ARRAY[0,22,80,443,445,3389,1433,8080,8443,5432])[1 + floor(random() * 10)::int], 'TCP',
  timestamptz '2018-01-01' + random() * (now() - timestamptz '2018-01-01'), now() - interval '1 day', 1, now()
FROM generate_series(1, 95000) g, m, c
ON CONFLICT DO NOTHING;
INSERT INTO vulnerabilites_veille_cve (cve, description, publie_le, modifie_le, cvss31_score, cvss31_vecteur, cvss31_gravite, editeurs, produits, nvd_le,
  epss_score, epss_centile, epss_date, epss_le, kev_editeur, kev_produit, kev_nom, kev_ajout, kev_echeance, kev_rancongiciel, kev_le)
SELECT 'CVE-2099-' || lpad(g::text, 5, '0'), 'Description fictive de la faille ' || g, timestamptz '2016-12-01' + (g % 3600) * interval '1 day', now() - (g % 300) * interval '1 day',
  (g % 100) / 10.0, 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', (ARRAY['LOW','MEDIUM','HIGH','CRITICAL'])[1 + g % 4], ARRAY['editeur-fictif-' || (g % 300)],
  ARRAY['produit-fictif-' || (g % 900)], now(), (g % 1000) / 1000.0, (g % 1000) / 1000.0, current_date, now(),
  CASE WHEN g % 20 = 0 THEN 'Éditeur fictif' END, CASE WHEN g % 20 = 0 THEN 'Produit fictif' END, CASE WHEN g % 20 = 0 THEN 'Faille fictive' END,
  CASE WHEN g % 20 = 0 THEN current_date - (g % 900) END, CASE WHEN g % 20 = 0 THEN current_date - (g % 900) + 21 END, CASE WHEN g % 20 = 0 THEN g % 40 = 0 END,
  CASE WHEN g % 20 = 0 THEN now() END
FROM generate_series(10000, 29999) g
ON CONFLICT DO NOTHING;
SELECT (SELECT count(*) FROM vulnerabilites_constats) constats, (SELECT count(*) FROM vulnerabilites_detections) detections,
  (SELECT count(*) FROM vulnerabilites_machines) machines, (SELECT count(*) FROM vulnerabilites_veille_cve) veille;
