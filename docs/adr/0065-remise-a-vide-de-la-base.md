# ADR 0065 — Remise à vide de la base pour la recette

- Statut : acceptée
- Date : 2026-10-27
- Contexte : demande du RSSI du 27/10/2026 : un bouton rouge pour « purger la base et revenir à vide », afin de faciliter la recette. Choix du RSSI : portée **au choix à chaque fois** (données de travail seulement, ou tout comptes compris) et **interrupteur désactivé par défaut**.

## Décision

1. **Où.** Administration > Sauvegardes et restauration, panneau « Remise à vide de la base » (administrateurs seulement : `administration:administrer`). Aucune carte nouvelle : la page d'Administration et ses captures de référence ne changent pas.
2. **Interrupteur.** « Autoriser la remise à vide sur ce serveur » est **désactivé par défaut**. L'activer exige le code de double authentification ; le désactiver n'en exige pas. Désactivé, le bouton rouge n'apparaît pas et la route refuse (403) sans consommer le code. La portée « tout » efface aussi ce réglage : la fonction redevient désactivée.
3. **Deux portées, deux phrases.** « Données de travail » (phrase `VIDER LES DONNÉES`) efface tout ce qui a été saisi ou importé (pilotage, risques, actions, écarts, documents, référentiels et kit importés, configuration GRC publiée) et garde comptes, groupes, rôles, réglages : la session reste valable. « Tout » (phrase `TOUT EFFACER`) efface en plus comptes, groupes, fonctions, rôles personnalisés, réglages, calendriers de plateforme : retour à l'écran d'installation, avec un **nouveau jeton** émis dans les journaux du service comme à la première installation. La phrase d'une portée ne vaut pas pour l'autre.
4. **Avant d'effacer** (contrôlé sous le verrou consultatif des sauvegardes) : interrupteur actif, phrase exacte, code de double authentification valide (même limiteur et même anti-rejeu que l'installation d'une mise à jour), **sauvegarde réussie de moins de 30 minutes**, aucune sauvegarde ni opération d'exploitation en cours. Sans sauvegarde récente, la demande est refusée (409) et l'écran dit de la lancer d'abord : l'API n'a pas d'accès shell, la sauvegarde reste l'affaire de l'exécutant serveur.
5. **Effacement.** Une seule transaction. Les triggers d'immuabilité (décisions, versions publiées, évaluations, historiques) sont **suspendus puis rétablis dans cette même transaction** (`ALTER TABLE … DISABLE/ENABLE TRIGGER USER`, l'API étant propriétaire de ses tables), les tables sont vidées par un seul `TRUNCATE … RESTART IDENTITY`, puis le service est réamorcé comme au démarrage (état initial vide, configuration par défaut, jeton si plus aucun compte). Au moindre échec, tout est annulé. C'est le **seul chemin** qui contourne l'immuabilité.
6. **Jamais touché** : journal d'audit (qui reçoit `remise_a_vide.executee` avec la portée), historique des migrations, sauvegardes, opérations et mises à jour, rôles prédéfinis, réglages à valeur unique créés par les migrations (modules activés, politique métier, paramètres d'investissement, types de processus).
7. **Garde contre l'oubli.** Chaque table du schéma est classée dans `apps/api/src/remise-a-vide.ts` (système, configuration, travail). Un test échoue si une table nouvelle n'est pas classée ou si le classement contient une table inconnue.

## Limites

- Les autres personnes connectées doivent recharger la page ; les documents sont stockés en base (aucun fichier à supprimer).
- Les journaux du conteneur et les archives de sauvegarde ne sont pas effacés.
- Les réglages à valeur unique listés en 6 ne reviennent pas à leur valeur d'origine.
- Fonction pensée pour un serveur de recette : sur un serveur de production, laisser l'interrupteur désactivé.
