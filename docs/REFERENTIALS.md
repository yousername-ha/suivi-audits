# Référentiels, périmètres et couverture

Un **référentiel** couvre un **périmètre** entier. Les tâches récurrentes, actions, écarts, déclarations d'applicabilité et
risques vivent dans ce périmètre ; un onglet dédié gère les référentiels, et le menu Pilotage regroupe toutes les rubriques
ISO 27001 et ISO 9001. Aucun texte de norme sous licence n'est fourni : seuls des intitulés courts et les références sont
repris, les exigences se chargent par import avec leurs droits.

## Bibliothèque

- Référentiels standards sélectionnables d'emblée, **sources verrouillées**, copie personnalisable (ajout de mesures) sans
  alerte rouge ([ADR 0031](adr/0031-bibliotheque-de-referentiels.md)).
- Versions publiées immuables ; un référentiel se rattache à un périmètre.
- Correspondances entre exigences : les propositions automatiques passent par une **revue humaine** (« Rapprochements à
  valider »).

## Périmètres hiérarchiques

- Un périmètre peut avoir un parent : organisation → entité → périmètre, sans boucle, profondeur limitée à 8
  ([ADR 0039](adr/0039-hierarchie-des-perimetres.md)).
- **Héritage explicite** : si le périmètre l'a décidé, il reçoit les référentiels rattachés à son parent ; ses propres
  rattachements priment. L'héritage ne concerne que les référentiels, jamais les évaluations.
- La bibliothèque montre l'origine d'un rattachement hérité et permet de le désactiver localement (« Désactiver ici »).

## Couverture par exigence

Pour chaque exigence d'un référentiel actif du périmètre ([ADR 0041](adr/0041-evaluation-des-exigences-et-couverture.md)) :

1. **Applicabilité** : à déterminer, applicable, exclue (avec justification).
2. **Mise en œuvre** : aucune, partielle, complète.
3. **Test d'efficacité** : date, résultat (conforme ou non), référence.
4. **Validation métier** : date et validateur fixé par le serveur ; réservée au droit `pilotage:administrer`.

État dérivé : non implémenté, partiel, implémenté, testé, validé métier, non applicable. Chaque enregistrement crée une
**version immuable** avec motif obligatoire ; la concurrence est optimiste (`If-Match`). Aucune propagation entre périmètres
ni entre référentiels : une preuve partagée ne rend pas deux exigences également établies.

## Où le voir

Pilotage → Conformité → « Couverture par référentiel » (synthèse des états, filtre, fiche d'évaluation et historique).
Déclarations d'applicabilité historiques : « Clauses ISO 27001 », « Annexe A », « HDS ».
