# ADR 0092 — Refonte des droits : trois profils et pyramide des périmètres

- Statut : **lot 1 accepté** (demande du RSSI du 13/11/2026) ; **modèle cible proposé**, lots 2 et 3 à décider (questions ouvertes en fin de document)
- Date : 2026-11-13
- Rédaction : session « Refonte des droits d'accès » (`session_01EnWdzeZgHxzTs1KxQ6ja6Z`)
- Amende le point 4 de l'[ADR 0039](0039-hierarchie-des-perimetres.md) (« droits et membres ne se propagent pas »), pour les seuls membres.
  Ne retire rien aux [ADR 0010](0010-droits-rbac.md), [0043](0043-registres-perimetres-herites-et-droits-par-ressource.md) et
  [0067](0067-attribution-des-droits-par-ressource-reservee.md) tant que les lots 2 et 3 ne sont pas décidés.

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

## Modèle cible proposé (lots 2 et 3, non livrés)

| Profil         | Attribution                 | Ce qu'il voit                                               | Ce qu'il fait                                                                 |
| -------------- | --------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Administrateur | sur la plateforme           | tout                                                        | configure tout (comptes, périmètres, paramètres, modules)                     |
| Pilote         | sur un périmètre            | tout le périmètre et ses enfants                            | crée, modifie, supprime dans cette branche ; désigne pilotes et contributeurs |
| Contributeur   | sur un périmètre, ou aucune | les actions et tâches récurrentes qu'il a créées ou qu'on lui a confiées | modifie ce qu'il a créé ; lit et renseigne ce qu'un pilote a créé |

- **Lot 2, le contributeur.** Le socle existe : commande de contribution (statut, compte rendu, commentaire, preuve) et
  validation des occurrences (ADR 0043). Reste à faire dépendre l'accès du **responsable** et du **créateur** de l'élément au
  lieu d'un droit attribué à la main, et à réduire son écran à « ce que je dois alimenter ».
- **Lot 3, les trois profils remplacent la matrice.** Le pilote n'a plus besoin d'un rôle global : sa désignation sur le
  périmètre suffit. La matrice module × action, les rôles personnalisés et les droits par ressource sont retirés ou masqués
  selon les réponses ci-dessous.

## Questions ouvertes (à trancher par le RSSI avant les lots 2 et 3)

1. **Rôles actuels** : RSSI, Lecteur, Auditeur externe (lecture limitée dans le temps), rôles personnalisés et groupes
   disparaissent-ils, ou certains restent-ils (l'auditeur externe répond à un besoin d'audit de certification) ?
2. **Lecture seule sur un périmètre** : la garde-t-on à côté du pilote, ou tout membre d'un périmètre est-il pilote ?
3. **Contributeur** : « ce qu'il doit alimenter » = les éléments dont il est responsable (en personne, par groupe ou par
   fonction) ? Dans quel périmètre crée-t-il ses propres actions ?
4. **Données communes** (périmètre « Pilotage de l'organisation », visible de tous aujourd'hui, et modules historiques sans
   périmètre) : réservées à l'administrateur, ou ouvertes aux pilotes de tête ?
5. **Administrateur** : voit-il aussi toutes les données métier (c'est le cas aujourd'hui), ou seulement la configuration ?

## Preuves (lot 1)

`apps/api/test/perimetres-pyramide.test.ts` : descente de l'écriture et de la lecture seule, absence de remontée, voisins et
périmètres étrangers en 404, niveau le plus élevé, liste des membres hérités, responsable hérité accepté, effet immédiat d'un
déplacement et d'un retrait. Suite complète exécutée le 13/11/2026 (voir la [reprise](../01_REPRISE_IA/REPRISE-2026-11-13.md)).
