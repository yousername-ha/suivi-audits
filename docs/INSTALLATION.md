# Installer « Suivi des audits SMSI » — guide pas à pas

> Ce guide reste la référence des commandes rejouées en CI. Le [dossier de reprise](00_INDEX.md), le [guide administrateur](06_GUIDES/GUIDE_ADMINISTRATEUR.md) et le [dépannage](06_GUIDES/GUIDE_DEPANNAGE.md) décrivent les parcours et réserves actuels.

Ce guide part d'un serveur vide et ne suppose aucune connaissance de Linux ni de Docker. Il s'adresse au RSSI ou à un technicien. Suivez les étapes **dans l'ordre**, sans en sauter. Comptez environ 30 minutes, plus le temps des demandes aux autres équipes (étape 0).

> **Version 6.0.0 : installation sans ligne de commande** ([ADR 0077](adr/0077-installation-sans-ligne-de-commande.md)). Sur le serveur, vous installez Docker et git, vous téléchargez l'application, puis **une seule commande**, `sudo ./installer.sh`, prépare et démarre tout. Le reste se fait dans le navigateur : adresse du site, poivre des mots de passe, clé de secours des sauvegardes, compte administrateur. La 6.0.0 s'installe sur un **serveur neuf** : il n'y a pas de mise à jour depuis une version 5.x.
> `main` porte la version Docker unique, issue de la branche de travail `claude-suivi-smsi` ; la branche `legacy` porte l'outil historique autonome. Les anciennes branches sont conservées sous les étiquettes `archive/*`.

