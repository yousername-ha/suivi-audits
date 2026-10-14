# Suivi des audits et pilotage multi-référentiels

Application web auto-hébergée de pilotage du GCS Normand'e-Santé : qualité, sécurité et référentiels, préparation et suivi des audits, écarts et actions, documents et preuves. Le menu Pilotage accompagne les démarches SMQ (ISO 9001), SMSI (ISO 27001), HDS et intégrées, sans imposer la création d’un SMSI. Elle remplace, module par module, l'outil historique en fichier unique, qui reste disponible sous `/legacy` pendant la transition.

- **Reprise du projet : [HANDOVER.md](HANDOVER.md)** — [état](PROJECT_STATUS.md), [index documentaire](docs/00_INDEX.md), [consignes IA](AGENTS.md)
- **Installation pas à pas : [docs/INSTALLATION.md](docs/INSTALLATION.md)** (guide pour débutant, rejoué automatiquement en CI)
- Guide métier : [docs/PILOTAGE.md](docs/PILOTAGE.md) — [lots G/H/K et début E, limites](docs/LOT-G-H-K-DEBUT-E.md)
- Architecture et modèle de sécurité : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Feuille de route : [docs/ROADMAP.md](docs/ROADMAP.md) — décisions : [docs/adr/](docs/adr/README.md)
- Reprise des données de l'ancien outil : [docs/legacy/IMPORT-LEGACY.md](docs/legacy/IMPORT-LEGACY.md), [format](docs/legacy/LEGACY-FORMAT.md), [correspondance](docs/legacy/MAPPING-LEGACY.md)
- Contribuer : [CONTRIBUTING.md](CONTRIBUTING.md) — versions : [CHANGELOG.md](CHANGELOG.md)

## En bref

| | |
|---|---|
| **Interface** | React, en français, accessible et utilisable au téléphone ; mise à jour en temps réel entre utilisateurs, avec indication de présence |
| **Sécurité** | Comptes nominatifs, **double authentification TOTP obligatoire**, jeton d'installation à usage unique (aucun mot de passe par défaut), droits par module (rôles, groupes, revue des accès), CSRF, journal d'audit en ajout seul, documents chiffrés en AES-256-GCM, CSP stricte |
| **Données** | PostgreSQL 18, un enregistrement par élément (concurrence par enregistrement), historique et sauvegardes chiffrées |
| **Déploiement** | Docker Compose : images signées publiées sur GHCR, conteneurs non root en lecture seule, seul le frontal HTTPS (Caddy) est exposé |

```
navigateur → gateway (HTTPS + maintenance) → web (interface React) → app (API) → db
                                                                       └→ clamav (facultatif)
updater : mises à jour et exploitation ; données persistantes dans DATA_DIR
```

## Droits

Les droits sont des permissions **module × action** (lire, créer et modifier, supprimer, exporter, administrer). Ils sont regroupés en **rôles**, attribués directement ou par des **groupes**, et contrôlés par le serveur sur chaque requête ([ADR 0010](docs/adr/0010-droits-rbac.md)).

| Rôle prédéfini | Droits |
|---|---|
| Administrateur | tout, y compris comptes, groupes, rôles, sessions, journal |
| RSSI | tout, sauf l'administration technique |
| Contributeur | lire et modifier les modules métier, les documents et les liens |
| Lecteur | lecture seule |
| Auditeur externe | lecture des modules choisis, compte à date d'expiration obligatoire |

Pour un besoin particulier, on crée des rôles personnalisés par duplication, puis on les ajuste dans une matrice. La revue des accès (ISO 27001 A.5.18) s'exporte en Excel et en CSV.

## Installation et exploitation (résumé)

Le guide complet, avec les prérequis et les résultats attendus, est [docs/INSTALLATION.md](docs/INSTALLATION.md).

```bash
cd /opt/suivi-audits
sudo cp .env.example .env && sudo nano .env        # SITE_ADDRESS, APP_VERSION, CADDY_TLS
sudo docker compose pull && sudo docker compose up -d
sudo docker compose exec app setup-token           # jeton d'installation, puis https://<nom_dns>/setup
```

| Tâche | Commande |
|---|---|
| État | `sudo docker compose ps -a` |
| Journaux | `sudo docker compose logs -f app` |
| Commandes d'exploitation | `sudo docker compose exec app suivi help` (`users`, `reset-password`, `reset-mfa`, `unlock`, `disable`, `enable`, `sessions-purge`) |
| Administrateur de secours | `sudo docker compose exec app setup-token --recovery` |
| Sauvegarde chiffrée | `sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits` |
| Restauration | `sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/restore.sh <archive>.tar.enc` |
| Mise à jour | Administration → Système → Mise à jour ; pour le premier passage ou l’entretien serveur, suivre [INSTALLATION, section 12](docs/INSTALLATION.md) (sauvegarde et signatures). |
| Antivirus | `CLAMAV_HOST=clamav` dans `.env`, puis `sudo docker compose --profile antivirus up -d` |

Des vues SQL (`v_items`, `v_findings`, `v_documents`) permettent d'interroger les données en lecture, par exemple : `sudo docker compose exec -u postgres db psql -d suivi -c "SELECT * FROM v_findings"`.

## Développement

```bash
corepack enable && pnpm install
pnpm lint && pnpm typecheck && pnpm test            # Vitest : PostgreSQL de test requis, voir CONTRIBUTING.md
docker compose -f docker-compose.dev.yml up         # pile de développement avec rechargement à chaud
```

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour l'organisation du dépôt, les tests et les conventions.

## Limites connues de la livraison actuelle

- Les données historiques de contexte, parties intéressées, responsabilités, processus, objectifs, indicateurs, preuves, constats et revues sont éditées directement depuis Pilotage ; leurs champs supplémentaires sont conservés. Les autres écrans historiques restent accessibles sous `/legacy` pendant leur reprise ([feuille de route](docs/ROADMAP.md)).
- Le lot E est partiel : BIA, plans et exercices génériques ; les grilles officielles indisponibles restent à intégrer. D/J/I/F sont exclus de cette livraison.
- L'outil historique nécessite `'unsafe-inline'` dans sa CSP. La nouvelle interface n'en a pas besoin.
- La fédération d'identité (OIDC) est prévue en phase 4.
