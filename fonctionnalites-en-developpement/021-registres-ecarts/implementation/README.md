# Dossier préparatoire — 021

## Compatibilité vérifiée le 18 octobre 2026

Les maquettes publiées conservent leur comportement historique. Leur réouverture manuelle/automatique d’un écart clos est incompatible avec le socle Claude audité (`d044eb9`), qui conserve la clôture et demande un nouveau constat pour une récidive. La [candidate v003](../maquettes/v003-cloture-preservee/README.md) propose le constat lié et préserve la clôture ; ne pas transposer `recheck()` ou la réouverture dans le frontend natif. Les registres multiples et la création atomique registre + écart doivent être rapprochés des contrats réels, sans nouveau moteur métier.

Voir l’[audit de convergence](../../AUDIT-CONVERGENCE.md) et le [prompt courant](../../_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md).

[Contrat technique, relations, règles et limites](../maquettes/v002-creation-depuis-audit/TECHNIQUE-MAQUETTE.md) · [Parcours de recette](../maquettes/v002-creation-depuis-audit/GUIDE-DE-TEST.md) · [Consignes pour l’IA après validation](../maquettes/v002-creation-depuis-audit/PROMPT-APRES-VALIDATION.md).

Consolider le dossier final uniquement après validation utilisateur. Les API exactes, migrations et droits doivent être confrontés au code de la branche d’intégration avant livraison pour codage. L’IA d’intégration travaille exclusivement sur sa propre branche ; legacy reste sa référence en lecture.

## Dossier courant — 19 octobre 2026

Le registre porte un ou plusieurs périmètres, hérités par ses écarts. La v003 n’en gère qu’un : ne pas prendre cette limite comme règle cible. Ses anciens formulaires d’action avec périmètre indépendant sont remplacés par la règle commune et la référence 017 v004.

[Spécifications, intégration et prompt de codage](../../_dossiers-transversaux/implementation-ui-2026-10/README.md). Cette documentation ne signifie pas que la maquette historique ou le backend ont été modifiés.
