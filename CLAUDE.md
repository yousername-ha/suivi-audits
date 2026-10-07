# CLAUDE.md — Suivi des audits SMSI ISO 27001 / HDS

Outil interne du GCS Normand'e-Santé (RSSI). Interface et documentation **en français**.
Refonte en cours : la nouvelle application (v3) reprend module par module l'outil historique, servi sous `/legacy` ([docs/ROADMAP.md](docs/ROADMAP.md)).

## Architecture (détails : docs/ARCHITECTURE.md, décisions : docs/adr/)
- Monorepo pnpm, TypeScript strict, Node 24 :
  - `packages/shared` : schémas zod partagés, rôles, format du jeton d'installation ; format legacy (`src/legacy/` : lecture, schéma 15, contrat généré depuis `docs/legacy/LEGACY-FORMAT.md`, planification d'import en fonctions pures).
  - `apps/api` : Fastify, Drizzle (typage) et SQL. Routes déclarées par `route()` (`src/http/route.ts` : accès, CSRF, zod, OpenAPI). Sessions, TOTP et jeton d'installation dans `src/auth.ts` ; crypto (scrypt, TOTP, AES-256-GCM) dans `src/security/` ; temps réel (SSE + LISTEN/NOTIFY, présence) dans `src/realtime.ts` ; outil historique et modules repris dans `src/legacy/store.ts` ; commandes d'exploitation dans `src/cli.ts` ; secrets dans `src/init-secrets.ts`.
  - `apps/web` : React, Vite, React Router, TanStack Query (invalidée par SSE) et Mantine.
  - `tests/e2e` : Playwright sur la pile Docker.
- `apps/api/migrations/NNN_*.sql` : appliquées au démarrage (table `schema_migrations`, partagée avec la v2). **Ne jamais modifier une migration publiée** : en ajouter une nouvelle (`001_init.sql` = schéma v2, vérifié par empreinte).
- `docker-compose.yml` (production, images GHCR `${APP_VERSION}`) : `init` (secrets, droits des volumes, sans réseau) → `db` (PostgreSQL 17) → `app` (API, uid 1000) → `web` (Caddy uid 1001, seul service exposé, sert l'interface). Réseaux `edge` et `backend` internes. `docker-compose.build.yml` construit les images en local ; `docker-compose.dev.yml` sert au développement.
- `app/public/index.html` : outil historique (fichier unique, ~3 Mo, schéma 15). Il est servi sous `/legacy` avec `apps/api/legacy-shim/shim.js`, qui remplace `window.claude`. Ne pas le réécrire ; toute modification fait l'objet d'un commit séparé (mise à jour via `scripts/update-ui.sh`).
- `apps/api/seed/state.json` et le bloc `<script id="seed">` de `index.html` : état **vide** (référentiels seulement, `schema` 14).
- Charte graphique : `packages/ui` (jetons, thème clair et sombre, composants `Page`, `PageHeader`, `DataTable`, `FormSection`, `StatusChip`…), ADR 0011. **Aucune couleur ni aucun espacement codé en dur** dans `apps/web` (vérifié par `apps/web/test/charte.test.ts`). Contrastes WCAG AA vérifiés par `packages/ui/test/contraste.test.ts`.
- Tous les écrans (ADR 0012) : grilles `grille-cartes`, `maitre-detail`, `grille-formulaire`, colonnes par priorité (`col-p2`, `col-p3`) et `useColonnes` ; préférences d'affichage par personne côté serveur. Écran mural `/mur` : accès `mur` (session ou appareil activé), lecture seule.
- Interface : CSP stricte, **aucun script ni style en ligne**, pas d'attribut `style=` dans le HTML. Avec Mantine : pas d'`AppShell`, `lockScroll={false}`, pas de props de style « responsives » (ADR 0006). Playwright échoue sur toute violation de CSP.

## Règles
- **Aucune donnée réelle dans le dépôt** (écarts, fournisseurs, processus, noms de personnes…), aucun secret, pas de `.env`.
- Sécurité non négociable : droits vérifiés par le serveur à chaque requête (RBAC), TOTP obligatoire avec anti-rejeu, cookie `__Host-` SameSite=Strict, jeton CSRF et contrôle d'origine sur toute requête modifiante, journal d'audit en ajout seul (`db.audit`), conteneurs en lecture seule, `cap_drop: ALL`.
- Toute nouvelle route : déclarer sa permission `module:action` dans `route()` (liste unique : `packages/shared/src/permissions.ts`, ADR 0010), journaliser les actions sensibles, valider les entrées et les sorties (zod). Une route sans permission doit être ajoutée à la liste explicite de `apps/api/test/rbac.test.ts`. Modification d'enregistrement : `If-Match` et `version` (412 seulement si cet enregistrement a changé).
- Pas de nouvelle dépendance sans justification dans une ADR (`docs/adr/0009-dependances-et-versions.md`).
- **Toute PR qui touche l'installation, la configuration, la mise à jour ou l'exploitation met à jour `docs/INSTALLATION.md` dans la même PR.** Le guide est rejoué par le job CI « guide » : chaque bloc ```` ```bash ```` porte un marqueur `<!-- ci: run | skip — raison | instead: commande -->` (voir `scripts/ci/guide-extraire.mjs`).
- Exigences fonctionnelles : `docs/BACKLOG-FONCTIONNEL.md`. Citer leur identifiant (`CRRC-01`, `INV-02`, `INC-03`…) dans chaque commit et chaque PR qui les traite.
- Conventional Commits en français ; CHANGELOG tenu à jour ; versionnage sémantique (étiquette `vX.Y.Z` = publication GHCR).
- Travailler sur une branche et ouvrir une pull request ; ne jamais pousser ni fusionner directement sur `main`.

## Commandes
```bash
pnpm install                                        # Node 24, pnpm 10
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
docker run -d --name pgtest -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:17-alpine
pnpm test                                           # Vitest : shared, puis API sur PostgreSQL (TEST_PG_*)
pnpm --filter @suivi/shared gen:contract            # après modification de docs/legacy/LEGACY-FORMAT.md
pnpm dev                                            # docker-compose.dev.yml : http://localhost:5173

# Pile complète construite localement + tests de bout en bout
cp .env.example .env && sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=localhost/; s/^APP_VERSION=.*/APP_VERSION=local/' .env
docker compose -f docker-compose.yml -f docker-compose.build.yml build && docker compose up -d
docker compose exec app setup-token                 # jeton d'installation → https://localhost/setup
./tests/e2e/run-in-container.sh                     # Playwright dans le conteneur officiel (captures de référence)
./tests/e2e/run-in-container.sh --update-snapshots  # après une évolution visuelle voulue : relire les captures
docker compose exec app suivi users                 # commandes d'exploitation : suivi help
docker compose down -v                              # remise à zéro complète (supprime les volumes)
node scripts/ci/guide-extraire.mjs docs/INSTALLATION.md nom_dns=localhost version=ci   # script du job « guide »
```

## Points à surveiller
- Le premier démarrage avec les images officielles (`postgres:17-alpine` en `read_only`, capacités ajoutées, lecture des secrets par les uid 70 et 1000, frontal uid 1001) est vérifié par la CI (job « pile » et job « guide »). En cas d'échec : `docker compose logs init db app web`.
- `cap_drop: ALL` interdit les binaires à capacités de fichier : le binaire Caddy est recopié sans `cap_net_bind_service` (ports internes 8080 et 8443).
- Phase 0 : aucun module legacy n'est encore repris (`ModuleMapper` vide) ; toutes les données legacy sont dans `app_state.data`.
