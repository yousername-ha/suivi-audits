# ADR 0092 — Accès aux périmètres hiérarchiques : un rattachement ouvre le périmètre et ses descendants

**Statut** : acceptée le 13/11/2026 (arbitrage du RSSI du 13/11/2026, BUG-051 de la campagne de recette). **Amende** l'[ADR 0039](0039-hierarchie-des-perimetres.md)
(point 4 : « droits et membres ne se propagent pas »). Numéro annoncé au RSSI avant son emploi (consigne d'AGENTS.md).

## Contexte

La campagne de recette des 12 et 13/11/2026 a constaté (T1-01, T2-01, T3-01, T4-01, T5-01, T6-02) qu'un contributeur rattaché au seul
périmètre enfant « Hébergement HDS » lisait et écrivait dans le périmètre racine : la racine est créée « Toute l'organisation »
(visibilité `instance`), ouverte à tous les comptes, sans réglage. À l'inverse, un compte rattaché au périmètre parent recevait 404 sur
ses enfants : l'appartenance ne se propageait pas.

## Décision

1. **Un compte est rattaché à des périmètres** (table `grc_members`, inchangée). Un rattachement ouvre **le périmètre et tous ses
   descendants**, jamais son parent ni un périmètre voisin. Rattaché à un enfant, un compte ne voit que cet enfant (et ses propres
   descendants) ; rattaché au parent, il voit le parent et les enfants qui lui sont rattachés.
2. **Droit d'écriture** : celui du rattachement qui ouvre le périmètre (écriture sur le parent = écriture sur les descendants ; lecture
   seule sur le parent = lecture seule sur les descendants). Un rattachement direct à l'enfant peut accorder plus que le parent.
3. **Un compte sans aucun rattachement ne voit aucun périmètre** (précision du RSSI, 13/11/2026). La visibilité `instance` du périmètre
   commun n'ouvre plus rien d'elle-même. Pour que la mise à jour ne retire l'accès à personne, la migration `060` rattache au périmètre
   commun, en écriture, chaque compte existant qui n'a aucun rattachement (ce que lui donnait `instance` ; ses rôles continuent de
   borner ses droits). Un compte créé ensuite doit être rattaché explicitement (écran « Accès au périmètre »).
4. **Administrateurs inchangés** : ils ouvrent tous les périmètres (isAdmin).
5. **Une seule source de la règle** : trois fonctions SQL (migration `060`) — `grc_smsi_ouvert(compte, périmètre)`,
   `grc_smsi_ecrivable(compte, périmètre)` et `grc_smsi_ascendance(périmètre)` — utilisées par `Grc.access`, `Grc.listSmsis`, les
   responsables proposables (`owners`, `checkOwner`) et les notifications d'échéance, de sorte qu'un compte n'est jamais proposé ni
   notifié pour un périmètre qu'il ne peut pas ouvrir.
6. **Hors de cette décision** : l'héritage des référentiels (ADR 0039, point 3) et ce qui est « hérité » (point 4, hors droits) sont
   inchangés ; la propagation des membres ne crée aucune ligne dans `grc_members`.

## Conséquences

- Le compte rattaché à un enfant n'a plus accès au périmètre commun : les fiches communes (processus, registres historiques) lui sont
  fermées. Pour lui donner accès aux deux, le rattacher aussi au parent (ou à la racine). Un compte neuf, non rattaché, ne voit rien. L'écran « Accès au périmètre » indique les
  membres directs ; l'héritage descendant n'y apparaît pas comme une ligne.
- Retour arrière : les trois fonctions sont supprimables sans toucher aux données ; une version antérieure ignore la propagation.
- Tests : `apps/api/test/acces-perimetres-descendants.test.ts` ; harnais du RSSI virtuel, `CAMP-T1-01` et `CAMP-T1-02`.
