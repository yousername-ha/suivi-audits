#!/usr/bin/env bash
# Sauvegarde complète (EXPL-08) : base PostgreSQL (format custom), secrets (clé de chiffrement des documents, mots de
# passe) et autorité de certification interne du frontal, lus dans le dossier des données DATA_DIR.
# Sans les secrets, les documents sauvegardés sont indéchiffrables : tout est archivé ensemble, puis chiffré (AES-256,
# openssl) si BACKUP_PASSPHRASE_FILE est défini — fortement recommandé (obligatoire pour mettre-a-jour.sh).
# Un rapport est écrit dans DATA_DIR/etat/sauvegardes/ (affiché dans Administration > Système, alerte au-delà de 48 h).
#   Usage :  sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh [/chemin/destination]
#   Cron  :  15 2 * * *  root cd /opt/suivi-audits && BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits
# Variables : RETENTION_DAYS (90 par défaut, sauvegardes du dossier de destination uniquement, sous-dossiers exclus),
#             BACKUP_GARDER_MIN (nombre de sauvegardes les plus récentes toujours conservées, 7 par défaut, de 1 à 365),
#             BACKUP_PREFIXE (début du nom de fichier, « suivi-audits » par défaut).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"

DEST="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
GARDER_MIN="${BACKUP_GARDER_MIN:-7}"
PREFIXE="${BACKUP_PREFIXE:-suivi-audits}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEBUT=$(date +%s)
DATA_DIR=$(dossier_donnees)
RAPPORTS="$DATA_DIR/etat/sauvegardes"
JOB_ID="${BACKUP_JOB_ID:-}"
if [ -n "$JOB_ID" ]; then
  [[ "$JOB_ID" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] || arret "Identifiant de demande invalide."
fi
WORK="$(mktemp -d)"
OUT=''
TEMP_OUT=''
SHA=''
VERIFIEE=false

rapport() { # resultat message
  local taille=null chiffree=false
  [ -n "$OUT" ] && [ -f "$OUT" ] && taille=$(stat -c %s "$OUT")
  case "$OUT" in *.enc) chiffree=true ;; esac
  printf '{"date":"%s","resultat":"%s","fichier":%s,"tailleOctets":%s,"chiffree":%s,"dureeSecondes":%s,"sha256":%s,"integriteVerifiee":%s,"jobId":%s,"message":%s}\n' \
    "$(horodatage)" "$1" "$(json_chaine "$OUT")" "$taille" "$chiffree" "$(($(date +%s) - DEBUT))" "$(json_chaine "$SHA")" "$VERIFIEE" "$(json_chaine "$JOB_ID")" "$(json_chaine "$2")"
}
fin() {
  local code=$?
  rm -rf "$WORK"
  [ -z "$TEMP_OUT" ] || rm -f "$TEMP_OUT"
  if [ -d "$DATA_DIR/etat" ] && [ -w "$DATA_DIR/etat" ]; then
    if [ -n "$JOB_ID" ]; then
      if [ "$code" = 0 ]; then rapport reussie ''; else rapport echec "code de sortie $code"; fi | ecrire_etat "$RAPPORTS/jobs/$JOB_ID.json"
    fi
    if [ "$code" = 0 ]; then
      local r
      r=$(rapport reussie '')
      printf '%s\n' "$r" | ecrire_etat "$RAPPORTS/derniere-reussie.json"
      printf '%s\n' "$r" | ecrire_etat "$RAPPORTS/derniere.json"
    else
      rapport echec "code de sortie $code" | ecrire_etat "$RAPPORTS/derniere.json"
    fi
  fi
}
trap fin EXIT
umask 077
[[ "$RETENTION_DAYS" =~ ^[0-9]{1,5}$ ]] && [ "$RETENTION_DAYS" -ge 1 ] && [ "$RETENTION_DAYS" -le 36500 ] || arret "RETENTION_DAYS doit être compris entre 1 et 36500."
[[ "$GARDER_MIN" =~ ^[0-9]{1,3}$ ]] && [ "$GARDER_MIN" -ge 1 ] && [ "$GARDER_MIN" -le 365 ] || arret "BACKUP_GARDER_MIN doit être compris entre 1 et 365."
[[ "$PREFIXE" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,60}$ ]] || arret "Préfixe de sauvegarde invalide."
if [ -n "$JOB_ID" ]; then
  [ -n "${BACKUP_PASSPHRASE_FILE:-}" ] || arret "Chiffrement obligatoire pour une demande web."
