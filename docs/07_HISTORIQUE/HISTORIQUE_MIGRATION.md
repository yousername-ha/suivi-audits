# Historique de migration

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

1. Base v2 b148c1b conservée dans une archive de 44 fichiers et un manifeste.
   Contrôle actuel octet par octet réussi.
2. ZIP Sauge apporte monorepo, interface, API, sécurité, format legacy et
   nouvelles fondations ; bibliothèques/export ancien et identifiants conservés.
3. Migrations 001–005 : base historique, v3, droits, affichage et cartes.
   maps dispose d’un mapper et recomposition ; les autres familles ne
   deviennent pas toutes automatiquement normalisées.
4. 006–011 : sauvegardes, exploitation, activation, update, configurations
   et décisions IA versionnées, sans recalcul de l’ancien aiEval.
5. 012–014 : politiques métier, périmètres/objets/relations, référentiels,
   méthodes/évaluations, séries/occurrences et automatisation.
6. 015 : décisions Pilotage immuables et adaptateurs directs ; périmètre commun
   sans création SMSI imposée, G/H/K et début E.

Le schéma est additif ; une migration publiée n’est pas modifiée.
Versions données, source extra, IDs et imports restent protégés par tests.
Conservation des sources ≠ migration de tous les parcours métier.

La migration des volumes Docker v2 vers DATA_DIR a un script distinct, avec
sauvegarde et comparaison ; ses anciens volumes sont conservés. Le résultat
sur le serveur client est INCONNU. Restaurer du code seul après une migration
de base ne restaure pas les données et leur schéma.

Références : [base de données](../03_ARCHITECTURE/BASE_DE_DONNEES.md),
[comparaison](../02_FONCTIONNALITES/COMPARAISON_ANCIEN_NOUVEAU.md),
[legacy](../legacy/IMPORT-LEGACY.md), INSTALLATION 12.4/12.5.
