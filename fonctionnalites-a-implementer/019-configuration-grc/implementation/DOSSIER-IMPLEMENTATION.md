# 019 — Configuration GRC commune : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v001-dossier-arm](../maquettes/v001-dossier-arm/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 019-01 | Paramètres transversaux issus des bases et catégories | Réutiliser les catalogues canoniques de catégories, critères, types, méthodes, échelles et matrices selon le socle. | Une même définition est référencée depuis plusieurs modules sans duplication. |
| 019-02 | Échelles entièrement personnalisables | Créer/dupliquer, nommer, ajouter/retirer/réordonner des niveaux ; libellé, score facultatif selon nature, couleur et description/critère. | Tester niveaux qualitatifs, quantitatifs, erreurs de scores, identifiants stables et doublons. |
| 019-03 | Suppression cohérente | Supprimer uniquement les brouillons sans usage admissible ; archiver les versions publiées avec conservation des références. | Une ancienne évaluation continue à afficher son niveau et son libellé après archivage. |
| 019-04 | Versions et analyse d’impact | Prévisualiser les usages, valider les correspondances, publier une version immuable ; aucune mise à jour silencieuse des études. | Conflit If-Match et niveau référencé retiré gérés sans perte. |
| 019-05 | Échelles partagées avec risques et EBIOS | Sélectionner les versions publiées applicables au contexte ; exclure les brouillons ; références stables par rôle et niveau. | Publication dans paramètres visible dans 002/003 ; cotation historique inchangée. |
| 019-06 | Matrices personnalisables | Axes et cellules référencent les versions et niveaux ; pas de produit automatique des scores ; matrices de pertinence et de risque distinctes. | Passage 4×4 à 5×4 autorisé si configuration valide ; absence de matrice = criticité non calculée. |
| 019-07 | Réutiliser les bibliothèques métier | Fournisseurs, actifs, processus, SR/OV, mesures et preuves sont référencés depuis leurs objets canoniques ; évaluations contextualisées. | Pas de duplication d’une fiche fournisseur ni de publication de données privées avec un modèle. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v001-dossier-arm/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [03-REFERENTIELS-CONFIGURATION.md](../../../fonctionnalites-en-developpement/_dossiers-transversaux/grc-transversal/v001-dossier-arm/03-REFERENTIELS-CONFIGURATION.md).
- [ECHELLES-PLATEFORME.md](../../003-ebios-rm/implementation/ECHELLES-PLATEFORME.md).

## Architecture et contrats à réutiliser

Source consultée 284cb1e : `routes/config-grc.ts`, `shared/src/config-grc.ts`, catalogue `/api/config-grc/items` ; brouillon, preview, publication (previewId/motif/If-Match), usages et archivage. Réauditer le SHA cible. Les collections proposées dans l’analyse ARM historique ne sont pas des créations à exécuter.

Catalogue et contrats existants, permissions de configuration ; 012 fournit le point d’entrée visuel.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

Les échelles observées dans ARM sont des exemples locaux, pas des barèmes ISO/ANSSI. L’export ARM n’établit pas tous les contrats d’une étude complète. Préserver les attributs réels non édités dans les maquettes ; leurs formulaires ne sont pas exhaustifs.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.
