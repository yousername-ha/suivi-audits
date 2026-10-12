#!/usr/bin/env bash
# Recette automatisée du serveur (cas TEST-041 et TEST-045 du plan de recette), à lancer sur le serveur lui-même,
# après une installation ou une mise à jour. Elle ne modifie aucune donnée métier et n'a besoin d'aucun compte :
# elle contrôle l'état des conteneurs, la version, les migrations, l'intégrité des données (documents chiffrés relus),
# HTTPS et le certificat, les en-têtes de sécurité, le refus des accès sans session, les droits du dossier des
# données, la dernière sauvegarde et, avec --avec-sauvegarde, une sauvegarde chiffrée réelle suivie de la
# vérification de son archive (restore.sh --verifier, sans restauration).
# Elle ne remplace pas la recette humaine (ergonomie, parcours métier) ni une restauration sur une autre machine.
#   Usage :  sudo [BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass] ./scripts/recette-serveur.sh [--version X.Y.Z]
#                 [--avec-sauvegarde] [--sortie DOSSIER]
# Rapports (sans secret) : DOSSIER, par défaut DATA_DIR/etat/recette/recette-AAAAMMJJ-HHMMSS.{md,json}.
# Code de sortie : 0 si aucun contrôle n'a échoué (les avertissements ne font pas échouer), 1 sinon.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
. "$REPO/scripts/lib-commun.sh"

VERSION_ATTENDUE=''
AVEC_SAUVEGARDE=0
SORTIE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      VERSION_ATTENDUE="${2:-}"
      shift 2 || arret "--version attend un numéro."
      ;;
    --avec-sauvegarde)
      AVEC_SAUVEGARDE=1
      shift
      ;;
    --sortie)
      SORTIE="${2:-}"
      shift 2 || arret "--sortie attend un dossier."
      ;;
    *) arret "Option inconnue : $1 (voir l'en-tête du script)." ;;
  esac
done
[ -z "$VERSION_ATTENDUE" ] || [[ "$VERSION_ATTENDUE" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$ ]] || arret "Version attendue invalide."
exiger_root "$@"
command -v docker > /dev/null || arret "Docker est requis."
command -v curl > /dev/null || arret "curl est requis."

DATA_DIR=$(dossier_donnees)
SITE=$(valeur_env SITE_ADDRESS)
PORT=$(valeur_env HTTPS_PORT 443)
HTTP_PORT=$(valeur_env HTTP_PORT 80)
[ -n "$SITE" ] || arret "SITE_ADDRESS absent de .env."
DEBUT=$(date +%s)
STAMP=$(date +%Y%m%d-%H%M%S)
SORTIE="${SORTIE:-$DATA_DIR/etat/recette}"
LIGNES=()
NB_OK=0
NB_KO=0
NB_AVERT=0

# resultat (PASSÉ | ÉCHOUÉ | AVERTISSEMENT) identifiant libellé détail
noter() {
  local res="$1" id="$2" libelle="$3" detail="${4:-}"
  case "$res" in
    PASSÉ) NB_OK=$((NB_OK + 1)) ;;
    ÉCHOUÉ) NB_KO=$((NB_KO + 1)) ;;
    *) NB_AVERT=$((NB_AVERT + 1)) ;;
  esac
  printf '%-14s %s — %s%s\n' "$res" "$id" "$libelle" "${detail:+ ($detail)}"
  LIGNES+=("$res"$'\t'"$id"$'\t'"$libelle"$'\t'"$detail")
}
site() { curl -sk --max-time 15 --resolve "$SITE:$PORT:127.0.0.1" "$@"; }
URL="https://$SITE:$PORT"

etape "Recette du serveur ($SITE) — $(horodatage)"

# --- Conteneurs ---------------------------------------------------------------------------------------------
init_id=$(dc ps -aq init 2> /dev/null | head -n 1)
if [ -n "$init_id" ] && [ "$(docker inspect -f '{{.State.ExitCode}}' "$init_id" 2> /dev/null)" = 0 ]; then
  noter PASSÉ R01 "Service d'initialisation terminé sans erreur"
else
  noter ÉCHOUÉ R01 "Service d'initialisation terminé sans erreur" "conteneur init absent ou en erreur"
