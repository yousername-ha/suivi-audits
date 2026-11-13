# Référentiels, périmètres et couverture

Un **référentiel** couvre un **périmètre** entier. Les tâches récurrentes, actions, écarts, déclarations d'applicabilité et
risques vivent dans ce périmètre ; un onglet dédié gère les référentiels, et le menu Pilotage regroupe toutes les rubriques
ISO 27001 et ISO 9001. Aucun texte de norme sous licence n'est fourni : seuls des intitulés courts et les références sont
repris, les exigences se chargent par import avec leurs droits.

## Bibliothèque

- Référentiels standards sélectionnables d'emblée ; la bibliothèque est **figée** : chaque édition publiée est immuable et ne
  se personnalise pas ([ADR 0031](adr/0031-bibliotheque-de-referentiels.md), [ADR 0082](adr/0082-referentiels-du-perimetre-copie-et-application.md)).
  Une nouvelle édition s'importe comme une nouvelle version immuable.
- Pas de correspondances automatiques entre référentiels : elles sont retirées ([ADR 0089](adr/0089-simplification-du-menu-conformite.md), lot 3).
  Une mesure se relie à la main à chaque exigence qu'elle couvre, dans le référentiel concerné.

## Référentiels d'un périmètre : copie, puis application

1. **Attribuer** un référentiel de la bibliothèque à un périmètre (page Périmètres → « Référentiels ») en crée une **copie
   propre au périmètre**, à l'édition choisie, **en préparation**, nommée « <référentiel> (PRIVE - <périmètre>) ». La
   bibliothèque n'est pas modifiée.
2. **Modifier la copie** librement : ajouter, modifier ou retirer des exigences, créer un domaine, renommer. Chaque
   modification est une version immuable de la copie (historique consultable). La copie garde l'identifiant du référentiel :
   évaluations et mesures reliées suivent chaque exigence par son identifiant.
3. **Appliquer** la copie : elle devient un **référentiel suivi en conformité** (couverture, évaluations, plan
   d'écarts). Elle reste modifiable ; la repasser en préparation la sort du suivi sans rien effacer.
4. **Renommer le périmètre** : l'écran demande s'il faut aussi renommer ses copies avec le nouveau nom ; seules celles qui
   portent encore « (PRIVE - <ancien nom>) » sont concernées.
5. **Reprendre une nouvelle édition** de la bibliothèque remplace le contenu de la copie (statut conservé, adaptations
   gardées dans l'historique).

## Périmètres hiérarchiques

- Un périmètre est une organisation ou un fournisseur ; il peut avoir un parent (par exemple, l'organisation A a pour enfants les organisations B et C et le fournisseur F ; un fournisseur n'a pour enfants que des fournisseurs), sans boucle, profondeur limitée à 8
  ([ADR 0039](adr/0039-hierarchie-des-perimetres.md)).
- **Héritage explicite** : si le périmètre l'a décidé, il suit **la copie de son parent** (contenu et statut), en lecture
  seule ; attribuer le même référentiel chez lui lui donne sa propre copie, qui prime. L'héritage ne concerne que les
  référentiels, jamais les évaluations.
- La fenêtre « Référentiels » montre le périmètre qui porte une copie héritée et permet de la désactiver localement
  (« Désactiver ici »).

## Couverture par exigence

Pour chaque exigence d'un référentiel appliqué et actif du périmètre ([ADR 0041](adr/0041-evaluation-des-exigences-et-couverture.md)) :

1. **Applicabilité** : à déterminer, applicable, exclue (avec justification).
2. **Mise en œuvre** : aucune, partielle, complète.
3. **Test d'efficacité** : date, résultat (conforme ou non), référence.
4. **Validation métier** : date et validateur fixé par le serveur ; réservée au droit `pilotage:administrer`.

État dérivé : non implémenté, partiel, implémenté, testé, validé métier, non applicable. Chaque enregistrement crée une
**version immuable** avec motif obligatoire ; la concurrence est optimiste (`If-Match`). Aucune propagation entre périmètres
ni entre référentiels : une preuve partagée ne rend pas deux exigences également établies.

## Où le voir

Pilotage → Conformité → « Bibliothèque de référentiels » : une carte par référentiel avec la couverture du périmètre affiché (états, clauses obligatoires, mesures reliées) ; « Voir la couverture » ouvre le détail exigence par exigence (filtre, fiche d'évaluation et historique, plan d'action des écarts).
Déclarations d'applicabilité historiques : « Clauses ISO 27001 », « Annexe A », « HDS ».
