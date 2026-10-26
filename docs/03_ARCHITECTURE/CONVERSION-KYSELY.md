# Conversion de l'accès aux données vers Kysely ([ADR 0062](../adr/0062-acces-aux-donnees-kysely.md))

Un module par pull request (ou un lot de petits modules). Chaque conversion garde les tests existants verts **avant et
après**, et ajoute les cas non couverts du module ; ces nouveaux tests doivent aussi réussir sur l'ancien code (preuve
d'équivalence). Les verrous consultatifs, `pg_notify` et `LISTEN` restent des appels SQL directs, comme les rares
requêtes que Kysely exprime mal (ADR 0062, §5), signalées dans le code.

Ordre : `objectColumns` (`grc/core.ts`) reste exporté tant que des modules non convertis l'utilisent, puis il sera retiré.

Comptage : appels `.q(`, `.one(` et `.query(` restants par fichier (`apps/api/src`), relevé au 26/10/2026. Pour un module
converti, le nombre indiqué correspond aux appels SQL directs conservés volontairement.

| Module | Appels SQL restants | État |
|---|---:|---|
| `modules.ts` | 4 | Converti (lot 2) ; verrous consultatifs en SQL |
| `business-policy.ts` | 2 | Converti (lot 2) ; verrou consultatif et pg_notify en SQL |
| `grc/core.ts` | 1 | Converti (lot 4) ; pg_notify en SQL ; objectColumns gardé pour registres et tâches |
| `grc/risks.ts` | 1 | Converti (lot 5) ; verrou consultatif et projection temporelle (2 requêtes) en SQL paramétré |
| `calendriers-plateforme.ts` | 0 | Converti (lot 2) |
| `grc/annuaires.ts` | 0 | Converti (lot 3) |
| `grc/suppliers.ts` | 0 | Converti (lot 3) |
| `types-processus.ts` | 0 | Converti (lot 1) |
| `grc/registres.ts` | 26 | À convertir |
| `routes/access.ts` | 21 | À convertir |
| `grc/library.ts` | 17 | À convertir |
| `config-grc.ts` | 15 | À convertir |
| `updates.ts` | 14 | À convertir |
| `courriel.ts` | 12 | Dernier (FOR UPDATE, power(), LEAST) |
| `pilotage/service.ts` | 12 | À convertir |
| `operations.ts` | 11 | À convertir |
| `auth.ts` | 10 | À convertir |
| `grc/tasks.ts` | 10 | À convertir |
| `routes/carto.ts` | 8 | À convertir |
| `routes/documents.ts` | 8 | Liens convertis (socle) ; documents à convertir |
| `routes/import.ts` | 8 | À convertir |
| `cli.ts` | 7 | À convertir |
| `historique/tables/collection.ts` | 7 | À convertir |
| `notifications-metier.ts` | 6 | À convertir |
| `backups.ts` | 5 | À convertir |
| `grc/frameworks.ts` | 5 | À convertir |
| `grc/library-mappings.ts` | 5 | À convertir |
| `grc/parcours.ts` | 5 | À convertir |
| `historique/tables/invest.ts` | 5 | À convertir |
| `legacy/store.ts` | 5 | À convertir |
| `routes/admin.ts` | 5 | À convertir |
| `routes/auth.ts` | 5 | À convertir |
| `carto/maps.ts` | 4 | À convertir |
| `jeu-de-test.ts` | 4 | À convertir |
| `grc/plan-ecarts.ts` | 3 | À convertir |
| `grc/rapprochements.ts` | 3 | À convertir |
| `realtime.ts` | 3 | Reste en SQL (LISTEN/NOTIFY) |
| `routes/settings.ts` | 3 | À convertir |
| `settings.ts` | 3 | À convertir |
| `app.ts` | 2 | À convertir |
| `grc/dashboard.ts` | 2 | À convertir |
| `grc/evaluations-exigences.ts` | 2 | À convertir |
| `grc/kit-ia.ts` | 2 | À convertir |
| `historique/registre.ts` | 2 | À convertir |
| `historique/tables/reglages.ts` | 2 | À convertir |
| `journal-technique.ts` | 2 | À convertir |
| `routes/affichage.ts` | 2 | À convertir |
| `routes/grc.ts` | 2 | À convertir |
| `routes/pilotage.ts` | 2 | À convertir |
| `controle-relations.ts` | 1 | À convertir |
| `grc/contributions.ts` | 1 | À convertir |
| `grc/legacy-tasks.ts` | 1 | À convertir |
| `grc/report.ts` | 1 | À convertir |
| `grc/validations.ts` | 1 | À convertir |
| `pilotage/legacy.ts` | 1 | À convertir |
| `pilotage/objectifs.ts` | 1 | À convertir |
| `pilotage/pestel.ts` | 1 | À convertir |
| `rights.ts` | 1 | À convertir |
| `routes/modules.ts` | 1 | À convertir |
| `startup.ts` | 1 | À convertir |
| `tenacy.ts` | 1 | À convertir |
| `walls.ts` | 1 | À convertir |

Reste à convertir : 288 appels dans 54 fichiers.
