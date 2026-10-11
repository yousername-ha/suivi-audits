# Exécutions réellement constatées

Référence applicative analysée : `f9545c3ce1a1338f13bb39bdaa4468bcc907da2d`. Mise à jour : 2026-10-11T22:10:00+02:00 (Europe/Paris).

Source persistante anonymisée : [reçu JSON](preuves/2026-10-11-executions.json),
avec chiffres, commandes, codes et empreintes des rapports locaux lorsque
collectées. Rapports bruts hors Git ; les anciennes traces contenant des données
de recette ne sont pas copiées. La preuve CI est vérifiable sur GitHub. EXE-001 à EXE-012 sont des constats historiques sur `c704fa6`
(conservés, non rejoués) ; EXE-013 et EXE-014 portent sur le commit analysé.

## EXE-001 — shared

- Type : SUITE LOCALE ; date : 2026-10-11T00:25:28+02:00.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Workspace cloud, dépendances déjà présentes ; aucune base connectée.
- Exécutant : Agent Codex ; aucune identité personnelle reproduite.
- Commande/procédure : `cd packages/shared && ./node_modules/.bin/vitest run --reporter=json --outputFile=<rapport-prive>`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : 222.
- Cas liés : TEST-008, TEST-009, TEST-021.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : Rapport brut gardé hors Git ; ce reçu synthétique conserve chiffres, code retour et empreinte.

## EXE-002 — ui

- Type : SUITE LOCALE ; date : 2026-10-11T00:25:28+02:00.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Workspace cloud, dépendances déjà présentes ; aucune base connectée.
- Exécutant : Agent Codex ; aucune identité personnelle reproduite.
- Commande/procédure : `cd packages/ui && ./node_modules/.bin/vitest run --reporter=json --outputFile=<rapport-prive>`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : 102.
- Cas liés : TEST-005.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : Rapport brut gardé hors Git ; ce reçu synthétique conserve chiffres, code retour et empreinte.

## EXE-003 — web

- Type : SUITE LOCALE ; date : 2026-10-11T00:25:29+02:00.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Workspace cloud, dépendances déjà présentes ; aucune base connectée.
- Exécutant : Agent Codex ; aucune identité personnelle reproduite.
- Commande/procédure : `cd apps/web && ./node_modules/.bin/vitest run --reporter=json --outputFile=<rapport-prive>`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : 17.
- Cas liés : TEST-003, TEST-005, TEST-039, TEST-040.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : Rapport brut gardé hors Git ; ce reçu synthétique conserve chiffres, code retour et empreinte.

## EXE-004 — publication

- Type : SUITE LOCALE ; date : 2026-10-11 ; heure exacte non collectée.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Workspace ; temporaires dédiés et Docker simulé pour update.
- Exécutant : Agent Codex.
- Commande/procédure : `node --test scripts/tests/publication.test.mjs`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : 4.
- Cas liés : TEST-013.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : Pas de téléchargement ni installation réelle de mise à jour.

## EXE-005 — updates

- Type : SUITE LOCALE ; date : 2026-10-11 ; heure exacte non collectée.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Workspace ; temporaires dédiés et Docker simulé pour update.
- Exécutant : Agent Codex.
- Commande/procédure : `python3 -m unittest discover -s scripts/tests -p test_updates.py`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : 15.
- Cas liés : TEST-013.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : Pas de téléchargement ni installation réelle de mise à jour.

## EXE-006 — CI complète

- Type : CI HISTORIQUE REVÉRIFIÉE ; date : 2026-10-10T23:27:26+02:00 → 23:55:54+02:00.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Runners GitHub isolés, PostgreSQL 17, Docker/TLS et Playwright officiel.
- Exécutant : GitHub Actions.
- Commande/procédure : `Workflow CI automatique de la PR #12 ; tentative 1.`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : 730.
- Cas liés : TEST-001, TEST-002, TEST-003, TEST-004, TEST-005, TEST-006, TEST-007, TEST-008, TEST-009, TEST-010, TEST-011, TEST-012, TEST-013, TEST-014, TEST-015, TEST-016, TEST-017, TEST-018, TEST-019, TEST-020, TEST-021, TEST-022, TEST-023, TEST-024, TEST-025, TEST-026, TEST-027, TEST-039, TEST-040.
- Preuve : https://github.com/yousername-ha/suivi-audits/actions/runs/38087692231.
- Limites : 730 = 587 Vitest + 143 Playwright ; ne compte pas tous les contrôles shell/Python de CI. Pas de recette client.

## EXE-007 — CodeQL

- Type : ANALYSE HISTORIQUE REVÉRIFIÉE ; date : 2026-10-10.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Runner GitHub
- Exécutant : GitHub Actions.
- Commande/procédure : `Workflow CodeQL automatique, tentative 1.`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : Contrôle, pas un décompte de tests.
- Cas liés : Contrôle transversal.
- Preuve : https://github.com/yousername-ha/suivi-audits/actions/runs/38087692214.
- Limites : Seuil HIGH/CRITICAL respecté ; ne prouve pas l’absence universelle de vulnérabilités.

## EXE-008 — Contrats API

- Type : CONTRÔLE LOCAL ; date : 2026-10-11T00:57:18+02:00.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Aucune connexion PostgreSQL ; aucune écoute réseau.
- Exécutant : Agent Codex.
- Commande/procédure : `cd apps/api && node --conditions=source --import tsx src/openapi-cli.ts <fichier-prive> ; extraction allRoutes() sans services`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : Contrôle, pas un décompte de tests.
- Cas liés : Contrôle transversal.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : 150 chemins OpenAPI, 186 opérations documentées et 7 routes cachées ; 193 déclarations au total. Ces routes ne sont pas toutes publiques.

