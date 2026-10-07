# Suivi des audits SMSI ISO 27001 / HDS

Application web auto-hébergée de pilotage du SMSI du GCS Normand'e-Santé (RSSI) : préparation et suivi des audits ISO 27001 / HDS, écarts et actions, documents et preuves. Elle remplace, module par module, l'outil historique en fichier unique, qui reste disponible sous `/legacy` pendant la transition.

- **Installation pas à pas : [docs/INSTALLATION.md](docs/INSTALLATION.md)** (guide pour débutant, rejoué automatiquement en CI)
- Architecture et modèle de sécurité : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Feuille de route : [docs/ROADMAP.md](docs/ROADMAP.md) — décisions : [docs/adr/](docs/adr/README.md)
- Reprise des données de l'ancien outil : [docs/legacy/IMPORT-LEGACY.md](docs/legacy/IMPORT-LEGACY.md), [format](docs/legacy/LEGACY-FORMAT.md), [correspondance](docs/legacy/MAPPING-LEGACY.md)
- Contribuer : [CONTRIBUTING.md](CONTRIBUTING.md) — versions : [CHANGELOG.md](CHANGELOG.md)

## En bref

| | |
|---|---|
| **Interface** | React, en français, accessible et utilisable au téléphone ; mise à jour en temps réel entre utilisateurs, avec indication de présence |
| **Sécurité** | Comptes nominatifs, **double authentification TOTP obligatoire**, jeton d'installation à usage unique (aucun mot de passe par défaut), rôles, CSRF, journal d'audit en ajout seul, documents chiffrés en AES-256-GCM, CSP stricte |
| **Données** | PostgreSQL 17, un enregistrement par élément (concurrence par enregistrement), historique et sauvegardes chiffrées |
| **Déploiement** | Docker Compose : images signées publiées sur GHCR, conteneurs non root en lecture seule, seul le frontal HTTPS (Caddy) est exposé |

```
 navigateur ──HTTPS──▶ web (Caddy : TLS + interface) ──▶ app (API Node 24) ──▶ db (PostgreSQL 17)
                                                        └─▶ clamav (facultatif)
```

## Rôles

| Rôle | Suivi | Documents et liens | Administration |
|---|---|---|---|
| Administrateur | lecture et écriture | lecture, écriture, suppression définitive | comptes, sessions, journal, versions, import, système |
| Lecture et écriture (RSSI, adjoint) | lecture et écriture | lecture et écriture | — |
| Lecture seule (alternant, auditeur) | lecture seule, imposée par le serveur | consultation et téléchargement | — |

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
| Mise à jour | `APP_VERSION` dans `.env`, puis `sudo docker compose pull && sudo docker compose up -d --remove-orphans` |
| Antivirus | `CLAMAV_HOST=clamav` dans `.env`, puis `sudo docker compose --profile antivirus up -d` |

Des vues SQL (`v_items`, `v_findings`, `v_documents`) permettent d'interroger les données en lecture, par exemple : `sudo docker compose exec -u postgres db psql -d suivi -c "SELECT * FROM v_findings"`.

## Développement

```bash
corepack enable && pnpm install
pnpm lint && pnpm typecheck && pnpm test            # Vitest : PostgreSQL de test requis, voir CONTRIBUTING.md
docker compose -f docker-compose.dev.yml up         # pile de développement avec rechargement à chaud
```

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour l'organisation du dépôt, les tests et les conventions.

## Limites connues (phase 0)

- Les modules métier (écarts, mesures, processus…) sont encore gérés dans l'outil historique (`/legacy`), enregistrés comme un document unique avec contrôle de version global. Ils sont repris un par un dans la nouvelle interface ([feuille de route](docs/ROADMAP.md)).
- L'outil historique nécessite `'unsafe-inline'` dans sa CSP. La nouvelle interface n'en a pas besoin.
- La fédération d'identité (OIDC) est prévue en phase 4.
