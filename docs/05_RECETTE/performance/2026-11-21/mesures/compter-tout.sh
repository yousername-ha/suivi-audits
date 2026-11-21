#!/usr/bin/env bash
# Nombre de requêtes SQL par appel des routes lentes ou en rafale (compte RSSI non administrateur), une ligne JSON chacune.
B=$BANC
S=$($B/perf/psql.sh -Atc "select id from grc_smsis order by created_at, id limit 1")
PUB=$(python3 -I -c "import json;print(json.load(open('$B/mesures/preparation-v750.json'))['tableaux']['public'])")
for c in \
  /api/vulnerabilites/constats /api/vulnerabilites/machines /api/vulnerabilites/vue-ensemble /api/vulnerabilites/machines/parc \
  /api/vulnerabilites/correctifs "/api/vulnerabilites/rapport?mois=2026-10&format=csv" "/api/vulnerabilites/recherche?q=CVE-2099-1000" \
  /api/vulnerabilites/veille/avis /api/registres?archives=false /api/registres/mes-elements /api/grc/notifications \
  /api/grc/perimetres/synthese /api/mur/synthese /api/tableaux-de-bord "/api/tableaux-de-bord/$PUB/chiffres" \
  "/api/grc/$S/tasks?search=&offset=0" "/api/grc/$S/objects?kind=action&search=&offset=0" /api/veille-reglementaire/publications; do
  $B/perf/compter-requetes.sh charge01 "$c"
done
