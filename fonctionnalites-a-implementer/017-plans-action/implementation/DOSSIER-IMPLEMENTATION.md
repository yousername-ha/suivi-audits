# 017 — Plans et registres d’action : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v004-perimetres-herites](../maquettes/v004-perimetres-herites/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 017-01 | Plans contenant des actions, plusieurs registres | Créer plusieurs plans ; les actions viennent d’écarts/autres modules ou sont créées directement. Transversal désigne les origines, pas un type de plan. | Même action et même identifiant retrouvés depuis écart et plan, sans copie. |
| 017-02 | Périmètres sur le registre uniquement | Un ou plusieurs périmètres sur le plan ; héritage affiché en lecture seule sur les actions. | Changement de plan actualise le contexte et recontrôle les droits ; absence de sélecteur indépendant. |
| 017-03 | Style proche des tâches récurrentes | Timeline, Kanban et liste/détail réutilisent coque, filtres et composants 018 ; fenêtres centrales compactes. | Vues synchronisées sur la même collection et les mêmes mutations. |
| 017-04 | Début, fin et quatre statuts | À planifier, En cours, En attente pour blocage, Terminé ; dates et retard distinct du statut. | Action d’un jour, dates vides, fin de mois, incohérence début/fin, blocage et transitions autorisées. |
| 017-05 | Responsable personne, groupe ou fonction | Sélecteur typé sur annuaires existants ; auteur de réalisation distinct et non éditable. | Affectation conservée sans transformer une fonction en personne ; titulaire historique préservé. |
| 017-06 | Suivi horizontal lisible | Intitulés fixes, période défilante, barre début/fin, menu immobile et hauteur bornée. | 100 actions ne produisent pas une page interminable ; clavier et mobile utilisables. |
| 017-07 | Liens correctifs et conformité | Lier actions, écarts, exigences et preuves via objets existants ; terminer une action ne clôture pas automatiquement l’écart. | Écart reste ouvert jusqu’à la décision métier ; conformité ne devient pas automatiquement acquise. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v004-perimetres-herites/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [PLANS-ACTION-V003.md](PLANS-ACTION-V003.md).

## Architecture et contrats à réutiliser

Vérifier `TaskData`, `grc/core.ts`, `grc/tasks.ts`, `Tasks.tsx` et routes objects/links/tasks/window/dashboard. Le snapshot 284cb1e montre ownerId individuel et politique de transitions ; l’affectation personne/groupe/fonction doit être confirmée avant mutation. Plans historiques spécialisés ≠ registre général.

Registres et périmètres hérités, annuaires, commandes d’action, historique et preuves existants ; liens 021.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

Les anciens champs de périmètre dans les fiches et dans PLANS-ACTION-V003 sont remplacés par l’héritage du registre. Les identifiants de statut des fixtures ne sont pas des valeurs à envoyer aveuglément. Dates obligatoires hors planification et motif bloquant : vérifier la politique réelle, ne pas ajouter un refus métier arbitraire.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.
