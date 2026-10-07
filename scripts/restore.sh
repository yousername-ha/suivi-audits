#!/bin/sh
# Restauration complète depuis une archive produite par backup.sh.
#   Usage :  [BACKUP_PASSPHRASE_FILE=...] ./scripts/restore.sh /chemin/suivi-audits-AAAAMMJJ-HHMMSS.tar[.enc]
# Remplace la base ET les secrets du serveur courant. À utiliser sur une installation arrêtée ou neuve.
set -eu
cd "$(dirname "$0")/.."
ARCH="${1:?Usage : $0 archive.tar[.enc]}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
umask 077
if [ -f "$ARCH.sha256" ]; then (cd "$(dirname "$ARCH")" && sha256sum -c "$(basename "$ARCH").sha256"); fi
case "$ARCH" in
  *.enc) openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$ARCH" -out "$WORK/a.tar" -pass "file:${BACKUP_PASSPHRASE_FILE:?BACKUP_PASSPHRASE_FILE requis}" ;;
  *) cp "$ARCH" "$WORK/a.tar" ;;
esac
tar xf "$WORK/a.tar" -C "$WORK"
cat "$WORK/INFO" 2>/dev/null || true
printf "Cette opération REMPLACE les données et les secrets actuels. Taper RESTAURER pour continuer : "
read -r OK; [ "$OK" = "RESTAURER" ] || { echo "Abandon."; exit 1; }

docker compose stop app proxy
# 1. Secrets (doivent correspondre aux documents chiffrés de la sauvegarde)
docker compose run --rm --no-deps -T --user 0:0 init sh -c 'rm -f /secrets/* && tar xzf - -C /secrets' < "$WORK/secrets.tgz"
docker compose run --rm --no-deps init   # réapplique les droits
# 2. Base : le mot de passe du rôle applicatif est réaligné sur le secret restauré
docker compose up -d db
until docker compose exec -T -u postgres db pg_isready -q; do sleep 2; done
docker compose exec -T -u postgres db sh -c 'psql -v ON_ERROR_STOP=1 -v pw="$(cat /run/secrets/db_app_password)" -d postgres' <<'EOSQL'
ALTER ROLE suivi_app PASSWORD :'pw';
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'suivi' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS suivi;
CREATE DATABASE suivi OWNER suivi_app ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE suivi FROM PUBLIC;
\c suivi
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO suivi_app;
EOSQL
docker compose exec -T -u postgres db pg_restore -d suivi --no-owner --role=suivi_app --exit-on-error < "$WORK/suivi.dump"
docker compose up -d
echo "Restauration terminée."
