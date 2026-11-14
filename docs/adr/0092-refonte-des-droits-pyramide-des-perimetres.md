# ADR 0092 — Refonte des droits : trois profils et pyramide des périmètres

- Statut : **acceptée** (décisions du RSSI du 13/11/2026). Lot 1 livré ; lot 2 livré côté serveur (écran du contributeur à faire) ; lot 3 décidé, non livré
- Date : 2026-11-13
- Rédaction : session « Refonte des droits d'accès » (`session_01EnWdzeZgHxzTs1KxQ6ja6Z`)
- Amende le point 4 de l'[ADR 0039](0039-hierarchie-des-perimetres.md) (« droits et membres ne se propagent pas »), pour les seuls membres.
  Amende aussi les [ADR 0043](0043-registres-perimetres-herites-et-droits-par-ressource.md) et
  [0067](0067-attribution-des-droits-par-ressource-reservee.md) (lot 2 : « Attribuer à » vaut rôle de contributeur). L'[ADR 0010](0010-droits-rbac.md)
  reste en vigueur jusqu'au lot 3.

## Contexte

Les droits s'empilent aujourd'hui sur trois étages : des rôles globaux (matrice module × action, cinq rôles prédéfinis, rôles
personnalisés, groupes : ADR 0010), l'appartenance à un périmètre (lecture ou écriture, sans effet sur les périmètres enfants :
ADR 0039) et des droits par registre ou par élément (lecteur, contributeur, gestionnaire : ADR 0043 et 0067). Pour ouvrir un
établissement à son pilote, il faut lui donner un rôle global, puis le désigner sur chaque périmètre de la branche, un par un.

Le RSSI demande de **repartir d'un modèle simple** :

1. le **pilote** d'un périmètre voit et modifie tout ce périmètre **et ses enfants** (pyramide) ;
2. le **contributeur** ne voit que ce qu'il doit alimenter (actions, tâches récurrentes) : ce qu'il a créé, il le modifie ; ce
   qu'un pilote a créé, il le lit et le renseigne, sans le modifier ;
3. l'**administrateur** configure toute la plateforme.

## Décision (lot 1, livré) : la pyramide

- **L'accès donné sur un périmètre vaut pour tous ses descendants**, au même niveau (lecture, ou lecture et écriture). Il ne
  remonte jamais vers un parent et ne passe pas à un périmètre voisin.
- Quand un compte a plusieurs accès dans la chaîne, **le plus élevé l'emporte** : un pilote du parent écrit dans l'enfant même
  s'il y est aussi désigné en lecture seule.
- **Calcul à la lecture, sans copie** : fonction SQL `grc_acces_perimetre(périmètre, compte)` (migration `060`, additive), qui
  remonte la chaîne des parents. Aucune ligne de `grc_members` n'est créée ni modifiée. Déplacer un périmètre dans l'arbre ou
  retirer l'accès au parent prend donc effet immédiatement, sans resynchronisation.
- La fonction remplace **tous** les contrôles d'appartenance : accès à un périmètre, liste des périmètres, responsables
  proposables et acceptés, rappels d'échéance. Les registres multi-périmètres, la porte de lecture et le temps réel passent déjà
  par l'accès au périmètre et suivent sans autre changement.
