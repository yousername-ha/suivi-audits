#!/usr/bin/env bash
# CI, job « guide » : rejoue l'étape 12.1 de docs/INSTALLATION.md (scripts/mettre-a-jour.sh) sur le serveur installé
# par le guide. Aucune version n'est publiée pour le commit testé : il est étiqueté localement (v99.0.0) et ses images,
# construites par le guide (étiquette « ci »), sont réétiquetées ; --images-locales remplace téléchargement et signature.
#   guide-mise-a-jour.sh verifier | appliquer
set -euo pipefail
cd /opt/suivi-audits
V=99.0.0
if ! sudo git rev-parse -q --verify "refs/tags/v$V" > /dev/null; then
  sudo git tag "v$V" HEAD
  for i in api web updater; do sudo docker tag "ghcr.io/yousername-ha/suivi-audits-$i:ci" "ghcr.io/yousername-ha/suivi-audits-$i:$V"; done
fi
case "${1:-}" in
  verifier) sudo ./scripts/mettre-a-jour.sh "$V" --verifier --images-locales ;;
  appliquer)
    sudo ./scripts/mettre-a-jour.sh "$V" --auto --images-locales
    grep -q "^APP_VERSION=$V$" .env || sudo grep -q "^APP_VERSION=$V$" .env || { echo "::error::Guide, étape 12.1 : APP_VERSION n'est pas $V"; exit 1; }
    sudo sh -c 'ls -1t /srv/suivi-audits/donnees/etat/mises-a-jour/*.json | head -n 1 | xargs cat' | grep -q '"resultat":"reussie"' \
      || { echo "::error::Guide, étape 12.1 : rapport de mise à jour absent ou en échec"; exit 1; }
    echo "Étape 12.1 : mise à jour par scripts/mettre-a-jour.sh réussie (rapport écrit, version $V en service)."
    ;;
  *) echo "Usage : $0 verifier|appliquer" >&2; exit 2 ;;
esac
