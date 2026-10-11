# Recette de la livraison locale

> Document historique de la livraison 1.0 D/F. Pour le fonctionnement actuel
> (serveur local, comptes, périmètres, parcours, D2 et PCRA), consulter
> [README](../README.md), [architecture de la refonte](REFONTE-LEGACY.md) et
> [recette de la refonte](RECETTE-REFONTE.md). Les anciens résultats ne sont
> pas attribués à la version actuelle.

11 octobre 2026. Profils Chromium isolés, données et pièces **synthétiques**.
Les recettes ne chargent aucun profil ni document de production.

## Résultats

- **22 tests du moteur réussis**, aucun échec : `recette/unit-resultats.tap`.
- **22 parcours navigateur réussis**, aucun échec : `recette/browser-resultats.json`.
- **58 pages legacy** restent accessibles dans le parcours de non-régression.
- Aucune erreur JavaScript et aucune requête HTTP externe automatique pendant
  les parcours surveillés.
- Contrôle responsive à **390, 768, 1440 et 3840 pixels**, thèmes clair/sombre,
  navigation mobile et fiche d’évaluation.
- Syntaxe des six modules JavaScript, du script principal et du lanceur Python
  contrôlée ; scan Gitleaks sans détection dans la copie locale.
- **592 fichiers suivis du dépôt source contrôlés par SHA-256 : aucun modifié**,
  même révision et arbre Git propre : `recette/conservation-source.json`.

Les résultats machine donnent les dates d’exécution et le détail par scénario.
Les captures fournies sont de vraies captures de l’application avec les fixtures
de recette, et pas des maquettes.

## Parcours effectivement exercés

Création d’un dossier CaRE générique à plusieurs périmètres ; objectif local ;
dépôt d’une pièce et SHA-256 ; validation interne ; preuve commune à plusieurs
évaluations ; seconde version sans déplacement automatique des références ;
action ouverte dans le plan legacy ; budgets décimaux et historique.

Campagne HAS avec 118 critères et pagination ; refus d’une non-applicabilité
sans motif ; validation sur preuve ; exports Excel ouverts et comptés ; véritable
PDF produit depuis le rapport. Export JSON depuis le menu legacy avec conservation
du schéma, des mesures et des données D/F.

Export auditeur d’un seul critère avec une seule version physique ; recherche
de marqueurs des dossiers, budgets, actions et versions non autorisés dans le JSON
**et** le HTML exportés. Le **lanceur Python réellement présent dans le ZIP** est
exécuté pour ouvrir le dossier auditeur. Le réseau est ensuite coupé : consultation,
observations, export JSON et PDF restent utilisables. Les liens documentaires
externes ne sont naturellement pas disponibles hors ligne.

Import des observations et décision du responsable sans changement des résultats
internes ; sauvegarde avec deux versions physiques ; restauration dans un profil
neuf et après rechargement ; fichier altéré et dépôt trop volumineux refusés.

Lecture seule et garde d’un événement forcé ; accès aux pages legacy ; navigation
CaRE mobile ; HAS sombre et formulaire étroit ; campagne D1 de dix objectifs,
archivage/réouverture ; import d’une grille synthétique, vérification documentaire
locale, création d’une nouvelle campagne sans changement de l’ancienne version.

## Parcours non exécuté et limites

L’ouverture directe du HTML par **`file://`** est **non exécutée** : la politique
d’administration Chromium du workspace renvoie `ERR_BLOCKED_BY_ADMINISTRATOR`.
Cette restriction n’a pas été contournée. Les parcours sont qualifiés sur le
serveur statique localhost fourni ; le dossier auditeur dispose également de
son lanceur local.

La recette ne constitue pas une validation réglementaire, une recette sur les
serveurs de production, un audit d’authentification serveur ni une garantie de
complétude des publications officielles. Le scan de secrets est un contrôle
de cette copie locale ; il ne prétend pas remplacer un nouvel audit de toutes
les branches GitHub, hors périmètre de cette livraison.

Les principaux problèmes corrigés pendant la recette sont l’accès aux
sous-rubriques sur mobile, la présentation des critères sur petit écran et
l’ordre de fragments des titres HAS dans l’extraction du PDF. Les erreurs de
sélecteurs du banc de recette ont été corrigées ; elles ne sont pas transformées
en succès dans le rapport final. Les anciens fichiers d’échec ne sont pas livrés.