fi
for s in db app; do
  id=$(dc ps -q "$s" 2> /dev/null | head -n 1)
  st=$([ -n "$id" ] && docker inspect -f '{{.State.Health.Status}}' "$id" 2> /dev/null || echo absent)
  if [ "$st" = healthy ]; then noter PASSÉ "R02-$s" "Conteneur $s en bonne santé"; else noter ÉCHOUÉ "R02-$s" "Conteneur $s en bonne santé" "état : $st"; fi
done
web_id=$(dc ps -q web 2> /dev/null | head -n 1)
if [ -n "$web_id" ] && [ "$(docker inspect -f '{{.State.Running}}' "$web_id" 2> /dev/null)" = true ]; then
  noter PASSÉ R03 "Conteneur web en marche"
else
  noter ÉCHOUÉ R03 "Conteneur web en marche"
fi
if [ -n "$web_id" ] && [ "$(dc exec -T app id -u 2> /dev/null | tr -d '\r')" = 1000 ] && [ "$(dc exec -T web id -u 2> /dev/null | tr -d '\r')" = 1001 ]; then
  noter PASSÉ R04 "Conteneurs applicatifs sans droits root"
else
  noter ÉCHOUÉ R04 "Conteneurs applicatifs sans droits root" "app attendu 1000, web attendu 1001"
fi

# --- Version et migrations ----------------------------------------------------------------------------------
pret=$(dc exec -T app node -e "fetch('http://127.0.0.1:8080/api/health/ready').then(r=>r.text()).then(t=>console.log(t)).catch(e=>console.log(e.message))" 2> /dev/null || true)
version=$(printf '%s' "$pret" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
case "$pret" in
  *'"pret":true'*'"migrationsEnAttente":[]'*) noter PASSÉ R05 "Base joignable, migrations toutes appliquées" ;;
  *) noter ÉCHOUÉ R05 "Base joignable, migrations toutes appliquées" "${pret:-aucune réponse}" ;;
esac
if [ -n "$VERSION_ATTENDUE" ]; then
  if [ "$version" = "$VERSION_ATTENDUE" ]; then noter PASSÉ R06 "Version en service : $version"; else noter ÉCHOUÉ R06 "Version en service" "attendue $VERSION_ATTENDUE, en service ${version:-inconnue}"; fi
else
  noter AVERTISSEMENT R06 "Version en service : ${version:-inconnue}" "aucune version attendue indiquée (--version)"
fi

# --- Intégrité des données ------------------------------------------------------------------------------------
if controle=$(dc exec -T app suivi controle-donnees 2>&1); then
  noter PASSÉ R07 "Contrôle des données (enregistrements comptés, documents chiffrés relus)"
else
  noter ÉCHOUÉ R07 "Contrôle des données (enregistrements comptés, documents chiffrés relus)" "$(printf '%s' "$controle" | tr '\n' ' ' | cut -c1-200)"
fi

# --- HTTPS, certificat, en-têtes --------------------------------------------------------------------------------
if [ "$(site "$URL/healthz" || true)" = ok ]; then noter PASSÉ R08 "Site HTTPS joignable (/healthz)"; else noter ÉCHOUÉ R08 "Site HTTPS joignable (/healthz)" "$URL"; fi
redir=$(curl -s --max-time 15 --resolve "$SITE:$HTTP_PORT:127.0.0.1" -o /dev/null -w '%{http_code}' "http://$SITE:$HTTP_PORT/setup" || true)
if [ "$redir" = 308 ] || [ "$redir" = 301 ]; then noter PASSÉ R09 "HTTP redirigé vers HTTPS"; else noter ÉCHOUÉ R09 "HTTP redirigé vers HTTPS" "code $redir"; fi
if command -v openssl > /dev/null; then
  cert=$(echo | openssl s_client -connect "127.0.0.1:$PORT" -servername "$SITE" 2> /dev/null | openssl x509 2> /dev/null || true)
  if [ -z "$cert" ]; then
    noter ÉCHOUÉ R10 "Certificat TLS lisible" "aucun certificat présenté"
  elif ! printf '%s' "$cert" | openssl x509 -noout -checkend 0 > /dev/null 2>&1; then
    noter ÉCHOUÉ R10 "Certificat TLS valide" "expiré"
  else
    noter PASSÉ R10 "Certificat TLS valide" "$(printf '%s' "$cert" | openssl x509 -noout -enddate | sed 's/^notAfter=/échéance : /')"
  fi
