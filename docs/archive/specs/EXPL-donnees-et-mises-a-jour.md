# Données sur le serveur et mises à jour des versions — spécification

> Exigences `EXPL-01` à `EXPL-09`, à citer dans les commits et les PR. Demande du RSSI du 08/10/2026 :
> « les données doivent être stockées sur le serveur, pas dans le conteneur » et « gestion des mises à jour des
> futures versions ».

## Constat (branche `refonte/phase-0-ecrans`)
- Les conteneurs sont déjà en lecture seule : aucune donnée n'est écrite dans un conteneur.
- Mais les données sont dans des **volumes nommés Docker** (`pgdata`, `secrets`, `caddy_data`, `caddy_config`,
  `clamav_db`), rangés dans `/var/lib/docker/volumes`, peu visibles par l'équipe infrastructure, et **supprimés par
  `docker compose down -v`** (commande citée comme « remise à zéro » dans la documentation).
- La mise à jour est manuelle (INSTALLATION § 12.1) : sauvegarde, `git checkout`, `APP_VERSION`, `pull`, `up -d` ;
  le retour arrière est décrit mais pas outillé.

## EXPL-01 — Toutes les données dans un dossier du serveur
- Variable `DATA_DIR` dans `.env` (défaut `/srv/suivi-audits/donnees`), montages **bind** à la place des volumes nommés :

  | Dossier | Contenu | Propriétaire, droits |
  |---|---|---|
  | `postgres/` | base PostgreSQL (suivi, comptes, documents chiffrés, journal) | uid 70, `0700` |
  | `secrets/` | secrets générés par `init` (clé de chiffrement, mots de passe) | root ou uid dédié, `0700`, fichiers `0400` |
  | `caddy/data/`, `caddy/config/` | certificats Let's Encrypt, configuration | uid 1001, `0700` |
  | `clamav/` | signatures antivirus (facultatif) | uid du conteneur ClamAV |
  | `etat/` | rapports de mise à jour et de sauvegarde, version disponible (EXPL-05) | root, `0755`, monté en lecture seule dans `app` |

- `init` crée les dossiers absents avec les bons propriétaires et droits, et refuse de démarrer si `DATA_DIR` est
  dans un chemin dangereux (`/`, `/var/lib/docker`, dossier du dépôt) ou sur un système de fichiers non persistant.
