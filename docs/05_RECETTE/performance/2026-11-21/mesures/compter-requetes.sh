#!/usr/bin/env bash
# Nombre de requêtes SQL émises par l'API pour UN appel d'une route (rafales N+1) : journal de toutes les requêtes activé
# quelques secondes (log_min_duration_statement = 0), puis retour à 300 ms. Compte les lignes « duration: » du rôle
# applicatif dans la fenêtre exacte de l'appel, et la somme de leurs durées. Trois appels : le tic de l'API (toutes les
# minutes) peut tomber pendant l'un d'eux ; le minimum est retenu.
#   compter-requetes.sh <compte: admin|charge01> <chemin>
set -euo pipefail
BANC=${BANC:?BANC : dossier de travail du banc}
compte=$1 chemin=$2
P=$BANC/perf/psql.sh
$P -qc "ALTER SYSTEM SET log_min_duration_statement = 0" -qc "SELECT pg_reload_conf()" >/dev/null
sleep 1
res=""
for essai in 1 2 3; do
  debut=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
  sortie=$(cd $BANC/perf && COMPTE=$compte N=0 node essai.mjs GET "$chemin" | head -1)
  fin=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
  sleep 0.5
  n=$(docker logs --since "$debut" --until "$fin" suivi-banc-perf-db-1 2>&1 | grep 'suivi_app@suivi' | grep -E 'duration: [0-9.]+ ms  (execute|statement)' | grep -o 'duration: [0-9.]* ms' | awk '{n++; t+=$2} END {printf "%d %.0f", n, t}')
  res="$res$n|$sortie"$'\n'
done
$P -qc "ALTER SYSTEM SET log_min_duration_statement = '300ms'" -qc "SELECT pg_reload_conf()" >/dev/null
printf '%s' "$res" | sort -n | head -1 | awk -v c="$chemin" -F'|' '{split($1, a, " "); printf "{\"chemin\":\"%s\",\"reponse\":\"%s\",\"requetesSql\":%d,\"sommeMs\":%d,\"essais\":3}\n", c, $2, a[1], a[2]}'
