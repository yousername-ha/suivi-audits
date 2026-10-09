#!/usr/bin/env bash
# Restauration complète depuis une archive produite par backup.sh (EXPL-08).
#   Usage :  sudo [BACKUP_PASSPHRASE_FILE=...] ./scripts/restore.sh /chemin/suivi-audits-AAAAMMJJ-HHMMSS.tar[.enc]
# Remplace la base, les secrets et l'autorité de certification interne (si l'archive la contient) du serveur courant,
# dans le dossier des données DATA_DIR, avec les bons propriétaires et droits (service init). À utiliser sur une
# installation arrêtée ou neuve. Sur un serveur neuf, DATA_DIR est préparé automatiquement.
# Variable : RESTAURER_SANS_CONFIRMATION=1 (réservé à mettre-a-jour.sh, après confirmation de son côté).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"

VERIFY=0
if [ "${1:-}" = --verifier ]; then VERIFY=1; shift; fi
ARCH="${1:?Usage : $0 [--verifier] archive.tar[.enc]}"
[ "$#" = 1 ] || arret "Argument inattendu."
command -v python3 > /dev/null || arret "Python 3 requis (guide d’installation)."
[ -f "$ARCH" ] || arret "Archive régulière introuvable."
[ "$(stat -Lc %s "$ARCH")" -le 68719476736 ] || arret "Archive trop volumineuse."
DATA_DIR=$(dossier_donnees)
umask 077
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# Copie privée : l'archive sélectionnée ne peut changer entre empreinte, déchiffrement et extraction.
cp -- "$ARCH" "$WORK/source"
python3 "$REPO/scripts/verifier-archive-restauration.py" --checksum "$ARCH" "$WORK/source"
case "$ARCH" in
  *.enc) openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$WORK/source" -out "$WORK/a.tar" -pass "file:${BACKUP_PASSPHRASE_FILE:?BACKUP_PASSPHRASE_FILE requis}" ;;
  *) mv "$WORK/source" "$WORK/a.tar" ;;
esac
python3 "$REPO/scripts/verifier-archive-restauration.py" "$WORK/a.tar" "$WORK/extrait"
if [ "$VERIFY" = 1 ]; then
  echo "Vérification réussie. Restauration non exécutée."
  exit 0
fi
exiger_root
DELAI="${RESTORE_WAIT_SECONDS:-300}"
[[ "$DELAI" =~ ^[0-9]{1,4}$ ]] && [ "$DELAI" -ge 1 ] && [ "$DELAI" -le 1800 ] || arret "Délai de restauration invalide."
if [ "${RESTAURER_SANS_CONFIRMATION:-}" != 1 ]; then
  printf "Cette opération REMPLACE les données et les secrets actuels. Taper RESTAURER pour continuer : "
  read -r OK
  [ "$OK" = "RESTAURER" ] || { echo "Abandon."; exit 1; }
fi

if ! donnees_preparees; then
  [ -z "$(anciens_volumes)" ] || arret "données encore dans des volumes Docker : faire d'abord sudo ./scripts/migrer-donnees-vers-dossier.sh."
  "$REPO/scripts/preparer-donnees.sh"
fi
# Exclusivité avec le worker et toutes les sauvegardes, avant tout remplacement.
exec 8> "$DATA_DIR/etat/backup-worker.lock"
flock -n 8 || arret "Un exécutant de sauvegarde est actif."
exec 9> "$DATA_DIR/etat/sauvegarde.lock"
flock -n 9 || arret "Une sauvegarde ou restauration est active."
[ ! -L "$DATA_DIR/secrets" ] || arret "Le dossier des secrets ne doit pas être un lien."
# Contrôle du catalogue du dump dans un conteneur éphémère, avant modification des données.
docker compose run --rm --no-deps -T db pg_restore --list < "$WORK/extrait/suivi.dump" > /dev/null
WORK="$WORK/extrait"
# Le trap supprime aussi le dossier temporaire parent.
trap 'rm -rf "$(dirname "$WORK")"' EXIT
docker compose stop app web
# 1. Secrets (doivent correspondre aux documents chiffrés de la sauvegarde), puis autorité de certification interne.
install -d -m 0711 "$DATA_DIR/secrets"
find "$DATA_DIR/secrets" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
cp -R "$WORK/secrets/." "$DATA_DIR/secrets/"
if [ -f "$WORK/caddy.tgz" ]; then
  rm -rf "$DATA_DIR/caddy/data"
  install -d "$DATA_DIR/caddy/data"
  cp -R "$WORK/caddy/." "$DATA_DIR/caddy/data/"
fi
docker compose run --rm --no-deps init # recrée les dossiers absents et réapplique propriétaires et droits
# 2. Base : le mot de passe du rôle applicatif est réaligné sur le secret restauré
docker compose up -d db
FIN=$(($(date +%s) + DELAI))
until docker compose exec -T -u postgres db pg_isready -q; do
  [ "$(date +%s)" -lt "$FIN" ] || arret "PostgreSQL indisponible après restauration des secrets ; intervention requise."
  sleep 2
done
docker compose exec -T -u postgres db sh -c 'psql -v ON_ERROR_STOP=1 -v pw="$(cat /run/secrets/db_app_password)" -d postgres' << 'EOSQL'
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
# Une restauration ne doit pas remettre en service les sessions anciennes.
docker compose exec -T -u postgres db psql -v ON_ERROR_STOP=1 -d suivi << 'EOSQL'
DO $$ BEGIN
  IF to_regclass('public.sessions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.sessions';
  END IF;
END $$;
EOSQL
docker compose up -d
attendre_sante "$DELAI" || arret "Application indisponible après restauration ; intervention requise."
printf '{"date":"%s","archive":%s}\n' "$(horodatage)" "$(json_chaine "$ARCH")" | ecrire_etat "$DATA_DIR/etat/sauvegardes/derniere-restauration.json"
echo "Restauration terminée."
