# ADR 0082 — Référentiels du périmètre : bibliothèque figée, copie modifiable à l'attribution, application pour le suivi de conformité

- Statut : proposée (demande du RSSI du 05/11/2026 ; décisions de cadrage du même jour ci-dessous). Numéro et migration
  `052` vérifiés libres sur toutes les branches et PR ouvertes le 05/11/2026 ; à confirmer par le RSSI (règle 5 d'AGENTS).
- Date : 2026-11-05
- Rédaction : session « Référentiel library management » (`session_01EnWdzg3B33qs2D5sFE4ywQ`)
- Complète l'[ADR 0031](0031-bibliotheque-de-referentiels.md) (bibliothèque et rattachement) et l'[ADR 0039](0039-hierarchie-des-perimetres.md)
  (héritage explicite) ; remplace le point 2 de l'[ADR 0037](0037-standards-verrouilles-jeu-de-test-et-relations.md)
  (copies personnalisables **dans la bibliothèque**).

## Contexte

Demande du RSSI : « Les référentiels dans la bibliothèque sont immuables et figés. Quand on attribue un référentiel sur un
périmètre, ça devient une copie, que l'utilisateur peut modifier comme il le veut. Quand il choisit d'appliquer le référentiel
sur le périmètre, ça devient un référentiel à suivre en termes de conformité. »

État avant cette décision (lecture du code au commit `1608579`) :

- la bibliothèque mêlait des versions « sources verrouillées » et des « copies de l'organisation » que l'on modifiait **dans la
  bibliothèque** (`POST /api/library/frameworks/:id/copy` et `…/requirements`, ADR 0037) ;
- un périmètre pointait directement vers une édition d'un référentiel de la bibliothèque (`grc_scope_frameworks`), sans
  copie ; tout référentiel rattaché et actif était aussitôt compté dans la conformité (couverture, évaluations,
  rapprochements, plan d'écarts, applicabilité HDS) ;
- les évaluations d'exigences sont immuables (déclencheur `audit_log_immutable`) et désignent le référentiel par son
  identifiant ; les liens et rapprochements désignent une exigence par `requirement:<référentiel>:<édition>:<exigence>`.

Décisions de cadrage du RSSI (05/11/2026, questions posées dans la session) :

1. La copie reste **librement modifiable** une fois appliquée (ajout, modification, retrait d'exigences), avec historique ; les
   évaluations et les mesures suivent l'exigence par son identifiant.
2. Les rattachements existants sont **convertis en copies**, « en faisant attention à l'héritage des périmètres ».
3. Un sous-périmètre qui hérite reçoit **la copie du parent** (lecture seule chez lui, désactivable localement).

## Décision

1. **Bibliothèque figée.** Un référentiel de la bibliothèque n'est plus personnalisé : les routes de copie et d'ajout
   d'exigence dans la bibliothèque sont retirées (404). Les éditions restent immuables ; l'import d'une **nouvelle édition**
   (nouvelle version immuable) reste possible, comme l'import, le kit IA, les standards de l'outil de suivi et la promotion.
   Les anciennes « copies de l'organisation » déjà publiées restent dans la bibliothèque, figées comme le reste.
2. **Attribuer = créer une copie propre au périmètre.** `PUT /api/grc/:smsi/framework-attachments/:id` (droit
   `pilotage:administrer`, comme avant) crée la copie, version 1, identique à l'édition choisie, au statut
   **« en préparation »** (paramètre facultatif `statut`). La copie est nommée **« <référentiel> (PRIVE - <périmètre>) »**
   (décision du RSSI du 05/11/2026 ; `nomCopiePerimetre`, nom du périmètre limité à 100 caractères, l'ensemble à 200) ;
   elle reste renommable. La copie **garde l'identifiant du référentiel de la bibliothèque**
   et l'édition dont elle est issue : elle est rangée par (périmètre, référentiel) dans `grc_framework_copy_versions`. Ainsi
   les références d'exigences, les évaluations, les liens, les rapprochements et les correspondances organisationnelles
   restent valables **sans réécriture**, et une exigence ajoutée dans la copie se désigne comme les autres.
3. **Modifier la copie.** `GET/PUT /api/grc/:smsi/framework-copies/:id`, `POST …/requirements`, `DELETE
   …/requirements/:requirementId` (droit `conformite:modifier` et écriture sur le périmètre ; version de la copie attendue,
   412 sinon) : ajout, modification, retrait d'exigence, nouveau domaine, renommage. Chaque modification publie une **version
   immuable** de la copie (historique consultable) ; l'identifiant du référentiel ne change pas. Une exigence retirée garde
   ses évaluations et liens dans l'historique ; elle n'est plus comptée ni proposée.
4. **Appliquer.** `PUT /api/grc/:smsi/framework-attachments/:id/statut` (`pilotage:administrer`, confirmation `APPLIQUER`) fait
   passer la copie de « en préparation » à « appliqué » ou l'inverse, journalisé (`grc.referentiel.applique`,
   `grc.referentiel.preparation`). Seul un référentiel **actif et appliqué** est suivi en conformité : couverture, évaluation
   (404 sinon), cibles de liens, rapprochements, plan d'écarts, applicabilité HDS, filtre 9001 de la cartographie. Repasser en
   préparation n'efface rien.
5. **Héritage.** Le contenu et le statut viennent de la copie **la plus proche** dans la chaîne d'héritage (le périmètre, sinon
   l'ancêtre qui la porte). Un sous-périmètre lit la copie de son parent, ne la modifie ni ne l'applique (422 / 404), et peut
   la désactiver chez lui (« Désactiver ici » : ligne de surcharge sans copie, `copy_version` NULL). Attribuer le même
   référentiel chez l'enfant lui donne sa **propre** copie, qui l'emporte ; la détacher rend la copie héritée. Détacher la copie
   d'un ancêtre retire les surcharges des héritiers devenues sans effet.
6. **Nouvelle édition de la bibliothèque.** « Reprendre l'édition N » (même route d'attribution, avec l'édition voulue)
   remplace le contenu de la copie par cette édition, statut et nom courant de la copie conservés ; les adaptations restent
   dans l'historique de la copie.
7. **Migration `052`** (additive) : colonnes `status`, `status_by`, `status_at`, `copy_version` de `grc_scope_frameworks`, table
   immuable `grc_framework_copy_versions`. **Conversion** : chaque rattachement existant reçoit sa copie (version 1, identique à
   l'édition rattachée, nommée selon la même règle), statut « appliqué » (il était suivi), **sauf** celui qui reprend, à la même édition, le référentiel
   hérité d'un ancêtre (« Désactiver ici ») : il reste une surcharge qui suit la copie de l'ancêtre. Aucune évaluation, aucun
   lien, aucun rapprochement n'est réécrit.
8. **Assistant « Analyser un service »** et **jeu de démonstration** : choix explicite d'appliquer ; ils créent la copie
   appliquée d'emblée (bouton « Appliquer les référentiels cochés »).

## Conséquences

- Écrans : la Bibliothèque n'offre plus « Créer une copie » ni « Ajouter une exigence » (puce « Figé ») ; la fenêtre
  « Référentiels » d'un périmètre propose « Attribuer », « Modifier la copie » (éditeur par domaine, historique des
  versions), « Appliquer » / « Repasser en préparation », « Reprendre l'édition N », activation et détachement.
- API : le rattachement porte désormais `statut`, `suivi`, `copyVersion`, `requirements`, `libraryName`, `overridden`,
  `orphan` ; `inherited` signifie « copie portée par un ancêtre ». Les routes `POST /api/library/frameworks/:id/copy` et
  `POST /api/library/frameworks/:id/requirements` sont retirées.
- Un appel d'API qui rattachait puis évaluait aussitôt doit désormais appliquer (`statut: 'applique'`), sinon l'évaluation
  répond 404. Les tests concernés ont été adaptés en ce sens, sans réduire leurs assertions.
- Le contrôle des relations (`controle-relations.ts`) connaît les exigences des copies.
- Remise à vide : la table des copies est vidée avec les autres données de travail.
- Retour arrière : restauration de la sauvegarde d'avant mise à jour. Une version antérieure ignorerait les copies (elle lirait
  l'édition de la bibliothèque) et compterait les copies en préparation comme suivies.
- Le nom de la copie reprend le nom du périmètre au moment de l'attribution : renommer ensuite le périmètre ne renomme pas
  ses copies (elles se renomment à la main).
- Limites : la reprise d'une nouvelle édition **remplace** la copie (aucune fusion automatique des adaptations) ; les
  correspondances de l'organisation restent rédigées entre éditions de la bibliothèque et ne visent pas une exigence ajoutée
  dans une copie ; aucun taux de conformité n'est calculé ni inventé.
