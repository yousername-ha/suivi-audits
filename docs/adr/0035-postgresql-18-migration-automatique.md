# ADR 0035 — PostgreSQL 18 avec migration automatique, et Node 26

**Statut** : proposée le 13/10/2026. Demande du RSSI : « les dernières versions LTS possibles de Node et de PostgreSQL ». Remplace
la ligne « Node 24 LTS et PostgreSQL 17 » de l'[ADR 0009](0009-dependances-et-versions.md).

## Constats vérifiés le 13/10/2026

- **PostgreSQL n'a pas de version LTS** : chaque version majeure est maintenue plusieurs années. La plus récente est la **18** (18.6).
- **Node** : la LTS en cours est la 24 « Krypton » ; la **26** (26.11.1) n'était pas encore marquée LTS dans l'index officiel
  (`nodejs.org/dist/index.json`). Décision du RSSI : passer à la 26 quand même ; un contrôle de l'index est programmé le 29/10/2026.
- L'image `postgres:18` **refuse de démarrer** si elle voit des fichiers d'une version plus ancienne dans son dossier de données
  (nouvel emplacement par défaut : `/var/lib/postgresql/18/docker`). Il faut donc un dossier distinct pour la base 18.
- Les 847 tests (shared, ui, web, API) passent sous Node 26.11.1 avec PostgreSQL 18.6 ; seul un typage a dû être précisé
  (`sha256` accepte une chaîne ou une vue sur tampon).

## Décision

1. **Node 26** : images `node:26-alpine`, `engines >=26`, CI, `@types/node` 26.
2. **PostgreSQL 18** : `postgres:18-alpine`, base dans `DATA_DIR/postgres18` (donc `postgres18/18/docker`). L'ancien dossier `postgres`
   (PostgreSQL 17) n'est **jamais modifié** par la migration : c'est le filet de sécurité.
3. **Migration automatique, avec les scripts de mise à jour existants.** `scripts/lib-commun.sh` (rechargé depuis la version cible
   par `mettre-a-jour.sh`, y compris quand l'ancienne version du script s'exécute) appelle `migrer_postgresql_si_necessaire` avant
   tout `docker compose up`. Si `postgres/PG_VERSION` indique une version plus ancienne que celle du compose et que la base 18 n'existe
   pas : (a) arrêt de `app`, `web` et `db` ; (b) export avec le moteur 17 dans un conteneur éphémère sans réseau (`db-pg17`, profil
   `migration-postgresql`) vers `etat/migration-postgresql` ; (c) démarrage d'une base 18 vierge (rôles et base créés par `db/init`) ;
   (d) restauration (mêmes étapes que `restore.sh`) ; (e) **contrôle des nombres de lignes par table**, identiques avant et après ;
   (f) suppression de l'export non chiffré, rapport JSON. La sauvegarde chiffrée obligatoire de `mettre-a-jour.sh` précède le tout.
4. **Échec = ancienne base intacte.** Export, démarrage, restauration ou comptes différents : seule la nouvelle base est supprimée,
   la migration est abandonnée, `mettre-a-jour.sh` revient à la version précédente, qui retrouve `postgres/` tel quel.
5. **Base 18 périmée détectée.** Après la migration, l'empreinte de `postgres/global/pg_control` est consignée. Si l'ancienne version a
   repris du service (retour arrière) puis qu'une nouvelle mise à jour est tentée, l'empreinte diffère : la base 18 existante est
   **mise de côté** (`.perimee-<date>`, jamais supprimée) et la migration est refaite depuis l'ancienne base, plus récente.
6. **Pas de base vide à côté des données.** Le service `init` refuse de démarrer (et donc `db`, `app`, `web`) s'il trouve une base 17
   sans base 18 migrée et sans témoin de migration en cours : un `docker compose up` direct ne crée jamais une base vide en silence.
7. **Nettoyage après vérification** : `sudo ./scripts/nettoyer-ancienne-base-postgresql.sh` supprime l'ancien dossier `postgres` (et
   les bases périmées) seulement si la base 18 existe et que l'application est saine, avec confirmation `SUPPRIMER`.
8. **Preuve en CI** : le job « Montée de version » part de la dernière version publiée (PostgreSQL 17), applique la mise à jour
   (échec simulé puis retour arrière, puis mise à jour réelle) et vérifie : base 18 en service, ancien dossier resté en version 17,
   rapport de migration présent, export supprimé.

## Conséquences

- La mise à jour d'un serveur en PostgreSQL 17 dure un peu plus (export + restauration, proportionnels à la taille de la base) et
  exige de l'espace libre : deux fois la base plus 512 Mo, contrôlé avant toute modification.
- Après migration, l'ancienne base occupe de la place jusqu'au nettoyage manuel ; c'est voulu.
- Les environnements de développement (`docker-compose.dev.yml`) recréent leur base jetable dans `.donnees-dev/postgres18`.
- Les montées de version majeures futures de PostgreSQL suivront le même principe (un dossier par version majeure).
