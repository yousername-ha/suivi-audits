#!/usr/bin/env bash
# Capture la requête SQL d'une route (avec ses paramètres) pour la rejouer sous EXPLAIN : journal de toutes les requêtes le
# temps d'un appel, puis extraire-requete.py.   capturer-requete.sh <compte> <chemin> <motif> <sortie.sql> [rang] [SET …]
set -euo pipefail
BANC=${BANC:?BANC : dossier de travail du banc}
P=$BANC/perf/psql.sh
compte=$1 chemin=$2 motif=$3 sortie=$4 rang=${5:-1}; shift 5 || shift $#
$P -qc "ALTER SYSTEM SET log_min_duration_statement = 0" -qc "SELECT pg_reload_conf()" >/dev/null
sleep 1
debut=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
(cd $BANC/perf && COMPTE=$compte N=0 node essai.mjs GET "$chemin" | head -1)
fin=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
sleep 0.5
$P -qc "ALTER SYSTEM SET log_min_duration_statement = '300ms'" -qc "SELECT pg_reload_conf()" >/dev/null
docker logs --since "$debut" --until "$fin" suivi-banc-perf-db-1 2>&1 | python3 -I $BANC/perf/extraire-requete.py "$motif" "$rang" "$@" > "$sortie"
head -c 300 "$sortie"; echo
