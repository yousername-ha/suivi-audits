# Tests — Tâches récurrentes

## Maquette

[Résultats techniques disponibles](../../../references/vues-modules/technique/verification.json). Ils décrivent la capture ou le prototype à la date et sur la version indiquées dans le fichier ; ils ne prouvent pas la recette d’une future intégration.

## À vérifier lors de l’intégration

Vérifier Liste, Kanban, Planning, Calendrier, fiche et historique ; périodicité, réalisation et preuves, sans créer des occurrences indépendantes à partir des projections.

Suivre aussi la [recette commune](../../_dossiers-transversaux/socle-astra/RECETTE.md). Consigner le SHA testé, l’environnement, le résultat et les anomalies dans un nouveau rapport daté. Ne pas remplacer les résultats précédents.

## Validation utilisateur

**Non consignée pour cette version dans cette réorganisation.** Ajouter la décision explicite et sa date dans `maquettes/v001-reference-08/version.json` ; ne pas transformer automatiquement des tests réussis en validation.

## Candidate v002

[Recette exécutée](../maquettes/v002-timeline-validations/technique/recette.json) · [Script Playwright](../maquettes/v002-timeline-validations/technique/parcours.cjs). Les contrôles couvrent le parcours local et les preuves ; ils ne prouvent ni une authentification réelle ni une immutabilité serveur.

## Candidate v003 — 30 contrôles exécutés

[Consulter](../maquettes/v003-registres-dialogues-centres/technique/recette.json). La recette locale ne prouve pas l’intégration backend.
