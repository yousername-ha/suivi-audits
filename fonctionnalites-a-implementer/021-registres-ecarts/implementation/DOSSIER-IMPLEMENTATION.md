# 021 — Registres d’écarts : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v003-cloture-preservee](../maquettes/v003-cloture-preservee/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 021-01 | Plusieurs registres d’écarts | Créer notamment un registre pour l’audit de surveillance ; sélectionner tous ou certains registres. | Écarts retrouvables dans le registre et via l’audit d’origine. |
| 021-02 | Création depuis un audit et lien réciproque | Créer un écart depuis l’audit, choisir/créer un registre compatible selon les droits, conserver audit → registre → écart. | Une création réussie ne produit qu’un écart ; retour à l’audit et conservation du contexte. |
| 021-03 | Mesure/exigence et plan correctif | Lier l’écart aux exigences/mesures applicables et à des actions dans les plans 017. | Même action visible depuis les deux modules ; sources et périmètres cohérents. |
| 021-04 | Registre multi-périmètres | Périmètres portés par le registre, hérités par les écarts, aucun rattachement indépendant dans la fiche. | Filtres et accès serveur vérifiés ; comptes globaux dédupliqués. |
| 021-05 | Conformité et référentiels | Conserver applicabilité et évaluation propres au contexte ISO 27001/HDS/ISO 9001 ; pas de conformité automatique à la clôture. | Un lien vers une mesure ne vaut pas preuve de satisfaction dans tous les périmètres. |
| 021-06 | Couleurs lisibles | Majeurs rouges, mineurs orange foncé, points sensibles violets, avec texte et légende. | Même classification sur registre, fiche et cartes des périmètres. |
| 021-07 | Clôture préservée | Conserver décision, preuve et vérificateur ; un nouveau fait crée un constat lié, pas une réécriture silencieuse. | Modifier/rouvrir une action liée laisse la clôture passée intacte ; liens aller/retour vers le nouveau constat. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v003-cloture-preservee/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [TECHNIQUE-MAQUETTE.md](../maquettes/v002-creation-depuis-audit/TECHNIQUE-MAQUETTE.md).
- [README.md](../maquettes/v003-cloture-preservee/README.md).

## Architecture et contrats à réutiliser

Réutiliser objets/links/history, services de constats et pages pilotage/Gap de la cible. Audit préalable obligatoire pour registre multiple, création depuis audit et rattachements normatifs. Les champs locaux recurrenceOf, recurrenceReason, closure.actionsSnapshot ne sont pas un schéma API confirmé.

Audits, applicabilité, périmètres, registres, preuves et commandes de clôture existants ; plans 017.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

La maquette v003 illustre un seul périmètre par registre ; la cible en supporte plusieurs selon la règle utilisateur. Les formulaires d’action hérités des anciennes versions ne font pas autorité. La condition fictive toutes actions terminées n’est pas une règle ISO/HDS ; appliquer la validation métier existante.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.
