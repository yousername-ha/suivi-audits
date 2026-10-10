# Historique des versions et modifications

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Source de référence unique : [CHANGELOG racine](../../CHANGELOG.md).
Ce fichier oriente la lecture ; il n’en duplique pas toutes les entrées.

| Repère                    | Modification                                                 | Preuve                                                     |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Base main v2              | Source conservée, sans changement de main                    | b148c1b ; archives/v2-manifest.json                        |
| Fondations v3/Sauge       | API/React, données et pont legacy                            | diagnostics d’intégration ; ADR 0001–0015                  |
| A/B et mises à jour       | Exploitation, activation, configurations et worker intégré   | ADR 0016–0022 ; commits dans JOURNAL_DE_BORD               |
| C                         | Référentiels/tâches/risques/carte                            | ADR 0023 ; migration 013/014                               |
| G/H/K et début E          | Pilotage métier et décisions                                 | ADR 0024 ; migration 015 ; 661309c                         |
| Préversion 3.0.2          | Menu, sauvegardes intégrées et fiabilisation updater/recette | tag v3.0.2 au commit fad0205                               |
| Non publié, c704fa6       | Optimisation GitHub Actions                                  | Trivy 6 → 3 ; concurrence CodeQL                           |
| Audit documentaire actuel | Index, registres et points d’entrée de reprise               | Commit documentaire local sur branche dédiée, sans release |

Dates exactes et notes de mise à jour : CHANGELOG racine et Git. Des versions
3.1.0 apparaissant dans des fixtures/recettes de montée sont des versions de
test, pas une publication de production annoncée.
