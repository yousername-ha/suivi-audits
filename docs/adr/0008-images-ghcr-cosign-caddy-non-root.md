# ADR 0008 — Images GHCR signées, frontal Caddy sans privilège

**Statut** : acceptée (phase 0)

## Contexte
Jusqu'ici, l'installation construisait les images sur le serveur : il fallait le code source et un accès au registre npm. La cible est un déploiement « docker compose pull && docker compose up -d ».

## Décision
- Deux images publiées sur GHCR **uniquement sur une étiquette `vX.Y.Z`** : `suivi-audits-api` (API, outils d'exploitation, outil historique) et `suivi-audits-web` (Caddy avec l'interface compilée).
- Elles sont **signées avec cosign** (sans clé, identité OIDC du workflow de publication) et accompagnées d'un SBOM CycloneDX attesté. Trivy bloque la publication en cas de vulnérabilité critique corrigeable.
- `docker-compose.yml` référence `ghcr.io/…:${APP_VERSION}` ; `docker-compose.build.yml` construit les mêmes images localement (CI, essais).
- Images multi-étapes, utilisateur non root, système de fichiers en lecture seule, `cap_drop: ALL`, sans npm à l'exécution.
- Caddy tourne sous l'utilisateur `caddy` (uid 1001) sur les ports internes 8080 et 8443, publiés sur 80 et 443. Son binaire est recopié **sans** la capacité de fichier `cap_net_bind_service` : inutile, et incompatible avec `cap_drop: ALL`.
- Les services `init` (génération des secrets) et `db` (image officielle PostgreSQL) gardent le fonctionnement validé en v2.

## Conséquences
- Mise à jour : changer `APP_VERSION`, puis `docker compose pull && docker compose up -d`.
- Si les images sont privées, le serveur doit se connecter à GHCR (jeton en lecture seule, voir `docs/INSTALLATION.md`).
