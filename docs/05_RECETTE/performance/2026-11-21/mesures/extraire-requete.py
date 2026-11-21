# Extrait du journal de PostgreSQL (log_min_duration_statement) une requête lente de l'API contenant un motif, avec ses
# paramètres, et produit un script psql qui la rejoue sous EXPLAIN (ANALYZE, BUFFERS) en remplaçant $n par les valeurs.
#   docker logs suivi-banc-perf-db-1 2>&1 | python3 -I extraire-requete.py <motif> [n-ième=1] [réglages SET ...]
import re, sys
motif = sys.argv[1]; rang = int(sys.argv[2]) if len(sys.argv) > 2 else 1; reglages = sys.argv[3:]
log = sys.stdin.read()
blocs = re.findall(r"LOG:  duration: ([0-9.]+) ms  execute <unnamed>: (.*?)\n(?=\S)(.*?DETAIL:  Parameters: (.*?)\n)?", log, re.S)
trouves = [b for b in blocs if motif in b[1]]
if len(trouves) < rang:
    sys.exit(f"motif introuvable ({len(trouves)} requêtes)")
duree, q, _, params = trouves[rang - 1]
q = re.sub(r"\n\t", "\n", q)
p = dict(re.findall(r"\$(\d+) = '((?:[^']|'')*)'", params or ''))
q = re.sub(r"\$(\d+)\b", lambda x: "'" + p[x.group(1)] + "'" if x.group(1) in p else x.group(0), q)
print(f"-- durée relevée dans le journal : {duree} ms")
for r in reglages: print(f"SET {r};")
print("EXPLAIN (ANALYZE, BUFFERS) " + q.rstrip().rstrip(';') + ";")
