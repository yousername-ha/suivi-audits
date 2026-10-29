#!/usr/bin/env bash
# A1a : exécutant serveur. Aucun chemin ni commande n'est fourni par l'interface web.
# BACKUP_DEST, BACKUP_KEY_FILE et BACKUP_RECIPIENTS_FILE (chiffrement age, voir generer-cles-sauvegarde.sh) sont définis par
# l'exploitant, hors de l'application.
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
KEY_FILE="$(cle_sauvegarde_serveur)"
RECIPIENTS_FILE="$(cles_sauvegarde_secours)"
# Clé du serveur (0600, identité age valide) et clé publique de secours : sans elles, aucune sauvegarde (jamais en clair).
if [ -z "$DEST" ] || ! (controler_cles_sauvegarde "$KEY_FILE" "$RECIPIENTS_FILE") > /dev/null 2>&1; then
  cli backup-worker unavailable
  arret "Sauvegarde indisponible : destination ou clés absentes ou invalides (sudo ./scripts/generer-cles-sauvegarde.sh)."
fi
mkdir -p "$DEST"
[ -d "$DEST" ] && [ -w "$DEST" ] || { cli backup-worker unavailable; exit 1; }
cli backup-worker ready
JOB=$(cli backup-claim)
[ -n "$JOB" ] || exit 0
[[ "$JOB" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] || arret "Réponse de prise en charge invalide."
BACKUP_JOB_ID="$JOB" BACKUP_KEY_FILE="$KEY_FILE" BACKUP_RECIPIENTS_FILE="$RECIPIENTS_FILE" "$REPO/scripts/backup.sh" "$DEST" &
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
