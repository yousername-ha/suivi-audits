# Tableau de bord du projet

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Source de calcul : [REGISTRES.json](REGISTRES.json), snapshot 2026-10-11T00:46:53+02:00.

| Indicateur du registre             | Valeur |
| ---------------------------------- | ------ |
| features                           | 40     |
| automated_validated                | 27     |
| partial                            | 6      |
| historical_not_migrated            | 6      |
| bugs_open                          | 0      |
| bugs_fixed_validated               | 5      |
| bugs_fixed_user_validation_pending | 1      |
| regressions_documented             | 3      |
| security_risks                     | 6      |
| optimisations_done                 | 5      |
| optimisations_remaining            | 3      |
| planned_cases                      | 45     |
| case_passed                        | 29     |
| case_failed                        | 0      |
| case_blocked                       | 0      |
| case_not_executed                  | 16     |
| local_test_passages                | 360    |
| ci_test_passages                   | 730    |

Le nombre de fonctionnalités validées est 27 et celui des cas automatisés
représentatifs passés est 29 : deux domaines partiels ont un contrat livré
testé, sans que leur livraison globale devienne complète. Les notions ne
doivent pas être mélangées.

Feux factuels : CI/CodeQL du code analysé réussis ; conservation v2 vérifiée ;
documentation produite localement. Réserves : serveur et ergonomie non reçus,
B2/E partiels, six familles sans remplacement Sauge complet, performance
et références officielles complètes non vérifiées.

Priorité immédiate : TEST-041/042. Décision de livraison métier : PV en attente.
main n’a pas changé, pas de fusion/release/push pendant cette mission.
