# Diagnostic de l’existant

## Constat vérifié dans le code

| Élément | Preuve au SHA audité | Conséquence |
|---|---|---|
| Application HTML/JS avec API Python locale | `index.html`, `modules/`, `legacy_server.py` | Évolution additive ; aucune nouvelle application parallèle. |
| État métier JSON stocké dans SQLite | `legacy_server.py:69` et `:730` | Le modèle conceptuel proposé n’est pas une liste de tables SQL existantes. |
| Sessions, CSRF, permissions et périmètres côté serveur | `legacy_server.py:137`, `:165`, `:169`, `:217`, `:635` | Toute nouvelle collection exige projection, fusion et validation serveur. |
| Registres partagés | `legacy_server.py:17`, `modules/integration-core.js:213` | Réutiliser fournisseurs, processus, périmètres, rôles, preuves, actions, mesures de conformité. |
| Huit collections du registre des risques | `modules/risk-core.js:74`, `legacy_risks.py` | Risque, étude, scénario, évaluation, politique, traitement, mesure, décision restent distincts. |
| Quatre noms de méthodes | `modules/risk-core.js:15` | EBIOS RM, ISO 27005, MÉHARI et Personnalisée sont des libellés existants, pas quatre moteurs complets. |
| Politiques déjà versionnées | `modules/risk-core.js:139`, `legacy_risks.py` | Ne pas reconstruire un second registre des politiques ni perdre les identifiants actuels. |
| Matrices configurables, revalidées côté serveur | `modules/risk-core.js:299`, `legacy_risks.py` | Les valeurs par défaut ne constituent pas un barème ANSSI. Le calcul uniforme n’est pas imposé. |
| Évaluations, politiques et décisions immuables | `legacy_risks.py` | Préserver les snapshots ; compléter par liaisons ou nouvelles versions, sans réécriture historique. |
| Cinq ateliers sous forme de zones de texte | `modules/risk-ui.js:122–173`, `:905` | Structurer les livrables et relations ; conserver les anciens textes comme notes héritées. |
| SR, événement redouté, supports textuels | `modules/risk-core.js:270–296`, `modules/risk-ui.js:207` | Introduire des références typées et conserver le texte d’origine lorsqu’un rapprochement est ambigu. |
| Annexe A ISO 27001:2022 reliée aux risques | `modules/risk-core.js:211`, `legacy_risks.py` | Garder les `objectRefs` bidirectionnels. Une association ne prouve ni conformité ni réduction du risque. |
| Concurrence optimiste | `legacy_server.py:735` | Préserver le rejet 409 ; aucune fusion automatique de validations concurrentes. |

Ces lignes sont des repères au SHA d’audit. L’agent doit rechercher les symboles au SHA de son départ et consigner les écarts. `docs/ARCHITECTURE.md` est historique : ne pas en déduire que le serveur n’existe pas.

## Manques observés et limites de l’audit

Il manque un registre explicite des versions de méthodes, une résolution transversale des configurations et un ensemble d’objets structurés pour les cinq ateliers. Les études n’épinglent pas aujourd’hui un bundle complet de méthode et de configurations ; les évaluations épinglent déjà leur politique. Le registre actuel de scénarios mélange plusieurs types, dont « Source de risque » et « Événement redouté » : distinguer à terme leurs concepts, sans déplacer automatiquement les historiques.

Aucun registre canonique général d’actifs, de valeurs métier ou de supports n’a été identifié dans les modules examinés. L’agent doit compléter l’inventaire des collections suivies par Git avant création : une absence dans cette lecture ciblée n’est pas une preuve d’absence dans tout le dépôt. `suppliers` existe mais n’apparaît pas dans le dictionnaire `LegacyIntegration.collections()` examiné : ajouter un adaptateur, pas un deuxième fournisseur.

Les périmètres de visibilité existent ; une isolation complète par organisation indépendante n’est pas démontrée. Ne pas assimiler automatiquement établissement, GHT, tenant et organisation propriétaire. Leur correspondance doit être explicitement définie avant activation multi-organisation.

Les fichiers non suivis `apps/`, `packages/` et `tests/e2e/` sont étrangers à ce travail et ne fondent pas le diagnostic. Aucune base réelle `.legacy-data` n’a été auditée.

## Préserver impérativement

La cartographie dynamique, son interface, ses données et ses interactions restent intactes : `modules/carto-core.js`, `modules/carto-ui.js`, `modules/carto.css`, `legacy_cartography.py`, routes `carto` et `dash/map`, éléments `dmap`, `mb-ctx`, `mb-proc`. Les nouvelles matrices et graphes EBIOS sont isolés dans la gestion des risques.

Conserver les fonctions de conformité, audits, PCRA, plans d’action, tâches récurrentes, preuves, administration et parcours existants. La refonte ne vaut pas validation des maquettes précédentes et ne remplace aucun registre d’actions ou de preuves.
