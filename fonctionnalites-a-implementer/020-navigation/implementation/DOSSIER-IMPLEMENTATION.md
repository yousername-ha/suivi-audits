# 020 — Navigation simplifiée : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v001-menu-epure](../maquettes/v001-menu-epure/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 020-01 | Épurer le menu et éviter les doublons | Une destination canonique par objet ; liens contextuels et vues internes pour les autres accès. Aucune suppression sur le seul libellé. | Inventorier les destinations avant/après ; aucune fonction perdue et aucun doublon principal. |
| 020-02 | Conserver le style du menu apprécié | Style 08, icônes colorées, chevrons orientés et sous-menus repliables ; un niveau de familles puis destinations. | États ouvert/fermé/courant, clavier, focus et mobile vérifiés. |
| 020-03 | Menu fixe pendant le défilement | En-tête et menu fixes ; contenu central et listes bornées à défilement indépendant. | Défiler une longue liste sans déplacer le menu ; tester écran étroit. |
| 020-04 | Conserver les deux styles pour tous | Réutiliser le réglage global Sauge/Clair de 012 ; appliquer la même coque et les mêmes composants. | Changement administrateur propagé aux sessions ; aucun choix concurrent par utilisateur. |
| 020-05 | Deux onglets de paramètres | Administration donne accès à Paramètres système et Paramètres plateforme ; les cartes ouvrent leurs détails. | Retrouver journaux techniques, échelles et habilitations depuis les bonnes pages. |
| 020-06 | Protéger la cartographie dynamique | Conserver destination, composants et styles internes du module protégé ; seule la présentation du point d’accès est concernée. | Navigation vers la cartographie et parcours existants inchangés. |
| 020-07 | Préserver favoris, liens et accès | Mapper les anciennes routes en alias autorisés ; conserver filtres et retour aux objets ; aucune permission déduite du menu. | Liens profonds et variantes lecteur/éditeur/admin testés ; 403 serveur conservé. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v001-menu-epure/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [12-NAVIGATION-SIMPLIFIEE.md](../../../fonctionnalites-en-developpement/_dossiers-transversaux/grc-transversal/v001-dossier-arm/12-NAVIGATION-SIMPLIFIEE.md).

## Architecture et contrats à réutiliser

Inspecter le routeur, la coque, le registre de navigation, les préférences et alias de la branche cible. Le relevé historique `modules/navigation-ui.js` ne justifie pas de créer un deuxième routeur si la cible utilise déjà React. Réutiliser composants, capacités et destinations canoniques.

Audit de toutes les routes et capacités existantes ; aucune refonte métier préalable.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

Le style et le périmètre sont approuvés pour préparation au codage. L’ordre précis des familles reste une proposition à présenter si le menu courant diffère ; conserver les accès existants jusqu’à validation de son remplacement. Les nouvelles entrées système/plateforme de 012 remplacent le découpage administratif ancien.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.
