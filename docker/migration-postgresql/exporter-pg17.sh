#!/bin/sh
# Export de l'ancienne base PostgreSQL 17 (ADR 0035), exécuté dans le conteneur éphémère « db-pg17 » avec le moteur 17
# sur l'ancien dossier de données. Sans réseau, sans port : serveur local (socket) le temps de l'export.
# Produit dans /export : suivi-pg17.dump (format personnalisé), comptes-17.txt (lignes par table) et contraintes-17.txt
# (relations), pour contrôler la restauration. L'ancien dossier de données n'est pas modifié au-delà du démarrage/arrêt propre du serveur.
set -eu
D=/var/lib/postgresql/data
[ "$(cat "$D/PG_VERSION" 2> /dev/null || true)" = 17 ] || { echo "ERREUR : le dossier de données n'est pas une base PostgreSQL 17." >&2; exit 2; }
pg_ctl -D "$D" -o "-c listen_addresses='' -c unix_socket_directories=/tmp" -w -t 600 start > /tmp/pg17.log 2>&1 \
  || { cat /tmp/pg17.log >&2; echo "ERREUR : l'ancienne base ne démarre pas." >&2; exit 3; }
arreter() { pg_ctl -D "$D" -m fast -w stop > /dev/null 2>&1 || true; }
trap arreter EXIT
export PGHOST=/tmp PGUSER=postgres
pg_dump -d suivi -Fc --no-owner -f /export/suivi-pg17.dump
REQUETE=$(psql -d suivi -At -c "SELECT coalesce(string_agg(format('SELECT %L AS t, count(*)::bigint AS n FROM %I.%I', schemaname || '.' || tablename, schemaname, tablename), ' UNION ALL ' ORDER BY schemaname, tablename), 'SELECT ''aucune'' AS t, 0::bigint AS n') FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')")
psql -d suivi -At -F ' ' -c "$REQUETE" | sort > /export/comptes-17.txt
# Relations : clés étrangères, clés primaires, unicités et contrôles (les NOT NULL, stockés comme contraintes seulement depuis
# PostgreSQL 18, sont exclus), comparés après la restauration.
psql -d suivi -At -c "SELECT conrelid::regclass::text, contype, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('f','p','u','c') ORDER BY 1,2,3" > /export/contraintes-17.txt
[ -s /export/suivi-pg17.dump ] || { echo "ERREUR : export vide." >&2; exit 4; }
echo "Export PostgreSQL 17 terminé : $(wc -l < /export/comptes-17.txt) tables, $(stat -c %s /export/suivi-pg17.dump) octets."
