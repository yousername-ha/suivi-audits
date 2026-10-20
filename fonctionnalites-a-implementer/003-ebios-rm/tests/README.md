# Tests — EBIOS RM

## Maquette

[Résultats techniques disponibles](../maquettes/v001-parcours-anime/technique/verification.json). Ils décrivent la capture ou le prototype à la date et sur la version indiquées dans le fichier ; ils ne prouvent pas la recette d’une future intégration.

## À vérifier lors de l’intégration

Sélection ligne / cellule / partie prenante ; filtres des trois chemins ; flux dans le sens des flèches ; contours renforcés ; pause ; réduction des mouvements ; palette ; navigation des cinq ateliers. Le BAT est contrôlé statiquement, pas exécuté sous Windows.

Suivre aussi la [recette commune](../../../fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/RECETTE.md). Consigner le SHA testé, l’environnement, le résultat et les anomalies dans un nouveau rapport daté. Ne pas remplacer les résultats précédents.

## Validation utilisateur

**Non consignée pour cette version dans cette réorganisation.** Ajouter la décision explicite et sa date dans `maquettes/v001-parcours-anime/version.json` ; ne pas transformer automatiquement des tests réussis en validation.

## Parcours complet contrôlé après réorganisation

[Rapport des 18 étapes](2026-10-14-parcours-complet.json) · [Script reproductible](parcours-complet.cjs).

Lancer un serveur sur `127.0.0.1:8769` dans la maquette courante, puis `node fonctionnalites-a-implementer/003-ebios-rm/tests/parcours-complet.cjs` depuis la racine. Le test utilise un profil Chromium temporaire ; les notes synthétiques ne sont pas livrées.

## Échelles partagées — 20 octobre 2026

[21 contrôles locaux](../maquettes/v002-echelles-plateforme/technique/verification.json) sur le parcours configuration → publication → sélection dans Risques/EBIOS → historique. Les résultats antérieurs restent attachés à leur version. Aucun test serveur.
