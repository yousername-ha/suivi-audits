# shellcheck shell=bash
# Fonctions communes aux scripts d'exploitation du serveur (bash). À inclure : . "$REPO/scripts/lib-commun.sh"
# REPO : dossier de l'application (par défaut, le dossier parent de scripts/).

REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PROJET_COMPOSE="${PROJET_COMPOSE:-suivi-audits}"
DATA_DIR_DEFAUT=/srv/suivi-audits/donnees
MARQUEUR=.suivi-audits-donnees
# Anciens volumes Docker (v2 et premières versions v3) → sous-dossier de DATA_DIR.
ANCIENS_VOLUMES="pgdata:postgres secrets:secrets caddy_data:caddy/data caddy_config:caddy/config clamav_db:clamav"

etape() { printf '\n== %s\n' "$*"; }
info() { printf '%s\n' "$*"; }
avertir() { printf 'ATTENTION : %s\n' "$*" >&2; }
erreur() { printf 'ERREUR : %s\n' "$*" >&2; }
arret() {
  erreur "$*"
  exit 1
}

exiger_root() { [ "$(id -u)" = 0 ] || arret "à lancer en administrateur : sudo $0 $*"; }

# Valeur d'une variable du fichier .env (sans les guillemets), ou la valeur par défaut.
valeur_env() {
  local v=''
  if [ -f "$REPO/.env" ]; then
    v=$(grep -E "^$1=" "$REPO/.env" | tail -n 1 | cut -d= -f2- || true)
    v=${v%\"}
    v=${v#\"}
    v=${v%\'}
    v=${v#\'}
  fi
  printf '%s' "${v:-${2:-}}"
}

# Remplace (ou ajoute) une ligne NOM=valeur dans .env, sans toucher aux autres lignes ni aux droits du fichier.
ecrire_env() {
  local f="$REPO/.env"
  if grep -qE "^$1=" "$f"; then
    sed -i "s|^$1=.*|$1=$2|" "$f"
  else
    printf '%s=%s\n' "$1" "$2" >> "$f"
  fi
}

dossier_donnees() { valeur_env DATA_DIR "$DATA_DIR_DEFAUT"; }

# Contrôle de l'emplacement de DATA_DIR (mêmes règles que le service init, plus le système de fichiers réel).
verifier_chemin_donnees() {
  local d="$1" n reel repo_reel t
  case "$d" in /*) ;; *) arret "DATA_DIR doit être un chemin absolu (reçu : « $d »)." ;; esac
  n=$(printf '%s' "$d" | sed -e 's|/\{2,\}|/|g' -e 's|/$||')
  [ -n "$n" ] || arret "DATA_DIR ne peut pas être la racine « / »."
  for x in /var/lib/docker /var/lib/containerd /proc /sys /dev /run /var/run /tmp /var/tmp /boot /etc /usr /bin /sbin /lib /lib64; do
    case "$n/" in "$x"/*) arret "DATA_DIR ne peut pas être dans $x (dossier système, Docker ou temporaire)." ;; esac
  done
  reel=$(realpath -m "$n")
  repo_reel=$(realpath -m "$REPO")
  case "$reel/" in "$repo_reel"/*) arret "DATA_DIR ($d) est dans le dossier de l'application : choisir par exemple $DATA_DIR_DEFAUT." ;; esac
  # Système de fichiers du premier dossier existant du chemin.
  local p="$reel"
  while [ ! -e "$p" ]; do p=$(dirname "$p"); done
  t=$(stat -f -c %T "$p" 2>/dev/null || echo inconnu)
  case "$t" in tmpfs | ramfs | overlayfs | overlay) arret "DATA_DIR ($d) est sur un système de fichiers non persistant ($t)." ;; esac
}

donnees_preparees() { [ -f "$(dossier_donnees)/$MARQUEUR" ]; }

# Dossier non vide, sans compter les rapports (etat/) ni une copie mise de côté après un échec (.echec-*).
dossier_occupe() {
  [ -d "$1" ] && find "$1" -mindepth 1 -maxdepth 1 ! -name etat ! -name '.echec-*' | grep -q .
}

# Anciens volumes nommés encore présents (noms complets, un par ligne).
anciens_volumes() {
  local v
  for m in $ANCIENS_VOLUMES; do
    v="${PROJET_COMPOSE}_${m%%:*}"
    docker volume inspect "$v" > /dev/null 2>&1 && printf '%s\n' "$v"
  done
  return 0
}

# Écriture atomique d'un fichier JSON lisible par l'application (etat/ : root, 0644).
ecrire_etat() {
  local f="$1" tmp
  install -d -m 0755 "$(dirname "$f")"
  tmp=$(mktemp "$f.XXXXXX")
  cat > "$tmp"
  chmod 0644 "$tmp"
  mv -f "$tmp" "$f"
}

# Échappement d'une chaîne pour JSON.
json_chaine() {
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/ }
  printf '"%s"' "$s"
}

horodatage() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Octets libres sur le système de fichiers d'un dossier (ou de son premier parent existant).
octets_libres() {
  local p="$1"
  while [ ! -e "$p" ]; do p=$(dirname "$p"); done
  df -PB1 "$p" | awk 'NR == 2 { print $4 }'
}

# ---------------------------------------------------------------- PostgreSQL : montée de version majeure (ADR 0035)
# Version majeure demandée par docker-compose.yml (ex. 18) et version de l'ancien dossier de données postgres/ (ex. 17).
# PostgreSQL 18 range sa base dans postgres18/18/docker : l'ancien dossier reste intact (retour arrière possible).
postgresql_majeure_compose() {
  sed -n 's/^[[:space:]]*image:[[:space:]]*postgres:\([0-9][0-9]*\).*/\1/p' "$REPO/docker-compose.yml" | head -n 1
}
# Dossier de données de la base en service (postgres18 pour PostgreSQL 18, postgres avant) et son point de montage.
dossier_base_postgresql() {
  local m
  m=$(postgresql_majeure_compose)
  if [[ "$m" =~ ^[0-9]+$ ]] && [ "$m" -ge 18 ]; then printf '%s/postgres%s' "$(dossier_donnees)" "$m"; else printf '%s/postgres' "$(dossier_donnees)"; fi
}
postgresql_majeure_ancienne() { tr -d '[:space:]' < "$(dossier_donnees)/postgres/PG_VERSION" 2> /dev/null || true; }

# Comptes de lignes par table de la base « suivi » (une ligne « table nombre », triée), pour comparer avant et après.
postgresql_comptes() {
  local requete
  requete=$(dc exec -T -u postgres db psql -d suivi -At -c "SELECT coalesce(string_agg(format('SELECT %L AS t, count(*)::bigint AS n FROM %I.%I', schemaname || '.' || tablename, schemaname, tablename), ' UNION ALL ' ORDER BY schemaname, tablename), 'SELECT ''aucune'' AS t, 0::bigint AS n') FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')") || return 1
  dc exec -T -u postgres db psql -d suivi -At -F ' ' -c "$requete" | sort
}

# Contraintes de relations (clés étrangères, primaires, uniques, contrôles) de la base « suivi », triées, pour comparer avant et après.
postgresql_contraintes() {
  dc exec -T -u postgres db psql -d suivi -At -c "SELECT conrelid::regclass::text, contype, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('f','p','u','c') ORDER BY 1,2,3"
}
# Contraintes non validées (une clé étrangère créée « NOT VALID » n'aurait pas contrôlé les lignes existantes).
postgresql_contraintes_non_validees() {
  dc exec -T -u postgres db psql -d suivi -At -c "SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated"
}

# Base « suivi » recréée vide, mot de passe du rôle applicatif aligné sur le secret (mêmes étapes que restore.sh).
postgresql_recreer_base() {
  dc exec -T -u postgres db sh -c 'psql -v ON_ERROR_STOP=1 -v pw="$(cat /run/secrets/db_app_password)" -d postgres' << 'EOSQL'
ALTER ROLE suivi_app PASSWORD :'pw';
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'suivi' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS suivi;
CREATE DATABASE suivi OWNER suivi_app ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE suivi FROM PUBLIC;
\c suivi
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO suivi_app;
EOSQL
}

# Migration de la base PostgreSQL 17 vers 18 : export avec le moteur 17 (conteneur éphémère, sans réseau), nouvelle base 18
# vierge, restauration, contrôle des comptes par table. L'ancien dossier de données n'est jamais modifié : en cas d'échec,
# seule la nouvelle base (postgres18/18) est supprimée et la version précédente redémarre sur l'ancienne, intacte.
migrer_postgresql() { # ancienne nouvelle
  local anc="$1" nouv="$2" data neuf expo fin taille besoin libre empreinte
  data=$(dossier_donnees)
  neuf="$data/postgres$nouv/$nouv"
  expo="$data/etat/migration-postgresql"
  [ "$anc" = 17 ] && [ "$nouv" = 18 ] || { erreur "montée PostgreSQL $anc → $nouv non prévue par ce script."; return 1; }
  etape "Migration de la base PostgreSQL $anc → $nouv (l'ancienne base n'est pas modifiée)"
  taille=$(du -sb "$data/postgres" 2> /dev/null | cut -f1 || echo 0)
  besoin=$((2 * ${taille:-0} + 512 * 1024 * 1024))
  libre=$(octets_libres "$data")
  info "Espace libre : $((libre / 1048576)) Mo (nécessaire : $((besoin / 1048576)) Mo)"
  [ "$libre" -ge "$besoin" ] || { erreur "espace disque insuffisant pour la migration PostgreSQL ($((besoin / 1048576)) Mo)."; return 1; }
  export SUIVI_PG_EN_COURS=1
  # Témoin lu par le service init : il refuse sinon de démarrer PostgreSQL 18 à côté d'une base 17 non migrée.
  install -d -m 0700 -o 70 -g 70 "$data/postgres$nouv"
  : > "$data/postgres$nouv/.migration-en-cours"
  # 1. Figer les écritures, puis exporter avec le moteur 17.
  dc stop app web > /dev/null 2>&1 || true
  dc stop db > /dev/null 2>&1 || true
  rm -rf "$expo"
  install -d -m 0700 -o 70 -g 70 "$expo"
  if ! dc --profile migration-postgresql run --rm --no-deps -T db-pg17; then
    erreur "export de l'ancienne base en échec : rien n'a été modifié."
    rm -rf "$expo"
    return 1
  fi
  [ -s "$expo/suivi-pg17.dump" ] || { erreur "export vide : rien n'a été modifié."; rm -rf "$expo"; return 1; }
  # Empreinte de l'ancienne base arrêtée proprement : si elle change plus tard, c'est que l'ancienne version a repris du service
  # (retour arrière) et que la base 18 est périmée (voir migrer_postgresql_si_necessaire).
  empreinte=$(sha256sum "$data/postgres/global/pg_control" | cut -d' ' -f1)
  # 2. Nouvelle base vierge (rôles et base créés par db/init), puis restauration (mêmes étapes que restore.sh).
  etape "Création de la base PostgreSQL $nouv et restauration"
  dc up -d db || { abandonner_migration_postgresql "$neuf" "$expo"; return 1; }
  fin=$(($(date +%s) + 300))
  until dc exec -T -u postgres db pg_isready -q; do
    [ "$(date +%s)" -lt "$fin" ] || { erreur "PostgreSQL $nouv ne démarre pas."; abandonner_migration_postgresql "$neuf" "$expo"; return 1; }
    sleep 2
  done
  if ! postgresql_recreer_base || ! dc exec -T -u postgres db pg_restore -d suivi --no-owner --role=suivi_app --exit-on-error < "$expo/suivi-pg17.dump"; then
    erreur "restauration dans PostgreSQL $nouv en échec."
    abandonner_migration_postgresql "$neuf" "$expo"
    return 1
  fi
  # 3. Contrôle : mêmes tables, mêmes nombres de lignes qu'avant.
  postgresql_comptes > "$expo/comptes-$nouv.txt" || { erreur "comptage après restauration impossible."; abandonner_migration_postgresql "$neuf" "$expo"; return 1; }
  if ! diff -u "$expo/comptes-17.txt" "$expo/comptes-$nouv.txt" > "$expo/differences.txt"; then
    cat "$expo/differences.txt" >&2
    erreur "les données restaurées diffèrent de l'ancienne base."
    abandonner_migration_postgresql "$neuf" "$expo"
    return 1
  fi
  # 4. Relations : mêmes contraintes qu'avant, toutes validées (aucune ligne orpheline).
  postgresql_contraintes > "$expo/contraintes-$nouv.txt" || { erreur "lecture des contraintes impossible."; abandonner_migration_postgresql "$neuf" "$expo"; return 1; }
  if ! diff -u "$expo/contraintes-17.txt" "$expo/contraintes-$nouv.txt" > "$expo/differences-contraintes.txt"; then
    cat "$expo/differences-contraintes.txt" >&2
    erreur "les relations (clés étrangères, unicités) de la base restaurée diffèrent de l'ancienne."
    abandonner_migration_postgresql "$neuf" "$expo"
    return 1
  fi
  [ "$(postgresql_contraintes_non_validees | tr -d '[:space:]')" = 0 ] || { erreur "des contraintes de la base restaurée ne sont pas validées."; abandonner_migration_postgresql "$neuf" "$expo"; return 1; }
  rm -f "$expo/suivi-pg17.dump" "$expo/differences.txt" "$expo/differences-contraintes.txt"
  printf '%s\n' "$empreinte" > "$data/postgres$nouv/.migre-depuis-postgres"
  printf '{"date":"%s","de":%s,"vers":%s,"tables":%s,"ancienneBase":%s}\n' "$(horodatage)" "$anc" "$nouv" "$(wc -l < "$expo/comptes-$nouv.txt")" \
    "$(json_chaine "$data/postgres")" | ecrire_etat "$expo/migration-$anc-vers-$nouv.json"
  rm -f "$data/postgres$nouv/.migration-en-cours"
  unset SUIVI_PG_EN_COURS
  info "Base migrée vers PostgreSQL $nouv : $(wc -l < "$expo/comptes-$nouv.txt") tables, nombres de lignes identiques, $(wc -l < "$expo/contraintes-$nouv.txt") relations et unicités identiques."
  info "Ancienne base PostgreSQL $anc conservée (retour arrière possible) ; après vérification de l'application : sudo ./scripts/nettoyer-ancienne-base-postgresql.sh"
}

# Abandon : seule la nouvelle base est supprimée ; l'ancienne reste intacte et la version précédente la retrouve.
abandonner_migration_postgresql() { # dossier_neuf dossier_export
  local neuf="$1" expo="$2"
  rm -f "$(dirname "$neuf")/.migration-en-cours"
  avertir "migration PostgreSQL abandonnée : l'ancienne base est intacte."
  dc stop db > /dev/null 2>&1 || true
  [ -n "$neuf" ] && case "$neuf" in */postgres[0-9]*/[0-9]*) rm -rf "$neuf" ;; esac
  rm -rf "$expo"
  unset SUIVI_PG_EN_COURS
}

# Appelée avant tout « docker compose up » : migre la base si l'ancien dossier postgres/ contient une version majeure plus
# ancienne que celle de docker-compose.yml et que la nouvelle base n'existe pas encore. Sans effet pour une nouvelle installation, un dossier déjà migré ou pendant un retour arrière.
migrer_postgresql_si_necessaire() {
  local cible actuelle neuve
  [ -z "${SUIVI_PG_EN_COURS:-}" ] || return 0
  donnees_preparees || return 0
  cible=$(postgresql_majeure_compose)
  actuelle=$(postgresql_majeure_ancienne)
  [[ "$cible" =~ ^[0-9]+$ ]] && [[ "$actuelle" =~ ^[0-9]+$ ]] || return 0
  [ "$actuelle" -lt "$cible" ] || return 0
  neuve="$(dossier_donnees)/postgres$cible"
  if [ -f "$neuve/$cible/docker/PG_VERSION" ]; then
    # Base 18 déjà créée. Elle est périmée si l'ancienne base a servi depuis (retour arrière, puis nouvelle tentative) : la mettre
    # de côté (jamais supprimée) et refaire la migration depuis l'ancienne base, qui est alors la plus récente.
    [ -f "$neuve/.migre-depuis-postgres" ] || return 0
    [ "$(sha256sum "$(dossier_donnees)/postgres/global/pg_control" 2> /dev/null | cut -d' ' -f1)" != "$(cat "$neuve/.migre-depuis-postgres")" ] || return 0
    avertir "l'ancienne base PostgreSQL $actuelle a servi depuis la migration : la base $cible existante est périmée, elle est mise de côté."
    dc stop db > /dev/null 2>&1 || true
    mv "$neuve/$cible" "$neuve/.perimee-$(date -u +%Y%m%d-%H%M%S)"
    rm -f "$neuve/.migre-depuis-postgres"
  fi
  migrer_postgresql "$actuelle" "$cible"
}

# Commande docker compose dans le dossier de l'application.
dc() {
  if [ "${1:-}" = up ]; then migrer_postgresql_si_necessaire || return 1; fi
  if [ "${SUIVI_MAJ_WEB:-}" = 1 ] && [ "${1:-}" = up ]; then
    (cd "$REPO" && docker compose "$@" db app web)
  else
    (cd "$REPO" && docker compose "$@")
  fi
}

# Attente de la santé de « app » (conteneur healthy), puis du site HTTPS (« ok »). Délai en secondes.
attendre_sante() {
  local delai="${1:-300}" fin st
  fin=$(($(date +%s) + delai))
  # Au moins un contrôle, même si le délai est court ou écoulé avant le premier tour (seconde qui change).
  while :; do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$(dc ps -q app 2> /dev/null)" 2> /dev/null || true)
    [ "$st" = healthy ] && return 0
    [ "$(date +%s)" -lt "$fin" ] || return 1
    sleep 3
  done
}

# Liste des migrations appliquées à la base (une par ligne ; vide si la base est inaccessible).
migrations_appliquees() {
  dc exec -T -u postgres db psql -d suivi -Atc 'SELECT name FROM schema_migrations ORDER BY name' 2> /dev/null || true
}
