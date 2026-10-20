# Implémentation — EBIOS RM

**État : intégration de cette proposition à suivre.** Le déplacement des dossiers n’implémente pas la maquette dans le moteur métier existant.

1. Lire la [maquette courante](../maquettes/v002-echelles-plateforme/README.md) et sa fiche de version.
2. Lire le [dossier technique commun](../../_dossiers-transversaux/socle-astra/README.md), ses invariants et l’inventaire des menus.
3. Appliquer uniquement le périmètre demandé pour cette fonctionnalité ; rattacher les éléments visuels aux objets et permissions réels.
4. Exécuter les [contrôles de la fonctionnalité](../tests/README.md), puis documenter le SHA, les changements et les résultats.

L’agent chargé de l’intégration doit travailler et publier exclusivement sur **sa propre branche dédiée**, en utilisant `legacy` comme référence en lecture. Le [prompt commun](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md) conserve cette restriction. Cette réorganisation ne lance aucune intégration, CI, fusion ou mise en production.

La cartographie dynamique reste protégée. Les exemples ANSSI ou fictifs des maquettes ne sont pas des données de production.

## Socle transversal — 14 octobre 2026

Lire également [le dossier GRC fondé sur l’export ARM](../../_dossiers-transversaux/grc-transversal/v001-dossier-arm/README.md) pour les registres, configurations, méthodes, migrations et parcours. Cette proposition complète les spécifications visuelles sans annoncer une intégration réalisée.

Complément courant : [Échelles communes — contrats et limites](ECHELLES-PLATEFORME.md).
