#!/usr/bin/env bash
# Recherche quotidienne d'une nouvelle version publiée (EXPL-05). L'application n'a pas d'accès Internet : ce script,
# planifié sur le serveur, interroge le dépôt (étiquettes vX.Y.Z) et écrit le résultat dans
# DATA_DIR/etat/version-disponible.json, lu par l'application (bandeau pour les administrateurs).
# Rien n'est installé : la mise à jour reste une décision humaine (scripts/mettre-a-jour.sh).
#   Usage : sudo ./scripts/verifier-version.sh
#   Cron  : 40 6 * * * root cd /opt/suivi-audits && ./scripts/verifier-version.sh >> /var/log/suivi-version.log 2>&1
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"

DATA_DIR=$(dossier_donnees)
[ -d "$DATA_DIR/etat" ] || arret "$DATA_DIR/etat introuvable (application démarrée au moins une fois ?)."
tags=$(git -C "$REPO" ls-remote --tags --refs origin 'v*' 2> /dev/null) || arret "dépôt injoignable (git ls-remote) : vérifier la clé de déploiement et les flux sortants."
derniere=$(printf '%s\n' "$tags" | sed -n 's|.*refs/tags/v\([0-9]*\.[0-9]*\.[0-9]*\)$|\1|p' | sort -V | tail -n 1)
[ -n "$derniere" ] || { info "Aucune version publiée."; exit 0; }
actuelle=$(valeur_env APP_VERSION)
printf '{"derniere":"%s","actuelle":%s,"verifieeLe":"%s","notes":"https://github.com/yousername-ha/suivi-audits/releases/tag/v%s"}\n' \
  "$derniere" "$(json_chaine "$actuelle")" "$(horodatage)" "$derniere" | ecrire_etat "$DATA_DIR/etat/version-disponible.json"
info "$(horodatage) version en service : $actuelle ; dernière version publiée : $derniere"
