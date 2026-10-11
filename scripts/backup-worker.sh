#!/usr/bin/env bash
# A1a : exécutant serveur. Aucun chemin ni commande n'est fourni par l'interface web.
# BACKUP_DEST et BACKUP_PASSPHRASE_FILE sont définis par l'exploitant, hors de l'application.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"
cli() { docker compose exec -T app suivi "$@"; }
DATA_DIR=$(dossier_donnees)
[ -d "$DATA_DIR/etat" ] || arret "Dossier des données non préparé."
umask 077
exec 8> "$DATA_DIR/etat/backup-worker.lock"
flock -n 8 || exit 0
DEST="${BACKUP_DEST:-}"
KEY_FILE="${BACKUP_PASSPHRASE_FILE:-}"
if [ -z "$DEST" ] || [ -z "$KEY_FILE" ] || [ ! -f "$KEY_FILE" ] || [ ! -s "$KEY_FILE" ] || [ ! -r "$KEY_FILE" ]; then
  cli backup-worker unavailable
  exit 1
fi
# Pas de clé lisible par le groupe ou les autres comptes.
MODE=$(stat -c %a "$KEY_FILE")
if (( (8#$MODE & 077) != 0 )); then
  cli backup-worker unavailable
  arret "Permissions de la clé de sauvegarde trop larges (0600 requis)."
fi
mkdir -p "$DEST"
[ -d "$DEST" ] && [ -w "$DEST" ] || { cli backup-worker unavailable; exit 1; }
cli backup-worker ready
JOB=$(cli backup-claim)
[ -n "$JOB" ] || exit 0
[[ "$JOB" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] || arret "Réponse de prise en charge invalide."
BACKUP_JOB_ID="$JOB" BACKUP_PASSPHRASE_FILE="$KEY_FILE" "$REPO/scripts/backup.sh" "$DEST" &
BACKUP_PID=$!
# Le battement continue pendant une sauvegarde longue. Les enfants héritent du verrou hôte.
(
  TIMER_PID=''
  trap 'if [ -n "$TIMER_PID" ]; then kill "$TIMER_PID" 2>/dev/null || true; fi; exit 0' TERM
  while kill -0 "$BACKUP_PID" 2>/dev/null; do
    cli backup-worker ready || true
    sleep 30 &
    TIMER_PID=$!
    wait "$TIMER_PID" || exit 0
  done
) &
HEARTBEAT_PID=$!
trap 'kill "$HEARTBEAT_PID" 2>/dev/null || true' EXIT
CODE=0
wait "$BACKUP_PID" || CODE=$?
kill "$HEARTBEAT_PID" 2>/dev/null || true
wait "$HEARTBEAT_PID" 2>/dev/null || true
cli backup-finish "$JOB" "$CODE"
cli backup-worker ready
exit "$CODE"
