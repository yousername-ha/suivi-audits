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
#             BACKUP_GARDER_MAX (nombre maximal de sauvegardes du dossier de destination, de 7 à 365 ; lu dans
#             l'environnement, sinon dans .env, sinon 30 ; l'exécutant d'exploitation transmet celui de l'application),
#             BACKUP_PREFIXE (début du nom de fichier, « suivi-audits » par défaut).
# Avant de commencer, la place est contrôlée (ADR 0106) : sans assez d'espace pour la nouvelle archive (taille de la
# dernière, ou de la base) et sa marge, la sauvegarde est refusée, avec la place libre, la place nécessaire et ce qui l'occupe.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"

DEST="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
GARDER_MIN="${BACKUP_GARDER_MIN:-7}"
GARDER_MAX="${BACKUP_GARDER_MAX:-$(valeur_env BACKUP_GARDER_MAX 30)}"
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
# Motif d'un refus explicite, repris dans le rapport (sans chemin : il est affiché dans l'application).
MOTIF=''

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
      if [ "$code" = 0 ]; then rapport reussie ''; else rapport echec "${MOTIF:-code de sortie $code}"; fi | ecrire_etat "$RAPPORTS/jobs/$JOB_ID.json"
    fi
    if [ "$code" = 0 ]; then
      local r
      r=$(rapport reussie '')
      printf '%s\n' "$r" | ecrire_etat "$RAPPORTS/derniere-reussie.json"
      printf '%s\n' "$r" | ecrire_etat "$RAPPORTS/derniere.json"
    else
      rapport echec "${MOTIF:-code de sortie $code}" | ecrire_etat "$RAPPORTS/derniere.json"
    fi
  fi
}
trap fin EXIT
umask 077
[[ "$RETENTION_DAYS" =~ ^[0-9]{1,5}$ ]] && [ "$RETENTION_DAYS" -ge 1 ] && [ "$RETENTION_DAYS" -le 36500 ] || arret "RETENTION_DAYS doit être compris entre 1 et 36500."
[[ "$GARDER_MIN" =~ ^[0-9]{1,3}$ ]] && [ "$GARDER_MIN" -ge 1 ] && [ "$GARDER_MIN" -le 365 ] || arret "BACKUP_GARDER_MIN doit être compris entre 1 et 365."
[[ "$GARDER_MAX" =~ ^[0-9]{1,3}$ ]] && [ "$GARDER_MAX" -ge 7 ] && [ "$GARDER_MAX" -le 365 ] || arret "BACKUP_GARDER_MAX doit être compris entre 7 et 365."
[[ "$PREFIXE" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,60}$ ]] || arret "Préfixe de sauvegarde invalide."
controler_cles_sauvegarde "$CLE" "$SECOURS"
PUBLIQUE=$(age-keygen -y "$CLE")
[ -d "$DATA_DIR/etat" ] || arret "Dossier d'état absent."
if [ "${BACKUP_SAUVEGARDE_LOCK_HELD:-}" != 1 ]; then
  if [ "${UPDATE_SAUVEGARDE_LOCK_HELD:-}" != 1 ]; then exec 9> "$DATA_DIR/etat/sauvegarde.lock"; fi
fi
flock -n 9 || arret "Une sauvegarde est déjà en cours."
mkdir -p "$DEST"

# ---------------------------------------------------------------- Place disponible (ADR 0106)
# Estimation : taille de la dernière sauvegarde du dossier (ou du dernier rapport réussi, ou de la base), plus une marge de
# 1 Gio ou 10 % si c'est plus. La zone de travail (TMPDIR) reçoit le dump puis l'archive en clair et sa copie de contrôle :
# deux fois la taille, plus 10 %. Si elle est sur le même disque que la destination, les deux besoins s'ajoutent.
taille_reference() {
  local t
  t=$(find "$DEST" -maxdepth 1 -type f -name '*.tar.age' -printf '%T@ %s\n' 2> /dev/null | sort -rn | head -n 1 | cut -d' ' -f2)
  [ -n "$t" ] || t=$(sed -n 's/.*"tailleOctets":\([0-9][0-9]*\).*/\1/p' "$RAPPORTS/derniere-reussie.json" 2> /dev/null | head -n 1)
  [ -n "$t" ] || t=$(docker compose exec -T -u postgres db psql -d suivi -Atc "SELECT pg_database_size('suivi')" 2> /dev/null | tr -dc '0-9' || true)
  printf '%s\n' "${t:-0}"
}
mo() { printf '%s Mo' "$((($1 + 1048575) / 1048576))"; }
TAILLE=$(taille_reference)
[[ "$TAILLE" =~ ^[0-9]{1,15}$ ]] || TAILLE=0
MARGE=$((TAILLE / 10 > 1073741824 ? TAILLE / 10 : 1073741824))
BESOIN_DEST=$((TAILLE + MARGE))
BESOIN_TRAVAIL=$((2 * TAILLE + TAILLE / 10))
LIBRE_DEST=$(octets_libres "$DEST")
LIBRE_TRAVAIL=$(octets_libres "$WORK")
if [ "$(stat -c %d "$DEST")" = "$(stat -c %d "$WORK")" ]; then
  BESOIN_DEST=$((BESOIN_DEST + BESOIN_TRAVAIL))
  BESOIN_TRAVAIL=0
