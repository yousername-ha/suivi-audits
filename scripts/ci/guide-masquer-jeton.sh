#!/bin/sh
# CI, job « guide » : remplace l'affichage du jeton (étape 8.1 de docs/INSTALLATION.md).
# Vérifie que le jeton du premier démarrage figure dans les journaux, au format annoncé, sans l'afficher dans la CI.
set -eu
cd /opt/suivi-audits
out=$(sudo docker compose logs --no-log-prefix app | grep -A3 JETON || true)
tok=$(printf '%s\n' "$out" | grep -oE '[A-Z2-9]{5}(-[A-Z2-9]{5}){3}' | head -1)
[ -n "$tok" ] || { echo "::error::Guide, étape 8.1 : jeton introuvable sous la ligne « JETON » des journaux de app"; exit 1; }
echo "::add-mask::$tok"
echo "Étape 8.1 : jeton du premier démarrage présent dans les journaux (masqué)."
