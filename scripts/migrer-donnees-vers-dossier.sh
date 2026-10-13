#!/usr/bin/env bash
# Passage des données des volumes Docker vers le dossier du serveur DATA_DIR (EXPL-02), pour un serveur déjà installé.
#   sudo ./scripts/migrer-donnees-vers-dossier.sh                        copie, contrôle, redémarrage
#   sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes   après vérification, libère la place
# Options : --oui (sans confirmation), --sauvegardes <dossier> (défaut /srv/sauvegardes/suivi-audits),
#           --sans-sauvegarde (réservé à mettre-a-jour.sh, qui vient d'en faire une).
# Étapes : sauvegarde chiffrée des volumes → arrêt → copie de chaque volume dans DATA_DIR (propriétaires et droits
# conservés) → contrôle (nombre de fichiers, taille, démarrage de PostgreSQL et nombres d'enregistrements) →
# démarrage de l'application → contrôle de santé. Les anciens volumes sont CONSERVÉS jusqu'à --supprimer-anciens-volumes.
# Idempotent : relancé après un succès, il ne fait rien ; relancé après une interruption, il recommence la copie.
# Prérequis : la version indiquée par APP_VERSION dans .env gère DATA_DIR (3.1.0 ou plus récente).
set -euo pipefail
REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
. "$REPO/scripts/lib-commun.sh"

OUI=0
SANS_SAUVEGARDE=0
SUPPRIMER=0
SAUV=/srv/sauvegardes/suivi-audits
while [ $# -gt 0 ]; do
  case "$1" in
    --oui) OUI=1 ;;
    --sans-sauvegarde) SANS_SAUVEGARDE=1 ;;
    --supprimer-anciens-volumes) SUPPRIMER=1 ;;
    --sauvegardes) SAUV="${2:?dossier attendu après --sauvegardes}"; shift ;;
    -h | --help) sed -n '2,12p' "$0"; exit 0 ;;
    *) arret "option inconnue : $1" ;;
  esac
  shift
done

exiger_root
[ -f "$REPO/.env" ] || arret "fichier .env absent dans $REPO."
command -v docker > /dev/null || arret "Docker est introuvable."
DATA_DIR=$(dossier_donnees)
verifier_chemin_donnees "$DATA_DIR"
EN_COURS="$DATA_DIR/.migration-en-cours"

confirmer() {
  [ "$OUI" = 1 ] && return 0
  printf '%s Taper OUI pour continuer : ' "$1"
  read -r r
  [ "$r" = OUI ] || arret "abandon (rien n'a été modifié)."
}

# ---------------------------------------------------------------- Suppression des anciens volumes (après vérification)
if [ "$SUPPRIMER" = 1 ]; then
  donnees_preparees || arret "$DATA_DIR n'est pas encore utilisé : faire d'abord la migration."
  base=$(dossier_base_postgresql)
  [ -n "$(ls -A "$base" 2> /dev/null)" ] || arret "$base est vide : migration non faite."
  src=$(docker inspect -f '{{range .Mounts}}{{if or (eq .Destination "/var/lib/postgresql/data") (eq .Destination "/var/lib/postgresql")}}{{.Source}}{{end}}{{end}}' \
    "$(dc ps -q db)" 2> /dev/null || true)
  [ "$src" = "$base" ] || arret "la base en service n'utilise pas $base (démarrer l'application d'abord)."
  vols=$(anciens_volumes)
  [ -n "$vols" ] || { info "Aucun ancien volume : rien à supprimer."; exit 0; }
  info "Anciens volumes (non utilisés) :"
  printf '  %s\n' $vols
  confirmer "Ils seront SUPPRIMÉS définitivement."
  for v in $vols; do docker volume rm "$v" > /dev/null && info "supprimé : $v"; done
  exit 0
fi

# ---------------------------------------------------------------- Rien à faire ?
vols=$(anciens_volumes)
if [ -z "$vols" ]; then
  donnees_preparees && { info "Rien à migrer : les données sont déjà dans $DATA_DIR."; exit 0; }
  arret "aucun volume Docker de l'application : pour une nouvelle installation, utiliser sudo ./scripts/preparer-donnees.sh."
fi
if donnees_preparees && [ ! -f "$EN_COURS" ] && [ -n "$(ls -A "$(dossier_base_postgresql)" 2> /dev/null)" ]; then
  info "Migration déjà faite : les données sont dans $DATA_DIR."
  info "Anciens volumes conservés :"
  printf '  %s\n' $vols
  info "Après vérification : sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes"
  exit 0
fi
if [ ! -f "$EN_COURS" ] && dossier_occupe "$DATA_DIR"; then
  arret "$DATA_DIR n'est pas vide : vérifier son contenu, ou indiquer un autre DATA_DIR dans .env."
fi

VERSION=$(valeur_env APP_VERSION)
IMG="ghcr.io/yousername-ha/suivi-audits-api:$VERSION"
docker run --rm --network none --entrypoint sh "$IMG" -c 'grep -q DONNEES dist/init-secrets.js' > /dev/null 2>&1 \
  || arret "la version $VERSION (APP_VERSION) ne gère pas encore DATA_DIR : mettre d'abord à jour (scripts/mettre-a-jour.sh)."

