#!/usr/bin/env bash
# Sauvegarde complète (EXPL-08) : base PostgreSQL (format custom), secrets (clé de chiffrement des documents, mots de
# passe) et autorité de certification interne du frontal, lus dans le dossier des données DATA_DIR.
# Sans les secrets, les documents sauvegardés sont indéchiffrables : tout est archivé ensemble, puis chiffré avec age
# (format v1, chiffrement authentifié) pour DEUX destinataires : la clé du serveur (BACKUP_KEY_FILE) et la clé de secours
# du RSSI, conservée hors ligne, dont le serveur ne détient que la clé publique (BACKUP_RECIPIENTS_FILE). Le chiffrement
# est obligatoire : aucune archive en clair n'est produite (ADR 0071). Préparer les clés : sudo ./scripts/generer-cles-sauvegarde.sh
# Un rapport est écrit dans DATA_DIR/etat/sauvegardes/ (affiché dans Administration > Système, alerte au-delà de 48 h).
#   Usage :  sudo ./scripts/backup.sh [/chemin/destination]
#   Cron  :  15 2 * * *  root cd /opt/suivi-audits && ./scripts/backup.sh /srv/sauvegardes/suivi-audits
# Variables : BACKUP_KEY_FILE (identité age du serveur, défaut DATA_DIR/cles-sauvegarde/serveur.key, 0600),
#             BACKUP_RECIPIENTS_FILE (clés publiques de secours, défaut DATA_DIR/cles-sauvegarde/secours.pub),
#             RETENTION_DAYS (90 par défaut, sauvegardes du dossier de destination uniquement, sous-dossiers exclus),
#             BACKUP_GARDER_MIN (nombre de sauvegardes les plus récentes toujours conservées, 7 par défaut, de 1 à 365),
#             BACKUP_PREFIXE (début du nom de fichier, « suivi-audits » par défaut).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"

DEST="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
GARDER_MIN="${BACKUP_GARDER_MIN:-7}"
PREFIXE="${BACKUP_PREFIXE:-suivi-audits}"
CLE="$(cle_sauvegarde_serveur)"
SECOURS="$(cles_sauvegarde_secours)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEBUT=$(date +%s)
DATA_DIR=$(dossier_donnees)
RAPPORTS="$DATA_DIR/etat/sauvegardes"
JOB_ID="${BACKUP_JOB_ID:-}"
if [ -n "$JOB_ID" ]; then
  [[ "$JOB_ID" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] || arret "Identifiant de demande invalide."
fi
WORK="$(mktemp -d)"
OUT=''
TEMP_OUT=''
SHA=''
VERIFIEE=false

rapport() { # resultat message
  local taille=null chiffree=false
  [ -n "$OUT" ] && [ -f "$OUT" ] && taille=$(stat -c %s "$OUT")
  case "$OUT" in *.age) chiffree=true ;; esac
  printf '{"date":"%s","resultat":"%s","fichier":%s,"tailleOctets":%s,"chiffree":%s,"dureeSecondes":%s,"sha256":%s,"integriteVerifiee":%s,"jobId":%s,"message":%s}\n' \
    "$(horodatage)" "$1" "$(json_chaine "$OUT")" "$taille" "$chiffree" "$(($(date +%s) - DEBUT))" "$(json_chaine "$SHA")" "$VERIFIEE" "$(json_chaine "$JOB_ID")" "$(json_chaine "$2")"
}
fin() {
  local code=$?
  rm -rf "$WORK"
  [ -z "$TEMP_OUT" ] || rm -f "$TEMP_OUT"
  if [ -d "$DATA_DIR/etat" ] && [ -w "$DATA_DIR/etat" ]; then
    if [ -n "$JOB_ID" ]; then
      if [ "$code" = 0 ]; then rapport reussie ''; else rapport echec "code de sortie $code"; fi | ecrire_etat "$RAPPORTS/jobs/$JOB_ID.json"
    fi
    if [ "$code" = 0 ]; then
      local r
      r=$(rapport reussie '')
      printf '%s\n' "$r" | ecrire_etat "$RAPPORTS/derniere-reussie.json"
      printf '%s\n' "$r" | ecrire_etat "$RAPPORTS/derniere.json"
    else
      rapport echec "code de sortie $code" | ecrire_etat "$RAPPORTS/derniere.json"
    fi
  fi
}
trap fin EXIT
umask 077
[[ "$RETENTION_DAYS" =~ ^[0-9]{1,5}$ ]] && [ "$RETENTION_DAYS" -ge 1 ] && [ "$RETENTION_DAYS" -le 36500 ] || arret "RETENTION_DAYS doit être compris entre 1 et 36500."
[[ "$GARDER_MIN" =~ ^[0-9]{1,3}$ ]] && [ "$GARDER_MIN" -ge 1 ] && [ "$GARDER_MIN" -le 365 ] || arret "BACKUP_GARDER_MIN doit être compris entre 1 et 365."
[[ "$PREFIXE" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,60}$ ]] || arret "Préfixe de sauvegarde invalide."
controler_cles_sauvegarde "$CLE" "$SECOURS"
PUBLIQUE=$(age-keygen -y "$CLE")
[ -d "$DATA_DIR/etat" ] || arret "Dossier d'état absent."
if [ "${BACKUP_SAUVEGARDE_LOCK_HELD:-}" != 1 ]; then
  if [ "${UPDATE_SAUVEGARDE_LOCK_HELD:-}" != 1 ]; then exec 9> "$DATA_DIR/etat/sauvegarde.lock"; fi
