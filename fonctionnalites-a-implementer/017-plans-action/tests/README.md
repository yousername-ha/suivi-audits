# Tests — Plans d’action

## Maquette

[Résultats techniques disponibles](../../../references/vues-modules/technique/verification.json). Ils décrivent la capture ou le prototype à la date et sur la version indiquées dans le fichier ; ils ne prouvent pas la recette d’une future intégration.

## À vérifier lors de l’intégration

Vérifier Liste, Kanban, Planning, Calendrier, Gantt et Synthèse sur les mêmes données ; statut, responsable, échéance et interactions clavier.

Suivre aussi la [recette commune](../../../fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/RECETTE.md). Consigner le SHA testé, l’environnement, le résultat et les anomalies dans un nouveau rapport daté. Ne pas remplacer les résultats précédents.

## Validation utilisateur

**Non consignée pour cette version dans cette réorganisation.** Ajouter la décision explicite et sa date dans le `version.json` de la version concernée ; ne pas transformer automatiquement des tests réussis en validation.

Recette de la v002 partagée : [21 contrôles du prototype 021](../../021-registres-ecarts/tests/README.md).

## v003 — 19 octobre 2026

[27 contrôles navigateur réussis](../maquettes/v003-timeline-responsables/technique/verification.json) ; [script](../maquettes/v003-timeline-responsables/technique/verifier.cjs). Filtres, formulaires, affectation typée, synchronisation des vues, bornes mensuelles, texte échappé, défilements et fenêtre mobile. Les sources consultées côté Claude n’ont pas été exécutées. Aucune validation du backend ou des autorisations serveur.

## v004 — 19 octobre 2026

[35 contrôles navigateur réussis](../maquettes/v004-perimetres-herites/technique/verification.json). Absence de saisie de périmètre dans l’action ; héritage à la création et au changement de plan ; modification du plan propagée au filtrage, Kanban et détail ; contrôles existants préservés. Backend non testé.
