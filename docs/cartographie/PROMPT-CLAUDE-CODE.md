# Prompt à coller dans Claude Code

Claude Code ouvert sur le dépôt `yousername-ha/suivi-audits`. Copier tout le bloc ci-dessous.

```text
Tu travailles sur le dépôt suivi-audits (refonte v3 : monorepo pnpm, Fastify, React/Mantine, PostgreSQL 17, Docker).

PRÉPARATION
1. git fetch, puis place-toi sur la branche docs/cartographie (basée sur refonte/phase-0-ecrans, sommet des PR #2 à #5).
2. Lis CLAUDE.md, docs/ROADMAP.md, docs/ARCHITECTURE.md, docs/INSTALLATION.md, les ADR 0004 à 0012, puis :
   - docs/specs/EXPL-donnees-et-mises-a-jour.md (exigences EXPL-01 à EXPL-09) ;
   - docs/cartographie/SPEC-CARTOGRAPHIE-V3.md (exigences CARTO-01 à CARTO-14, elle l'emporte sur la maquette),
     docs/cartographie/RECETTE.md, docs/cartographie/reference-beta-legacy/ (module bêta validé dans l'outil
     historique : comportement, dispositions, contrat S.maps à reproduire) et docs/cartographie/maquette/.
3. Ajoute EXPL-01 à EXPL-09 et CARTO-01 à CARTO-14 dans docs/BACKLOG-FONCTIONNEL.md et deux chantiers dans
   docs/ROADMAP.md : « 9 quinquies — Données sur le serveur et mises à jour » puis « Cartographie ».

CHANTIER A — DONNÉES SUR LE SERVEUR ET MISES À JOUR (branche refonte/exploitation, depuis docs/cartographie)
- Objectif : aucune donnée dans les conteneurs ni dans des volumes nommés ; tout dans DATA_DIR
  (défaut /srv/suivi-audits/donnees) en montages bind, avec les bons propriétaires et droits ; données intactes après
  suppression des conteneurs, des images ou docker compose down -v.
- Script de migration des volumes nommés vers DATA_DIR (anciens volumes conservés jusqu'à confirmation).
- Script scripts/mettre-a-jour.sh : contrôles, notes de mise à jour, sauvegarde chiffrée obligatoire, vérification de
  la signature des images, migrations sous verrou, contrôle de santé, retour arrière automatique en cas d'échec
  (avec restauration si la base a été migrée), rapport et journal d'audit ; mode --verifier.
- Compatibilité : migrations en avant uniquement, changements destructifs en deux versions, GET /api/version,
  test CI de montée depuis la dernière version publiée avec retour arrière simulé.
- Administration > Système : version, historique des mises à jour, dernière sauvegarde (alerte > 48 h), espace disque,
  bandeau « nouvelle version disponible » alimenté par un script planifié sur le serveur (l'application n'a pas
  d'accès Internet ; aucune installation automatique).
- Adapte backup.sh, restore.sh, docker-compose*.yml, la CI et docs/INSTALLATION.md (rejoué en CI, y compris une
  mise à jour). Ouvre une PR vers refonte/phase-0-ecrans (ou main si la pile est déjà fusionnée).

CHANTIER B — CARTOGRAPHIE (branche refonte/cartographie, depuis refonte/exploitation)
1. ADR 0013 « Cartographie » d'abord : moteur SVG maison sans nouvelle dépendance, tables maps / map_versions,
   source d'objets par adaptateur (état legacy recomposé, puis tables quand les modules sont repris),
   relations graphiques et métier, choix par défaut des points à arbitrer (§ 6 de la spec).
2. packages/shared/src/carto/ : types, MapLayoutSchema (zod), relations dérivées, dispositions, génération,
   synchronisation, géométrie des liens, portés de reference-beta-legacy/carto.js (mbObjects, mbRelations,
   mbLayoutContext, mbLayoutProcess, mbProcessGenEdges, mbAnch, mbPath, mbSyncInfo, mbPlace) en fonctions pures,
   avec tests Vitest de parité avec la bêta.
3. Module de droits cartographie (CARTO-01), rôles et matrice de tests.
4. Migration SQL + Drizzle, routes API (If-Match, 412), temps réel SSE et présence, journal d'audit,
   mapper legacy « maps » (CARTO-03, 04, 14).
5. apps/web : page Cartographie (Vue contexte, Vue processus), canevas SVG, barre d'outils, assistant de génération,
   ajout depuis la plateforme, inspecteur, mode édition, versions, exports PNG/SVG/PDF/JSON ; jetons « carte » dans
   packages/ui (CARTO-05 à 13).
6. Playwright : les 20 parcours de RECETTE.md, captures 390 / 1920 / 3840 px, aucune violation CSP, lecture seule.
7. Mets à jour CHANGELOG.md (avec « Notes de mise à jour »), MAPPING-LEGACY.md, LEGACY-FORMAT.md, INSTALLATION.md.
Ouvre une PR vers refonte/exploitation.

CHANTIER C — MODULE BÊTA DANS L'OUTIL HISTORIQUE
La branche feat/cartographie-beta (basée sur main) : rebase-la sur refonte/phase-0-ecrans en deux commits
(1. app/public/index.html seul ; 2. scripts/carto/ et docs). Conflit attendu sur CLAUDE.md : garder la version de la
refonte et y ajouter la ligne scripts/carto/. scripts/carto/ est déjà exclu d'ESLint et de Prettier. Ouvre une PR.

RÈGLES
Français partout. Aucune donnée réelle (jeux fictifs uniquement), aucun secret, pas de .env commité. CSP stricte :
pas de style= (y compris dans le SVG), pas de script en ligne. Aucune couleur codée en dur dans apps/web.
Pas de nouvelle dépendance npm sans ADR et mon accord. Ne jamais modifier une migration publiée.
Travailler sur des branches et ouvrir des PR ; ne jamais pousser sur main. Citer EXPL-xx et CARTO-xx dans les commits.
Avant chaque PR : pnpm lint, format:check, typecheck, test, build au vert.
Pour chaque PR, résumé : exigences couvertes, tests, captures, notes de mise à jour, points restant à arbitrer.
Commence par le chantier A ; ne passe au B qu'une fois la PR A ouverte et sa CI au vert.
```
