#!/usr/bin/env bash
# Charge un jeu de données (archive .zip contenant un « jeu.json », ou fichier .json) sur la recette locale :
#   sudo ./scripts/dev/charger-jeu.sh <archive.zip | jeu.json> [compte administrateur]
# Le jeu se charge sur une instance dont le pilotage est VIDE, au nom du compte indiqué (« recette » par défaut).
# Le dépôt ne contient aucun jeu : le fichier reste sur le poste de la personne qui le charge.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ "$(id -u)" = 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }
fichier="${1:-}"
compte="${2:-recette}"
[ -f "$fichier" ] || { echo "Fichier introuvable : ${fichier:-(aucun)}. Usage : sudo ./scripts/dev/charger-jeu.sh <archive.zip> [compte]" >&2; exit 1; }

case "$fichier" in
  *.zip)
    # Extraction en mémoire du premier « jeu.json » de l'archive (python3 est présent sur Ubuntu ; unzip pas toujours).
    python3 -c 'import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
noms = [n for n in z.namelist() if n.endswith("jeu.json")]
if not noms: sys.exit("Aucun jeu.json dans cette archive.")
sys.stdout.buffer.write(z.read(noms[0]))' "$fichier"
    ;;
  *) cat "$fichier" ;;
esac | docker compose exec -T app suivi charger-jeu "$compte" --confirmer

echo "Jeu chargé. Rechargez la page de la plateforme (https://localhost)."
