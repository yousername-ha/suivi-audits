# Tests — Administration et apparence globale

## Maquette

[Résultats techniques disponibles](../../../references/vues-modules/technique/verification.json). Ils décrivent la capture ou le prototype à la date et sur la version indiquées dans le fichier ; ils ne prouvent pas la recette d’une future intégration.

## À vérifier lors de l’intégration

Vérifier le choix global des deux styles, les droits administrateur, la persistance serveur, les sessions concurrentes et la conservation des cartographies protégées.

Suivre aussi la [recette commune](../../../fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/RECETTE.md). Consigner le SHA testé, l’environnement, le résultat et les anomalies dans un nouveau rapport daté. Ne pas remplacer les résultats précédents.

## Validation utilisateur

**Non consignée pour cette version dans cette réorganisation.** Ajouter la décision explicite et sa date dans `maquettes/v001-reference-08/version.json` ; ne pas transformer automatiquement des tests réussis en validation.

## v002 — 20 octobre 2026

19 contrôles locaux réussis : deux pages, 15 cartes, recherche/état vide, panneaux centraux, validation de rétention, brouillons en mémoire, lien vers 022, menu fixe et mobile. [Résultats](../maquettes/v002-deux-espaces/technique/verification.json) · [Script](../maquettes/v002-deux-espaces/technique/verifier.cjs). Aucun backend testé. Six captures produites ; valeurs fictives.

## v003 — 20 octobre 2026

39 contrôles locaux réussis : création/duplication d’échelles, ajout/retrait/réordonnancement des niveaux, scores, couleurs, suppression confirmée et archivage, conservation des versions publiées, trois modes TLS et contrôles de formulaires. [Résultats](../maquettes/v003-echelles-certificats/technique/verification.json) · [Script](../maquettes/v003-echelles-certificats/technique/verifier.cjs). Lancer depuis la racine du dépôt avec un serveur localhost sur le port 18782 ; variables optionnelles `PREVIEW_URL`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`. Six captures ; aucun backend ni certificat réel testé.

## v004 — 20 octobre 2026

39 contrôles locaux réussis : règles et durées, exclusions, dates invalides, mois calendaires, confirmations, recontrôles après prévisualisation, restauration protégée, délai avant purge, désactivation, mobile et présence des parcours échelles/certificats. [Résultats](../maquettes/v004-historique-conservation/technique/verification.json) · [Script](../maquettes/v004-historique-conservation/technique/verifier.cjs). Depuis la racine du dépôt, servir sur localhost:18782 ; chemins Playwright/Chromium configurables comme en v003. Quatre captures, aucun backend, suppression réelle ou performance testés.

## v005 — 20 octobre 2026

44 contrôles locaux réussis : contact technique, validation mail/OAuth de formulaire, profils serveur, Teams sans appel, notifications métier par groupe/profil, droits, cohérence des dépendances et fichiers partagés, cycles, recontrôle et mobile. [Résultats](../maquettes/v005-notifications-dependances/technique/verification.json) · [Script](../maquettes/v005-notifications-dependances/technique/verifier.cjs). Huit captures ; aucun transport mail/Teams, authentification, backend ou effacement réel testé.

## Journaux et exports v006

[27 contrôles locaux exécutés](../maquettes/v006-journaux-exports/technique/verification.json) : filtres combinés, dates inversées, export vide, téléchargements CSV/JSON/JSONL/LOG et lecture des contenus, protection CSV, séparation du filtre et de la collecte, changement tracé, motif Debug, expiration, conservation des événements, mobile, clavier et absence d’appel externe. Quatre captures. Aucun test du backend, de l’intégrité immuable réelle, des permissions serveur ou du logger de production.

## Échelles partagées — 20 octobre 2026

[21 contrôles locaux](../maquettes/v007-echelles-partagees/technique/verification.json) sur le parcours configuration → publication → sélection dans Risques/EBIOS → historique. Les résultats antérieurs restent attachés à leur version. Aucun test serveur.