- Aucun service n'écrit ailleurs que dans `DATA_DIR` ou dans un `tmpfs` (fichiers temporaires) ; `read_only: true` conservé.
- `docker compose down -v`, la suppression des conteneurs ou des images **ne touchent plus aux données**.
- Test CI : arrêt complet, suppression des conteneurs et des images, `down -v`, redémarrage → données intactes
  (comptes, état, document chiffré relu à l'identique).

## EXPL-02 — Passage des volumes nommés au dossier du serveur
- Script `scripts/migrer-donnees-vers-dossier.sh` pour les serveurs déjà installés (v2 ou v3) :
  sauvegarde chiffrée préalable → arrêt → copie de chaque volume vers `DATA_DIR` en conservant propriétaires et droits →
  contrôle (nombre de fichiers, taille, démarrage de PostgreSQL et vérification `SELECT count(*)` des tables
  principales) → bascule de `docker-compose.yml` → démarrage → contrôle de santé.
- Les anciens volumes sont **conservés** jusqu'à confirmation explicite (`--supprimer-anciens-volumes`).
- Idempotent et rejouable ; testé en CI depuis une installation avec volumes nommés.

## EXPL-03 — Script de mise à jour `scripts/mettre-a-jour.sh`
```text
sudo ./scripts/mettre-a-jour.sh            # propose la dernière version publiée
sudo ./scripts/mettre-a-jour.sh 3.2.0      # version précise
sudo ./scripts/mettre-a-jour.sh --verifier # simulation : ce qui changerait, sans rien modifier
```
1. Contrôles : droits root, espace disque (≥ 2 × taille de la base + images), Docker, `.env`, `DATA_DIR`.
2. Affiche la version actuelle, la cible et les **notes de mise à jour** du `CHANGELOG.md` (actions manuelles,
   migrations, durée estimée) ; demande confirmation.
3. Refuse un retour à une version plus ancienne (voir point 8).
4. **Sauvegarde chiffrée obligatoire** (`backup.sh`), contrôle de son empreinte ; les 5 dernières sauvegardes
   « avant mise à jour » sont gardées hors rotation.
5. `git checkout v<cible>`, vérification de la **signature des images** (cosign, clé publique du dépôt), `pull`.
6. Liste des migrations à appliquer (`app cli migrations --a-appliquer`), puis `up -d` ; migrations au démarrage
   sous verrou (`pg_advisory_xact_lock`, déjà en place), chacune dans sa transaction.
7. Attente de la santé (`/api/health/ready` : base joignable, migrations appliquées, version attendue) avec délai.
8. **Échec → retour arrière automatique** : ancienne `APP_VERSION`, ancien tag ; si des migrations ont été appliquées,
   restauration de la sauvegarde du point 4 (confirmation demandée, sauf `--auto`).
9. Rapport dans `DATA_DIR/etat/mises-a-jour/<date>.json` (versions, migrations, durée, résultat) et dans le journal
   d'audit (`app cli consigner-mise-a-jour`) ; nettoyage des images en gardant la version précédente pour un retour rapide.

## EXPL-04 — Compatibilité des données entre versions
- Migrations uniquement en avant, jamais modifiées une fois publiées (règle existante), idempotentes autant que possible.
- Changement destructif (suppression ou renommage de colonne) en **deux versions** (« étendre puis réduire ») :
  la version N ajoute et recopie, la version N+1 supprime.
- Versionnage sémantique : MAJEURE = action manuelle ou rupture (notes de mise à jour obligatoires).
  Passer plusieurs versions d'un coup est permis : les migrations sont cumulatives.
- `GET /api/version` (authentifié) : version applicative, dernière migration, schéma legacy accepté.
- Test CI « montée de version » : installation de la **dernière version publiée** avec le jeu fictif, mise à jour par
  `mettre-a-jour.sh` vers le commit testé, contrôle des données (nombres, empreintes, document chiffré relu),
  puis simulation d'échec (`/api/health/ready` en erreur) → retour arrière vérifié. Le test de montée depuis une base
  v2 existante est conservé.

## EXPL-05 — Suivi dans l'application (Administration > Système)
- Version en service, date et historique des mises à jour (rapports de `DATA_DIR/etat/mises-a-jour/`),
  migrations appliquées, emplacement des données et espace disque libre.
- Date de la dernière sauvegarde (rapport écrit par `backup.sh` dans `DATA_DIR/etat/`) ; alerte si plus de 48 h.
- **Nouvelle version disponible** : `app` n'a pas d'accès Internet ; `scripts/verifier-version.sh` (tâche planifiée
  quotidienne sur le serveur) écrit la dernière version publiée dans `DATA_DIR/etat/version-disponible.json`,
  lu par l'application → bandeau pour les administrateurs avec le lien vers les notes de version.
  Rien n'est installé automatiquement.
- Permission `administration:lire` pour consulter, aucune action de mise à jour depuis le navigateur.

## EXPL-06 — Outil historique
`app/public/index.html` fait partie de l'image (code, pas donnée) : il est mis à jour par une version publiée, pas en
copiant un fichier sur le serveur. `scripts/update-ui.sh` est retiré de la procédure v3 (ou réservé au développement) ;
toute évolution de l'outil historique passe par une PR (commit séparé pour `index.html`).

## EXPL-07 — Publication d'une version
Tag `vX.Y.Z` → CI : images construites, signées (cosign), SBOM, publication GHCR, page de release reprenant la section
du `CHANGELOG.md` avec un paragraphe **« Notes de mise à jour »** obligatoire (même vide : « aucune action »).

## EXPL-08 — Sauvegardes et restauration
`backup.sh` et `restore.sh` lisent `DATA_DIR` ; la restauration recrée les dossiers avec les bons droits ; rapport
d'exécution dans `DATA_DIR/etat/` ; test de restauration conservé dans le guide et la CI.

## EXPL-09 — Documentation
`docs/INSTALLATION.md` : création de `DATA_DIR` (étape dédiée, explications pour débutant), mise à jour par
`mettre-a-jour.sh`, retour arrière, migration depuis les volumes nommés, inclusion de `DATA_DIR` **et** des sauvegardes
dans la sauvegarde externalisée du serveur ; tableau de dépannage complété. Guide rejoué en CI, y compris une mise à jour.
