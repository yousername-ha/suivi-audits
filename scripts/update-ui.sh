#!/bin/sh
# Met à jour l'interface de l'outil de suivi à partir d'un nouvel index.html exporté de l'artefact claude.ai.
# Les données (base PostgreSQL) ne sont pas modifiées. Les ressources externes sont neutralisées au démarrage.
#   Usage : ./scripts/update-ui.sh /chemin/vers/index.html
set -eu
cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Usage : $0 /chemin/vers/index.html"; exit 1; }
grep -q 'window.claude' "$1" || { echo "Ce fichier ne ressemble pas à l'outil de suivi."; exit 1; }
mkdir -p versions-ui && cp app/public/index.html "versions-ui/index-$(date +%Y%m%d-%H%M%S).html"
cp "$1" app/public/index.html
docker compose build app && docker compose up -d app
echo "Interface mise à jour (ancienne version conservée dans versions-ui/)."
