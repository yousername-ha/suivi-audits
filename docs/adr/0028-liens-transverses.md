# ADR 0028 — Liens transverses : catalogue des relations autorisées, sens explicite

**Statut** : proposée le 11/10/2026 (lot U4 du [plan d'unification](../unification/PLAN-EVOLUTION.md)). Complète
l'[ADR 0023](0023-smsi-referentiels-taches-risques.md) (table `grc_links`) et l'[ADR 0027](0027-risques-ebios-rm-iso27005.md).

## Contexte

Les relations entre objets du pilotage (`grc_links`) existent déjà : bidirectionnelles à la lecture, filtrées selon les
droits, journalisées. L'audit L1 relève trois faiblesses : n'importe quel type de relation est accepté entre n'importe
quels objets (« un risque traite une preuve »), le panneau n'indique pas le sens de lecture, et un objet archivé ou une
donnée de l'outil de suivi peut être relié depuis un périmètre privé. La liste des responsables proposés contient aussi
des comptes qui ne peuvent pas consulter le pilotage (écran mural, documents seuls).

## Décision

1. **Catalogue unique** dans `packages/shared/src/liens.ts` (`RELATIONS`) : pour chaque type de relation, libellé,
   libellé inverse, types d'objets admis comme source et comme cible. « Lié à » reste ouvert à toute paire.
2. **Contrôle serveur** à la création d'un lien saisi (`POST /api/grc/:smsi/links`) : paire hors catalogue,
   objet archivé ou référence `legacy:` hors du périmètre de l'organisation sont refusés (422, message en français).
   Les liens créés par le serveur lui-même (action issue d'un traitement ou d'une décision, occurrence récurrente)
   gardent leurs règles ; les liens déjà enregistrés restent lisibles et supprimables : aucun n'est réécrit.
3. **Sens explicite** : la lecture des liens d'un objet indique `sens` (`sortant` ou `entrant`) et `archived` pour
   l'autre objet ; l'interface affiche « Traite » ou « Est traité par » selon le côté consulté.
4. **Responsables proposés** (`GET /api/grc/:smsi/owners`) : comptes actifs du périmètre détenant au moins une lecture
   parmi `pilotage`, `ecarts`, `audit`, `plan_audit`, `conformite`. Le contrôle à l'enregistrement (`checkOwner`) n'est
   pas durci, pour ne pas bloquer la modification des fiches existantes ; un durcissement éventuel passera par une
   reprise des responsables.
5. **Ni migration ni dépendance**. Retour arrière : une version antérieure ignore simplement le catalogue.

## Conséquences

- Une intégration qui créait des relations typées incohérentes par l'API reçoit désormais 422 ; « Lié à » reste
  disponible.
- Le catalogue est testé (`packages/shared/test/liens.test.ts`, `apps/api/test/liens.test.ts`) ; toute évolution du
  schéma `LinkBody` doit s'accompagner de celle du catalogue (test d'égalité).
