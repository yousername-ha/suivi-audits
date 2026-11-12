#!/usr/bin/env bash
# Pile Docker éphémère du RSSI virtuel : installation neuve, dossier de données dédié, projet Compose séparé, puis harnais
# de non-régression (Playwright, conteneur officiel) et remise à zéro. Ne touche ni au .env du dépôt ni à une autre pile.
#
#   sudo tests/e2e/rssi-virtuel/lancer.sh                  construit les images de la branche, teste, détruit la pile
#   sudo tests/e2e/rssi-virtuel/lancer.sh --version 6.2.1  images publiées de cette version au lieu de la construction
#   sudo tests/e2e/rssi-virtuel/lancer.sh --garder         pile vierge laissée démarrée pour l'agent (pas de test)
#   sudo tests/e2e/rssi-virtuel/lancer.sh --arreter        arrête la pile gardée et efface ses données
#   sudo tests/e2e/rssi-virtuel/lancer.sh --pile 3 --garder   pile numérotée, pour plusieurs agents en parallèle
#
# Sans --pile, la pile écoute sur https://localhost (port 443, toutes les interfaces). Avec --pile N (1 à 99), elle a
# son propre projet Compose, son propre dossier de données et sa propre adresse de bouclage, https://127.0.0.(10+N) :
# plusieurs piles vierges cohabitent, une par agent. Le script refuse de démarrer si l'adresse est déjà prise.
set -euo pipefail
cd "$(dirname "$0")/../../.."
DEPOT=$PWD
IMAGE_PLAYWRIGHT=mcr.microsoft.com/playwright:v1.56.1-noble
VERSION=""
MODE=complet
PILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --garder) MODE=garder; shift ;;
    --arreter) MODE=arreter; shift ;;
    --pile) PILE="$2"; shift 2 ;;
    -h | --help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done
if [ -n "$PILE" ]; then
  case "$PILE" in '' | *[!0-9]*) echo "--pile attend un nombre de 1 à 99." >&2; exit 2 ;; esac
  [ "$PILE" -ge 1 ] && [ "$PILE" -le 99 ] || { echo "--pile attend un nombre de 1 à 99." >&2; exit 2; }
  SUFFIXE=-$PILE
  ADRESSE=127.0.0.$((10 + PILE))
  ECOUTE=$ADRESSE
else
  SUFFIXE=""
  ADRESSE=localhost
  ECOUTE=0.0.0.0
fi
PROJET=suivi-rssi-virtuel$SUFFIXE
TRAVAIL=/srv/suivi-rssi-virtuel$SUFFIXE
DONNEES=$TRAVAIL/donnees
ENV_FICHIER=$TRAVAIL/.env
JETON=$DEPOT/tests/e2e/.jeton$SUFFIXE
URL=https://$ADRESSE
[ "$(id -u)" = 0 ] || { echo "À lancer avec sudo (dossier de données $TRAVAIL)." >&2; exit 1; }

compose() {
  local fichiers=(-f docker-compose.yml)
  [ -z "$VERSION" ] && fichiers+=(-f docker-compose.build.yml)
  docker compose -p "$PROJET" --env-file "$ENV_FICHIER" "${fichiers[@]}" "$@"
}

arreter() {
  if [ -f "$ENV_FICHIER" ]; then compose down -v --remove-orphans >/dev/null 2>&1 || true; fi
  rm -rf "$TRAVAIL"
  rm -f "$JETON"
  echo "Pile du RSSI virtuel ($PROJET) arrêtée, données effacées."
}

