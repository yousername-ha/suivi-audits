# ADR 0094 — Objectifs, indicateurs et processus : un seul modèle, une fiche par périmètre

**Statut** : acceptée le 13/11/2026 (décision du RSSI du 13/11/2026, BUG-055 de la campagne de recette). Numéro annoncé au RSSI.
Complète l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md) et l'[ADR 0093](0093-declaration-d-applicabilite-par-perimetre.md).

## Contexte

Deux modèles coexistaient : au périmètre commun, les processus, objectifs et indicateurs de l'outil de suivi (mesures, calcul automatique, liens
indicateur → objectif → processus, cartes de processus, champs ISO 9001) ; sous un autre périmètre, des fiches natives du Pilotage, beaucoup plus
pauvres (ni historique de mesures, ni liens, ni cartes). La Synthèse d'un sous-périmètre n'affichait pas les objectifs (C1-10).

## Décision

1. **Un seul modèle : celui de l'outil de suivi** (clés `processes`, `objectives`, `indicators`), disponible dans tous les périmètres.
2. **Chaque ligne porte son périmètre** (`smsi`, conservé dans la colonne `extra` des tables existantes : aucune migration). Une ligne sans
   `smsi` relève du périmètre commun. Les identifiants (`PR1`, `OBJ1`, `IND1`) restent uniques sur toute l'instance.
3. **Mêmes règles partout** : l'accès au périmètre est exigé (404 hors périmètre lisible, écriture en écriture) ; une opération par identifiant sur
   une fiche d'un autre périmètre est refusée (404) ; un indicateur ne cite qu'un objectif, et un objectif ou un indicateur que des processus, du
   même périmètre.
4. **Lecture** : l'état du suivi, la Synthèse et l'export ne servent que les fiches des périmètres lisibles (les administrateurs les lisent toutes).
   Les cartes de processus, les boîtes de pilotage et la préparation de la revue de direction (9.3.2 d4, avec les enfants héritiers) lisent les fiches
   du périmètre demandé. La liste des plans et des incidents suit la même règle.
5. **Les fiches natives** `process`, `objective` et `indicator` ne sont plus proposées à la saisie dans les rubriques Processus, Objectifs et
   Indicateurs ; les fiches déjà saisies restent lisibles par leurs références. Aucune reprise de données : l'instance n'est pas en production.

## Conséquences

- API : `POST|PATCH|DELETE /api/grc/:smsi/pilotage/objectifs/...` acceptent tout périmètre accessible ; `GET .../processus-cartes` et `.../boites`
  répondent pour tout périmètre.
- Pas de rattachement multi-périmètres d'un même objectif : une fiche appartient à un seul périmètre.
- Retour arrière : une version antérieure ignore `smsi` et affiche toutes les lignes au périmètre commun.
