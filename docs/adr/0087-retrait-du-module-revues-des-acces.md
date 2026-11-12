# ADR 0087 — Retrait du module « Revues des accès »

- Statut : acceptée (décision du RSSI du 11/11/2026 ; numéro annoncé et accepté dans la session, le 0086 étant pris par
  l'ADR « Assistant RSSI intégré » de la branche `claude/assistant-rssi`)
- Date : 2026-11-11
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Applique le précédent de l'[ADR 0084](0084-retrait-des-modules-crrc-et-investissements.md) (retrait de modules et de leurs
  données). Déroge, comme lui et la migration 043, à la règle « migrations additives ».

## Contexte

La page « Revues des accès » du Pilotage (reprise de l'outil de suivi) tenait un registre d'applications avec la date de leur
dernière revue des comptes et une périodicité. Le RSSI a décidé de la **retirer**, parce que ces revues se suivent déjà par une
**tâche récurrente** du Pilotage (calendrier et rappels). Ce module n'avait pas de droit propre : il relevait de « pilotage ».

## Décision

- **La page, son menu et ses routes disparaissent** : rubrique « Revues des accès » du menu Organisation, page
  `/pilotage/revues-acces`, routes `/api/revues-acces*`, service `RevuesAcces`, module partagé `suivi-revues-acces`, rubrique
  d'export Excel et données de démonstration.
- **Les données sont supprimées définitivement** par la migration `054_retrait_revues_acces.sql` : table
  `suivi_access_reviews`, clé `accessReviews` de l'état historique et de `suivi_presence`. La sauvegarde automatique de
  `scripts/mettre-a-jour.sh` précède la migration ; c'est le seul retour arrière. Le journal d'audit n'est pas touché.
- **Aucun droit à retirer** : le module relevait de « pilotage » ; aucun rôle, aucune attribution ni aucun écran mural n'est
  modifié.
- **Format d'échange historique (schéma 15)**, comme pour l'ADR 0084 : la clé `accessReviews` disparaît du contrat
  (`LEGACY-FORMAT.md`), du mapping, du schéma de validation et de la fixture. Un fichier de l'outil historique qui la contient
  reste importable : elle est écartée sans rien dire ; l'export ne la produit plus. Le schéma reste à 15.
- **Ce qui ne change pas** : la revue des accès **des comptes** (Administration, onglet Utilisateurs, export Excel et CSV, mesure
  ISO 27001 A.5.18, route `/api/admin/access-review`) est une autre fonction et reste en place.

## Ce qui n'est pas fait

- Aucun export automatique des revues avant suppression : qui veut les conserver exporte la rubrique Excel de la version
  précédente avant la mise à jour (indiqué dans `INSTALLATION.md`).
- Aucune migration des revues existantes vers des tâches récurrentes : elles sont à recréer dans le calendrier.

## Conséquences

Migration destructive mais bornée (une table, une clé d'état). Moins de code historique à reprendre. Les entrées FCT-036 et
FCT-049 de l'inventaire fonctionnel passent à « RETIRÉ ».
