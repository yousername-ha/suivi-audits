# Installer « Suivi des audits SMSI » — guide pas à pas

Ce guide part de zéro : un serveur vide et aucune connaissance de Docker. Suivez les étapes **dans l'ordre**, sans en sauter. Comptez environ 1 h 30 la première fois.

> **Convention.** Les lignes dans un cadre gris sont des commandes à **copier-coller** dans le terminal du serveur, puis à valider avec la touche **Entrée**. Le texte entre `< >` est à remplacer par votre valeur, **sans** les chevrons.
> Exemple : `ssh <utilisateur>@<adresse>` devient `ssh admin@10.0.12.40`.

---

## Sommaire
0. [Ce qu'il vous faut avant de commencer](#0-ce-quil-vous-faut-avant-de-commencer)
1. [Se connecter au serveur](#1-se-connecter-au-serveur)
2. [Préparer le serveur](#2-préparer-le-serveur)
3. [Installer Docker](#3-installer-docker)
4. [Autoriser le serveur à lire le dépôt GitHub](#4-autoriser-le-serveur-à-lire-le-dépôt-github)
5. [Télécharger l'application](#5-télécharger-lapplication)
6. [Configurer l'application](#6-configurer-lapplication)
7. [Démarrer l'application](#7-démarrer-lapplication)
8. [Créer le compte administrateur](#8-créer-le-compte-administrateur)
9. [Créer les comptes des utilisateurs](#9-créer-les-comptes-des-utilisateurs)
10. [Mettre en place les sauvegardes](#10-mettre-en-place-les-sauvegardes)
11. [Mettre à jour l'application](#11-mettre-à-jour-lapplication)
12. [En cas de problème](#12-en-cas-de-problème)
13. [Arrêter ou désinstaller](#13-arrêter-ou-désinstaller)
14. [Petit glossaire](#14-petit-glossaire)

---

## 0. Ce qu'il vous faut avant de commencer

Cochez chaque ligne avant de passer à l'étape 1.

| ☐ | Élément | Détail |
|---|---|---|
| ☐ | **Un serveur Linux** (machine virtuelle) | Debian 12 ou Ubuntu 24.04, 2 processeurs, 4 Go de mémoire, 30 Go de disque. Demandez-le à l'équipe infrastructure en précisant « serveur Linux pour une application Docker ». |
| ☐ | **Un compte sur ce serveur** avec droits d'administration (`sudo`) | L'équipe infrastructure vous fournit l'adresse IP, l'identifiant et le mot de passe ou la clé. |
| ☐ | **Un nom DNS** pointant vers le serveur | Par exemple `suivi-audits.nes.local`. À demander à l'équipe réseau : « enregistrement DNS de type A vers l'IP du serveur ». |
| ☐ | **Les ports 80 et 443 ouverts** depuis les postes utilisateurs vers le serveur | À demander à l'équipe réseau ou pare-feu. |
| ☐ | **L'accès Internet sortant** du serveur vers `github.com`, `ghcr.io`, `registry-1.docker.io` et `production.cloudflare.docker.com` (HTTPS) | Indispensable pour télécharger l'application et ses composants. |
| ☐ | **Votre compte GitHub** avec accès au dépôt `yousername-ha/suivi-audits` | |
| ☐ | **Un téléphone** avec une application d'authentification | Microsoft Authenticator, FreeOTP, Aegis ou Google Authenticator. |

---

## 1. Se connecter au serveur

Depuis votre poste Windows :
1. Ouvrez le menu Démarrer, tapez **PowerShell** et appuyez sur Entrée.
2. Tapez la commande suivante :
   ```powershell
   ssh <utilisateur>@<adresse_ip_du_serveur>
   ```
3. À la première connexion, la question `Are you sure you want to continue connecting (yes/no)?` s'affiche. Tapez `yes`.
4. Saisissez le mot de passe. **Rien ne s'affiche pendant la frappe** : c'est normal, tapez-le puis appuyez sur Entrée.

Vous êtes connecté quand l'invite ressemble à `utilisateur@serveur:~$`.

> Toutes les commandes suivantes se tapent **dans cette fenêtre**, donc sur le serveur.

---

## 2. Préparer le serveur

**2.1 Mettre à jour le système.** La commande peut prendre quelques minutes :
```bash
sudo apt update && sudo apt full-upgrade -y
```
Si `sudo` demande votre mot de passe, saisissez-le (il ne s'affiche pas non plus).

**2.2 Installer les outils de base :**
```bash
sudo apt install -y git curl ca-certificates ufw nano
```

**2.3 Vérifier l'heure du serveur.** C'est **important** : les codes de double authentification dépendent de l'heure.
```bash
timedatectl
```
Repérez la ligne `System clock synchronized: yes`. Si elle indique `no` :
```bash
sudo timedatectl set-ntp true
```

**2.4 Activer le pare-feu du serveur**, en n'autorisant que l'administration (SSH) et le web :
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```
Le résultat doit lister `22/tcp`, `80/tcp` et `443/tcp` avec `ALLOW`.

> ⚠️ Autorisez **toujours le port 22 avant** d'activer le pare-feu : sinon vous perdez la connexion au serveur.

---

## 3. Installer Docker

Docker est le logiciel qui fait tourner l'application dans des « conteneurs » isolés (voir le [glossaire](#14-petit-glossaire)).

**3.1 Installer** avec le script officiel de Docker :
```bash
curl -fsSL https://get.docker.com | sudo sh
```

**3.2 Vérifier l'installation :**
```bash
sudo docker version
sudo docker compose version
```
Les deux commandes doivent afficher un numéro de version, sans message `command not found`.

**3.3 Vérifier que Docker démarre automatiquement** avec le serveur :
```bash
sudo systemctl enable --now docker
```

---

## 4. Autoriser le serveur à lire le dépôt GitHub

Le dépôt est **privé**. On donne au serveur une « clé de déploiement » qui lui permet de **lire** le dépôt, et rien d'autre.

**4.1 Créer la clé sur le serveur :**
```bash
sudo ssh-keygen -t ed25519 -N "" -C "serveur-suivi-audits" -f /root/.ssh/suivi_deploy
sudo cat /root/.ssh/suivi_deploy.pub
```
La seconde commande affiche une ligne qui commence par `ssh-ed25519`. **Sélectionnez-la entièrement et copiez-la.**

**4.2 L'ajouter sur GitHub :**
1. Ouvrez `https://github.com/yousername-ha/suivi-audits` dans votre navigateur.
2. Cliquez sur **Settings**, puis sur **Deploy keys** dans le menu de gauche, puis sur **Add deploy key**.
3. Dans **Title**, saisissez `Serveur suivi-audits`. Dans **Key**, collez la ligne copiée.
4. **Ne cochez pas** « Allow write access ».
5. Cliquez sur **Add key**.

**4.3 Indiquer au serveur quelle clé utiliser :**
```bash
sudo tee -a /root/.ssh/config > /dev/null <<'EOF'
Host github-suivi
    HostName github.com
    User git
    IdentityFile /root/.ssh/suivi_deploy
    IdentitiesOnly yes
EOF
sudo chmod 600 /root/.ssh/config
```

**4.4 Tester :**
```bash
sudo ssh -T github-suivi
```
Répondez `yes` à la question sur l'authenticité de l'hôte. Le message attendu ressemble à : `Hi yousername-ha/suivi-audits! You've successfully authenticated...` Ce message est normal même s'il se termine par « does not provide shell access ».

---

## 5. Télécharger l'application

```bash
sudo git clone git@github-suivi:yousername-ha/suivi-audits.git /opt/suivi-audits
cd /opt/suivi-audits
ls
```
La dernière commande doit lister notamment `docker-compose.yml`, `README.md`, `app` et `scripts`.

> Si on vous a demandé de tester une version particulière (une « branche »), tapez ensuite `sudo git checkout <nom-de-la-branche>`, par exemple `sudo git checkout deploiement-v2`.

> **À partir d'ici, toutes les commandes se lancent depuis le dossier `/opt/suivi-audits`.** Si vous vous reconnectez plus tard, retapez d'abord `cd /opt/suivi-audits`.

---

## 6. Configurer l'application

**6.1 Créer le fichier de configuration** à partir du modèle :
```bash
sudo cp .env.example .env
sudo nano .env
```
L'éditeur **nano** s'ouvre. Il se pilote au clavier : flèches pour se déplacer, frappe normale pour écrire.

**6.2 Modifier au minimum ces deux lignes :**

| Ligne | Valeur à mettre |
|---|---|
| `SITE_ADDRESS=` | le nom DNS du serveur, par exemple `SITE_ADDRESS=suivi-audits.nes.local` |
| `CADDY_TLS=` | `internal` pour démarrer : certificat généré automatiquement, voir l'étape 8.2. Si l'équipe PKI vous a fourni un certificat, voir l'encadré ci-dessous. |

Laissez les autres lignes telles quelles.

**6.3 Enregistrer et quitter nano :** appuyez sur **Ctrl + O**, puis **Entrée** pour enregistrer, puis **Ctrl + X** pour quitter.

**6.4 Protéger le fichier :**
```bash
sudo chmod 600 .env
```

> **Utiliser le certificat de votre PKI** (recommandé en production)
> 1. Faites déposer les deux fichiers dans `/opt/suivi-audits/certs/` sous les noms `fullchain.pem` (certificat et chaîne) et `privkey.pem` (clé privée).
> 2. Dans `.env`, mettez : `CADDY_TLS=/certs/fullchain.pem /certs/privkey.pem`
> 3. Protégez la clé : `sudo chmod 600 certs/privkey.pem`

**6.5 Vérifier le DNS.** Le nom doit renvoyer l'IP du serveur :
```bash
getent hosts <nom_dns>
```
Si rien ne s'affiche, l'enregistrement DNS n'existe pas encore : relancez l'équipe réseau avant de continuer.

---

## 7. Démarrer l'application

**7.1 Construire et démarrer.** La première fois, comptez 5 à 15 minutes : Docker télécharge et prépare tous les composants.
```bash
sudo docker compose build
sudo docker compose up -d
```

**7.2 Vérifier l'état** :
```bash
sudo docker compose ps -a
```
Attendez 1 à 2 minutes et relancez la commande jusqu'à obtenir :

| Service | Rôle | État attendu |
|---|---|---|
| `init` | génère les mots de passe internes au premier démarrage | `Exited (0)` : terminé normalement, c'est voulu |
| `db` | base de données | `Up … (healthy)` |
| `app` | application | `Up … (healthy)` |
| `proxy` | accès web sécurisé (HTTPS) | `Up …` |

> Si un service affiche `unhealthy`, `Restarting` ou `Exited (1)`, allez à la section [En cas de problème](#12-en-cas-de-problème).

---

## 8. Créer le compte administrateur

**8.1 Récupérer le jeton d'installation.** C'est un code à usage unique, valable 24 h, qui prouve que c'est bien vous qui installez :
```bash
sudo docker compose logs app | grep -A3 JETON
```
Le jeton s'affiche sous la ligne « JETON D'INSTALLATION ». Copiez-le.
- Plus de 24 h se sont écoulées ?
- Le jeton a été perdu ?

Dans les deux cas, générez-en un nouveau :
```bash
sudo docker compose exec app node src/cli.js setup-token
```

**8.2 Ouvrir l'application** dans le navigateur de votre poste, à l'adresse `https://<nom_dns>/setup`.

> **Avertissement « connexion non sécurisée » ?** C'est normal avec `CADDY_TLS=internal` : le certificat est produit par le serveur lui-même, et votre poste ne le connaît pas encore.
> - Pour le test : cliquez sur **Paramètres avancés**, puis sur **Continuer vers le site**.
> - Pour une installation durable : récupérez le certificat racine avec la commande ci-dessous et faites-le déployer sur les postes par GPO (équipe Active Directory), ou utilisez le certificat de votre PKI (étape 6).
>   ```bash
>   sudo docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt /opt/suivi-audits/certs/racine-suivi-audits.crt
>   ```

**8.3 Remplir la page :**
1. **Jeton d'installation** : collez le jeton.
2. **Identifiant** : par exemple `john`. **Nom affiché** : par exemple `John (RSSI)`.
3. **Mot de passe** : au moins 12 caractères, avec 3 types de caractères parmi les minuscules, majuscules, chiffres et symboles.
4. Cliquez sur **Créer le compte**.

**8.4 Activer la double authentification**, qui est obligatoire :
1. Ouvrez l'application d'authentification sur votre téléphone, puis **Ajouter un compte** et **Scanner un QR code**.
2. Scannez le QR code affiché à l'écran.
3. Saisissez le code à 6 chiffres affiché par le téléphone, puis cliquez sur **Activer**.

Vous arrivez sur l'outil. **L'installation est terminée.**

> La page `/setup` est désactivée automatiquement dès que l'administrateur existe.

---

## 9. Créer les comptes des utilisateurs

1. Dans l'outil, cliquez sur votre nom en bas à droite, puis sur **Administration**.
2. **Comptes**, puis **Nouveau compte**. Saisissez l'identifiant et le nom, puis choisissez le **rôle** :
   - **Lecture et écriture** : RSSI adjoint ;
   - **Lecture seule** : alternant, auditeur ;
   - **Administrateur** : à réserver à 1 ou 2 personnes.
3. Un **mot de passe temporaire** s'affiche **une seule fois**. Transmettez-le à la personne par un canal séparé, par exemple de vive voix ou par SMS, **jamais dans le même e-mail que l'adresse du site**.
4. À sa première connexion, la personne choisit son mot de passe et active sa double authentification.

---

## 10. Mettre en place les sauvegardes

> Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde : faites le test de l'étape 10.4.

**10.1 Créer la phrase secrète** qui chiffre les sauvegardes :
```bash
sudo sh -c 'openssl rand -base64 48 > /root/.suivi-backup-pass && chmod 600 /root/.suivi-backup-pass'
sudo cat /root/.suivi-backup-pass
```
**Recopiez cette phrase dans votre coffre-fort de mots de passe** (KeePass ou équivalent). Sans elle, les sauvegardes sont illisibles.

**10.2 Lancer une première sauvegarde à la main :**
```bash
sudo mkdir -p /srv/sauvegardes/suivi-audits
sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits
ls -lh /srv/sauvegardes/suivi-audits
```
Un fichier `suivi-audits-<date>.tar.enc` doit apparaître.

**10.3 Planifier une sauvegarde chaque nuit à 2 h 15 :**
```bash
echo '15 2 * * * root cd /opt/suivi-audits && BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits >> /var/log/suivi-backup.log 2>&1' | sudo tee /etc/cron.d/suivi-audits
```
Demandez à l'équipe infrastructure d'inclure le dossier `/srv/sauvegardes/suivi-audits` dans la sauvegarde externalisée du serveur.

**10.4 Tester une restauration**, sur un serveur de test de préférence :
```bash
sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/restore.sh /srv/sauvegardes/suivi-audits/<fichier>.tar.enc
```
Le script demande de taper `RESTAURER` pour confirmer.

---

## 11. Mettre à jour l'application

À faire quand une nouvelle version est annoncée, de préférence en dehors des heures d'utilisation :
```bash
cd /opt/suivi-audits
sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits
sudo git pull
sudo docker compose build --pull
sudo docker compose up -d
sudo docker compose ps -a
```
Vérifiez ensuite les états, comme à l'étape 7.2. Les données sont conservées. Les éventuelles évolutions de la base s'appliquent toutes seules au démarrage.

**Correctifs de sécurité du serveur**, une fois par mois :
```bash
sudo apt update && sudo apt full-upgrade -y
```

---

## 12. En cas de problème

**Le premier réflexe** : afficher les messages des services.
```bash
sudo docker compose ps -a
sudo docker compose logs --tail 100 init db app proxy
```
Si vous demandez de l'aide, joignez ces deux sorties. Elles ne contiennent aucun mot de passe, mais **elles contiennent le jeton d'installation** s'il n'a pas encore été utilisé.

| Symptôme | Cause probable | Solution |
|---|---|---|
| `permission denied … docker.sock` | `sudo` oublié | Relancer la commande en ajoutant `sudo` devant |
| `port is already allocated` ou `address already in use` (80 ou 443) | Un autre service web (Apache, nginx) tourne déjà | `sudo ss -ltnp \| grep -E ':80\|:443'` pour l'identifier, puis l'arrêter ou changer `HTTPS_PORT` et `HTTP_PORT` dans `.env` |
| `Renseigner SITE_ADDRESS dans .env` | `SITE_ADDRESS` vide | Étape 6 |
| Téléchargement impossible (`timeout`, `TLS handshake`) pendant `build` | Accès Internet sortant bloqué ou proxy d'entreprise | Vérifier l'étape 0 avec l'équipe réseau |
| `db` reste `unhealthy` | Premier démarrage de la base encore en cours, ou disque plein | Attendre 2 minutes. `df -h` : moins de 10 % de place libre pose problème |
| Le navigateur n'affiche rien, ou « délai dépassé » | DNS, pare-feu ou ports | `getent hosts <nom_dns>` sur le serveur ; ports 80 et 443 ouverts depuis le poste |
| « Votre connexion n'est pas privée » | Certificat `internal` | Normal en test, voir l'encadré de l'étape 8.2 |
| « Jeton d'installation invalide ou expiré » | Jeton de plus de 24 h ou déjà utilisé | `sudo docker compose exec app node src/cli.js setup-token` |
| Code de double authentification toujours refusé | Heure du téléphone ou du serveur décalée | Étape 2.3 ; sur le téléphone, mettre la date et l'heure en mode automatique |
| Téléphone perdu ou changé | — | `sudo docker compose exec app node src/cli.js reset-mfa <identifiant>`. La personne reconfigure à la connexion suivante. |
| Compte verrouillé après plusieurs erreurs | Protection contre les attaques | Attendre 15 min, ou `sudo docker compose exec app node src/cli.js unlock <identifiant>` |
| Mot de passe oublié | — | Administration, puis Comptes, puis **Mot de passe**. Ou `sudo docker compose exec app node src/cli.js reset-password <identifiant>`. |
| Plus aucun administrateur ne peut se connecter | — | `sudo docker compose exec app node src/cli.js setup-token --recovery`, puis `/setup` |

---

## 13. Arrêter ou désinstaller

| Action | Commande | Données |
|---|---|---|
| Arrêter temporairement | `sudo docker compose stop` | conservées |
| Redémarrer | `sudo docker compose start` | conservées |
| Arrêter et retirer les conteneurs | `sudo docker compose down` | conservées |
| **Tout supprimer** | `sudo docker compose down -v` | ⚠️ **effacées définitivement**, base comprise. Faites une sauvegarde avant. |

---

## 14. Petit glossaire

| Terme | En clair |
|---|---|
| **Serveur / VM** | L'ordinateur, souvent virtuel, qui héberge l'application 24 h sur 24 |
| **SSH** | Connexion sécurisée en ligne de commande vers le serveur |
| **Terminal** | La fenêtre où l'on tape les commandes |
| **sudo** | Préfixe qui exécute une commande avec les droits d'administrateur du serveur |
| **Docker** | Logiciel qui fait tourner des applications dans des boîtes isolées |
| **Image** | Le « modèle » d'une boîte : l'application prête à l'emploi |
| **Conteneur** | Une boîte en fonctionnement, créée à partir d'une image |
| **Volume** | L'espace disque où Docker garde les données. Il survit aux mises à jour. |
| **docker compose** | La commande qui démarre et arrête ensemble toutes les boîtes de l'application |
| **`.env`** | Le fichier de réglages de l'application |
| **DNS** | L'annuaire qui traduit un nom (`suivi-audits.nes.local`) en adresse IP |
| **Certificat / HTTPS** | Ce qui chiffre la connexion entre le navigateur et le serveur (le cadenas) |
| **Double authentification (TOTP)** | Code à 6 chiffres du téléphone, demandé en plus du mot de passe |
| **Dépôt GitHub** | L'endroit où est rangé le code de l'application, avec son historique |
| **Branche** | Une version de travail du code, par exemple une nouveauté en test |
