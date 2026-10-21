# Intégration, limites et recette

## Sources techniques vérifiées et portée

Référence de lecture : [arbre Claude 284cb1e](https://github.com/yousername-ha/suivi-audits/tree/284cb1e4ffbaee37e0952073db5659c2257c888e), copie consultée en lecture seule. Réauditer le SHA effectif avant codage ; ce dossier ne prétend pas décrire le dernier état distant. L’[audit du 18 octobre](../../../fonctionnalites-en-developpement/AUDIT-CONVERGENCE.md) est une référence historique, pas une preuve de fraîcheur. En particulier son ancien constat d’absence de `parentId` est dépassé par l’instantané 284cb1e.

| Source dans l’arbre consulté | Élément constaté | Conséquence |
| --- | --- | --- |
| `packages/shared/src/grc.ts`, `TaskData` | `ownerId`, `startAt`, `dueAt`, statut, justification, dépendances ; schéma strict | Réutiliser les actions ; pas de nouveaux champs envoyés sans contrat |
| `apps/api/src/grc/core.ts` | Politique publiée, transitions, validation d’auteur affecté, justification de clôture, dépendances | La maquette ne dicte pas les identifiants d’état ni les autorisations |
| `apps/api/src/routes/grc.ts` | Routes d’objets, liens, historique, tâches, occurrences et périmètres | Réutiliser services/clients existants après contrôle des capacités |
| `packages/shared/src/grc.ts`, `SmsiCreate/Update` | `parentId`, `inheritFrameworks` | Raccorder 010 au modèle existant, sans créer une hiérarchie parallèle |
| `packages/shared/src/hierarchie-perimetres.ts` | Hiérarchie et héritage des référentiels | Ne pas confondre cet héritage avec le rattachement registre → éléments |
| `apps/web/src/grc/Tasks.tsx`, `pilotage/Perimetres.tsx`, `pilotage/Gap.tsx` | Points d’intégration frontend existants | Adapter après examen des composants et des styles actuels |

Routes constatées dans `routes/grc.ts` : `/api/grc/smsis`, `/api/grc/smsis/:smsi`, `/api/grc/:smsi/objects`, `/api/grc/:smsi/objects/:id`, `/api/grc/:smsi/objects/:id/history`, `/api/grc/:smsi/links`, `/api/grc/:smsi/tasks`, `/api/grc/:smsi/tasks/window`, `/api/grc/:smsi/tasks/dashboard`, `/api/grc/:smsi/series/:id/occurrences`. Vérifier méthodes, corps, pagination et contrôles sur la cible. La présence de `:smsi` ne prouve pas un contrat de registre multi-périmètre.

Aucun test, build ni générateur n’a été exécuté dans Claude. Ne jamais changer sa branche, ses fichiers, références, index ou configuration. Aucun rapprochement par fusion globale.

## Contrats restant à vérifier ou à faire compléter

| Besoin utilisateur | État de la preuve | Action de l’implémenteur |
| --- | --- | --- |
| Registres multi-périmètres et héritage des éléments | Exigence confirmée, contrat serveur complet non démontré par cet instantané | Identifier le registre existant, ses liens, la projection d’accès et les commandes ; transmettre au métier les champs/commandes manquants |
| Responsable personne/groupe/fonction | `TaskData.ownerId` individuel vérifié ; groupe/fonction non confirmés | Contrat d’affectation typée et résolution des annuaires ; ne pas détourner un UUID utilisateur |
| OK/KO/NA immuable avec preuve | Parcours illustré ; contrat de validation complète à confirmer | Commande idempotente, auteur session, heure serveur, référence de preuve/version, historique |
| Configuration des récurrences, fenêtres et calendriers iCal | Maquettes explicites ; raccordement complet non vérifié | Réutiliser moteur et importeurs existants, formaliser seulement les manques |
| Déplacement d’un élément et modification des périmètres d’un registre | Résolution locale illustrée dans 017 v004 | Contrôler liens, droits, concurrence et conservation du contexte historique côté serveur |
| Audit → registre → écart | Parcours de maquette existant ; multi-périmètre à rapprocher du métier | Contrôler compatibilité et atomicité, ne pas copier une mutation locale en production |

Ne pas inventer une API pour combler ces cases. Poursuivre les travaux frontend indépendants, documenter précisément les dépendances et demander à l’agent métier les compléments nécessaires. Le choix de projection d’un registre multi-périmètre pour un utilisateur partiellement autorisé doit être défini par le serveur ; aucun choix d’union/intersection des droits ne doit être fait silencieusement par le frontend.

## Architecture frontend attendue

- Coque et registre de navigation uniques : routes canoniques, capacités, alias historiques, contexte retour ; pas de navigation dupliquée dans chaque module.
- Un adaptateur de lecture du registre expose les périmètres effectifs à toutes les vues. Le nom du composant peut être `InheritedScopeSummary` ; c’est une proposition de présentation, pas un nouveau modèle métier.
- Sélection de registres, recherche et filtres communs ; stockage URL des filtres et sélection si compatible avec la navigation existante. Retour depuis un objet lié restaure le contexte.
- Vues Timeline/Kanban/Liste sur les mêmes identifiants, requêtes et mutations. Aucun tableau secondaire pour une autre vue. Invalidation des requêtes dérivées après modification d’un registre.
- Formulaires construits sur les schémas existants ; afficher les transitions autorisées. Responsable et auteur d’opération sont distincts. Bloquer la double soumission ; garder le brouillon en cas d’erreur.
- Chargement, vide, erreur, refus d’accès, conflit de version, registre archivé, référence supprimée/inaccessible et données hors période doivent avoir des états explicites.
- Échapper le contenu utilisateur ; pièces jointes servies selon les droits, aucune URL secrète ou identifiant privé dans les captures. Pas d’import de fichiers HTML de maquette ni de styles globaux dans le module cartographique protégé.

## Données existantes et migration

Avant toute migration, inventorier les champs portés par les éléments, les rattachements existants et leurs divergences. Ne pas supprimer des valeurs anciennes par une migration automatique supposée évidente. Préparer un rapport : registre, périmètres du registre, périmètres des éléments, liens et décisions historiques affectés. Définir avec le métier la reprise et la traçabilité des cas incohérents ; tester transaction, reprise sur erreur et retour arrière dans l’environnement de codage.

Les anciens champs de périmètre peuvent représenter du contexte historique : ne pas les effacer sous prétexte qu’ils disparaissent de la saisie courante. Aucune migration n’est livrée par ce dossier, qui n’accède pas à la base utilisateur.

## Ordre d’intégration et conditions de passage

La référence unique est l’[ordre des dix dossiers — L0 à L11](ORDRE-IMPLEMENTATION.md), mis à jour le 21 octobre 2026. Il remplace les anciennes séquences L0–L8. Vérifier et tester les fonctions existantes avant toute modification ; aucune reconstruction globale ni modification de Claude.

Les scénarios R01–R18 ci-dessous couvrent les parcours transversaux historiques. Les compléter par les critères identifiés dans chacun des dix dossiers, notamment paramètres 012, configuration 019, droits 022, risques 002 et EBIOS 003. Ce tableau est une recette à exécuter, pas un ordre de codage ni un compte rendu de réussite.

## Recette minimale de l’implémentation

| ID | Scénario | Résultat attendu |
| --- | --- | --- |
| R01 | Créer un registre sur A et B, puis un élément | A/B hérités, aucun sélecteur dans l’élément ; répéter pour actions, écarts et tâches |
| R02 | Filtrer sur B avec plusieurs registres sélectionnés | Registres autorisés concernés et leurs éléments, sans duplication |
| R03 | Déplacer un élément d’un registre A/B vers C | Aperçu du contexte, commande autorisée, même ID, vues et filtre actualisés ; liens incompatibles signalés |
| R04 | Modifier les périmètres d’un registre contenant des éléments | Impact explicite, droits/versions contrôlés, actualisation atomique ; historique de validation inchangé |
| R05 | Utilisateur autorisé seulement sur A d’un registre A/B | Projection conforme à la politique serveur, aucune fuite de données B ni mutation interdite |
| R06 | Ancien lien/favori et accès contextuel depuis audit | Destination canonique conservée, contexte retour/filtres et droits identiques |
| R07 | Timeline avec dates absentes, un jour, deux mois, début après fin | Pas de durée fictive ; limites visibles ; erreur compréhensible pour dates invalides |
| R08 | En attente puis terminé ; personne/groupe/fonction | Motif et transitions serveur respectés, affectation correcte, auteur authentifié distinct |
| R09 | Créer un écart depuis un audit et une action liée | Origines et registre conservés, aucune clôture/conformité automatique |
| R10 | Récidive après clôture d’un écart | Nouveau constat lié ; clôture antérieure intacte |
| R11 | Fenêtre de tâche ouverte/fermée, jours exclus et conflit | Disponibilité déterminée par moteur réel ; superpositions masquées sans changement des règles |
| R12 | Import iCal valide, incorrect, répété ou source indisponible | Prévisualisation/erreur, pas de doublon silencieux ni calendrier effacé en cas d’échec |
| R13 | OK/KO/NA, preuve, double-clic et panne réseau | Une validation, identité/heure serveur, preuve retrouvable selon droits ; pas de passage au suivant en cas d’échec |
| R14 | Liste avec enchaînement automatique | Prochaine occurrence éligible ; résultat précédent figé ; KO reste réalisé |
| R15 | Menu et contenu long, écran 390 px, clavier, deux thèmes | Coque fixe, défilements séparés, focus visible, fenêtre centrale contenue et fermeture accessible |
| R16 | Création de périmètre depuis liste et depuis graphe | Même identifiant et présence dans tous les sélecteurs ; fournisseur reste externe |
| R17 | Action récurrente et autres compteurs sur carte | Pas de double comptage ; périmètres, statuts terminaux et objets archivés traités selon métier |
| R18 | Régression de la cartographie dynamique | Routes, composants, interactions et apparence interne inchangés |

Exécuter les commandes build, typage, lint et tests définies dans le dépôt cible, puis les tests de parcours pertinents dans la branche de codage. Ne pas inventer de commande ni lancer les tests dans l’environnement Claude. Consigner SHA, commandes, résultats et limites. Les 35 contrôles de 017 v004 attestent seulement le prototype local ; R01–R18 sont des tests à exécuter sur l’intégration réelle, pas des résultats acquis.
