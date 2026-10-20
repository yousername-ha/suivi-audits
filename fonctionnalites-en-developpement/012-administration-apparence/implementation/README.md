# Implémentation — Administration et apparence globale

## Proposition du 20 octobre 2026

[Paramètres système et plateforme — v005](PARAMETRES-SYSTEME-PLATEFORME.md) : deux pages à cartes, échelles personnalisables et trois modes de certificat, historique/conservation, messagerie technique et préférences par groupe/profil, à valider. Les notes ci-dessous restent le relevé historique de l’apparence.

## Compatibilité vérifiée le 18 octobre 2026

Le choix global `sage` / `clair` existe déjà dans Claude (`d044eb9`) : `GET/PUT /api/settings/apparence`, lecture via `/api/auth/me`, version/If-Match. Ne pas recréer les endpoints proposés dans l’ancien dossier. Vérifier la permission réelle `parametres:modifier` face à la demande d’accès administrateur exclusif, et la propagation aux sessions actives.

Voir l’[audit de convergence](../../AUDIT-CONVERGENCE.md) et le [prompt courant](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md).

**État : intégration de cette proposition à suivre.** Le déplacement des dossiers n’implémente pas la maquette dans le moteur métier existant.

1. Lire la [maquette courante](../maquettes/v001-reference-08/README.md) et sa fiche de version.
2. Lire le [dossier technique commun](../../_dossiers-transversaux/socle-astra/README.md), ses invariants et l’inventaire des menus.
3. Appliquer uniquement le périmètre demandé pour cette fonctionnalité ; rattacher les éléments visuels aux objets et permissions réels.
4. Exécuter les [contrôles de la fonctionnalité](../tests/README.md), puis documenter le SHA, les changements et les résultats.

L’agent chargé de l’intégration doit travailler et publier exclusivement sur **sa propre branche dédiée**, en utilisant `legacy` comme référence en lecture. Le [prompt commun](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md) conserve cette restriction. Cette réorganisation ne lance aucune intégration, CI, fusion ou mise en production.

La cartographie dynamique reste protégée. Les exemples ANSSI ou fictifs des maquettes ne sont pas des données de production.
