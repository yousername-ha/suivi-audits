# Plan de mise en œuvre priorisé et points à arbitrer

Principe : chaque lot est livrable seul, additif, testé, et laisse l'existant intact. L'ordre suit la priorité du cahier
(transversalité d'abord).

## 1. Lots

| Lot | Contenu | Statut |
| --- | --- | --- |
| I0 | Diagnostic, analyse de l'archive, architecture cible, ADR 0038 ([01](01-DIAGNOSTIC.md) à [04](04-MODELE-DE-DONNEES.md)) | livré |
| I1 | Schémas partagés du catalogue (`config-grc.ts`) : échelles, matrices, correspondances, critères, taxonomies ; fonctions pures (validation, évaluation, diff, correspondance), modèle de pertinence | livré, 25 tests |
| I2 | Migration 021, service et routes `/api/config-grc/*` (cycle de vie, usages, impact, dérivation, modèles), droits réutilisés, temps réel | livré, 23 tests |
| I3 | Épinglage des échelles et matrices par les méthodes de risque (`bindings`), résolution figée à la publication, usages `method_version` | livré, 6 tests partagés + 7 API |
| I4 | **Interface** Paramètres → Configuration GRC (échelles, matrices, correspondances, critères, taxonomies : liste, éditeur guidé, versions, dépendances, dérivation, archivage, adoption de modèle) ; entrée Gestion des risques → Configuration des analyses (mêmes services) | à faire |
| I5 | Composants mutualisés (`SelecteurObjet`, périmètre, responsable, fournisseur, `SelecteurNiveau`, `MatriceEvaluation`, `Justification`) et remplacement progressif des champs libres listés dans [01](01-DIAGNOSTIC.md) § 5 | à faire |
| I6 | Liaison de configuration d'une analyse, usages `analysis`, migration explicite avec étude d'impact | à faire |
| I7 | Ateliers EBIOS RM sur le catalogue : gravité proposée (maximum par correspondance), pertinence proposée (matrice), critères à échelle propre, impacts catégorie × niveau, lien fournisseur sur les parties prenantes, socle de sécurité sélectionnable | à faire |
| I8 | Méthode ISO/IEC 27005 configurable (modèle « inspiré de »), éditeur de méthodes personnalisées, `objects` et `deliverables`, méthodes partagées | à faire |
| I9 | Documentation d'exploitation, recette, captures, validation globale | à faire |

Ordre de priorité des ateliers (I7) : 1 puis 2 (couverts par l'archive d'exemple), puis 3, 4, 5 sans extrapoler : l'archive ne
contient pas les ateliers 3 à 5 ([02](02-ANALYSE-EXPORT-ARM.md) § 4).

## 2. Tests et vérifications

| Niveau | Livré | À ajouter |
| --- | --- | --- |
| Unitaires partagés | `config-grc.test.ts`, `method-bindings.test.ts` | sélecteurs, migration d'analyse |
| API (PostgreSQL réel) | `config-grc.test.ts`, `config-grc-methods.test.ts`, migrations, schéma Drizzle, cartographie des routes | liaison d'analyse, migration |
| Web | — | pages de configuration, sélecteurs, contrôle de charte (pas de style en ligne) |
| Bout en bout | — | parcours : adopter le modèle de pertinence, éditer une échelle, publier, épingler à une méthode, créer une analyse |
| Non-régression | état historique, environnement, méthodes publiées inchangés | études existantes sans liaison |

## 3. Points à arbitrer

| N° | Question | Recommandation |
| --- | --- | --- |
| 1 | Introduire un concept d'organisation / d'entité, ou garder « organisation = instance » ? | garder l'instance tant que l'hébergement multi-organisation n'est pas un objectif ; ajouter plus tard une portée `organisation` à la liste extensible |
| 2 | Réutiliser `parametres:*` et `pilotage:administrer`, ou créer une permission dédiée à la configuration GRC ? | réutiliser (aucun élargissement de droit) ; une permission dédiée exige une analyse d'impact sur les rôles |
| 3 | Provenance et validation des modèles EBIOS RM livrés (seul le lot de pertinence existe) | faire valider chaque lot à la source (guide de l'ANSSI) avant d'en proposer d'autres |
| 4 | Sources des catalogues de menaces et de vulnérabilités pour ISO/IEC 27005 | aucun texte normatif reproduit ; catalogue organisationnel alimenté par l'utilisateur |
| 5 | Études existantes : échelle d'origine implicite, ou conversion vers le catalogue ? | échelle d'origine ; conversion uniquement par migration explicite (I6) |
| 6 | Une méthode épinglée n'est pas relisible par une version antérieure de l'application | opt-in ; publier après mise à jour de tous les serveurs |
| 7 | Applications, sites, systèmes : nouveaux types d'objets du registre ? | oui, en lot séparé (I5), car aujourd'hui ils sont des textes libres |
| 8 | Où vivent les « bases » de sources de risque, d'objectifs visés et de parties prenantes, et la sélection par étude ? | taxonomies du catalogue + sélection portée par l'étude (I7) |
| 9 | Nombre de niveaux de la matrice de pertinence et libellés | à confirmer par l'utilisateur ; le modèle livré reprend la grille 3 × 3 du cahier, à valider |
| 10 | Ancienne interface : suppression, une fois 16 pages sur 24 portées | décision de l'utilisateur (hors de cette refonte) |
