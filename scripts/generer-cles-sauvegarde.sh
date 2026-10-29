#!/usr/bin/env bash
# Prépare le chiffrement des sauvegardes (age) : clé du serveur + clé publique de secours du RSSI.
#   Usage :  sudo ./scripts/generer-cles-sauvegarde.sh [--secours age1… [--confirmer]]
# - Génère l'identité du serveur (BACKUP_KEY_FILE, défaut /root/.suivi-backup-key, droits 0600) si elle n'existe pas ;
#   elle n'est jamais affichée ni écrasée.
# - Enregistre la clé PUBLIQUE de secours (BACKUP_RECIPIENTS_FILE, défaut /root/.suivi-backup-recipients) après
#   confirmation explicite. La clé privée de secours se génère HORS du serveur, par exemple sur le poste du RSSI :
#       age-keygen -o secours.key          # affiche « Public key: age1… » ; ranger secours.key hors ligne
#   Seule la ligne « age1… » est donnée à ce script. Chaque archive est chiffrée pour le serveur ET pour cette clé :
#   elle permet de restaurer si le serveur et sa clé sont perdus. Tester la restauration avec elle avant d'en dépendre.
# --confirmer : confirmation donnée d'avance (installation non interactive, recette) ; sans option --secours, rien n'est enregistré.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
exiger_root "$@"
command -v age > /dev/null && command -v age-keygen > /dev/null || arret "outil « age » absent : sudo apt-get install -y age (voir docs/INSTALLATION.md)."

CLE="${BACKUP_KEY_FILE:-/root/.suivi-backup-key}"
SECOURS="${BACKUP_RECIPIENTS_FILE:-/root/.suivi-backup-recipients}"
MOTIF='^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$'
PUBLIQUE_SECOURS=""
CONFIRME=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --secours) [ "$#" -ge 2 ] || arret "--secours attend une clé publique age1…"; PUBLIQUE_SECOURS="$2"; shift 2 ;;
    --confirmer) CONFIRME=1; shift ;;
    *) arret "Usage : $0 [--secours age1… [--confirmer]]" ;;
  esac
done
[ -z "$PUBLIQUE_SECOURS" ] || [[ "$PUBLIQUE_SECOURS" =~ $MOTIF ]] || arret "ce n'est pas une clé publique age (age1…, 62 caractères). Ne jamais fournir une clé privée (AGE-SECRET-KEY-…)."
[ "$CONFIRME" = 0 ] || [ -n "$PUBLIQUE_SECOURS" ] || arret "--confirmer ne s'utilise qu'avec --secours."

etape "Clé de sauvegarde du serveur"
if [ -e "$CLE" ] || [ -L "$CLE" ]; then
  [ -f "$CLE" ] && [ ! -L "$CLE" ] && [ -s "$CLE" ] || arret "$CLE existe mais n'est pas un fichier de clé régulier : le vérifier avant de relancer."
  chmod 600 "$CLE"
  age-keygen -y "$CLE" > /dev/null 2>&1 || arret "$CLE existe mais n'est pas une identité age valide : ne pas l'écraser sans l'avoir examiné."
  info "Clé déjà présente : conservée ($CLE)."
else
  mkdir -p "$(dirname "$CLE")"
  ( umask 077 && age-keygen -o "$CLE" > /dev/null 2>&1 ) || { rm -f "$CLE"; arret "génération de la clé impossible."; }
  chmod 600 "$CLE"
  info "Clé générée ($CLE, droits 0600). Elle ne quitte pas le serveur ; la sauvegarder séparément n'est pas nécessaire grâce à la clé de secours."
fi
info "Clé publique du serveur : $(age-keygen -y "$CLE")"

etape "Clé publique de secours (RSSI)"
if [ -z "$PUBLIQUE_SECOURS" ]; then
  if [ -s "$SECOURS" ]; then
    info "Clé de secours déjà enregistrée ($SECOURS) :"
    grep -v '^#' "$SECOURS" | sed 's/^/  /'
    info "Pour la remplacer : relancer avec --secours age1…"
    exit 0
  fi
  [ -t 0 ] || arret "aucune clé de secours enregistrée : relancer avec --secours age1… (clé publique générée hors du serveur : age-keygen -o secours.key)."
  info "Générer la clé de secours HORS de ce serveur : age-keygen -o secours.key (ranger secours.key hors ligne)."
  read -r -p "Coller ici la clé PUBLIQUE de secours (age1…) : " PUBLIQUE_SECOURS
  [[ "$PUBLIQUE_SECOURS" =~ $MOTIF ]] || arret "ce n'est pas une clé publique age (age1…). Ne jamais saisir une clé privée."
fi
if [ "$CONFIRME" = 0 ]; then
  [ -t 0 ] || arret "confirmation requise : relancer en terminal, ou ajouter --confirmer."
  info "Les prochaines sauvegardes seront lisibles par le détenteur de : $PUBLIQUE_SECOURS"
  read -r -p "Enregistrer cette clé de secours ? Taper ENREGISTRER pour confirmer : " REP
  [ "$REP" = ENREGISTRER ] || arret "abandon, rien n'a été enregistré."
fi
mkdir -p "$(dirname "$SECOURS")"
TMP="$(umask 077 && mktemp "$SECOURS.XXXXXX")"
printf '# Clés publiques de secours (age). Enregistré le %s.\n%s\n' "$(horodatage)" "$PUBLIQUE_SECOURS" > "$TMP"
chmod 600 "$TMP"
mv -f "$TMP" "$SECOURS"
info "Clé de secours enregistrée ($SECOURS)."
controler_cles_sauvegarde "$CLE" "$SECOURS"
info "Terminé. Prochaine étape : une sauvegarde, puis tester la restauration avec la clé de secours :"
info "  sudo BACKUP_KEY_FILE=/chemin/secours.key ./scripts/restore.sh --verifier <archive>.tar.age"
