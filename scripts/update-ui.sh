#!/bin/sh
# Met à jour l'outil historique (servi sous /legacy) dans le dépôt, à partir d'un index.html exporté de l'artefact claude.ai.
# Réservé au poste de développement (EXPL-06) : l'outil historique fait partie de l'image de l'API ; il arrive sur le
# serveur avec une version publiée (pull request, puis étiquette vX.Y.Z, puis scripts/mettre-a-jour.sh), jamais par copie.
#   Usage : ./scripts/update-ui.sh /chemin/vers/index.html
set -eu
cd "$(dirname "$0")/.."
if [ -f /srv/suivi-audits/donnees/.suivi-audits-donnees ] || [ -f "$(grep -E '^DATA_DIR=' .env 2>/dev/null | cut -d= -f2)/.suivi-audits-donnees" ]; then
  echo "Ce script ne s'utilise pas sur le serveur : mettre à jour avec scripts/mettre-a-jour.sh (docs/INSTALLATION.md, étape 12.1)." >&2
  exit 1
fi
[ -f "${1:-}" ] || { echo "Usage : $0 /chemin/vers/index.html"; exit 1; }
grep -q 'window.claude' "$1" || { echo "Ce fichier ne ressemble pas à l'outil de suivi."; exit 1; }
grep -q 'const SCHEMA=15;' "$1" || echo "ATTENTION : ce fichier n'est pas au schéma 15 (voir docs/legacy/IMPORT-LEGACY.md § 3)." >&2
cp "$1" app/public/index.html
pnpm --filter @suivi/shared test
echo "app/public/index.html mis à jour. Vérifier « git diff --stat », puis ouvrir une pull request."
