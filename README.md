# Suivi des audits SMSI ISO 27001 / HDS — v2 (Docker + PostgreSQL)

Plateforme auto-hébergée de l'outil « Suivi des audits SMSI », avec :

- un **frontal HTTPS** (Caddy) seul exposé sur le réseau ;
- une **authentification complète** : comptes nominatifs, mots de passe robustes, **double authentification TOTP obligatoire**, verrouillage après échecs, sessions limitées ;
- un **jeton d'installation généré au premier démarrage** pour créer le compte administrateur, sans aucun mot de passe par défaut ;
- une **base PostgreSQL 17** intégrée à la pile, non exposée, sans accès Internet ;
- une **GED** : documents (avec versions) et liens, rattachés aux mesures, écarts, processus et fournisseurs ;
- un **journal d'audit** en ajout seul et l'**historique des versions** des données, restaurable.

## Architecture

```
            Internet / LAN
                 │ 443 (HTTPS)  80 (redirection)
        ┌────────▼────────┐  réseau « public »
        │ proxy  (Caddy)  │  TLS, HSTS, limite de taille
        └────────┬────────┘
                 │ réseau « edge » (interne, sans sortie)
        ┌────────▼────────┐
        │ app  (Node 24)  │  authentification, API, pages, chiffrement des documents
        └────────┬────────┘
                 │ réseau « backend » (interne, sans sortie)
        ┌────────▼────────┐        ┌───────────────────────┐
        │ db (PostgreSQL) │        │ clamav (facultatif)   │
        └─────────────────┘        └───────────────────────┘
  init : service ponctuel qui génère les secrets au premier démarrage
```

| Volume | Contenu |
|---|---|
| `pgdata` | base PostgreSQL (données de suivi, comptes, documents chiffrés, journal) |
| `secrets` | mot de passe superutilisateur PostgreSQL, mot de passe applicatif, clé maître des documents |
| `caddy_data` | certificats et autorité interne de Caddy |

## Installation

Prérequis : Docker Engine 24+ avec Compose v2, un nom DNS pointant vers le serveur.

```bash
sudo git clone https://github.com/yousername-ha/suivi-audits.git /opt/suivi-audits
cd /opt/suivi-audits
sudo cp .env.example .env
sudo nano .env                     # SITE_ADDRESS, CADDY_TLS (au minimum)
sudo docker compose build
sudo docker compose up -d
sudo docker compose logs app | grep -A3 JETON
```

1. Ouvrir `https://<SITE_ADDRESS>/setup`.
2. Saisir le **jeton d'installation** affiché dans les journaux. Il est à usage unique et valable 24 h, et un nouveau jeton est émis à chaque démarrage tant qu'aucun administrateur n'existe.
3. Créer le compte administrateur, puis scanner le QR code avec une application d'authentification (Microsoft Authenticator, FreeOTP, Aegis…).
4. Dans **Administration → Comptes**, créer les autres comptes. Un mot de passe temporaire est affiché une seule fois ; chaque utilisateur le change et active sa double authentification à la première connexion.

Au premier démarrage, la base est initialisée **sans données** (`app/seed/state.json`) : seuls les référentiels sont chargés (ISO 27001, Annexe A, HDS, ReCyF, guide de préparation, clausier). Pour reprendre des données existantes, importer une sauvegarde JSON depuis l'outil (Paramètres → Importer) ou utiliser `scripts/restore.sh`.

### Certificat HTTPS

- `CADDY_TLS=internal` : Caddy génère sa propre autorité. Pour éviter l'alerte navigateur, déployer sur les postes son certificat racine (par GPO) : `docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt .`
- Certificat de votre PKI : déposer `fullchain.pem` et `privkey.pem` dans `./certs`, puis `CADDY_TLS=/certs/fullchain.pem /certs/privkey.pem`.

## Rôles

| Rôle | Suivi | Documents et liens | Administration |
|---|---|---|---|
| Administrateur | lecture et écriture | lecture, écriture, suppression définitive | comptes, sessions, journal, versions, système |
| Lecture et écriture (RSSI, adjoint) | lecture et écriture | lecture et écriture | — |
| Lecture seule (alternant, auditeur) | lecture seule imposée par le serveur | consultation et téléchargement | — |

## Sécurité mise en œuvre

**Authentification et sessions**
- Mots de passe hachés avec scrypt (N=2¹⁶, r=8, p=2). Exigences : 12 caractères minimum et 3 types de caractères.
- Double authentification TOTP (RFC 6238) avec protection anti-rejeu. Le secret TOTP est chiffré en base.
- Verrouillage progressif du compte après 5 échecs, et limitation du débit par IP et par compte.
- Session : jeton aléatoire de 256 bits, dont seule l'empreinte est stockée en base. Cookie `__Host-` avec les attributs `Secure`, `HttpOnly` et `SameSite=Strict`.
- Expiration après 30 min d'inactivité et 10 h au maximum. Une nouvelle session est créée après la double authentification.
- Protection CSRF par un jeton propre à chaque session, complétée par un contrôle d'origine.