- **Écran « Membres »** : les comptes qui tiennent leur accès d'un parent sont listés avec la mention « accès hérité d'un
  périmètre parent », sans bouton de révocation (l'accès se retire sur le périmètre où il a été donné). Le nom du parent n'est
  pas affiché : il peut ne pas être accessible à qui gère le périmètre enfant.
- **Inchangé dans ce lot** : les droits de module restent exigés (un pilote a toujours besoin d'un rôle global pour écrire), le
  périmètre commun reste visible de tous, les droits par registre et par élément, les registres restreints, l'héritage des
  référentiels (toujours explicite, ADR 0039).

### Conséquence à connaître

Un compte désigné sur un périmètre parent **avant** cette version reçoit l'accès à tous les descendants à la mise à jour. C'est
l'effet recherché ; relire les membres des périmètres de tête avant de mettre à jour un serveur déjà peuplé.

## Décisions du RSSI (13/11/2026)

1. **Rôles** : trois profils (administrateur, pilote, contributeur) **plus l'auditeur externe** (lecture seule, date d'expiration).
   RSSI, Lecteur et rôles personnalisés seront retirés (lot 3). **Un pilote peut être administrateur ou non** : l'administration
   de la plateforme et le pilotage d'un périmètre sont deux attributions indépendantes.
2. **Contributeur** : ce qu'il doit alimenter est ce qui lui est confié par le champ **« Attribuer à »** des actions et des tâches,
   où l'on choisit une personne ou un groupe.
3. **Création** : il crée là où il est attribué (registre d'actions ou de tâches récurrentes, action, tâche récurrente).
4. **Administrateur et données communes** : l'administrateur voit et modifie tout ; le périmètre commun devient le **sommet de la
   pyramide**, réservé à ses pilotes et aux administrateurs (lot 3).

## Décision (lot 2, livré côté serveur) : le contributeur par « Attribuer à »

- **« Attribuer à » vaut rôle de contributeur**, sans aucune ligne de droit : la personne désignée sur une action (occurrence
  d'une tâche récurrente comprise), une tâche récurrente ou un registre, en personne, par l'un de ses groupes ou par l'une de ses
  fonctions, **lit l'élément et le renseigne** (avancement, commentaire, preuve, validation d'occurrence : commandes de
  l'ADR 0043). Elle n'a besoin ni d'un rôle global ni d'un accès au périmètre, et ne voit rien d'autre.
- **Registre attribué** : le champ existait pour les plans d'actions, il est ouvert à toutes les familles de registres. La
  personne lit et renseigne tout le registre et **y crée** des éléments. Elle ne gère pas le registre (ni renommage, ni
  périmètres, ni archivage).
- **Ce que la personne a créé, elle le gère** (modifier, archiver), tant qu'elle reste contributrice du registre ou de
  l'élément. Ce qu'un pilote ou un autre contributeur a créé, elle le renseigne sans le modifier. Le créateur est le compte
  inscrit à la création de l'élément (`created_by`).
- **Calcul à chaque accès** : retirer l'attribution, sortir la personne du groupe ou archiver la fonction retire l'accès
  immédiatement, y compris à ce qu'elle avait créé.
- **Qui peut être désigné** : tout compte actif, pour une action, une tâche récurrente ou un registre (auparavant : un compte
  ayant déjà accès au périmètre). L'annuaire des responsables propose donc tous les comptes actifs. Pour les autres objets
  (risques, écarts…), la règle d'origine est conservée : le responsable doit accéder au périmètre.
- **Rappels d'échéance** : la personne désignée sur une action les reçoit même sans accès au périmètre.
- **Jamais d'autorité sur les droits** : un rôle tenu de « Attribuer à » ou de la création ne permet ni d'attribuer des droits,
  ni de régler « restreint » (ADR 0067 inchangée sur ce point). Un registre restreint reste ouvert à la personne à qui il est
  attribué : l'attribution est une désignation explicite.
- **API** : `GET /api/registres/mes-elements` liste ce qui est attribué au compte, par échéance, avec ce qu'il peut y faire ;
  `peutCreer` s'ajoute à la description d'un registre. Créer, modifier et archiver une fiche demandent une session complète,
  le service restant seul juge (registre, droits de module, périmètres).

### Conséquences à connaître (lot 2)

- **Désigner quelqu'un lui ouvre l'élément** : c'est désormais une habilitation. Qui gère un élément (pilote, créateur) peut donc
  en ouvrir la lecture et la contribution à tout compte actif. À la mise à jour, les responsables déjà désignés sur des actions,
  des tâches et des plans d'actions deviennent contributeurs de ces éléments.
- Le créateur est reconnu par son identifiant de connexion : un compte renommé perd la gestion de ce qu'il a créé.
- « Créer sur une action » n'a pas d'équivalent dans le modèle actuel (pas de sous-action) : la création se fait dans un
  registre attribué. À revoir si des sous-actions sont souhaitées.
- **Non livré** : l'écran du contributeur (page « Ce que je dois alimenter », bouton de création, statuts du périmètre lisibles
  sans accès au périmètre), le temps réel pour qui n'a qu'une attribution (limite connue de l'ADR 0043).

## Lot 3 (décidé, non livré) : les quatre profils remplacent la matrice

| Profil           | Attribution                         | Ce qu'il voit                                   | Ce qu'il fait                                                                 |
| ---------------- | ----------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Administrateur   | sur la plateforme                   | tout                                            | configure tout ; voit et modifie toutes les données                           |
| Pilote           | sur un périmètre                    | tout le périmètre et ses enfants                | crée, modifie, supprime dans cette branche ; désigne pilotes et contributeurs |
| Contributeur     | par « Attribuer à »                 | ce qui lui est attribué et ce qu'il y a créé    | renseigne ce qu'on lui confie ; gère ce qu'il a créé                          |
| Auditeur externe | sur la plateforme, date d'expiration | les modules ouverts à l'attribution, en lecture | consulte                                                                      |

À faire : la désignation du pilote sur un périmètre suffit, sans rôle global ; le périmètre commun passe de « visible de tous » à
« sommet de la pyramide » ; retrait des rôles RSSI et Lecteur, des rôles personnalisés et de la matrice module × action à
l'écran ; devenir des droits par ressource (lecteur, contributeur, gestionnaire) et des registres restreints ; reprise des
comptes existants (migration). Chaque point touche des comptes en place : plan de reprise à valider avant d'écrire la migration.

## Questions restantes

1. **Lecture seule sur un périmètre** : la garde-t-on à côté du pilote ? Le lot 1 la conserve et la fait descendre aux enfants.
2. **Reprise des comptes** au lot 3 : que deviennent les comptes RSSI (administrateur ? pilote du sommet ?) et Lecteur
   (lecture seule du sommet ? retirés ?) ?
3. **Écarts** : le contributeur les alimente-t-il comme les actions, par le même champ ?

## Preuves

`apps/api/test/perimetres-pyramide.test.ts` : descente de l'écriture et de la lecture seule, absence de remontée, voisins et
périmètres étrangers en 404, niveau le plus élevé, liste des membres hérités, responsable hérité accepté, effet immédiat d'un
déplacement et d'un retrait. Suite complète exécutée le 13/11/2026 (voir la [reprise](../01_REPRISE_IA/REPRISE-2026-11-13.md)).

Lot 2 : `apps/api/test/contributeur-attribue.test.ts` : désignation d'un compte sans accès au périmètre, contribution sans
modification ni archivage, rien d'autre de visible (404), groupe (accès perdu en quittant le groupe), registre attribué (lecture,
contribution, création, pas de gestion), gestion de ce que l'on a créé, pas de création ailleurs, retrait de l'attribution,
registre de tâches récurrentes attribué, aucune autorité sur les droits.
