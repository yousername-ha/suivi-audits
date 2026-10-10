# État actuel

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Source centrale : [registre de référence](../08_PILOTAGE/REGISTRES.json). Lecture synthétique :
[PROJECT_STATUS](../../PROJECT_STATUS.md).

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

Le code applicatif analysé est la préversion 3.0.2 plus optimisation CI.
Le tag v3.0.2 pointe vers fad0205 (commit applicatif testé), tandis que c704fa6
modifie uniquement workflows et documentation. Aucun nouveau tag n’est créé ici.

Écrans métier récents : Pilotage et ses rubriques, documents, cartographie,
évaluations IA et administration. L’ancien écran /grc redirige vers /pilotage.
L’édition de certaines sources historiques s’effectue directement via adaptateurs
sans migration SQL complète. Seul maps est enregistré comme mapper LegacyStore.

Voir [comparaison](../02_FONCTIONNALITES/COMPARAISON_ANCIEN_NOUVEAU.md) pour les
familles encore historiques ; [recette](../05_RECETTE/RAPPORT_RECETTE.md) pour
les limites d’un état « validé ». Le serveur utilisateur n’a pas été observé.
