#!/usr/bin/env bash
# Pile jetable du banc de performance (modèle : tests/e2e/rssi-virtuel/lancer.sh). Projet Compose, adresse et dossier de
# données propres ; images construites depuis le commit testé. Sans updater ni antivirus.
# Passage du 21/11/2026 : la pile démarre en v7.4.0 (étiquette perf740, version de départ d'une mise à jour réelle), est
# remplie, puis passe en v7.5.0 (perf750, commit testé ee255f84) : « maj » mesure la mise à jour sur la base pleine.
#   pile.sh demarrer        pile vierge en v7.4.0
#   pile.sh maj             mise à jour en v7.5.0 (compose et images de v7.5.0, .env gardé, APP_VERSION changé)
#   pile.sh arreter         arrêt, suppression des conteneurs et du dossier de données
#   pile.sh compose <args>  docker compose de la version en place
set -euo pipefail
BANC=${BANC:?BANC : dossier de travail du banc}
DEPOT_740=$BANC/src740
DEPOT_750=${DEPOT_750:?arbre de travail du commit testé}
PROJET=suivi-banc-perf
TRAVAIL=/srv/suivi-banc-perf
DONNEES=$TRAVAIL/donnees
ENV_FICHIER=$TRAVAIL/.env
SURCHARGE=$TRAVAIL/compose.banc.yml
ADRESSE=127.0.0.77
version_en_place() { grep -q '^APP_VERSION=perf750' "$ENV_FICHIER" 2>/dev/null && echo 750 || echo 740; }
depot() { [ "$(version_en_place)" = 750 ] && echo "$DEPOT_750" || echo "$DEPOT_740"; }
compose() { (cd "$(depot)" && docker compose -p "$PROJET" --env-file "$ENV_FICHIER" -f docker-compose.yml -f "$SURCHARGE" "$@"); }
attendre_sain() {
  local st=
  for _ in $(seq 1 200); do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q app)" 2>/dev/null || true)
    [ "$st" = healthy ] && break; sleep 1
  done
  [ "$st" = healthy ] || { compose logs --no-color init app | tail -60; exit 1; }
  for _ in $(seq 1 60); do curl -skf https://$ADRESSE/healthz >/dev/null && break; sleep 1; done
}
case "${1:-}" in
  demarrer)
    [ -e "$TRAVAIL" ] && { echo "$TRAVAIL existe déjà" >&2; exit 1; }
    mkdir -p "$DONNEES"; chmod 0755 "$TRAVAIL" "$DONNEES"
    printf '{"creeLe":"%s","par":"banc-performance","version":"perf740"}\n' "$(date -Iseconds)" >"$DONNEES/.suivi-audits-donnees"
    sed -e "s#^DATA_DIR=.*#DATA_DIR=$DONNEES#" -e "s/^SITE_ADDRESS=.*/SITE_ADDRESS=$ADRESSE/" \
      -e "s/^BIND_ADDR=.*/BIND_ADDR=$ADRESSE/" -e "s/^APP_VERSION=.*/APP_VERSION=perf740/" \
      -e 's/^ORG_NAME=.*/ORG_NAME="Groupement Sante Fictif"/' \
      -e 's/^RATE_LIMIT_PER_MINUTE=.*/RATE_LIMIT_PER_MINUTE=100000/' \
      -e 's/^MFA_REQUIRED=.*/MFA_REQUIRED=false/' -e 's/^EXPLOITATION_AUTO=.*/EXPLOITATION_AUTO=0/' \
      "$DEPOT_740/.env.example" >"$ENV_FICHIER"
    chmod 0600 "$ENV_FICHIER"
    printf 'services:\n  app:\n    env_file: !override\n      - %s\n' "$ENV_FICHIER" >"$SURCHARGE"
    compose up -d init db app web gateway
    attendre_sain
    curl -sk https://$ADRESSE/api/setup; echo ;;
  maj)
    [ "$(version_en_place)" = 740 ] || { echo "déjà en v7.5.0" >&2; exit 1; }
    t0=$(date +%s.%N)
    compose stop app web gateway
    t1=$(date +%s.%N)
    sed -i 's/^APP_VERSION=.*/APP_VERSION=perf750/' "$ENV_FICHIER"
    compose up -d init db app web gateway
    t2=$(date +%s.%N)
    attendre_sain
    t3=$(date +%s.%N)
    python3 -I -c "import sys,json; t=[float(x) for x in sys.argv[1:]]; print(json.dumps({'arretS': round(t[1]-t[0],1), 'recreationS': round(t[2]-t[1],1), 'jusquaSainS': round(t[3]-t[2],1), 'indisponibiliteTotaleS': round(t[3]-t[0],1)}))" "$t0" "$t1" "$t2" "$t3" ;;
  arreter)
    [ -f "$ENV_FICHIER" ] && compose down -v --remove-orphans || true
    rm -rf "$TRAVAIL"; echo "pile arrêtée, données effacées" ;;
  compose) shift; compose "$@" ;;
  *) echo "usage: pile.sh demarrer|maj|arreter|compose ..." >&2; exit 2 ;;
esac
