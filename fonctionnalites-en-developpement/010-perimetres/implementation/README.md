# Implémentation — Périmètres

## Compatibilité vérifiée le 18 octobre 2026

Le contrat Claude audité (`d044eb9`) fournit les périmètres et les rattachements de référentiels, mais aucun parent/enfant ni héritage. Le brouillon d’organigramme reste une simulation à valider. Ne pas ajouter `parentId` ou `cascade` au corps strict de l’API. Préparer le contrat de hiérarchie, droits des descendants et règles d’héritage avec le responsable métier avant raccordement.

Voir l’[audit de convergence](../../AUDIT-CONVERGENCE.md) et le [prompt courant](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md).

**État : intégration de cette proposition à suivre.** Le déplacement des dossiers n’implémente pas la maquette dans le moteur métier existant.

1. Lire la [maquette courante](../maquettes/v001-reference-08/README.md) et sa fiche de version.
2. Lire le [dossier technique commun](../../_dossiers-transversaux/socle-astra/README.md), ses invariants et l’inventaire des menus.
3. Appliquer uniquement le périmètre demandé pour cette fonctionnalité ; rattacher les éléments visuels aux objets et permissions réels.
4. Exécuter les [contrôles de la fonctionnalité](../tests/README.md), puis documenter le SHA, les changements et les résultats.

L’agent chargé de l’intégration doit travailler et publier exclusivement sur **sa propre branche dédiée**, en utilisant `legacy` comme référence en lecture. Le [prompt commun](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md) conserve cette restriction. Cette réorganisation ne lance aucune intégration, CI, fusion ou mise en production.

La cartographie dynamique reste protégée. Les exemples ANSSI ou fictifs des maquettes ne sont pas des données de production.
