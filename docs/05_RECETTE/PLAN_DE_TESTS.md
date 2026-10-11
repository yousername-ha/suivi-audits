# Plan de tests

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Source : [registre de référence](../08_PILOTAGE/REGISTRES.json). 45 cas représentatifs ; pas une extraction
de toutes les assertions Vitest. Le statut PASSÉ peut référencer une CI datée
du commit analysé ; distinguer les exécutions de cette session dans EXE.

| Cas      | Fonction / domaine                                         | Type       | Dernier résultat connu | Preuve / limite                                                                                                               |
| -------- | ---------------------------------------------------------- | ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TEST-001 | FCT-001 — Installation, connexion et TOTP                  | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-002 | FCT-002 — Comptes, groupes, rôles et revue des droits      | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-003 | FCT-003 — Sessions et déconnexion synchronisée             | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-004 | FCT-004 — Documents, versions chiffrées et liens           | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-005 | FCT-005 — Paramètres et charte Sauge                       | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-006 | FCT-006 — Temps réel, présence et concurrence              | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-007 | FCT-007 — Écrans muraux                                    | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-008 | FCT-008 — Cartographie contexte et processus               | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-009 | FCT-009 — Import, export et annulation legacy              | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-010 | FCT-010 — Sauvegardes web et planification                 | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-011 | FCT-011 — Vérification et restauration                     | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-012 | FCT-012 — TLS et certificats                               | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-013 | FCT-013 — Mise à jour intégrée et maintenance              | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Ancien updater : premier redéploiement serveur nécessaire ; frontal entretenu séparément.                           |
| TEST-014 | FCT-014 — Activation des modules                           | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-015 | FCT-015 — Configuration des échelles et matrices           | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-016 | FCT-016 — Décisions IA versionnées B2b                     | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Ne constitue pas la reprise complète du registre IA (FCT-032).                                                      |
| TEST-017 | FCT-017 — Catalogue métier et politiques                   | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Raccordements des familles historiques et nomenclatures spécifiques B2 à terminer.                                  |
| TEST-018 | FCT-018 — Contexte, parties intéressées et responsabilités | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-019 | FCT-019 — Processus, objectifs et indicateurs              | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-020 | FCT-020 — Référentiels, exigences et correspondances       | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Moteur C validé ; audit/couverture annuelle et GAP historiques non entièrement migrés.                              |
| TEST-021 | FCT-021 — Actions et tâches récurrentes                    | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Transport email exclu ; pas de migration automatique de toutes les récurrences historiques.                         |
| TEST-022 | FCT-022 — Méthodes et évaluations des risques              | AUTOMATISÉ | PASSÉ                  | EXE-006 ; ISO/MÉHARI : modèles configurables ; exhaustivité d’une méthode normative ou des classeurs officiels non certifiée. |
| TEST-023 | FCT-023 — Cartographie des risques                         | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Volumes bornés ; benchmark de charge et ergonomie sur grands graphes non réalisés.                                  |
| TEST-024 | FCT-024 — Preuves et plan de contrôle G                    | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-025 | FCT-025 — Amélioration continue H                          | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-026 | FCT-026 — Parcours guidé qualité/sécurité/HDS K            | AUTOMATISÉ | PASSÉ                  | EXE-006 ; L’avancement ne constitue ni conformité ni certification ; recette humaine en attente.                              |
| TEST-027 | FCT-027 — BIA, continuité, exercices et RETEX E            | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Kits/grilles ANS, configuration des méthodes de continuité et reprise complète plans/crise manquent.                |
| TEST-028 | FCT-028 — Audit et couverture annuelle historique          | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Exigences natives disponibles, couverture interne/certification par année encore historique.               |
| TEST-029 | FCT-029 — Planning et créneaux d’audit historiques         | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Migration et recette des participants, questions et preuves attendues à établir.                           |
| TEST-030 | FCT-030 — Déclaration d’applicabilité historique           | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Correspondance de dda vers SoA et recette complète à établir.                                              |
| TEST-031 | FCT-031 — Fournisseurs et évaluations historiques          | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Reprendre registre, évaluations, contacts, certifications, fréquence et exports ; maintien legacy requis.  |
| TEST-032 | FCT-032 — Registre IA, plans et politiques historiques     | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Reprise fonctionnelle IA distincte du futur assistant MCP J, exclu.                                        |
| TEST-033 | FCT-033 — CRRC, établissements et offres                   | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; CRRC-01 à CRRC-04 au backlog ; offres/statuts/carte/exports attendent cadrage autorisé.                    |
| TEST-034 | FCT-034 — Investissements et prospection                   | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Filtres/vues et prospection au backlog ; lot D exclu de la livraison actuelle.                             |
| TEST-035 | FCT-035 — Incidents, crise et main courante                | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; INC-01 à INC-03, déclarations, événements et COMSEC à cadrer ; aucun abandon décidé.                       |
| TEST-036 | FCT-036 — Revues d’accès métier historiques                | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Reprise périodique et preuve de réalisation des revues métier à spécifier.                                 |
| TEST-037 | FCT-037 — Revues de direction                              | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Tester les sous-sections historiques, décisions, suivis et validation de bout en bout.                     |
| TEST-038 | FCT-038 — Plans historiques et sous-sections               | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Inventorier types/champs, identifiants et liens avant migration vers le début E.                           |
| TEST-039 | FCT-039 — Aide embarquée et navigation métier              | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Recette du serveur utilisateur non reçue.                                                                           |
| TEST-040 | FCT-040 — Rapports natifs et exports métier                | AUTOMATISÉ | PASSÉ                  | EXE-006 ; Les exports Word/PowerPoint serveur de la feuille de route ne sont pas déclarés implémentés.                        |
| TEST-041 | FCT-010 — Installation serveur client                      | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Aucun résultat ni validation humaine reçus.                                                                |
| TEST-042 | FCT-026 — Acceptation ergonomique humaine                  | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Aucun résultat ni validation humaine reçus.                                                                |
| TEST-043 | FCT-023 — Performance aux volumes cibles                   | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Aucun résultat ni validation humaine reçus.                                                                |
| TEST-044 | FCT-027 — Référentiels officiels et continuité             | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Aucun résultat ni validation humaine reçus.                                                                |
| TEST-045 | FCT-011 — Reprise complète hors serveur                    | MANUEL     | NON EXÉCUTÉ            | Aucune exécution ; Aucun résultat ni validation humaine reçus.                                                                |

Couverture : auth/logout/sessions/droits/navigation, données/formulaires/
validations/CRUD, recherche/filtres/pagination, import/export, API/BDD/migrations,
sécurité et non-régression existent dans les suites citées. Performance réelle,
compatibilité exhaustive et accessibilité complète sont NON VÉRIFIÉES.
Envoi email/SSO/MCP : NON APPLICABLE au périmètre livré, pas prétendus testés.
Les incidents/plans historiques restent une recette à préparer ; code existant
ne suffit pas pour passer TEST-028 à TEST-038.
