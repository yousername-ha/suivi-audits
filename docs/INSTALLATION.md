# Installer « Suivi des audits SMSI » — guide pas à pas

Ce guide part d'un serveur vide et ne suppose aucune connaissance de Linux ni de Docker. Il s'adresse au RSSI ou à un technicien. Suivez les étapes **dans l'ordre**, sans en sauter. Comptez environ 1 h 30 la première fois.

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
| ☐ | **Dimensionnement** | 2 processeurs, 4 Go de mémoire, 30 Go de disque, plus la place des sauvegardes (prévoir 10 Go). Avec l'antivirus facultatif (ClamAV) : 8 Go de mémoire. |
| ☐ | **Un compte sur ce serveur** avec droits d'administration (`sudo`) | L'équipe infrastructure vous fournit l'adresse IP, l'identifiant et le mot de passe. |
| ☐ | **Un nom DNS** pointant vers le serveur | Par exemple `suivi-audits.mondomaine.local`. Demandez à l'équipe réseau « un enregistrement DNS de type A vers l'IP du serveur ». |
| ☐ | **Ports entrants ouverts** des postes utilisateurs vers le serveur | TCP **443** (HTTPS) et TCP **80** (redirection vers HTTPS). Pour l'administration : TCP **22** (SSH), depuis votre poste uniquement. |
| ☐ | **Flux sortants ouverts** du serveur vers Internet | Voir le tableau ci-dessous. |
| ☐ | **Un compte GitHub** ayant accès au dépôt `yousername-ha/suivi-audits` | Pour autoriser le serveur à le lire (étape 4). |
| ☐ | **Un téléphone avec une application d'authentification** | Microsoft Authenticator, FreeOTP, Aegis ou Google Authenticator. |
| ☐ | **Un coffre-fort de mots de passe** | KeePass ou équivalent, pour conserver la phrase secrète des sauvegardes (étape 11). |

**Flux sortants à demander** (du serveur vers Internet, à faire ouvrir au pare-feu ou au proxy) :

| Destination | Port | Usage |
|---|---|---|
| `deb.debian.org`, `security.debian.org` (Debian) ou `archive.ubuntu.com`, `security.ubuntu.com` (Ubuntu) | TCP 80 et 443 | Mises à jour du système |
| `download.docker.com` | TCP 443 | Installation de Docker |
| `github.com` | TCP 22 | Téléchargement de l'application (clé de déploiement SSH) |
| `ghcr.io`, `pkg-containers.githubusercontent.com` | TCP 443 | Images de l'application |
| `registry-1.docker.io`, `auth.docker.io`, `production.cloudflare.docker.com` | TCP 443 | Image de la base de données (PostgreSQL) |
| Serveur de temps (NTP) de votre organisation, ou `ntp.ubuntu.com` / `deb.pool.ntp.org` | UDP 123 | Mise à l'heure (indispensable à la double authentification) |
| `database.clamav.net` | TCP 443 | Facultatif : signatures de l'antivirus |