demarrer() {
  if [ -e "$TRAVAIL" ]; then
    echo "$TRAVAIL existe déjà : une pile du RSSI virtuel est peut-être gardée (--arreter pour repartir de zéro)." >&2
    exit 1
  fi
  # Une écoute sur toutes les interfaces (pile sans --pile, autre service) occupe aussi les adresses de bouclage.
  local motif='[^ ]*'
  [ -n "$PILE" ] && motif="($ADRESSE|0\.0\.0\.0|\*|\[::\])"
  if ss -ltn 2>/dev/null | grep -qE "\s$motif:443\s"; then
    echo "Le port 443 est déjà utilisé sur $ECOUTE (autre pile ?) : l'arrêter avant de lancer le RSSI virtuel." >&2
    exit 1
  fi
  mkdir -p "$DONNEES"
  chmod 0755 "$TRAVAIL" "$DONNEES"
  # Même marqueur que scripts/preparer-donnees.sh : le service init refuse un dossier non préparé.
  printf '{"creeLe":"%s","par":"rssi-virtuel/lancer.sh","version":"%s"}\n' "$(date -Iseconds)" "${VERSION:-local}" \
    >"$DONNEES/.suivi-audits-donnees"
  sed -e "s#^DATA_DIR=.*#DATA_DIR=$DONNEES#" \
    -e "s/^SITE_ADDRESS=.*/SITE_ADDRESS=$ADRESSE/" \
    -e "s/^BIND_ADDR=.*/BIND_ADDR=$ECOUTE/" \
    -e "s/^APP_VERSION=.*/APP_VERSION=${VERSION:-local}/" \
    -e 's/^ORG_NAME=.*/ORG_NAME="Groupement Santé Fictif"/' \
    -e 's/^RATE_LIMIT_PER_MINUTE=.*/RATE_LIMIT_PER_MINUTE=6000/' \
    .env.example >"$ENV_FICHIER"
  chmod 0600 "$ENV_FICHIER"
  if [ -z "$VERSION" ]; then
    echo "== Construction des images de la branche ($(git rev-parse --short HEAD))"
    compose build
  else
    echo "== Images publiées $VERSION"
    compose pull --quiet
  fi
  echo "== Démarrage de la pile vierge ($PROJET)"
  compose up -d
  local st=""
  for _ in $(seq 1 60); do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q app)" 2>/dev/null || true)
    [ "$st" = healthy ] && break
    sleep 3
  done
  [ "$st" = healthy ] || { compose logs --no-color init app | tail -60; echo "La pile ne démarre pas." >&2; exit 1; }
  for _ in $(seq 1 30); do curl -skf $URL/healthz >/dev/null && break; sleep 2; done
  curl -sk $URL/api/setup | grep -q '"adminExists":false' || { echo "Pile non vierge : arrêt." >&2; exit 1; }
}

tester() {
  # Jeton neuf lu par le test d'installation (le conteneur Playwright n'a pas accès à Docker), jamais versionné.
  compose exec -T app setup-token >"$JETON"
  local code=0
  docker run --rm --network host --ipc=host \
    -v "$DEPOT:/work" -w /work/tests/e2e \
    -e CI -e E2E_BASE_URL="$URL" -e E2E_TOKEN_CMD="cat .jeton$SUFFIXE" -e E2E_STACK_DIR=/work/tests/e2e \
    "$IMAGE_PLAYWRIGHT" npx playwright test -c rssi-virtuel/playwright.config.ts || code=$?
  rm -f "$JETON"
  chown -R "${SUDO_UID:-0}:${SUDO_GID:-0}" "$DEPOT/tests/e2e/rssi-virtuel/test-results" 2>/dev/null || true
  return $code
}

case "$MODE" in
  arreter) arreter ;;
  garder)
    demarrer
    echo
    echo "Pile vierge gardée : $URL"
    echo "Jeton d'installation pour l'agent : sudo docker compose -p $PROJET --env-file $ENV_FICHIER exec -T app setup-token"
    echo "Pilote : E2E_BASE_URL=$URL PILOTE_PORT=$((9333 + ${PILE:-0})) PILOTE_DOSSIER=.pilote$SUFFIXE E2E_TOKEN_CMD='sudo docker compose -p $PROJET --env-file $ENV_FICHIER exec -T app setup-token' \\"
    echo "         node tests/e2e/rssi-virtuel/pilote.mjs demarrer"
    ;;
  complet)
    trap arreter EXIT
    demarrer
    tester
    ;;
esac
