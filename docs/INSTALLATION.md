# Installer « Suivi des audits SMSI » — guide pas à pas

> Reprise documentaire du 11 octobre 2026 : ce guide reste la référence des commandes rejouées en CI. Le [dossier de reprise](00_INDEX.md), le [guide administrateur](06_GUIDES/GUIDE_ADMINISTRATEUR.md) et le [dépannage](06_GUIDES/GUIDE_DEPANNAGE.md) décrivent les parcours et réserves actuels ; aucune commande de ce guide n’est modifiée par l’audit.

Ce guide part d'un serveur vide et ne suppose aucune connaissance de Linux ni de Docker. Il s'adresse au RSSI ou à un technicien. Suivez les étapes **dans l'ordre**, sans en sauter. Comptez environ 1 h 30 la première fois.

> **Branches et version (11 octobre 2026).** `main` porte la version Docker unique, **3.1.0** (section 12.0),
> issue de la branche de travail `claude-suivi-smsi` ; la branche `legacy` porte l'outil historique autonome.
> Les anciennes branches sont conservées sous les étiquettes `archive/*`.
> La version 2 du dépôt est conservée intégralement dans
> `archives/v2-source.zip` et vérifiable avec `archives/v2-manifest.json`.
> Le guide ci-dessous décrit le déploiement v3 ; il ne faut pas l’appliquer à une
> installation v2 en service sans sauvegarde et recette de la montée de version.
> La validation cloud de l’intégration utilise une base PostgreSQL dédiée et Caddy avec
> les fichiers compilés. Elle ne remplace pas les tests des images de production,
> de restauration et de signatures. Voir le [rapport d’intégration](archive/diagnostics/2026-10-09-integration-sauge.md) et la [recette de fiabilisation](archive/diagnostics/2026-10-09-fiabilisation.md) (105 scénarios officiels réussis).