Une fois démarrée, l'application elle-même n'a **aucun accès à Internet** : seul le système et Docker en ont besoin, pour l'installation et les mises à jour.

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
sudo apt install -y git curl ca-certificates ufw nano openssl
```
**Résultat attendu** : la dernière ligne ne contient pas `E:`.

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

<!-- ci: instead: sudo sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=localhost/; s/^APP_VERSION=.*/APP_VERSION=ci/' .env -->
```bash
sudo nano .env
```
**Résultat attendu** : le fichier s'affiche, avec en bas de l'écran une aide qui commence par `^G Help`.

nano se pilote **uniquement au clavier** (la souris ne déplace pas le curseur) :
1. Avec les **flèches**, placez le curseur à la fin de la ligne `SITE_ADDRESS=suivi-audits.example.local`.
2. Effacez `suivi-audits.example.local` avec la touche **Retour arrière** (⌫), puis tapez votre nom DNS. La ligne devient par exemple `SITE_ADDRESS=suivi-audits.mondomaine.local`.
3. Descendez à la ligne `APP_VERSION=` et remplacez le numéro par la version choisie à l'étape 5.3, sans le « v ».
4. Laissez `CADDY_TLS=internal` pour l'instant (voir 6.4), ainsi que toutes les autres lignes.
5. Enregistrez : **Ctrl + O**, puis **Entrée**. En bas s'affiche `[ Wrote 47 lines ]` (le nombre peut varier).
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

**6.4 Choisir le certificat HTTPS.** Deux possibilités :

| Choix | Quand | Ce qu'il faut faire |
|---|---|---|
| **Certificat interne** (`CADDY_TLS=internal`, réglage par défaut) | Pour démarrer, ou sans PKI | Rien. Le serveur crée sa propre autorité. Les navigateurs afficheront un avertissement tant que son certificat racine n'est pas installé sur les postes (étape 8.3). |
| **Certificat de votre PKI** (recommandé en production) | L'équipe PKI vous a fourni un certificat pour le nom DNS | Voir ci-dessous. |

Pour utiliser le certificat de votre PKI :
1. Faites déposer dans `/opt/suivi-audits/certs/` deux fichiers : `fullchain.pem` (le certificat suivi de la chaîne) et `privkey.pem` (la clé privée, **non protégée par mot de passe**).
2. Dans `.env` (avec `sudo nano .env`), remplacez `CADDY_TLS=internal` par `CADDY_TLS=/certs/fullchain.pem /certs/privkey.pem`.
3. Rendez les fichiers lisibles par le conteneur web (utilisateur 1001), et par lui seul : `sudo chown 1001:1001 certs/*.pem && sudo chmod 400 certs/privkey.pem`.

**6.5 Vérifier le DNS.** Le nom doit renvoyer l'adresse IP du serveur :

<!-- ci: run -->
```bash
getent hosts <nom_dns>
```
**Résultat attendu** : une ligne avec l'adresse IP du serveur, puis le nom. Si rien ne s'affiche, l'enregistrement DNS n'existe pas encore : relancez l'équipe réseau avant de continuer.

---

## 7. Démarrer l'application

**7.1 Télécharger les images** de l'application et de la base de données. Comptez quelques minutes la première fois.

<!-- ci: skip — les images de la version testée ne sont pas encore publiées : la CI les construit (encadré ci-dessous) -->
```bash
sudo docker compose pull
```
**Résultat attendu** : une ligne par composant (`init`, `db`, `app`, `web`) se terminant par `Pulled`. Si vous lisez `unauthorized` ou `denied`, les images sont privées : faites l'étape 4.5.

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
| `init` | génère les mots de passe internes au premier démarrage, puis s'arrête | `Exited (0)` : terminé normalement, c'est voulu |
| `db` | base de données PostgreSQL | `Up … (healthy)` |
| `app` | application (API) | `Up … (healthy)` |
| `web` | accès web sécurisé (HTTPS) et interface | `Up …` |

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
- Pour une installation durable, installez le certificat racine du serveur sur les postes. Récupérez-le d'abord sur le serveur :

<!-- ci: run -->
```bash
sudo docker compose cp web:/data/caddy/pki/authorities/local/root.crt /opt/suivi-audits/racine-suivi-audits.crt && sudo chmod 644 /opt/suivi-audits/racine-suivi-audits.crt
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
| **Contributeur** | Pilotes de processus, référents | Consulter et modifier les modules métier, les documents et les liens (pas de suppression) |
| **Lecteur** | Alternant, direction | Consulter et télécharger, sans rien modifier |
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

<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" compte https://<nom_dns> -->

---

## 10. Reprendre les données de l'ancien outil

Sautez cette étape si vous démarrez sans historique.

> **Vous mettez à jour un serveur v2 existant ?** N'importez rien : les données sont reprises automatiquement à la mise à jour (étape 12.3).

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

**10.3 Appliquer l'import :** cliquez sur **Appliquer l'import**.

**Résultat attendu** : l'import apparaît dans **Historique des imports** avec l'état « appliqué ». Une sauvegarde de l'état précédent est faite juste avant : le bouton **Annuler** de l'historique revient en arrière tant que les données n'ont pas été modifiées depuis. Les autres utilisateurs connectés voient les données arriver sans recharger la page.

<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" import https://<nom_dns> /opt/suivi-audits/tests/fixtures/legacy-fixture.json -->

> Les autres modes : **Fusionner** ajoute et met à jour sans jamais rien supprimer ; **Remplacer un module** remplace un seul module et **supprime** les éléments absents du fichier (il faut ressaisir le nom du module pour confirmer).

---

## 11. Mettre en place les sauvegardes

Une sauvegarde contient la base (suivi, comptes, documents chiffrés, journal) **et** les secrets (clé de chiffrement des documents). Elle est elle-même chiffrée par une phrase secrète.

> ⚠️ Sans la phrase secrète, les sauvegardes sont **illisibles**, définitivement. Sans les sauvegardes, une panne du serveur fait **tout perdre**.

**11.1 Créer la phrase secrète :**

<!-- ci: run -->
```bash
sudo sh -c 'umask 077 && openssl rand -base64 48 > /root/.suivi-backup-pass'
```
**Résultat attendu** : aucun message.

<!-- ci: skip — n'affiche pas la phrase secrète dans les journaux de la CI -->
```bash
sudo cat /root/.suivi-backup-pass
```
**Résultat attendu** : une ligne de 64 caractères. **Copiez-la dans votre coffre-fort de mots de passe**, avec le nom du serveur.

**11.2 Lancer une première sauvegarde :**

<!-- ci: run -->
```bash
sudo mkdir -p /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : aucun message.

<!-- ci: run -->
```bash
sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : la dernière ligne est `Sauvegarde : /srv/sauvegardes/suivi-audits/suivi-audits-<date>-<heure>.tar.enc`.

<!-- ci: run -->
```bash
sudo ls -lh /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : deux fichiers, `suivi-audits-….tar.enc` (la sauvegarde) et `suivi-audits-….tar.enc.sha256` (son empreinte, qui permet de détecter une altération).

**11.3 Planifier une sauvegarde chaque nuit à 2 h 15** (conservation : 90 jours) :

<!-- ci: run -->
```bash
echo '15 2 * * * root cd /opt/suivi-audits && BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits >> /var/log/suivi-backup.log 2>&1' | sudo tee /etc/cron.d/suivi-audits
```
**Résultat attendu** : la ligne s'affiche à nouveau. Le lendemain, `sudo tail /var/log/suivi-backup.log` doit montrer `Sauvegarde : …`.

Demandez à l'équipe infrastructure d'**inclure le dossier `/srv/sauvegardes/suivi-audits` dans la sauvegarde externalisée** du serveur : une sauvegarde restée sur le serveur disparaît avec lui.

**11.4 Tester la restauration — obligatoire.** Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde. Faites ce test **maintenant**, avant d'ouvrir l'application aux utilisateurs, puis une fois par an sur un serveur de test.

> ⚠️ La restauration **remplace** toutes les données actuelles par celles de la sauvegarde. Juste après l'installation, rien n'est perdu. Plus tard, faites ce test sur un **serveur de test**, jamais sur le serveur en service.

Repérez le nom exact du fichier `.tar.enc` affiché à l'étape 11.2, puis :

<!-- ci: instead: echo RESTAURER | sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/restore.sh "$(sudo sh -c 'ls -1 /srv/sauvegardes/suivi-audits/*.tar.enc' | tail -1)" -->
```bash
sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/restore.sh /srv/sauvegardes/suivi-audits/<fichier>.tar.enc
```
Le script vérifie l'empreinte (`… .tar.enc: OK`), affiche la date de la sauvegarde, puis demande de taper `RESTAURER` (en majuscules) suivi d'**Entrée**.
**Résultat attendu** : la dernière ligne est `Restauration terminée.` Attendez une minute et vérifiez les états (étape 7.3), puis connectez-vous : vos comptes et vos données sont présents. Notez la date de ce test dans **Paramètres**, section **Sauvegardes** : l'application signale quand le prochain test est dû.

<!-- ci: exec: "$GITHUB_WORKSPACE/scripts/ci/guide-attendre.sh" -->
<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" verifier https://<nom_dns> -->

---

## 12. Mettre à jour

### 12.1 Mettre à jour l'application

À faire quand une nouvelle version est annoncée (page **Releases** du dépôt), de préférence en dehors des heures d'utilisation. Lisez d'abord ses notes de version (`CHANGELOG.md`).

1. Faites une sauvegarde, comme à l'étape 11.2 :

<!-- ci: run -->
```bash
sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : `Sauvegarde : …`.

2. Récupérez la nouvelle version du dépôt :

<!-- ci: skip — le runner n'a pas de clé de déploiement -->
```bash
sudo git fetch --tags
```
**Résultat attendu** : la liste des nouvelles versions, par exemple `* [new tag] v3.1.0 -> v3.1.0` (ou aucun message).

<!-- ci: skip — la CI installe le commit testé -->
```bash
sudo git checkout v<version>
```
**Résultat attendu** : `HEAD is now at …`.

3. Indiquez la nouvelle version dans `.env` : `sudo nano .env`, ligne `APP_VERSION=` (sans le « v »), puis **Ctrl + O**, **Entrée**, **Ctrl + X**.

4. Téléchargez les nouvelles images, puis redémarrez :

<!-- ci: skip — images construites par la CI à l'étape 7 -->
```bash
sudo docker compose pull
```
**Résultat attendu** : `Pulled` pour chaque composant.

<!-- ci: run -->
```bash
sudo docker compose up -d --remove-orphans
```
**Résultat attendu** : `Started` ou `Running` pour chaque composant. Les évolutions de la base s'appliquent toutes seules au démarrage de `app`.

<!-- ci: run -->
<!-- ci: then: "$GITHUB_WORKSPACE/scripts/ci/guide-attendre.sh" -->
```bash
sudo docker compose ps -a
```
**Résultat attendu** : les mêmes états qu'à l'étape 7.3.

5. Faites le ménage des anciennes images (place disque) :

<!-- ci: run -->
```bash
sudo docker image prune -f
```
**Résultat attendu** : `Total reclaimed space: …`.

> Si la nouvelle version ne fonctionne pas : remettez l'ancien numéro dans `APP_VERSION`, revenez à l'ancienne version du dépôt (`sudo git checkout v<ancienne_version>`), puis `sudo docker compose up -d`. Si la base a déjà été migrée, restaurez la sauvegarde faite au point 1 (étape 11.4).

### 12.2 Mettre à jour le système

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

### 12.3 Passer d'un serveur v2 à cette version

La v2 construisait l'application sur le serveur, avec un service `proxy`. La base, les secrets et les certificats sont **conservés** : rien n'est à réimporter.
1. Faites une sauvegarde (étape 11.2), puis suivez l'étape 12.1 aux points 2 à 4. Au point 3, la ligne `APP_VERSION=` n'existe pas encore dans `.env` : **ajoutez-la** à la fin du fichier, par exemple `APP_VERSION=3.0.0`.
2. L'option `--remove-orphans` du point 4 retire l'ancien service `proxy`, qui libère les ports 80 et 443.
3. Au démarrage, le service `init` remet les certificats au nouvel utilisateur du frontal, et `app` met la base à niveau. Vérifiez ensuite que vos comptes, vos documents et vos données de suivi sont présents.

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
sudo docker compose logs --tail 100 init db app web
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
| `Renseigner APP_VERSION dans .env` | Ligne `APP_VERSION=` absente (serveur v2) | Étape 12.3 |
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
| « Module géré dans la nouvelle interface » dans l'ancien outil | Ce module a été repris par la nouvelle interface | Normal : modifier ces données dans la nouvelle interface |
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
| Arrêter et retirer les conteneurs | `sudo docker compose down` | données, secrets, certificats (volumes), configuration | les conteneurs, recréés au prochain `up -d` |
| ⚠️ **Tout effacer** | `sudo docker compose down -v` | `.env`, sauvegardes de `/srv/sauvegardes` | **base de données, documents, comptes, secrets, certificats : définitivement** |
| Supprimer aussi l'application | `cd / && sudo rm -rf /opt/suivi-audits /etc/cron.d/suivi-audits` | sauvegardes de `/srv/sauvegardes` | le dépôt, `.env` et la planification des sauvegardes |

> ⚠️ Avant `down -v`, faites une sauvegarde (étape 11.2) **et** vérifiez que la phrase secrète est dans votre coffre-fort. Sans les deux, rien n'est récupérable.

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
| **Volume** | L'espace disque où Docker garde les données. Il survit aux mises à jour, pas à `down -v` |
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
| **Ancien outil, legacy** | Le fichier HTML utilisé avant cette application, encore accessible sous `/legacy` pendant la transition |
