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

# Commande docker compose dans le dossier de l'application.
dc() {
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
  while [ "$(date +%s)" -lt "$fin" ]; do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$(dc ps -q app 2> /dev/null)" 2> /dev/null || true)
    [ "$st" = healthy ] && return 0
    sleep 3
  done
  return 1
}

# Liste des migrations appliquées à la base (une par ligne ; vide si la base est inaccessible).
migrations_appliquees() {
  dc exec -T -u postgres db psql -d suivi -Atc 'SELECT name FROM schema_migrations ORDER BY name' 2> /dev/null || true
}
