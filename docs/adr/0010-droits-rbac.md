# ADR 0010 — Droits : utilisateurs, groupes, rôles (RBAC)

**Statut** : acceptée (phase 0, chantier 9 bis). Remplace les trois rôles fixes `admin`, `rw` et `ro` de la v2.

## Contexte
Trois rôles fixes ne suffisent plus. Il faut ouvrir un module à un pilote sans lui ouvrir les autres, donner à un auditeur externe un accès limité dans le temps, et produire la revue des accès exigée par ISO 27001 (A.5.18).

## Décision
- **Permission = module × action.** Les modules sont les 10 modules métier, plus documents, import et export, administration et paramètres. Les actions sont lire, créer et modifier, supprimer, exporter, administrer, soit 70 permissions au total.
  La liste est déclarée **une seule fois**, dans `packages/shared/src/permissions.ts`, et réutilisée par l'API, l'interface et les tests.
- **Rôle = ensemble de permissions.**
  - Cinq rôles **prédéfinis** : Administrateur, RSSI, Contributeur, Lecteur, Auditeur externe. Leurs permissions sont définies dans le code, et un déclencheur PostgreSQL empêche de les modifier ou de les supprimer.
  - Rôles **personnalisés** : toujours créés par duplication d'un rôle existant, puis édités dans la matrice. Leurs permissions sont stockées en base (`roles.permissions`).
- **Groupes** : un compte appartient à zéro ou plusieurs groupes, et un groupe porte un ou plusieurs rôles. **Droits effectifs = union** des rôles directs et des rôles des groupes. L'origine de chaque droit est conservée et affichée.
- **Auditeur externe** : rôle à **portée**. Les modules ouverts sont choisis à l'attribution (`user_roles.modules`), et une date d'expiration est obligatoire. Il s'attribue directement, jamais par un groupe, et ne se duplique pas.
- **Contrôle côté serveur, en un seul point** : chaque route déclare `access: 'module:action'`, et `route()` appelle `requirePermission`. Les autres niveaux d'accès sont `public`, `session` (étapes de connexion), `auth` (compte personnel) et `metier` (au moins un module métier lisible).
  - Les droits sont **relus à chaque requête**, aucun cache n'est utilisé.
  - Le flux temps réel est filtré par permission (`ENTITY_PERMISSION`).
  - L'outil historique est filtré par module : les modules non lisibles sont masqués à la lecture et conservés à l'écriture ; un module modifié sans le droit « modifier » est refusé.
- **Garde-fous**, appliqués dans la transaction :
  - il reste au moins un administrateur actif **et permanent**, c'est-à-dire sans date d'expiration et détenant `administration:administrer` ;
  - personne ne modifie ses propres droits, ni directement, ni par un groupe ou un rôle qu'il détient ;
  - toute modification est tracée dans le journal, avec l'état avant et après, et ferme les sessions des comptes concernés ;
  - les comptes expirés sont refusés immédiatement, puis désactivés automatiquement (toutes les 5 min) avec une trace dans le journal.
- **Migration v2** (`003_droits.sql`) : `admin` devient Administrateur, `rw` devient Contributeur et `ro` devient Lecteur. La colonne `users.role` est supprimée.
- **Revue des accès** : export CSV et Excel. Le fichier `.xlsx` est écrit sans dépendance (`apps/api/src/export/tabular.ts` : Office Open XML et archive ZIP avec `zlib`).

## Conséquences
- Chaque nouveau module métier (phases 1 à 3) déclare ses routes avec ses propres permissions.
- Le test `rbac.test.ts` parcourt **toutes les routes**. Il vérifie que chacune refuse sans la permission requise et accepte avec cette seule permission. Une route qui n'exige aucune permission doit figurer dans une liste explicite du test.
- L'interface masque ou désactive ce qui n'est pas permis (`useCan`), sans jamais remplacer le contrôle du serveur.
- Changement de comportement : un ancien compte `rw` devient Contributeur et **ne peut plus supprimer**. Pour retrouver ce droit, lui attribuer le rôle RSSI ou un rôle personnalisé.
