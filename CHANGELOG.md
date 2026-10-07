# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Numérotation : [versionnage sémantique](https://semver.org/lang/fr/) (`MAJEUR.MINEUR.CORRECTIF`). Chaque version publiée correspond à une étiquette `vX.Y.Z` et aux images `ghcr.io/yousername-ha/suivi-audits-api` et `suivi-audits-web` de même numéro.

## [Non publié]

### Ajouté
- Gestion des droits (RBAC, chantier 9 bis, ADR 0010) :
  - permissions module × action, déclarées dans `packages/shared` ;
  - rôles prédéfinis (Administrateur, RSSI, Contributeur, Lecteur, Auditeur externe) et rôles personnalisés créés par duplication, avec une matrice éditable ;
  - groupes ; droits effectifs affichés avec leur origine ; expiration des comptes ;
  - export de la revue des accès en CSV et Excel (ISO 27001 A.5.18) ;
  - écrans Utilisateurs, Groupes et Rôles.
- Garde-fous :
  - au moins un administrateur permanent ;
  - interdiction de modifier ses propres droits ;
  - journal avant/après ;
  - coupure des sessions concernées ;
  - désactivation automatique des comptes expirés.
- Charte graphique unique (`packages/ui`, chantier 9 ter, ADR 0011) :
  - identité de l'outil historique ;
  - mode clair et mode sombre ;
  - contrastes WCAG AA vérifiés ;
  - composants communs ;
  - aucune valeur codée en dur dans l'interface (test).
- Page Paramètres pleine largeur :
  - huit sections (Général, Cycle d'audit, Référentiels, Apparence, Notifications, Import et export, Sauvegardes, Sécurité), chacune avec son enregistrement, son contrôle de version et son journal ;
  - politique de sécurité réglable dans des bornes non négociables ;
  - logo de l'organisation.
- Captures de référence Playwright (Paramètres et Administration, 3 largeurs, clair et sombre), produites dans le conteneur Playwright officiel.
- Documentation : `docs/BACKLOG-FONCTIONNEL.md`, et feuille de route complétée (exigences `CRRC-01` à `CRRC-04`, `INV-01`, `INV-02`, `INC-01` à `INC-03`).

### Sécurité
- Limite de débit globale par adresse IP sur toutes les routes (`RATE_LIMIT_PER_MINUTE`, 1200 par défaut), appliquée avant toute lecture en base.

### Modifié
- Migration `003_droits.sql` : `admin` devient Administrateur, `rw` devient Contributeur, `ro` devient Lecteur. Un ancien compte « lecture et écriture » ne peut plus supprimer de document ni de lien : lui attribuer le rôle RSSI si nécessaire.
- L'outil historique filtre les modules selon les droits : les modules non lisibles sont masqués, et les modifications non autorisées sont refusées.

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
