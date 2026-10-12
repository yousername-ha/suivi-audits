# Tableau de bord du projet

Référence applicative analysée : `70ab3f09c4937d8445b8c02402956cd835f380d3`. Mise à jour : 2026-10-12T17:00:00+02:00 (Europe/Paris).

Source de calcul : [REGISTRES.json](REGISTRES.json), snapshot 2026-10-12T17:00:00+02:00.

| Indicateur du registre             | Valeur |
| ---------------------------------- | ------ |
| features                           | 45     |
| automated_validated                | 31     |
| partial                            | 8      |
| historical_not_migrated            | 5      |
| bugs_open                          | 1      |
| bugs_fixed_validated               | 8      |
| bugs_fixed_user_validation_pending | 1      |
| regressions_documented             | 3      |
| security_risks                     | 7      |
| optimisations_done                 | 5      |
| optimisations_remaining            | 3      |
| planned_cases                      | 51     |
| case_passed                        | 39     |
| case_failed                        | 0      |
| case_blocked                       | 0      |
| case_not_executed                  | 12     |
| local_test_passages                | 0      |
| ci_test_passages                   | 898    |

Le nombre de fonctionnalités validées est 31 et celui des cas automatisés
représentatifs passés est 39 : des domaines partiels (dont FCT-028, FCT-030, FCT-038 et FCT-044) ont un
contrat livré testé, sans que leur livraison globale devienne complète. Les notions ne
doivent pas être mélangées. Les passages locaux sont à 0 : aucune suite locale n’est
enregistrée sur le commit analysé (EXE-001 à EXE-012 sont historiques, sur `c704fa6`).

Feux factuels : CI (EXE-015, 898 tests) et CodeQL (EXE-016) du commit analysé réussis sur `main` ;
recette du serveur automatisée exécutée en CI (EXE-017, 24 contrôles). Réserves : recette sur le serveur du RSSI non
reçue (TEST-041/045 : script prêt), ergonomie humaine non reçue (TEST-042), BUG-010 ouvert (sept écarts visuels
d’accessibilité reportés à la demande du RSSI), B2/E partiels, cinq familles sans remplacement Sauge complet
(fournisseurs, CRRC, investissements, incidents, revues d’accès), références officielles non vérifiées.

Priorité immédiate : lancer `scripts/recette-serveur.sh` sur le serveur du RSSI (TEST-041) puis la recette humaine
(TEST-042). Décision de livraison métier : PV en attente.
Les documents narratifs hors registres décrivent encore le commit `c704fa6` (voir l’index).
