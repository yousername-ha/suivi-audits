# Conversion de l'accès aux données vers Kysely ([ADR 0062](../adr/0062-acces-aux-donnees-kysely.md))

Un module par pull request (ou un lot de petits modules). Chaque conversion garde les tests existants verts **avant et
après**, et ajoute les cas non couverts du module ; ces nouveaux tests doivent aussi réussir sur l'ancien code (preuve
d'équivalence). Les verrous consultatifs, `pg_notify` et `LISTEN` restent des appels SQL directs, comme les rares
requêtes que Kysely exprime mal (ADR 0062, §5), signalées dans le code.

Les modules GRC qui partageaient `objectColumns` (cœur, registres, risques, tâches) sont convertis ; la constante est retirée
(lot 7). Les autres modules restent indépendants les uns des autres.

Comptage : appels `.q(`, `.one(` et `.query(` restants par fichier (`apps/api/src`), relevé au 26/10/2026. Pour un module
converti, le nombre indiqué correspond aux appels SQL directs conservés volontairement.

| Module | Appels SQL restants | État |
|---|---:|---|
| `grc/tasks.ts` | 4 | Converti (lot 6) ; verrou consultatif et rappels (3 INSERT … SELECT) en SQL paramétré |
| `modules.ts` | 4 | Converti (lot 2) ; verrous consultatifs en SQL |
| `grc/dashboard.ts` | 3 | Reste en SQL paramétré (cartes de synthèse : FILTER, CTE) |
| `grc/risks.ts` | 3 | Converti (lot 5) ; verrou consultatif et projection temporelle (2 requêtes) en SQL paramétré |
| `tableau-de-bord.ts` | 3 | Converti (lot 24) ; agrégats du tableau de bord en SQL paramétré |
| `updates.ts` | 3 | Converti (lot 16) ; verrou consultatif en SQL |
| `business-policy.ts` | 2 | Converti (lot 2) ; verrou consultatif et pg_notify en SQL |
| `cli.ts` | 2 | Converti (lot 16) ; verrou consultatif en SQL |
| `grc/registre-risques.ts` | 2 | Converti (lot 22) ; registre et bibliothèque des sources (sous-requêtes corrélées jsonb) en SQL paramétré |
| `pilotage/service.ts` | 2 | Converti (lot 14) ; verrou consultatif et indicateurs (CTE) en SQL paramétré |
| `backups.ts` | 1 | Converti (lot 13) ; verrou consultatif en SQL |
| `grc/cartes.ts` | 1 | Reste en SQL paramétré (compteurs FILTER) |
| `grc/core.ts` | 1 | Converti (lot 4) ; pg_notify en SQL |
| `grc/plan-ecarts.ts` | 1 | Converti (lot 23) ; verrou consultatif en SQL |
| `notifications-metier.ts` | 1 | Converti (lot 11) ; héritages de réglages (unions) en SQL paramétré |
| `operations.ts` | 1 | Converti (lot 13) ; verrou consultatif en SQL |
| `tenacy.ts` | 1 | Converti (lot 24) ; verrou consultatif en SQL |
| `app.ts` | 0 | Converti (lot 25) |
| `auth.ts` | 0 | Converti (lot 15) |
| `calendriers-plateforme.ts` | 0 | Converti (lot 2) |
| `carto/maps.ts` | 0 | Converti (lot 18) |
| `config-grc.ts` | 0 | Converti (lot 10) |
| `conservation.ts` | 0 | Converti (lot 24) |
| `controle-relations.ts` | 0 | Converti (lot 21) |
| `documents-usage.ts` | 0 | Converti (lot 25) |
| `grc/annuaires.ts` | 0 | Converti (lot 3) |
| `grc/contributions.ts` | 0 | Converti (lot 23) |
| `grc/evaluations-exigences.ts` | 0 | Converti (lot 20) |
| `grc/frameworks.ts` | 0 | Converti (lot 20) |
| `grc/kit-ia.ts` | 0 | Converti (lot 23) |
| `grc/legacy-tasks.ts` | 0 | Converti (lot 25) |
| `grc/library-mappings.ts` | 0 | Converti (lot 20) |
| `grc/library.ts` | 0 | Converti (lot 8) |
| `grc/parcours.ts` | 0 | Converti (lot 20) |
| `grc/rapprochements.ts` | 0 | Converti (lot 12) |
| `grc/registres.ts` | 0 | Converti (lot 7) ; objectColumns retiré de core.ts |
| `grc/report.ts` | 0 | Converti (lot 25) |
| `grc/sources.ts` | 0 | Converti (lot 23) |
| `grc/study-config.ts` | 0 | Converti (lot 23) |
| `grc/suppliers.ts` | 0 | Converti (lot 3) |
| `grc/validations.ts` | 0 | Converti (lot 23) |
| `jeu-de-test.ts` | 0 | Converti (lot 24) |
| `journal-technique.ts` | 0 | Converti (lot 24) |
| `legacy/store.ts` | 0 | Converti (lot 22) |
| `pilotage/boites.ts` | 0 | Converti (lot 25) |
| `pilotage/legacy.ts` | 0 | Converti (lot 25) |
| `pilotage/objectifs.ts` | 0 | Converti (lot 25) |
| `pilotage/pestel.ts` | 0 | Converti (lot 25) |
| `pilotage/processus-cartes.ts` | 0 | Converti (lot 25) |
| `pilotage/revue.ts` | 0 | Converti (lot 24) |
| `rights.ts` | 0 | Converti (lot 21) ; agrégats ordonnés et ANY() en fragments fixes |
| `routes/access.ts` | 0 | Converti (lot 9) |
| `routes/admin.ts` | 0 | Converti (lot 19) ; version du serveur et comptages en SQL fixe |
| `routes/affichage.ts` | 0 | Converti (lot 25) |
| `routes/auth.ts` | 0 | Converti (lot 15) |
| `routes/carto.ts` | 0 | Converti (lot 18) |
| `routes/documents.ts` | 0 | Converti (socle et lot 17) |
| `routes/grc.ts` | 0 | Converti (lot 25) |
| `routes/import.ts` | 0 | Converti (lot 22) |
| `routes/modules.ts` | 0 | Converti (lot 25) |
| `routes/pilotage.ts` | 0 | Converti (lot 25) |
| `routes/settings.ts` | 0 | Converti (lot 19) |
| `settings.ts` | 0 | Converti (lot 19) |
| `startup.ts` | 0 | Converti (lot 25) |
| `systeme.ts` | 0 | Converti (lot 24) |
| `types-processus.ts` | 0 | Converti (lot 1) |
| `walls.ts` | 0 | Converti (lot 21) |
| `courriel.ts` | 20 | Dernier (FOR UPDATE, power(), LEAST) |
| `historique/tables/collection.ts` | 11 | À convertir |
| `historique/tables/invest.ts` | 7 | À convertir |
| `historique/tables/reglages.ts` | 3 | À convertir |
| `realtime.ts` | 3 | Reste en SQL (LISTEN/NOTIFY) |
| `historique/registre.ts` | 2 | À convertir |
| `historique/ecarts-natifs.ts` | 1 | À convertir |

Reste à convertir : 47 appels dans 7 fichiers.
