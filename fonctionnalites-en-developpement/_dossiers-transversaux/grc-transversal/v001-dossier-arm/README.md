# Dossier d’implémentation — socle GRC transversal

> **Analyse historique, à rapprocher du socle courant.** Lire le [prompt actualisé](PROMPT-IMPLEMENTATION.md) et l’[audit de convergence](../../../AUDIT-CONVERGENCE.md). Les collections et API proposées ici ne sont pas à reconstruire lorsqu’elles existent dans Claude.

Version 1 • 14 octobre 2026 • **Spécification proposée, intégration non réalisée, validation métier à obtenir.**

Ce dossier traduit l’analyse de l’export ARM et du code legacy en une refonte progressive de l’application existante. Il est destiné à une IA qui code. Les maquettes décrivent la cible ; elles ne prouvent pas l’existence des fonctions dans l’application.

## Commencer

1. Lire [le diagnostic](01-DIAGNOSTIC.md) et [l’analyse ARM](02-EXPORT-ARM.md).
2. Étudier [les registres et configurations](03-REFERENTIELS-CONFIGURATION.md), [l’architecture](04-ARCHITECTURE.md), [les contrats](05-CONTRATS-DONNEES.md) et [les parcours](06-PARCOURS-METHODES.md).
3. Ouvrir [la galerie graphique](graphiques/index.html), ou les [captures](graphiques/README.md), puis lire [les spécifications UX](07-UX-GRAPHIQUE.md).
4. Suivre [la migration](08-IMPORT-MIGRATION.md), [les lots techniques](09-PLAN-IMPLEMENTATION.md), [la recette](10-RECETTE.md) [les décisions](11-DECISIONS-SOURCES.md) et [la navigation simplifiée issue de la vidéo](12-NAVIGATION-SIMPLIFIEE.md).
5. Donner à l’IA [le prompt d’exécution](PROMPT-IMPLEMENTATION.md). Elle travaille exclusivement sur sa propre branche, depuis `origin/legacy` en lecture.

## Périmètre et preuves

Code audité : `472a81fe315ac323d75a59db74e16b8d39a5b0e8`, branche `legacy`. L’audit porte sur le code suivi par Git, pas sur une base de production. L’export contient 25 fichiers, dont 21 classeurs, 3 images et un cache système. Il documente les ateliers 1 et 2, pas une étude complète ni un schéma de base de données.

Les qualifications **observé**, **déduit** et **proposé** sont distinctes. Les données métier réelles, les fichiers sources et les images ARM ne sont pas publiés. Le dossier public conserve les structures, les comptes, les règles visibles et des illustrations fictives.

Livrables machine : [inventaire des 25 fichiers](annexes/inventaire-export.csv), [colonnes des 21 classeurs](annexes/colonnes-export.json), [échelles observées](annexes/echelles-observees.json), [matrice de pertinence](annexes/matrice-pertinence.json), [schéma de contrat](contrats/bundle.schema.json), [exemple synthétique](contrats/bundle-exemple.json), [traçabilité des exigences](annexes/exigences.csv), [vérifications du dossier](VERIFICATIONS.json).

Les normes ne sont pas réécrites. Le guide officiel ANSSI est cité dans le dossier ; les barèmes ARM restent des configurations locales. Le texte intégral ISO/IEC 27005 n’a pas été audité ici.

## Navigation simplifiée ajoutée après la vidéo

Sept familles métier et Administration séparée ; doublons confirmés, correspondances de routes et conservation des fonctions dans [le chapitre 12](12-NAVIGATION-SIMPLIFIEE.md). [Arborescence JSON](annexes/navigation-cible.json) · [Correspondances CSV](annexes/navigation-correspondances.csv).

## Lecture et ouverture locale

[PDF technique complet](Dossier-technique-GRC.pdf) · [PDF des dix vues](graphiques/Vues-graphiques-GRC.pdf) · [Aperçu de la navigation](graphiques/navigation-risques.png). Extraire le ZIP complet ; ouvrir `graphiques/DEMARRER.bat` sous Windows ou `graphiques/index.html` dans un navigateur.
