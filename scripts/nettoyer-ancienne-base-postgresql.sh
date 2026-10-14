#!/usr/bin/env bash
# Supprime l'ancien dossier de la base PostgreSQL 17 conservé après la migration vers PostgreSQL 18 (ADR 0035).
#   Usage :  sudo ./scripts/nettoyer-ancienne-base-postgresql.sh [--oui]
# À lancer seulement après avoir vérifié l'application : la suppression ôte la possibilité de revenir à la version précédente
# sans restaurer une sauvegarde. L'ancienne base est le dossier DATA_DIR/postgres ; la base 18 est dans DATA_DIR/postgres18 et
# n'est jamais touchée. Refuse d'agir si la base 18 n'existe pas ou si l'application n'est pas saine.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"

OUI=0
[ "${1:-}" = --oui ] && OUI=1
exiger_root
DATA_DIR=$(dossier_donnees)
verifier_chemin_donnees "$DATA_DIR"
ANCIEN="$DATA_DIR/postgres"
nouvelle=$(postgresql_majeure_compose)
[[ "$nouvelle" =~ ^[0-9]+$ ]] || arret "version de PostgreSQL introuvable dans docker-compose.yml."
[ "$(tr -d '[:space:]' < "$DATA_DIR/postgres$nouvelle/$nouvelle/docker/PG_VERSION" 2> /dev/null || true)" = "$nouvelle" ] \
  || arret "la base PostgreSQL $nouvelle est introuvable dans $DATA_DIR/postgres$nouvelle : rien à nettoyer, rien n'est supprimé."
ancienne=$(postgresql_majeure_ancienne)
[ -n "$ancienne" ] || { info "Aucune ancienne base à supprimer."; exit 0; }
[[ "$ancienne" =~ ^[0-9]+$ ]] && [ "$ancienne" -lt "$nouvelle" ] || arret "le dossier $ANCIEN contient une base $ancienne qui n'est pas plus ancienne que la $nouvelle."
st=$(docker inspect -f '{{.State.Health.Status}}' "$(dc ps -q app 2> /dev/null)" 2> /dev/null || true)
[ "$st" = healthy ] || arret "l'application n'est pas en bon état : vérifier d'abord son fonctionnement (docker compose ps)."
taille=$(du -sb "$ANCIEN" | cut -f1)
info "Ancienne base PostgreSQL $ancienne : $((taille / 1048576)) Mo à libérer ($ANCIEN ; la base $nouvelle est conservée)."
if [ "$OUI" != 1 ]; then
  printf "Cette suppression est définitive. Taper SUPPRIMER pour continuer : "
  read -r r < /dev/tty
  [ "$r" = SUPPRIMER ] || arret "abandon : rien n'a été supprimé."
fi
[ ! -L "$ANCIEN" ] || arret "$ANCIEN est un lien : suppression refusée."
rm -rf -- "$ANCIEN"
rm -rf -- "$DATA_DIR/postgres$nouvelle"/.perimee-* "$DATA_DIR/postgres$nouvelle/.migre-depuis-postgres"
info "Ancienne base PostgreSQL $ancienne supprimée ; la base $nouvelle est en service."
