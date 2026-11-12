# ADR 0085 — Support de Rocky Linux 10 comme serveur d'installation

- Statut : acceptée par le RSSI le 11/11/2026, après le rejeu automatique du guide sur Rocky Linux 10 et Debian 12 (PR #254, 9
  contrôles de CI verts). Demande du RSSI du même jour ; numéro annoncé et accepté dans la session.
- Date : 2026-11-11
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Complète l'[ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (données sur le serveur et mises à jour outillées) et
  l'[ADR 0063](0063-chaine-de-publication-durcie.md) (épinglage des outils de CI par empreinte). Ne modifie ni les images ni
  l'application.

## Contexte

Le guide d'installation ne prenait en charge que Debian 12 et Ubuntu 24.04 LTS. Le RSSI demande de pouvoir aussi installer
l'application sur **Rocky Linux 10**, avec le même niveau de preuve qu'Ubuntu : le guide est rejoué automatiquement par la CI.
Les images (Node, Caddy, Alpine) et les scripts du serveur ne dépendent pas de la distribution : seuls le guide (gestionnaire de
paquets, pare-feu, dépôt Docker, outil `age`) et quelques messages d'erreur supposaient Debian ou Ubuntu.

## Décision

- **Moteur de conteneurs : Docker CE**, comme sur Debian et Ubuntu, depuis le dépôt officiel de Docker pour RHEL. Aucune
  modification de `docker-compose.yml`, du socket Docker de l'exécutant de mises à jour ni des scripts. Podman est écarté : il
  demanderait d'adapter le socket, les étiquettes SELinux des montages et tous les scripts, sans possibilité de test local.
- **SELinux reste en mode `enforcing`** (défaut de Rocky). Docker CE n'étiquette pas les conteneurs par défaut ; le rejeu en CI
  contrôle que le mode reste `Enforcing` du début à la fin.
- **Guide à deux voies** : chaque étape propre à une distribution a sa variante (`dnf` et `firewalld` pour Rocky, `apt` et `ufw`
  pour Debian et Ubuntu). Les marqueurs de CI `rocky-run`, `rocky-skip` et `rocky-instead` (en plus du marqueur `ci:` habituel)
  sélectionnent la variante ; `scripts/ci/guide-extraire.mjs --os=rocky` produit le script Rocky, et la sortie Debian et
  Ubuntu reste celle d'avant (test `scripts/tests/guide-extraire.test.mjs`).
- **Outil `age`** : paquet `age` du dépôt EPEL 10 (version 1.3.1, l'outil de FiloSottile) ; les messages d'erreur des scripts
  indiquent les deux commandes d'installation.
- **Preuve en CI** : le job « Guide d'installation (rejoué sur une VM …) » démarre, sous QEMU/KVM sur un runner Ubuntu, l'image
  officielle `Rocky-10-GenericCloud-Base` puis l'image `debian-12-genericcloud` (empreintes figées dans
  `scripts/ci/guide-vm.sh`), y rejoue le guide extrait avec `--os=rocky` ou `--os=debian`, puis le « lot A » (restauration,
  retours arrière, TLS). Debian 12, annoncé jusque-là sans rejeu dédié, est ainsi prouvé comme Ubuntu 24.04 et Rocky Linux 10. Un conteneur Rocky avec
  systemd est écarté : SELinux, `firewalld` et systemd n'y seraient pas fidèles, donc ce qui diffère d'Ubuntu ne serait pas prouvé.

## Ce qui n'est pas fait

- Pas de paquet RPM ni de dépôt dnf de l'application : l'installation reste `git clone` puis `installer.sh`.
- Pas d'autres distributions (RHEL, AlmaLinux) : probablement compatibles, non vérifiées, donc non annoncées.
- La montée de version automatisée (job « Montée de version ») reste rejouée sur Ubuntu seulement ; les scripts de mise à jour
  sont les mêmes sur Rocky mais ne sont pas rejoués sur cette distribution.

## Conséquences

Deux jobs de CI de plus (longs : 40 à 60 minutes, en parallèle) et les images Rocky et Debian à rafraîchir de temps en temps (adresse et empreinte). Le guide
double certaines étapes ; la table des flux sortants et le glossaire citent `dnf` et `firewalld`.
