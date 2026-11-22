# Travaux réalisés et preuves

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

| Travaux                                                  | Trace Git / source                                       | Validation accessible                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Conservation v2 et intégration Sauge                     | historique Git ; diagnostic integration-sauge | 44 fichiers comparés aux blobs ; 326 fonctions conservées ; 5 bibliothèques identiques. |
| A3/A4/A5/A6 : connexion, déconnexion, aide, cartographie | 0e45380 ; diagnostic fiabilisation                       | Tests unitaires et parcours de CI ; les échecs intermédiaires restent documentés.       |
| A1/A2 : sauvegarde, restauration, TLS                    | f909a61, 4901e86, 9c2dd8a ; ADR 0016–0018                | Recettes lot A du guide, restauration et rollback CI.                                   |
| Dépendances HIGH                                         | 69e6782 ; diagnostic dependances-high                    | Drizzle 0.45.2, Caddy compilé Go 1.26.9 ; scans CI au commit courant verts.             |
| B1 et B2a/B2b                                            | 86bf4ca, bfce9da, e5425b8                                | Activation, publication immuable, IA ; B2 complet non revendiqué.                       |
| Mise à jour intégrée                                     | 0e4a136 et correctifs suivants ; ADR 0020                | Navigation, maintenance persistante, vrai updater et rollback CI.                       |
| C : référentiels, tâches, risques/carte                  | 1a9c128, b8caf58, 553be29 ; ADR 0023                     | Tests serveur et navigateur, méthodes distinctes et sources protégées.                  |
| Pilotage G/H/K, début E                                  | 661309c ; ADR 0024                                       | Contrôles/preuves/efficacité/parcours/BIA ; source et limites des grilles explicites.   |
| Menu et sauvegarde intégrée                              | cc285b4                                                  | Clic à plusieurs tailles, sauvegarde réelle sans cron dans systeme.spec.ts.             |
| Recette updater/verrous/captures                         | cb827c4, f6a52bb, fad0205                                | CI finale ; modifications de synchronisation, pas d’assouplissement des assertions.     |
| Optimisations CI                                         | c704fa6                                                  | Trivy 6 → 3 et concurrence CodeQL ; CI/CodeQL verts en tentative 1.                     |
| Audit/transmission présent                               | modifications documentaires locales                      | 360 tests sûrs, archive, API et contrôles documentaires ; aucune opération production.  |

Sources historiques détaillées conservées dans [diagnostics](../archive/diagnostics)
et [CHANGELOG](../../CHANGELOG.md). Un titre de commit ne suffit pas à
prouver un correctif : voir [bugs et tests](../04_QUALITE/REGISTRE_BUGS.md).

## Module Vulnérabilités (mise à jour du 22/11/2026, Europe/Paris)

Session « Module surveillance vulnérabilités SMSI ». Voir la [reprise du 22/11/2026](REPRISE-2026-11-22.md) et celle du [20/11/2026](REPRISE-2026-11-20.md) ; contrôles tirés
des descriptions des PR, non rejoués pour cette mise à jour.

| Travaux | Trace Git / source | Validation accessible |
| --- | --- | --- |
| Lots R1, L1, I1 et F1 (recherche, pastilles de source, intégrations dans la page Plateforme, fréquences ; migration `090`) | PR #326 ; addenda de l'ADR 0100 | Tests unitaires et ciblés de l'API, parcours navigateur sur pile locale sans Docker ; CI de la PR. |
| Lots N1 et N2 (import `.nessus`, logiciel malveillant, suppression d'un connecteur d'import, 30 imports par heure ; migrations `093` et `094`) | PR #331 ; addenda de l'ADR 0100 | Suite API complète verte (207 fichiers, 1 698 tests) avant la dernière reprise de la base ; format non vérifié sur un export réel. |
| Lots SI1 et SI2 (import Silène, carte de la surface externe à deux sources en page entière ; migration `095`) | PR #333 ; addenda de l'ADR 0100 | Suite API complète verte après SI1 (209 fichiers, 1 712 tests) ; forme de l'export relevée sans valeurs. |
| PERF-01 à PERF-04, ASSISTANT-V1, PRIO-1, AD-1, VR-1 (migrations `097` à `099`) ; PERF-13 | PR #342, #344, #346, #347, #353 ; versions 7.5.0 et 7.5.1 | CI de chaque PR verte avant fusion. |
| Page « Machines » depuis « Périmètres », TEN-SCORES (migration `100`), CPE-1 (migration `101`) | PR #357, #359, #362 ; addenda de l'ADR 0100 ; [reprise du 22/11/2026](REPRISE-2026-11-22.md) | CI de chaque PR verte avant fusion ; durées du dictionnaire CPE calculées, non mesurées. |
