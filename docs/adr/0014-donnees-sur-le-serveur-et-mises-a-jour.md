# ADR 0014 — Données sur le serveur et mises à jour outillées

**Statut** : acceptée (phase 0, chantier 9 quinquies, exigences `EXPL-01` à `EXPL-09`).
Le numéro 0013 est réservé à la cartographie, rédigée dans le chantier suivant.

## Contexte
Les conteneurs étaient déjà en lecture seule, mais les données vivaient dans des **volumes nommés** Docker
(`/var/lib/docker/volumes`) : peu visibles de l'équipe infrastructure, absents de la sauvegarde du serveur, et
**supprimés par `docker compose down -v`**, commande citée comme « remise à zéro ». La mise à jour était une suite de
commandes manuelles ; le retour arrière était décrit, pas outillé. Le RSSI demande que les données soient sur le serveur
et que les mises à jour des futures versions soient sûres.

## Décision
- **Un seul dossier de données** `DATA_DIR` (`.env`, défaut `/srv/suivi-audits/donnees`), monté en **bind** dans chaque
  service ; plus aucun volume nommé pour des données (`docker-compose.yml`, `docker-compose.dev.yml`).
  Sous-dossiers `postgres/` (uid 70, 0700), `secrets/` (root, 0711 : traversée sans listage, fichiers 0400/0440),
  `caddy/data` et `caddy/config` (uid 1001, 0700), `clamav/` (uid 100), `etat/` (root, 0755, monté en lecture seule
  dans `app`). Le dossier `secrets/` est en 0711 et non 0700 : les comptes de la base (uid 70) et de l'application
  (uid 1000) doivent le traverser pour lire leur fichier.
- Le service **`init`** (root, sans réseau) contrôle `DATA_DIR` à chaque démarrage et refuse : chemin relatif ou
  dangereux (`/`, `/var/lib/docker`, `/tmp`, dossiers système), système de fichiers non persistant (`tmpfs`,
  `overlay`…), dossier dans celui de l'application (sonde écrite dans `DATA_DIR` puis cherchée dans le dépôt monté en
  lecture seule), et dossier **non préparé** (fichier témoin absent). Le témoin est déposé par
  `scripts/preparer-donnees.sh` (nouvelle installation) ou `scripts/migrer-donnees-vers-dossier.sh` (reprise des
  volumes) : un serveur mis à jour sans reprise des volumes ne démarre donc jamais sur une base vide.
- **Reprise des volumes** (`EXPL-02`) par copie, jamais par déplacement : les volumes d'origine restent intacts et
  servent de retour arrière ; leur suppression est une commande distincte, après vérification.
- **Mise à jour** par `scripts/mettre-a-jour.sh` (`EXPL-03`), qui s'exécute depuis une copie (le dépôt change de version
  pendant l'opération) : sauvegarde chiffrée obligatoire, signature **cosign sans clé** vérifiée contre l'identité du
  workflow `release.yml` du dépôt (pas de clé publique à distribuer), migrations au démarrage sous le verrou existant,
  santé complète (`/api/health/ready`, accessible seulement depuis le conteneur), relecture des documents chiffrés,
  rapport JSON dans `DATA_DIR/etat/mises-a-jour/` et journal d'audit (`suivi consigner-mise-a-jour`).
  En cas d'échec : retour à l'ancienne version ; si des migrations ont été appliquées, restauration de la sauvegarde
  (les migrations ne s'annulent pas) ; si les volumes venaient d'être repris, retour sur les volumes intacts et mise de
  côté de la copie.
- **Compatibilité** (`EXPL-04`) : migrations en avant uniquement, jamais modifiées une fois publiées ; un changement
  destructif (suppression ou renommage de colonne) se fait en deux versions (« étendre puis réduire ») ; une version
  plus ancienne est refusée par le script ; plusieurs versions peuvent être sautées (migrations cumulatives).
- **Information sans action** (`EXPL-05`) : l'application n'a pas d'accès Internet ; `scripts/verifier-version.sh`
  (tâche planifiée) écrit la dernière version publiée dans `DATA_DIR/etat/`, et l'application l'affiche aux
  administrateurs. Aucune mise à jour ne se lance depuis le navigateur.
- **Publication** (`EXPL-07`) : chaque section du `CHANGELOG.md` a un paragraphe « Notes de mise à jour » (vérifié par
  la CI) ; la page de la version le reprend, et `mettre-a-jour.sh` l'affiche avant de demander confirmation.
- **Tests** : persistance après suppression des conteneurs, des images et `down -v` (job « pile ») ; montée de version
  depuis la dernière version publiée, à défaut la base de la PR, avec retour arrière simulé, reprise des volumes et
  restauration après migration (job « montée de version ») ; mise à jour rejouée par le job « guide ».

## Conséquences
- L'équipe infrastructure sauvegarde `DATA_DIR` et le dossier des sauvegardes ; `docker compose down -v` n'est plus
  destructeur (la documentation ne le présente plus comme une remise à zéro).
- Toute nouvelle donnée persistante d'un service va dans un sous-dossier de `DATA_DIR`, créé par `init` avec ses droits.
- Toute version publiée doit pouvoir être atteinte par `mettre-a-jour.sh` depuis la précédente ; le job « montée de
  version » le vérifie à chaque PR.
- Aucune nouvelle dépendance npm. Outils système utilisés sur le serveur : bash, git, openssl, flock, cosign
  (installé par le guide, étape 3.6).
