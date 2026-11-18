# ADR 0105 — Contacts de crise issus des comptes de la plateforme

- Statut : **Acceptée** par le RSSI le 18/11/2026 (décisions « contacts de crise issus des comptes »).
- Date : 2026-11-18
- Rédaction : session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`)
- **Complète** la cellule de crise reprise de l'outil de suivi (contacts de crise saisis à la main, clé `crisis` de l'état
  historique, FCT-055) et s'appuie sur la pyramide des périmètres ([ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md))
  et sur la règle « sans rattachement, rien n'est visible » ([ADR 0095](0095-sans-rattachement-rien-ne-est-visible.md)).

## Contexte

Les contacts de crise (page « Contacts de crise » et liste de la cellule de crise) ne sont que des fiches saisies à la main
dans l'état historique : nom, organisation, rôle, deux téléphones, courriel, disponibilité, notes, case « clé ». Les
membres internes de la cellule de crise ont pourtant déjà un compte sur la plateforme, avec leur nom et leur adresse
courriel : les ressaisir crée des doublons qui vieillissent mal (un numéro changé n'est mis à jour qu'à un endroit). Le
RSSI demande (18/11/2026) que les comptes puissent être désignés contacts de crise, que la personne tienne elle-même ses
numéros à jour, et que la page et la cellule de crise les reprennent.

## Décision

1. **Désignation par l'administrateur.** Dans Plateforme > Utilisateurs, la fiche d'un compte reçoit une section « Contact
   de crise » : case « Contact de crise », rôle de crise, téléphone, téléphone 2, disponibilité, case « Contact clé »
   (priorité dans la cellule de crise) et périmètres (« Tous les périmètres », coché par défaut, ou une liste choisie). Seul
   le droit `administration:administrer` marque le compte, choisit le rôle de crise, la case clé et les périmètres
   (`PUT /api/admin/users/:id/contact-crise`, `If-Match`) ; `administration:lire` lit la fiche
   (`GET /api/admin/users/:id/contact-crise`). Décocher la case supprime la fiche. Un périmètre inconnu est refusé (400).
2. **Mise à jour par la personne.** Dans « Mon compte », une personne contact de crise voit une carte « Contact de crise » :
   elle met à jour ses téléphones et sa disponibilité, et voit sans pouvoir les modifier son rôle de crise, la case clé et ses
   périmètres (`GET` et `PATCH /api/account/contact-crise`, accès `auth`, `If-Match` ; tout autre champ est refusé par un
   schéma strict). Les périmètres qu'elle ne lit pas sont seulement comptés, sans leur nom. Une personne qui n'est pas
   contact de crise ne voit rien (404 côté API).
3. **Lecture dans les contacts de crise.** `GET /api/crise` renvoie en plus `contactsComptes` : nom affiché (à défaut
   l'identifiant), courriel du compte, rôle de crise, téléphones, disponibilité, clé. La page « Contacts de crise » les montre
   en tête, dans un bloc en lecture seule « Comptes de la plateforme » (téléphones en liens `tel:`, courriel en lien
   `mailto:`), avec la mention « Modifiable dans Plateforme > Utilisateurs » (lien pour qui lit l'administration) ; les
   contacts saisis à la main restent en dessous, inchangés. La cellule de crise reprend aussi les comptes : contacts clés en
   premier (comptes, puis contacts saisis), puis les autres, douze au plus comme avant.
4. **Qui voit quoi.** Seuls les comptes actifs (ni désactivés ni expirés, même prédicat que les annuaires de responsables)
   apparaissent. Les numéros ne sont lus que par qui a `incidents:lire` sur le périmètre, avec la règle de périmètre de
   `GET /api/crise` (404 si le périmètre demandé est illisible) : pour un périmètre affiché, les comptes qui couvrent tous
   les périmètres ou ce périmètre ; sans périmètre affiché, ceux qui couvrent tous les périmètres ou au moins un périmètre
   lisible ; sans aucun périmètre lisible, aucun.
5. **Journal.** Qui a modifié quoi, sans les valeurs des numéros : `admin.user_crisis_contact` (administrateur : opération
   création, modification ou retrait, noms des champs modifiés, version) et `account.crisis_contact_update` (la personne :
   noms des champs modifiés, version), comme `admin.user_update` qui ne journalise que les noms de champs.
6. **Stockage.** Une table dédiée `contacts_crise_comptes` (migration additive `087`, aucune donnée reprise) : une ligne par
   compte contact de crise, supprimée avec le compte (clé étrangère en cascade), périmètres en tableau d'identifiants
   contrôlés à l'écriture, version pour `If-Match`, mêmes longueurs que les contacts saisis à la main. Remise à vide : avec
   la configuration, comme les comptes. Temps réel : changement publié sur l'entité `users` (identifiant du compte
   seulement), reçu par qui lit l'administration.

## Conséquences

- Un membre interne de la cellule de crise n'est plus ressaisi : son nom et son courriel viennent de son compte, ses
  numéros de lui-même. Les contacts externes (fournisseurs, autorités, astreintes) restent saisis à la main, comme avant.
- Désigner un compte contact de crise rend ses numéros et son adresse courriel lisibles par les lecteurs des incidents de
  ses périmètres : la carte de Mon compte le dit à la personne.
- Désactiver un compte, ou le laisser expirer, le retire des contacts de crise sans effacer sa fiche ; supprimer le compte
  efface la fiche.
- Un périmètre supprimé après coup reste dans la liste d'un contact sans y apparaître (il ne se lit plus) ; après une remise
  à vide du seul travail, les périmètres choisis ne correspondent plus à rien et l'administrateur les choisit de nouveau.
- Deux routes de plus en accès `auth` (Mon compte), à lister dans la matrice des routes sans permission (`rbac.test.ts`).
- Correctif lié : `GET /api/crise` répondait 500 pour un compte qui lit les incidents sans aucun périmètre lisible (liste
  vide passée à la requête des exercices de continuité) ; il répond désormais avec des listes vides.

## Points ouverts

- **Export Excel** : la feuille « Contacts de crise » de l'export ne reprend pas encore les comptes (hors périmètre de ce
  lot, décision du RSSI du 18/11/2026).
- Les contacts de crise d'un périmètre parent ne sont pas repris dans ses périmètres enfants : un compte désigné pour un
  périmètre n'apparaît que dans ce périmètre (ou partout avec « Tous les périmètres »), comme les contacts saisis à la main.
  À confirmer par le RSSI.
