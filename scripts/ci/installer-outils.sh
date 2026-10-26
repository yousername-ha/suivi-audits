#!/usr/bin/env bash
# Installe des outils de CI depuis leurs publications GitHub officielles, vérifiés par une empreinte SHA-256 figée ici
# (ADR 0063). Aucune image Docker ni étiquette mobile : une version republiée ou altérée est refusée.
#   scripts/ci/installer-outils.sh trivy gitleaks
# Les binaires vont dans $RUNNER_TEMP/outils (ou un dossier temporaire) et ce dossier est ajouté à GITHUB_PATH.
# Mettre à jour un outil : changer la version ET l'empreinte, relevée dans le fichier *_checksums.txt de la publication,
# après lecture des notes de version (Trivy 0.69.4 à 0.69.6 ont été compromis en mars 2026, CVE-2026-33634).
set -euo pipefail

declare -A VERSION=([trivy]=0.75.0 [gitleaks]=8.28.0)
declare -A SHA256=(
  [trivy]=c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f
  [gitleaks]=a65b5253807a68ac0cafa4414031fd740aeb55f54fb7e55f386acb52e6a840eb
)
url() {
  case "$1" in
    trivy) echo "https://github.com/aquasecurity/trivy/releases/download/v$2/trivy_$2_Linux-64bit.tar.gz" ;;
    gitleaks) echo "https://github.com/gitleaks/gitleaks/releases/download/v$2/gitleaks_$2_linux_x64.tar.gz" ;;
  esac
}

[ $# -gt 0 ] || { echo "usage : $0 trivy|gitleaks…" >&2; exit 2; }
DEST="${RUNNER_TEMP:-$(mktemp -d)}/outils"
mkdir -p "$DEST/bin"
for outil in "$@"; do
  [ -n "${VERSION[$outil]:-}" ] || { echo "Outil inconnu : $outil" >&2; exit 2; }
  archive="$DEST/$outil.tar.gz"
  curl -fsSL --retry 3 --proto '=https' --tlsv1.2 -o "$archive" "$(url "$outil" "${VERSION[$outil]}")"
  echo "${SHA256[$outil]}  $archive" | sha256sum -c --quiet - || { echo "Empreinte de $outil incorrecte : refus." >&2; exit 1; }
  tar -xzf "$archive" -C "$DEST/bin" "$outil"
  rm -f "$archive"
  echo "$outil ${VERSION[$outil]} vérifié (sha256 ${SHA256[$outil]:0:12}…)"
done
if [ -n "${GITHUB_PATH:-}" ]; then echo "$DEST/bin" >> "$GITHUB_PATH"; else echo "export PATH=\"$DEST/bin:\$PATH\""; fi