else
  noter AVERTISSEMENT R10 "Certificat TLS" "openssl absent"
fi
entetes=$(site -I "$URL/" || true)
verifie_entete() { # identifiant libellé motif
  if printf '%s' "$entetes" | tr -d '\r' | grep -qiE "$3"; then noter PASSÉ "$1" "$2"; else noter ÉCHOUÉ "$1" "$2" "en-tête absent ou différent"; fi
}
verifie_entete R11 "Politique de sécurité du contenu stricte (CSP)" "^content-security-policy: default-src 'self'; script-src 'self'; style-src 'self'"
verifie_entete R12 "Transport sécurisé imposé (HSTS)" '^strict-transport-security:'
verifie_entete R13 "Type de contenu non devinable" '^x-content-type-options: nosniff'

# --- Accès sans session ------------------------------------------------------------------------------------------
n=0
for chemin in /api/events /api/version /api/openapi.json /api/grc/smsis; do
  n=$((n + 1))
  code=$(site -o /dev/null -w '%{http_code}' "$URL$chemin" || true)
  if [ "$code" = 401 ]; then noter PASSÉ "R14.$n" "Accès sans session refusé ($chemin)"; else noter ÉCHOUÉ "R14.$n" "Accès sans session refusé ($chemin)" "code $code, 401 attendu"; fi
done
code=$(site -o /dev/null -w '%{http_code}' -X POST -H 'Origin: https://autre-site.invalide' -H 'Content-Type: application/json' -d '{}' "$URL/api/auth/logout" || true)
case "$code" in
  4??) noter PASSÉ R15 "Requête modifiante d'une autre origine refusée" ;;
  *) noter ÉCHOUÉ R15 "Requête modifiante d'une autre origine refusée" "code $code, 4xx attendu" ;;
esac

# --- Dossier des données ---------------------------------------------------------------------------------------
if donnees_preparees; then noter PASSÉ R16 "Dossier des données préparé ($DATA_DIR)"; else noter ÉCHOUÉ R16 "Dossier des données préparé" "$DATA_DIR sans marqueur"; fi
if [ -d "$DATA_DIR/secrets" ]; then
  # Le dossier peut se traverser (conteneurs sous d'autres identifiants) ; aucun fichier ne doit être accessible à « autres ».
  ouverts=$(find "$DATA_DIR/secrets" "$DATA_DIR/update-secrets" "$DATA_DIR/postgres" -maxdepth 2 -type f -perm /007 2> /dev/null | wc -l)
  if [ "$ouverts" = 0 ]; then noter PASSÉ R17 "Aucun fichier de secret ou de base accessible à tous"; else noter ÉCHOUÉ R17 "Aucun fichier de secret ou de base accessible à tous" "$ouverts fichier(s) ouvert(s) à « autres »"; fi
else
  noter ÉCHOUÉ R17 "Aucun fichier de secret accessible à tous" "dossier secrets absent"
fi
libre=$(octets_libres "$DATA_DIR")
if [ "${libre:-0}" -ge 2147483648 ]; then noter PASSÉ R18 "Espace disque libre suffisant ($((libre / 1073741824)) Go)"; else noter AVERTISSEMENT R18 "Espace disque libre" "moins de 2 Go"; fi

# --- Sauvegardes ------------------------------------------------------------------------------------------------
derniere="$DATA_DIR/etat/sauvegardes/derniere.json"
if [ -f "$derniere" ]; then
  date_sauv=$(sed -n 's/.*"date":"\([^"]*\)".*/\1/p' "$derniere" | head -n 1)
  age=$(($(date +%s) - $(date -d "${date_sauv:-1970-01-01}" +%s 2> /dev/null || echo 0)))
  if ! grep -q '"resultat":"reussie"' "$derniere"; then
    noter ÉCHOUÉ R19 "Dernière sauvegarde réussie" "le dernier rapport indique un échec"
  elif [ "$age" -gt 172800 ]; then
    noter AVERTISSEMENT R19 "Dernière sauvegarde récente" "plus de 48 h ($date_sauv)"
  else
    noter PASSÉ R19 "Dernière sauvegarde réussie et récente ($date_sauv)"
  fi
else
  noter AVERTISSEMENT R19 "Dernière sauvegarde" "aucun rapport de sauvegarde (planification à configurer)"