**Comment lire ce guide**
- Chaque cadre gris contient **une commande**. Copiez-la, collez-la dans le terminal du serveur (clic droit dans PowerShell), puis appuyez sur **Entrée**.
- Sous chaque commande, **Résultat attendu** décrit ce que vous devez voir. Si le résultat diffère, arrêtez-vous et consultez la section [13. En cas de problème](#13-en-cas-de-problème).
- Le texte `<comme_ceci>` est à remplacer par votre valeur, **chevrons compris**. Par exemple, `ssh <utilisateur>@<adresse_ip_du_serveur>` devient `ssh admin@10.0.12.40`.
- ⚠️ signale une action risquée : lisez l'avertissement **avant** de lancer la commande.

Ce guide est **vérifié automatiquement** : à chaque modification de l'application, l'intégration continue rejoue ses commandes sur un serveur Ubuntu vierge et sur des machines virtuelles vierges Debian 12 et Rocky Linux 10 (variantes `dnf` du guide, SELinux en mode `enforcing`), jusqu'à la création de l'administrateur, l'import d'un fichier de l'ancien outil, une sauvegarde et sa restauration. Un guide inexact bloque la publication. Les commentaires `<!-- ci: … -->`, invisibles sur GitHub, servent à ce contrôle.

---

## Sommaire
0. [Ce qu'il vous faut avant de commencer](#0-ce-quil-vous-faut-avant-de-commencer)
1. [Se connecter au serveur depuis Windows](#1-se-connecter-au-serveur-depuis-windows)
2. [Préparer le serveur](#2-préparer-le-serveur)
3. [Installer Docker](#3-installer-docker)
4. [Télécharger l'application](#4-télécharger-lapplication)
5. [Lancer l'installation](#5-lancer-linstallation)
6. [Ce que la commande a configuré](#6-ce-que-la-commande-a-configuré)
7. [Vérifier que l'application tourne](#7-vérifier-que-lapplication-tourne)
8. [Terminer l'installation dans le navigateur](#8-terminer-linstallation-dans-le-navigateur)
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
| ☐ | **Un serveur Linux** (machine virtuelle) | **Debian 12**, **Ubuntu 24.04 LTS** ou **Rocky Linux 10** ([ADR 0085](adr/0085-support-de-rocky-linux-10.md)), installation minimale, en 64 bits (x86_64). Demandez à l'équipe infrastructure « une VM Linux pour une application Docker ». |
| ☐ | **Dimensionnement** | 2 processeurs, 4 Go de mémoire, 30 Go de disque, plus la place des sauvegardes (prévoir 10 Go). Avec l'antivirus facultatif (ClamAV) : 8 Go de mémoire. Une mise à jour demande, en espace libre, deux fois la taille de la base plus 2 Go. |
| ☐ | **Un emplacement pour les données** | Un dossier du serveur, par défaut `/srv/suivi-audits/donnees`. Les sauvegardes chiffrées de l'application sont rangées dans son sous-dossier `sauvegardes/` : demandez à l'équipe infrastructure de les **copier hors du serveur** (sauvegarde externalisée), **sans** le sous-dossier `cles-sauvegarde/` (étape 6.6). |
| ☐ | **Un compte sur ce serveur** avec droits d'administration (`sudo`) | L'équipe infrastructure vous fournit l'adresse IP, l'identifiant et le mot de passe. |
| ☐ | **Un nom DNS** pointant vers le serveur | Par exemple `suivi-audits.mondomaine.local`. Demandez à l'équipe réseau « un enregistrement DNS de type A vers l'IP du serveur ». Il n'est pas nécessaire pour commencer : l'assistant s'ouvre aussi par l'adresse IP du serveur. |
| ☐ | **Ports entrants ouverts** des postes utilisateurs vers le serveur | TCP **443** (HTTPS) et TCP **80** (redirection vers HTTPS). Pour l'administration : TCP **22** (SSH), depuis votre poste uniquement. |
| ☐ | **Flux sortants ouverts** du serveur vers Internet | Voir le tableau ci-dessous. |
| ☐ | **Un téléphone avec une application d'authentification** | Microsoft Authenticator, FreeOTP, Aegis ou Google Authenticator. |
| ☐ | **Un coffre-fort de mots de passe** | KeePass ou équivalent, pour conserver le poivre des mots de passe et la clé de secours des sauvegardes (étape 8). |

**Flux sortants à demander** (du serveur vers Internet, à faire ouvrir au pare-feu ou au proxy) :

| Destination | Port | Usage |
|---|---|---|
| `deb.debian.org`, `security.debian.org` (Debian), `archive.ubuntu.com`, `security.ubuntu.com` (Ubuntu) ou `mirrors.rockylinux.org` et un miroir Rocky, `dl.fedoraproject.org` (Rocky : dépôt EPEL, pour l'outil `age`) | TCP 80 et 443 | Mises à jour du système |
| `download.docker.com` | TCP 443 | Installation de Docker |
| `github.com` | TCP 443 | Téléchargement de l'application et de ses nouvelles versions |
| `ghcr.io`, `pkg-containers.githubusercontent.com` | TCP 443 | Images de l'application |
| `tuf-repo-cdn.sigstore.dev`, `rekor.sigstore.dev` | TCP 443 | Vérification de la signature des images à chaque mise à jour (étape 12) |
| `registry-1.docker.io`, `auth.docker.io`, `production.cloudflare.docker.com` | TCP 443 | Image de la base de données (PostgreSQL) ; image de l'antivirus (ClamAV), téléchargée par Docker à la première activation de l'analyse antivirus |
| Serveur de temps (NTP) de votre organisation, ou `ntp.ubuntu.com` / `deb.pool.ntp.org` | UDP 123 | Mise à l'heure (indispensable à la double authentification) |
| `database.clamav.net` | TCP 443 | Facultatif : signatures de l'antivirus (service `freshclam` seul) |
| Hôte du fournisseur du modèle (par exemple `api.mistral.ai`) | TCP 443 | Facultatif : assistant RSSI (service `assistant-relais` seul) |
| Adresse de Tenable Security Center (réseau interne en général) | TCP du port réglé (443 par défaut) | Facultatif : connecteur Tenable du module Intégrations, par l'exécutant d'exploitation (`updater`) seul, une fois le connecteur activé (étape 11.10) |
| `www.cisa.gov`, `services.nvd.nist.gov`, `api.first.org`, `cert.cyber.gouv.fr`, `cyberveille.esante.gouv.fr` | TCP 443 | Facultatif : veille du module Vulnérabilités (catalogue KEV, NVD, EPSS, CERT-FR, CERT Santé), par l'exécutant d'exploitation (`updater`) seul, une fois la veille activée (étape 11.11). Si le mandataire sortant de l'établissement est réglé (étape 11.12) : sortie vers le mandataire, sur son port, à la place |
| `cveawg.mitre.org`, `radar.cloudflare.com`, `tldrcve.com` | TCP 443 | Facultatif : compléments de la veille du module Vulnérabilités (lot CVE-INC), sous le même flux : `cveawg.mitre.org` (cve.org) seulement quand une personne consulte une CVE inconnue de la veille, `radar.cloudflare.com` (préavis des CVE) et `tldrcve.com` (résumés) seulement si ces sources facultatives, désactivées au départ, sont activées (étape 11.11). Si le mandataire sortant de l'établissement est réglé (étape 11.12) : sortie vers le mandataire, sur son port, à la place |
| `www.cnil.fr`, `www.edpb.europa.eu`, `eur-lex.europa.eu`, `cyber.gouv.fr`, `cyberveille.esante.gouv.fr`, `echanges.dila.gouv.fr` | TCP 443 | Facultatif : veille réglementaire (CNIL, CEPD, EUR-Lex, ANSSI, actualités du CERT Santé, Journal officiel par les données ouvertes de la DILA), par l'exécutant d'exploitation (`updater`) seul, une fois la veille réglementaire activée (étape 11.14). Si le mandataire sortant de l'établissement est réglé (étape 11.12) : sortie vers le mandataire, sur son port, à la place |
| Votre espace AlgoLightHouse (`<espace>.algolighthouse.fr`, sur Internet) | TCP 443 | Facultatif : connecteur AlgoLightHouse du module Intégrations (surface externe), par l'exécutant d'exploitation (`updater`) seul, une fois le connecteur activé (étape 11.10). Si le mandataire sortant de l'établissement est réglé (étape 11.12) : sortie vers le mandataire, sur son port, à la place |

Une fois démarrée, l'application elle-même n'a **aucun accès à Internet** : seuls le système, Docker et l'exécutant d'exploitation en ont besoin, pour l'installation et les mises à jour.

**Antivirus facultatif.** Le profil Compose `antivirus` regroupe deux services sans privilège (utilisateur `clamav`, système de fichiers en lecture seule, aucune capacité Linux) : `clamav` (analyse, joint par l'API seule sur le réseau interne `antivirus`, sans accès à la base ni à Internet) et `freshclam` (téléchargement des signatures, seul à sortir vers `database.clamav.net`). `clamav` démarre quand les signatures initiales sont présentes, ce qui prend quelques minutes au premier lancement ; l'analyse reprend les signatures mises à jour dans l'heure qui suit leur téléchargement. **Aucune commande à taper** : un administrateur active l'analyse dans l'application (Configuration système > Sécurité, « Activer l'analyse antivirus ») ; ce geste ouvre le flux de mise à jour des signatures, après validation explicite de ses destinations ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)), et l'exécutant d'exploitation (`updater`) démarre alors `freshclam`, puis `clamav` dès que les signatures sont là ; désactiver l'analyse les arrête et les retire. L'état réellement appliqué (ouvert, fermé ou erreur) se lit dans Configuration système > Flux vers l'extérieur. `CLAMAV_HOST` n'est plus à renseigner (hôte `clamav` par défaut, à remplacer seulement pour un démon externe). Flux fermé, un fichier déposé est accepté « non analysé », comme sans antivirus ; flux ouvert, `CLAMAV_REQUIRED` (vrai par défaut) fait refuser le dépôt si le démon ne répond pas, y compris pendant son premier démarrage. Le dossier `DATA_DIR/clamav` appartient à l'uid 100, préparé par le service `init`.

**Assistant RSSI facultatif** ([ADR 0086](adr/0086-assistant-rssi-integre.md)). Le profil Compose `assistant` contient `assistant-relais`, un service sans privilège (même image que l'API, système de fichiers en lecture seule, aucune capacité Linux, aucun accès à la base ni aux secrets). Il est le seul à sortir, vers le fournisseur du modèle de langage ; l'API le joint sur le réseau interne `assistant` et garde zéro accès à Internet. **Aucune commande à taper** : activer l'assistant dans sa page ouvre son flux ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)) ; la première fois, une fenêtre détaille la destination et les données qui sortent, et un administrateur la valide. L'exécutant d'exploitation (`updater`) démarre alors le relais à son passage suivant (en général moins d'une minute) et l'arrête et le retire quand l'assistant est désactivé. L'assistant ne joint le relais que lorsque son flux est ouvert **et** que l'exécutant a rapporté le relais démarré ; sinon il dit où en est l'application. `ASSISTANT_RELAIS_URL` n'est plus à renseigner (adresse `http://assistant-relais:8787` par défaut, à remplacer seulement pour un autre relais). Le reste se règle dans l'interface (Plateforme, « Assistant RSSI ») avec le droit `assistant:administrer` : adresse HTTPS du service de modèle (API compatible OpenAI, par exemple `https://api.mistral.ai/v1`), nom du modèle, clé (scellée, jamais réaffichée), profils et périmètres ouverts, budget quotidien. **Ce qui sort du serveur** : la question posée et les extraits lus pour y répondre. Ouvrir le flux sortant TCP 443 vers l'hôte du fournisseur. Un modèle hébergé sur une adresse privée de l'organisation demande en plus `ASSISTANT_RELAIS_PRIVE=true` dans `.env` (le relais le reprend au plus tard dans l'heure, ou au redémarrage de l'exécutant : `sudo docker compose restart updater`). Sans le flux ouvert et appliqué, l'assistant reste inactif et l'interface le dit. Pas à pas pour débutant : [connecter l'assistant à Mistral](06_GUIDES/GUIDE_ASSISTANT_MISTRAL.md).

**Flux vers l'extérieur appliqués par l'exécutant** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md), lot 2). Tout flux est fermé par défaut ; chaque module s'active dans sa page, après validation explicite par un administrateur. L'exécutant d'exploitation (`updater`, sans port ni API HTTP) lit l'état voulu à chaque passage (toutes les quinze secondes environ) et l'applique : profils Compose `assistant` et `antivirus` démarrés ou arrêtés et retirés ; courriel, mises à jour, certificat ACME, connecteurs du module Intégrations (Tenable Security Center, AlgoLightHouse) et veille du module Vulnérabilités silencieux tant que leur flux est fermé. Il rapporte l'état réellement appliqué (ouvert, fermé ou erreur courte, sans détail sensible) dans Configuration système > Flux vers l'extérieur, à chaque changement et au moins toutes les demi-heures. **Si l'exécutant ne peut pas lire l'état voulu** (application arrêtée ou en cours de redémarrage) : il n'émet rien lui-même (ni courriel, ni vérification ou téléchargement de version, ni demande ACME) mais laisse l'assistant et l'antivirus dans l'état où il les a mis, sans les arrêter sur une simple indisponibilité passagère ; il reprend dès que l'état se relit. **Une mise à jour ne referme pas un flux en service** (précision du RSSI du 16/11/2026, version 7.2.1) : avant toute fermeture, l'exécutant déclare à l'application les modules réellement en service (passerelle en ACME, relais de l'assistant ou antivirus présents sur le serveur ou réglés dans `.env` par `ASSISTANT_RELAIS_URL` ou `CLAMAV_HOST`, mise à jour déjà installée ; le courriel actif avec un serveur SMTP est constaté au démarrage de l'application). Un module **jamais décidé** est alors enregistré ouvert par `reprise-mise-a-jour`, inscrit au journal d'audit (`flux.externe.repris`, avec le motif) ; un module déjà décidé, ouvert ou fermé, n'est jamais touché. Le pare-feu de l'hôte et du réseau reste à régler par l'équipe infrastructure (tableau de l'étape 0).


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

**Debian ou Ubuntu :**

<!-- ci: instead: sudo apt-get update -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo apt update && sudo apt full-upgrade -y
```
**Résultat attendu** : la commande se termine sans ligne commençant par `E:` (erreur). Les lignes `W:` (avertissements) sont sans gravité.

**Rocky Linux 10 :**

<!-- ci: rocky-instead: sudo dnf makecache -->
```bash
sudo dnf upgrade -y
```
**Résultat attendu** : la commande se termine par `Terminé !` (ou `Complete!`) sans ligne `Error`.

> ⚠️ Si la liste des paquets mis à jour contient `kernel-core`, un **nouveau noyau** a été installé : **redémarrez le serveur maintenant** (`sudo reboot`), puis reconnectez-vous au bout de 2 minutes avant de continuer. Sans ce redémarrage, les modules réseau du noyau en cours ne correspondent plus à ceux installés et **Docker (étape 3) ne démarre pas** (erreur `iptables … RULE_APPEND failed`). Vérification : `sudo dnf needs-restarting -r` répond `No core libraries or services have been updated` (ou `Reboot should not be necessary`) quand aucun redémarrage n'est nécessaire.

> Sur Ubuntu, un écran violet « **Daemons using outdated libraries** » peut s'afficher : appuyez sur **Tab** jusqu'à `<Ok>`, puis **Entrée**.

**2.2 Installer git** (téléchargement de l'application) et les outils de base :

**Debian ou Ubuntu :**

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo apt install -y git curl ca-certificates ufw
```
**Résultat attendu** : la dernière ligne ne contient pas `E:`.

**Rocky Linux 10** (le dépôt EPEL fournit l'outil `age` des sauvegardes) :

<!-- ci: rocky-run -->
```bash
sudo dnf install -y git curl ca-certificates firewalld kernel-modules-extra epel-release && sudo dnf install -y age python3
```
**Résultat attendu** : la commande se termine sans ligne `Error`. Laissez **SELinux en mode `enforcing`** (état par défaut de Rocky) : Docker CE n'étiquette pas les conteneurs et l'application fonctionne sans l'assouplir (`getenforce` doit répondre `Enforcing`).

**2.3 L'heure du serveur** est **indispensable** : les codes de double authentification en dépendent. La commande d'installation (étape 5) la vérifie et active la synchronisation si besoin. Pour la contrôler vous-même :

<!-- ci: run -->
```bash
timedatectl
```
**Résultat attendu** : une ligne `System clock synchronized: yes`. Si elle reste à `no` plusieurs minutes après l'installation, le flux NTP (UDP 123) est bloqué : voir l'étape 0.

**2.4 Activer le pare-feu du serveur**, en n'autorisant que l'administration (SSH) et le web. Passez cette étape si l'équipe infrastructure filtre déjà les flux du serveur.

> ⚠️ Autorisez **toujours le port 22 en premier**. Si vous activez le pare-feu sans lui, vous perdez immédiatement la connexion au serveur, et il faudra l'intervention de l'équipe infrastructure.

**Debian ou Ubuntu (`ufw`) :**

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo ufw allow 22/tcp
```
**Résultat attendu** : `Rules updated` (et `Rules updated (v6)`).

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```
**Résultat attendu** : `Rules updated`, quatre fois.

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo ufw --force enable
```
**Résultat attendu** : `Firewall is active and enabled on system startup`.

**Rocky Linux 10 (`firewalld`) :** le service autorise déjà `ssh` ; ajoutez le web, puis activez-le.

<!-- ci: rocky-run -->
```bash
sudo systemctl enable --now firewalld && sudo firewall-cmd --permanent --add-service=ssh --add-service=http --add-service=https && sudo firewall-cmd --reload
```
**Résultat attendu** : `success` à chaque commande `firewall-cmd`.

---

## 3. Installer Docker

Docker fait tourner l'application dans des « conteneurs » isolés (voir le [glossaire](#15-glossaire)). On l'installe depuis le dépôt officiel de Docker, qui fournit les mises à jour de sécurité.

**3.1 Ajouter la clé de signature de Docker :**

**Debian ou Ubuntu :**

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo install -m 0755 -d /etc/apt/keyrings
```
**Résultat attendu** : aucun message.

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
. /etc/os-release && sudo curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc && sudo chmod a+r /etc/apt/keyrings/docker.asc
```
**Résultat attendu** : aucun message. Un message `Could not resolve host` ou `Failed to connect` signifie que le flux vers `download.docker.com` est bloqué (étape 0).

**3.2 Déclarer le dépôt de Docker :**

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
. /etc/os-release && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list
```
**Résultat attendu** : une ligne qui commence par `deb [arch=amd64 signed-by=…] https://download.docker.com/linux/debian bookworm stable` (ou `…/linux/ubuntu noble stable`).

**3.3 Installer Docker :**

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
**Résultat attendu** : la dernière ligne ne contient pas `E:`.

**Rocky Linux 10 :** déclarez le dépôt officiel de Docker pour RHEL (sa clé de signature est importée à la première installation), puis installez Docker.

<!-- ci: rocky-run -->
```bash
sudo dnf install -y dnf-plugins-core && sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
```
**Résultat attendu** : le dépôt `docker-ce-stable` est ajouté, sans ligne `Error`.

<!-- ci: rocky-run -->
```bash
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
**Résultat attendu** : la commande se termine sans ligne `Error`. Si `dnf` affiche l'empreinte de la clé de Docker et demande de l'accepter, comparez-la avec celle publiée sur la page d'installation de Docker pour RHEL, puis répondez `y`.

**3.4 Démarrer Docker, et le lancer automatiquement au démarrage du serveur :**

<!-- ci: run -->
```bash
sudo systemctl enable --now docker
```
**Résultat attendu** : aucun message, ou une ligne `Synchronizing state of docker.service…`.

**3.5 Vérifier l'installation :**

<!-- ci: run -->
```bash
sudo docker run --rm hello-world
```
**Résultat attendu** : le texte contient `Hello from Docker!`. Docker fonctionne et sait télécharger des images.

---

## 4. Télécharger l'application

**4.1 Télécharger le dépôt** dans le dossier `/opt/suivi-audits` :

<!-- ci: instead: sudo cp -a "$GITHUB_WORKSPACE" /opt/suivi-audits -->
```bash
sudo git clone https://github.com/yousername-ha/suivi-audits.git /opt/suivi-audits
```
**Résultat attendu** : `Cloning into '/opt/suivi-audits'...`, puis la ligne revient à l'invite sans message `fatal:`.

**4.2 Aller dans ce dossier :**

<!-- ci: run -->
```bash
cd /opt/suivi-audits
```
**Résultat attendu** : l'invite se termine par `/opt/suivi-audits$`.

> **À partir d'ici, toutes les commandes se lancent depuis le dossier `/opt/suivi-audits`.** Si vous vous reconnectez plus tard, retapez d'abord `cd /opt/suivi-audits`.

**4.3 Choisir la version à installer.** Les versions publiées sont listées sur `https://github.com/yousername-ha/suivi-audits/releases` : prenez la plus récente, par exemple `6.0.0`. Dans les commandes, `<version>` est ce numéro **sans** le « v ».

<!-- ci: skip — la CI installe le commit testé -->
```bash
sudo git checkout v<version>
```
**Résultat attendu** : `HEAD is now at …`. Un paragraphe sur l'état « detached HEAD » s'affiche aussi : c'est normal.

---

## 5. Lancer l'installation

**5.1 Lancer la commande d'installation.** Elle vérifie le serveur (Docker, heure, ports 80 et 443 libres), crée la configuration et le dossier des données, télécharge les images, démarre l'application, puis affiche **l'adresse à ouvrir** et le **jeton d'installation**. Comptez quelques minutes la première fois.

<!-- ci: instead: sudo ./installer.sh --site <nom_dns> --version <version> --construire | sed -E 's/[A-Z2-9]{5}(-[A-Z2-9]{5}){3}/XXXXX-XXXXX-XXXXX-XXXXX/g' -->
<!-- ci: then: sudo grep -qx 'SITE_ADDRESS=<nom_dns>' .env && sudo test "$(sudo stat -c %a .env)" = 600 -->
```bash
sudo ./installer.sh
```
**Résultat attendu**, en quatre parties :
1. `1. Vérification du serveur` : les versions de Docker et de Compose, puis `Heure du serveur synchronisée.` ;
2. `2. Configuration` : `Fichier .env créé (droits 0600) : site <nom ou adresse du serveur>, version <version>.`, puis `Dossier des données prêt : /srv/suivi-audits/donnees` ;
3. `3. Démarrage de l'application` : une ligne par composant, puis `Attente de l'application (jusqu'à 5 minutes)…` ;
4. `4. Ouvrir l'assistant d'installation` : une ou plusieurs adresses `https://…/setup`, puis un encadré `JETON D'INSTALLATION (usage unique, valable 24 h)` avec le jeton au format `XXXXX-XXXXX-XXXXX-XXXXX`, par exemple `K7QM2-XH9PD-4TNRW-B8FZC`. Le jeton ne contient jamais 0, 1, I, L ni O.

**Gardez cette fenêtre ouverte** : le jeton sert à l'étape 8. La commande s'arrête avec `ERREUR :` et une explication si le serveur n'est pas prêt (Docker absent, port déjà utilisé, images inaccessibles…) : corrigez, puis relancez-la. Relancée, elle ne modifie pas une installation existante.

> **Tester une version non publiée** (une branche, à la demande de l'équipe projet) : `sudo git checkout <branche>` au lieu de l'étape 4.3, puis `sudo ./installer.sh --construire` au lieu de la commande ci-dessus. Les images sont alors construites sur le serveur (10 à 20 minutes), ce qui demande des flux sortants supplémentaires : `registry.npmjs.org` et `dl-cdn.alpinelinux.org` (TCP 443).

<!-- ci: exec: sudo sed -i 's/^EXPLOITATION_AUTO=.*/EXPLOITATION_AUTO=0/' .env # recette du guide en mode hôte : chaque opération de l'exécutant est lancée explicitement (étape 11.6) -->

> Le nom du site proposé est le nom complet du serveur (`hostname -f`) ou, à défaut, son adresse IP. Vous le choisirez dans l'assistant (étape 8). Pour l'imposer dès maintenant : `sudo ./installer.sh --site suivi-audits.mondomaine.local`.

---

## 6. Ce que la commande a configuré

Rien à faire dans cette section : elle explique ce que `installer.sh` a préparé, pour s'y retrouver plus tard.

**6.1 Le fichier de configuration `.env`**, dans `/opt/suivi-audits`, créé à partir du modèle `.env.example` et lisible par root seul (droits 0600). Une installation normale n'a jamais à le modifier. Pour un réglage avancé (voir les commentaires du fichier) : `sudo nano .env`, puis `sudo docker compose up -d` pour l'appliquer.

**6.2 L'adresse du site** (`SITE_ADDRESS`) : celle choisie dans l'assistant (étape 8), ou dans Administration, Certificats et opérations. L'exécutant d'exploitation l'écrit lui-même dans `.env`. Tant que le certificat interne est utilisé, le site répond aussi aux autres noms et adresses IPv4 du serveur (`SITE_ADDRESS_EXTRA`).

**6.3 La version** (`APP_VERSION`) : celle du dépôt téléchargé à l'étape 4. Pour vérifier les trois valeurs principales :

<!-- ci: run -->
```bash
sudo grep -E '^(SITE_ADDRESS|APP_VERSION|CADDY_TLS)=' .env
```
**Résultat attendu** : vos trois valeurs, par exemple :
```text
SITE_ADDRESS=suivi-audits.mondomaine.local
CADDY_TLS=internal
APP_VERSION=6.0.0
```

**6.4 Certificat HTTPS.** Le serveur démarre avec un **certificat interne** (`CADDY_TLS=internal`, réglage par défaut) qu'il crée lui-même. Le certificat définitif se choisit **dans l'application**, une fois connecté (Administration, Système, Certificats TLS), sans fichier à modifier : autorité interne du serveur, **ACME** (certificat publiquement fiable, renouvelé seul, qui demande un nom public et les ports 80 et 443 joignables depuis Internet) ou **certificat de votre PKI** (déposé depuis l'application). Voir l'étape 11.7.

Si l'équipe infrastructure impose un réglage de départ par fichier (certificat de la PKI avant tout accès à l'application), il reste possible : déposez `fullchain.pem` et `privkey.pem` (clé **non protégée par mot de passe**) dans `/opt/suivi-audits/certs/`, remplacez `CADDY_TLS=internal` par `CADDY_TLS=/certs/fullchain.pem /certs/privkey.pem` dans `.env`, puis `sudo chown 1001:1001 certs/*.pem && sudo chmod 400 certs/privkey.pem`. Ce réglage est celui auquel l'application revient quand on choisit « Revenir au réglage de départ ».

**6.5 Le nom DNS.** Quand il existe, il doit renvoyer l'adresse IP du serveur :

<!-- ci: run -->
```bash
getent hosts <nom_dns>
```
**Résultat attendu** : une ligne avec l'adresse IP du serveur, puis le nom. Si rien ne s'affiche, l'enregistrement DNS n'existe pas encore : ouvrez l'assistant par l'adresse IP en attendant.

**6.6 Le dossier des données.** Toutes les données de l'application sont rangées dans **un seul dossier du serveur**, indiqué par la ligne `DATA_DIR` de `.env` (par défaut `/srv/suivi-audits/donnees`). Rien n'est gardé dans les conteneurs : on peut les supprimer, les recréer ou changer de version sans rien perdre. Ce dossier contient :

| Sous-dossier | Contenu | Accès |
|---|---|---|
| `postgres18/` | la base de données PostgreSQL 18 : suivi, comptes, documents chiffrés, journal d'audit | base de données seule |
| `secrets/` | mots de passe internes et **clé de chiffrement des documents**, créés au premier démarrage | lecture par la base et l'application |
| `cles-sauvegarde/` | clé du serveur et clé publique de secours des sauvegardes (étape 6.8) | exécutant d'exploitation seul (root) |
| `sauvegardes/` | sauvegardes chiffrées de l'application (étape 11) | exécutant d'exploitation seul (root) |
| `caddy/` | certificats HTTPS et autorité de certification interne | frontal web seul |
| `clamav/` | signatures de l'antivirus (facultatif) | `freshclam` (écriture) et `clamav` (lecture seule) |
| `etat/` | rapports des sauvegardes et des mises à jour, affichés dans **Administration**, onglet **Système** | lecture seule pour l'application |

Le service `init` crée ces sous-dossiers avec les bons propriétaires et droits à chaque démarrage. Il **refuse de démarrer** si le dossier n'a pas été préparé, s'il est dans le dossier de l'application (`/opt/suivi-audits`), dans un dossier système (`/var/lib/docker`, `/tmp`…) ou sur un disque temporaire.

> ⚠️ Ce dossier contient la base et la clé de chiffrement des documents **en clair** : ne le copiez pas hors du serveur ; ce sont les archives chiffrées de `sauvegardes/` qui s'externalisent (étape 11.2).
>
> ⚠️ **Ne copiez jamais `cles-sauvegarde/` avec les archives** : la clé du serveur qu'il contient déchiffre toutes les sauvegardes, et les deux réunis annulent leur chiffrement ([ADR 0071](adr/0071-sauvegardes-chiffrees-avec-age.md)). Si l'équipe infrastructure copie tout le serveur (instantané de la machine virtuelle), cette copie contient déjà la base en clair : elle se protège comme le serveur lui-même, et doit exclure `cles-sauvegarde/` si elle est conservée avec les archives. La clé du serveur n'a pas besoin d'être sauvegardée : après une perte, un nouveau serveur en crée une autre et les archives se restaurent avec la clé de secours du coffre-fort.

**6.7 La préparation du dossier des données** est faite par `installer.sh`. Pour un autre disque, choisi par l'équipe infrastructure : avant la première installation, créez `.env` (`sudo cp .env.example .env && sudo chmod 600 .env`), indiquez le dossier sur la ligne `DATA_DIR`, puis lancez `sudo ./installer.sh`. Le script `sudo ./scripts/preparer-donnees.sh` refait cette préparation seule ; il signale `des données existent déjà dans des volumes Docker` sur un serveur déjà installé avec des volumes : suivez alors l'étape 12.5.

**6.8 Les clés de sauvegarde : rien à faire.** Chaque sauvegarde est chiffrée avec [age](https://github.com/FiloSottile/age) pour deux clés ([ADR 0071](adr/0071-sauvegardes-chiffrees-avec-age.md), [ADR 0077](adr/0077-installation-sans-ligne-de-commande.md)) :

- la **clé du serveur**, créée automatiquement au premier démarrage dans `/srv/suivi-audits/donnees/cles-sauvegarde/serveur.key` (lisible par root seul, jamais affichée) ;
- la **clé de secours**, générée par **votre navigateur** à l'étape 8 (assistant d'installation). Vous la téléchargez et la rangez au coffre-fort de l'organisation ; seule sa partie publique (`age1…`) est envoyée au serveur. C'est elle qui permet de restaurer si le serveur et sa clé sont perdus.

Tant que la clé de secours n'est pas définie, les sauvegardes sont bloquées et un bandeau rouge le signale aux administrateurs.

> Perte du serveur : la restauration avec la clé de secours se fait sur un autre serveur (étape 11.4). **Testez-la avant de vous y fier.**

---

## 7. Vérifier que l'application tourne

`installer.sh` attend que l'application soit prête avant d'afficher le jeton. Ces contrôles servent si quelque chose semble anormal, ou plus tard.

**7.1 Vérifier l'état** :

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
| `app` | application (API) : base joignable et migrations appliquées | `Up … (healthy)` |
| `web` | interface interne (non exposée) | `Up … (healthy)` |
| `gateway` | frontal HTTPS exposé (démarre après `web`) | `Up … (healthy)` |
| `updater` | exécutant d'exploitation : sauvegardes, certificats, mises à jour, adresse du site | `Up …` |

Si un service affiche `unhealthy`, `Restarting` ou `Exited (1)`, ou si une ligne manque, allez à la section [13. En cas de problème](#13-en-cas-de-problème).

**7.2 Vérifier que le site répond** depuis le serveur :

<!-- ci: run -->
```bash
curl -sk https://<nom_dns>/healthz
```
**Résultat attendu** : `ok`. Remplacez `<nom_dns>` par l'adresse affichée par `installer.sh`.

---

## 8. Terminer l'installation dans le navigateur

**8.1 Le jeton d'installation.** C'est un code à **usage unique**, valable **24 heures**, qui prouve que c'est bien vous qui installez : il est affiché à la fin de `sudo ./installer.sh` (étape 5). Fenêtre fermée, plus de 24 h écoulées, ou jeton perdu ? Relancez la commande d'installation, qui en affiche un nouveau et annule le précédent :

<!-- ci: instead: sudo ./installer.sh --images-locales > /dev/null -->
```bash
sudo ./installer.sh
```
**Résultat attendu** : `Fichier .env existant : conservé.`, puis les adresses et le nouveau jeton. La commande `sudo docker compose exec app setup-token` fait de même.

**8.2 Ouvrir l'assistant** dans le navigateur de votre poste, à l'une des adresses affichées par la commande, par exemple `https://<nom_dns>/setup` ou `https://<adresse_ip_du_serveur>/setup`.

**8.3 Avertissement « Votre connexion n'est pas privée »** (certificat interne). C'est **attendu** : le certificat a été créé par le serveur lui-même, et votre poste ne le connaît pas encore.
- Pour avancer maintenant : cliquez sur **Paramètres avancés**, puis sur **Continuer vers le site**.
- Pour une installation durable, installez le certificat racine du serveur sur les postes. Une fois connecté, l'application le propose au téléchargement (Administration, Système, Certificats TLS, « Télécharger le certificat racine »). Remettez le fichier à l'équipe Active Directory, pour un déploiement par GPO dans « Autorités de certification racines de confiance ». Pour un test sur votre seul poste : double-cliquez dessus, **Installer le certificat**, **Utilisateur actuel**, **Placer tous les certificats dans le magasin suivant**, **Autorités de certification racines de confiance**, puis redémarrez le navigateur.

<!-- ci: exec: sudo docker compose cp gateway:/data/caddy/pki/authorities/local/root.crt /opt/suivi-audits/racine-suivi-audits.crt && sudo chmod 644 /opt/suivi-audits/racine-suivi-audits.crt -->

> ⚠️ Ce certificat racine permet au serveur de signer des certificats reconnus par les postes. Ne le déployez que pour ce serveur, et préférez à terme un certificat de votre PKI (étape 6.4).

**8.4 Remplir la page « Installation initiale »**, en trois étapes.

*Étape 1 sur 3, le poivre des mots de passe* ([ADR 0072](adr/0072-poivre-des-mots-de-passe.md)). Le poivre est un secret qui chiffre toutes les empreintes de mots de passe : une copie de la base ne suffit plus à tenter de les retrouver. Il n'est stocké nulle part en clair et ne sera plus affiché.
- **Générer un poivre** (recommandé) : l'application en propose un de 52 caractères, par groupes de 4. Copiez-le avec le bouton **Copier** et **enregistrez-le dans le coffre-fort de l'organisation**, avec le nom du serveur, au même titre que la clé de secours des sauvegardes (étape suivante).
- ou **Saisir le mien** : 32 à 256 caractères avec au moins 3 types de caractères (ou une phrase d'au moins 6 mots), sans suite évidente (`abcde`, `12345`, `azerty`), sans le nom de l'application ou de l'organisation, avec une entropie estimée d'au moins 128 bits. Les critères non respectés s'affichent en direct.
- Cochez **J'ai enregistré ce poivre dans le coffre-fort de l'organisation**, puis **recopiez ses 8 derniers caractères** depuis le coffre-fort : sans les deux, **Continuer** reste grisé.

> Le poivre sert à le **changer** plus tard (Administration, Configuration système, Sécurité : ancien poivre et code de double authentification exigés) et à **reprendre l'activité** si la clé maîtresse du serveur est perdue. Perdu, il ne se récupère pas : la procédure d'urgence (`suivi poivre-reinitialiser --confirmer`) impose un nouveau mot de passe à tous les comptes.

*Étape 2 sur 3, la clé de secours des sauvegardes* ([ADR 0077](adr/0077-installation-sans-ligne-de-commande.md), étape 6.8).
- Cliquez sur **Générer la clé de secours** : votre navigateur crée la clé, sans rien envoyer.
- **Télécharger le fichier de la clé** (ou **Copier la clé privée**) et rangez-la dans le coffre-fort de l'organisation, avec le poivre. Elle ne sera plus affichée et ne doit jamais être copiée sur le serveur.
- Cochez **J'ai rangé la clé privée de secours dans le coffre-fort**, puis recopiez ses **8 derniers caractères** : sans les deux, **Continuer** reste grisé. Seule la clé publique (`age1…`) est envoyée, avec le compte, à la fin de l'étape 3.

*Étape 3 sur 3, le compte administrateur* :
1. **Jeton d'installation** : collez le jeton affiché par la commande d'installation. Minuscules, espaces et tirets sont acceptés : le champ se met en forme tout seul.
2. **Adresse du site** : le nom DNS (ou l'adresse IP) par lequel les utilisateurs ouvriront l'application. L'assistant propose celle de votre navigateur. Si elle diffère de l'adresse en service, le serveur l'applique une minute environ après la création du compte, sans commande ; le site reste joignable par les adresses du serveur. Elle se change ensuite dans Administration, Certificats et opérations.
3. **Nom de l'organisation** (facultatif) : affiché dans l'application et les exports, modifiable ensuite dans Paramètres.
4. **Identifiant** : par exemple `rssi`. **Nom affiché** : par exemple `Responsable SSI`. L'adresse e-mail est facultative.
5. **Mot de passe** et **Confirmation** : au moins 12 caractères, avec au moins 3 types de caractères parmi minuscules, majuscules, chiffres et symboles, et sans l'identifiant. Enregistrez-le dans votre coffre-fort.
6. **Charger des données de démonstration** (case facultative, décochée par défaut) : à cocher pour une évaluation, jamais en production. Voir l'étape 10.4.
7. Cliquez sur **Créer le compte**.

**Résultat attendu** : la page « Activer la double authentification » s'affiche, avec un QR code. En cas de message d'erreur :
- « jeton invalide » : vérifiez la saisie, ou le jeton a été remplacé par un plus récent ;
- « jeton expiré » ou « déjà utilisé » : générez-en un nouveau (étape 8.1).

**8.5 Activer la double authentification**, obligatoire pour tous les comptes :
1. Sur votre téléphone, ouvrez l'application d'authentification, puis **Ajouter un compte** et **Scanner un QR code**.
2. Scannez le QR code affiché à l'écran.
3. Saisissez le code à 6 chiffres affiché par le téléphone : il est validé automatiquement (sinon, cliquez sur **Valider**).

**Résultat attendu** : l'application peut proposer d'ajouter une clé de sécurité (facultatif, **Plus tard** pour passer), puis affiche la page « Flux vers l'extérieur » (étape 8.6). La page `/setup` est désormais désactivée : elle renvoie vers la connexion.

<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" administrateur https://<nom_dns> -->

**8.6 Flux vers l'extérieur** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)), dernière étape, facultative. Par défaut, **aucun flux ne sort du serveur**. Pour chaque module qui communique avec l'extérieur, choisissez **Activer** ou **Plus tard** ; **Passer l'étape : tout plus tard** les laisse tous fermés. Tout se change ensuite depuis la page de chaque module, et le résumé est dans Administration, Configuration système, Flux vers l'extérieur.
- **Activer** affiche les destinations, les ports et les données qui sortent ; cochez la case de validation (sans elle, **Terminer** reste grisé). La décision est inscrite au journal d'audit et l'exécutant d'exploitation l'applique en moins d'une minute.
- **Antivirus**, **Mises à jour de la plateforme**, **Veille sur les vulnérabilités** et **Veille réglementaire** s'ouvrent directement (les veilles : étapes 11.11 et 11.14).
- **Assistant RSSI** : indiquez aussi l'adresse du service de modèle (par exemple `https://api.mistral.ai/v1`) et le nom du modèle. La clé du fournisseur et les profils se règlent ensuite dans Plateforme, Assistant RSSI : tant qu'aucune clé n'est enregistrée, rien ne sort.
- **Courriel** et **Certificat public ACME** ont besoin de leurs réglages (serveur SMTP ; nom public et ports 80 et 443 joignables depuis Internet) : ils s'activent depuis leur page (étapes 11.8 et 11.7), dont le lien est donné à la fin de l'étape ; la même validation y est demandée.
- **Tenable Security Center** et **AlgoLightHouse** (module Intégrations) ont besoin de leur adresse et de leurs clés d'API : ils s'activent depuis Plateforme, carte « Intégrations » (étape 11.10), avec la même validation.
- Pour chaque flux ouvert, faites autoriser par l'équipe infrastructure le flux indiqué (pare-feu de l'hôte et du réseau, tableau de l'étape 0).

Cette étape n'est proposée qu'une fois, au compte créé par l'installation : terminée ou passée, elle ne revient pas.

**Résultat attendu** : la page d'accueil s'affiche avec « Bonjour Responsable SSI ». **L'installation est terminée.**

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

**Périmètres et attribution** ([ADR 0092](adr/0092-refonte-des-droits-pyramide-des-perimetres.md)) : l'accès donné à un compte sur un périmètre (écran **Membres** du périmètre) vaut aussi pour **tous ses périmètres enfants** ; il se retire sur le périmètre où il a été donné. Le champ **Attribuer à** d'une action, d'une tâche récurrente ou d'un registre ouvre cet élément à la personne, au groupe ou à la fonction désignés : ils le consultent et le renseignent, sans rôle ni accès au périmètre, et gèrent ce qu'ils créent dans un registre qui leur est attribué. Retirer l'attribution retire l'accès.

**9.4 Garde-fous**, appliqués par le serveur :
- il reste toujours au moins un administrateur actif **sans date d'expiration** ;
- personne ne peut modifier ses propres droits : demandez à un autre administrateur ;
- toute modification de droits est tracée dans le **Journal** (avant et après) et ferme les sessions des personnes concernées.

**9.5 Paramètres** : menu **Paramètres**. Renseignez au moins la section **Général** (nom de l'organisation, logo, coordonnées). La section **Sécurité** règle la longueur minimale des mots de passe, la durée des sessions et le verrouillage, dans des bornes que l'application impose (un mot de passe contient en plus au moins 3 types de caractères, sans plus de 3 caractères identiques à la suite, sans suite de plus de 4 caractères consécutifs ni le nom de l'application ou de l'organisation, [ADR 0075](adr/0075-composition-des-mots-de-passe.md)) ; la double authentification reste toujours obligatoire. Les valeurs du fichier `.env` (`SESSION_…`, `PASSWORD_MIN_LENGTH`, `LOCKOUT_…`) ne servent que tant que cette section n'a pas été enregistrée.

**9.6 Revue des accès** (ISO 27001, mesure A.5.18) : onglet **Utilisateurs**, boutons **Excel** ou **CSV** de la revue des accès. Le fichier liste chaque compte, ses groupes, ses rôles, ses droits effectifs, sa dernière connexion et son expiration. Le bouton **Droits effectifs** d'un compte montre l'origine de chaque droit (rôle direct ou groupe). Faites cette revue au moins une fois par an, et archivez le fichier.

**9.7 Affichage** : chaque personne règle sa **Taille d'affichage**, sa **Densité** et son **Thème** dans **Mon compte**, section **Affichage**. Ces choix sont enregistrés sur le serveur et suivent la personne sur tous ses appareils. Les valeurs par défaut de l'organisation se règlent dans **Paramètres**, section **Apparence**.

**9.8 Écran mural** (grand écran de salle de réunion, tableau de bord permanent, sans compte nominatif) :
1. Sur l'ordinateur relié à l'écran, installez le certificat racine (étape 8.3) et ouvrez le navigateur.
2. Depuis votre poste : **Administration**, onglet **Écrans muraux**. Saisissez un **Nom** (par exemple « Salle de réunion »), la **Durée de validité** (180 jours par défaut, 365 au plus) et les **Modules affichés**, puis cliquez sur **Créer le lien d'activation**.
3. Le lien s'affiche **une seule fois** ; il est valable **24 heures** et ne sert qu'une fois. Ouvrez-le dans le navigateur de l'écran mural (copiez-le par un support interne, jamais par courriel externe).
4. L'écran affiche le tableau de bord. Bouton **Plein écran** (ou touche F11) ; **Rotation** fait défiler les vues toutes les 30 secondes. L'adresse `https://<nom_dns>/mur?rotation=30` peut servir de page d'accueil du navigateur de l'écran.
5. Pour couper l'écran : bouton **Révoquer** sur sa ligne. L'écran affiche « Écran non autorisé » en moins d'une minute. À l'expiration, recréez un écran.

Une personne connectée (même avec le seul rôle **Lecteur**) peut aussi ouvrir **Écran mural** depuis le menu.

**9.9 Cartographie du SMSI** (menu **Cartographie**) : vue contexte et vue processus, construites à partir des données déjà saisies (périmètre, processus, parties intéressées, enjeux des objectifs et des SWOT, sites et systèmes, fournisseurs), puis ajustées à la main. Droits (module **Cartographie du SMSI** de la matrice) : les rôles **Administrateur** et **RSSI** font tout ; **Contributeur** génère, modifie, enregistre et exporte ; **Lecteur** consulte et exporte ; **Auditeur externe** consulte si le module lui est ouvert. Supprimer une carte ou une version est réservé au droit « supprimer ». Une carte ne contient que la présentation : renommer un processus dans son module le renomme sur la carte, sans la modifier. Les objets d'un module que la personne ne peut pas lire apparaissent « Objet non accessible ». La carte peut aussi être **construite de zéro** (bouton **Construire la carte**, puis palette ou clic droit) : une partie intéressée, un fournisseur, un processus… créé sur la carte est enregistré dans son module, ce qui demande aussi le droit « Créer et modifier » de ce module (Pilotage, Fournisseurs ou Conformité).

**9.10 Déclarations réglementaires des incidents** ([ADR 0105](adr/0105-declaration-reglementaire-des-incidents.md)) : rien à faire sur le serveur. Dans l'application, **Plateforme**, carte **Identité de l'établissement** (droits `parametres` et `conformite`), renseignez la raison sociale, les numéros FINESS juridique et géographique, l'ARS de rattachement, le contact de signalement et le secteur d'activité au sens de NIS 2 : la rubrique est vide au départ et reprise dans les fiches de préparation des déclarations. La catégorie d'entité NIS 2 se règle dans la carte **Référentiels**. Attribuez le rôle prédéfini **RSSI** à la personne qui confirme, écarte et marque envoyées les déclarations : sans compte qui le tienne, aucune déclaration ne peut être confirmée ni marquée envoyée (le compte d'installation n'a que le rôle Administrateur). Avant la première utilisation, faites confirmer les rubriques de la fiche de préparation contre les formulaires réels des portails (signalement santé, ANSSI).

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

**10.4 Charger un jeu de données de démonstration (instance de test uniquement).** Pour évaluer la plateforme sans saisir de données réelles, l'API sait charger un jeu **fictif et cohérent**, celui d'un établissement de santé imaginaire : processus, objectifs et indicateurs, parties intéressées, fournisseurs évalués, écarts, plans d'audit, revue de direction, référentiels **ISO/IEC 27001:2022 et HDS** rattachés avec leur couverture par exigence et la déclaration d'applicabilité, méthode de risque, **étude EBIOS RM complète** (valeurs métier, événements redoutés, sources de risque, scénarios stratégiques et opérationnels, risques, traitements et actions, ateliers 1 à 5 validés), actions, séries récurrentes. Elle alimente aussi les autres rubriques : plans du SMSI (formation, sensibilisation, audit interne, exercices PRA et de crise), cycle et organisation de l'audit (jours, créneaux, participants), évaluations des fournisseurs par le clausier, deux sites fictifs rattachés au périmètre de l'organisation et fournisseurs des périmètres, cartographie (vues contexte et processus), incidents avec la chronologie d'un RETEX, cellule de crise (contacts, scénarios, exercice clôturé), plans de continuité et exercice, plan de contrôle, registre des preuves et plan d'action d'un risque du registre. Le module **Vulnérabilités** est rempli lui aussi : une instance « Tenable Security Center (démonstration) », d'adresse fictive `https://tenable.exemple.invalid`, **laissée inactive et sans clé**, et le résultat de deux synchronisations fictives (une quarantaine de machines avec leur criticité ACR et leur exposition AES, trois dépôts reliés à l'organisation et à ses deux sites, une trentaine de constats de gravité critique à faible, environ cent cinquante détections dont certaines corrigées entre les deux synchronisations). Ce résultat est rangé directement par l'API : **aucun appel ne part vers Tenable**, le flux « Tenable Security Center » reste fermé et rien n'est planifié. Si le module Vulnérabilités ou Intégrations est désactivé, cette partie est sautée. La remise à vide des données de travail garde les intégrations : un nouveau chargement reprend l'intégration de démonstration, et s'arrête si elle a été activée ou a reçu une clé. Aucun document n'est déposé.

À l'installation, la même démonstration se charge en **cochant « Charger des données de démonstration »** sur la page d'installation initiale (étape 8.4) : elle est alors chargée à la fin de la configuration de la double authentification du compte créé, en une minute environ. Pour repartir d'une base vide : Administration, Remettre la base à vide. Pour **régénérer la démonstration depuis l'écran**, sur une instance de test seulement : Administration, panneau « Remise à vide de la base », interrupteur autorisé, sauvegarde de moins de 30 minutes, puis « Remettre la base à vide… », choix « Les données de travail, puis recharger la démonstration », phrase `RÉGÉNÉRER LA DÉMONSTRATION` et code de double authentification ([ADR 0065](adr/0065-remise-a-vide-de-la-base.md), addendum du 23/11/2026). En ligne de commande :

<!-- ci: skip — instance de test uniquement, jamais rejoué par le guide -->
```bash
sudo docker compose exec app suivi jeu-de-test <compte administrateur> --confirmer
```

Le chargement n'est jamais automatique : il est **refusé si le pilotage n'est pas vide** et écrit au nom du compte indiqué (journal d'audit). Ne l'utilisez pas en production. Il passe par l'API publique, donc par les mêmes validations que la saisie ; les synchronisations fictives de Tenable suivent le chemin d'écriture de l'exécutant, avec les mêmes contrôles qu'une synchronisation réelle.

**10.5 Contrôler les relations entre les données.** Après un import, un chargement ou une migration :

<!-- ci: skip — contrôle d'exploitation, couvert par les tests de la CLI -->
```bash
sudo docker compose exec app suivi controle-relations --anomalies
```

La commande vérifie les références logiques entre objets (processus, objectifs, indicateurs, fournisseurs, risques, décisions, liens) et affiche une ligne par anomalie ; sans `--anomalies`, elle renvoie un JSON. Le script de mise à jour l'exécute avant et après la montée de version et signale l'écart **sans bloquer** la mise à jour. Pour PostgreSQL 18, la migration depuis la version 17 compare en plus le nombre de lignes et les contraintes (clés étrangères, unicité) avant d'être déclarée réussie ([ADR 0035](adr/0035-postgresql-18-migration-automatique.md)).

---

## 11. Mettre en place les sauvegardes

Une sauvegarde contient la base (suivi, comptes, documents chiffrés, journal), les secrets (clé de chiffrement des documents) **et** l'autorité de certification interne, lus dans le dossier des données. Elle est elle-même chiffrée avec [age](https://github.com/FiloSottile/age) pour **deux clés** : celle du serveur et une **clé de secours** que le RSSI garde hors du serveur ([ADR 0071](adr/0071-sauvegardes-chiffrees-avec-age.md)). Aucune sauvegarde n'est jamais produite en clair. Avant de publier l'archive, `backup.sh` lui applique le même contrôle que la restauration (structure, secrets, nom) puis la relit avec la clé du serveur ; si le contrôle échoue, ou si `caddy/data` contient un lien ou un fichier spécial (ce dossier est modifiable par le frontal), la sauvegarde est refusée et aucune archive n'est laissée. Le contrôle réextrait une copie dans le dossier temporaire : prévoir de la place pour deux exemplaires du dump. Chaque sauvegarde laisse un rapport dans `/srv/suivi-audits/donnees/etat/` : **Administration**, onglet **Système**, affiche la date de la dernière sauvegarde réussie et une **alerte au-delà de 48 h**.

> ⚠️ Sans la clé du serveur **ni** la clé de secours, les sauvegardes sont **illisibles**, définitivement. Sans les sauvegardes, une panne du serveur fait **tout perdre**.

**11.1 Contrôler les clés de sauvegarde.** Dans l'application, **Administration**, **Sauvegardes et restauration** : la carte « Clé de secours des sauvegardes » doit indiquer **En place**. La clé du serveur est créée au premier démarrage et la clé publique de secours, définie à l'étape 8, est recopiée par l'exécutant d'exploitation sous une minute (étape 6.8). Tant qu'elle indique **En attente de l'exécutant**, patientez une minute et rechargez la page.

<!-- ci: exec: command -v age-keygen > /dev/null || sudo apt-get install -y -qq age python3 > /dev/null -->
<!-- ci: exec: cd /opt/suivi-audits && sudo env BACKUP_DEST=/srv/sauvegardes/suivi-audits python3 ./scripts/exploitation-worker.py # recette en mode hôte (étape 5) : un passage de l'exécutant tient lieu de l'exécutant intégré -->
<!-- ci: exec: for i in $(seq 1 60); do sudo test -s /srv/suivi-audits/donnees/cles-sauvegarde/secours.pub && break; sleep 3; done -->

Pour le vérifier aussi sur le serveur (facultatif) :

<!-- ci: run -->
```bash
sudo ls -l /srv/suivi-audits/donnees/cles-sauvegarde
```
**Résultat attendu** : deux fichiers appartenant à `root`, `serveur.key` en `-rw-------` et `secours.pub`. **Gardez la clé de secours privée hors ligne** et testez-la à l'étape 11.4.

**11.2 Lancer une première sauvegarde.** Même écran, carte « Demandes de sauvegarde » : **Demander une sauvegarde**, puis confirmez. L'exécutant d'exploitation la prend en charge dans la minute ; l'historique affiche ensuite son résultat (« Réussie »), sa taille et son empreinte. Les archives (`….tar.age`, avec leur empreinte `.sha256`) sont rangées dans `/srv/suivi-audits/donnees/sauvegardes`. Sans clé de secours (étape 8), l'exécutant se déclare indisponible, le bouton reste grisé et rien n'est écrit en clair.

Demandez à l'équipe infrastructure de **copier le dossier `/srv/suivi-audits/donnees/sauvegardes` hors du serveur** (sauvegarde externalisée), **sans** `cles-sauvegarde/` (étape 6.6) : une sauvegarde restée sur le serveur disparaît avec lui. Pour ranger les archives ailleurs (disque dédié), indiquez le dossier sur la ligne `BACKUP_DEST` de `.env`, puis `sudo docker compose up -d updater`.

<!-- ci: run -->
```bash
sudo mkdir -p /srv/sauvegardes/suivi-audits
```
**Résultat attendu** (uniquement pour un dossier dédié comme celui-ci) : aucun message.

**11.3 Planifier les sauvegardes.** **Administration**, **Sauvegardes et restauration**, carte « Planification et conservation » : cochez **Activer la sauvegarde planifiée**, choisissez les **jours**, l'**heure** et la **minute** (en heure UTC : 1 h 15 UTC correspond à 2 h 15 en hiver à Paris), la **rétention** (90 jours conseillés), le **nombre maximal de sauvegardes** (30 par défaut) et le nombre de **sauvegardes d'avant mise à jour gardées** (3 par défaut), puis enregistrez (étape 11.13). La planification est désactivée par défaut ; le prochain créneau s'affiche dans le fuseau de votre navigateur. Aucune tâche planifiée (cron) n'est nécessaire sur le serveur. **Administration**, onglet **Système**, affiche la date de la dernière sauvegarde réussie et une **alerte au-delà de 48 h**.

La recherche de nouvelle version est, elle aussi, automatique (au démarrage, puis toutes les six heures) : un bandeau l'annonce aux administrateurs, sans rien installer (étape 12).

**11.4 Tester la restauration — obligatoire.** Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde. Faites ce test **maintenant**, avant d'ouvrir l'application aux utilisateurs, puis une fois par an sur un serveur de test.

> ⚠️ La restauration **remplace** toutes les données actuelles par celles de la sauvegarde. Juste après l'installation, rien n'est perdu. Plus tard, faites ce test sur un **serveur de test**, jamais sur le serveur en service.

**Depuis l'application** : **Administration**, **Certificats et opérations**, carte « Archives disponibles ». Sur la ligne de l'archive, **Vérifier** contrôle son empreinte, son déchiffrement et sa structure sans rien modifier. Une fois la vérification réussie, **Restaurer**, puis tapez `RESTAURER` pour confirmer et saisissez un **code de double authentification** (usage unique). L'exécutant fait d'abord une sauvegarde de sécurité, puis restaure ; la session est fermée : reconnectez-vous. Notez la date de ce test dans **Paramètres**, section **Sauvegardes** : l'application signale quand le prochain test est dû.

**Sur un autre serveur, avec la clé de secours** (perte du serveur et de sa clé). C'est le seul cas qui demande des commandes : installez l'application sur un serveur neuf (étapes 2 à 8), copiez-y l'archive et son fichier `.sha256`, ainsi que le fichier de la clé de secours sorti du coffre-fort, puis installez les outils de restauration :

<!-- ci: run -->
<!-- ci: rocky-run -->
```bash
if command -v apt > /dev/null; then sudo apt install -y age python3; else sudo dnf install -y epel-release && sudo dnf install -y age python3; fi
```
**Résultat attendu** : la dernière ligne ne contient ni `E:` ni `Error`.

Les commandes ci-dessous sont rejouées par la CI sur la sauvegarde faite par le serveur lui-même ; sur un autre serveur, ajoutez `BACKUP_KEY_FILE=<fichier de la clé de secours>` après `sudo`. Faites d'abord une sauvegarde en ligne de commande, dans le dossier de l'étape 11.2 :

<!-- ci: run -->
```bash
sudo ./scripts/backup.sh /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : la dernière ligne est `Sauvegarde : /srv/sauvegardes/suivi-audits/suivi-audits-<date>-<heure>.tar.age`. Sans clé de secours (étape 8), le script refuse de sauvegarder et n'écrit aucun fichier en clair.

<!-- ci: run -->
```bash
sudo ls -lh /srv/sauvegardes/suivi-audits
```
**Résultat attendu** : deux fichiers, `suivi-audits-….tar.age` (la sauvegarde) et `suivi-audits-….tar.age.sha256` (son empreinte, qui permet de détecter une altération).

Vérifier l'archive sans arrêter l'application ni modifier ses données :

<!-- ci: instead: sudo ./scripts/restore.sh --verifier "$(sudo sh -c 'ls -1 /srv/sauvegardes/suivi-audits/*.tar.age' | tail -1)" -->
```bash
sudo ./scripts/restore.sh --verifier /srv/sauvegardes/suivi-audits/<fichier>.tar.age
```

Résultat : « Vérification réussie. Restauration non exécutée. » Python 3 utilise uniquement sa bibliothèque standard, sans paquet à télécharger. L’archive est copiée dans un dossier temporaire privé, puis son empreinte, son déchiffrement et ses contenus imbriqués sont contrôlés. Une erreur empêche tout remplacement : archive modifiée ou tronquée, clé qui n'est pas destinataire de l'archive, ou archive renommée (l'INFO de l'archive doit correspondre à son nom de fichier, à son horodatage et à son identifiant de demande). Cette vérification ne prouve pas l’authenticité du fichier ni la réussite d’une restauration PostgreSQL : conserver la recette isolée ci-dessous.

Formats acceptés : archives GNU/USTAR produites par backup.sh, contenant suivi.dump, secrets.tgz, INFO et éventuellement caddy.tgz. Chemins absolus/traversées, liens, fichiers spéciaux/sparse, doublons et extensions PAX sont refusés. Limites : archive/dump 64 Gio, chaque archive imbriquée décompressée 512 Mio, INFO 1 Mio, 20000 en-têtes et 64 niveaux. Prévoir dans le disque temporaire l’espace pour la copie, le déchiffrement et les contenus extraits. Une archive sans fichier .sha256 reste lisible pour compatibilité, avec avertissement ; un fichier d’empreinte présent doit désigner exactement l’archive sélectionnée. Ne pas renommer un fichier sans actualiser son empreinte.

La restauration destructive exige root et la confirmation RESTAURER. Elle refuse un verrou de sauvegarde/exécutant déjà actif, contrôle le catalogue PostgreSQL avant arrêt, applique uniquement les fichiers validés, puis invalide les sessions restaurées. Il faut se reconnecter. L’attente PostgreSQL et la santé de l’application sont bornées par RESTORE_WAIT_SECONDS (300 secondes par défaut, 1 à 1800). Aucun rapport de succès n’est écrit si ces contrôles échouent. Après un échec pendant remplacement, conserver la sauvegarde de sécurité et faire intervenir l’exploitant.

<!-- ci: instead: echo RESTAURER | sudo ./scripts/restore.sh "$(sudo sh -c 'ls -1 /srv/sauvegardes/suivi-audits/*.tar.age' | tail -1)" -->
```bash
sudo ./scripts/restore.sh /srv/sauvegardes/suivi-audits/<fichier>.tar.age
```
Sur un autre serveur (perte de la clé du serveur), indiquer le fichier de la clé de secours téléchargé à l'étape 8 : `sudo BACKUP_KEY_FILE=/chemin/cle-secours-sauvegardes-<date>.txt ./scripts/restore.sh <fichier>.tar.age`.

Le script vérifie l'empreinte et la structure, puis demande de taper `RESTAURER` (en majuscules) suivi d'**Entrée**. Après la restauration de la base, il recalcule ses statistiques (`ANALYZE`, quelques secondes) avant de remettre l'application en service ; un échec de ce calcul n'est qu'un avertissement (« ATTENTION : statistiques de la base non recalculées »), PostgreSQL les recalculera de lui-même dans les minutes qui suivent.
**Résultat attendu** : la dernière ligne est `Restauration terminée.` Attendez une minute et vérifiez les états (étape 7.1), puis connectez-vous : vos comptes et vos données sont présents.

<!-- ci: exec: "$GITHUB_WORKSPACE/scripts/ci/guide-attendre.sh" -->
<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" verifier https://<nom_dns> -->
<!-- ci: exec: NODE_EXTRA_CA_CERTS=/opt/suivi-audits/racine-suivi-audits.crt node "$GITHUB_WORKSPACE/scripts/ci/guide-api.mjs" systeme https://<nom_dns> -->

---


**11.5 Activer les demandes manuelles depuis Configuration système > Sauvegardes et restauration (A1a).**

**Installation normale depuis 3.0.2 : déjà activé automatiquement.** Le service `updater` exécute également le poller commun, sans cron supplémentaire. Il repasse toutes les 15 secondes environ ; pendant la saisie d'un produit surveillé (module Vulnérabilités, flux « veille-vulnerabilites » ouvert), il intercale des passages courts toutes les 3 secondes pour la seule recherche des versions CPE, sans autre effet ([ADR 0097, addendum du 22/11/2026](adr/0097-flux-sortants-pilotes-par-les-modules.md)). Passer à la section 11.6 pour la clé et le catalogue. Les commandes A1a ci-dessous restent utiles uniquement pour les installations antérieures ou un exécutant hôte choisi explicitement.

La migration additive `006_sauvegardes.sql` est appliquée au démarrage. L’application enregistre une demande ; elle n’exécute aucun shell et ne reçoit ni clé ni chemin. Un exécutant sur le serveur interroge la file. Il réutilise `backup.sh`, avec chiffrement obligatoire. La restauration reste la procédure 11.4 ; l’empreinte SHA-256 vérifie la cohérence du fichier, pas son authenticité ni sa restaurabilité.

Après les étapes 6.8 et 11.1–11.4, vérifier que la clé du serveur est un fichier régulier, **non vide**, lisible par root seul (0600), et que le fichier de clés publiques de secours contient au moins une clé `age1…`. La clé de secours privée reste hors du serveur, dans le coffre-fort. La destination doit être persistante, privée et incluse dans la sauvegarde externalisée. `RETENTION_DAYS` accepte 1 à 36500 (90 par défaut ; les sauvegardes avant mise à jour sont faites avec 36500 et `BACKUP_GARDER_MAX=365`, leur nombre étant réglé à part, étape 11.13) ; `BACKUP_GARDER_MAX` accepte 7 à 365 (30 par défaut) ; `BACKUP_PREFIXE` accepte 1 à 61 caractères ASCII alphanumériques, point, tiret ou soulignement, avec un premier caractère alphanumérique. Ces contrôles s’appliquent aussi aux appels directs de `backup.sh`.

**Conservation minimale.** La rotation de `backup.sh` garde toujours les `BACKUP_GARDER_MIN` sauvegardes les plus récentes du dossier de destination (7 par défaut, de 1 à 365), même au-delà de `RETENTION_DAYS` ou de `BACKUP_GARDER_MAX` ; seules les suivantes disparaissent, avec leur fichier `.sha256`, si elles ont plus de `RETENTION_DAYS` jours **ou** si elles ne sont pas parmi les `BACKUP_GARDER_MAX` plus récentes (étape 11.13). L’exécutant des demandes web relève la durée enregistrée dans Configuration système à `RETENTION_MIN_DAYS` (30 par défaut, de 1 à 36500), lue dans `.env` sur le serveur ; une valeur hors bornes fait échouer la demande au lieu de supprimer des sauvegardes. Les deux réglages sont facultatifs et se placent dans `.env` (voir `.env.example`).

**Identifiants réservés.** Les UID 70, 100, 1000 et 1001 servent aux conteneurs de la pile (base, antivirus, application, frontal) et aux dossiers de `DATA_DIR` : ne les attribuer à aucun compte humain ou de service de l’hôte. Une alternative est l’option `userns-remap` de Docker, qui décale les identifiants des conteneurs ; elle modifie les droits des dossiers montés et se valide d’abord hors production.

Sur le serveur d’exploitation uniquement :

<!-- ci: skip — configuration facultative de la tâche hôte A1a, testée avec un exécutant isolé -->
```bash
cd /opt/suivi-audits
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

La migration additive `007_exploitation.sql` est appliquée au démarrage. À partir de **3.0.2**, le service `updater` de l'installation Compose exécute le poller commun automatiquement : sauvegardes manuelles/planifiées, catalogue, vérifications, restaurations et TLS autorisé. Aucun nouveau service, paquet ni cron. Il utilise par défaut **`DATA_DIR/sauvegardes`** (privé, persistant) et les clés age de l'étape 6.8 (**`DATA_DIR/cles-sauvegarde/serveur.key`** et **`secours.pub`**, root, hors API), qu'il crée ou recopie lui-même. Externaliser les archives. Les verrous hôte et SQL empêchent les opérations concurrentes ; une mise à jour attend le passage actif. Les fichiers temporaires volumineux sont dans `DATA_DIR/reprise-exploitation/tmp`, hors du petit `/tmp` du conteneur.

**Catalogue existant** : renseigner le chemin serveur `BACKUP_DEST` (et, si les clés ne sont pas aux emplacements par défaut, `BACKUP_KEY_FILE` et `BACKUP_RECIPIENTS_FILE`) dans `.env`, puis redémarrer `updater` ; Compose les monte pour l'exécutant, sans les exposer à l'API. Le dossier doit être persistant, possédé par root et non modifiable par le groupe/les autres comptes ; la clé du serveur est régulière, non vide, root 0600. Des archives d'anciennes versions dans ce dossier (`.tar.enc` de la 5.x, `.tar` en clair) n'y sont ni listées, ni restaurables, ni supprimées par la rotation (installation neuve uniquement depuis la 6.0.0) : les retirer soi-même lorsqu'elles ne sont plus utiles. Aucun cron existant n'est supprimé ou changé : éviter de planifier deux sauvegardes nocturnes pour le même besoin, même si les verrous empêchent une exécution simultanée.

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

Dans Configuration système > Sauvegardes et restauration, carte « Planification et conservation », régler jours ISO, heure/minute **UTC**, rétention (1–36500 jours), nombre maximal de sauvegardes (7–365) et sauvegardes d'avant mise à jour gardées (1–10). La planification est désactivée par défaut. Le prochain créneau est affiché dans le fuseau de votre navigateur. Le poller accepte au plus quinze minutes de retard, consomme chaque créneau avant la demande et ne rejoue pas les créneaux anciens après panne/restauration. Un conflit peut faire manquer un créneau : consulter les statuts et demander une sauvegarde manuelle. Avant d'activer la planification web, retirer **uniquement la ligne de sauvegarde nocturne directe** de l'étape 11.3 et le cron `suivi-backup-worker` de 11.5. Conserver les autres tâches du serveur. Si la planification web est désactivée, le cron de sauvegarde direct peut être conservé ; il reste régi par sa propre rétention. Aucun cron existant n'est modifié par l'application.

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
- **ACME** : indiquez un courriel de contact (et, si besoin, l'adresse d'un autre serveur ACME publiquement fiable ; vide = Let's Encrypt). Le serveur obtient le certificat, le contrôle (chaîne publiquement fiable exigée) et le renouvelle seul. Prérequis : le nom du serveur est public, les ports 80 et 443 sont joignables depuis Internet et le serveur peut joindre le serveur ACME. Si l'émission échoue, la configuration précédente est rétablie et le journal dit pourquoi. Un serveur ACME privé n'est pas pris en charge. Choisir ACME ouvre le flux **Certificat public ACME** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)) : la première fois, une fenêtre détaille l'autorité jointe, les ports 80 et 443 entrants et ce qui sort, à valider explicitement ; repasser à l'autorité interne ou à un certificat fourni le referme. Une demande en attente est annulée si le flux est refermé avant sa prise en charge, et l'exécutant relit l'état du flux juste avant d'appliquer une demande ACME. **Attention, HSTS** : le site envoie l'en-tête HSTS (valable un an). Quitter ACME (fermer son flux, choisir l'autorité interne, revenir à un réglage de départ interne) remet le certificat de l'autorité interne : les navigateurs qui ont déjà ouvert le site par son nom le refusent, et le site devient inaccessible par son nom de domaine ; il reste joignable par l'adresse IP du serveur, le temps de revenir à un certificat public. La confirmation le rappelle. Un flux ACME **jamais décidé** alors que la passerelle est en ACME (serveur mis à jour depuis une version antérieure à la 7.2) est repris ouvert, sans retour à l'autorité interne (voir « Flux vers l'extérieur appliqués par l'exécutant »). Si le flux a été fermé alors que la passerelle est en ACME (fermeture depuis Flux vers l'extérieur, échec d'un changement de mode, ou `CADDY_TLS` de `.env` réglé sur un courriel sans mode choisi dans l'application), l'exécutant la ramène lui-même à l'autorité interne, par les mêmes contrôles qu'un choix « Autorité interne » ; un certificat fourni n'est jamais touché et le réglage ACME (courriel, serveur) reste enregistré. Si la configuration est refusée, la passerelle reste en ACME, l'erreur s'affiche dans Flux vers l'extérieur et l'exécutant réessaie dix minutes plus tard ; avec `TLS_WEB_MANAGEMENT=0`, il ne modifie rien et signale l'erreur (remettre `CADDY_TLS=internal`).
- **Certificat fourni** : certificat/chaîne PEM et clé PEM non chiffrée, contrôlés ensemble avant installation.
- **Réglage de départ** : « Revenir au réglage de départ » rend la main à `CADDY_TLS` dans `.env`. Tant qu'aucun mode n'est choisi dans l'application, `.env` reste seul responsable.

La gestion depuis l'application est active par défaut. `TLS_WEB_MANAGEMENT=0` dans `.env` l'interdit ; si TLS est terminé par un ingress/proxy extérieur, régler `TLS_TERMINATION=external` : observation du certificat public sur SITE_ADDRESS:443, aucune modification proposée. L'accès d'observation doit être permis depuis l'hôte ; aucune sortie Internet n'est donnée à l'API.

**Adresse du client et `TRUST_PROXY`.** L'API lit l'adresse du client (audit, limites par adresse) dans `X-Forwarded-For`, mais seulement à travers les relais déclarés. `TRUST_PROXY` accepte : un **nombre de relais** (1 à 10 ; l'adresse retenue est celle que le dernier relais de confiance a vue), une **liste d'adresses ou de CIDR** séparés par des virgules (par exemple `10.0.0.0/8,192.168.1.5`), `false` (aucun relais, l'en-tête est ignoré) ou `true` (compatibilité : tous les relais, première adresse de la liste). Une valeur mal formée arrête le démarrage de l'API avec un message explicite. La pile fournie fixe `TRUST_PROXY: '1'` dans `docker-compose.yml` : seul `web` précède l'API, et `gateway` remplace l'en-tête du navigateur avant lui ; ne pas ajouter de relais devant `gateway` sans revoir cette valeur.

Priorité : le marqueur `secrets/tls-web/mode` (sauvegardé avec le couple, il ne contient que `web`, `env`, `interne` ou `acme`) sélectionne le mode. Pour `web`, les chemins fixes `/certs-web/cert.pem` et `key.pem` ; pour `acme`, le fichier `secrets/tls-web/acme` (deux lignes, courriel puis adresse `https://…`, revalidées au démarrage du frontal) ; sinon Caddy utilise exactement `CADDY_TLS` dans `.env`. Aucun shell ni fichier de configuration fourni par un utilisateur n'est interprété. Le fichier `.env` n'est jamais modifié par une demande web. Caddy ne reçoit qu'un seul émetteur ACME (pas de serveur de secours). Aucun bouton ne prétend forcer un renouvellement : Caddy renouvelle seul.

Le certificat/chaîne PEM et la clé PEM non chiffrée sont contrôlés ensemble (format, validité, hôte, clé publique et chaîne). La clé est scellée avec Vault en base, déchiffrée seulement par la CLI hôte, écrite dans `DATA_DIR/secrets/tls-web` (uid Caddy 1001, fichiers 0400) et incluse dans les sauvegardes chiffrées. Son contenu n'est pas rendu dans l'interface, l'API de lecture, les notifications ou l'audit ; il est effacé de la demande terminée/annulée. Ne pas copier de clé dans les journaux, arguments CLI ou fichiers d'état publics. Conserver les permissions et les sauvegardes externalisées.

L'exécutant valide Caddy, recrée le frontal, vérifie le certificat réellement servi avec l'hôte attendu et la santé. Un échec rétablit le couple/mode antérieur ; une interruption du retour arrière exige la reprise manuelle ci-dessus. Les métadonnées de simple observation (sujet, émetteur, validité, empreinte) ne constituent pas une attestation de confiance PKI. Une expiration à trente jours ou moins déclenche une alerte dans l'interface. Une restauration réattribue aussi les droits des clés TLS sauvegardées avant redémarrage. Après une restauration, la clé de secours des sauvegardes et l'adresse du site en service sur le serveur font foi : à la première passe de l'exécutant, l'application est réalignée dessus (actions d'audit `sauvegarde.cle_secours_realignee` et `exploitation.adresse_site_realignee`), de sorte qu'une clé de secours remplacée avant la sauvegarde restaurée ne redevient pas destinataire des archives suivantes. Les rotations et changements d'adresse approuvés ensuite s'appliquent normalement.


### 11.8 Envoi de courriels

Aucune étape d'installation supplémentaire : l'envoi de courriels (message de test et alertes d'exploitation au contact technique) se règle entièrement dans l'application, sous Administration, Configuration système, Courriel ([ADR 0049](adr/0049-courriel-et-sortie-reseau-optionnelle.md)). Le conteneur de l'API n'a toujours aucun accès à Internet : c'est l'exécutant d'exploitation du serveur, installé à l'étape 11.6, qui se connecte au serveur SMTP, sous un compte sans privilège, avec les paramètres saisis dans l'interface. Il doit donc pouvoir joindre le relais SMTP depuis le serveur ; si votre pare-feu le bloque, le message de test échoue avec une explication. Activer l'envoi ouvre le flux **Courriel** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)) : à l'enregistrement, une fenêtre détaille le serveur joint et ce qui sort, et un administrateur la valide ; désactiver l'envoi le referme. Tant qu'il est fermé, rien n'est remis à l'exécutant (les notifications restent en file jusqu'à leur expiration, le message de test est refusé) et l'écran Courriel le dit. L'authentification prend en charge PLAIN et LOGIN ; XOAUTH2 (Exchange Online avec authentification moderne) n'est pas pris en charge. Le mot de passe du compte SMTP est scellé et ne vaut que pour le relais pour lequel il a été saisi : changer le serveur, le port, le chiffrement, le compte ou l'autorité de certification le supprime (le journal d'audit garde l'action `courriel.mot_de_passe_invalide`), il faut alors le ressaisir avant de tester l'envoi.

**Notifications par courriel** ([ADR 0058](adr/0058-notifications-metier.md)). Les notifications métier (échéance d'une action, réévaluation d'un risque, contribution à un RETEX) peuvent aussi partir par courriel, **aucune étape d'installation de plus** : qui les reçoit, par groupe, par rôle ou par compte, se règle dans l'application (Administration, Plateforme, Destinataires des notifications ; chaque personne règle les siennes dans Mon compte). Tant que le courriel n'est pas activé et configuré, l'interface le dit (« Courriel non configuré, rien n'est envoyé ») et aucune demande n'est mise en file. Quand il l'est, le même exécutant d'exploitation envoie ces courriels, au plus 20 par passage (une minute environ) : une rafale s'écoule en quelques passages, et une demande restée en attente plus de trois jours est abandonnée. Un courriel ne contient que le type de la notification, un titre court et l'adresse de la rubrique « Rappels » (jamais de donnée métier) ; le lien reprend l'adresse du site (`SITE_ADDRESS`, déjà renseignée à l'installation). Un échec d'envoi n'empêche jamais la notification d'apparaître dans l'application et se lit dans la carte « Destinataires des notifications ».

**Alertes de verrouillage de compte** ([ADR 0070](adr/0070-reponse-de-connexion-uniforme-et-alerte-de-verrouillage.md)), **aucune étape d'installation de plus** : quand un compte est verrouillé après plusieurs échecs, un courriel part vers le **contact technique** (Administration, Configuration système, Courriel) et vers chaque **administrateur actif** (rôle Administrateur, directement ou par un groupe), à l'adresse de son compte. Cette alerte de sécurité ne se désactive ni par les réglages personnels ni par l'interrupteur des alertes d'exploitation ; elle ne contient ni adresse IP ni code, seulement le compte, l'heure, le motif et la fin du verrou. Au plus 10 alertes détaillées par heure, puis une synthèse horaire ; chaque verrou reste dans le journal d'audit (action `auth.account_locked`). Les administrateurs voient aussi l'alerte dans l'application ([ADR 0074](adr/0074-alerte-de-securite-dans-l-application.md)) : un bandeau en haut de l'écran, jusqu'à ce qu'ils la marquent comme lue, même quand le courriel n'est pas configuré. Sans courriel configuré, aucun courriel n'est envoyé et l'écran Courriel l'indique. La connexion répond la même chose (401) pour un compte inconnu, un mauvais mot de passe ou un compte verrouillé : le motif exact se lit dans le journal d'audit.

### 11.9 Poivre des mots de passe

Le poivre ([ADR 0072](adr/0072-poivre-des-mots-de-passe.md)) est défini à l'étape 8.4, dans l'assistant d'installation ; il se gère ensuite dans **Administration, Configuration système, Sécurité, Poivre des mots de passe**. **Conservez-le au coffre-fort**, avec la clé de secours des sauvegardes (étape 6.8) : ce sont les deux secrets de reprise du serveur.

- **Le changer** (par exemple au départ d'un administrateur qui le connaissait) : même carte, **Ancien poivre**, nouveau poivre généré ou saisi, engagement de sauvegarde, code de double authentification. Toutes les empreintes sont rechiffrées en une opération ; les mots de passe et les sessions ne changent pas. Cinq tentatives par heure et par compte ; un courriel prévient le contact technique et les administrateurs, et le journal d'audit garde l'auteur et les identifiants de clé (jamais le poivre).
- **Clé maîtresse perdue, base intacte** : restaurer la clé maîtresse si possible. Sinon, rescellez le poivre depuis le coffre-fort, le poivre étant lu sur l'entrée standard pour ne pas apparaître dans l'historique du shell : `printf %s "<poivre>" | sudo docker compose exec -T app suivi poivre-restaurer`.
- **Poivre perdu** (aucune copie au coffre-fort) : il ne peut plus être changé. Procédure d'urgence, sur le serveur : `sudo docker compose exec app suivi poivre-reinitialiser --confirmer`. Elle génère un nouveau poivre (affiché une seule fois : l'enregistrer **tout de suite** au coffre-fort), impose un mot de passe temporaire à **tous** les comptes (changement obligatoire à la connexion), ferme toutes les sessions et prévient par courriel. À réserver à ce cas : les utilisateurs doivent recevoir leur mot de passe temporaire.
- **Base sans poivre** (base d'une version 5.x remise en service sur la 6.x, hors de la procédure d'installation neuve) : toute empreinte non poivrée est refusée, aucune connexion n'est possible et le journal de l'application le signale au démarrage. Même procédure : `sudo docker compose exec app suivi poivre-reinitialiser --confirmer`.

### 11.10 Connecteurs du module Intégrations (Tenable Security Center, AlgoLightHouse)

Aucune étape d'installation supplémentaire : les connecteurs se règlent dans l'application, dans **Plateforme, carte « Intégrations »**, et nulle part ailleurs, avec le droit `integrations:administrer` ([ADR 0076](adr/0076-module-integrations.md), addendum du 19/11/2026 ; l'ancienne adresse `/integrations` ouvre cette carte). Les écrans du module Vulnérabilités n'en montrent que l'état (dernière synchronisation, erreur éventuelle) et un lien « Configurer l'intégration ». Deux connecteurs : **Tenable Security Center** (ci-dessous) et **AlgoLightHouse** (plus bas). Tenable a deux opérations : **Tester la connexion** et **Synchroniser** (failles et machines, rangées dans le module Vulnérabilités, [ADR 0100](adr/0100-module-vulnerabilites.md), lot V5). Le conteneur de l'API n'a toujours aucun accès réseau sortant : c'est l'exécutant d'exploitation du serveur, installé à l'étape 11.6, qui joint Tenable, par un script isolé (`scripts/integration-http.py`, bibliothèque standard de Python, compte sans privilège, délai borné). Sans exécutant, la page le dit et aucun appel n'est possible.

- **Configuration** : adresse `https://serveur` (port 443) ou `https://serveur:port` (port de 1 à 65535), sans chemin ni identifiant ; une adresse du réseau interne est admise. Autorité de certification interne facultative collée en PEM (vide : autorités du système), délai d'une requête, gravités lues par la synchronisation (critiques et élevées par défaut). Le certificat est toujours vérifié, en TLS 1.2 au minimum, et aucune redirection n'est suivie.
- **Clés d'API** (clé d'accès et clé secrète d'un compte de consultation de Tenable) : scellées par le coffre, jamais réaffichées ni journalisées ; changer l'adresse (port compris) ou l'autorité de certification les supprime (action `integration.secrets_invalides` au journal d'audit), il faut alors les ressaisir.
- **Flux** : activer le connecteur ouvre le flux **Tenable Security Center** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)) ; une fenêtre détaille la destination, le port réglé de l'instance et ce qui sort (les clés et des requêtes de lecture), et un administrateur la valide. Désactiver le dernier connecteur Tenable, ou le module Intégrations dans Administration, Modules, le referme ; tant qu'il est fermé, l'exécutant ne réclame aucune demande et n'émet rien vers Tenable. Faites autoriser par l'équipe infrastructure la sortie TCP du serveur vers l'adresse de Tenable, **sur le port réglé** (443 par défaut ; tableau de l'étape 0). Changer le port demande de faire évoluer la règle du pare-feu.
- **Ce qui est appelé** : seuls `POST /rest/analysis`, `GET /rest/hosts` (paramètres `limit` et `offset` seulement), `GET /rest/hosts/{uuid}` et `GET /rest/system` peuvent l'être (liste fermée, en lecture) ; le test n'appelle que `GET /rest/system` et ne garde que la **version** de Tenable : la licence et le code d'activation de la réponse ne sont ni rangés ni journalisés. Un test non pris en charge dans les dix minutes expire.
- **Synchronisation** (module Vulnérabilités actif) : une par période et par connecteur actif, inscrite par l'application elle-même (aucune tâche planifiée à ajouter sur l'hôte) ; la période se règle dans la fenêtre « Configurer » du connecteur : toutes les 6 ou 12 heures, une fois par jour (par défaut) ou une fois par semaine, avec un avertissement en dessous de 24 heures (charge sur Security Center pour un inventaire qui change peu). Une synchronisation en échec n'est pas redemandée avant la période suivante. Plus « Synchroniser maintenant » (droit `integrations:modifier`, au plus une fois par quart d'heure). L'exécutant lit les failles par `POST /rest/analysis` (vue `vulndetails`, pages de 200, 100 pages et 20 000 détections au plus), puis l'inventaire des machines par `GET /rest/hosts` (accès annoncé expérimental : son échec n'empêche pas la synchronisation des failles et s'affiche). Il ne garde que les champs utiles (jamais le texte détaillé `pluginText`) et les rapporte à l'application par lots de 500 (`suivi integrations-lot`). Une synchronisation dure au plus huit minutes de lecture ; l'exécutant l'abandonne au bout de dix, et une synchronisation non prise en charge dans l'heure expire. Pendant ce temps, l'exécutant ne traite pas ses autres demandes (sauvegardes comprises) : elles reprennent au passage suivant.

**AlgoLightHouse** (surveillance de la surface exposée sur Internet, éditeur AlgoSecure ; [ADR 0100](adr/0100-module-vulnerabilites.md), lot ALH1), en lecture seule, mêmes opérations (**Tester la connexion**, **Synchroniser**) :

- **Configuration** : adresse de votre espace chez l'éditeur, `https://<espace>.algolighthouse.fr` seulement (port 443, sans chemin ni identifiant), et délai d'une requête. Pas d'autorité de certification propre : le certificat de l'éditeur est vérifié par les autorités du système (et par celle de l'établissement si le mandataire inspecte le trafic, étape 11.12).
- **Clé d'API** (en-tête `X-API-Key`) : scellée par le coffre, jamais réaffichée ni journalisée ; changer l'adresse la supprime.
- **Flux** : activer le connecteur ouvre son propre flux, **AlgoLightHouse**, après la même validation. Le service est sur Internet : faites autoriser la sortie TCP 443 du serveur vers votre espace, ou, si le mandataire de l'établissement est réglé (étape 11.12), la sortie vers le mandataire ; le mandataire doit alors autoriser `<espace>.algolighthouse.fr` en `CONNECT` sur le port 443.
- **Ce qui est appelé** : seuls `GET /api/v1/health`, `/api/v1/version`, `/api/v1/alerts`, `/api/v1/alerts/{uuid}`, `/api/v1/perimeters`, `/api/v1/targets/hosts`, `/api/v1/targets/domains` et `/api/v1/technologies`, sans paramètre de requête. Jamais d'écriture (ni commentaire, ni changement de statut), jamais les adresses sans `/v1`, ni `/api/contacts` ni `/api/search`. Ne sont jamais lus : la description détaillée des alertes, les pièces jointes, les commentaires, les données sensibles des constats.
- **Synchronisation** (module Vulnérabilités actif) : une par période et par connecteur actif (fenêtre « Configurer » : toutes les 12 heures, une fois par jour par défaut, ou une fois par semaine ; avertissement en dessous de 24 heures, la limite d'appels de l'éditeur n'étant pas connue), plus « Synchroniser maintenant ». L'éditeur ne documente pas de pagination : chaque liste est lue en une réponse, bornée (16 Mio, 5 000 alertes, 10 000 hôtes et 10 000 domaines, 2 000 technologies) ; le détail des 300 alertes les plus récemment modifiées est lu à chaque passage ; huit minutes de lecture au plus. Au-delà, la synchronisation est incomplète et ne fait rien disparaître. Les données sont rangées dans Risques, Vulnérabilités, Surface externe ; un administrateur du module y relie chaque périmètre de l'éditeur à un périmètre de la plateforme (onglet « Périmètres »).

**Nessus, import de fichier** ([ADR 0100](adr/0100-module-vulnerabilites.md), lot N1) : pour un Nessus qui n'est pas rattaché
à Security Center, sans clé d'API ni flux réseau. Aucune étape d'installation, aucune règle de pare-feu, aucun exécutant : le
serveur ne joint jamais Nessus.

- **Exporter le scan dans Nessus** : ouvrir le scan terminé, menu « Exporter » (« Export »), format **Nessus** (fichier
  `.nessus`, XML « NessusClientData_v2 »). Un fichier de 100 Mo au plus ; au-delà, exporter un scan plus restreint (moins de
  machines) et l'importer en plusieurs fois. Le libellé exact du menu dépend de la version de Nessus : il n'a pas été vérifié
  sur une version précise.
- **Instance** : dans Plateforme, carte « Intégrations », « Ajouter une instance » du type « Nessus, import de fichier » (le
  nom suffit), puis « Configurer » pour les gravités retenues (critiques et élevées par défaut ; les contrôles informatifs ne
  sont jamais rangés), puis « Activer » (aucun flux à valider).
- **Importer** : « Importer un scan » sur l'instance (droit `integrations:administrer`, module Vulnérabilités actif), choisir
  le fichier. Il est lu dans le navigateur ; seuls partent vers le serveur, en JSON et par lots de machines entières, les
  champs utiles des machines (nom, adresse, système, dates du scan) et des failles (contrôle, gravité, port, protocole, CVE,
  CVSS 3, VPR, code d'exploitation, correctif, synopsis, lien https, dates de publication). Ne quittent jamais le poste : la
  sortie brute des contrôles, leur description longue, la politique du scan et ses comptes, le nom du fichier. Un fichier
  qui contient une déclaration `DOCTYPE` ou `ENTITY` est refusé. Le navigateur doit disposer d'environ 500 Mo de mémoire libre
  pour un fichier de 100 Mo (mesure sur Chromium, fichier fictif : lecture en 5 secondes environ).
- **Effet** : pour chaque machine du fichier, une faille qui n'y figure plus est considérée comme disparue ; les machines
  absentes du fichier ne changent pas. Les machines importées n'ont pas de dépôt Tenable : sans périmètre indiqué à la main
  (Risques, Vulnérabilités, Machines), elles ne sont visibles qu'avec le droit d'administrer le module. Chaque import figure
  dans « Exécutions » ; un import resté sans lot pendant trente minutes (onglet fermé) est clos comme interrompu, les
  machines déjà importées le restant. Au plus trente imports de fichiers commencés par heure et par personne (nombre de
  fichiers, pas de machines) ; au-delà, la fenêtre d'import affiche « Import refusé » et l'explique.
- **Exploitée par un logiciel malveillant** (lot N2) : un contrôle marqué `exploited_by_malware` dans le fichier compte comme
  une exploitation avérée (priorité P1 si la faille est présente, alerte critique). Les failles importées avant la mise à
  jour ne portent pas ce marquage : réimporter le scan.
- **Supprimer** (lot N2) : « Supprimer ce connecteur et tout ce qu'il a importé » sur l'instance (droit
  `integrations:administrer`, module Vulnérabilités actif, aucun import en cours). La fenêtre annonce les nombres de machines,
  failles, détections et imports qui disparaîtront et demande de saisir SUPPRIMER ; l'action est irréversible (seule une
  restauration de sauvegarde les ramène). Disparaissent aussi le suivi de ces failles et leurs liaisons ; les alertes sont
  réévaluées. Restent : l'historique du suivi, les instantanés des tendances, le journal d'audit, les alertes closes et les
  notifications déjà envoyées. Les connecteurs Security Center et AlgoLightHouse n'ont pas cette action.

**Silène, import de fichier** ([ADR 0100](adr/0100-module-vulnerabilites.md), lot SI1) : le rapport Silène de l'ANSSI
(surface exposée sur Internet), importé par fichier, sans clé d'API ni flux réseau. Aucune étape d'installation, aucune règle
de pare-feu, aucun exécutant : le serveur ne joint jamais Silène.

- **Exporter le rapport** depuis Silène au format **JSON**. Un fichier de 50 Mo au plus. Le libellé exact du menu d'export
  n'a pas été vérifié.
- **Instance** : dans Plateforme, carte « Intégrations », « Ajouter une instance » du type « Silène, import de fichier » (le
  nom suffit, aucun réglage), puis « Activer » (aucun flux à valider). Puis, dans Risques, Vulnérabilités, Surface externe,
  onglet « Périmètres » (droit d'administrer le module) : relier l'instance à un périmètre de la plateforme ; non reliée, elle
  n'est visible qu'avec le droit d'administrer le module.
- **Importer** : « Importer un rapport » sur l'instance (droit `integrations:administrer`, module Vulnérabilités actif),
  choisir le fichier. Il est lu dans le navigateur ; seuls partent vers le serveur, en JSON et par lots, la note et la
  synthèse du rapport, le périmètre déclaré, les hôtes (adresse IP, noms, ports ouverts, produits, contrôles) et les constats
  (contrôle, classe, points, hôtes concernés et leur détail). Ne quittent jamais le poste : certificats et clés, en-têtes
  HTTP, sorties des sondes, titres de pages, géolocalisation et système autonome, nom de la base et filtre, passage
  précédent, nom du fichier.
- **Effet** : chaque import complet est l'état de la surface vue par Silène à la date du rapport (un hôte ou un constat qui
  n'y figure plus n'est plus listé) ; la note de chaque import est gardée (évolution). Un import interrompu ne change pas le
  rapport qui fait foi. Même limite que l'import Nessus : trente fichiers commencés par heure et par personne, tous imports
  confondus. Aucune priorité ni alerte ne vient de Silène (les constats n'ont pas de CVE).
- **Supprimer** : « Supprimer ce connecteur et tout ce qu'il a importé » (mêmes conditions que pour Nessus) : hôtes,
  constats, imports et notes disparaissent, après saisie de SUPPRIMER ; le journal d'audit reste.

**Rapport de l'Active Directory, import de fichier** ([ADR 0100](adr/0100-module-vulnerabilites.md), lot AD-1) : le rapport
d'analyse de l'Active Directory remis par le service ADS de l'ANSSI, importé par fichier dans la page **Risques,
Vulnérabilités, Active Directory**. Ce n'est pas un connecteur : aucune instance, aucune clé, aucune règle de pare-feu, aucun
exécutant ; le serveur ne joint jamais l'ANSSI ni l'annuaire.

- **Produire le rapport** : lancer la collecte ORADAD (outil de l'ANSSI) sur un poste du domaine, selon la procédure du
  service ADS, puis transmettre la collecte au service ; il en retourne le rapport d'analyse. La plateforme ne lit **pas** la
  collecte ORADAD elle-même : seul le rapport, au format **JSON**, s'importe (50 Mo au plus). La forme de ce rapport a été
  écrite d'après sa seule structure (note globale, progression par niveau, points non conformes et objets concernés) et n'a
  jamais été vérifiée sur un rapport réel ; un rapport de forme non reconnue est refusé en entier, avec la partie en cause.
- **Importer** : en bas de la page, « Importer un rapport » (droit d'administrer le module Vulnérabilités), choisir le
  fichier. Il est lu dans le navigateur ; seuls partent la note, la progression, les points de contrôle non conformes (type,
  niveau, référence, titre) et, par point, le nombre d'objets et au plus 200 noms courts avec leur nature. Ne partent jamais :
  mots de passe, empreintes, attributs des comptes, SID, chemins LDAP complets, nom de domaine, nom du fichier. Même limite
  que les imports Nessus et Silène : trente fichiers commencés par heure et par personne, tous imports confondus.
- **Droits** : aucun droit nouveau. Les nombres et les noms des objets se lisent avec `vulnerabilites:lire` (les noms
  font partie du droit « Analyste », branché sur l'accès au module en attendant le lot 3 de l'ADR 0092) ; les noms ne se
  chargent que point par point, sur demande, et chaque consultation est inscrite au journal d'audit, sans les noms.
- **Conservation** : seuls les deux derniers imports gardent leurs noms ; les plus anciens ne gardent que leurs nombres.
  Les noms de ces deux imports sont en clair dans la base de données, donc dans ses sauvegardes : protéger celles-ci en
  conséquence. « Supprimer » un import (droit d'administrer le module, saisie de SUPPRIMER) efface ses noms et ses nombres ;
  les sauvegardes déjà faites les gardent jusqu'à leur rotation.

### 11.11 Veille du module Vulnérabilités (sources publiques)

Aucune étape d'installation supplémentaire : la veille se suit dans l'application, sous **Risques, Vulnérabilités, Veille**, avec le droit `vulnerabilites:lire` ([ADR 0100](adr/0100-module-vulnerabilites.md), lots V2 et V3), et se configure dans **Plateforme, carte « Veille des vulnérabilités »**, avec le droit `vulnerabilites:administrer` (lot VEILLE-PLATEFORME : activation, fréquences, « Collecter maintenant », dictionnaire CPE, sources facultatives ; l'écran « Veille » n'en montre que l'état, avec un lien « Configurer »). Le conteneur de l'API n'a toujours aucun accès réseau sortant : c'est l'exécutant d'exploitation du serveur, installé à l'étape 11.6, qui lit les sources, par un script isolé (`scripts/veille-vulnerabilites.py`, bibliothèque standard de Python, compte sans privilège, délai borné). Sans exécutant, l'écran et la carte le disent et aucune collecte n'est faite.

- **Sources, en liste fermée écrite dans le code** (aucune n'est réglable dans l'interface), toutes lues en `GET`, en HTTPS, certificat toujours vérifié en TLS 1.2 au minimum, sans suivre aucune redirection :

  | Source | Organisme | Hôte et chemins | Format | Conditions d'usage |
  |---|---|---|---|---|
  | Catalogue des failles exploitées (KEV) | CISA | `www.cisa.gov`, `/sites/default/files/feeds/known_exploited_vulnerabilities.json` | Fichier JSON | Non lues à ce jour |
  | Base nationale des vulnérabilités (NVD) | NIST | `services.nvd.nist.gov`, `/rest/json/cves/2.0` | API JSON, par fenêtre de dates de modification | Non lues à ce jour |
  | Dictionnaire des produits (CPE), source à part, désactivée au départ | NIST | `services.nvd.nist.gov`, `/rest/json/cpes/2.0` | API JSON, par lots puis par fenêtre de dates ; versions d'un produit choisi dans la saisie | Non lues à ce jour |
  | Probabilité d'exploitation (EPSS) | FIRST | `api.first.org`, `/data/v1/epss` | API JSON | Non lues à ce jour |
  | Alertes et avis du CERT-FR | ANSSI | `cert.cyber.gouv.fr`, `/alerte/feed/`, `/avis/feed/`, `/alerte/<référence>/json/`, `/avis/<référence>/json/` | Flux RSS et export JSON de chaque avis | Non lues à ce jour |
  | Alertes et vulnérabilités du CERT Santé | ANS | `cyberveille.esante.gouv.fr`, `/alertes-et-vulnerabilites/rss.xml`, `/alertes/<adresse de la publication>` | Flux RSS, puis la page de chaque publication (mentions structurées seulement) | Non lues à ce jour |
  | Enregistrements CVE (cve.org), sur le clic d'une personne seulement | Programme CVE (MITRE) | `cveawg.mitre.org`, `/api/cve/<identifiant CVE>` | API JSON (CVE JSON 5), une CVE inconnue de la veille à la fois | Non lues à ce jour |
  | Préavis des CVE (Cloudflare Radar), source facultative, désactivée au départ | Cloudflare | `radar.cloudflare.com`, `/zero-wire/cves/feed?format=json` | JSON Feed (jamais les « briefings ») | Non lues à ce jour |
  | Résumés des CVE (tldrcve), source facultative, désactivée au départ | tldrcve.com | `tldrcve.com`, `/feed.xml` | Flux RSS 2.0 | Non lues à ce jour |

- **Flux** : « Activer la veille » (carte « Veille des vulnérabilités », administrateur) ouvre le flux **Veille sur les vulnérabilités** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)) ; une fenêtre détaille les cinq destinations, le port et ce qui sort (l'adresse IP du serveur et des demandes de lecture : le catalogue KEV, une fenêtre de dates pour NVD, des identifiants CVE déjà publiés pour EPSS, les flux et avis des CERT, la page des publications du CERT Santé ; **aucune donnée de la plateforme**), à valider. Désactiver la veille, ou le module Vulnérabilités dans Administration, Modules, le referme ; tant qu'il est fermé, rien n'est inscrit ni réclamé et aucune source n'est jointe. Faites autoriser par l'équipe infrastructure la sortie TCP 443 du serveur vers les cinq hôtes (tableau de l'étape 0) ; les trois hôtes des compléments de la veille (lot CVE-INC, ci-dessous) ne servent qu'à la consultation d'une CVE inconnue et aux sources facultatives. L'ancienne adresse du CERT-FR (`www.cert.ssi.gouv.fr`) n'est pas utilisée : elle redirige, et aucune redirection n'est suivie.
- **Cadence** : chaque source est lue au plus une fois par période, réglée par source dans la colonne « Fréquence » de la carte « Veille des vulnérabilités » (droit `vulnerabilites:administrer`) : toutes les deux heures par défaut ; catalogue KEV, CERT-FR et CERT Santé de toutes les heures à une fois par jour ; NVD jamais plus d'une fois toutes les deux heures (demande de la source, garantie en base) ; EPSS une fois par jour, fixe, quand les autres collectes sont traitées. Une collecte manquée ou en échec (serveur ou exécutant arrêté) n'est pas rejouée avant la période suivante ; après une longue interruption, une seule collecte par source repart, sans rattrapage. NVD est lu par pages de 2 000 failles, cinq au plus (au-delà, la collecte est marquée incomplète), avec six secondes entre deux pages ; la fenêtre suivante part de la fin de la précédente réussie, sept jours au plus en arrière. « Collecter maintenant » (même carte, droit `vulnerabilites:administrer`) relance la lecture des sources de la veille, quatre fois par heure au plus ; il ne déclenche aucun connecteur (Tenable et AlgoLightHouse se synchronisent depuis la carte « Intégrations », étape 11.10). Une collecte non prise en charge dans les trente minutes expire.
- **Fiches du CERT Santé** ([ADR 0100](adr/0100-module-vulnerabilites.md), lot V4c) : après le flux, l'exécutant lit sur le même hôte la page de chaque publication **nouvelle ou dont le titre a changé** (« \| modifié le … ») qui cite une CVE, ou lue il y a plus de sept jours : 30 pages au plus par collecte, une seconde entre deux lectures, 512 Kio au plus par page, plus aucune lecture de page passé deux minutes et demie de collecte (le reste est repris à la collecte suivante). La page est lue sans rien exécuter ni suivre ; seules des mentions précises en sont gardées (faille activement exploitée, correctif, contournement, preuve de concept, score CVSS v3.1) ; une mention absente ou d'une forme imprévue vaut « non renseignée ». L'écran Veille donne le nombre de fiches lues et à lire. Le pare-feu ne change pas : même hôte, même port.
- **Volumes** : les éléments remontent à l'application par lots de 500 au plus, 40 lots par collecte ; chaque élément est validé et rangé sans doublon. Les textes des sources (en anglais pour la CISA et NVD) sont nettoyés de tout balisage, bornés et affichés comme texte simple.
- **Dictionnaire des produits (CPE)** ([ADR 0100](adr/0100-module-vulnerabilites.md), lot CPE-1) : aucune étape sur le
  serveur, aucun hôte de plus (même hôte que NVD, sous le même flux). Activée dans la carte « Veille des vulnérabilités »
  (droit `vulnerabilites:administrer`), la source charge par lots, à chaque passage de l'exécutant, la liste des produits du
  dictionnaire (environ 40 Mo dans la base et 3 Mo par sauvegarde ; une page par passage, premier chargement d'environ une heure), puis les
  nouveautés une fois par jour ; la copie complète facultative prend environ 270 Mo de plus dans la base et 17 Mo par
  sauvegarde, et lit les mêmes pages (environ une heure de plus si la liste est déjà chargée). Pendant la saisie d'un produit surveillé, les versions du produit choisi sont demandées à la NVD (la NVD voit
  alors l'éditeur et le produit choisis ; rien de tel avec la copie complète) ; le service `updater` intercale pour cela des
  passages courts de l'exécutant (étape 11.5). Rien n'est chargé ni demandé tant que la source est désactivée ou la veille
  inactive.
- **CVE inconnue de la veille et sources facultatives** ([ADR 0100](adr/0100-module-vulnerabilites.md), lot CVE-INC) :
  aucune étape sur le serveur ; **trois hôtes de plus** sous le même flux, à faire autoriser (TCP 443, tableau de l'étape 0)
  seulement pour s'en servir. La fiche d'une CVE que ni la veille ni aucune détection ne cite propose « Consulter cve.org et
  NVD » : sur ce clic, et seulement là, l'exécutant lit l'enregistrement de cette CVE chez cve.org (`cveawg.mitre.org`) et
  chez NVD (seul l'identifiant de la CVE sort ; une même CVE n'est pas redemandée avant 24 heures). Les passages courts du
  service `updater` (étape 11.5) servent aussi à cette demande. Les sources facultatives « Préavis des CVE (Cloudflare
  Radar) » (`radar.cloudflare.com`, toutes les 15 minutes par défaut) et « Résumés des CVE (tldrcve) » (`tldrcve.com`, une
  ou deux fois par jour) s'activent dans la carte « Veille des vulnérabilités » (droit `vulnerabilites:administrer`) ; elles sont lues sans
  aucun paramètre (le filtre par produit surveillé est fait sur le serveur). Si une intégration Tenable Security Center est
  active (étape 11.10), l'ouverture de la fiche d'une CVE inconnue cherche les contrôles Tenable qui la citent
  (`GET /rest/plugin`, lecture seule, sous le flux de l'intégration, aucune règle de pare-feu de plus).
- **Derrière le mandataire de l'établissement** : voir l'étape 11.12 ; la veille passe alors par lui.

### 11.12 Mandataire sortant (proxy) de l'établissement

Facultatif, et **aucune commande sur le serveur** ([ADR 0101](adr/0101-mandataire-sortant.md), lot P1). Si le serveur ne sort vers Internet que par le mandataire (proxy) de l'établissement, réglez-le dans l'application, sous **Administration, Configuration système, Mandataire sortant**, avec le droit `administration:administrer`. Inactif par défaut : sans réglage, les flux sortent directement, comme avant. Ne posez pas de variables `HTTPS_PROXY` à la main sur le serveur : la plateforme ne les lit pas pour ses flux, et le mot de passe y serait en clair.

- **Réglage** : adresse `http://hôte:port` (nom ou adresse IP, IPv6 entre crochets comme `http://[2001:db8::8]:3128`, adresses privées admises, **port obligatoire**), sans identifiant, chemin, paramètre ni fragment ; un mandataire en `https://` n'est pas pris en charge. Identifiant facultatif. **Mot de passe en écriture seule** : scellé par le coffre, jamais réaffiché ni journalisé ; l'écran dit seulement « défini » ou « non défini ». **Changer l'adresse ou l'identifiant efface le mot de passe** (action `systeme.mandataire.mot_de_passe_efface` au journal d'audit) : il faut le ressaisir. Chaque changement est inscrit au journal (`systeme.mandataire.*`), sans secret.
- **Chiffrement vérifié de bout en bout** : l'exécutant ouvre un tunnel (`CONNECT`) à travers le mandataire vers l'hôte de la source, puis négocie TLS jusqu'à elle ; le certificat et le nom de la source sont toujours vérifiés. L'identifiant et le mot de passe ne sont envoyés **qu'au mandataire** (en-tête `Proxy-Authorization`), jamais aux sources. Si le mandataire **inspecte le trafic chiffré**, il présente son propre certificat et lit ce qui passe : collez alors le certificat PEM de l'**autorité de certification de l'établissement**, obtenu d'une source sûre ; il est ajouté aux autorités du système pour les seules connexions qui passent par le mandataire. Il n'existe aucune option pour ne pas vérifier le certificat.
- **Flux concernés** (lots P1 et ALH1) : la **veille des vulnérabilités** (étape 11.11), la **veille réglementaire** (étape 11.14) et le connecteur **AlgoLightHouse** (étape 11.10) passent par le mandataire ; **Tenable Security Center** (interne, étape 11.10) et le **courriel** (SMTP, étape 11.8) restent en accès direct, par construction. L'**assistant**, les **mises à jour**, l'**antivirus** et le **certificat ACME** ne passent pas encore par le mandataire : derrière un mandataire, ils ne fonctionnent pas sans une sortie directe autorisée. L'écran du réglage les liste.
- **Pare-feu** : pour la veille et AlgoLightHouse, faites autoriser la **sortie du serveur vers le mandataire, sur le port réglé**, au lieu de la sortie TCP 443 vers les cinq sources et vers l'espace AlgoLightHouse ; le mandataire, lui, doit autoriser les cinq hôtes de l'étape 11.11 (et, pour s'en servir, `cveawg.mitre.org`, `radar.cloudflare.com` et `tldrcve.com`) et `<espace>.algolighthouse.fr` en `CONNECT` sur le port 443. Le résumé des flux (Configuration système, Flux vers l'extérieur) et la fenêtre de validation de la veille l'indiquent quand le mandataire est actif.
- **Messages d'erreur** (écran Veille et carte « Veille des vulnérabilités » ; pour AlgoLightHouse, état de la surface externe et carte « Intégrations » ; une ligne, sans secret) : mandataire sortant injoignable (nom introuvable, connexion refusée, délai dépassé ; l'écran ne donne ni le nom ni le port du mandataire, inscrits au seul journal d'audit de la collecte ou de l'exécution du connecteur), tunnel refusé (code du mandataire), authentification refusée (code 407), certificat de la source refusé (fournir l'autorité de l'établissement si le mandataire inspecte le trafic). Pendant une mise à jour, un échec d'AlgoLightHouse dû au mandataire peut rester « en cours » jusqu'à trente minutes avant d'être clos « Exécutant interrompu : aucun résultat reçu » (exécutant déjà à jour, application pas encore).
- **Limites** : **authentification simple seulement** (identifiant et mot de passe, `Basic`) : NTLM et Kerberos ne sont pas pris en charge ; ni fichier de configuration automatique (PAC), ni mandataire SOCKS ; un seul mandataire. Le **démon Docker de l'hôte** (téléchargement des images à l'installation, aux mises à jour et pour l'antivirus) ne passe pas par ce réglage : il se règle sur l'hôte, hors de la plateforme, selon la documentation de Docker (configuration du mandataire du service `docker` par systemd).

### 11.13 Conservation des sauvegardes et espace disque

Décisions du RSSI du 19/11/2026 ([ADR 0106](adr/0106-conservation-des-sauvegardes-et-espace-disque.md)). Tout se règle dans l'application, **Administration, Configuration système, Sauvegardes et restauration**, carte « Planification et conservation » (droit `administration:administrer`, chaque changement au journal d'audit) ; l'exécutant d'exploitation lit ces réglages à chaque sauvegarde et à chaque mise à jour depuis l'interface.

- **Sauvegardes régulières** (dossier de destination, étape 11.2) : une archive est supprimée, avec son fichier `.sha256`, dès qu'elle est plus ancienne que la **rétention** (90 jours par défaut) **ou** qu'elle n'est pas parmi les **N plus récentes** (« Nombre maximal de sauvegardes », de 7 à 365, **30 par défaut**). Les `BACKUP_GARDER_MIN` plus récentes (7 par défaut) restent toujours. La rotation a lieu à la fin de chaque sauvegarde réussie : **une baisse du nombre supprime les plus anciennes à la sauvegarde suivante**, externalisez d'abord celles à garder.
- **Sauvegardes d'avant mise à jour** : les **3 dernières** sont gardées par défaut (de 1 à 10). Ce nombre s'applique aux mises à jour lancées depuis une version qui le contient (c'est le script de la version installée qui fait la rotation).
- **Jamais supprimées** : les sauvegardes de sécurité des restaurations (`.restauration-securite/`), les archives d'anciennes versions (`.tar.enc`, `.tar`), les sous-dossiers, les liens et tout fichier d'un autre nom.
- **Scripts lancés directement** (cron de `scripts/backup.sh`, `scripts/mettre-a-jour.sh` en ligne de commande) : `BACKUP_GARDER_MAX` et `UPDATE_SAUVEGARDES_GARDEES` dans `.env` (ou dans l'environnement de la commande), mêmes bornes, mêmes valeurs par défaut (voir `.env.example`). Une valeur hors bornes fait échouer l'opération sans rien supprimer.

**Contrôle de la place avant d'agir.** Avant une sauvegarde (toutes les voies : interface, planification, cron, mise à jour, sauvegarde de sécurité d'une restauration) et avant une mise à jour (depuis l'interface, avant tout téléchargement ; en ligne de commande, avant la sauvegarde), la place nécessaire est estimée : taille de la dernière sauvegarde (à défaut, celle de la base), images à télécharger (d'après les manifestes du registre, à défaut 2 Gio), et une marge de 1 Gio ou 10 % si c'est plus ; la zone de travail de la sauvegarde doit en outre contenir deux fois la dernière sauvegarde. Si la place manque, l'opération est **refusée avant de commencer**, sans retour arrière ni modification, avec un message qui donne la place libre, la place nécessaire et l'occupation par les sauvegardes et par les images de l'application (historique des sauvegardes, page des mises à jour, rapport de `mettre-a-jour.sh`). Les images sont comptées sur le disque des sauvegardes (cas d'un disque unique) : si Docker est sur un autre disque, l'estimation est prudente.

**Alerte d'espace disque.** L'exécutant relève l'espace libre du disque des données (`DATA_DIR`) et l'occupation des sauvegardes et des images de l'application (au plus toutes les 5 minutes), sans publier aucun chemin ; la carte « Planification et conservation » les affiche. Sous **15 %** d'espace libre, chaque administrateur actif reçoit une alerte dans l'application (bandeau « Espace disque bas sur le serveur », lien vers les sauvegardes), **une fois par franchissement** : elle ne revient qu'après une remontée au-dessus de 20 % puis une nouvelle baisse. Chaque franchissement est inscrit au journal d'audit (`exploitation.espace_disque_bas`, `exploitation.espace_disque_retabli`).

**Images de l'application.** Après une mise à jour réussie, après un retour arrière et après une tentative échouée avant l'installation, seules restent les images `ghcr.io/yousername-ha/suivi-audits-{api,web,updater}` de la version en service, de la précédente et du frontal en service (`GATEWAY_VERSION`), qu'elles portent une étiquette de version ou seulement une empreinte (images épinglées, téléchargées par empreinte). Une image qui a une référence hors de ces trois dépôts, une image sans référence et une image utilisée par un conteneur ne sont jamais touchées ; il n'y a plus de `docker image prune` global.

#### Libérer de la place

À faire quand une sauvegarde ou une mise à jour est refusée faute de place, ou quand l'alerte d'espace disque apparaît. Dans l'ordre :

1. **Mesurer** : espace libre, occupation des sauvegardes et des images de l'application.

<!-- ci: instead: cd /opt/suivi-audits && df -h /srv/suivi-audits/donnees && sudo python3 ./scripts/images-application.py taille # dossier des sauvegardes déplacé par la recette (BACKUP_DEST, étape 11.2) -->
```bash
cd /opt/suivi-audits
df -h /srv/suivi-audits/donnees
sudo du -sh /srv/suivi-audits/donnees/sauvegardes
sudo python3 ./scripts/images-application.py taille
```
**Résultat attendu** : la taille et l'espace libre du disque, la place occupée par les sauvegardes, puis la place occupée par les images de l'application, en octets.

2. **Externaliser puis réduire les sauvegardes** : faire copier hors du serveur les archives à garder (étape 11.2, sans `cles-sauvegarde/`), puis baisser le « Nombre maximal de sauvegardes » ou la rétention dans la carte « Planification et conservation » ; la sauvegarde suivante supprime les plus anciennes. Pour supprimer à la main une archive déjà copiée, retirer **aussi** son fichier `.sha256` ; ne jamais supprimer `cles-sauvegarde/`.

<!-- ci: skip — suppression d'une archive choisie par l'exploitant, après copie hors du serveur -->
```bash
sudo ls -lht /srv/suivi-audits/donnees/sauvegardes /srv/suivi-audits/donnees/sauvegardes-updates/avant-mise-a-jour
sudo rm /srv/suivi-audits/donnees/sauvegardes/<archive>.tar.age /srv/suivi-audits/donnees/sauvegardes/<archive>.tar.age.sha256
```

3. **Sauvegardes de sécurité des restaurations** (`sauvegardes/.restauration-securite/<identifiant>/`) : jamais supprimées automatiquement ; après revue de la restauration correspondante et copie hors du serveur, l'exploitant peut retirer le dossier de l'identifiant concerné.

4. **Images de l'application** : voir ce que le ménage retirerait (simulation, rien n'est supprimé), puis l'appliquer. La version en service et le frontal en service sont lus dans `.env`.

<!-- ci: run -->
```bash
cd /opt/suivi-audits
version=$(sudo sed -n 's/^APP_VERSION=//p' .env | tail -n 1)
frontal=$(sudo sed -n 's/^GATEWAY_VERSION=//p' .env | tail -n 1)
sudo python3 ./scripts/images-application.py menage --en-service "$version" --frontal "${frontal:-$version}" --env .env --simulation
```
**Résultat attendu** : une ligne « À retirer : … » par référence d'image qui serait retirée, ou aucune ligne. Pour appliquer, relancer la même commande **sans** `--simulation` (option `--precedente <version>` pour garder une version précédente précise). Les autres images du serveur relèvent de l'équipe infrastructure.

5. Si cela ne suffit pas : agrandir le disque des données, ou ranger les sauvegardes sur un disque dédié (`BACKUP_DEST`, étape 11.2).

### 11.14 Veille réglementaire (CNIL, CEPD, EUR-Lex, ANSSI, CERT Santé, Journal officiel)

Aucune étape d'installation supplémentaire ([ADR 0110](adr/0110-veille-reglementaire.md)) : la veille se suit dans l'application, sous **Conformité et audits, Veille réglementaire**, avec le droit `veille_reglementaire:lire`. Comme pour la veille des vulnérabilités (étape 11.11), le conteneur de l'API n'a aucun accès réseau sortant : l'exécutant d'exploitation (étape 11.6) lit les flux, par le même script isolé (`scripts/veille-vulnerabilites.py`).

- **Sources, en liste fermée écrite dans le code**, toutes lues en `GET`, en HTTPS, certificat toujours vérifié, sans suivre aucune redirection ; un seul flux RSS par source, à son adresse exacte (le Journal officiel : la page d'index du dossier, puis ses archives quotidiennes) :

  | Source | Hôte et chemin | Ce qui est gardé | Domaine (qui qualifie) |
  |---|---|---|---|
  | Actualités de la CNIL | `www.cnil.fr`, `/fr/rss.xml` | Titre, date, lien, résumé du flux tel quel (licence CC BY-ND, source citée) | Données personnelles (DPO) |
  | Publications du CEPD | `www.edpb.europa.eu`, `/feed/publications_en` | Titre, date, lien, résumé du flux tel quel | Données personnelles (DPO) |
  | Flux EUR-Lex | `eur-lex.europa.eu`, `/EN/display-feed.rss?rssId=222` | Seuls les actes dont le titre contient un mot-clé du filtre : titre, date, lien, résumé du flux tel quel | Celui du mot-clé trouvé |
  | Actualités de l'ANSSI | `cyber.gouv.fr`, `/actualites/rss/` | Titre, date et lien seulement | Sécurité (RSSI) |
  | Actualités du CERT Santé | `cyberveille.esante.gouv.fr`, `/actualites/rss.xml` | Titre, date et lien seulement (aucune condition de réutilisation publiée) | Sécurité (RSSI) |
  | Actualités de l'ANS | aucun | Non disponible : aucun flux public connu | — |
  | Journal officiel (Légifrance) | `echanges.dila.gouv.fr`, `/OPENDATA/JORF/` puis les archives `JORF_<date>-<heure>.tar.gz` | Seuls les textes dont le titre contient un mot-clé du filtre du Journal officiel : titre, date de publication, lien vers la page du texte sur `www.legifrance.gouv.fr` ; jamais le texte intégral | Celui du mot-clé trouvé |

- **Flux** : « Activer la veille réglementaire » (administrateur) ouvre le flux **Veille réglementaire** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)) après validation ; ce qui sort : l'adresse IP du serveur et la demande de lecture de chaque flux, **aucune donnée de la plateforme**. Faites autoriser la sortie TCP 443 du serveur vers les six hôtes (tableau de l'étape 0) ; `cyberveille.esante.gouv.fr` l'est peut-être déjà pour la veille des vulnérabilités, `echanges.dila.gouv.fr` est nouveau (lot VR-2). `www.legifrance.gouv.fr` n'est jamais joint par le serveur : seul le navigateur de la personne qui suit un lien l'ouvre. Désactiver le module Veille réglementaire dans Administration, Modules referme le flux.
- **Sources activées une à une** : après l'ouverture du flux, chaque source reste **désactivée** tant qu'une personne qui administre le module (`veille_reglementaire:administrer`) ne l'active pas dans le tableau des sources ; sa fréquence se règle au même endroit (toutes les 4 ou 12 heures, une fois par jour par défaut, ou une fois par semaine). « Collecter maintenant » relance les sources activées. Une source sans réussite depuis trois périodes est signalée en retard.
- **Filtre d'EUR-Lex** : le flux publie tous les actes du Journal officiel de l'Union (série L), une centaine par lecture. Seuls ceux dont le titre contient un mot de la liste « Filtre d'EUR-Lex » sont gardés (majuscules et accents ignorés, mot entier) ; les autres sont seulement comptés dans le bilan de la collecte. Chaque mot porte son domaine, qui devient celui de l'acte ; si des mots des deux domaines sont trouvés, l'acte va aux données personnelles. Liste par défaut en français et en anglais (données personnelles, protection des données, cybersécurité, sécurité des réseaux, données de santé, dispositifs médicaux, intelligence artificielle, identité numérique, résilience…) ; elle se règle dans l'écran (`veille_reglementaire:administrer`, 1 à 60 mots de 2 à 60 caractères) et peut être rétablie ; chaque réglage est inscrit au journal d'audit.
- **Journal officiel (données ouvertes de la DILA, sans compte)** : à chaque collecte, l'exécutant lit la page d'index du dossier des données ouvertes du JORF, puis les archives quotidiennes publiées depuis la veille de la dernière collecte réussie (sept jours la première fois ; dix archives au plus, les plus récentes). Chaque archive est lue en mémoire, jamais écrite sur le disque : 32 Mio au plus (une archive plus grosse n'est pas lue et la collecte est signalée incomplète), 512 Mio une fois décompressée, 200 000 fichiers ; seul l'en-tête de chaque texte est lu. Liste de mots-clés propre au Journal officiel, en français (carte « Filtre du Journal officiel », même réglage que celui d'EUR-Lex ; par défaut : données à caractère personnel, protection des données, informatique et libertés, données de santé, cybersécurité, sécurité des systèmes d'information, identité numérique, intelligence artificielle, importance vitale, résilience…). Un titre de plus de 300 caractères est abrégé et se termine par « … » (données ouvertes sous Licence Ouverte). La forme des archives n'a pas encore été relevée sur le service réel : si elle diffère de celle attendue, la collecte échoue avec une explication dans le tableau des sources, sans rien ranger.
- **API Légifrance (plateforme PISTE)** : pas encore prise en charge (lot à part, plus tard : décision du RSSI du 23/11/2026, après la création d'un compte et un essai réel de la clé). Aucun compte PISTE n'est à créer et aucune clé n'est à saisir pour cette version ; `oauth.piste.gouv.fr` et `api.piste.gouv.fr` ne sont pas des destinations de la plateforme.
- **Qualification** : le rôle **RSSI** qualifie les publications du domaine sécurité ; le droit spécial **« DPO »** (`veille_reglementaire:dpo`) celles du domaine données personnelles. Il se coche dans un rôle personnalisé (Administration, Rôles, table « Droits réservés »), s'ajoute à n'importe quel profil et ouvre à lui seul la lecture de la veille réglementaire ; aucun rôle ne l'a d'office, pas même Administrateur ou RSSI. Avant le lot 3 de la refonte des droits, un RSSI qui doit qualifier les données personnelles reçoit le droit DPO par un rôle personnalisé. Désactiver le module retire ce droit.
- **Bornes** : 200 publications au plus par flux et par collecte, réponse de 2 Mio au plus (Journal officiel : voir plus haut) ; titre (300 caractères) et résumé (1 000) des flux RSS jamais tronqués : un titre trop long fait écarter la publication, un résumé trop long n'est pas gardé. Un lien qui ne pointe pas en https vers l'hôte de la source fait écarter la publication. Les textes sont débarrassés de tout balisage et affichés comme texte simple.
- **Derrière le mandataire de l'établissement** : voir l'étape 11.12 ; la veille réglementaire passe alors par lui.

## 12. Mettre à jour

### Configuration de l’environnement (retirée)

Retirées par la migration `037_retrait_environnement.sql` (décision du 25/10/2026, [ADR 0046](adr/0046-retrait-du-catalogue-environnement.md)) : les échelles et matrices se publient dans Configuration GRC. La sauvegarde automatique de la mise à jour précède la suppression.

### Modules CRRC et Investissements (retirés)

Retirés par la migration `053_retrait_crrc_investissements.sql` (décision du 11/11/2026, [ADR 0084](adr/0084-retrait-des-modules-crrc-et-investissements.md)) : les établissements, ressources, sauvegardes, restaurations, alertes et offres du module CRRC et le plan d’investissement (rubrique Budget) disparaissent, avec leurs droits. **Suppression définitive des données** : la sauvegarde automatique de la mise à jour précède la migration et reste le seul retour arrière. Si ces données doivent être conservées, les exporter avant la mise à jour (Exports Excel de la version précédente) ; la version qui retire ces modules n’en propose plus d’export. Un fichier de l’outil historique qui contient les clés `crrc` ou `invest` reste importable : ces clés sont écartées sans rien dire.

### Module Revues des accès (retiré)

Retiré par la migration `054_retrait_revues_acces.sql` (décision du 11/11/2026, [ADR 0087](adr/0087-retrait-du-module-revues-des-acces.md)) : le registre des revues d’accès des applications (page Pilotage → Organisation) disparaît avec ses données. Elles se suivent par une **tâche récurrente** du Pilotage. **Suppression définitive des données** : la sauvegarde automatique de la mise à jour précède la migration et reste le seul retour arrière ; pour garder une trace, exporter la rubrique Excel des revues avant la mise à jour. L’export de la revue des accès **des comptes** (Administration, onglet Utilisateurs) est inchangé.

### Module Applications à intégrer, GAP (retiré)

Retiré par la migration `058_retrait_gap_applications.sql` (décision du 12/11/2026, [ADR 0089](adr/0089-simplification-du-menu-conformite.md), lot 2) : le registre des applications à intégrer au périmètre (analyse d’écart GAP) disparaît avec ses données, ainsi que les applications de la cartographie, retirées des cartes enregistrées. **Suppression définitive des données** : la sauvegarde automatique de la mise à jour précède la migration et reste le seul retour arrière ; pour garder une trace, exporter la rubrique Excel « GAP — Applications » avant la mise à jour. Un fichier de l’outil historique qui contient la clé `appGaps` reste importable : cette clé est écartée sans rien dire.

### Correspondances entre référentiels et rapprochements (retirés)

Retirés par la migration `059_retrait_correspondances_rapprochements.sql` (décision du 12/11/2026, [ADR 0089](adr/0089-simplification-du-menu-conformite.md), lot 3) : les correspondances entre exigences de référentiels différents, leur historique et les propositions de rapprochement (« relier aussi la mesure à l’exigence correspondante ») disparaissent avec leurs données, ainsi que les rappels et les réglages de notification « Rapprochements à valider ». **Suppression définitive des données** : la sauvegarde automatique de la mise à jour précède la migration et reste le seul retour arrière. Les référentiels, les liens faits à la main entre une mesure et une exigence et la couverture par exigence de la Bibliothèque de référentiels sont conservés. Le kit IA continue d’importer ses contrôles et ses annexes de veille, mais plus ses correspondances vers l’ISO/IEC 27001 et l’HDS. Les fiches « correspondance » déjà importées avec un référentiel restent dans l’historique des objets, sans plus aucun affichage.

### Mise à jour depuis l’application

L’installation Compose normale démarre désormais `gateway` (frontal HTTPS stable), `web` (interface interne), `app`, `db`, `init` et `updater` (exécutant privilégié). Aucun cron ni fichier de configuration supplémentaire n’est nécessaire pour la mise à jour intégrée. Une installation existante reçoit ces services lors de sa première mise à niveau vers une version qui les contient ; la procédure serveur ci-dessous reste disponible pour ce premier passage et pour le dépannage.

Chaque utilisateur connecté voit un bandeau fin dès qu’une nouvelle version numérotée est disponible : version installée, version disponible, lien vers les nouveautés. Le contrôle est automatique au démarrage puis toutes les six heures, **seulement si le flux « Mises à jour de la plateforme » est ouvert** (voir plus bas). **Aucun identifiant n’est monté par défaut dans l’exécutant** ([ADR 0061](adr/0061-mise-a-jour-web-renforcee.md)) : le dépôt public est lu en HTTPS et les images publiques sans connexion. Pour un dépôt ou un registre privé, ajouter dans `.env` `UPDATER_SSH_DIR=/root/.ssh` (clé de déploiement en lecture seule déclarée sur le dépôt) et/ou `UPDATER_DOCKER_CONFIG=/root/.docker` (jeton de lecture `read:packages`, après `sudo docker login ghcr.io`) : ils sont alors montés **en lecture seule**. Lors de la mise à jour vers cette version, une installation qui dépend encore d’une connexion au registre `ghcr.io` ou d’une clé de déploiement (dépôt non lisible en HTTPS) les conserve automatiquement ; le script l’annonce. Les retirer de `.env` dès qu’ils ne servent plus. L’API GitHub publique est essayée en premier et accepte les publications stables uniquement. Le repli sur les étiquettes git n’a lieu que si le déploiement est **déclaré privé** (`UPDATER_SSH_DIR` dans `.env`) et que l’API répond « refusé » ou « absent » (401/404) : une limite de débit (403/429) ou un dépôt public injoignable est une erreur de vérification, signalée comme telle. Dans ce cas, les étiquettes numériques et la présence des trois artefacts sont contrôlées par la clé de déploiement et le registre. **Le canal est lié à la révision signée** : le fichier `.github/publication.json` de cette révision doit porter la version cible et le canal `stable` ; sinon l’installation est refusée (« Canal de publication non autorisé »), par le menu comme par `sudo ./scripts/mettre-a-jour.sh` (cible par défaut ou explicite). Une préversion du canal `development` (section 12.0) ne s’installe que si le serveur le demande explicitement en ajoutant `UPDATE_CHANNEL=development` dans `.env` ; les suffixes `-beta`/`-dev` restent refusés. Une panne réseau conserve la dernière information connue et est signalée, sans prétendre que le serveur est à jour.

Dans **Configuration système → Mises à jour et versions**, un compte ayant le **rôle système Administrateur** peut vérifier manuellement puis confirmer en tapant **METTRE À JOUR** et en saisissant un **code de double authentification** (6 chiffres, à usage unique, demandé à chaque installation ; cinq essais par quart d’heure, chaque refus est journalisé). Une permission personnalisée `administration:administrer` seule ne suffit pas.

**Flux « Mises à jour de la plateforme »** ([ADR 0097](adr/0097-flux-sortants-pilotes-par-les-modules.md)) : fermé par défaut sur une installation neuve. Depuis la 7.2.1, un serveur où une mise à jour a déjà été installée (reçu d'installation ou rapport réussi de `scripts/mettre-a-jour.sh`) le garde ouvert tant qu'aucun administrateur n'en a décidé autrement (reprise de l'existant, `reprise-mise-a-jour` au journal). Un administrateur l'ouvre dans cette même carte, « Activer les mises à jour depuis l'interface », après validation explicite des destinations (GitHub, `ghcr.io` et Sigstore, TCP 443) ; « Désactiver » le referme. Tant qu'il est fermé, la vérification et l'installation sont refusées par l'API et aucune demande n'est remise à l'exécutant (une demande restée en file est close et journalisée) ; l'exécutant lui-même n'émet rien : ni contrôle automatique toutes les six heures, ni `git fetch`, ni téléchargement d'image, ni vérification Sigstore. Rouvert, il vérifie les publications à son passage suivant. Si l'exécutant ne peut pas lire l'état voulu (application arrêtée, redémarrage), il se comporte comme si le flux était fermé. Ouvrir le flux dans l'application ne règle pas le pare-feu : si « Vérifier les mises à jour » annonce que le serveur n'a pas pu joindre GitHub, faire autoriser par l'équipe infrastructure les sorties indiquées dans Flux vers l'extérieur (`github.com`, `api.github.com`, `ghcr.io`, `pkg-containers.githubusercontent.com`, `tuf-repo-cdn.sigstore.dev`, `rekor.sigstore.dev`, TCP 443).

**Fenêtre de maintenance** (Paramètres → Sécurité) : jours autorisés et créneau en heure de Paris, désactivée par défaut. Active, elle fait refuser l’installation hors créneau, à la demande comme à sa prise en charge par l’exécutant (refus journalisé) ; la vérification des nouvelles versions reste possible. Un créneau dont la fin précède le début passe minuit. Enregistrer les modifications en cours avant confirmation. Les demandes sont auditées et idempotentes ; une seule peut être active. Le serveur revalide le rôle avant exécution.

L’exécutant télécharge et vérifie les signatures cosign des images API, web et updater, avec l’identité exacte du workflow/tag, ainsi que leur **attestation SBOM** signée par la même identité ([ADR 0063](adr/0063-chaine-de-publication-durcie.md)) : une image sans attestation est refusée. Le SBOM vérifié de chaque composant est conservé dans `DATA_DIR/etat/sbom/<version>` et se télécharge depuis les reçus de mise à jour. Le commit des sources doit correspondre au label de révision des images signées ; les images appliquées sont épinglées par empreinte. Pendant cette préparation, le service reste disponible. Ensuite la maintenance bloque les écritures, attend la fin des mutations déjà engagées, crée une sauvegarde chiffrée et effectue migrations/redémarrage/contrôles de santé et de données. Le frontal sert indépendamment `/update/` et un état public minimal : les utilisateurs et nouvelles connexions conservent la page pendant l’arrêt de l’API, de l’interface et de l’exécutant. Les étapes affichées sont réelles et horodatées, avec la durée écoulée ; aucun pourcentage n’est inventé. L’illustration centrale suit l’étape publiée (préparation, sauvegarde, installation, vérification, retour arrière, résultat) sans mesurer l’avancement, sauf pendant le téléchargement des images ([ADR 0104](adr/0104-progression-reelle-du-telechargement.md)) : l’exécutant les tire alors par l’API du moteur Docker (socket déjà monté) et publie les octets reçus sur le total, fixé avant le début d’après les manifestes du registre ; la barre de transfert se remplit d’autant, avec le pourcentage et les tailles en Mo (par exemple « 62 % · 180 / 290 Mo »), lus aussi par les technologies d’assistance. Une fois les images reçues, la barre reste pleine (« 100 % · 290 / 290 Mo ») avec la mention « Téléchargement terminé — vérification des signatures » et un petit sceau animé, jusqu’à la fin de l’étape de préparation (addendum du 19/11/2026). Les couches déjà présentes sur le serveur ne sont connues qu’au début de leur téléchargement : elles comptent comme reçues, et la barre peut partir au-dessus de zéro. Avec des identifiants de registre (`UPDATER_DOCKER_CONFIG`), ou si l’API du moteur ne répond pas avant d’avoir rien servi, l’exécutant télécharge par `docker pull` comme avant, et la barre garde son animation sans chiffre. Une erreur pendant le téléchargement l’arrête, sans nouvel essai, avant toute vérification. Cette progression n’apparaît qu’à partir des mises à jour lancées depuis une version qui la contient (exécutant de la version installée, page du frontal en service) ; la page reste en thème sombre et ses animations tournent en continu, sans bouton, sauf quand le poste demande moins d’animations. Le journal technique n’est pas affiché sur cette page (décision du RSSI) : sa zone l’indique ; le diagnostic reste dans le reçu et dans les journaux privés de `DATA_DIR/reprise-updates`. La page est servie par le frontal : sa présentation suit l’image `GATEWAY_VERSION` (voir les limites d’exploitation ci-dessous). À la fin, un **reçu** structuré (versions, étapes, empreintes et signature des images vérifiées, sauvegarde et son empreinte, contrôles des données avant et après) est déposé dans `DATA_DIR/etat/recus-mises-a-jour` et se télécharge depuis Configuration système → Mises à jour et versions ; il ne contient aucune sortie brute de commande et n’est pas servi par le frontal public. Le retour à l’application est automatique après santé confirmée. Un échec avec retour arrière est clairement affiché, avec accès au résultat ; une intervention requise maintient la protection.

`init` crée exclusivement les secrets manquants. Les sauvegardes de mise à jour utilisent les clés age de l'étape 6.8 (`DATA_DIR/cles-sauvegarde`, root, 0600, hors montage API). Les archives chiffrées sont dans `DATA_DIR/sauvegardes-updates/avant-mise-a-jour`, les trois dernières sont conservées par défaut (réglage « Sauvegardes d’avant mise à jour gardées », 1 à 10, étape 11.13) ; les journaux/reçus privés dans `DATA_DIR/reprise-updates` (root, 0700), avec la zone de travail de la sauvegarde de sécurité (`tmp/`, vidée au début et à la fin de chaque mise à jour, sur le disque des données), l’état public dans `DATA_DIR/etat/updates`. Inclure ces dossiers dans la sauvegarde externalisée du serveur, sans `cles-sauvegarde/` (étape 6.6), et conserver la clé de secours (privée) dans le coffre-fort pour restaurer après perte du serveur. Ne jamais exposer le socket Docker, le projet en écriture ou ces clés à l’API.

L’exécutant se remplace lui-même à la fin d’une mise à jour ; son successeur termine les contrôles depuis le reçu durable. Après une interruption pendant remplacement, il tente le retour sécurisé depuis la sauvegarde précédente. Une reprise échouée reste bloquée et conserve les références privées pour l’exploitant : examiner le journal, le rapport et la sauvegarde avant toute restauration manuelle. Ne pas supprimer le marqueur de maintenance tant que la santé et les données ne sont pas validées.

**Limites d’exploitation** : Internet/GitHub/GHCR/Sigstore sont nécessaires depuis l’exécutant uniquement. Les accès privés du guide doivent être renouvelés à leur expiration. Le frontal stable reste à la version `GATEWAY_VERSION` pendant toute l’opération : il ne doit pas être recréé au milieu. À la toute fin, il n’est mis à jour que si son contenu a changé (paragraphe suivant) ; la procédure serveur ci-dessous le met également à jour. Les applications/API/interfaces et l’exécutant évoluent depuis le web, le frontal aussi quand son contenu change. L’indisponibilité des données pendant sauvegarde/migration dépend de leur volume ; la maintenance n’assure pas la disponibilité en cas de panne de l’hôte, du stockage ou du frontal lui-même. Les proxy/TLS externes restent gérés par l’infrastructure.

**Frontal mis à jour à la demande** (décision du RSSI du 17/11/2026, [ADR 0103](adr/0103-frontal-mis-a-jour-a-la-demande.md), qui remplace l’exception ponctuelle de la 7.2.2) : chaque image `web` contient, dans `/etc/suivi-frontal.sha256`, une empreinte du contenu de tout ce que le frontal exécute ou sert (Caddy, ses configurations, `demarrer-gateway`, la page de maintenance avec son thème et ses polices, busybox, le magasin des autorités de certification racines) et de l’identité épinglée de son image de base Caddy (`CADDY_IMAGE`, addendum du 19/11/2026) : le frontal est donc mis à jour aussi pour un correctif ou une mise à jour de sécurité de son image de base, chaque fois que c’est nécessaire. À la toute fin d’une mise à jour depuis l’application, après la santé et le contrôle des données de la nouvelle version, maintenance encore active, l’exécutant compare l’empreinte du frontal en service à celle de l’image `web` signée et épinglée de la cible. Identiques : le frontal n’est pas touché, sans coupure. Différentes, ou frontal sans empreinte (image antérieure) : la configuration du frontal est validée avec la nouvelle image dans un conteneur éphémère (`demarrer-gateway --valider`), puis `GATEWAY_VERSION` passe à la version cible et le frontal est recréé avec les mêmes `.env` et volumes, donc le même mode de certificat (ACME, fourni ou interne) ; il doit répondre en HTTPS avec **le même certificat** qu’avant. La page de suivi annonce ce redémarrage dans un encadré, perd la connexion quelques secondes, puis reprend et ramène à l’application ; si elle ne revient pas après une minute, la recharger. L’encadré n’apparaît qu’à partir des mises à jour lancées depuis une version qui le contient : la page affichée est celle du frontal en service. En cas d’échec, ou si l’empreinte de la nouvelle image ne peut pas être lue, l’ancien frontal reste ou est rétabli et l’application reste mise à jour : le message de fin, le reçu et le journal privé indiquent « Frontal non mis à jour » ; si le message demande de relancer le frontal, exécuter `sudo docker compose up -d gateway` dans le dossier de l’application. Empreinte du frontal en service, dans le dossier de l’application : `sudo docker compose exec -T gateway cat /etc/suivi-frontal.sha256` (absente avant cette règle). La première mise à jour vers une version dont l’empreinte couvre l’image de base recrée le frontal une fois, même sans autre changement. Seule l’image du frontal en service est gardée par le ménage des images (étape 11.13) ; une ancienne image de frontal n’est jamais conservée pour elle-même.


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

Si des images épinglées par `API_IMAGE`/`WEB_IMAGE`/`UPDATER_IMAGE` sont présentes dans `.env`, les conserver pour une version publiée ; pour une construction locale, suivre plutôt la construction de branche de l'étape 5 et retirer ces trois références. `GATEWAY_VERSION` conserve le frontal existant. Si `Vérifier` échoue, contrôler les flux sortants de l'étape 0 et l'état des services ; ne pas désactiver les signatures.

### 12.1 Procédure serveur de mise à jour et d’entretien du frontal

À faire quand une nouvelle version est annoncée (bandeau « Nouvelle version disponible » dans l'application, ou page **Releases** du dépôt), de préférence en dehors des heures d'utilisation. Pour le premier passage, le dépannage ou l’entretien du frontal, utiliser **un seul script**, `scripts/mettre-a-jour.sh`, qui :
1. contrôle le serveur (droits, Docker, `.env`, dossier des données, espace disque) ;
2. affiche la version en service, la version cible et ses **notes de mise à jour** (actions particulières, évolutions de la base, durée estimée), puis demande confirmation ;
3. refuse de revenir à une version plus ancienne ;
4. contrôle la place pour la sauvegarde et les images (étape 11.13), puis fait une **sauvegarde chiffrée** (obligatoire) dans `/srv/sauvegardes/suivi-audits/avant-mise-a-jour/` et contrôle son empreinte ; les `UPDATE_SAUVEGARDES_GARDEES` dernières sont gardées (3 par défaut, de 1 à 10, dans `.env`) ;
5. passe le dépôt à la nouvelle version, télécharge les images et **vérifie leur signature** (cosign, installé ci-dessous) ;
6. redémarre l'application ; les évolutions de la base s'appliquent au démarrage, une par une ;
7. attend que l'application soit en bon état, relit chaque document chiffré, puis écrit un rapport (onglet **Système** de l'administration, et journal d'audit) ;
8. **en cas d'échec**, revient tout seul à la version précédente ; si la base avait déjà évolué, il restaure la sauvegarde du point 4 (après votre accord) ;
9. après une réussite comme après un retour arrière, ne garde que les images de l'application de la version en service, de la précédente et du frontal en service (`GATEWAY_VERSION`), étiquetées ou non ; les autres images du serveur ne sont pas touchées.

**0. Installer cosign** (une fois), l'outil qui vérifie que les images viennent bien de la chaîne de publication du dépôt (signature) et n'ont pas été modifiées. La mise à jour depuis l'application n'en a pas besoin : l'exécutant d'exploitation contient déjà cosign. La commande télécharge cosign et contrôle son empreinte avant de l'installer :

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
**Résultat attendu** : les mêmes états qu'à l'étape 7.1. Dans l'application, **Administration**, onglet **Système** : la nouvelle version, et la mise à jour dans l'historique avec le résultat « Réussie ».

> **Première mise à jour avec le script.** Si la version en service ne contient pas encore `scripts/mettre-a-jour.sh` (message `No such file or directory`), lancez-le directement depuis la nouvelle version, en remplaçant `<version>` par son numéro (sans le « v ») :
> ```text
> sudo git fetch --tags && sudo git show v<version>:scripts/mettre-a-jour.sh | sudo bash -s -- <version>
> ```
> Si la version en service gardait ses données dans des volumes Docker, le script les copie au passage dans le dossier des données (étape 12.5).

#### Vérifier l'authenticité des images avant une première installation (facultatif) et réglages GitHub à contrôler

**Installation neuve.** L'installateur ([ADR 0077](adr/0077-installation-sans-ligne-de-commande.md)) tire les images par leur étiquette de version et ne vérifie pas leur signature : il est volontairement simple, et la vérification cosign reste facultative à ce stade. Les mises à jour, elles, vérifient toujours signature, attestation SBOM, révision et canal, puis épinglent l'empreinte. Pour vérifier une installation neuve avant de la démarrer, après le téléchargement des images (cosign installé, point 0 ci-dessus) :

```text
docker image inspect --format '{{json .RepoDigests}}' ghcr.io/yousername-ha/suivi-audits-api:<version>
cosign verify ghcr.io/yousername-ha/suivi-audits-api@sha256:<empreinte> --certificate-identity https://github.com/yousername-ha/suivi-audits/.github/workflows/release.yml@refs/tags/v<version> --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

À répéter pour `suivi-audits-web` et `suivi-audits-updater`. Une image non signée par ce workflow, pour cette étiquette, est refusée : ne pas démarrer l'installation. Risque résiduel assumé : tant que cette vérification n'est pas faite, le contenu d'une installation neuve repose sur l'intégrité des étiquettes du registre.

**Réglages GitHub à contrôler par le propriétaire du dépôt** (la signature prouve le workflow et l'étiquette, pas qui a approuvé la publication) : (1) *Settings, Rules, Rulesets* : qui peut créer des étiquettes `v*` et la liste complète des contournements ; (2) *Settings, Environments, publication* : relecteurs requis (le RSSI seul) et qui peut modifier l'environnement ; (3) collaborateurs ou équipes en droit *admin* ou *maintain*, applications GitHub avec `contents:write`, clés de déploiement en écriture ; (4) *Packages* `suivi-audits-api`, `-web`, `-updater` : dépôts et personnes autorisés en écriture, immutabilité des étiquettes si l'option existe ; (5) aucun jeton personnel avec `packages:write` en dehors du workflow de publication. Toute personne pouvant créer une étiquette `v*` sans être le relecteur unique de l'environnement `publication` est un écart à corriger.

### 12.2 Revenir à une version précédente

Le script revient en arrière tout seul en cas d'échec. Pour revenir plus tard à une version précédente (problème découvert après coup), il faut **restaurer la sauvegarde faite avant la mise à jour** : les évolutions de la base ne s'annulent pas. Les données saisies depuis la mise à jour seront perdues : exportez-les ou notez-les avant.
1. Repérez la sauvegarde : `sudo ls -1t /srv/sauvegardes/suivi-audits/avant-mise-a-jour/` (son nom contient les deux versions).
2. Revenez à l'ancienne version du dépôt : `sudo git checkout v<ancienne_version>`, puis remettez son numéro dans `APP_VERSION` (`sudo nano .env`).
3. Restaurez la sauvegarde (étape 11.4) avec ce fichier.

### 12.3 Mettre à jour le système

Une fois par mois, et dès qu'une faille importante est annoncée :

**Debian ou Ubuntu :**

<!-- ci: instead: sudo apt-get update -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
sudo apt update && sudo apt full-upgrade -y
```
**Résultat attendu** : aucune ligne `E:`. Docker est mis à jour par la même occasion.

**Rocky Linux 10 :**

<!-- ci: rocky-instead: sudo dnf makecache -->
```bash
sudo dnf upgrade -y
```
**Résultat attendu** : aucune ligne `Error`. Docker est mis à jour par la même occasion.

<!-- ci: run -->
<!-- ci: rocky-skip — Debian et Ubuntu seulement -->
```bash
[ -f /var/run/reboot-required ] && echo "Redémarrage nécessaire" || echo "Pas de redémarrage nécessaire"
```
**Résultat attendu** : l'un des deux messages. Si un redémarrage est nécessaire, prévenez les utilisateurs, puis lancez `sudo reboot`. L'application redémarre toute seule avec le serveur. Reconnectez-vous au bout de 2 minutes et vérifiez les états (étape 7.1).

**Rocky Linux 10 :**

<!-- ci: rocky-run -->
```bash
sudo dnf needs-restarting -r && echo "Pas de redémarrage nécessaire" || echo "Redémarrage nécessaire"
```
**Résultat attendu** : l'un des deux messages ; même conduite à tenir que ci-dessus.

### 12.4 Passer d'un serveur v2 à cette version

La v2 construisait l'application sur le serveur, avec un service `proxy`, et gardait ses données dans des volumes Docker. La base, les secrets et les certificats sont **conservés** : rien n'est à réimporter.
1. Faites une sauvegarde (étape 11.2), et installez cosign (étape 12.1, point 0).
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
**Résultat attendu** : les états de l'étape 7.1.

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
| `required variable SITE_ADDRESS is missing a value: Renseigner SITE_ADDRESS dans .env` | `SITE_ADDRESS` vide, ou fichier `.env` absent | `sudo ./installer.sh` (étape 5) crée `.env` |
| `Renseigner APP_VERSION dans .env` | Ligne `APP_VERSION=` absente (serveur v2) | Étape 12.4 |
| `init` affiche `ERREUR (dossier des données) : … n'a pas été préparé` | Dossier des données jamais préparé, ou données encore dans des volumes Docker | Nouvelle installation : `sudo ./installer.sh` (étape 5). Serveur déjà installé : étape 12.5 |
| `ERREUR (dossier des données) : DATA_DIR … est dans le dossier de l'application` (ou dans un dossier système, ou « non persistant ») | `DATA_DIR` mal choisi dans `.env` | Choisir un dossier dédié, par exemple `/srv/suivi-audits/donnees`, puis étape 6.7 |
| `mettre-a-jour.sh` : `cosign est nécessaire` | cosign non installé | Étape 12.1, point 0 |
| `mettre-a-jour.sh` : `signature de l'image … invalide ou absente` | Image modifiée, ou flux vers `rekor.sigstore.dev` bloqué | Ne pas forcer : vérifier les flux de l'étape 0, puis prévenir l'équipe projet. La version précédente reste en service |
| `mettre-a-jour.sh` : `espace disque insuffisant` (ou « Mise à jour refusée avant de commencer » dans l'application) | Moins de deux fois la taille de la base, plus 2 Go, de libre ; ou pas assez de place pour la sauvegarde de sécurité et les images (étape 11.13) | Rien n'a été modifié. Étape 11.13, « Libérer de la place », puis relancer |
| Sauvegarde en échec : `Espace disque insuffisant pour la sauvegarde` ou `Espace de travail insuffisant` | Pas assez de place pour la nouvelle archive et sa marge (étape 11.13) | Rien n'a été modifié. Étape 11.13, « Libérer de la place » |
| Bandeau « Espace disque bas sur le serveur » | Moins de 15 % d'espace libre sur le disque des données | Étape 11.13, « Libérer de la place » ; l'alerte revient seulement après un retour au-dessus de 20 % puis une nouvelle baisse |
| `mettre-a-jour.sh` : `Retour arrière terminé` | La nouvelle version n'a pas démarré correctement : retour automatique | Rien n'est perdu. Transmettre le rapport indiqué (`/srv/suivi-audits/donnees/etat/mises-a-jour/…`) et `sudo docker compose logs app` à l'équipe projet |
| `mettre-a-jour.sh` : `des fichiers suivis par git ont été modifiés` | Un fichier de l'application a été modifié à la main sur le serveur | `sudo git diff` pour voir lesquels ; `sudo git checkout -- <fichier>` pour les remettre en état |
| Alerte « Sauvegarde en retard » dans l'onglet **Système** | Aucune sauvegarde réussie depuis plus de 48 h | Vérifier la planification et l'historique des sauvegardes (étapes 11.2 et 11.3) ; une tâche cron éventuelle écrit dans `/var/log/suivi-backup.log` |
| `unauthorized`, `denied` ou `manifest unknown` pendant le téléchargement des images | Numéro de version erroné (par exemple un `.env` conservé d'un essai précédent, que `installer.sh` signale par « ATTENTION : APP_VERSION=… »), version jamais publiée, ou images privées | Vérifier `APP_VERSION` (sans « v ») dans `.env` : elle doit être celle du dépôt téléchargé et d'une version publiée sur la page Releases. La corriger avec `sudo sed -i 's/^APP_VERSION=.*/APP_VERSION=<version>/' .env`, puis relancer `sudo ./installer.sh`. Images privées : `sudo docker login ghcr.io` avec un jeton GitHub limité à `read:packages` |
| `timeout`, `TLS handshake timeout`, `Could not resolve host` pendant une installation ou un téléchargement | Flux sortants bloqués, ou proxy d'entreprise | Vérifier le tableau des flux de l'étape 0 avec l'équipe réseau |
| `db` reste `unhealthy` ou redémarre | Premier démarrage encore en cours, ou disque plein | Attendre 2 minutes. `df -h /` : en dessous de 10 % d'espace libre, libérer de la place (étape 11.13, « Libérer de la place ») |
| `init` affiche `Exited (1)` | Volume des secrets abîmé ou droits modifiés | `sudo docker compose logs init`, puis demander de l'aide avec ce message |
| Le navigateur n'affiche rien, ou « délai dépassé » | DNS, pare-feu ou ports | Sur le serveur : `getent hosts <nom_dns>` et `curl -sk https://<nom_dns>/healthz` (réponse `ok`). Si le serveur répond mais pas le poste : ports 80 et 443 à ouvrir entre le poste et le serveur |
| « Votre connexion n'est pas privée » | Certificat interne non installé sur le poste | Normal tant que le certificat racine n'est pas déployé : étape 8.3 |
| « Jeton d'installation invalide » | Faute de frappe, ou jeton remplacé par un plus récent | Recopier le **dernier** jeton émis (étape 8.1) |
| « Jeton expiré » ou « déjà utilisé » | Jeton de plus de 24 h, ou administrateur déjà créé | `sudo ./installer.sh` (étape 8.1) |
| Code de double authentification toujours refusé | Heure du téléphone ou du serveur décalée | Serveur : étape 2.3 (`sudo timedatectl set-ntp true`). Téléphone : régler la date et l'heure en mode automatique |
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
| ⚠️ **Tout effacer** | `sudo docker compose down && sudo rm -rf /srv/suivi-audits/donnees` | `.env`, sauvegardes rangées hors du dossier des données | **base de données, documents, comptes, secrets, certificats, clés et sauvegardes du dossier des données : définitivement** |
| Supprimer aussi l'application | `cd / && sudo rm -rf /opt/suivi-audits /etc/cron.d/suivi-audits` | sauvegardes rangées hors du dossier des données (par exemple `/srv/sauvegardes`) | le dépôt, `.env` et les tâches planifiées éventuelles |

Les conteneurs de l'assistant et de l'antivirus, démarrés par l'exécutant d'exploitation quand leur flux est ouvert (profils Compose `assistant` et `antivirus`), ne sont visés par ces commandes que si les profils y figurent : par exemple `sudo docker compose --profile assistant --profile antivirus down`. Pour les arrêter durablement sur un serveur qui reste en service, désactivez plutôt le module dans l'application : l'exécutant les arrête et les retire, et ne les redémarre pas.

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
| **dnf** | L'outil qui installe et met à jour les logiciels sur Rocky Linux |
| **nano** | Un éditeur de texte simple, utilisable dans le terminal |
| **Pare-feu (ufw, firewalld)** | Filtre qui n'autorise que certaines connexions vers le serveur (`ufw` sur Debian et Ubuntu, `firewalld` sur Rocky Linux) |
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

