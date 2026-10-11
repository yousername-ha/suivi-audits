# Fonctions historiques non reprises

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

6 domaines n’ont pas de remplacement Sauge complet identifié. Leur
code existe encore dans /legacy : **NON REPRISE n’est pas SUPPRIMÉE**.
Le fonctionnement métier complet reste NON VÉRIFIÉ dans cette mission.

| ID      | Famille                                 | Clés                 | Action                                                                                                    |
| ------- | --------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| FCT-031 | Fournisseurs et évaluations historiques | suppliers / supEvals | Reprendre registre, évaluations, contacts, certifications, fréquence et exports ; maintien legacy requis. |
| FCT-033 | CRRC, établissements et offres          | crrc                 | CRRC-01 à CRRC-04 au backlog ; offres/statuts/carte/exports attendent cadrage autorisé.                   |
| FCT-034 | Investissements et prospection          | invest               | Filtres/vues et prospection au backlog ; lot D exclu de la livraison actuelle.                            |
| FCT-035 | Incidents, crise et main courante       | incidents / crisis   | INC-01 à INC-03, déclarations, événements et COMSEC à cadrer ; aucun abandon décidé.                      |
| FCT-036 | Revues d’accès métier historiques       | accessReviews        | Reprise périodique et preuve de réalisation des revues métier à spécifier.                                |
| FCT-038 | Plans historiques et sous-sections      | plans                | Inventorier types/champs, identifiants et liens avant migration vers le début E.                          |

## Reprises partielles ou non testées

| ID      | Domaine                                      | État                    | Réserve                                                                                              |
| ------- | -------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| FCT-020 | Référentiels, exigences et correspondances   | REPRISE PARTIELLEMENT   | Moteur C validé ; audit/couverture annuelle et GAP historiques non entièrement migrés.               |
| FCT-027 | BIA, continuité, exercices et RETEX E        | REPRISE PARTIELLEMENT   | Kits/grilles ANS, configuration des méthodes de continuité et reprise complète plans/crise manquent. |
| FCT-028 | Audit et couverture annuelle historique      | REPRISE PARTIELLEMENT   | Exigences natives disponibles, couverture interne/certification par année encore historique.         |
| FCT-029 | Planning et créneaux d’audit historiques     | REPRISE PARTIELLEMENT   | Migration et recette des participants, questions et preuves attendues à établir.                     |
| FCT-030 | Déclaration d’applicabilité historique       | REPRISE PARTIELLEMENT   | Correspondance de dda vers SoA et recette complète à établir.                                        |
| FCT-032 | Registre IA, plans et politiques historiques | REPRISE PARTIELLEMENT   | Reprise fonctionnelle IA distincte du futur assistant MCP J, exclu.                                  |
| FCT-037 | Revues de direction                          | REPRISE MAIS NON TESTÉE | Tester les sous-sections historiques, décisions, suivis et validation de bout en bout.               |
| FCT-040 | Rapports natifs et exports métier            | REPRISE PARTIELLEMENT   | Les exports Word/PowerPoint serveur de la feuille de route ne sont pas déclarés implémentés.         |

Pour chaque reprise : relever écrans/champs/filtres/exports/relations et décisions,
choisir une source modifiable unique, préserver extras et IDs, fournir une
simulation/reprise non destructive, puis tester avant lecture seule legacy.
L’archive n’est jamais extraite au-dessus d’une installation active.

Le détail du cadrage reste MIG-001/DOC-002 : certaines familles recoupent les
lots D/J/I/F explicitement exclus. Aucun développement dans ces lots n’est
automatiquement autorisé par cet inventaire.
