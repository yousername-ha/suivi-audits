#!/bin/sh
# Sauvegarde complète : base PostgreSQL (format custom) + secrets (clé de chiffrement des documents, mots de passe).
# Sans les secrets, les documents sauvegardés sont indéchiffrables : les deux sont donc archivés ensemble,
# puis chiffrés (AES-256, openssl) si BACKUP_PASSPHRASE_FILE est défini — fortement recommandé.
#   Usage :  BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh [/chemin/destination]
#   Cron  :  15 2 * * *  cd /opt/suivi-audits && BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/backup.sh /mnt/sauvegardes
set -eu
cd "$(dirname "$0")/.."
DEST="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
umask 077
mkdir -p "$DEST"

docker compose exec -T -u postgres db pg_dump -d suivi -Fc --no-owner > "$WORK/suivi.dump"
docker compose run --rm --no-deps -T --user 0:0 init tar czf - -C /secrets . > "$WORK/secrets.tgz"
docker compose exec -T -u postgres db psql -d suivi -Atc "SELECT 'version_donnees=' || version FROM app_state" > "$WORK/INFO" || true
echo "date=$STAMP" >> "$WORK/INFO"

OUT="$DEST/suivi-audits-$STAMP.tar"
tar cf "$OUT" -C "$WORK" suivi.dump secrets.tgz INFO
if [ -n "${BACKUP_PASSPHRASE_FILE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in "$OUT" -out "$OUT.enc" -pass "file:$BACKUP_PASSPHRASE_FILE"
  rm -f "$OUT"; OUT="$OUT.enc"
else
  echo "ATTENTION : sauvegarde NON chiffrée (définir BACKUP_PASSPHRASE_FILE)." >&2
fi
sha256sum "$OUT" > "$OUT.sha256"
echo "Sauvegarde : $OUT"
find "$DEST" -name 'suivi-audits-*.tar*' -mtime +"$RETENTION_DAYS" -delete
