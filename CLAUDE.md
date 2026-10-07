# CLAUDE.md — Suivi des audits SMSI ISO 27001 / HDS

Outil interne du GCS Normand'e-Santé (RSSI). Interface et documentation **en français**.

## Architecture
- `docker-compose.yml` : `proxy` (Caddy 2, HTTPS, seul service exposé) → `app` (Node 24, dépendance unique `pg`) → `db` (PostgreSQL 17-alpine).
  `init` : service ponctuel (root, sans réseau) qui génère les secrets dans le volume `secrets` (`app/src/init-secrets.js`).
  Réseaux `edge` et `backend` internes (aucune sortie Internet pour app et db).
- `app/src/` : serveur HTTP sans framework (`server.js` routage et pages, `api.js` routes, `auth.js` sessions/MFA/jeton d'installation (`setup-token.js` : format et vérification),
  `security.js` scrypt/TOTP/AES-256-GCM, `files.js` contrôle des dépôts et ClamAV, `db.js` pool et migrations, `cli.js` exploitation).
- `app/src/migrations/NNN_*.sql` : appliquées automatiquement au démarrage (table `schema_migrations`). Ne jamais modifier une migration publiée : en ajouter une nouvelle.
- `app/web/` : pages connexion, installation, compte, administration, documents. CSP stricte : **aucun script ni style en ligne**, aucun attribut `style=`.
- `app/public/index.html` : outil de suivi historique (artefact claude.ai monofichier, ~3 Mo). Ne pas le réécrire : il est adapté au démarrage par `buildAppIndex()` et `web/assets/shim.js` (remplace `window.claude`). Mise à jour via `scripts/update-ui.sh`.
- `app/seed/state.json` et le bloc `<script id="seed">` de `index.html` : état **vide** (référentiels seulement, `schema` 14).

## Règles
- **Aucune donnée réelle dans le dépôt** (écarts, fournisseurs, processus, noms de personnes…), aucun secret, pas de `.env`.
- Sécurité non négociable : TOTP obligatoire, cookie `__Host-` SameSite=Strict, jeton CSRF + contrôle d'origine sur toute requête modifiante,
  journal d'audit en ajout seul (`db.audit`), conteneurs en lecture seule, `cap_drop: ALL`.
- Toute nouvelle route : vérifier le rôle (`auth.requireRole`), journaliser les actions sensibles, valider les entrées.
- Pas de nouvelle dépendance npm sans nécessité forte.
- Travailler sur une branche et ouvrir une pull request ; ne jamais pousser directement sur `main`.

## Commandes
```bash
cp .env.example .env && sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=localhost/' .env
docker compose build && docker compose up -d
docker compose exec app setup-token               # nouveau jeton d'installation → https://localhost/setup
docker compose logs app | grep -A3 JETON          # jeton émis au démarrage (en clair dans les journaux)
cd app && npm test                                 # tests unitaires (node:test, sans base)
docker compose exec app node src/cli.js users
docker compose down -v                             # remise à zéro complète (supprime les volumes)
```
Sans Docker : PostgreSQL local + `SECRETS_DIR=<dossier> DB_HOST=127.0.0.1 COOKIE_SECURE=false node src/server.js` (voir `init-secrets.js` pour générer les secrets).

## Points à surveiller
Le premier démarrage avec les images officielles (`postgres:17-alpine` en `read_only`, capacités ajoutées, lecture des secrets par les uid 70 et 1000) est vérifié par la CI (`.github/workflows/ci.yml`, job « Démarrage de la pile Docker »). En cas d'échec, lire `docker compose logs init db app`.
