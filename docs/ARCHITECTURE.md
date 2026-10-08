# Architecture — Suivi des audits SMSI ISO 27001 / HDS (v3)

Ce document décrit l'architecture cible et l'état livré en **phase 0** (fondations). Les choix structurants sont détaillés dans les [ADR](adr/README.md), et le découpage en phases dans la [feuille de route](ROADMAP.md).

## 1. Vue d'ensemble

```
          Postes utilisateurs (navigateur)
                    │ HTTPS 443  (80 : redirection)
   ┌────────────────▼─────────────────┐  réseau « public »
   │ web — Caddy 2 (uid 1001)         │  TLS (interne ou PKI), HSTS, CSP stricte,
   │  · interface React compilée      │  sert l'interface (SPA)
   │  · reverse proxy /api /legacy /d │
   └────────────────┬─────────────────┘
                    │ réseau « edge » (interne, sans sortie Internet)
   ┌────────────────▼─────────────────┐
   │ app — API Node 24 (uid 1000)     │  Fastify, sessions, TOTP, CSRF, rôles, audit,
   │  · /api (REST + OpenAPI)         │  documents chiffrés (AES-256-GCM),
   │  · /api/events (SSE)             │  temps réel, import legacy, outil historique
   │  · /legacy (outil historique)    │
   └────────────────┬─────────────────┘
                    │ réseau « backend » (interne, sans sortie Internet)
   ┌────────────────▼─────────────────┐      ┌──────────────────────────┐
   │ db — PostgreSQL 17               │      │ clamav (facultatif)      │
   │  LISTEN/NOTIFY → temps réel      │      │ analyse des dépôts       │
   └──────────────────────────────────┘      └──────────────────────────┘
   init : service ponctuel (root, sans réseau) — contrôle de DATA_DIR, secrets, droits des dossiers
```

| Service | Image | Rôle |
|---|---|---|
| `init` | `ghcr.io/yousername-ha/suivi-audits-api` | Contrôle le dossier des données (`DATA_DIR`), crée ses sous-dossiers avec propriétaires et droits, génère les secrets manquants. S'arrête. |
| `db` | `postgres:17-alpine` | Base unique. Aucun port publié. |
| `app` | `ghcr.io/yousername-ha/suivi-audits-api` | API, outil historique sous `/legacy`, commandes d'exploitation (`setup-token`, `suivi`). Désactive aussi les comptes arrivés à expiration. |
| `web` | `ghcr.io/yousername-ha/suivi-audits-web` | Caddy : TLS, en-têtes de sécurité, interface compilée, reverse proxy vers `app`. Seul service exposé. |
| `clamav` | `clamav/clamav` | Facultatif (`--profile antivirus`). |