**Pages web**
- CSP stricte sans script en ligne sur les pages de connexion, d'administration et de documents.
- CSP sans aucune origine externe sur l'outil de suivi.
- `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS.

**Documents**
- Contrôles au dépôt :
  - liste blanche d'extensions ;
  - vérification de la signature binaire du fichier ;
  - refus des fichiers à macros ;
  - analyse ClamAV en option.
- Chiffrement en base en **AES-256-GCM**, avec un IV unique par version et une empreinte SHA-256 contrôlée à chaque téléchargement.
- Téléchargement servi en pièce jointe, dans un bac à sable (`CSP: sandbox`).

**Données**
- Contrôle de version optimiste : si deux personnes enregistrent en même temps, aucune écriture n'écrase silencieusement l'autre.
- Historique restaurable des versions.
- Journal d'audit en ajout seul, garanti par un déclencheur PostgreSQL.

**Base de données**
- Rôle applicatif non superutilisateur, authentification SCRAM-SHA-256.
- Sommes de contrôle des pages activées. Mots de passe générés aléatoirement au premier démarrage.

**Conteneurs**
- Système de fichiers en lecture seule, `cap_drop: ALL`, `no-new-privileges`, utilisateur non root pour l'application.
- Réseaux internes sans accès sortant. Image d'exécution sans npm.

**Journaux**
- Journaux JSON sur la sortie standard (application, Caddy, PostgreSQL), collectables par le SIEM.
- Journal d'audit fonctionnel consultable et exportable en CSV dans l'administration.

## Exploitation

```bash
docker compose ps                                    # état
docker compose logs -f app                           # journaux
docker compose exec app node src/cli.js users        # comptes
docker compose exec app node src/cli.js reset-password <compte>
docker compose exec app node src/cli.js reset-mfa <compte>     # téléphone perdu
docker compose exec app node src/cli.js unlock <compte>
docker compose exec app node src/cli.js setup-token --recovery # administrateur de secours (perte de tous les accès admin)
```

### Sauvegarde et restauration

```bash
openssl rand -base64 48 > /root/.suivi-backup-pass && chmod 600 /root/.suivi-backup-pass   # à conserver hors du serveur
BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /mnt/sauvegardes        # à planifier en cron
BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/restore.sh /mnt/sauvegardes/suivi-audits-AAAAMMJJ-HHMMSS.tar.enc
```

L'archive contient la base (`pg_dump`) **et** les secrets. Sans la clé maître, les documents ne peuvent pas être déchiffrés : c'est pourquoi l'archive est chiffrée et la phrase de passe est conservée à part.

### Mises à jour

| Quoi | Commande |
|---|---|
| Correctifs Node, Alpine, PostgreSQL 17.x et Caddy | `docker compose build --pull && docker compose pull && docker compose up -d` |
| Nouvelle version de l'application | `git pull`, puis la même commande ; les migrations de base s'appliquent automatiquement au démarrage |
| Nouvelle interface de l'outil de suivi (artefact claude.ai) | `./scripts/update-ui.sh /chemin/index.html` |
| Version majeure de PostgreSQL (ex. 17 → 18) | sauvegarde, changement d'image, puis restauration (`backup.sh` / `restore.sh`) |

### Antivirus (recommandé)

```bash
echo "CLAMAV_HOST=clamav" >> .env
docker compose --profile antivirus up -d
```
Avec `CLAMAV_REQUIRED=true`, un dépôt est refusé si l'analyse n'est pas possible. ClamAV a besoin d'un accès sortant pour mettre à jour ses signatures (réseau `av_update`) et d'environ 3 Go de mémoire.

## Données et requêtes SQL

Les données de suivi sont stockées en JSONB et versionnées. Des vues SQL permettent de les requêter directement, par exemple depuis un outil décisionnel ou pour un contrôle :

```bash
docker compose exec -u postgres db psql -d suivi -c "SELECT id, statut, constat, echeance FROM v_findings WHERE statut <> 'Clos'"
```
Vues disponibles : `v_items` (mesures), `v_findings` (écarts) et `v_documents` (documents courants).

## Lier un document depuis l'outil de suivi

Dans **Documents et liens**, ouvrir la fiche d'un document puis cliquer sur **Copier le lien interne** (`https://<serveur>/d/<identifiant>`). Coller ce lien dans un champ « Lien vers le document » ou « Preuve » de l'outil de suivi : il ouvre le document, sous réserve d'être connecté.

## Limites connues

- Les données de l'outil de suivi sont enregistrées comme un document unique : en cas d'écriture simultanée, un bandeau fait arbitrer, sans fusion automatique champ par champ.
- L'outil de suivi (fichier unique historique) nécessite `'unsafe-inline'` dans sa CSP. Les autres pages n'en ont pas besoin.
- La fédération d'identité (SAML / OIDC avec l'annuaire du GCS) n'est pas incluse dans cette version.
