# Prompt — 010 Périmètres graphiques

Tu travailles exclusivement sur ta propre branche de codage. Legacy est la source en lecture ; l’environnement et la branche Claude ne doivent jamais être modifiés.

Lis d’abord [les consignes de contrôle de l’existant](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md), puis [le dossier 010](DOSSIER-IMPLEMENTATION.md) et ses références graphiques/techniques.

**Avant toute implémentation, vérifie si chaque exigence 010-xx est déjà implémentée dans ta branche.** Produis le relevé exigence → code/API/permission/test → état → écart → action. Vérifie les fonctionnalités réellement exécutables, pas seulement la documentation. Si conforme et testé : ne réécris rien. Si partiel : complète seulement le manque. Si absent : réutilise d’abord les briques existantes. Si indéterminé : explique l’accès ou la preuve manquante.

Respecte les données et historiques, les règles communes de registres/périmètres, le catalogue partagé, les permissions serveur et la cartographie dynamique protégée. Adapte les interfaces aux contrats réels ; ne transpose pas les fixtures ou le localStorage en backend de production. Les modèles et snapshots historiques doivent être recontrôlés au SHA courant.

Effectue les adaptations autorisées non bloquées, puis les critères de recette du dossier. Signale les contrats/décisions manquants et continue les parties indépendantes. Ne fusionne ni ne déploie automatiquement.

Livre ton relevé d’existant, les changements ou l’absence justifiée de changement, ta branche et ton SHA, les tests exécutés et les limites. Crée un marqueur « implémentation ok » uniquement lorsque le périmètre de cette version est intégré et vérifié, avec les preuves prévues dans les consignes communes.

## Ordre commun

Suivre l’[ordre de codage des dix dossiers](../../_dossiers-transversaux/implementation-ui-2026-10/ORDRE-IMPLEMENTATION.md) et les lots associés à ce numéro. Aucun ancien ordre local ne remplace cette référence. Vérifier les prérequis avant mutation ; continuer les travaux indépendants si un contrat manque.
