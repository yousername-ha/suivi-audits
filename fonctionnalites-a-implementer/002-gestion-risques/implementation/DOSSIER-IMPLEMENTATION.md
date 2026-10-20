# 002 — Gestion des risques : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v001-matrice](../maquettes/v001-matrice/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 002-01 | Registre central des risques | Réutiliser risques, études liées, évaluations, traitements et décisions ; filtrer sans duplication. | Un risque conserve son ID et ses liens entre registre, étude et matrice. |
| 002-02 | Liaison à l’Annexe A ISO 27001:2022 | Rattacher mesures/contrôles via liens typés et contexte applicable ; version 2022 confirmée par l’utilisateur. | Naviguer dans les deux sens ; lien ne vaut pas conformité ni réduction automatique du risque. |
| 002-03 | Matrice selon référence visuelle | Cellules pleines vert/jaune/orange/rouge selon politique, titres axes, niveaux, compteurs, références et sélection au contour bleu. | Sélection vide, plusieurs risques, lien au registre et réinitialisation testés. |
| 002-04 | Échelles de la plateforme | Sélectionner versions publiées, niveaux, critères, couleurs ; nombre dynamique ; matrice compatible. | Modifier/publication d’une échelle ne réécrit pas les cotations passées ; pas de barème local. |
| 002-05 | Traitement et suivi | Réutiliser actions/mesures/preuves et décisions existantes ; origine du traitement visible. | Action terminée ou étude archivée ne recalcule ni ne supprime l’évaluation historique. |
| 002-06 | Respect de la cartographie protégée | Matrice du registre et scénarios EBIOS sont distincts de la cartographie dynamique du module cartographique. | Aucun changement interne de ce module ni CSS global qui l’altère. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v001-matrice/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [ECHELLES-PLATEFORME.md](../../003-ebios-rm/implementation/ECHELLES-PLATEFORME.md).
- [README.md](../maquettes/v001-matrice/README.md).

## Architecture et contrats à réutiliser

Routes constatées dans grc.ts : risks/register, risks/:id/preview, evaluate, evaluations, risk-studies/:id et risk-map ; services grc/risks.ts et registre-risques.ts, schémas partagés. Conserver distinction objet risque, évaluation immuable et décision. Le socle peut déjà remplir ces exigences : vérifier les usages et tests avant adaptation.

Catalogue 019 et échelles 012 ; objets risques, évaluations, mesures Annexe A, preuves et plans existants.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

La matrice 4×4 est la référence visuelle de démonstration, pas une taille métier obligatoire. Les captures ne prouvent pas un module serveur livré. Politique de criticité, agrégation et résiduel doivent rester celles du moteur existant ; ne pas substituer une multiplication frontend.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.