**Comment lire ce guide**
- Chaque cadre gris contient **une commande**. Copiez-la, collez-la dans le terminal du serveur (clic droit dans PowerShell), puis appuyez sur **Entrée**.
- Sous chaque commande, **Résultat attendu** décrit ce que vous devez voir. Si le résultat diffère, arrêtez-vous et consultez la section [13. En cas de problème](#13-en-cas-de-problème).
- Le texte `<comme_ceci>` est à remplacer par votre valeur, **chevrons compris**. Par exemple, `ssh <utilisateur>@<adresse_ip_du_serveur>` devient `ssh admin@10.0.12.40`.
- ⚠️ signale une action risquée : lisez l'avertissement **avant** de lancer la commande.

Ce guide est **vérifié automatiquement** : à chaque modification de l'application, l'intégration continue rejoue ses commandes sur un serveur Ubuntu vierge, jusqu'à la création de l'administrateur et à l'import d'un fichier de l'ancien outil. Un guide inexact bloque la publication. Les commentaires `<!-- ci: … -->`, invisibles sur GitHub, servent à ce contrôle.

---

## Sommaire
0. [Ce qu'il vous faut avant de commencer](#0-ce-quil-vous-faut-avant-de-commencer)
1. [Se connecter au serveur depuis Windows](#1-se-connecter-au-serveur-depuis-windows)
2. [Préparer le serveur](#2-préparer-le-serveur)
3. [Installer Docker](#3-installer-docker)
4. [Autoriser le serveur à lire le dépôt et les images](#4-autoriser-le-serveur-à-lire-le-dépôt-et-les-images)
5. [Télécharger l'application](#5-télécharger-lapplication)
6. [Configurer l'application](#6-configurer-lapplication)
7. [Démarrer l'application](#7-démarrer-lapplication)
8. [Créer le compte administrateur](#8-créer-le-compte-administrateur)
9. [Créer les comptes des utilisateurs](#9-créer-les-comptes-des-utilisateurs)
10. [Reprendre les données de l'ancien outil](#10-reprendre-les-données-de-lancien-outil)
11. [Mettre en place les sauvegardes](#11-mettre-en-place-les-sauvegardes)
12. [Mettre à jour](#12-mettre-à-jour)
13. [En cas de problème](#13-en-cas-de-problème)
14. [Arrêter ou désinstaller](#14-arrêter-ou-désinstaller)
15. [Glossaire](#15-glossaire)

---

## 0. Ce qu'il vous faut avant de commencer

Cochez chaque ligne avant de passer à l'étape 1. Les demandes aux autres équipes prennent souvent plusieurs jours : faites-les en premier.

| ☐ | Élément | Détail |
|---|---|---|
| ☐ | **Un serveur Linux** (machine virtuelle) | **Debian 12** ou **Ubuntu 24.04 LTS**, installation minimale, en 64 bits (x86_64). Demandez à l'équipe infrastructure « une VM Linux pour une application Docker ». |
| ☐ | **Dimensionnement** | 2 processeurs, 4 Go de mémoire, 30 Go de disque, plus la place des sauvegardes (prévoir 10 Go). Avec l'antivirus facultatif (ClamAV) : 8 Go de mémoire. Une mise à jour demande, en espace libre, deux fois la taille de la base plus 2 Go. |
| ☐ | **Un emplacement pour les données** | Un dossier du serveur, par défaut `/srv/suivi-audits/donnees`, sur un disque **inclus dans la sauvegarde externalisée** du serveur, comme `/srv/sauvegardes`. Demandez à l'équipe infrastructure de sauvegarder ces deux dossiers. |
| ☐ | **Un compte sur ce serveur** avec droits d'administration (`sudo`) | L'équipe infrastructure vous fournit l'adresse IP, l'identifiant et le mot de passe. |
| ☐ | **Un nom DNS** pointant vers le serveur | Par exemple `suivi-audits.mondomaine.local`. Demandez à l'équipe réseau « un enregistrement DNS de type A vers l'IP du serveur ». |
| ☐ | **Ports entrants ouverts** des postes utilisateurs vers le serveur | TCP **443** (HTTPS) et TCP **80** (redirection vers HTTPS). Pour l'administration : TCP **22** (SSH), depuis votre poste uniquement. |
| ☐ | **Flux sortants ouverts** du serveur vers Internet | Voir le tableau ci-dessous. |
| ☐ | **Un compte GitHub** ayant accès au dépôt `yousername-ha/suivi-audits` | Pour autoriser le serveur à le lire (étape 4). |
| ☐ | **Un téléphone avec une application d'authentification** | Microsoft Authenticator, FreeOTP, Aegis ou Google Authenticator. |
| ☐ | **Un coffre-fort de mots de passe** | KeePass ou équivalent, pour conserver la clé de secours des sauvegardes (étape 11). |

**Flux sortants à demander** (du serveur vers Internet, à faire ouvrir au pare-feu ou au proxy) :

| Destination | Port | Usage |
|---|---|---|
| `deb.debian.org`, `security.debian.org` (Debian) ou `archive.ubuntu.com`, `security.ubuntu.com` (Ubuntu) | TCP 80 et 443 | Mises à jour du système |
| `download.docker.com` | TCP 443 | Installation de Docker |
| `github.com` | TCP 22 | Téléchargement de l'application (clé de déploiement SSH) |
| `ghcr.io`, `pkg-containers.githubusercontent.com` | TCP 443 | Images de l'application |
| `github.com`, `objects.githubusercontent.com` | TCP 443 | Installation de cosign (étape 3.6) |
| `tuf-repo-cdn.sigstore.dev`, `rekor.sigstore.dev` | TCP 443 | Vérification de la signature des images à chaque mise à jour (étape 12.1) |
| `registry-1.docker.io`, `auth.docker.io`, `production.cloudflare.docker.com` | TCP 443 | Image de la base de données (PostgreSQL) |
| Serveur de temps (NTP) de votre organisation, ou `ntp.ubuntu.com` / `deb.pool.ntp.org` | UDP 123 | Mise à l'heure (indispensable à la double authentification) |
| `database.clamav.net` | TCP 443 | Facultatif : signatures de l'antivirus (service `freshclam` seul) |

Une fois démarrée, l'application elle-même n'a **aucun accès à Internet** : seuls le système, Docker et les scripts du serveur en ont besoin, pour l'installation et les mises à jour.

**Antivirus facultatif.** `docker compose --profile antivirus up -d` démarre deux services sans privilège (utilisateur `clamav`, système de fichiers en lecture seule, aucune capacité Linux) : `clamav` (analyse, joint par l'API seule sur le réseau interne `antivirus`, sans accès à la base ni à Internet) et `freshclam` (téléchargement des signatures, seul à sortir vers `database.clamav.net`). `clamav` démarre quand les signatures initiales sont présentes, ce qui prend quelques minutes au premier lancement ; l'analyse reprend les signatures mises à jour dans l'heure qui suit leur téléchargement. Renseigner `CLAMAV_HOST=clamav` dans `.env`. Le dossier `DATA_DIR/clamav` appartient à l'uid 100, préparé par le service `init`.


---

## 1. Se connecter au serveur depuis Windows

1. Ouvrez le menu Démarrer, tapez **PowerShell** et appuyez sur **Entrée**. Une fenêtre bleue ou noire s'ouvre.
2. Tapez la commande suivante, en remplaçant les deux valeurs :
   ```powershell
   ssh <utilisateur>@<adresse_ip_du_serveur>
   ```
3. À la première connexion, la question `Are you sure you want to continue connecting (yes/no/[fingerprint])?` s'affiche. Tapez `yes` puis **Entrée**.
4. Saisissez le mot de passe puis **Entrée**. **Rien ne s'affiche pendant la frappe** : c'est normal.

**Résultat attendu** : l'invite ressemble à `utilisateur@serveur:~$`. Vous êtes sur le serveur : toutes les commandes suivantes se tapent **dans cette fenêtre**.

> Pour coller dans PowerShell : **clic droit**. Pour copier depuis PowerShell : sélectionnez le texte à la souris, puis **clic droit**.
> Si vous fermez la fenêtre, reconnectez-vous avec la même commande `ssh`.

---

## 2. Préparer le serveur

**2.1 Mettre à jour le système.** La commande peut prendre plusieurs minutes. Si `sudo` demande votre mot de passe, saisissez-le (il ne s'affiche pas).

<!-- ci: instead: sudo apt-get update -->
```bash
sudo apt update && sudo apt full-upgrade -y
```
**Résultat attendu** : la commande se termine sans ligne commençant par `E:` (erreur). Les lignes `W:` (avertissements) sont sans gravité.

> Sur Ubuntu, un écran violet « **Daemons using outdated libraries** » peut s'afficher : appuyez sur **Tab** jusqu'à `<Ok>`, puis **Entrée**.

**2.2 Installer les outils de base :**

<!-- ci: run -->
```bash
sudo apt install -y git curl ca-certificates ufw nano openssl python3 age
```
**Résultat attendu** : la dernière ligne ne contient pas `E:`. `age` chiffre les sauvegardes (étape 11).

**2.3 Vérifier l'heure du serveur.** C'est **indispensable** : les codes de double authentification dépendent de l'heure.

<!-- ci: run -->
```bash
timedatectl
```
**Résultat attendu** : une ligne `System clock synchronized: yes`. Si elle indique `no`, activez la synchronisation :

<!-- ci: run -->
```bash
sudo timedatectl set-ntp true
```
**Résultat attendu** : aucun message. Relancez `timedatectl` une minute plus tard : la ligne doit indiquer `yes`. Si elle reste à `no`, le flux NTP (UDP 123) est bloqué : voir l'étape 0.

**2.4 Activer le pare-feu du serveur**, en n'autorisant que l'administration (SSH) et le web.

> ⚠️ Autorisez **toujours le port 22 en premier**. Si vous activez le pare-feu sans lui, vous perdez immédiatement la connexion au serveur, et il faudra l'intervention de l'équipe infrastructure.

<!-- ci: run -->
```bash
sudo ufw allow 22/tcp
```
**Résultat attendu** : `Rules updated` (et `Rules updated (v6)`).

<!-- ci: run -->
```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```
**Résultat attendu** : `Rules updated`, quatre fois.

<!-- ci: run -->
```bash
sudo ufw --force enable
```
**Résultat attendu** : `Firewall is active and enabled on system startup`.

<!-- ci: run -->
```bash
sudo ufw status
```
**Résultat attendu** : `Status: active`, puis les lignes `22/tcp`, `80/tcp` et `443/tcp` avec `ALLOW`.

---

## 3. Installer Docker

Docker fait tourner l'application dans des « conteneurs » isolés (voir le [glossaire](#15-glossaire)). On l'installe depuis le dépôt officiel de Docker, qui fournit les mises à jour de sécurité.

**3.1 Ajouter la clé de signature de Docker :**

<!-- ci: run -->
```bash
sudo install -m 0755 -d /etc/apt/keyrings
```
**Résultat attendu** : aucun message.

<!-- ci: run -->
```bash
. /etc/os-release && sudo curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc && sudo chmod a+r /etc/apt/keyrings/docker.asc
```
**Résultat attendu** : aucun message. Un message `Could not resolve host` ou `Failed to connect` signifie que le flux vers `download.docker.com` est bloqué (étape 0).

**3.2 Déclarer le dépôt de Docker :**

<!-- ci: run -->
```bash
. /etc/os-release && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list
```
**Résultat attendu** : une ligne qui commence par `deb [arch=amd64 signed-by=…] https://download.docker.com/linux/debian bookworm stable` (ou `…/linux/ubuntu noble stable`).

**3.3 Installer Docker :**

<!-- ci: run -->
```bash
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
**Résultat attendu** : la dernière ligne ne contient pas `E:`.

**3.4 Démarrer Docker, et le lancer automatiquement au démarrage du serveur :**

<!-- ci: run -->
```bash
sudo systemctl enable --now docker
```
**Résultat attendu** : aucun message, ou une ligne `Synchronizing state of docker.service…`.

**3.5 Vérifier l'installation :**

<!-- ci: run -->
```bash
sudo docker compose version
```
**Résultat attendu** : `Docker Compose version v2.` suivi d'un numéro (2.24 ou plus récent).

<!-- ci: run -->
```bash
sudo docker run --rm hello-world
```
**Résultat attendu** : le texte contient `Hello from Docker!`. Docker fonctionne et sait télécharger des images.

**3.6 Installer cosign**, l'outil qui vérifie, à chaque mise à jour, que les images viennent bien de la chaîne de publication du dépôt (signature) et n'ont pas été modifiées. La commande télécharge cosign et contrôle son empreinte avant de l'installer :

<!-- ci: run -->
```bash
cd /tmp && curl -fsSLO https://github.com/sigstore/cosign/releases/download/v3.1.3/cosign-linux-amd64 && curl -fsSL https://github.com/sigstore/cosign/releases/download/v3.1.3/cosign_checksums.txt | grep ' cosign-linux-amd64$' | sha256sum -c && sudo install -m 0755 cosign-linux-amd64 /usr/local/bin/cosign && rm cosign-linux-amd64 && cd -
```
**Résultat attendu** : `cosign-linux-amd64: OK`, puis le nom du dossier précédent.

<!-- ci: run -->
```bash
cosign version | grep GitVersion
```
**Résultat attendu** : `GitVersion:    v3.1.3`.

---

## 4. Autoriser le serveur à lire le dépôt et les images

Le dépôt GitHub est **privé**. On donne au serveur une **clé de déploiement** : elle lui permet de **lire** le dépôt, et rien d'autre.

**4.1 Créer la clé sur le serveur :**

<!-- ci: skip — le runner de CI utilise directement le code testé -->
```bash
sudo ssh-keygen -t ed25519 -N "" -C "serveur-suivi-audits" -f /root/.ssh/suivi_deploy
```
**Résultat attendu** : `Your identification has been saved in /root/.ssh/suivi_deploy`, puis un dessin fait de caractères.

<!-- ci: skip — le runner de CI utilise directement le code testé -->
```bash
sudo cat /root/.ssh/suivi_deploy.pub
```
**Résultat attendu** : une ligne qui commence par `ssh-ed25519` et se termine par `serveur-suivi-audits`. **Sélectionnez-la entièrement et copiez-la** (sélection à la souris, puis clic droit).

**4.2 Déclarer la clé sur GitHub**, depuis le navigateur de votre poste :
1. Ouvrez `https://github.com/yousername-ha/suivi-audits`.
2. Cliquez sur **Settings**, puis sur **Deploy keys** dans le menu de gauche, puis sur **Add deploy key**.
3. Dans **Title**, saisissez `Serveur suivi-audits`. Dans **Key**, collez la ligne copiée.
4. ⚠️ **Ne cochez pas** « Allow write access » : le serveur n'a besoin que de lire.
5. Cliquez sur **Add key**.

> Si le menu **Settings** n'apparaît pas, votre compte n'est pas administrateur du dépôt : demandez à un administrateur du dépôt de déclarer la clé.

**4.3 Indiquer au serveur quelle clé utiliser pour GitHub :**

<!-- ci: skip — le runner de CI utilise directement le code testé -->
```bash
printf 'Host github-suivi\n  HostName github.com\n  User git\n  IdentityFile /root/.ssh/suivi_deploy\n  IdentitiesOnly yes\n' | sudo tee -a /root/.ssh/config
```
**Résultat attendu** : les 5 lignes s'affichent, de `Host github-suivi` à `IdentitiesOnly yes`.

**4.4 Tester l'accès :**

<!-- ci: skip — le runner de CI utilise directement le code testé -->
```bash
sudo ssh -T github-suivi
```
À la question `Are you sure you want to continue connecting`, tapez `yes` puis **Entrée**.
**Résultat attendu** : `Hi yousername-ha/suivi-audits! You've successfully authenticated, but GitHub does not provide shell access.` Ce message est **normal** : il confirme que l'accès fonctionne.

**4.5 Accès aux images de l'application** (uniquement si les images sont privées).

Les images sont publiées sur le registre de GitHub (`ghcr.io`). Ouvrez `https://github.com/yousername-ha/suivi-audits/pkgs/container/suivi-audits-api` sans être connecté à GitHub (fenêtre de navigation privée) :
- la page s'affiche : les images sont publiques, **passez à l'étape 5** ;
- vous obtenez une erreur 404 : les images sont privées, poursuivez ci-dessous.

La clé de déploiement ne donne pas accès aux images. Il faut un **jeton d'accès en lecture seule** :
1. Sur GitHub, cliquez sur votre photo (en haut à droite), puis **Settings**, **Developer settings**, **Personal access tokens**, **Tokens (classic)**, et enfin **Generate new token (classic)**.
2. **Note** : `serveur suivi-audits (lecture des images)`. **Expiration** : 1 an, et notez la date de renouvellement dans votre agenda.
3. Cochez **uniquement** `read:packages`, puis cliquez sur **Generate token**. Copiez le jeton, qui commence par `ghp_`. Il ne sera plus jamais affiché.

<!-- ci: skip — les images sont construites par la CI, aucun registre privé -->
```bash
sudo docker login ghcr.io -u <compte_github>
```
À la question `Password:`, collez le jeton (rien ne s'affiche), puis **Entrée**.
**Résultat attendu** : `Login Succeeded`. Un avertissement sur le stockage non chiffré du jeton peut s'afficher : il est conservé dans `/root/.docker/config.json`, lisible par root seulement. Ce jeton ne permet que de **lire** des images.

---

## 5. Télécharger l'application

**5.1 Télécharger le dépôt** dans le dossier `/opt/suivi-audits` :

<!-- ci: instead: sudo cp -a "$GITHUB_WORKSPACE" /opt/suivi-audits -->
```bash
sudo git clone git@github-suivi:yousername-ha/suivi-audits.git /opt/suivi-audits
```
**Résultat attendu** : `Cloning into '/opt/suivi-audits'...`, puis une ligne se terminant par `done.`

**5.2 Aller dans ce dossier :**

<!-- ci: run -->
```bash
cd /opt/suivi-audits
```
**Résultat attendu** : l'invite se termine par `/opt/suivi-audits$`.

> **À partir d'ici, toutes les commandes se lancent depuis le dossier `/opt/suivi-audits`.** Si vous vous reconnectez plus tard, retapez d'abord `cd /opt/suivi-audits`.

**5.3 Choisir la version à installer.** Les versions publiées sont listées sur `https://github.com/yousername-ha/suivi-audits/releases` : prenez la plus récente, par exemple `3.0.0`. Dans les commandes, `<version>` est ce numéro **sans** le « v ».

<!-- ci: skip — la CI installe le commit testé -->
```bash
sudo git checkout v<version>
```
**Résultat attendu** : `HEAD is now at …`. Un paragraphe sur l'état « detached HEAD » s'affiche aussi : c'est normal.

<!-- ci: run -->
```bash
ls
```
**Résultat attendu** : la liste contient notamment `docker-compose.yml`, `README.md`, `docs` et `scripts`.

---

## 6. Configurer l'application

**6.1 Créer le fichier de configuration** à partir du modèle :

<!-- ci: run -->
```bash
sudo cp .env.example .env
```
**Résultat attendu** : aucun message.

**6.2 Ouvrir le fichier dans l'éditeur nano :**

<!-- ci: instead: sudo sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=localhost/; s/^APP_VERSION=.*/APP_VERSION=ci/; s/^EXPLOITATION_AUTO=.*/EXPLOITATION_AUTO=0/' .env -->
```bash
sudo nano .env
```
**Résultat attendu** : le fichier s'affiche, avec en bas de l'écran une aide qui commence par `^G Help`.

nano se pilote **uniquement au clavier** (la souris ne déplace pas le curseur) :
1. Avec les **flèches**, placez le curseur à la fin de la ligne `SITE_ADDRESS=suivi-audits.example.local`.
2. Effacez `suivi-audits.example.local` avec la touche **Retour arrière** (⌫), puis tapez votre nom DNS. La ligne devient par exemple `SITE_ADDRESS=suivi-audits.mondomaine.local`.
3. Descendez à la ligne `APP_VERSION=` et remplacez le numéro par la version choisie à l'étape 5.3, sans le « v ».
4. Laissez `CADDY_TLS=internal` pour l'instant (voir 6.4), ainsi que toutes les autres lignes. Laissez aussi `DATA_DIR=/srv/suivi-audits/donnees`, sauf si l'équipe infrastructure a prévu un autre disque pour les données (étape 6.6).
5. Enregistrez : **Ctrl + O**, puis **Entrée**. En bas s'affiche `[ Wrote 53 lines ]` (le nombre peut varier).
6. Quittez : **Ctrl + X**.

**6.3 Protéger le fichier**, puis vérifier les deux valeurs :

<!-- ci: run -->
```bash
sudo chmod 600 .env
```
**Résultat attendu** : aucun message.

<!-- ci: run -->
```bash
sudo grep -E '^(SITE_ADDRESS|APP_VERSION|CADDY_TLS)=' .env
```
**Résultat attendu** : vos trois valeurs, par exemple :
```text
SITE_ADDRESS=suivi-audits.mondomaine.local
CADDY_TLS=internal
APP_VERSION=3.0.0
```

**6.4 Certificat HTTPS.** Ne faites rien maintenant : le serveur démarre avec un **certificat interne** (`CADDY_TLS=internal`, réglage par défaut) qu'il crée lui-même. Le certificat définitif se choisit **dans l'application**, une fois connecté (Administration, Système, Certificats TLS), sans fichier à modifier : autorité interne du serveur, **ACME** (certificat publiquement fiable, renouvelé seul, qui demande un nom public et les ports 80 et 443 joignables depuis Internet) ou **certificat de votre PKI** (déposé depuis l'application). Voir l'étape 11.7.

Si l'équipe infrastructure impose un réglage de départ par fichier (certificat de la PKI avant tout accès à l'application), il reste possible : déposez `fullchain.pem` et `privkey.pem` (clé **non protégée par mot de passe**) dans `/opt/suivi-audits/certs/`, remplacez `CADDY_TLS=internal` par `CADDY_TLS=/certs/fullchain.pem /certs/privkey.pem` dans `.env`, puis `sudo chown 1001:1001 certs/*.pem && sudo chmod 400 certs/privkey.pem`. Ce réglage est celui auquel l'application revient quand on choisit « Revenir au réglage de départ ».

**6.5 Vérifier le DNS.** Le nom doit renvoyer l'adresse IP du serveur :

<!-- ci: run -->
```bash
getent hosts <nom_dns>
```
**Résultat attendu** : une ligne avec l'adresse IP du serveur, puis le nom. Si rien ne s'affiche, l'enregistrement DNS n'existe pas encore : relancez l'équipe réseau avant de continuer.

**6.6 Le dossier des données.** Toutes les données de l'application sont rangées dans **un seul dossier du serveur**, indiqué par la ligne `DATA_DIR` de `.env` (par défaut `/srv/suivi-audits/donnees`). Rien n'est gardé dans les conteneurs : on peut les supprimer, les recréer ou changer de version sans rien perdre. Ce dossier contient :

| Sous-dossier | Contenu | Accès |
|---|---|---|
| `postgres18/` | la base de données PostgreSQL 18 : suivi, comptes, documents chiffrés, journal d'audit | base de données seule |
| `postgres/` | seulement sur un serveur mis à jour depuis une version en PostgreSQL 17 : l'**ancienne base**, conservée intacte après la migration (voir 12.1) | aucun usage |
| `secrets/` | mots de passe internes et **clé de chiffrement des documents**, créés au premier démarrage | lecture par la base et l'application |
| `caddy/` | certificats HTTPS et autorité de certification interne | frontal web seul |
| `clamav/` | signatures de l'antivirus (facultatif) | `freshclam` (écriture) et `clamav` (lecture seule) |
| `etat/` | rapports des sauvegardes et des mises à jour, affichés dans **Administration**, onglet **Système** | lecture seule pour l'application |

Le service `init` crée ces sous-dossiers avec les bons propriétaires et droits à chaque démarrage. Il **refuse de démarrer** si le dossier n'a pas été préparé, s'il est dans le dossier de l'application (`/opt/suivi-audits`), dans un dossier système (`/var/lib/docker`, `/tmp`…) ou sur un disque temporaire.

> ⚠️ Ce dossier contient la clé de chiffrement des documents : ne le copiez pas hors du serveur sans la protection des sauvegardes (étape 11), et faites-le inclure dans la sauvegarde externalisée du serveur.

**6.7 Préparer le dossier des données** (une seule fois) :

<!-- ci: run -->
```bash
sudo ./scripts/preparer-donnees.sh
```
**Résultat attendu** : `Dossier des données prêt : /srv/suivi-audits/donnees`. Le message `des données existent déjà dans des volumes Docker` signifie que l'application a déjà été installée sur ce serveur : suivez plutôt l'étape 12.5.

**6.8 Préparer les clés de sauvegarde** (avant le premier démarrage, étape 7). Sur **votre poste** (pas sur le serveur), générez la clé de secours :

<!-- ci: instead: age-keygen -o "$RUNNER_TEMP/cle-secours.key" -->
```bash
age-keygen -o cle-secours-suivi.key
```
**Résultat attendu** : une ligne `Public key: age1…` (62 caractères). **Rangez `cle-secours-suivi.key` hors ligne** (coffre-fort, support chiffré) : c'est elle qui permet de restaurer si le serveur et sa clé sont perdus. Elle ne doit **jamais** être copiée sur le serveur. Seule la ligne `age1…` (la clé *publique*) est donnée au serveur.

Sur le serveur, créez la clé du serveur et enregistrez la clé publique de secours :

<!-- ci: instead: sudo ./scripts/generer-cles-sauvegarde.sh --secours "$(age-keygen -y "$RUNNER_TEMP/cle-secours.key")" --confirmer -->
```bash
sudo ./scripts/generer-cles-sauvegarde.sh
```
Le script génère `/root/.suivi-backup-key` (droits 0600, jamais affichée), puis vous demande de coller la clé publique `age1…` et de taper `ENREGISTRER` pour confirmer ; elle est écrite dans `/root/.suivi-backup-recipients`. Il ne demande ni n'affiche jamais de clé privée, et refuse d'écraser une clé existante. **Résultat attendu** : `Clé de secours enregistrée`.

> Perte du serveur : installez `age` ailleurs, puis `BACKUP_KEY_FILE=<cle-secours-suivi.key> ./scripts/restore.sh <archive>.tar.age` (étape 11.4). **Testez-le avec la clé de secours avant de vous y fier.**

---

## 7. Démarrer l'application

**7.1 Télécharger les images** de l'application et de la base de données. Comptez quelques minutes la première fois.

<!-- ci: skip — les images de la version testée ne sont pas encore publiées : la CI les construit (encadré ci-dessous) -->
```bash
sudo docker compose pull
```
**Résultat attendu** : une ligne par composant (`init`, `db`, `app`, `web`, `gateway`, `updater`) se terminant par `Pulled`. Si vous lisez `unauthorized` ou `denied`, les images sont privées : faites l'étape 4.5.

> **Tester une version non publiée** (une branche, à la demande de l'équipe projet), à la place de la commande ci-dessus.
> Il faut alors des flux sortants supplémentaires : `registry.npmjs.org` et `dl-cdn.alpinelinux.org` (TCP 443).
> 1. `sudo git checkout <branche>` au lieu de l'étape 5.3 ;
> 2. dans `.env`, `APP_VERSION=test` ;
> 3. construire les images sur le serveur (10 à 20 minutes), avec la commande ci-dessous. Ne lancez jamais `docker compose pull` avec cette configuration : il échouerait, faute d'images publiées sous ce nom.

<!-- ci: run -->
```bash
sudo docker compose -f docker-compose.yml -f docker-compose.build.yml build
```
**Résultat attendu** (uniquement pour tester une branche) : des centaines de lignes, puis une ligne par image se terminant par `Built`.

**7.2 Démarrer :**

<!-- ci: run -->
```bash
sudo docker compose up -d
```
**Résultat attendu** : une ligne par composant, avec `Started` ou `Healthy`. La commande rend la main au bout d'une minute environ.

**7.3 Vérifier l'état** :

<!-- ci: run -->
<!-- ci: then: "$GITHUB_WORKSPACE/scripts/ci/guide-attendre.sh" -->
```bash
sudo docker compose ps -a
```
**Résultat attendu** au bout d'une à deux minutes (relancez la commande si besoin) :

| Service (colonne `SERVICE`) | Rôle | État attendu (colonne `STATUS`) |
|---|---|---|
| `init` | contrôle et prépare le dossier des données, génère les mots de passe internes au premier démarrage, puis s'arrête | `Exited (0)` : terminé normalement, c'est voulu |
| `db` | base de données PostgreSQL | `Up … (healthy)` |
| `app` | application (API) | `Up … (healthy)` |
| `web` | interface interne (non exposée) | `Up …` |

Si un service affiche `unhealthy`, `Restarting` ou `Exited (1)`, ou si une ligne manque, allez à la section [13. En cas de problème](#13-en-cas-de-problème).

**7.4 Vérifier que le site répond** depuis le serveur :

<!-- ci: run -->
```bash
curl -sk https://<nom_dns>/healthz
```
**Résultat attendu** : `ok`.

---

## 8. Créer le compte administrateur

**8.1 Récupérer le jeton d'installation.** C'est un code à **usage unique**, valable **24 heures**, qui prouve que c'est bien vous qui installez. Il est émis au premier démarrage :

<!-- ci: instead: "$GITHUB_WORKSPACE/scripts/ci/guide-masquer-jeton.sh" -->
```bash
sudo docker compose logs app | grep -A3 JETON
```
**Résultat attendu** : un encadré `JETON D'INSTALLATION (usage unique, valable 24 h)`, suivi du jeton au format `XXXXX-XXXXX-XXXXX-XXXXX`, par exemple `K7QM2-XH9PD-4TNRW-B8FZC`. Le jeton ne contient jamais 0, 1, I, L ni O.

Rien ne s'affiche, plus de 24 h se sont écoulées, ou le jeton est perdu ? Générez-en un nouveau, qui annule le précédent :

<!-- ci: instead: sudo docker compose exec -T app setup-token > /dev/null -->
```bash
sudo docker compose exec app setup-token
```
**Résultat attendu** : le même encadré, avec un nouveau jeton et sa date d'expiration.

**8.2 Ouvrir l'application** dans le navigateur de votre poste, à l'adresse `https://<nom_dns>/setup`.

**8.3 Avertissement « Votre connexion n'est pas privée »** (avec `CADDY_TLS=internal` uniquement). C'est **attendu** : le certificat a été créé par le serveur lui-même, et votre poste ne le connaît pas encore.
- Pour avancer maintenant : cliquez sur **Paramètres avancés**, puis sur **Continuer vers le site**.
- Pour une installation durable, installez le certificat racine du serveur sur les postes. Une fois connecté, l'application le propose au téléchargement (Administration, Système, Certificats TLS, « Télécharger le certificat racine »). Sur le serveur, vous pouvez aussi le récupérer ainsi :

<!-- ci: run -->
```bash
sudo docker compose cp gateway:/data/caddy/pki/authorities/local/root.crt /opt/suivi-audits/racine-suivi-audits.crt && sudo chmod 644 /opt/suivi-audits/racine-suivi-audits.crt
```
**Résultat attendu** : `Successfully copied` (ou aucun message).

Puis, **sur votre poste**, dans une **nouvelle** fenêtre PowerShell (pas celle connectée au serveur) :
```powershell
scp <utilisateur>@<adresse_ip_du_serveur>:/opt/suivi-audits/racine-suivi-audits.crt $HOME\Downloads\
```
Le fichier `racine-suivi-audits.crt` est alors dans votre dossier **Téléchargements**. Remettez-le à l'équipe Active Directory, pour un déploiement par GPO dans « Autorités de certification racines de confiance ». Pour un test sur votre seul poste : double-cliquez dessus, **Installer le certificat**, **Utilisateur actuel**, **Placer tous les certificats dans le magasin suivant**, **Autorités de certification racines de confiance**, puis redémarrez le navigateur.

> ⚠️ Ce certificat racine permet au serveur de signer des certificats reconnus par les postes. Ne le déployez que pour ce serveur, et préférez à terme un certificat de votre PKI (étape 6.4).

**8.4 Remplir la page « Installation initiale »** :
1. **Jeton d'installation** : collez le jeton. Minuscules, espaces et tirets sont acceptés : le champ se met en forme tout seul.
2. **Identifiant** : par exemple `rssi`. **Nom affiché** : par exemple `Responsable SSI`. L'adresse e-mail est facultative.
3. **Mot de passe** et **Confirmation** : au moins 12 caractères, avec au moins 3 types de caractères parmi minuscules, majuscules, chiffres et symboles, et sans l'identifiant. Enregistrez-le dans votre coffre-fort.
4. Cliquez sur **Créer le compte**.

**Résultat attendu** : la page « Activer la double authentification » s'affiche, avec un QR code. En cas de message d'erreur :
- « jeton invalide » : vérifiez la saisie, ou le jeton a été remplacé par un plus récent ;
- « jeton expiré » ou « déjà utilisé » : générez-en un nouveau (étape 8.1).

**8.5 Activer la double authentification**, obligatoire pour tous les comptes :
1. Sur votre téléphone, ouvrez l'application d'authentification, puis **Ajouter un compte** et **Scanner un QR code**.
2. Scannez le QR code affiché à l'écran.
3. Saisissez le code à 6 chiffres affiché par le téléphone : il est validé automatiquement (sinon, cliquez sur **Valider**).

**Résultat attendu** : la page d'accueil s'affiche avec « Bonjour Responsable SSI ». **L'installation est terminée.** La page `/setup` est désormais désactivée : elle renvoie vers la connexion.

<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" administrateur https://<nom_dns> -->

> ⚠️ Le compte administrateur est le seul à pouvoir créer des comptes. Créez **un second administrateur** (étape 9) pour ne jamais dépendre d'un seul téléphone.

---

## 9. Créer les comptes des utilisateurs

Les droits se gèrent dans **Administration**, onglets **Utilisateurs**, **Groupes** et **Rôles**. Un compte reçoit des **rôles**, soit directement, soit par les **groupes** dont il est membre. Ses droits sont la somme des deux.

**9.1 Les rôles prédéfinis** (ni modifiables ni supprimables) :

| Rôle | Pour qui | Droits |
|---|---|---|
| **Administrateur** | 2 personnes au plus | Tout, y compris les comptes, groupes, rôles, sessions et le journal |
| **RSSI** | RSSI, RSSI adjoint | Tout, sauf l'administration technique (comptes, groupes, rôles, sessions, journal) |
| **Contributeur** | Pilotes de processus, référents | Consulter et modifier les modules métier, les documents et les liens (pas de suppression) ; exporter les cartes |
| **Lecteur** | Alternant, direction | Consulter et télécharger, sans rien modifier ; exporter les cartes |
| **Auditeur externe** | Auditeur de certification | Consulter les seuls modules choisis ; **date d'expiration obligatoire** |

Pour un besoin particulier, onglet **Rôles** : **Dupliquer** un rôle proche, puis cochez ou décochez les cases de sa matrice (modules × actions : lire, créer et modifier, supprimer, exporter, administrer) et cliquez sur **Enregistrer la matrice**.

**9.2 Créer un compte :**
1. Onglet **Utilisateurs**, bouton **Nouveau compte**.
2. Saisissez l'**Identifiant** et le **Nom affiché**, puis choisissez un ou plusieurs **Rôles** et, si besoin, des **Groupes**.
3. Pour un prestataire ou un auditeur, renseignez la **Date d'expiration du compte** : le compte est désactivé automatiquement ce jour-là. Pour le rôle **Auditeur externe**, choisissez aussi les **modules ouverts** (lecture seule).
4. Cliquez sur **Créer**. Un **mot de passe temporaire** s'affiche **une seule fois**. Transmettez-le à la personne par un canal séparé (de vive voix, SMS), **jamais dans le même message que l'adresse du site**.
5. À sa première connexion, la personne choisit son propre mot de passe, puis active sa double authentification.

**9.3 Groupes** (onglet **Groupes**) : un groupe porte un ou plusieurs rôles, accordés à tous ses membres. Exemple : un groupe « Pilotes de processus » avec le rôle Contributeur.

**9.4 Garde-fous**, appliqués par le serveur :
- il reste toujours au moins un administrateur actif **sans date d'expiration** ;
- personne ne peut modifier ses propres droits : demandez à un autre administrateur ;
- toute modification de droits est tracée dans le **Journal** (avant et après) et ferme les sessions des personnes concernées.

**9.5 Paramètres** : menu **Paramètres**. Renseignez au moins la section **Général** (nom de l'organisation, logo, coordonnées). La section **Sécurité** règle la longueur minimale des mots de passe, la durée des sessions et le verrouillage, dans des bornes que l'application impose ; la double authentification reste toujours obligatoire. Les valeurs du fichier `.env` (`SESSION_…`, `PASSWORD_MIN_LENGTH`, `LOCKOUT_…`) ne servent que tant que cette section n'a pas été enregistrée.

**9.6 Revue des accès** (ISO 27001, mesure A.5.18) : onglet **Utilisateurs**, boutons **Excel** ou **CSV** de la revue des accès. Le fichier liste chaque compte, ses groupes, ses rôles, ses droits effectifs, sa dernière connexion et son expiration. Le bouton **Droits effectifs** d'un compte montre l'origine de chaque droit (rôle direct ou groupe). Faites cette revue au moins une fois par an, et archivez le fichier.

**9.7 Affichage** : chaque personne règle sa **Taille d'affichage**, sa **Densité** et son **Thème** dans **Mon compte**, section **Affichage**. Ces choix sont enregistrés sur le serveur et suivent la personne sur tous ses appareils. Les valeurs par défaut de l'organisation se règlent dans **Paramètres**, section **Apparence**.

**9.8 Écran mural** (grand écran de salle de réunion, tableau de bord permanent, sans compte nominatif) :
1. Sur l'ordinateur relié à l'écran, installez le certificat racine (étape 8.3) et ouvrez le navigateur.
2. Depuis votre poste : **Administration**, onglet **Écrans muraux**. Saisissez un **Nom** (par exemple « Salle de réunion »), la **Durée de validité** (180 jours par défaut, 365 au plus) et les **Modules affichés**, puis cliquez sur **Créer le lien d'activation**.
3. Le lien s'affiche **une seule fois** ; il est valable **24 heures** et ne sert qu'une fois. Ouvrez-le dans le navigateur de l'écran mural (copiez-le par un support interne, jamais par courriel externe).
4. L'écran affiche le tableau de bord. Bouton **Plein écran** (ou touche F11) ; **Rotation** fait défiler les vues toutes les 30 secondes. L'adresse `https://<nom_dns>/mur?rotation=30` peut servir de page d'accueil du navigateur de l'écran.
5. Pour couper l'écran : bouton **Révoquer** sur sa ligne. L'écran affiche « Écran non autorisé » en moins d'une minute. À l'expiration, recréez un écran.

Une personne connectée (même avec le seul rôle **Lecteur**) peut aussi ouvrir **Écran mural** depuis le menu.

**9.9 Cartographie du SMSI** (menu **Cartographie**) : vue contexte et vue processus, construites à partir des données déjà saisies (périmètre, processus, parties intéressées, enjeux des objectifs et des SWOT, applications du GAP, fournisseurs), puis ajustées à la main. Droits (module **Cartographie du SMSI** de la matrice) : les rôles **Administrateur** et **RSSI** font tout ; **Contributeur** génère, modifie, enregistre et exporte ; **Lecteur** consulte et exporte ; **Auditeur externe** consulte si le module lui est ouvert. Supprimer une carte ou une version est réservé au droit « supprimer ». Une carte ne contient que la présentation : renommer un processus dans son module le renomme sur la carte, sans la modifier. Les objets d'un module que la personne ne peut pas lire apparaissent « Objet non accessible ». La carte peut aussi être **construite de zéro** (bouton **Construire la carte**, puis palette ou clic droit) : une partie intéressée, un fournisseur, un processus… créé sur la carte est enregistré dans son module, ce qui demande aussi le droit « Créer et modifier » de ce module (Pilotage, Fournisseurs ou Conformité).

<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" compte https://<nom_dns> -->

---

## 10. Reprendre les données de l'ancien outil

Sautez cette étape si vous démarrez sans historique.

> **Vous mettez à jour un serveur v2 existant ?** N'importez rien : les données sont reprises automatiquement à la mise à jour (étape 12.4).

**10.1 Exporter depuis l'ancien outil** (le fichier HTML utilisé jusqu'ici), sur votre poste :
1. Ouvrez-le dans le navigateur, comme d'habitude.
2. Cliquez sur **Exporter**, puis :
   - **Exporter pour la nouvelle version** si ce choix existe (version récente de l'outil) ;
   - sinon **Sauvegarde complète (JSON)**.
3. Un fichier `.json` est enregistré dans vos **Téléchargements**.

> Si la nouvelle application refuse le fichier en indiquant un « schéma trop ancien », ouvrez ce fichier dans l'ancien outil (**Paramètres**, **Importer une sauvegarde**), puis exportez-le à nouveau.

**10.2 Simuler l'import.** La simulation **n'écrit rien** : elle montre ce qui serait fait.
1. Connecté en administrateur, ouvrez **Administration**, puis l'onglet **Import des données legacy**.
2. Cliquez sur **Choisir le fichier à importer** et sélectionnez le fichier `.json`.
3. **Mode d'import** : choisissez **Initialiser (base vide uniquement)** pour une première reprise.
4. Cliquez sur **Simuler l'import**.

**Résultat attendu** : un rapport par module (écarts, processus, fournisseurs…), avec le nombre d'éléments **Créés**, **Modifiés**, **Inchangés** et **Supprimés**. Lisez les avertissements : champs inconnus et références cassées sont listés, et le rapport est téléchargeable pour l'archiver.

> Les cartes dessinées avec le module bêta **Cartographie** de l'ancien outil sont reprises (module « Cartographie du SMSI » du rapport) : elles s'ouvrent ensuite dans le menu **Cartographie**.

**10.3 Appliquer l'import :** cliquez sur **Appliquer l'import**.

**Résultat attendu** : l'import apparaît dans **Historique des imports** avec l'état « appliqué ». Une sauvegarde de l'état précédent est faite juste avant : le bouton **Annuler** de l'historique revient en arrière tant que les données n'ont pas été modifiées depuis. Les autres utilisateurs connectés voient les données arriver sans recharger la page.

<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" import https://<nom_dns> /opt/suivi-audits/tests/fixtures/legacy-fixture.json -->

> Les autres modes : **Fusionner** ajoute et met à jour sans jamais rien supprimer ; **Remplacer un module** remplace un seul module et **supprime** les éléments absents du fichier (il faut ressaisir le nom du module pour confirmer).

**10.4 Charger un jeu de données de test (instance de test uniquement).** Pour évaluer la plateforme sans saisir de données réelles, l'API sait charger un jeu **fictif et cohérent** (processus, objectifs et indicateurs, parties intéressées, fournisseurs évalués, écarts, plans d'audit, revue de direction, référentiel de démonstration, méthode de risque et risques appréciés, actions, série récurrente, opportunités) :

<!-- ci: skip — instance de test uniquement, jamais rejoué par le guide -->
```bash
sudo docker compose exec app suivi jeu-de-test <compte administrateur> --confirmer
```

Le chargement n'est jamais automatique : il est **refusé si le pilotage n'est pas vide** et écrit au nom du compte indiqué (journal d'audit). Ne l'utilisez pas en production. Il passe par l'API publique, donc par les mêmes validations que la saisie.

**10.5 Contrôler les relations entre les données.** Après un import, un chargement ou une migration :

<!-- ci: skip — contrôle d'exploitation, couvert par les tests de la CLI -->
```bash
sudo docker compose exec app suivi controle-relations --anomalies
```

La commande vérifie les références logiques entre objets (processus, objectifs, indicateurs, fournisseurs, risques, décisions, liens) et affiche une ligne par anomalie ; sans `--anomalies`, elle renvoie un JSON. Le script de mise à jour l'exécute avant et après la montée de version et signale l'écart **sans bloquer** la mise à jour. Pour PostgreSQL 18, la migration depuis la version 17 compare en plus le nombre de lignes et les contraintes (clés étrangères, unicité) avant d'être déclarée réussie ([ADR 0035](adr/0035-postgresql-18-migration-automatique.md)).

---

## 11. Mettre en place les sauvegardes

Une sauvegarde contient la base (suivi, comptes, documents chiffrés, journal), les secrets (clé de chiffrement des documents) **et** l'autorité de certification interne, lus dans le dossier des données. Elle est elle-même chiffrée avec [age](https://github.com/FiloSottile/age) pour **deux clés** : celle du serveur et une **clé de secours** que le RSSI garde hors du serveur ([ADR 0071](adr/0071-sauvegardes-chiffrees-avec-age.md)). Aucune sauvegarde n'est jamais produite en clair. Chaque sauvegarde laisse un rapport dans `/srv/suivi-audits/donnees/etat/` : **Administration**, onglet **Système**, affiche la date de la dernière sauvegarde réussie et une **alerte au-delà de 48 h**.

> ⚠️ Sans la clé du serveur **ni** la clé de secours, les sauvegardes sont **illisibles**, définitivement. Sans les sauvegardes, une panne du serveur fait **tout perdre**.

**11.1 Contrôler les clés de sauvegarde.** Elles ont été créées à l'étape 6.8, avant le premier démarrage (Compose les monte dans l'exécutant et refuse de démarrer sans elles). Vérifiez leur présence et leurs droits :

<!-- ci: run -->
```bash
sudo ls -l /root/.suivi-backup-key /root/.suivi-backup-recipients
```
**Résultat attendu** : deux fichiers appartenant à `root`, la clé du serveur en `-rw-------`. **Gardez la clé de secours privée (`cle-secours-suivi.key`) hors ligne** et testez-la à l'étape 11.4.

**11.2 Lancer une première sauvegarde :**

<!-- ci: run -->
```bash
sudo mkdir -p /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : aucun message.

<!-- ci: run -->
```bash
sudo ./scripts/backup.sh /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : la dernière ligne est `Sauvegarde : /srv/sauvegardes/suivi-audits/suivi-audits-<date>-<heure>.tar.age`. Sans les clés de l'étape 6.8, le script refuse de sauvegarder et n'écrit aucun fichier en clair.

<!-- ci: run -->
```bash
sudo ls -lh /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : deux fichiers, `suivi-audits-….tar.age` (la sauvegarde) et `suivi-audits-….tar.age.sha256` (son empreinte, qui permet de détecter une altération).

**11.3 Planifier une sauvegarde chaque nuit à 2 h 15** (conservation : 90 jours), et la recherche d'une nouvelle version chaque matin à 6 h 40 :

<!-- ci: run -->
```bash
printf '%s\n' '15 2 * * * root cd /opt/suivi-audits && ./scripts/backup.sh /srv/sauvegardes/suivi-audits >> /var/log/suivi-backup.log 2>&1' '40 6 * * * root cd /opt/suivi-audits && ./scripts/verifier-version.sh >> /var/log/suivi-version.log 2>&1' | sudo tee /etc/cron.d/suivi-audits
```
**Résultat attendu** : les deux lignes s'affichent à nouveau. Le lendemain, `sudo tail /var/log/suivi-backup.log` doit montrer `Sauvegarde : …`, et `sudo tail /var/log/suivi-version.log` la dernière version publiée.

La recherche de version ne fait qu'**informer** : quand une nouvelle version est publiée, un bandeau l'annonce aux administrateurs dans l'application. Rien n'est installé automatiquement (étape 12.1).

Demandez à l'équipe infrastructure d'**inclure les dossiers `/srv/suivi-audits/donnees` et `/srv/sauvegardes/suivi-audits` dans la sauvegarde externalisée** du serveur : une sauvegarde restée sur le serveur disparaît avec lui.

**11.4 Tester la restauration — obligatoire.** Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde. Faites ce test **maintenant**, avant d'ouvrir l'application aux utilisateurs, puis une fois par an sur un serveur de test.

> ⚠️ La restauration **remplace** toutes les données actuelles par celles de la sauvegarde. Juste après l'installation, rien n'est perdu. Plus tard, faites ce test sur un **serveur de test**, jamais sur le serveur en service.

Repérez le nom exact du fichier `.tar.age` affiché à l'étape 11.2, puis :

Avant confirmation, vérifier l’archive sans arrêter l’application ni modifier ses données :

<!-- ci: instead: sudo ./scripts/restore.sh --verifier "$(sudo sh -c 'ls -1 /srv/sauvegardes/suivi-audits/*.tar.age' | tail -1)" -->
```bash
sudo ./scripts/restore.sh --verifier /srv/sauvegardes/suivi-audits/<fichier>.tar.age
```

Résultat : « Vérification réussie. Restauration non exécutée. » Python 3 utilise uniquement sa bibliothèque standard, sans paquet à télécharger. L’archive est copiée dans un dossier temporaire privé, puis son empreinte, son déchiffrement et ses contenus imbriqués sont contrôlés. Une erreur empêche tout remplacement : archive modifiée ou tronquée, clé qui n'est pas destinataire de l'archive, ou archive renommée (l'INFO de l'archive doit correspondre à son nom de fichier, à son horodatage et à son identifiant de demande). Cette vérification ne prouve pas l’authenticité du fichier ni la réussite d’une restauration PostgreSQL : conserver la recette isolée ci-dessous.

Formats acceptés : archives GNU/USTAR produites par backup.sh, contenant suivi.dump, secrets.tgz, INFO et éventuellement caddy.tgz. Chemins absolus/traversées, liens, fichiers spéciaux/sparse, doublons et extensions PAX sont refusés. Limites : archive/dump 64 Gio, chaque archive imbriquée décompressée 512 Mio, INFO 1 Mio, 20000 en-têtes et 64 niveaux. Prévoir dans le disque temporaire l’espace pour la copie, le déchiffrement et les contenus extraits. Une archive sans fichier .sha256 reste lisible pour compatibilité, avec avertissement ; un fichier d’empreinte présent doit désigner exactement l’archive sélectionnée. Ne pas renommer un fichier sans actualiser son empreinte.

La restauration destructive exige root et la confirmation RESTAURER. Elle refuse un verrou de sauvegarde/exécutant déjà actif, contrôle le catalogue PostgreSQL avant arrêt, applique uniquement les fichiers validés, puis invalide les sessions restaurées. Il faut se reconnecter. L’attente PostgreSQL et la santé de l’application sont bornées par RESTORE_WAIT_SECONDS (300 secondes par défaut, 1 à 1800). Aucun rapport de succès n’est écrit si ces contrôles échouent. Après un échec pendant remplacement, conserver la sauvegarde de sécurité et faire intervenir l’exploitant : ce sous-lot ne fournit pas de rollback automatique ni de déclenchement HTTP.

<!-- ci: instead: echo RESTAURER | sudo ./scripts/restore.sh "$(sudo sh -c 'ls -1 /srv/sauvegardes/suivi-audits/*.tar.age' | tail -1)" -->
```bash
sudo ./scripts/restore.sh /srv/sauvegardes/suivi-audits/<fichier>.tar.age
```
Sur un autre serveur (perte de la clé du serveur), indiquer la clé de secours : `sudo BACKUP_KEY_FILE=/chemin/cle-secours-suivi.key ./scripts/restore.sh <fichier>.tar.age`.

**Anciennes archives `.tar.enc`** (phrase secrète, version 5.x) : elles ne figurent plus dans l'écran de sauvegardes et ne se restaurent que par `sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/restore.sh --ancien-format <fichier>.tar.enc`, pour une version seulement : **conservez l'ancienne phrase secrète** tant que vous gardez de telles archives, et faites une nouvelle sauvegarde `.tar.age`.
Le script vérifie l'empreinte et la structure, puis demande de taper `RESTAURER` (en majuscules) suivi d'**Entrée**.
**Résultat attendu** : la dernière ligne est `Restauration terminée.` Attendez une minute et vérifiez les états (étape 7.3), puis connectez-vous : vos comptes et vos données sont présents. Notez la date de ce test dans **Paramètres**, section **Sauvegardes** : l'application signale quand le prochain test est dû.

<!-- ci: exec: "$GITHUB_WORKSPACE/scripts/ci/guide-attendre.sh" -->
<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" verifier https://<nom_dns> -->
<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" systeme https://<nom_dns> -->

---


**11.5 Activer les demandes manuelles depuis Configuration système > Sauvegardes et restauration (A1a).**

**Installation normale depuis 3.0.2 : déjà activé automatiquement.** Le service `updater` exécute également le poller commun, sans cron supplémentaire. Passer à la section 11.6 pour la clé et le catalogue. Les commandes A1a ci-dessous restent utiles uniquement pour les installations antérieures ou un exécutant hôte choisi explicitement.

La migration additive `006_sauvegardes.sql` est appliquée au démarrage. L’application enregistre une demande ; elle n’exécute aucun shell et ne reçoit ni clé ni chemin. Un exécutant sur le serveur interroge la file. Il réutilise `backup.sh`, avec chiffrement obligatoire. La restauration reste la procédure 11.4 ; l’empreinte SHA-256 vérifie la cohérence du fichier, pas son authenticité ni sa restaurabilité.

Après les étapes 6.8 et 11.1–11.4, vérifier que la clé du serveur est un fichier régulier, **non vide**, lisible par root seul (0600), et que le fichier de clés publiques de secours contient au moins une clé `age1…`. La clé de secours privée reste hors du serveur, dans le coffre-fort. La destination doit être persistante, privée et incluse dans la sauvegarde externalisée. `RETENTION_DAYS` accepte 1 à 36500 (90 par défaut ; 36500 conserve la compatibilité avec les sauvegardes avant mise à jour, dont les cinq dernières sont gardées) ; `BACKUP_PREFIXE` accepte 1 à 61 caractères ASCII alphanumériques, point, tiret ou soulignement, avec un premier caractère alphanumérique. Ces contrôles s’appliquent aussi aux appels directs de `backup.sh`.

**Conservation minimale.** La rotation de `backup.sh` garde toujours les `BACKUP_GARDER_MIN` sauvegardes les plus récentes du dossier de destination (7 par défaut, de 1 à 365), même au-delà de `RETENTION_DAYS` ; seules les suivantes disparaissent, avec leur fichier `.sha256`, si elles ont plus de `RETENTION_DAYS` jours. L’exécutant des demandes web relève la durée enregistrée dans Configuration système à `RETENTION_MIN_DAYS` (30 par défaut, de 1 à 36500), lue dans `.env` sur le serveur ; une valeur hors bornes fait échouer la demande au lieu de supprimer des sauvegardes. Les deux réglages sont facultatifs et se placent dans `.env` (voir `.env.example`).

**Identifiants réservés.** Les UID 70, 100, 1000 et 1001 servent aux conteneurs de la pile (base, antivirus, application, frontal) et aux dossiers de `DATA_DIR` : ne les attribuer à aucun compte humain ou de service de l’hôte. Une alternative est l’option `userns-remap` de Docker, qui décale les identifiants des conteneurs ; elle modifie les droits des dossiers montés et se valide d’abord hors production.

Sur le serveur d’exploitation uniquement :

<!-- ci: skip — configuration facultative de la tâche hôte A1a, testée avec un exécutant isolé -->
```bash
cd /opt/suivi-audits
sudo chmod 0600 /root/.suivi-backup-key
sudo BACKUP_DEST=/srv/sauvegardes/suivi-audits RETENTION_DAYS=90 ./scripts/backup-worker.sh
```

Sans demande, ce passage annonce seulement que l’exécutant est prêt. Il ne crée pas de sauvegarde. Ajouter un fichier cron distinct, sans écraser la sauvegarde nocturne existante :

<!-- ci: skip — installation facultative d’une tâche privilégiée sur le serveur d’exploitation -->
```bash
printf '%s\n' '* * * * * root cd /opt/suivi-audits && BACKUP_DEST=/srv/sauvegardes/suivi-audits RETENTION_DAYS=90 ./scripts/backup-worker.sh >> /var/log/suivi-backup-worker.log 2>&1' | sudo tee /etc/cron.d/suivi-backup-worker
sudo chmod 0644 /etc/cron.d/suivi-backup-worker
```

Le passage chaque minute **interroge la file**, sans planifier une sauvegarde chaque minute. Un contact de plus de deux minutes rend le bouton indisponible. Un utilisateur doté du droit Administration/Administrer confirme « Demander une sauvegarde » ; le prochain passage prend la demande, puis l’écran affiche son résultat. Administration/Lire permet seulement la consultation. Aucun changement de permissions prédéfinies.

Une seule demande est active ; un réessai réseau conserve son identifiant. L’annulation concerne seulement une demande en attente et vérifie sa version. Deux exécutants simultanés sont exclus par un verrou hôte ; `backup.sh` conserve aussi un verrou partagé avec les tâches nocturnes et de mise à jour. Une collision produit un échec explicite, sans relance automatique. Une demande interrompue passe en échec au prochain passage valide ; examiner le journal hôte avant une nouvelle demande.

Les commandes `suivi backup-worker ready|unavailable`, `suivi backup-claim` et `suivi backup-finish <uuid> <code>` sont réservées au script hôte dans le conteneur app. Elles ne constituent pas des routes HTTP. Les rapports par demande restent dans `DATA_DIR/etat/sauvegardes/jobs/`. L’écran expose seulement le nom de fichier, la taille, la durée et l’empreinte, sans chemin hôte ni clé. Les 50 dernières demandes sont affichées ; l’historique SQL et l’audit ne sont pas purgés par la rotation des archives.

Recette après configuration : confirmer une demande, attendre son résultat « Réussie », contrôler la présence de l’archive `.tar.age` et de son `.sha256`, puis réaliser une restauration **sur un serveur isolé**, selon 11.4. L’application ne déclare pas cette restauration validée automatiquement. En cas d’échec, consulter `/var/log/suivi-backup-worker.log` et corriger la configuration ; aucun secret ne doit être copié dans un ticket. Supprimer uniquement `/etc/cron.d/suivi-backup-worker` désactive ce poller, sans supprimer les données ni la sauvegarde nocturne.

### 11.6 Pilotage complet du lot A (poller commun)

La migration additive `007_exploitation.sql` est appliquée au démarrage. À partir de **3.0.2**, le service `updater` de l'installation Compose exécute le poller commun automatiquement : sauvegardes manuelles/planifiées, catalogue, vérifications, restaurations et TLS autorisé. Aucun nouveau service, paquet ni cron. Il utilise par défaut **`DATA_DIR/sauvegardes`** (privé, persistant) et les clés age de l'étape 6.8 (**`/root/.suivi-backup-key`** et **`/root/.suivi-backup-recipients`**, root, montées en lecture seule dans l'exécutant, hors API). Elles sont créées à l'étape 6.8 et doivent exister **avant** `docker compose up` : Compose refuse de démarrer l'exécutant sans elles plutôt que de créer des dossiers à leur place. Externaliser les archives. Les verrous hôte et SQL empêchent les opérations concurrentes ; une mise à jour attend le passage actif. Les fichiers temporaires volumineux sont dans `DATA_DIR/reprise-exploitation/tmp`, hors du petit `/tmp` du conteneur.

**Catalogue existant** : renseigner le chemin serveur `BACKUP_DEST` (et, si les clés ne sont pas aux emplacements par défaut, `BACKUP_KEY_FILE` et `BACKUP_RECIPIENTS_FILE`) dans `.env`, puis redémarrer `updater` ; Compose les monte pour l'exécutant, sans les exposer à l'API. Le dossier doit être persistant, possédé par root et non modifiable par le groupe/les autres comptes ; la clé du serveur est régulière, non vide, root 0600. Les anciennes archives `.tar.enc` ne sont plus listées (voir l'étape 11.4 pour les restaurer). Aucun cron existant n'est supprimé ou changé : éviter de planifier deux sauvegardes nocturnes pour le même besoin, même si les verrous empêchent une exécution simultanée.

**Mode hôte facultatif** : pour conserver le poller externe plutôt que l'intégration Compose, mettre `EXPLOITATION_AUTO=0` dans `.env`. Les commandes ci-dessous restent utilisables, avec Python 3, Docker Compose, OpenSSL et age sur le serveur. Le poller commun remplace alors le poller A1a ; ils partagent un verrou. La recette du guide utilise ce mode pour contrôler explicitement chaque opération ; la CI normale teste aussi la sauvegarde automatique depuis le bouton, sans cron.

<!-- ci: skip — configuration de production facultative ; protocole complet rejoué dans le job guide, recette lot A -->
```bash
cd /opt/suivi-audits
sudo BACKUP_DEST=/srv/sauvegardes/suivi-audits python3 ./scripts/exploitation-worker.py
```

Installer un cron dédié (une fois par minute, un seul passage actif) :

<!-- ci: skip — activation privilégiée spécifique au serveur de production -->
```bash
sudo tee /etc/cron.d/suivi-exploitation > /dev/null <<'CRON'
* * * * * root cd /opt/suivi-audits && BACKUP_DEST=/srv/sauvegardes/suivi-audits python3 ./scripts/exploitation-worker.py >> /var/log/suivi-exploitation.log 2>&1
CRON
sudo chmod 0644 /etc/cron.d/suivi-exploitation
```

Dans Configuration système > Sauvegardes et restauration, régler jours ISO, heure/minute **UTC** et rétention (1–36500 jours). La planification est désactivée par défaut. Le prochain créneau est affiché dans le fuseau de votre navigateur. Le poller accepte au plus quinze minutes de retard, consomme chaque créneau avant la demande et ne rejoue pas les créneaux anciens après panne/restauration. Un conflit peut faire manquer un créneau : consulter les statuts et demander une sauvegarde manuelle. Avant d'activer la planification web, retirer **uniquement la ligne de sauvegarde nocturne directe** de l'étape 11.3 et le cron `suivi-backup-worker` de 11.5. Conserver les autres tâches du serveur. Si la planification web est désactivée, le cron de sauvegarde direct peut être conservé ; il reste régi par sa propre rétention. Aucun cron existant n'est modifié par l'application.

Le catalogue montre les 200 archives régulières les plus récentes du dossier configuré, sans sous-dossiers/liens, avec taille, date, chiffrement et contrôle SHA-256. Une empreinte absente ou incohérente interdit les demandes. Vérifier d'abord une archive, puis choisir Restaurer : seules les archives chiffrées et vérifiées sur la même empreinte sont admissibles. Taper RESTAURER après contrôle du périmètre. L'exécutant copie et recontrôle l'archive, crée et vérifie une sauvegarde de sécurité dans `.restauration-securite/<id>/`, puis applique la restauration. Ces sauvegardes de sécurité sont exclues de la rotation : leur conservation/externalisation et suppression après revue relèvent de l'exploitant. Dimensionner le disque pour l'archive copiée, déchiffrée, extraite et la sauvegarde de sécurité ; un contrôle préalable en échec n'est pas une réussite.

Les journaux publics sont dans `DATA_DIR/etat/exploitation` ; les fichiers de reprise privés dans `DATA_DIR/reprise-exploitation` (root, 0700, hors montage API). Ils survivent à la restauration de PostgreSQL. La session sera fermée ; reconnectez-vous pour consulter le résultat. Une erreur d'application déclenche la restauration de la sauvegarde de sécurité. Après interruption, le poller ne rejoue pas l'archive demandée : il reprend uniquement le retour arrière de sécurité si l'application avait commencé. Un retour arrière interrompu/échoué bloque les tâches avec Intervention requise. Reprendre manuellement avec l'équipe d'exploitation, relire les données/documents, vérifier TLS et la santé avant d'acquitter :

<!-- ci: skip — action réservée à l'exploitant après reprise manuelle contrôlée, UUID d'un incident réel -->
```bash
sudo BACKUP_DEST=/srv/sauvegardes/suivi-audits python3 ./scripts/exploitation-worker.py --acquitter <UUID>
```

Les demandes anciennes réintroduites depuis une archive sont neutralisées ; aucune restauration/certification/sauvegarde en attente du passé n'est exécutée. Une demande peut être annulée tant qu'elle reste en attente, avec contrôle de version. Les résultats sont notifiés lorsque l'écran est ouvert ; le journal reste la référence après reconnexion. La rétention normale concerne les archives de préfixe standard à la prochaine sauvegarde, sans supprimer les sauvegardes avant mise à jour ni les sauvegardes de sécurité.

### 11.7 Certificats TLS et priorité explicite

Caddy termine TLS. **Le mode de certificat se choisit dans l'application** (Administration, Système, Certificats TLS), sans fichier à modifier ([ADR 0050](adr/0050-certificats-depuis-l-interface.md)) :

- **Autorité interne du serveur (autosigné)** : le serveur signe son propre certificat. L'application propose de télécharger le certificat racine à installer sur les postes (étape 8.3).
- **ACME** : indiquez un courriel de contact (et, si besoin, l'adresse d'un autre serveur ACME publiquement fiable ; vide = Let's Encrypt). Le serveur obtient le certificat, le contrôle (chaîne publiquement fiable exigée) et le renouvelle seul. Prérequis : le nom du serveur est public, les ports 80 et 443 sont joignables depuis Internet et le serveur peut joindre le serveur ACME. Si l'émission échoue, la configuration précédente est rétablie et le journal dit pourquoi. Un serveur ACME privé n'est pas pris en charge.
- **Certificat fourni** : certificat/chaîne PEM et clé PEM non chiffrée, contrôlés ensemble avant installation.
- **Réglage de départ** : « Revenir au réglage de départ » rend la main à `CADDY_TLS` dans `.env`. Tant qu'aucun mode n'est choisi dans l'application, `.env` reste seul responsable.

La gestion depuis l'application est active par défaut. `TLS_WEB_MANAGEMENT=0` dans `.env` l'interdit ; si TLS est terminé par un ingress/proxy extérieur, régler `TLS_TERMINATION=external` : observation du certificat public sur SITE_ADDRESS:443, aucune modification proposée. L'accès d'observation doit être permis depuis l'hôte ; aucune sortie Internet n'est donnée à l'API.

**Adresse du client et `TRUST_PROXY`.** L'API lit l'adresse du client (audit, limites par adresse) dans `X-Forwarded-For`, mais seulement à travers les relais déclarés. `TRUST_PROXY` accepte : un **nombre de relais** (1 à 10 ; l'adresse retenue est celle que le dernier relais de confiance a vue), une **liste d'adresses ou de CIDR** séparés par des virgules (par exemple `10.0.0.0/8,192.168.1.5`), `false` (aucun relais, l'en-tête est ignoré) ou `true` (compatibilité : tous les relais, première adresse de la liste). Une valeur mal formée arrête le démarrage de l'API avec un message explicite. La pile fournie fixe `TRUST_PROXY: '1'` dans `docker-compose.yml` : seul `web` précède l'API, et `gateway` remplace l'en-tête du navigateur avant lui ; ne pas ajouter de relais devant `gateway` sans revoir cette valeur.

Priorité : le marqueur `secrets/tls-web/mode` (sauvegardé avec le couple, il ne contient que `web`, `env`, `interne` ou `acme`) sélectionne le mode. Pour `web`, les chemins fixes `/certs-web/cert.pem` et `key.pem` ; pour `acme`, le fichier `secrets/tls-web/acme` (deux lignes, courriel puis adresse `https://…`, revalidées au démarrage du frontal) ; sinon Caddy utilise exactement `CADDY_TLS` dans `.env`. Aucun shell ni fichier de configuration fourni par un utilisateur n'est interprété. Le fichier `.env` n'est jamais modifié par une demande web. Caddy ne reçoit qu'un seul émetteur ACME (pas de serveur de secours). Aucun bouton ne prétend forcer un renouvellement : Caddy renouvelle seul.

Le certificat/chaîne PEM et la clé PEM non chiffrée sont contrôlés ensemble (format, validité, hôte, clé publique et chaîne). La clé est scellée avec Vault en base, déchiffrée seulement par la CLI hôte, écrite dans `DATA_DIR/secrets/tls-web` (uid Caddy 1001, fichiers 0400) et incluse dans les sauvegardes chiffrées. Son contenu n'est pas rendu dans l'interface, l'API de lecture, les notifications ou l'audit ; il est effacé de la demande terminée/annulée. Ne pas copier de clé dans les journaux, arguments CLI ou fichiers d'état publics. Conserver les permissions et les sauvegardes externalisées.

L'exécutant valide Caddy, recrée le frontal, vérifie le certificat réellement servi avec l'hôte attendu et la santé. Un échec rétablit le couple/mode antérieur ; une interruption du retour arrière exige la reprise manuelle ci-dessus. Les métadonnées de simple observation (sujet, émetteur, validité, empreinte) ne constituent pas une attestation de confiance PKI. Une expiration à trente jours ou moins déclenche une alerte dans l'interface. Une restauration réattribue aussi les droits des clés TLS sauvegardées avant redémarrage.


### 11.8 Envoi de courriels

Aucune étape d'installation supplémentaire : l'envoi de courriels (message de test et alertes d'exploitation au contact technique) se règle entièrement dans l'application, sous Administration, Configuration système, Courriel ([ADR 0049](adr/0049-courriel-et-sortie-reseau-optionnelle.md)). Le conteneur de l'API n'a toujours aucun accès à Internet : c'est l'exécutant d'exploitation du serveur, installé à l'étape 11.6, qui se connecte au serveur SMTP, sous un compte sans privilège, avec les paramètres saisis dans l'interface. Il doit donc pouvoir joindre le relais SMTP depuis le serveur ; si votre pare-feu le bloque, le message de test échoue avec une explication. L'authentification prend en charge PLAIN et LOGIN ; XOAUTH2 (Exchange Online avec authentification moderne) n'est pas pris en charge.

**Notifications par courriel** ([ADR 0058](adr/0058-notifications-metier.md)). Les notifications métier (échéance d'une action, réévaluation d'un risque, rapprochements à valider) peuvent aussi partir par courriel, **aucune étape d'installation de plus** : qui les reçoit, par groupe, par rôle ou par compte, se règle dans l'application (Administration, Plateforme, Destinataires des notifications ; chaque personne règle les siennes dans Mon compte). Tant que le courriel n'est pas activé et configuré, l'interface le dit (« Courriel non configuré, rien n'est envoyé ») et aucune demande n'est mise en file. Quand il l'est, le même exécutant d'exploitation envoie ces courriels, au plus 20 par passage (une minute environ) : une rafale s'écoule en quelques passages, et une demande restée en attente plus de trois jours est abandonnée. Un courriel ne contient que le type de la notification, un titre court et l'adresse de la rubrique « Rappels » (jamais de donnée métier) ; le lien reprend l'adresse du site (`SITE_ADDRESS`, déjà renseignée à l'installation). Un échec d'envoi n'empêche jamais la notification d'apparaître dans l'application et se lit dans la carte « Destinataires des notifications ».

**Alertes de verrouillage de compte** ([ADR 0070](adr/0070-reponse-de-connexion-uniforme-et-alerte-de-verrouillage.md)), **aucune étape d'installation de plus** : quand un compte est verrouillé après plusieurs échecs, un courriel part vers le **contact technique** (Administration, Configuration système, Courriel) et vers chaque **administrateur actif** (rôle Administrateur, directement ou par un groupe), à l'adresse de son compte. Cette alerte de sécurité ne se désactive ni par les réglages personnels ni par l'interrupteur des alertes d'exploitation ; elle ne contient ni adresse IP ni code, seulement le compte, l'heure, le motif et la fin du verrou. Au plus 10 alertes détaillées par heure, puis une synthèse horaire ; chaque verrou reste dans le journal d'audit (action `auth.account_locked`). Sans courriel configuré, rien n'est envoyé et l'écran Courriel l'indique. La connexion répond la même chose (401) pour un compte inconnu, un mauvais mot de passe ou un compte verrouillé : le motif exact se lit dans le journal d'audit.

## 12. Mettre à jour

### Configuration de l’environnement (retirée)

Retirées par la migration `037_retrait_environnement.sql` (décision du 25/10/2026, [ADR 0046](adr/0046-retrait-du-catalogue-environnement.md)) : les échelles et matrices se publient dans Configuration GRC. La sauvegarde automatique de la mise à jour précède la suppression.

### Mise à jour depuis l’application

L’installation Compose normale démarre désormais `gateway` (frontal HTTPS stable), `web` (interface interne), `app`, `db`, `init` et `updater` (exécutant privilégié). Aucun cron ni fichier de configuration supplémentaire n’est nécessaire pour la mise à jour intégrée. Une installation existante reçoit ces services lors de sa première mise à niveau vers une version qui les contient ; la procédure serveur ci-dessous reste disponible pour ce premier passage et pour le dépannage.

Chaque utilisateur connecté voit un bandeau fin dès qu’une nouvelle version numérotée est disponible : version installée, version disponible, lien vers les nouveautés. Le contrôle est automatique au démarrage puis toutes les six heures. **Aucun identifiant n’est monté par défaut dans l’exécutant** ([ADR 0061](adr/0061-mise-a-jour-web-renforcee.md)) : le dépôt public est lu en HTTPS et les images publiques sans connexion. Pour un dépôt ou un registre privé, ajouter dans `.env` `UPDATER_SSH_DIR=/root/.ssh` (clé de déploiement, étapes 4.1–4.3) et/ou `UPDATER_DOCKER_CONFIG=/root/.docker` (jeton de lecture, étape 4.5) : ils sont alors montés **en lecture seule**. Lors de la mise à jour vers cette version, une installation qui dépend encore d’une connexion au registre `ghcr.io` ou d’une clé de déploiement (dépôt non lisible en HTTPS) les conserve automatiquement ; le script l’annonce. Les retirer de `.env` dès qu’ils ne servent plus. L’API GitHub publique est essayée en premier et accepte les publications stables uniquement ; si le dépôt est privé, les étiquettes numériques et la présence des trois artefacts sont contrôlées par la clé de déploiement et le registre. Ce dernier chemin peut proposer une préversion **numérotée** comme celle de la section 12.0 ; les suffixes `-beta`/`-dev` restent refusés. Une panne réseau conserve la dernière information connue et est signalée, sans prétendre que le serveur est à jour.

Dans **Configuration système → Mises à jour et versions**, un compte ayant le **rôle système Administrateur** peut vérifier manuellement puis confirmer en tapant **METTRE À JOUR** et en saisissant un **code de double authentification** (6 chiffres, à usage unique, demandé à chaque installation ; cinq essais par quart d’heure, chaque refus est journalisé). Une permission personnalisée `administration:administrer` seule ne suffit pas.

**Fenêtre de maintenance** (Paramètres → Sécurité) : jours autorisés et créneau en heure de Paris, désactivée par défaut. Active, elle fait refuser l’installation hors créneau, à la demande comme à sa prise en charge par l’exécutant (refus journalisé) ; la vérification des nouvelles versions reste possible. Un créneau dont la fin précède le début passe minuit. Enregistrer les modifications en cours avant confirmation. Les demandes sont auditées et idempotentes ; une seule peut être active. Le serveur revalide le rôle avant exécution.

L’exécutant télécharge et vérifie les signatures cosign des images API, web et updater, avec l’identité exacte du workflow/tag, ainsi que leur **attestation SBOM** signée par la même identité ([ADR 0063](adr/0063-chaine-de-publication-durcie.md)) : une image sans attestation est refusée. Le SBOM vérifié de chaque composant est conservé dans `DATA_DIR/etat/sbom/<version>` et se télécharge depuis les reçus de mise à jour. Le commit des sources doit correspondre au label de révision des images signées ; les images appliquées sont épinglées par empreinte. Pendant cette préparation, le service reste disponible. Ensuite la maintenance bloque les écritures, attend la fin des mutations déjà engagées, crée une sauvegarde chiffrée et effectue migrations/redémarrage/contrôles de santé et de données. Le frontal sert indépendamment `/update/` et un état public minimal : les utilisateurs et nouvelles connexions conservent la page pendant l’arrêt de l’API, de l’interface et de l’exécutant. Les étapes affichées sont réelles et horodatées, avec la durée écoulée ; aucun pourcentage n’est inventé. À la fin, un **reçu** structuré (versions, étapes, empreintes et signature des images vérifiées, sauvegarde et son empreinte, contrôles des données avant et après) est déposé dans `DATA_DIR/etat/recus-mises-a-jour` et se télécharge depuis Configuration système → Mises à jour et versions ; il ne contient aucune sortie brute de commande et n’est pas servi par le frontal public. Le retour à l’application est automatique après santé confirmée. Un échec avec retour arrière est clairement affiché, avec accès au résultat ; une intervention requise maintient la protection.

`init` crée exclusivement les secrets manquants. Les sauvegardes de mise à jour utilisent les clés age de l'étape 6.8 (root, 0600, montées en lecture seule dans l'exécutant, hors montage API) ; l'ancien fichier `DATA_DIR/update-secrets/backup-pass` n'est plus créé ni utilisé (le conserver s'il sert à restaurer d'anciennes archives `.tar.enc`). Les archives chiffrées sont dans `DATA_DIR/sauvegardes-updates/avant-mise-a-jour`, les cinq dernières sont conservées ; les journaux/reçus privés dans `DATA_DIR/reprise-updates` (root, 0700), l’état public dans `DATA_DIR/etat/updates`. Inclure ces dossiers dans la sauvegarde externalisée du serveur et conserver la clé de secours (privée) dans le coffre-fort pour restaurer après perte du serveur. Ne jamais exposer le socket Docker, le projet en écriture ou ces clés à l’API.

L’exécutant se remplace lui-même à la fin d’une mise à jour ; son successeur termine les contrôles depuis le reçu durable. Après une interruption pendant remplacement, il tente le retour sécurisé depuis la sauvegarde précédente. Une reprise échouée reste bloquée et conserve les références privées pour l’exploitant : examiner le journal, le rapport et la sauvegarde avant toute restauration manuelle. Ne pas supprimer le marqueur de maintenance tant que la santé et les données ne sont pas validées.

**Limites d’exploitation** : Internet/GitHub/GHCR/Sigstore sont nécessaires depuis l’exécutant uniquement. Les accès privés du guide doivent être renouvelés à leur expiration. Le frontal stable reste à la version `GATEWAY_VERSION` inscrite lors de la première mise à jour web : il ne doit pas être recréé au milieu de l’opération. Son moteur TLS est un composant d’infrastructure à entretenir séparément ; la procédure serveur ci-dessous met également à jour le frontal. Les applications/API/interfaces et l’exécutant évoluent depuis le web, le moteur du frontal suit une fenêtre d’entretien distincte. L’indisponibilité des données pendant sauvegarde/migration dépend de leur volume ; la maintenance n’assure pas la disponibilité en cas de panne de l’hôte, du stockage ou du frontal lui-même. Les proxy/TLS externes restent gérés par l’infrastructure.


### 12.0 Mettre à jour vers 3.1.0 depuis le menu de mise à jour

La version **3.1.0** est la version stable unique : elle est publiée depuis `main`, qui reprend la branche de travail `claude-suivi-smsi` (unification Pilotage SMSI et gestion des risques, voir le `CHANGELOG`). Les images API, web et updater sont publiées et signées seulement après la réussite des contrôles CI et CodeQL du commit exact, puis de leurs scans HIGH/CRITICAL et de leurs signatures. Les étiquettes d'images installables ne sont exposées qu'une fois les trois composants validés. Les préversions éventuelles (canal `development`) ne peuvent venir que de `claude-suivi-smsi`.

Sur une installation **v3** disposant déjà de `gateway`/`updater`, ouvrir **Configuration système → Mises à jour et versions**, choisir **Vérifier**, lire les nouveautés de `3.1.0`, puis confirmer **METTRE À JOUR**. La sauvegarde chiffrée, la maintenance persistante, les contrôles et le retour arrière sont ceux décrits ci-dessus. Aucune installation automatique. La migration additive `016_risques_acceptation.sql` s'applique au démarrage ; un retour à `3.0.2` reste possible (voir `docs/unification/PLAN-EVOLUTION.md`, « Retour arrière »).

Le dépôt est public depuis le 11 octobre 2026 : `/releases/latest` désigne la dernière version stable. Les installations v2 suivent d'abord la montée de version 12.4.

**Premier redéploiement d'un ancien updater** : si l'installation utilise une image construite avant `3.0.2`, celle-ci peut manquer de GNU find, indispensable à son ancien script de rotation des archives. Une première reconstruction/redéploiement depuis cette branche est alors nécessaire, selon la section 7 ; les trois images doivent être reconstruites et les services redémarrés. L'ancienne image ne peut pas corriger elle-même l'outil qui lui manque avant remplacement. Cette livraison contient l'outil et la coordination des verrous ; les mises à jour suivantes utilisent le menu. Conserver un numéro local inférieur à `3.0.2` et les accès Git/GHCR pour installer ensuite la préversion depuis le menu.

**Installation construite localement avec `APP_VERSION=test`, `local` ou `ci`** : ces noms ne permettent pas une comparaison de versions. Dans le dossier de l'application, normaliser une seule fois la version de la construction locale en `3.0.0`, sans toucher aux données ni à la clé de chiffrement. La commande `up --no-deps` conserve la base et le frontal ; les images locales déjà construites sont réutilisées.

<!-- ci: skip — adaptation unique d'une installation de test existante, pas d'un serveur neuf -->
```bash
sudo cp -p .env .env.avant-version-test
sudo sed -i 's/^APP_VERSION=.*/APP_VERSION=3.0.0/' .env
sudo docker compose -f docker-compose.yml -f docker-compose.build.yml build
sudo docker compose up -d --no-deps --pull never app web updater
```

Si des images épinglées par `API_IMAGE`/`WEB_IMAGE`/`UPDATER_IMAGE` sont présentes dans `.env`, les conserver pour une version publiée ; pour une construction locale, suivre plutôt la construction de branche de la section 7 et retirer ces trois références. `GATEWAY_VERSION` conserve le frontal existant. Si `Vérifier` échoue, contrôler les accès de la section 4 et l'état des services ; ne pas désactiver les signatures.

### 12.1 Procédure serveur de mise à jour et d’entretien du frontal

À faire quand une nouvelle version est annoncée (bandeau « Nouvelle version disponible » dans l'application, ou page **Releases** du dépôt), de préférence en dehors des heures d'utilisation. Pour le premier passage, le dépannage ou l’entretien du frontal, utiliser **un seul script**, `scripts/mettre-a-jour.sh`, qui :
1. contrôle le serveur (droits, Docker, `.env`, dossier des données, espace disque) ;
2. affiche la version en service, la version cible et ses **notes de mise à jour** (actions particulières, évolutions de la base, durée estimée), puis demande confirmation ;
3. refuse de revenir à une version plus ancienne ;
4. fait une **sauvegarde chiffrée** (obligatoire) dans `/srv/sauvegardes/suivi-audits/avant-mise-a-jour/` et contrôle son empreinte ; les 5 dernières sont gardées ;
5. passe le dépôt à la nouvelle version, télécharge les images et **vérifie leur signature** (cosign, étape 3.6) ;
6. redémarre l'application ; les évolutions de la base s'appliquent au démarrage, une par une ;
7. attend que l'application soit en bon état, relit chaque document chiffré, puis écrit un rapport (onglet **Système** de l'administration, et journal d'audit) ;
8. **en cas d'échec**, revient tout seul à la version précédente ; si la base avait déjà évolué, il restaure la sauvegarde du point 4 (après votre accord).

> ⚠️ **Première mise à jour vers la version qui chiffre les sauvegardes avec age** (voir le CHANGELOG) : avant de lancer le script, installez `age` (`sudo apt install -y age`) et créez les clés de l'étape 6.8. La sauvegarde de cette mise à jour est encore faite par la version installée (avec l'ancienne phrase secrète) ; sans les clés, la nouvelle version ne démarre pas et le retour arrière automatique rétablit l'ancienne. Une mise à jour lancée depuis l'interface web nécessite de la même façon des clés déjà créées.

**1. Récupérer la liste des versions publiées :**

<!-- ci: skip — le runner n'a pas de clé de déploiement -->
```bash
sudo git fetch --tags
```
**Résultat attendu** : les nouvelles versions, par exemple `* [new tag] v3.1.0 -> v3.1.0` (ou aucun message).

**2. Simuler la mise à jour.** Rien n'est modifié : le script affiche ce qu'il ferait.

<!-- ci: instead: "$GITHUB_WORKSPACE/scripts/ci/guide-mise-a-jour.sh" verifier -->
```bash
sudo ./scripts/mettre-a-jour.sh --verifier
```
**Résultat attendu** : `Version en service`, `Version cible`, les notes de mise à jour, les évolutions de la base prévues, puis `Simulation terminée : rien n'a été modifié.` Lisez les notes : si elles demandent une action particulière, faites-la avant le point 3.

**3. Mettre à jour.** Le script demande de taper `OUI` pour confirmer :

<!-- ci: instead: "$GITHUB_WORKSPACE/scripts/ci/guide-mise-a-jour.sh" appliquer -->
```bash
sudo ./scripts/mettre-a-jour.sh
```
**Résultat attendu** au bout de quelques minutes : `Mise à jour terminée : <ancienne> → <nouvelle>`, puis le chemin du rapport et celui de la sauvegarde faite avant la mise à jour. Pour une version précise plutôt que la dernière : `sudo ./scripts/mettre-a-jour.sh 3.2.0`.

Si la mise à jour échoue, le script affiche `ERREUR : mise à jour vers … en échec`, puis `Retour arrière terminé : la version … est en service.` Rien n'est perdu ; transmettez le rapport indiqué à l'équipe projet. S'il demande de restaurer la sauvegarde, répondez `OUI` : sans cela, l'ancienne version risque de ne pas démarrer sur une base déjà modifiée.

**3 bis. Passage de PostgreSQL 17 à 18** (versions 3.2 et suivantes, serveur encore en PostgreSQL 17). La migration est **automatique** pendant la mise à jour : après la sauvegarde chiffrée, l'application est arrêtée, la base est exportée avec PostgreSQL 17, recréée en PostgreSQL 18 dans `postgres18/`, restaurée, puis contrôlée (nombres de lignes identiques table par table). Durée : quelques minutes, proportionnelle à la taille de la base ; il faut deux fois la taille de la base d'espace libre, plus 512 Mo. **L'ancien dossier `postgres/` n'est jamais modifié** : en cas d'échec, la version précédente redémarre dessus. N'utilisez pas `docker compose up` seul pour cette montée de version : le démarrage est refusé tant que la base n'est pas migrée (message explicite).

Après avoir vérifié l'application (connexion, données, téléchargement d'un document), libérez la place de l'ancienne base :

<!-- ci: skip — l'ancienne base n'existe que sur un serveur migré depuis PostgreSQL 17 (testé par le job CI « montée de version ») -->
```bash
sudo ./scripts/nettoyer-ancienne-base-postgresql.sh
```
**Résultat attendu** : le volume à libérer, puis la demande de taper `SUPPRIMER`. Le script refuse d'agir si la base 18 est absente ou si l'application n'est pas en bon état. Cette suppression est définitive : après elle, un retour à la version précédente passe par la restauration d'une sauvegarde.

**4. Vérifier l'état :**

<!-- ci: run -->
<!-- ci: then: "$GITHUB_WORKSPACE/scripts/ci/guide-attendre.sh" -->
```bash
sudo docker compose ps -a
```
**Résultat attendu** : les mêmes états qu'à l'étape 7.3. Dans l'application, **Administration**, onglet **Système** : la nouvelle version, et la mise à jour dans l'historique avec le résultat « Réussie ».

> **Première mise à jour avec le script.** Si la version en service ne contient pas encore `scripts/mettre-a-jour.sh` (message `No such file or directory`), lancez-le directement depuis la nouvelle version, en remplaçant `<version>` par son numéro (sans le « v ») :
> ```text
> sudo git fetch --tags && sudo git show v<version>:scripts/mettre-a-jour.sh | sudo bash -s -- <version>
> ```
> Si la version en service gardait ses données dans des volumes Docker, le script les copie au passage dans le dossier des données (étape 12.5).

### 12.2 Revenir à une version précédente

Le script revient en arrière tout seul en cas d'échec. Pour revenir plus tard à une version précédente (problème découvert après coup), il faut **restaurer la sauvegarde faite avant la mise à jour** : les évolutions de la base ne s'annulent pas. Les données saisies depuis la mise à jour seront perdues : exportez-les ou notez-les avant.
1. Repérez la sauvegarde : `sudo ls -1t /srv/sauvegardes/suivi-audits/avant-mise-a-jour/` (son nom contient les deux versions).
2. Revenez à l'ancienne version du dépôt : `sudo git checkout v<ancienne_version>`, puis remettez son numéro dans `APP_VERSION` (`sudo nano .env`).
3. Restaurez la sauvegarde (étape 11.4) avec ce fichier.

### 12.3 Mettre à jour le système

Une fois par mois, et dès qu'une faille importante est annoncée :

<!-- ci: instead: sudo apt-get update -->
```bash
sudo apt update && sudo apt full-upgrade -y
```
**Résultat attendu** : aucune ligne `E:`. Docker est mis à jour par la même occasion.

<!-- ci: run -->
```bash
[ -f /var/run/reboot-required ] && echo "Redémarrage nécessaire" || echo "Pas de redémarrage nécessaire"
```
**Résultat attendu** : l'un des deux messages. Si un redémarrage est nécessaire, prévenez les utilisateurs, puis lancez `sudo reboot`. L'application redémarre toute seule avec le serveur. Reconnectez-vous au bout de 2 minutes et vérifiez les états (étape 7.3).

### 12.4 Passer d'un serveur v2 à cette version

La v2 construisait l'application sur le serveur, avec un service `proxy`, et gardait ses données dans des volumes Docker. La base, les secrets et les certificats sont **conservés** : rien n'est à réimporter.
1. Faites une sauvegarde (étape 11.2), et installez cosign (étape 3.6).
2. Récupérez la nouvelle version : `sudo git fetch --tags`, puis `sudo git checkout v<version>`.
3. Dans `.env` (`sudo nano .env`), **ajoutez** à la fin les lignes `APP_VERSION=<version>` et `DATA_DIR=/srv/suivi-audits/donnees`.
4. Téléchargez les images : `sudo docker compose pull`.
5. Copiez les données des volumes Docker dans le dossier des données, puis démarrez : `sudo ./scripts/migrer-donnees-vers-dossier.sh` (étape 12.5). Au démarrage, `app` met la base à niveau, et `init` remet les certificats au nouvel utilisateur du frontal.
6. Retirez l'ancien service `proxy`, qui libère les ports 80 et 443 : `sudo docker compose up -d --remove-orphans`.
7. Vérifiez que vos comptes, vos documents et vos données de suivi sont présents. Les mises à jour suivantes se font par l'étape 12.1.

### 12.5 Passer des volumes Docker au dossier du serveur

Les premières installations gardaient les données dans des **volumes Docker** (dans `/var/lib/docker/volumes`), effacés par `docker compose down -v`. Elles sont désormais dans le dossier des données (étape 6.6). La mise à jour de l'étape 12.1 fait ce passage toute seule ; le script suivant le fait aussi à la demande :

<!-- ci: skip — installation neuve : aucun volume Docker à reprendre (testé par le job CI « montée de version ») -->
```bash
sudo ./scripts/migrer-donnees-vers-dossier.sh
```
**Résultat attendu** : une ligne par volume copié (`suivi-audits_pgdata → /srv/suivi-audits/donnees/postgres : … fichiers`), puis `Migration terminée`. Le script fait d'abord une sauvegarde chiffrée des volumes (dans `/srv/sauvegardes/suivi-audits`), arrête l'application, copie chaque volume en conservant propriétaires et droits, compare le nombre de fichiers, les tailles et le nombre d'enregistrements, puis redémarre l'application. Relancé, il ne refait rien.

Les **anciens volumes sont conservés**. Après avoir vérifié l'application (connexion, données, téléchargement d'un document), libérez la place :

<!-- ci: skip — installation neuve : aucun volume Docker à supprimer -->
```bash
sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes
```
**Résultat attendu** : la liste des volumes, la demande de confirmation (taper `OUI`), puis `supprimé : …` pour chacun.

---

## 13. En cas de problème

**Le premier réflexe** : afficher l'état et les messages des services.

<!-- ci: run -->
```bash
sudo docker compose ps -a
```
**Résultat attendu** : les états de l'étape 7.3.

<!-- ci: run -->
```bash
sudo docker compose logs --tail 100 init db app web gateway updater
```
**Résultat attendu** : les 100 derniers messages de chaque service. Les messages de `app` sont au format JSON ; cherchez `"level":50` (erreur).

Si vous demandez de l'aide, joignez ces deux sorties. Elles ne contiennent aucun mot de passe, mais **elles peuvent contenir le jeton d'installation** s'il n'a pas encore été utilisé : dans ce cas, générez-en un nouveau après (étape 8.1).

**Commandes d'exploitation** : `sudo docker compose exec app suivi help` les liste toutes. `sudo docker compose exec app suivi users` affiche les comptes, leurs rôles directs, leur état et leur date d'expiration.

| Symptôme | Cause probable | Solution |
|---|---|---|
| `permission denied while trying to connect to the Docker daemon socket` | `sudo` oublié | Relancer la commande en ajoutant `sudo` devant |
| `no configuration file provided: not found` | Commande lancée hors du dossier de l'application | `cd /opt/suivi-audits`, puis relancer |
| `Bind for 0.0.0.0:443 failed: port is already allocated` ou `address already in use` (80 ou 443) | Un autre service web (Apache, nginx, ou l'ancien service `proxy`) occupe le port | `sudo ss -ltnp \| grep -E ':(80\|443) '` pour l'identifier. Ancien `proxy` : `sudo docker compose up -d --remove-orphans`. Sinon, arrêter ce service, ou changer `HTTPS_PORT` et `HTTP_PORT` dans `.env` |
| `required variable SITE_ADDRESS is missing a value: Renseigner SITE_ADDRESS dans .env` | `SITE_ADDRESS` vide, ou fichier `.env` absent | Étape 6 |
| `Renseigner APP_VERSION dans .env` | Ligne `APP_VERSION=` absente (serveur v2) | Étape 12.4 |
| `init` affiche `ERREUR (dossier des données) : … n'a pas été préparé` | Dossier des données jamais préparé, ou données encore dans des volumes Docker | Nouvelle installation : étape 6.7. Serveur déjà installé : étape 12.5 |
| `ERREUR (dossier des données) : DATA_DIR … est dans le dossier de l'application` (ou dans un dossier système, ou « non persistant ») | `DATA_DIR` mal choisi dans `.env` | Choisir un dossier dédié, par exemple `/srv/suivi-audits/donnees`, puis étape 6.7 |
| `mettre-a-jour.sh` : `cosign est nécessaire` | cosign non installé | Étape 3.6 |
| `mettre-a-jour.sh` : `signature de l'image … invalide ou absente` | Image modifiée, ou flux vers `rekor.sigstore.dev` bloqué | Ne pas forcer : vérifier les flux de l'étape 0, puis prévenir l'équipe projet. La version précédente reste en service |
| `mettre-a-jour.sh` : `espace disque insuffisant` | Moins de deux fois la taille de la base, plus 2 Go, de libre | `sudo docker image prune -f`, supprimer d'anciennes sauvegardes locales (après copie externe), ou agrandir le disque |
| `mettre-a-jour.sh` : `Retour arrière terminé` | La nouvelle version n'a pas démarré correctement : retour automatique | Rien n'est perdu. Transmettre le rapport indiqué (`/srv/suivi-audits/donnees/etat/mises-a-jour/…`) et `sudo docker compose logs app` à l'équipe projet |
| `mettre-a-jour.sh` : `des fichiers suivis par git ont été modifiés` | Un fichier de l'application a été modifié à la main sur le serveur | `sudo git diff` pour voir lesquels ; `sudo git checkout -- <fichier>` pour les remettre en état |
| Alerte « Sauvegarde en retard » dans l'onglet **Système** | Aucune sauvegarde réussie depuis plus de 48 h | `sudo tail -50 /var/log/suivi-backup.log`, puis étape 11.3 |
| `unauthorized`, `denied` ou `manifest unknown` pendant `docker compose pull` | Images privées sans connexion, ou numéro de version erroné | Étape 4.5 ; vérifier `APP_VERSION` (sans « v ») sur la page Releases |
| `timeout`, `TLS handshake timeout`, `Could not resolve host` pendant une installation ou un téléchargement | Flux sortants bloqués, ou proxy d'entreprise | Vérifier le tableau des flux de l'étape 0 avec l'équipe réseau |
| `db` reste `unhealthy` ou redémarre | Premier démarrage encore en cours, ou disque plein | Attendre 2 minutes. `df -h /` : en dessous de 10 % d'espace libre, libérer de la place (`sudo docker image prune -f`, anciennes sauvegardes) |
| `init` affiche `Exited (1)` | Volume des secrets abîmé ou droits modifiés | `sudo docker compose logs init`, puis demander de l'aide avec ce message |
| Le navigateur n'affiche rien, ou « délai dépassé » | DNS, pare-feu ou ports | Sur le serveur : `getent hosts <nom_dns>` et `curl -sk https://<nom_dns>/healthz` (réponse `ok`). Si le serveur répond mais pas le poste : ports 80 et 443 à ouvrir entre le poste et le serveur |
| « Votre connexion n'est pas privée » | Certificat interne non installé sur le poste | Normal tant que le certificat racine n'est pas déployé : étape 8.3 |
| « Jeton d'installation invalide » | Faute de frappe, ou jeton remplacé par un plus récent | Recopier le **dernier** jeton émis (étape 8.1) |
| « Jeton expiré » ou « déjà utilisé » | Jeton de plus de 24 h, ou administrateur déjà créé | `sudo docker compose exec app setup-token` (étape 8.1) |
| Code de double authentification toujours refusé | Heure du téléphone ou du serveur décalée | Serveur : étape 2.3. Téléphone : régler la date et l'heure en mode automatique |
| Téléphone perdu ou changé | — | `sudo docker compose exec app suivi reset-mfa <identifiant>`. La personne reconfigure sa double authentification à la connexion suivante |
| Compte verrouillé après plusieurs erreurs | Protection contre les attaques par essais successifs | Attendre 15 minutes, ou `sudo docker compose exec app suivi unlock <identifiant>` |
| Mot de passe oublié | — | **Administration**, **Utilisateurs**, bouton **Mot de passe** sur la ligne du compte (affiche un mot de passe temporaire). Ou : `sudo docker compose exec app suivi reset-password <identifiant>` (affiche un mot de passe temporaire) |
| Plus aucun administrateur ne peut se connecter | Téléphones perdus, départ… | `sudo docker compose exec app setup-token --recovery`, puis `https://<nom_dns>/setup` pour créer un administrateur de secours |
| Lien ou signet vers `/legacy` qui mène à une page d'erreur | L'écran de l'ancien outil est retiré | Normal : utiliser le menu **Pilotage** et **Exports Excel** |
| « Droits insuffisants : vous ne pouvez pas … » | Le rôle de la personne ne comprend pas cette action | **Administration**, **Utilisateurs**, bouton **Droits effectifs** du compte, puis ajouter le rôle ou le groupe adapté |
| « Trop de requêtes. Réessayez dans une minute. » pour plusieurs personnes à la fois | Limite de débit par adresse IP atteinte : de nombreux postes sortent par une même adresse (traduction d'adresses, proxy) | Relever `RATE_LIMIT_PER_MINUTE` dans `.env` (par exemple 5000), puis `sudo docker compose up -d` |
| Un compte n'arrive plus à se connecter à une date précise | Date d'expiration atteinte : compte désactivé automatiquement | **Administration**, **Utilisateurs**, **Modifier** : nouvelle date d'expiration et état « Actif » |
| L'écran mural affiche « Écran non autorisé » | Écran révoqué ou expiré, ou cookies effacés par le navigateur de l'écran | Créer un nouveau lien d'activation (étape 9.8) ; vérifier que le navigateur de l'écran conserve les cookies |
| « Code d'activation invalide, expiré ou déjà utilisé » | Lien de plus de 24 h, déjà ouvert une fois, ou copié incomplètement | Révoquer l'écran en attente, puis créer un nouveau lien (étape 9.8) |
| « Impossible : il doit rester au moins un administrateur actif » | Garde-fou : la modification retirerait le dernier administrateur permanent | Donner d'abord le rôle Administrateur (sans date d'expiration) à une autre personne |

---

## 14. Arrêter ou désinstaller

Toutes ces commandes se lancent depuis `/opt/suivi-audits`.

| Action | Commande | Ce qui est conservé | Ce qui est effacé |
|---|---|---|---|
| Arrêter temporairement | `sudo docker compose stop` | tout | rien |
| Redémarrer après un arrêt | `sudo docker compose start` | tout | rien |
| Arrêter et retirer les conteneurs | `sudo docker compose down` (ou `down -v`) | toutes les données (dossier des données), configuration | les conteneurs, recréés au prochain `up -d` |
| ⚠️ **Tout effacer** | `sudo docker compose down && sudo rm -rf /srv/suivi-audits/donnees` | `.env`, sauvegardes de `/srv/sauvegardes` | **base de données, documents, comptes, secrets, certificats : définitivement** |
| Supprimer aussi l'application | `cd / && sudo rm -rf /opt/suivi-audits /etc/cron.d/suivi-audits` | sauvegardes de `/srv/sauvegardes` | le dépôt, `.env` et les tâches planifiées |

> ⚠️ Avant d'effacer le dossier des données, faites une sauvegarde (étape 11.2) **et** vérifiez que la clé de secours (privée) est dans votre coffre-fort. Sans les deux, rien n'est récupérable. Supprimer les conteneurs ou les images, ou lancer `docker compose down -v`, ne touche plus aux données.

---

## 15. Glossaire

| Terme | En clair |
|---|---|
| **Serveur, VM** | L'ordinateur, souvent virtuel, qui héberge l'application 24 h sur 24 |
| **SSH** | Connexion sécurisée en ligne de commande vers le serveur |
| **Terminal, PowerShell** | La fenêtre où l'on tape les commandes |
| **sudo** | Préfixe qui exécute une commande avec les droits d'administrateur du serveur |
| **apt** | L'outil qui installe et met à jour les logiciels sur Debian et Ubuntu |
| **nano** | Un éditeur de texte simple, utilisable dans le terminal |
| **Pare-feu (ufw)** | Filtre qui n'autorise que certaines connexions vers le serveur |
| **NTP** | Protocole de mise à l'heure automatique |
| **Docker** | Logiciel qui fait tourner des applications dans des boîtes isolées |
| **Image** | Le « modèle » d'une boîte : l'application prête à l'emploi, téléchargée depuis un registre |
| **Registre (ghcr.io)** | Le site d'où l'on télécharge les images |
| **Conteneur** | Une boîte en fonctionnement, créée à partir d'une image |
| **Dossier des données (`DATA_DIR`)** | Le dossier du serveur où sont rangées toutes les données de l'application (étape 6.6). Il survit à tout : mises à jour, suppression des conteneurs et des images, `down -v` |
| **Montage (bind)** | Un dossier du serveur rendu visible à l'intérieur d'un conteneur : les données restent sur le serveur |
| **Volume** | Ancien emplacement des données, géré par Docker et effacé par `down -v` ; repris dans le dossier des données (étape 12.5) |
| **cosign, signature** | Vérification que les images viennent bien de la chaîne de publication du dépôt, sans modification |
| **docker compose** | La commande qui démarre et arrête ensemble toutes les boîtes de l'application |
| **`.env`** | Le fichier de réglages de l'application |
| **Dépôt GitHub** | L'endroit où est rangé le code de l'application, avec son historique |
| **Clé de déploiement** | Une clé qui permet au serveur de lire le dépôt, et rien d'autre |
| **Version, étiquette (tag)** | Un numéro de version publié, par exemple `v3.0.0` |
| **Branche** | Une version de travail du code, par exemple une nouveauté en test |
| **DNS** | L'annuaire qui traduit un nom (`suivi-audits.mondomaine.local`) en adresse IP |
| **Certificat, HTTPS** | Ce qui chiffre la connexion entre le navigateur et le serveur (le cadenas) |
| **Certificat racine** | Le certificat de l'autorité qui signe les certificats ; les postes doivent lui faire confiance |
| **PKI** | L'infrastructure de certificats de votre organisation |
| **Double authentification (TOTP)** | Code à 6 chiffres du téléphone, demandé en plus du mot de passe |
| **Jeton d'installation** | Code à usage unique qui autorise la création du premier administrateur |
| **Ancien outil, legacy** | Le fichier HTML utilisé avant cette application ; il n'est plus servi (écran `/legacy` retiré), son archive testable est sur la branche `archive/outil-legacy-autonome` |

## Fiabilisation de la branche de travail (9 octobre 2026)

Ce lot ajoute le guide d'utilisation dans le menu Sauge et fiabilise la déconnexion entre onglets. Il n'ajoute aucune migration ni dépendance et ne change pas les scripts de sauvegarde/restauration. Tous les modules encore dans l'ancien style restent servis sous `/legacy` ; leur reprise complète est suivie dans `REPRISE-SOCLE-LEGACY.md`.

Le script de recette `scripts/ci/guide-api.mjs` ne journalise plus le mot de passe temporaire d'un compte qu'il n'utilise pas ; ses erreurs HTTP affichent le statut sans le corps potentiellement sensible. Cette modification conserve les échecs du guide et ne diminue pas les contrôles de sécurité. Le lot A1a ajoute les demandes manuelles de sauvegarde (étape 11.5). Le lot A complète ces capacités avec le poller commun, la planification/rétention, le catalogue, la restauration guidée et les certificats TLS (étapes 11.6–11.7).


### Évaluations IA versionnées (retirées)

Retirées par la migration `037_retrait_environnement.sql` (décision du 25/10/2026, [ADR 0046](adr/0046-retrait-du-catalogue-environnement.md)) : les échelles et matrices se publient dans Configuration GRC. La sauvegarde automatique de la mise à jour précède la suppression.

