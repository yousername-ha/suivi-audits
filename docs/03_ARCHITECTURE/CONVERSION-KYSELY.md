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
| `grc/risks.ts` | 3 | Converti (lot 5) ; verrou consultatif et projection temporelle (2 requêtes) en SQL paramétré |
| `business-policy.ts` | 2 | Converti (lot 2) ; verrou consultatif et pg_notify en SQL |
| `grc/core.ts` | 1 | Converti (lot 4) ; pg_notify en SQL |
| `notifications-metier.ts` | 1 | Converti (lot 11) ; héritages de réglages (unions) en SQL paramétré |
| `calendriers-plateforme.ts` | 0 | Converti (lot 2) |
| `config-grc.ts` | 0 | Converti (lot 10) |
| `grc/annuaires.ts` | 0 | Converti (lot 3) |
| `grc/library.ts` | 0 | Converti (lot 8) |
| `grc/registres.ts` | 0 | Converti (lot 7) ; objectColumns retiré de core.ts |
| `grc/suppliers.ts` | 0 | Converti (lot 3) |
| `routes/access.ts` | 0 | Converti (lot 9) |
| `types-processus.ts` | 0 | Converti (lot 1) |
| `grc/rapprochements.ts` | 21 | À convertir |
| `courriel.ts` | 20 | Dernier (FOR UPDATE, power(), LEAST) |
| `operations.ts` | 18 | À convertir |
| `backups.ts` | 16 | À convertir |
| `auth.ts` | 15 | À convertir |
| `pilotage/service.ts` | 15 | À convertir |
| `cli.ts` | 14 | À convertir |
| `routes/carto.ts` | 14 | À convertir |
| `routes/documents.ts` | 14 | Liens convertis (socle) ; documents à convertir |
| `updates.ts` | 14 | À convertir |
| `routes/admin.ts` | 13 | À convertir |
| `controle-relations.ts` | 11 | À convertir |
| `historique/tables/collection.ts` | 11 | À convertir |
| `routes/auth.ts` | 11 | À convertir |
| `routes/import.ts` | 11 | À convertir |
| `grc/library-mappings.ts` | 9 | À convertir |
| `legacy/store.ts` | 9 | À convertir |
| `carto/maps.ts` | 8 | À convertir |
| `grc/parcours.ts` | 8 | À convertir |
| `grc/registre-risques.ts` | 7 | À convertir |
| `historique/tables/invest.ts` | 7 | À convertir |
| `rights.ts` | 7 | À convertir |
| `grc/evaluations-exigences.ts` | 6 | À convertir |
| `grc/frameworks.ts` | 6 | À convertir |
| `settings.ts` | 6 | À convertir |
| `grc/contributions.ts` | 5 | À convertir |
| `jeu-de-test.ts` | 5 | À convertir |
| `routes/settings.ts` | 5 | À convertir |
| `walls.ts` | 5 | À convertir |
| `grc/kit-ia.ts` | 4 | À convertir |
| `grc/plan-ecarts.ts` | 4 | À convertir |
| `grc/sources.ts` | 4 | À convertir |
| `grc/study-config.ts` | 4 | À convertir |
| `grc/validations.ts` | 4 | À convertir |
| `pilotage/revue.ts` | 4 | À convertir |
| `tableau-de-bord.ts` | 4 | À convertir |
| `tenacy.ts` | 4 | À convertir |
| `conservation.ts` | 3 | À convertir |
| `grc/dashboard.ts` | 3 | À convertir |
| `historique/tables/reglages.ts` | 3 | À convertir |
| `journal-technique.ts` | 3 | À convertir |
| `realtime.ts` | 3 | Reste en SQL (LISTEN/NOTIFY) |
| `systeme.ts` | 3 | À convertir |
| `app.ts` | 2 | À convertir |
| `grc/report.ts` | 2 | À convertir |
| `historique/registre.ts` | 2 | À convertir |
| `pilotage/boites.ts` | 2 | À convertir |
| `pilotage/processus-cartes.ts` | 2 | À convertir |
| `routes/affichage.ts` | 2 | À convertir |
| `routes/grc.ts` | 2 | À convertir |
| `routes/pilotage.ts` | 2 | À convertir |
| `documents-usage.ts` | 1 | À convertir |
| `grc/cartes.ts` | 1 | À convertir |
| `grc/legacy-tasks.ts` | 1 | À convertir |
| `historique/ecarts-natifs.ts` | 1 | À convertir |
| `pilotage/legacy.ts` | 1 | À convertir |
| `pilotage/objectifs.ts` | 1 | À convertir |
| `pilotage/pestel.ts` | 1 | À convertir |
| `routes/modules.ts` | 1 | À convertir |
| `startup.ts` | 1 | À convertir |

Reste à convertir : 386 appels dans 60 fichiers.
