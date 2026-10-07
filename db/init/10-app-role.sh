#!/bin/sh
# Exécuté une seule fois, à la création du volume de données PostgreSQL.
# Crée le rôle applicatif (non superutilisateur) et la base « suivi ».
set -eu
APP_PW="$(cat /run/secrets/db_app_password)"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -v pw="$APP_PW" <<'EOSQL'
CREATE ROLE suivi_app LOGIN PASSWORD :'pw' CONNECTION LIMIT 40;
CREATE DATABASE suivi OWNER suivi_app ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE suivi FROM PUBLIC;
GRANT CONNECT ON DATABASE suivi TO suivi_app;
\c suivi
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO suivi_app;
EOSQL