fi
if [ "$AVEC_SAUVEGARDE" = 1 ]; then
  if [ -z "${BACKUP_PASSPHRASE_FILE:-}" ] || [ ! -f "${BACKUP_PASSPHRASE_FILE:-}" ]; then
    noter ÉCHOUÉ R20 "Sauvegarde chiffrée puis vérification de l'archive" "BACKUP_PASSPHRASE_FILE absent ou illisible"
  else
    tmp=$(mktemp -d)
    # Le dossier temporaire ne contient que l'archive chiffrée, supprimée en fin de contrôle.
    if "$REPO/scripts/backup.sh" "$tmp" > "$tmp/backup.log" 2>&1; then
      archive=$(find "$tmp" -maxdepth 1 \( -name '*.tar.enc' -o -name '*.tar' \) | head -n 1)
      if [ -n "$archive" ] && "$REPO/scripts/restore.sh" --verifier "$archive" > "$tmp/verif.log" 2>&1; then
        noter PASSÉ R20 "Sauvegarde chiffrée réelle et archive vérifiée (restauration non exécutée)"
      else
        noter ÉCHOUÉ R20 "Archive de sauvegarde vérifiable" "$(tail -n 2 "$tmp/verif.log" 2> /dev/null | tr '\n' ' ' | cut -c1-200)"
      fi
    else
      noter ÉCHOUÉ R20 "Sauvegarde chiffrée réelle" "$(tail -n 2 "$tmp/backup.log" | tr '\n' ' ' | cut -c1-200)"
    fi
    rm -rf "$tmp"
  fi
else
  noter AVERTISSEMENT R20 "Sauvegarde chiffrée puis vérification de l'archive" "non lancée (option --avec-sauvegarde)"
fi

# --- Rapport ----------------------------------------------------------------------------------------------------
install -d -m 0755 "$SORTIE"
MD="$SORTIE/recette-$STAMP.md"
JS="$SORTIE/recette-$STAMP.json"
bilan=PASSÉ
[ "$NB_KO" = 0 ] || bilan=ÉCHOUÉ
{
  printf '# Recette automatisée du serveur\n\n'
  printf -- '- Date : %s (UTC)\n- Site : %s\n- Version en service : %s\n- Version attendue : %s\n' "$(horodatage)" "$SITE" "${version:-inconnue}" "${VERSION_ATTENDUE:-non précisée}"
  printf -- '- Bilan : **%s** — %s réussis, %s échoués, %s avertissements (%s s)\n\n' "$bilan" "$NB_OK" "$NB_KO" "$NB_AVERT" "$(($(date +%s) - DEBUT))"
  printf '| Résultat | Contrôle | Libellé | Détail |\n| --- | --- | --- | --- |\n'
  for l in "${LIGNES[@]}"; do
    IFS=$'\t' read -r r i lb d <<< "$l"
    printf '| %s | %s | %s | %s |\n' "$r" "$i" "${lb//|/\\|}" "${d//|/\\|}"
  done
  printf '\nCe rapport ne contient aucun secret. Il ne remplace ni la recette humaine ni une restauration sur une autre machine.\n'
} > "$MD"
{
  printf '{"date":"%s","site":%s,"versionEnService":%s,"versionAttendue":%s,"bilan":"%s","reussis":%s,"echoues":%s,"avertissements":%s,"controles":[' \
    "$(horodatage)" "$(json_chaine "$SITE")" "$(json_chaine "${version:-}")" "$(json_chaine "$VERSION_ATTENDUE")" "$bilan" "$NB_OK" "$NB_KO" "$NB_AVERT"
  sep=''
  for l in "${LIGNES[@]}"; do
    IFS=$'\t' read -r r i lb d <<< "$l"
    printf '%s{"id":%s,"resultat":%s,"libelle":%s,"detail":%s}' "$sep" "$(json_chaine "$i")" "$(json_chaine "$r")" "$(json_chaine "$lb")" "$(json_chaine "$d")"
    sep=','
  done
  printf ']}\n'
} > "$JS"
chmod 0644 "$MD" "$JS"
etape "Bilan : $bilan — $NB_OK réussis, $NB_KO échoués, $NB_AVERT avertissements"
info "Rapports : $MD et $JS"
[ "$NB_KO" = 0 ]
