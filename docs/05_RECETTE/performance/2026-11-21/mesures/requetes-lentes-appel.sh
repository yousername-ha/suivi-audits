#!/usr/bin/env bash
# Les requêtes les plus lentes d'un appel (journal complet le temps de l'appel) : durée et début du texte.
#   requetes-lentes-appel.sh <compte> <chemin> [nombre=8]
set -euo pipefail
BANC=${BANC:?BANC : dossier de travail du banc}
P=$BANC/perf/psql.sh
$P -qc "ALTER SYSTEM SET log_min_duration_statement = 0" -qc "SELECT pg_reload_conf()" >/dev/null
sleep 1
debut=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
(cd $BANC/perf && COMPTE=$1 N=0 node essai.mjs GET "$2" | head -1)
fin=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
sleep 0.5
$P -qc "ALTER SYSTEM SET log_min_duration_statement = '300ms'" -qc "SELECT pg_reload_conf()" >/dev/null
docker logs --since "$debut" --until "$fin" suivi-banc-perf-db-1 2>&1 | grep -A2 -E 'suivi_app@suivi.*duration: [0-9.]+ ms  execute' \
  | python3 -I -c "
import re, sys
t = sys.stdin.read().split('\n--\n')
r = []
for b in t:
    m = re.search(r'duration: ([0-9.]+) ms  execute <unnamed>: (.*)', b, re.S)
    if m: r.append((float(m.group(1)), re.sub(r'\s+', ' ', m.group(2))[:150]))
r.sort(reverse=True)
print(len(r), 'exécutions, somme', round(sum(x[0] for x in r)), 'ms')
for d, q in r[:int(sys.argv[1])]: print(f'{d:8.1f} ms  {q}')
" "${3:-8}"
