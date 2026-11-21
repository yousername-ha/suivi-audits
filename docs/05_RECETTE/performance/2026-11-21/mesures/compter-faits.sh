#!/usr/bin/env bash
# Pour un appel d'une route : nombre et durée des lectures des faits des avis (sources.ts, lireFaitsCve, requête
# « unnest(a.cves) AS c(cve) »), nombre et durée totale des requêtes SQL exécutées (lignes « execute » seulement : le
# journal à 0 ms écrit aussi les étapes parse et bind du protocole étendu, non comptées).   compter-faits.sh <compte> <chemin>
set -euo pipefail
BANC=${BANC:?BANC : dossier de travail du banc}
P=$BANC/perf/psql.sh
$P -qc "ALTER SYSTEM SET log_min_duration_statement = 0" -qc "SELECT pg_reload_conf()" >/dev/null
sleep 1
debut=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
sortie=$(cd $BANC/perf && COMPTE=$1 N=0 node essai.mjs GET "$2" | head -1)
fin=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
sleep 0.5
$P -qc "ALTER SYSTEM SET log_min_duration_statement = '300ms'" -qc "SELECT pg_reload_conf()" >/dev/null
docker logs --since "$debut" --until "$fin" suivi-banc-perf-db-1 > "$BANC/journal-appel.tmp" 2>&1
awk -v c="$2" -v s="$sortie" '
  /suivi_app@suivi/ && /duration: [0-9.]+ ms  (execute|statement)/ { if (bloc != "") fin_bloc(); match($0, /duration: [0-9.]+/); d = substr($0, RSTART + 10, RLENGTH - 10) + 0; bloc = $0; n++; t += d; next }
  /suivi_app@suivi/ { if (bloc != "") fin_bloc(); next }
  { if (bloc != "") bloc = bloc $0 }
  function fin_bloc() { if (index(bloc, "unnest(a.cves) AS c(cve)")) { nf++; tf += d } bloc = "" }
  END { if (bloc != "") fin_bloc(); printf "{\"chemin\":\"%s\",\"reponse\":\"%s\",\"requetesSql\":%d,\"sommeSqlMs\":%.0f,\"lecturesFaitsAvis\":%d,\"faitsAvisMs\":%.0f}\n", c, s, n, t, nf, tf }
' "$BANC/journal-appel.tmp"
rm -f "$BANC/journal-appel.tmp"