fi
[ -d "$DATA_DIR/etat" ] || arret "Dossier d'état absent."
if [ "${BACKUP_SAUVEGARDE_LOCK_HELD:-}" != 1 ]; then
  if [ "${UPDATE_SAUVEGARDE_LOCK_HELD:-}" != 1 ]; then exec 9> "$DATA_DIR/etat/sauvegarde.lock"; fi
fi
flock -n 9 || arret "Une sauvegarde est déjà en cours."
mkdir -p "$DEST"

[ -d "$DATA_DIR/secrets" ] || arret "secrets introuvables dans $DATA_DIR/secrets (DATA_DIR de .env)."
docker compose exec -T -u postgres db pg_dump -d suivi -Fc --no-owner > "$WORK/suivi.dump"
tar czf "$WORK/secrets.tgz" -C "$DATA_DIR/secrets" .
membres=(suivi.dump secrets.tgz INFO)
# Autorité de certification interne (CADDY_TLS=internal) : la conserver évite de redéployer le certificat racine.
if [ -d "$DATA_DIR/caddy/data" ]; then
  tar czf "$WORK/caddy.tgz" -C "$DATA_DIR/caddy/data" .
  membres+=(caddy.tgz)
fi
docker compose exec -T -u postgres db psql -d suivi -Atc "SELECT 'version_donnees=' || version FROM app_state" > "$WORK/INFO" || true
{
  echo "date=$STAMP"
  echo "version_application=$(valeur_env APP_VERSION)"
  echo "migrations=$(migrations_appliquees | tail -n 1)"
} >> "$WORK/INFO"

OUT="$DEST/$PREFIXE-$STAMP${JOB_ID:+-$JOB_ID}.tar"
[ ! -e "$OUT" ] && [ ! -e "$OUT.enc" ] || arret "Archive déjà présente ; ne pas écraser une sauvegarde."
# L'archive contenant les secrets reste dans le dossier temporaire privé.
PLAIN="$WORK/complete.tar"
tar cf "$PLAIN" -C "$WORK" "${membres[@]}"
TEMP_OUT=$(mktemp "$DEST/.suivi-backup.XXXXXX")
if [ -n "${BACKUP_PASSPHRASE_FILE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in "$PLAIN" -out "$TEMP_OUT" -pass "file:$BACKUP_PASSPHRASE_FILE"
  OUT="$OUT.enc"
else
  cp "$PLAIN" "$TEMP_OUT"
  avertir "sauvegarde NON chiffrée (définir BACKUP_PASSPHRASE_FILE)."
fi
mv "$TEMP_OUT" "$OUT"
TEMP_OUT=''
(cd "$(dirname "$OUT")" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256")
(cd "$(dirname "$OUT")" && sha256sum -c "$(basename "$OUT").sha256" > /dev/null)
SHA=$(sha256sum "$OUT")
SHA=${SHA%% *}
VERIFIEE=true
echo "Sauvegarde : $OUT"
# Rotation dans le dossier de destination seulement : les sauvegardes « avant mise à jour » (sous-dossier) sont gardées.
# Les BACKUP_GARDER_MIN archives les plus récentes sont toujours conservées, quelle que soit leur ancienneté ; au-delà,
# une archive disparaît (avec son fichier .sha256) seulement si elle a plus de RETENTION_DAYS jours.
rang=0
while IFS= read -r -d '' ligne; do
  rang=$((rang + 1))
  [ "$rang" -gt "$GARDER_MIN" ] || continue
  archive=${ligne#*$'\t'}
  [ -n "$(find "$archive" -maxdepth 0 -mtime +"$RETENTION_DAYS")" ] || continue
  rm -f -- "$archive" "$archive.sha256"
done < <(find "$DEST" -maxdepth 1 -type f \( -name "$PREFIXE-*.tar" -o -name "$PREFIXE-*.tar.enc" \) -printf '%T@\t%p\0' | LC_ALL=C sort -z -t $'\t' -k1,1nr -k2,2r)
