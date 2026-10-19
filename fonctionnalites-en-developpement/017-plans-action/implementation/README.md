# Implémentation — Plans d’action

**État : intégration de cette proposition à suivre.** Le déplacement des dossiers n’implémente pas la maquette dans le moteur métier existant.

1. Lire la [maquette courante](../maquettes/v004-perimetres-herites/README.md) et sa fiche de version.
2. Lire le [dossier technique commun](../../_dossiers-transversaux/socle-astra/README.md), ses invariants et l’inventaire des menus.
3. Appliquer uniquement le périmètre demandé pour cette fonctionnalité ; rattacher les éléments visuels aux objets et permissions réels.
4. Exécuter les [contrôles de la fonctionnalité](../tests/README.md), puis documenter le SHA, les changements et les résultats.

L’agent chargé de l’intégration doit travailler et publier exclusivement sur **sa propre branche dédiée**, en utilisant `legacy` comme référence en lecture. Le [prompt commun](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md) conserve cette restriction. Cette réorganisation ne lance aucune intégration, CI, fusion ou mise en production.

La cartographie dynamique reste protégée. Les exemples ANSSI ou fictifs des maquettes ne sont pas des données de production.

Évolution à valider : [plans multiples et liens écarts/conformité](../../021-registres-ecarts/maquettes/v001-registres-lies/TECHNIQUE-MAQUETTE.md). Le dossier final devra intégrer ces règles après décision utilisateur.

[Notes préparatoires v003 : UI, affectations et contrats vérifiés](PLANS-ACTION-V003.md). Dossier final à compléter après validation.

**Instruction courante :** les périmètres sont portés par le plan et hérités par ses actions. Le [dossier transversal](../../../fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10/README.md) remplace sur ce point les notes v003 ; ne pas conserver leur sélection de périmètres dans les fiches d’action.