etape "Passage des volumes Docker vers $DATA_DIR"
info "Volumes trouvés :"
printf '  %s\n' $vols
besoin=0
for v in $vols; do
  mp=$(docker volume inspect -f '{{.Mountpoint}}' "$v")
  besoin=$((besoin + $(du -sb "$mp" | cut -f1)))
done
libre=$(octets_libres "$DATA_DIR")
[ "$libre" -gt $((besoin * 2)) ] || arret "espace disque insuffisant pour $DATA_DIR : $besoin octets à copier, $libre libres (il faut le double)."
confirmer "L'application sera arrêtée pendant la copie (quelques minutes)."

# Nombres d'enregistrements avant (si la base tourne encore), comparés après la copie.
COMPTE_SQL="SELECT (SELECT count(*) FROM users)||' '||(SELECT count(*) FROM document_versions)||' '||(SELECT count(*) FROM audit_log)||' '||coalesce((SELECT version FROM app_state WHERE id = 1), 0)"
avant=$(dc exec -T -u postgres db psql -d suivi -Atc "$COMPTE_SQL" 2> /dev/null || true)

etape "Arrêt de l'application"
dc --profile antivirus stop

STAMP=$(date +%Y%m%d-%H%M%S)
if [ "$SANS_SAUVEGARDE" = 0 ]; then
  etape "Sauvegarde chiffrée des volumes"
  PASS="${BACKUP_PASSPHRASE_FILE:-/root/.suivi-backup-pass}"
  [ -s "$PASS" ] || arret "phrase secrète des sauvegardes introuvable ($PASS) : voir docs/INSTALLATION.md, étape 11.1."
  mkdir -p "$SAUV"
  OUT="$SAUV/avant-migration-dossier-$STAMP.tar.gz.enc"
  # Les volumes sont sous la même racine (/var/lib/docker/volumes/<volume>/_data) : une seule archive, un dossier par volume.
  racine=$(dirname "$(dirname "$(docker volume inspect -f '{{.Mountpoint}}' "$(printf '%s\n' $vols | head -n 1)")")")
  (umask 077 && tar czf - -C "$racine" $vols | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -out "$OUT" -pass "file:$PASS")
  sha256sum "$OUT" > "$OUT.sha256"
  info "Sauvegarde : $OUT"
fi

etape "Copie des volumes"
mkdir -p "$DATA_DIR"
chmod 0755 "$DATA_DIR"
: > "$EN_COURS"
for m in $ANCIENS_VOLUMES; do
  v="${PROJET_COMPOSE}_${m%%:*}"
  dest="$DATA_DIR/${m#*:}"
  docker volume inspect "$v" > /dev/null 2>&1 || continue
  mp=$(docker volume inspect -f '{{.Mountpoint}}' "$v")
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -a "$mp/." "$dest/"
  # Propriétaire et droits du dossier racine du volume.
  chown --reference="$mp" "$dest"
  chmod --reference="$mp" "$dest"
  n1=$(find "$mp" | wc -l)
  n2=$(find "$dest" | wc -l)
  t1=$(du -sb "$mp" | cut -f1)
  t2=$(du -sb "$dest" | cut -f1)
  [ "$n1" = "$n2" ] && [ "$t1" = "$t2" ] \
    || arret "copie incomplète de $v ($n1/$n2 fichiers, $t1/$t2 octets). Les volumes d'origine sont intacts ; relancer le script."
  info "$v → $dest : $n2 fichiers, $t2 octets"
done
printf '{"creeLe":"%s","par":"migrer-donnees-vers-dossier.sh","version":%s,"anciensVolumes":"%s"}\n' \
  "$(horodatage)" "$(json_chaine "$VERSION")" "$(printf '%s ' $vols)" | ecrire_etat "$DATA_DIR/$MARQUEUR"
rm -f "$EN_COURS"

etape "Contrôle de la base copiée"
dc up -d db
for _ in $(seq 1 60); do
  dc exec -T -u postgres db pg_isready -q -h 127.0.0.1 2> /dev/null && break
  sleep 2
done
apres=$(dc exec -T -u postgres db psql -d suivi -Atc "$COMPTE_SQL")
info "Comptes, versions de documents, journal, version de l'état : $apres"
if [ -n "$avant" ] && [ "$avant" != "$apres" ]; then
  dc stop db
  arret "nombres d'enregistrements différents (avant : $avant). Les volumes d'origine sont intacts."
fi

etape "Démarrage de l'application"
dc up -d --remove-orphans
attendre_sante 300 || arret "l'application ne démarre pas : sudo docker compose logs init db app"
dc exec -T app suivi controle-donnees > /dev/null 2>&1 && info "Documents chiffrés relus : contrôle réussi."
printf '{"date":"%s","depuisVolumes":"%s","dossier":%s,"enregistrements":"%s"}\n' "$(horodatage)" "$(printf '%s ' $vols)" \
  "$(json_chaine "$DATA_DIR")" "$apres" | ecrire_etat "$DATA_DIR/etat/migration-dossier.json"

info ""
info "Migration terminée : les données sont dans $DATA_DIR."
info "Les anciens volumes sont conservés. Après vérification (connexion, données, documents) :"
info "  sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes"