Données : toutes dans le dossier du serveur `DATA_DIR` (montages bind, aucun volume nommé, [ADR 0014](adr/0014-donnees-sur-le-serveur-et-mises-a-jour.md)) : `postgres/` (base), `secrets/` (mots de passe de la base, clé maître des documents), `caddy/` (certificats, autorité interne), `clamav/`, `etat/` (rapports des scripts du serveur, lus par l'application). Mises à jour : `scripts/mettre-a-jour.sh` (sauvegarde, signature des images, santé, retour arrière automatique).

## 2. Dépôt (monorepo pnpm)

```
packages/ui       charte graphique : jetons, thème Mantine clair et sombre, styles statiques, composants communs
packages/shared   schémas zod partagés (API ⇄ interface), droits, paramètres, jeton d'installation,
                  format legacy : lecture, schéma 15, contrat, planification d'import (fonctions pures),
                  cartographie : objets, dispositions, génération, scène (fonctions pures, parité avec la bêta)
apps/api          API Fastify : src/ (routes, auth, sécurité, temps réel, legacy), migrations/ (SQL), test/ (Vitest + PostgreSQL)
apps/web          interface React + Vite + Mantine (CSP stricte)
app/public        outil historique (fichier unique), servi sous /legacy
tests/e2e         Playwright : parcours complets sur la pile Docker
docker/           Dockerfile des deux images et Caddyfile
scripts/          sauvegarde, restauration, mise à jour de l'outil historique, scripts de CI
docs/             architecture, feuille de route, ADR, installation, format legacy
```

## 3. API

- **Déclaration unique des routes** (`apps/api/src/http/route.ts`). Chaque route déclare :
  - son accès : `public`, `session`, `auth` (compte personnel), `metier` (au moins un module métier lisible) ou une **permission `module:action`** ([ADR 0010](adr/0010-droits-rbac.md)) ;
  - son exigence CSRF ;
  - ses schémas zod (corps, paramètres, réponse) ;
  - sa limite de taille.

  Le même point applique les contrôles (`requirePermission`) et génère l'OpenAPI 3.1 (`/api/openapi.json`, publié en artefact de CI).
- **Journaux** pino au format JSON (adaptés à un SIEM), avec masquage des cookies, des mots de passe, des codes et des jetons.
- **Commandes d'exploitation** : `docker compose exec app suivi <commande>` (`users`, `setup-token`, `reset-password`, `reset-mfa`, `unlock`, `disable`, `enable`, `sessions-purge`, `migrate`), et le raccourci `docker compose exec app setup-token`.

Routes livrées en phase 0 :

| Domaine | Routes |
|---|---|
| Installation | `GET/POST /api/setup` |
| Authentification | `GET /api/auth/me`, `POST /api/auth/login`, `/api/auth/mfa`, `/api/auth/logout` |
| Compte | mot de passe, enrôlement et désactivation TOTP, sessions |
| Documents et liens | `/api/documents` (versions, téléchargement `/d/…`), `/api/links` ; `PATCH` avec `If-Match` |
| Droits | comptes, groupes, rôles (matrice), droits effectifs avec leur origine, revue des accès CSV et Excel |
| Paramètres | huit sections versionnées (`/api/settings/:section`), logo de l'organisation |
| Administration | sessions, journal d'audit, versions de l'état, système |
| Import legacy | simulation, application, historique, fichier source, annulation, export au schéma 15 |
| Temps réel | `GET /api/events` (SSE), `POST /api/presence` |
| Affichage | préférences par personne (`/api/account/preferences`) ; écrans muraux (`/api/admin/murs`, `POST /api/mur/activer`) ; synthèse et flux de la vue `/mur` (`/api/mur/synthese`, `/api/mur/events`) |
| Outil historique | `/legacy/`, `/api/legacy/state`, `/api/legacy/modules`, `/api/refs` |
| Cartographie | objets de la plateforme filtrés par droits (`/api/carto/objects`), création et renommage d'objets depuis la carte, écrits dans leur module sous verrou (`POST /api/carto/objects`, `PUT /api/carto/objects/name`), cartes avec `If-Match` (`/api/carto/maps`), versions, nature des enjeux, journal des exports ([ADR 0013](adr/0013-cartographie.md), [ADR 0016](adr/0016-cartographie-creation-depuis-la-carte.md)) |

## 4. Données

- **PostgreSQL 17**. Migrations SQL versionnées (`apps/api/migrations`), appliquées au démarrage sous verrou consultatif, dans la table `schema_migrations` partagée avec la v2 ([ADR 0003](adr/0003-postgresql-drizzle-migrations-sql.md)).
- `001_init.sql` est le schéma v2, inchangé : comptes, sessions, paramètres, journal d'audit, état legacy et son historique, documents et versions, liens.
- `002_v3_fondations.sql` ajoute :
  - `import_batches` : traçabilité des imports (fichier source chiffré, rapport, états avant et après, annulation) ;
  - sur les tables métier : `version` (concurrence), `legacy_id`, `import_batch_id` et `extra` (champs legacy non repris, conservés) ;
  - les déclencheurs `suivi_notify()` (temps réel).
- `003_droits.sql` crée les rôles, les groupes et les attributions (`roles`, `groups`, `group_roles`, `user_groups`, `user_roles` avec portée), ajoute l'expiration des comptes et reprend les rôles v2 ([ADR 0010](adr/0010-droits-rbac.md)).
- `004_affichage_et_ecrans_muraux.sql` ajoute les préférences d'affichage et les écrans muraux.
- `005_cartographie.sql` crée `maps` et `map_versions` (présentation des cartes seulement) et reprend les cartes du module bêta (`S.maps`) : premier module repris dans des tables, avec son « mapper » (`apps/api/src/carto/maps.ts`, [ADR 0013](adr/0013-cartographie.md)).
- Le **journal d'audit** est en ajout seul : un déclencheur refuse `UPDATE` et `DELETE`.
- Les données de l'outil historique vivent dans `app_state.data` (document JSON versionné, historique dans `state_history`) jusqu'à la reprise de chaque module en tables normalisées (phases 1 à 3, [ADR 0007](adr/0007-transition-legacy.md)).

## 5. Temps réel et concurrence

- Toute écriture déclenche `pg_notify('suivi_events', {entité, id, version, opération, auteur})`. L'API relaie la notification en SSE aux sessions autorisées, sans aucune donnée métier ([ADR 0005](adr/0005-temps-reel-sse-listen-notify.md)).
- L'interface invalide le cache TanStack Query de l'entité concernée. Elle affiche la présence (qui consulte ou modifie quoi), renouvelée toutes les 20 s et expirée après 45 s.
- Modifications : `If-Match: "<version>"` obligatoire (sinon 428). La réponse est 412 avec la version courante **seulement** si ce même enregistrement a changé ([ADR 0004](adr/0004-concurrence-par-enregistrement.md)).

## 6. Modèle de sécurité

| Menace | Mesure |
|---|---|
| Vol ou devinette de mot de passe | scrypt (N=2¹⁶, paramètres OWASP), longueur minimale et 3 classes de caractères, **TOTP obligatoire** avec anti-rejeu (pas déjà accepté refusé), verrouillage après 5 échecs pendant 15 min, limitation de débit par IP |
| Prise de contrôle à l'installation | Pas de mot de passe par défaut : **jeton d'installation** à usage unique (24 h, ≈ 99 bits, seule son empreinte est stockée), émis au démarrage ou par `docker compose exec app setup-token` (accès au serveur requis) |
| Vol de session | Cookie `__Host-suivi_sid` (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`), identifiant aléatoire dont seule l'empreinte est stockée, expiration d'inactivité (30 min) et absolue (10 h), rotation à l'authentification, révocation par l'utilisateur ou l'administrateur |
| CSRF | Jeton CSRF lié à la session (`X-CSRF-Token`) **et** contrôle d'origine (`Origin`, `Referer`, `Sec-Fetch-Site`) sur toute requête modifiante |
| Élévation de privilèges | Permissions `module:action` exigées par le serveur sur chaque route, relues à chaque requête. Le test `rbac.test.ts` vérifie chaque route contre la matrice. Rôles prédéfinis immuables (déclencheur). Il reste toujours un administrateur permanent. Personne ne modifie ses propres droits. Toute modification est journalisée avant/après et coupe les sessions concernées. Comptes à expiration désactivés automatiquement. Temps réel et outil historique filtrés par module |
| Injection de script (XSS) | CSP stricte sur l'interface : `default-src 'self'; script-src 'self'; style-src 'self'`, aucun script ni style en ligne (vérifié par Playwright). Fichiers téléchargés servis avec `Content-Disposition: attachment`, `nosniff` et une CSP `sandbox`. L'outil historique a sa propre CSP, sans origine externe |
| Fichiers malveillants | Liste blanche d'extensions et de types, vérification des signatures (« magic bytes »), limite de taille, analyse ClamAV facultative (obligatoire si `CLAMAV_REQUIRED=true`) |
| Fuite de documents | Chiffrement AES-256-GCM par document, avec une clé dérivée de la clé maître (`DATA_DIR/secrets`, jamais en base). Données associées liées à l'identifiant du document |
| Traçabilité | Journal d'audit en ajout seul (connexions, échecs, administration, documents, imports, restaurations) ; historique des versions de l'état legacy, restaurable |
| Compromission d'un conteneur | Images non root, système de fichiers en lecture seule, `cap_drop: ALL`, `no-new-privileges`, limites mémoire et processus, aucune sortie Internet pour `app` et `db`, base non exposée |
| Chaîne d'approvisionnement | Dépendances figées (lockfile), Trivy (échec sur CRITICAL), SBOM CycloneDX, CodeQL, images signées par cosign avec SBOM attesté |
| Perte de données | `scripts/backup.sh` (base et secrets, chiffrés en AES-256, avec empreinte SHA-256), restauration testée en CI |

**Secrets** : ils sont générés par `init` dans `DATA_DIR/secrets`, chacun lisible par son seul consommateur (uid 70 pour PostgreSQL, uid 1000 pour l'API). Aucun secret n'est dans le dépôt, dans `.env` ni dans les images.

## 7. Transition depuis l'outil historique

L'outil historique reste servi sous `/legacy`, sans modification fonctionnelle hors schéma 15 et export pour la nouvelle version. `window.claude` y est remplacé par un adaptateur (`apps/api/legacy-shim/shim.js`) : enregistrement sur le serveur avec contrôle de version, avertissement temps réel, menu vers la nouvelle interface.

L'import et l'export (`docs/legacy/IMPORT-LEGACY.md`, `docs/legacy/MAPPING-LEGACY.md`) sont décrits dans l'[ADR 0007](adr/0007-transition-legacy.md).

## 8. Livraison

- **CI** (`.github/workflows/ci.yml`) : ESLint, Prettier, typage strict, construction, OpenAPI. Puis Vitest sur PostgreSQL 17, construction des images, Trivy, SBOM, pile complète et Playwright. Le job **guide** rejoue `docs/INSTALLATION.md` sur un runner vierge. CodeQL tourne dans `codeql.yml`.
- **Publication** (`release.yml`) : uniquement sur une étiquette `vX.Y.Z`. Elle publie sur GHCR les images signées (cosign) et leur SBOM attesté.
- **Production** : `docker compose pull && docker compose up -d` avec `APP_VERSION` dans `.env` ([ADR 0008](adr/0008-images-ghcr-cosign-caddy-non-root.md)).
- **Développement** : `docker-compose.dev.yml` (rechargement à chaud), voir [CONTRIBUTING.md](../CONTRIBUTING.md).