fi
flock -n 9 || arret "Une sauvegarde est déjà en cours."
mkdir -p "$DEST"

[ -d "$DATA_DIR/secrets" ] || arret "secrets introuvables dans $DATA_DIR/secrets (DATA_DIR de .env)."
docker compose exec -T -u postgres db pg_dump -d suivi -Fc --no-owner > "$WORK/suivi.dump"
tar czf "$WORK/secrets.tgz" -C "$DATA_DIR/secrets" .
membres=(suivi.dump secrets.tgz INFO)
# Autorité de certification interne (CADDY_TLS=internal) : la conserver évite de redéployer le certificat racine.
if [ -d "$DATA_DIR/caddy/data" ]; then
  tar czf "$WORK/caddy.tgz" -C "$DATA_DIR/caddy/data" .
  membres+=(caddy.tgz)
fi
OUT="$DEST/$PREFIXE-$STAMP${JOB_ID:+-$JOB_ID}.tar.age"
[ ! -e "$OUT" ] || arret "Archive déjà présente ; ne pas écraser une sauvegarde."
docker compose exec -T -u postgres db psql -d suivi -Atc "SELECT 'version_donnees=' || version FROM app_state" > "$WORK/INFO" || true
# L'INFO lie le contenu au nom de fichier, à l'instant (UTC), à la demande et à la version : une archive valide renommée ou
# rejouée à la place d'une autre est refusée à la restauration et à la vérification.
{
  echo "date=$STAMP"
  echo "fichier=$(basename "$OUT")"
  echo "horodatage_utc=$(date -u +%Y%m%dT%H%M%SZ)"
  echo "job_id=$JOB_ID"
  echo "version_application=$(valeur_env APP_VERSION)"
  echo "migrations=$(migrations_appliquees | tail -n 1)"
} >> "$WORK/INFO"
# L'archive contenant les secrets reste dans le dossier temporaire privé.
PLAIN="$WORK/complete.tar"
tar cf "$PLAIN" -C "$WORK" "${membres[@]}"
TEMP_OUT=$(mktemp "$DEST/.suivi-backup.XXXXXX")
age -r "$PUBLIQUE" -R "$SECOURS" -o "$TEMP_OUT" "$PLAIN"
# Contrôle de bout en bout avec la clé du serveur avant de publier l'archive : déchiffrement authentifié, lisible comme tar.
age -d -i "$CLE" "$TEMP_OUT" | tar tf - > /dev/null || arret "L'archive chiffrée n'a pas pu être relue avec la clé du serveur."
mv "$TEMP_OUT" "$OUT"
TEMP_OUT=''
(cd "$(dirname "$OUT")" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256")
(cd "$(dirname "$OUT")" && sha256sum -c "$(basename "$OUT").sha256" > /dev/null)
SHA=$(sha256sum "$OUT")
SHA=${SHA%% *}
VERIFIEE=true
echo "Sauvegarde : $OUT"
# Rotation dans le dossier de destination seulement : les sauvegardes « avant mise à jour » (sous-dossier) sont gardées.
# Les BACKUP_GARDER_MIN archives les plus récentes sont toujours conservées, quelle que soit leur ancienneté ; au-delà,
# une archive disparaît (avec son fichier .sha256) seulement si elle a plus de RETENTION_DAYS jours.
rang=0
while IFS= read -r -d '' ligne; do
  rang=$((rang + 1))
  [ "$rang" -gt "$GARDER_MIN" ] || continue
  archive=${ligne#*$'\t'}
  [ -n "$(find "$archive" -maxdepth 0 -mtime +"$RETENTION_DAYS")" ] || continue
  rm -f -- "$archive" "$archive.sha256"
done < <(find "$DEST" -maxdepth 1 -type f \( -name "$PREFIXE-*.tar.age" -o -name "$PREFIXE-*.tar.enc" -o -name "$PREFIXE-*.tar" \) -printf '%T@\t%p\0' | LC_ALL=C sort -z -t $'\t' -k1,1nr -k2,2r)
