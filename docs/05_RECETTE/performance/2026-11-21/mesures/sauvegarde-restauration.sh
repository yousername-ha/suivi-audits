#!/usr/bin/env bash
# Sauvegarde puis restauration de la base pleine, avec les mêmes primitives que scripts/backup.sh et scripts/restore.sh
# (pg_dump -Fc --no-owner, chiffrement age, déchiffrement, pg_restore --no-owner --role=suivi_app --exit-on-error, ANALYZE),
# mais dans une base SŒUR « suivi_restau » de la pile jetable : la base en service n'est pas remplacée (les mesures continuent).
# Clé age jetable, détruite à la fin. Durées en secondes dans mesures/sauvegarde-restauration.json.
set -euo pipefail
BANC=${BANC:?BANC : dossier de travail du banc}
T=/srv/suivi-banc-perf/sauvegarde
DB=suivi-banc-perf-db-1
mkdir -p "$T"; chmod 700 "$T"
age-keygen -o "$T/cle.key" 2>/dev/null
PUB=$(age-keygen -y "$T/cle.key")
d() { date +%s.%N; }
t0=$(d)
docker exec -u postgres $DB pg_dump -d suivi -Fc --no-owner > "$T/suivi.dump"
t1=$(d)
tar cf - -C "$T" suivi.dump | age -r "$PUB" -o "$T/sauvegarde.tar.age"
t2=$(d)
age -d -i "$T/cle.key" "$T/sauvegarde.tar.age" | tar xf - -C "$T" --transform 's/suivi.dump/relu.dump/'
t3=$(d)
docker exec -u postgres $DB psql -q -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS suivi_restau" -c "CREATE DATABASE suivi_restau OWNER suivi_app ENCODING 'UTF8' TEMPLATE template0"
docker exec -i -u postgres $DB pg_restore -d suivi_restau --no-owner --role=suivi_app --exit-on-error < "$T/relu.dump"
t4=$(d)
# Avant ANALYZE : plan d'une requête de liste lourde (constats) sans statistiques, puis après.
docker exec -i -u postgres $DB psql -q -d suivi_restau < "$BANC/req-constats.sql" > "$BANC/mesures/restau-constats-sans-analyze.txt" 2>&1 || true
t5=$(d)
docker exec -u postgres $DB psql -q -d suivi_restau -c "ANALYZE"
t6=$(d)
docker exec -i -u postgres $DB psql -q -d suivi_restau < "$BANC/req-constats.sql" > "$BANC/mesures/restau-constats-apres-analyze.txt" 2>&1 || true
TAILLE_DUMP=$(stat -c %s "$T/suivi.dump"); TAILLE_AGE=$(stat -c %s "$T/sauvegarde.tar.age")
python3 -I - "$t0" "$t1" "$t2" "$t3" "$t4" "$t5" "$t6" "$TAILLE_DUMP" "$TAILLE_AGE" > "$BANC/mesures/sauvegarde-restauration.json" <<'EOF'
import json, sys
t = [float(x) for x in sys.argv[1:8]]
print(json.dumps({"pgDumpS": round(t[1]-t[0], 1), "chiffrementAgeS": round(t[2]-t[1], 1), "dechiffrementS": round(t[3]-t[2], 1),
  "pgRestoreS": round(t[4]-t[3], 1), "analyzeS": round(t[6]-t[5], 1), "tailleDumpOctets": int(sys.argv[8]), "tailleArchiveOctets": int(sys.argv[9])}, indent=2))
EOF
docker exec -u postgres $DB psql -q -d postgres -c "DROP DATABASE suivi_restau"
rm -rf "$T"
cat "$BANC/mesures/sauvegarde-restauration.json"
