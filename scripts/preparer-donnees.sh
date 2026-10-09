#!/usr/bin/env bash
# Prépare le dossier des données du serveur (DATA_DIR, EXPL-01) pour une NOUVELLE installation.
# Toutes les données de l'application y sont rangées (base, secrets, certificats, rapports) : rien dans les conteneurs,
# rien dans des volumes Docker. Le service « init » crée ensuite les sous-dossiers avec leurs propriétaires et droits.
#   Usage : sudo ./scripts/preparer-donnees.sh
# Serveur déjà installé avec des volumes Docker : utiliser scripts/migrer-donnees-vers-dossier.sh.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"

exiger_root
[ -f "$REPO/.env" ] || arret "fichier .env absent : le créer d'abord (docs/INSTALLATION.md, étape 6)."
DATA_DIR=$(dossier_donnees)
verifier_chemin_donnees "$DATA_DIR"

if [ -f "$DATA_DIR/$MARQUEUR" ]; then
  info "Dossier des données déjà prêt : $DATA_DIR"
  exit 0
fi
vols=$(anciens_volumes)
if [ -n "$vols" ]; then
  erreur "des données existent déjà dans des volumes Docker :"
  printf '  %s\n' $vols >&2
  arret "ce serveur est déjà installé : utilisez sudo ./scripts/migrer-donnees-vers-dossier.sh (docs/INSTALLATION.md, étape 12.5)."
fi
if dossier_occupe "$DATA_DIR"; then
  arret "$DATA_DIR existe et n'est pas vide : choisir un dossier vide, ou vérifier son contenu."
fi

mkdir -p "$DATA_DIR"
chown root:root "$DATA_DIR"
chmod 0755 "$DATA_DIR"
printf '{"creeLe":"%s","par":"preparer-donnees.sh","version":%s}\n' "$(horodatage)" "$(json_chaine "$(valeur_env APP_VERSION)")" \
  | ecrire_etat "$DATA_DIR/$MARQUEUR"
info "Dossier des données prêt : $DATA_DIR"
info "Pensez à l'inclure, avec le dossier des sauvegardes, dans la sauvegarde externalisée du serveur."