## EXE-009 — Conservation v2

- Type : CONTRÔLE LOCAL ; date : 2026-10-11T00:57:18+02:00.
- Version/source : 3.0.2 ; `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`.
- Environnement : Lecture seule des sources.
- Exécutant : Agent Codex.
- Commande/procédure : `Lecture ZIP, git show du commit b148c1b, comparaison octet par octet et fonctions nommées.`.
- Statut / code retour : **PASSÉ / 0**.
- Tests : Contrôle, pas un décompte de tests.
- Cas liés : Contrôle transversal.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : 44 fichiers identiques ; 326/326 fonctions présentes, 330 actuelles ; 5/5 bibliothèques identiques. Pas d’équivalence comportementale exhaustive.

NON EXÉCUTÉ pendant cette mission : test API (globalSetup destructif),
migrations, Playwright/Docker, sauvegarde/restauration réelles, installation
serveur, charge, certificats client et acceptation humaine. Les deux workflows
historiques sont relus en tentative 1 et non relancés.

## EXE-010 — Comparaison brute du guide

- Type : CONTRÔLE LOCAL ; date : 2026-10-11 ; heure exacte non collectée.
- Source : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8` ; lecture documentaire sans base.
- Commande/procédure : `python3 : extraction guide-extraire.mjs de la référence et du document actuel, puis assert avant == après`.
- Statut / code retour : **ÉCHOUÉ / 1**.
- Cas liés : aucun ; contrôle documentaire, hors décompte des 45 cas.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Résultat et limites : Comparaison trop stricte : seuls les commentaires de provenance différaient (chemin et lignes après ajout du renvoi). Échec conservé ; remplacé par EXE-012 sans ignorer les commandes.

## EXE-011 — Protection des sections publiées

- Type : CONTRÔLE LOCAL ; date : 2026-10-11 ; heure exacte non collectée.
- Source : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8` ; lecture documentaire sans base.
- Commande/procédure : `python3 : comparaison normalisée du guide, bash -n, puis assertion des sections CHANGELOG publiées`.
- Statut / code retour : **ÉCHOUÉ / 1**.
- Cas liés : aucun ; contrôle documentaire, hors décompte des 45 cas.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Résultat et limites : Le guide et sa syntaxe passaient ; une ligne vide avait été ajoutée dans une section publiée. Cette modification a été retirée ; contrôle final EXE-012.

## EXE-012 — Guide et changelog préservés

- Type : CONTRÔLE LOCAL ; date : 2026-10-11T00:56:42+02:00.
- Source : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8` ; lecture documentaire sans base.
- Commande/procédure : `python3 /workspace/onboarding-suivi/handover/verifier-guide.py`.
- Statut / code retour : **PASSÉ / 0**.
- Cas liés : aucun ; contrôle documentaire, hors décompte des 45 cas.
- Preuve : [reçu synthétique](preuves/2026-10-11-executions.json).
- Résultat et limites : 64 blocs bash lus de chaque côté ; seules deux familles de commentaires de provenance normalisées. Commandes identiques, bash -n réussi, sections publiées exactement identiques à c704fa6. Guide non exécuté.

## EXE-013 — CI complète

- Type : CI AUTOMATIQUE ; date : 2026-10-11T20:32:14+02:00 → 20:50:34+02:00.
- Version/source : 3.1.0 ; `f9545c3ce1a1338f13bb39bdaa4468bcc907da2d`.
- Environnement : Runners GitHub isolés, PostgreSQL 17, Docker/TLS et Playwright officiel.
- Exécutant : GitHub Actions.
- Commande/procédure : Workflow CI automatique sur main (fusion de la PR #16), tentative 1.
- Statut / code retour : **PASSÉ / 0**.
- Tests : 888 (shared 327, ui 117, api 270, web 17, playwright 157).
- Cas liés : TEST-001, TEST-002, TEST-003, TEST-004, TEST-005, TEST-006, TEST-007, TEST-008, TEST-009, TEST-010, TEST-011, TEST-012, TEST-013, TEST-014, TEST-015, TEST-016, TEST-017, TEST-018, TEST-019, TEST-020, TEST-021, TEST-022, TEST-023, TEST-024, TEST-025, TEST-026, TEST-027, TEST-028, TEST-030, TEST-038, TEST-039, TEST-040, TEST-046, TEST-047, TEST-048, TEST-049, TEST-050.
- Preuve : [exécution GitHub Actions](https://github.com/yousername-ha/suivi-audits/actions/runs/38164228848) ; [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : 888 = 731 Vitest + 157 Playwright ; ne compte pas les contrôles shell/Python de CI. La réussite de la CI complète est rattachée aux cas listés sans relire chaque journal par cas. Pas de recette client.

## EXE-014 — CodeQL

- Type : ANALYSE STATIQUE CI ; date : 2026-10-11T20:32:14+02:00 → 20:34:18+02:00.
- Version/source : 3.1.0 ; `f9545c3ce1a1338f13bb39bdaa4468bcc907da2d`.
- Environnement : Runner GitHub ; JavaScript/TypeScript.
- Exécutant : GitHub Actions.
- Commande/procédure : Workflow CodeQL automatique sur main (fusion de la PR #16), tentative 1.
- Statut / code retour : **PASSÉ / 0**.
- Cas liés : aucun ; analyse statique hors décompte des cas.
- Preuve : [exécution GitHub Actions](https://github.com/yousername-ha/suivi-audits/actions/runs/38164228910) ; [reçu synthétique](preuves/2026-10-11-executions.json).
- Limites : Aucune alerte de gravité ≥ 7 bloquante ; ne remplace ni revue de sécurité ni test d’intrusion.
