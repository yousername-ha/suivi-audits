# ADR 0041 — Évaluation des exigences : applicabilité, mise en œuvre, efficacité, validation

**Statut** : proposée le 18/10/2026 (lot H3). Prolonge les [ADR 0031](0031-bibliotheque-de-referentiels.md) (bibliothèque et
couverture par lien) et [0039](0039-hierarchie-des-perimetres.md) (périmètres hiérarchiques).

## Contexte

La couverture d'une exigence se limitait à « une mesure la met en œuvre par un lien » : rien ne distinguait une exigence
applicable d'une exigence exclue, une mise en œuvre partielle d'une mise en œuvre complète, ni une mise en œuvre
déclarée d'une mise en œuvre éprouvée par un test ou validée par le métier. Une preuve partagée entre référentiels pouvait
laisser croire que plusieurs exigences étaient également établies.

## Décision

1. **Quatre dimensions séparées**, saisies par exigence et par périmètre : *applicabilité* (à déterminer, applicable,
   exclue — avec justification), *mise en œuvre* (aucune, partielle, complète), *test d'efficacité* (date, résultat conforme
   ou non conforme, référence de la preuve) et *validation métier* (date, validée par).
2. **Un état de couverture déduit, jamais saisi** : non implémenté, partiellement implémenté, implémenté, testé, validé
   métier ; « non applicable » est à part et sort du total applicable. Un test non conforme ne fait pas passer à « testé ».
3. **Des règles de cohérence** communes à l'application (logique partagée, message à l'écran) et à la base (contraintes
   `CHECK`) : exclure suppose une justification ; le résultat et la date du test vont ensemble ; on ne teste qu'une
   exigence applicable déjà mise en œuvre au moins en partie ; la validation suppose une exigence applicable, complètement
   mise en œuvre, testée conforme, et ne précède pas le test.
4. **Versions immuables** (`grc_requirement_assessments`, déclencheur d'immutabilité) : chaque enregistrement est une
   version complète, jamais un patch, avec un motif ; l'historique d'une exigence est conservé. Concurrence optimiste par
   `If-Match` (version courante, 0 s'il n'y en a pas). Baisser la mise en œuvre oblige à retirer explicitement le test et la
   validation, qui ne « survivent » donc jamais à une régression.
5. **Droits** : évaluer exige `conformite:modifier` et l'accès en écriture au périmètre ; **valider** (décision de pilotage)
   exige en plus `pilotage:administrer`. Chaque version est journalisée (`grc.exigence.evaluated`).
6. **Pas de propagation implicite** : l'évaluation est propre au périmètre et à l'exigence. Ni l'héritage d'un référentiel
   (ADR 0039), ni une correspondance entre référentiels, ni une mesure ou une preuve partagée ne copient un état d'une
   exigence ou d'un périmètre à un autre. Une mise en œuvre déclarée sans mesure reliée est signalée (« aucune mesure
   reliée »), jamais comptée comme preuve.
7. **Le référentiel évalué est celui du rattachement effectif** (propre ou hérité, actif) ; la version du référentiel au
   moment de l'évaluation est conservée avec la version, et l'identifiant de l'exigence assure la continuité d'une version
   de référentiel à l'autre.
8. **Aucun texte normatif** n'est ajouté : les exigences affichées sont celles que l'organisation a déclarées dans la
   bibliothèque.

## Conséquences

- Migration additive 027 ; retour arrière : la table est ignorée par une version antérieure.
- La page « Couverture par référentiel » affiche l'état, l'applicabilité, les mesures et la dernière évaluation, et permet
  d'évaluer une exigence avec son historique. Ces états aident à piloter : ils ne sont ni un taux de conformité ni une
  attestation.
- Suites possibles, non traitées ici : pièces jointes de test liées aux documents, rappel de réévaluation par échéance,
  export de la matrice.
