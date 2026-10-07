# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Numérotation : [versionnage sémantique](https://semver.org/lang/fr/) (`MAJEUR.MINEUR.CORRECTIF`). Chaque version publiée correspond à une étiquette `vX.Y.Z` et aux images `ghcr.io/yousername-ha/suivi-audits-api` et `suivi-audits-web` de même numéro.

## [Non publié]

## [3.0.0] — Phase 0 : fondations

Nouvelle architecture. La mise à jour depuis la v2 conserve la base, les secrets et les certificats : voir `docs/INSTALLATION.md`, étape 12.3.

### Ajouté
- Monorepo TypeScript strict (pnpm) : API Fastify (`apps/api`), interface React + Vite + Mantine (`apps/web`), schémas zod partagés (`packages/shared`).
- Description OpenAPI 3.1 générée depuis les déclarations de routes (`/api/openapi.json`).
- Concurrence par enregistrement : colonne `version`, `ETag`, `If-Match` obligatoire (428), 412 seulement si l'enregistrement a changé.
- Temps réel : `/api/events` (SSE) alimenté par LISTEN/NOTIFY, filtré par rôle, avec reconnexion automatique ; indicateur de présence.
- Nouvelle interface : installation, connexion et double authentification, mon compte, administration (comptes, sessions, journal, versions, import, système), documents et liens.
- Import et export legacy : simulation sans écriture avec rapport téléchargeable, modes Initialiser, Fusionner et Remplacer un module, sauvegarde préalable, annulation, export au schéma 15. Contrat `LEGACY-FORMAT.md` couvert à 100 %, `MAPPING-LEGACY.md`.
- Outil historique : schéma 15 (identifiants stables sur 9 listes) et bouton « Exporter pour la nouvelle version ». Il est servi sous `/legacy`, avec l'état recomposé et le refus des écritures sur les modules repris.
- Images `suivi-audits-api` et `suivi-audits-web` publiées sur GHCR à chaque étiquette, signées avec cosign, avec un SBOM CycloneDX attesté.
- CI : ESLint, Prettier, typage, Vitest (PostgreSQL 17), Playwright, Trivy, SBOM, CodeQL. Le job « guide » rejoue le guide d'installation sur un runner vierge.
- Guide d'installation pour débutant (`docs/INSTALLATION.md`), architecture, feuille de route, ADR.
- `docker-compose.dev.yml` (rechargement à chaud) et `docker-compose.build.yml` (construction locale des images).

### Modifié
- Le frontal (`web`, ex-`proxy`) tourne sans privilège (uid 1001, ports internes 8080 et 8443) et sert l'interface. Le service `init` lui remet la propriété des volumes de certificats.
- Les commandes d'exploitation deviennent `docker compose exec app suivi <commande>` (au lieu de `node src/cli.js`). `docker compose exec app setup-token` est inchangé.
- Déploiement par images versionnées (`APP_VERSION` dans `.env`, `docker compose pull`) au lieu d'une construction sur le serveur.

### Sécurité
- Toutes les protections de la v2 sont conservées : TOTP obligatoire avec anti-rejeu, cookie `__Host-` SameSite=Strict, CSRF et contrôle d'origine, verrouillage, audit en ajout seul, AES-256-GCM, conteneurs en lecture seule avec `cap_drop: ALL`.
- La CSP de la nouvelle interface interdit tout script et tout style en ligne (vérifié par les tests de bout en bout).

## [2.0.0]
- Déploiement Docker (Caddy, Node 24, PostgreSQL 17) de l'outil historique : authentification avec TOTP, jeton d'installation, documents chiffrés, journal d'audit, sauvegardes.