fi
if [ "$LIBRE_DEST" -lt "$BESOIN_DEST" ] || [ "$LIBRE_TRAVAIL" -lt "$BESOIN_TRAVAIL" ]; then
  occupation=$(du -sb "$DEST" 2> /dev/null | cut -f1 || true)
  images=$(python3 "$REPO/scripts/images-application.py" taille 2> /dev/null || true)
  if [[ "$images" =~ ^[0-9]+$ ]]; then images=$(mo "$images"); else images='non mesurées'; fi
  if [ "$LIBRE_DEST" -lt "$BESOIN_DEST" ]; then
    MOTIF="Espace disque insuffisant pour la sauvegarde : $(mo "$LIBRE_DEST") libres dans le dossier des sauvegardes, $(mo "$BESOIN_DEST") nécessaires"
    MOTIF+=" (dernière sauvegarde $(mo "$TAILLE"), marge $(mo "$MARGE")$([ "$BESOIN_TRAVAIL" = 0 ] && printf ', zone de travail sur le même disque'))."
  else
    MOTIF="Espace de travail insuffisant pour la sauvegarde : $(mo "$LIBRE_TRAVAIL") libres dans la zone temporaire, $(mo "$BESOIN_TRAVAIL") nécessaires (deux fois la dernière sauvegarde, $(mo "$TAILLE"), plus 10 %)."
  fi
  MOTIF+=" Occupation : sauvegardes de ce dossier $(mo "${occupation:-0}"), images de l'application $images. Rien n'a été modifié :"
  MOTIF+=" externaliser puis supprimer d'anciennes sauvegardes, ou réduire leur nombre (guide d'installation, « Libérer de la place »)."
  arret "$MOTIF"
fi

[ -d "$DATA_DIR/secrets" ] || arret "secrets introuvables dans $DATA_DIR/secrets (DATA_DIR de .env)."
docker compose exec -T -u postgres db pg_dump -d suivi -Fc --no-owner > "$WORK/suivi.dump"
tar czf "$WORK/secrets.tgz" -C "$DATA_DIR/secrets" .
membres=(suivi.dump secrets.tgz INFO)
# Autorité de certification interne (CADDY_TLS=internal) : la conserver évite de redéployer le certificat racine.
if [ -d "$DATA_DIR/caddy/data" ]; then
  # Ce dossier est modifiable par le frontal (exposé à Internet) : seuls des fichiers et dossiers ordinaires sont sauvegardés,
  # comme le vérificateur de restauration les accepte. Un lien ou un fichier spécial rendrait la sauvegarde non restaurable.
  if [ -n "$(find "$DATA_DIR/caddy/data" ! -type f ! -type d -print -quit)" ]; then
    arret "caddy/data contient des liens ou des fichiers spéciaux : sauvegarde refusée (contrôler le frontal, puis les retirer)."
  fi
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
# Les membres sont maintenant dans l'archive : les retirer libère l'espace temporaire (limité dans le conteneur
# d'exécution) avant le contrôle, qui réextrait une copie, et ne laisse pas les secrets en double.
rm -f "$WORK/suivi.dump" "$WORK/secrets.tgz" "$WORK/caddy.tgz"
# Une archive déclarée « vérifiée » passe le même contrôle que la restauration : structure, bornes, secrets, INFO.
python3 "$REPO/scripts/verifier-archive-restauration.py" --nom "$(basename "$OUT")" "$PLAIN" "$WORK/controle" > /dev/null \
  || arret "L'archive ne passerait pas le contrôle de restauration : sauvegarde refusée."
rm -rf "$WORK/controle"
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
# Rotation dans le dossier de destination seulement : les sous-dossiers (sauvegardes « avant mise à jour », sauvegardes de
# sécurité des restaurations dans .restauration-securite) ne sont jamais parcourus, ni les liens. Les BACKUP_GARDER_MIN archives
# les plus récentes sont toujours conservées ; au-delà, une archive disparaît (avec son fichier .sha256) dès qu'elle a plus de
# RETENTION_DAYS jours OU qu'elle n'est pas parmi les BACKUP_GARDER_MAX plus récentes (ADR 0106). Seules les archives .tar.age
# que ce script produit tournent : celles d'anciennes versions (.tar.enc de la 5.x, .tar en clair), que cette version ne sait ni
# lire ni vérifier (ADR 0077), sont laissées à l'exploitant.
rang=0
while IFS= read -r -d '' ligne; do
  rang=$((rang + 1))
  [ "$rang" -gt "$GARDER_MIN" ] || continue
  archive=${ligne#*$'\t'}
  if [ "$rang" -le "$GARDER_MAX" ] && [ -z "$(find "$archive" -maxdepth 0 -mtime +"$RETENTION_DAYS")" ]; then continue; fi
  rm -f -- "$archive"
  # Un dossier portant ce nom n'est pas une empreinte : laissé en place (rm échouerait et ferait échouer la sauvegarde).
  if [ -L "$archive.sha256" ] || [ ! -d "$archive.sha256" ]; then rm -f -- "$archive.sha256"; fi
done < <(find "$DEST" -maxdepth 1 -type f \( -name "$PREFIXE-*.tar.age" \) -printf '%T@\t%p\0' | LC_ALL=C sort -z -t $'\t' -k1,1nr -k2,2r)
