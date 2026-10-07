#!/bin/sh
# Met à jour l'outil historique (servi sous /legacy) dans le dépôt, à partir d'un index.html exporté de l'artefact claude.ai.
# À lancer sur un poste de développement (pas sur le serveur) : la nouvelle interface est livrée dans l'image de l'API
# à la version suivante (pull request, puis étiquette vX.Y.Z).
#   Usage : ./scripts/update-ui.sh /chemin/vers/index.html
set -eu
cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Usage : $0 /chemin/vers/index.html"; exit 1; }
grep -q 'window.claude' "$1" || { echo "Ce fichier ne ressemble pas à l'outil de suivi."; exit 1; }
grep -q 'const SCHEMA=15;' "$1" || echo "ATTENTION : ce fichier n'est pas au schéma 15 (voir docs/legacy/IMPORT-LEGACY.md § 3)." >&2
cp "$1" app/public/index.html
pnpm --filter @suivi/shared test
echo "app/public/index.html mis à jour. Vérifier « git diff --stat », puis ouvrir une pull request."
