# Tableau de bord du projet

Référence applicative analysée : `f9545c3ce1a1338f13bb39bdaa4468bcc907da2d`. Mise à jour : 2026-10-11T22:10:00+02:00 (Europe/Paris).

Source de calcul : [REGISTRES.json](REGISTRES.json), snapshot 2026-10-11T22:10:00+02:00.

| Indicateur du registre             | Valeur |
| ---------------------------------- | ------ |
| features                           | 45     |
| automated_validated                | 31     |
| partial                            | 8      |
| historical_not_migrated            | 5      |
| bugs_open                          | 0      |
| bugs_fixed_validated               | 7      |
| bugs_fixed_user_validation_pending | 1      |
| regressions_documented             | 3      |
| security_risks                     | 7      |
| optimisations_done                 | 5      |
| optimisations_remaining            | 3      |
| planned_cases                      | 50     |
| case_passed                        | 37     |
| case_failed                        | 0      |
| case_blocked                       | 0      |
| case_not_executed                  | 13     |
| local_test_passages                | 0      |
| ci_test_passages                   | 888    |

Le nombre de fonctionnalités validées est 31 et celui des cas automatisés
représentatifs passés est 37 : des domaines partiels (dont FCT-028, FCT-030 et FCT-038) ont un
contrat livré testé, sans que leur livraison globale devienne complète. Les notions ne
doivent pas être mélangées. Les passages locaux sont à 0 : aucune suite locale n’est
enregistrée sur le commit analysé (EXE-001 à EXE-012 sont historiques, sur `c704fa6`).

Feux factuels : CI (EXE-013, 888 tests) et CodeQL (EXE-014) du commit analysé réussis sur `main` ;
conservation v2 non rejouée ici. Réserves : serveur et ergonomie non reçus, B2/E partiels,
cinq familles sans remplacement Sauge complet (fournisseurs, CRRC, investissements, incidents, revues d’accès),
performance et références officielles complètes non vérifiées.

Priorité immédiate : recette du serveur par le RSSI (TEST-041/042). Décision de livraison métier : PV en attente.
Les documents narratifs hors registres décrivent encore le commit `c704fa6` (voir l’index).
