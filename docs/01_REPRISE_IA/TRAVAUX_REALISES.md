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
