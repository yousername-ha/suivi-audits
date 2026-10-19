# Implémentation — Tâches récurrentes

**État : intégration de cette proposition à suivre.** Le déplacement des dossiers n’implémente pas la maquette dans le moteur métier existant.

1. Lire la [maquette courante](../maquettes/v008-defilement-zones-fixes/README.md) et sa fiche de version.
2. Lire le [dossier technique commun](../../_dossiers-transversaux/socle-astra/README.md), ses invariants et l’inventaire des menus.
3. Appliquer uniquement le périmètre demandé pour cette fonctionnalité ; rattacher les éléments visuels aux objets et permissions réels.
4. Exécuter les [contrôles de la fonctionnalité](../tests/README.md), puis documenter le SHA, les changements et les résultats.

L’agent chargé de l’intégration doit travailler et publier exclusivement sur **sa propre branche dédiée**, en utilisant `legacy` comme référence en lecture. Le [prompt commun](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md) conserve cette restriction. Cette réorganisation ne lance aucune intégration, CI, fusion ou mise en production.

La cartographie dynamique reste protégée. Les exemples ANSSI ou fictifs des maquettes ne sont pas des données de production.

## Contrat complémentaire de la candidate v002

Lire la [note technique de la timeline](../maquettes/v002-timeline-validations/TECHNIQUE-MAQUETTE.md). Le socle Claude `284cb1e` enregistre déjà auteur et date des réalisations historiques ; le contrat OK/KO/NA avec référence de preuve versionnée et conservation non modifiable doit être confirmé ou complété côté métier. Ne pas transposer le stockage navigateur ni créer un moteur parallèle. La validation visuelle de la candidate précède le dossier final de codage.

## Candidate v003 — contrat préparatoire

[Consulter](../maquettes/v003-registres-dialogues-centres/TECHNIQUE-MAQUETTE.md). La recette locale ne prouve pas l’intégration backend.

[Candidate v004 — suivi horizontal](../maquettes/v004-timeline-guides-fixes/TECHNIQUE-MAQUETTE.md).

## Dossier courant — 19 octobre 2026

Les périmètres appartiennent au registre, pas à chaque tâche. Les champs `scope` de la maquette v008 sont historiques ; résoudre le rattachement depuis le registre dans l’intégration, sans réécrire les validations passées.

[Spécifications, intégration et prompt de codage](../../_dossiers-transversaux/implementation-ui-2026-10/README.md). Cette documentation ne signifie pas que la maquette historique ou le backend ont été modifiés.
