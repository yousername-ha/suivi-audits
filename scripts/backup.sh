#!/usr/bin/env bash
# Sauvegarde complète (EXPL-08) : base PostgreSQL (format custom), secrets (clé de chiffrement des documents, mots de
# passe) et autorité de certification interne du frontal, lus dans le dossier des données DATA_DIR.
# Sans les secrets, les documents sauvegardés sont indéchiffrables : tout est archivé ensemble, puis chiffré (AES-256,
# openssl) si BACKUP_PASSPHRASE_FILE est défini — fortement recommandé (obligatoire pour mettre-a-jour.sh).
# Un rapport est écrit dans DATA_DIR/etat/sauvegardes/ (affiché dans Administration > Système, alerte au-delà de 48 h).
#   Usage :  sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh [/chemin/destination]
#   Cron  :  15 2 * * *  root cd /opt/suivi-audits && BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /srv/sauvegardes/suivi-audits
# Variables : RETENTION_DAYS (90 par défaut, sauvegardes du dossier de destination uniquement, sous-dossiers exclus),
#             BACKUP_PREFIXE (début du nom de fichier, « suivi-audits » par défaut).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"

DEST="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
PREFIXE="${BACKUP_PREFIXE:-suivi-audits}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEBUT=$(date +%s)
DATA_DIR=$(dossier_donnees)
RAPPORTS="$DATA_DIR/etat/sauvegardes"
WORK="$(mktemp -d)"
OUT=''

rapport() { # resultat message
  local taille=null chiffree=false
  [ -n "$OUT" ] && [ -f "$OUT" ] && taille=$(stat -c %s "$OUT")
  case "$OUT" in *.enc) chiffree=true ;; esac
  printf '{"date":"%s","resultat":"%s","fichier":%s,"tailleOctets":%s,"chiffree":%s,"dureeSecondes":%s,"message":%s}\n' \
    "$(horodatage)" "$1" "$(json_chaine "$OUT")" "$taille" "$chiffree" "$(($(date +%s) - DEBUT))" "$(json_chaine "$2")"
}
fin() {
  local code=$?
  rm -rf "$WORK"
  if [ -d "$DATA_DIR/etat" ] && [ -w "$DATA_DIR/etat" ]; then
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

OUT="$DEST/$PREFIXE-$STAMP.tar"
tar cf "$OUT" -C "$WORK" "${membres[@]}"
if [ -n "${BACKUP_PASSPHRASE_FILE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in "$OUT" -out "$OUT.enc" -pass "file:$BACKUP_PASSPHRASE_FILE"
  rm -f "$OUT"
  OUT="$OUT.enc"
else
  avertir "sauvegarde NON chiffrée (définir BACKUP_PASSPHRASE_FILE)."
fi
(cd "$(dirname "$OUT")" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256")
echo "Sauvegarde : $OUT"
# Rotation dans le dossier de destination seulement : les sauvegardes « avant mise à jour » (sous-dossier) sont gardées.
find "$DEST" -maxdepth 1 -name "$PREFIXE-*.tar*" -mtime +"$RETENTION_DAYS" -delete
