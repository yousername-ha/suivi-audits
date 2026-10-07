# Contribuer

## Règles du projet
- **Aucune donnée réelle** dans le dépôt (écarts, fournisseurs, processus, noms de personnes…), **aucun secret**, pas de fichier `.env`. Les fichiers de test sont anonymisés (`tests/fixtures/`).
- Interface et documentation **en français**.
- Toute modification passe par une **branche** et une **pull request** vers `main`, avec une CI verte. Personne ne pousse directement sur `main`.
- **Aucune nouvelle dépendance** sans justification dans une ADR (`docs/adr/0009-dependances-et-versions.md`, ou une nouvelle ADR).
- Une PR qui touche l'installation, la configuration, la mise à jour ou l'exploitation **met à jour `docs/INSTALLATION.md` dans la même PR**. Le job CI « guide » rejoue ce guide et échoue s'il est inexact.
- Une migration publiée (`apps/api/migrations/NNN_*.sql`) n'est **jamais modifiée** : on en ajoute une nouvelle.

## Messages de commit : Conventional Commits
Format : `type(portée): résumé à l'impératif, en français`.

| Type | Usage | Effet sur la version |
|---|---|---|
| `feat` | nouvelle fonctionnalité | MINEUR |
| `fix` | correction | CORRECTIF |
| `security` | correctif de sécurité | CORRECTIF (mentionné dans « Sécurité » du CHANGELOG) |
| `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore` | sans changement de comportement | aucun |
| `!` après le type, ou pied `BREAKING CHANGE:` | rupture (configuration, API, migration non rétrocompatible) | MAJEUR |

Portées usuelles : `api`, `web`, `shared`, `legacy`, `import`, `auth`, `docker`, `ci`, `docs`.
Exemple : `feat(api): reprise du module findings en tables normalisées`.

Un commit ou une PR qui traite une exigence de [docs/BACKLOG-FONCTIONNEL.md](docs/BACKLOG-FONCTIONNEL.md) cite son identifiant, dans le résumé ou en pied de message : `feat(crrc): catalogue des offres (CRRC-01)`, ou `Exigences : CRRC-03, CRRC-04`.

## Versions et publication
- Versionnage sémantique `MAJEUR.MINEUR.CORRECTIF`. Phase 0 : `3.0.0`.
- Pour publier : mettre à jour `CHANGELOG.md` (section `[Non publié]` renommée avec le numéro), et la version des `package.json` dans une PR. Après la fusion, créer l'étiquette `vX.Y.Z` sur `main`. Le workflow `release.yml` publie alors les images signées sur GHCR.
- Les images ne sont **jamais** publiées depuis une branche.

## Organisation du dépôt
Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) § 2. En résumé : `packages/shared` (schémas zod, format legacy), `apps/api` (Fastify), `apps/web` (React), `tests/e2e` (Playwright), `app/public/index.html` (outil historique).

## Environnement de développement
Prérequis : Node 24, pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
pnpm dev                                    # = docker compose -f docker-compose.dev.yml up
# interface : http://localhost:5173 — premier jeton : docker compose -f docker-compose.dev.yml logs api | grep -A3 JETON
```

## Vérifications avant une pull request

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
docker run -d --name pgtest -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:17-alpine   # une fois
pnpm test                                   # paquet partagé, puis API sur PostgreSQL (TEST_PG_HOST, TEST_PG_PORT…)
```

Tests de bout en bout, sur la pile Docker construite localement :

```bash
cp .env.example .env && sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=localhost/; s/^APP_VERSION=.*/APP_VERSION=local/' .env
docker compose -f docker-compose.yml -f docker-compose.build.yml build && docker compose up -d
./tests/e2e/run-in-container.sh                     # conteneur Playwright officiel (rendu identique à la CI)
docker compose down -v
```

Rejouer le guide d'installation (comme la CI) : `node scripts/ci/guide-extraire.mjs docs/INSTALLATION.md nom_dns=localhost version=ci` produit le script exécuté par le job « guide ». Chaque bloc ```` ```bash ```` du guide doit porter un marqueur `<!-- ci: run -->`, `<!-- ci: skip — raison -->` ou `<!-- ci: instead: commande -->` (voir l'en-tête du script).

## Charte graphique et captures de référence
- Couleurs, espacements, rayons et largeurs viennent de `packages/ui` (ADR 0011). Le test `apps/web/test/charte.test.ts` refuse toute valeur codée en dur dans l'interface.
- Les pages Paramètres et Administration sont comparées à des captures de référence (1440, 768 et 390 px, clair et sombre), dans `tests/e2e/specs/__captures__/`. Après une évolution visuelle voulue : `./tests/e2e/run-in-container.sh --update-snapshots`, puis relire les images modifiées dans la PR.

## Ajouter une route d'API
1. La déclarer avec `route()` (`apps/api/src/http/route.ts`) : niveau d'accès (`any`, `rw`, `admin`…), schémas zod d'entrée et de sortie (dans `packages/shared` s'ils servent à l'interface).
2. Journaliser les actions sensibles (`svc.db.audit(...)`).
3. Pour une modification d'enregistrement : `If-Match` et `version` (`apps/api/src/http/concurrency.ts`).
4. Tester : accès refusé aux rôles insuffisants, CSRF, validation.

## Reprendre un module de l'outil historique
Voir [ADR 0007](docs/adr/0007-transition-legacy.md) : migration des tables, `ModuleMapper` enregistré dans `apps/api/src/legacy/store.ts`, mise à jour de `docs/legacy/MAPPING-LEGACY.md` (colonne « Cible »), test d'aller-retour sur la fixture.
