#!/usr/bin/env bash
# Mise à jour de l'application vers une version publiée (EXPL-03), avec retour arrière automatique.
#   sudo ./scripts/mettre-a-jour.sh                 propose la dernière version publiée
#   sudo ./scripts/mettre-a-jour.sh 3.2.0           version précise
#   sudo ./scripts/mettre-a-jour.sh --verifier      simulation : affiche ce qui changerait, sans rien modifier
# Première utilisation, depuis une version qui n'a pas encore ce script :
#   sudo git fetch --tags && sudo git show v<version>:scripts/mettre-a-jour.sh | sudo bash -s -- <version>
# Options :
#   --auto              sans question (restauration comprise en cas d'échec) : pour un usage planifié et la CI
#   --sauvegardes <d>   dossier des sauvegardes (défaut /srv/sauvegardes/suivi-audits ; sous-dossier avant-mise-a-jour)
#   --delai <s>         attente maximale de la santé après démarrage (défaut 300 s)
#   --sans-signature    n'exige pas cosign (déconseillé : la provenance des images n'est alors pas vérifiée)
#   --images-locales    images déjà présentes sur le serveur (essai d'une version non publiée, CI) : ni téléchargement,
#                       ni vérification de signature
# Variables : BACKUP_KEY_FILE (défaut DATA_DIR/cles-sauvegarde/serveur.key) et BACKUP_RECIPIENTS_FILE (défaut DATA_DIR/cles-sauvegarde/secours.pub),
#             préparés par scripts/generer-cles-sauvegarde.sh ; BACKUP_PASSPHRASE_FILE : ancienne phrase secrète, uniquement
#             pour un retour arrière sur une sauvegarde de l'ancien format (.tar.enc) ;
#             SUIVI_TEST_ECHEC_SANTE=1 : simule un échec du contrôle de santé (tests du retour arrière uniquement).
# Étapes : contrôles → notes de mise à jour → sauvegarde chiffrée → version du dépôt → images (signature) →
# migrations (au démarrage de app, sous verrou, une transaction chacune) → santé → rapport et journal d'audit.
# Échec après la sauvegarde → retour arrière automatique (ancienne version ; restauration de la sauvegarde si la base
# a été migrée). Rapport : DATA_DIR/etat/mises-a-jour/<date>.json (affiché dans Administration > Système).
set -euo pipefail

# Le dépôt change de version pendant la mise à jour : le script s'exécute depuis une copie.
if [ -z "${SUIVI_MAJ_COPIE:-}" ]; then
  if [ -f "$0" ]; then
    REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
    COPIE=$(mktemp /tmp/mettre-a-jour.XXXXXX.sh)
    cp "$0" "$COPIE"
  else # lu sur l'entrée standard (git show … | bash -s) : on est dans le dossier de l'application
    REPO="${REPO:-$(pwd)}"
    COPIE=$(mktemp /tmp/mettre-a-jour.XXXXXX.sh)
    v=''
    for a in "$@"; do case "$a" in -*) ;; *) v="${a#v}"; break ;; esac; done
    git -C "$REPO" show "v$v:scripts/mettre-a-jour.sh" > "$COPIE" 2> /dev/null \
      || { echo "ERREUR : version « v$v » introuvable dans le dépôt (sudo git fetch --tags ; indiquer la version)." >&2; exit 1; }
  fi
  SUIVI_MAJ_COPIE="$COPIE" REPO="$REPO" exec bash "$COPIE" "$@"
fi
trap 'rm -f "$SUIVI_MAJ_COPIE"' EXIT
cd "$REPO"
[ -f "$REPO/docker-compose.yml" ] || { echo "ERREUR : $REPO n'est pas le dossier de l'application." >&2; exit 1; }

# Fonctions communes : celles de la version cible si le dépôt actuel ne les a pas encore.
if [ -f "$REPO/scripts/lib-commun.sh" ]; then
  . "$REPO/scripts/lib-commun.sh"
else
  for a in "$@"; do case "$a" in -*) ;; *) eval "$(git -C "$REPO" show "v${a#v}:scripts/lib-commun.sh")"; break ;; esac; done
  command -v valeur_env > /dev/null || { echo "ERREUR : indiquer la version voulue (ex. : 3.1.0)." >&2; exit 1; }
fi

VERIFIER=0
AUTO=0
SANS_SIGNATURE=0
LOCALES=0
DELAI=300
SAUV=/srv/sauvegardes/suivi-audits
CIBLE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --verifier) VERIFIER=1 ;;
    --auto) AUTO=1 ;;
    --sans-signature) SANS_SIGNATURE=1 ;;
    --images-locales) LOCALES=1 ;;
    --delai) DELAI="${2:?durée attendue}"; shift ;;
    --sauvegardes) SAUV="${2:?dossier attendu}"; shift ;;
    -h | --help) sed -n '2,25p' "$SUIVI_MAJ_COPIE"; exit 0 ;;
    -*) arret "option inconnue : $1" ;;
    *) CIBLE="${1#v}" ;;
  esac
  shift
done

DEPOT_IMAGES=ghcr.io/yousername-ha/suivi-audits
CLE="$(cle_sauvegarde_serveur)"
SECOURS="$(cles_sauvegarde_secours)"
PASS="${BACKUP_PASSPHRASE_FILE:-/root/.suivi-backup-pass}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
DEBUT=$(date +%s)
NOTES=''
MIGRATIONS=''
SAUVEGARDE=''
SIGNATURE=''
PHASE=controles
if declare -F progression > /dev/null; then progression; fi
MIGRATION_DOSSIER=0
MIGRATIONS_AVANT=''
CONTROLE_AVANT=''
VOLS=''
REF_AVANT=$(git rev-parse HEAD)
ACTUELLE=$(valeur_env APP_VERSION)
DATA_DIR=$(dossier_donnees)

semver() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; }
plus_recente() { [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n 1)" = "$1" ] && [ "$1" != "$2" ]; }
confirmer() { # question
  [ "$AUTO" = 1 ] && return 0
  printf '%s Taper OUI pour continuer : ' "$1"
  read -r r < /dev/tty
  [ "$r" = OUI ]
}

rapport() { # resultat message
  local fichier="$DATA_DIR/etat/mises-a-jour/$STAMP.json" migr='' m
  for m in $MIGRATIONS; do migr+="${migr:+,}$(json_chaine "$m")"; done
  printf '{"date":"%s","depuis":%s,"vers":%s,"resultat":"%s","dureeSecondes":%s,"migrations":[%s],"sauvegarde":%s,"signature":%s,"phase":%s,"message":%s,"migrationDossier":%s}\n' \
    "$(horodatage)" "$(json_chaine "$ACTUELLE")" "$(json_chaine "$CIBLE")" "$1" "$(($(date +%s) - DEBUT))" "$migr" \
    "$(json_chaine "$SAUVEGARDE")" "$(json_chaine "$SIGNATURE")" "$(json_chaine "$PHASE")" "$(json_chaine "$2")" \
    "$([ "$MIGRATION_DOSSIER" = 1 ] && echo true || echo false)" > "$TMP_RAPPORT"
  if [ -d "$DATA_DIR/etat" ]; then ecrire_etat "$fichier" < "$TMP_RAPPORT"; fi
  info "Rapport : $fichier"
  # Journal d'audit de l'application (version en service), si elle sait le faire.
  dc exec -T app suivi consigner-mise-a-jour < "$TMP_RAPPORT" > /dev/null 2>&1 || true
}
TMP_RAPPORT=$(mktemp)

# Protocole privé utilisé uniquement par l'exécutant Compose, jamais fourni par l'interface.
progression() {
  if [ -n "${SUIVI_UPDATE_PROGRESS:-}" ]; then
    SUIVI_PROGRESS_PHASE="$PHASE" SUIVI_PROGRESS_BACKUP="$SAUVEGARDE" python3 - <<'PYPROGRESS'
import json, os, tempfile
p=os.environ['SUIVI_UPDATE_PROGRESS']
fd, name=tempfile.mkstemp(dir=os.path.dirname(p))
with os.fdopen(fd, 'w') as f:
    json.dump({'jobId':os.environ['SUIVI_UPDATE_JOB'], 'phase':os.environ['SUIVI_PROGRESS_PHASE'], 'backup':os.environ['SUIVI_PROGRESS_BACKUP']}, f)
    f.flush(); os.fsync(f.fileno())
os.replace(name,p)
PYPROGRESS
  fi
}
progression

# ---------------------------------------------------------------- Retour arrière
retour_arriere() { # raison
  local raison="$1" apres
  erreur "mise à jour vers $CIBLE en échec ($PHASE) : $raison"
  PHASE="retour arrière ($PHASE)"
  progression
  etape "Retour arrière vers $ACTUELLE"
  apres=$(migrations_appliquees)
  # Migrations appliquées pendant la tentative (consignées dans le rapport).
  MIGRATIONS=$(comm -13 <(printf '%s\n' "$MIGRATIONS_AVANT" | sort) <(printf '%s\n' "$apres" | sort) | tr '\n' ' ')
  git checkout -q "$REF_AVANT"
  [ -f "$REPO/.env.avant-mise-a-jour" ] && cp -p "$REPO/.env.avant-mise-a-jour" "$REPO/.env"
  if [ "$MIGRATION_DOSSIER" = 1 ]; then
    # L'ancienne version utilise les volumes Docker, restés intacts : la copie de DATA_DIR est mise de côté.
    dc --profile antivirus stop > /dev/null 2>&1 || true
    ecarter_copie_donnees
    dc up -d --remove-orphans
  elif [ -n "$apres" ] && [ "$apres" != "$MIGRATIONS_AVANT" ] && [ -n "$SAUVEGARDE" ]; then
    info "La base a été migrée : restauration de la sauvegarde $SAUVEGARDE."
    if [ "$AUTO" = 1 ] || confirmer "Restaurer la sauvegarde faite avant la mise à jour (les données ajoutées depuis seront perdues) ?"; then
      # Le dépôt est revenu à la version précédente : son restore.sh correspond au format de la sauvegarde (.tar.enc ou .tar.age).
      RESTAURER_SANS_CONFIRMATION=1 BACKUP_KEY_FILE="$CLE" BACKUP_PASSPHRASE_FILE="$PASS" "$REPO/scripts/restore.sh" "$SAUVEGARDE" < /dev/null \
        || { echo RESTAURER | BACKUP_KEY_FILE="$CLE" BACKUP_PASSPHRASE_FILE="$PASS" "$REPO/scripts/restore.sh" "$SAUVEGARDE"; }
    else
      avertir "restauration refusée : l'ancienne version peut ne pas démarrer sur une base migrée."
    fi
  else
    dc up -d --remove-orphans
  fi
  if attendre_sante "$DELAI"; then
    info "Retour arrière terminé : la version $ACTUELLE est en service."
    rapport retour-arriere "$raison"
  else
    erreur "l'ancienne version ne redémarre pas : voir docs/INSTALLATION.md, section 13 (sauvegarde : $SAUVEGARDE)."
    rapport echec "$raison ; retour arrière incomplet"
  fi
  exit 1
}

ecarter_copie_donnees() {
  local d="$DATA_DIR" sous="$DATA_DIR/.echec-$STAMP"
  mkdir -p "$sous"
  for x in postgres postgres18 secrets caddy clamav; do [ -e "$d/$x" ] && mv "$d/$x" "$sous/"; done
  mv "$d/$MARQUEUR" "$sous/" 2> /dev/null || true
  mv "$d/.migration-en-cours" "$sous/" 2> /dev/null || true
  info "Copie des données mise de côté : $sous"
}

echec() {
  local code=$?
  [ "$code" = 0 ] && return
  case "$PHASE" in
    controles | notes | sauvegarde)
      erreur "mise à jour interrompue avant toute modification ($PHASE)."
      [ "$PHASE" = sauvegarde ] && rapport abandon "échec de la sauvegarde"
      ;;
    termine | retour*) ;;
    *) retour_arriere "erreur inattendue (code $code)" ;;
  esac
}
trap 'echec; rm -f "$SUIVI_MAJ_COPIE" "$TMP_RAPPORT"' EXIT

# ---------------------------------------------------------------- 1. Contrôles
etape "Contrôles"
exiger_root
command -v docker > /dev/null || arret "Docker est introuvable."
docker compose version > /dev/null 2>&1 || arret "docker compose est introuvable."
[ -f "$REPO/.env" ] || arret "fichier .env absent dans $REPO."
[ -n "$ACTUELLE" ] || arret "APP_VERSION absent de .env."
verifier_chemin_donnees "$DATA_DIR"
{ exec 7> /run/lock/suivi-audits-mise-a-jour.lock; } 2> /dev/null || exec 7> /tmp/suivi-audits-mise-a-jour.lock
flock -n 7 || arret "une autre mise à jour est en cours."
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no >&2
  arret "des fichiers suivis par git ont été modifiés sur le serveur : les remettre en état (git diff) avant de mettre à jour."
fi
git fetch --tags --quiet 2> /dev/null || { [ -n "$CIBLE" ] || arret "dépôt injoignable (git fetch) : indiquer la version voulue."; avertir "dépôt injoignable : versions déjà connues du serveur seulement."; }
if [ -z "$CIBLE" ]; then
  CIBLE=$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' | sed 's/^v//' | sort -V | tail -n 1)
  [ -n "$CIBLE" ] || arret "aucune version publiée trouvée (git tag)."
fi
semver "$CIBLE" || arret "version cible invalide : « $CIBLE » (attendu : X.Y.Z)."
git rev-parse -q --verify "refs/tags/v$CIBLE" > /dev/null || arret "version v$CIBLE introuvable (git fetch --tags ; voir la page Releases)."
info "Version en service : $ACTUELLE"
info "Version cible      : $CIBLE"
if semver "$ACTUELLE"; then
  [ "$ACTUELLE" != "$CIBLE" ] || { info "Déjà à jour."; exit 0; }
  plus_recente "$CIBLE" "$ACTUELLE" || arret "retour à une version plus ancienne refusé ($ACTUELLE → $CIBLE) : les migrations de la base ne s'annulent pas. Restaurer plutôt une sauvegarde (étape 11.4)."
else
  avertir "version en service non numérotée (« $ACTUELLE ») : impossible de vérifier qu'il s'agit d'une montée de version."
fi
# Somme des deux dossiers (un seul existe avant la migration vers PostgreSQL 18) : « du » sort en erreur si l'un manque,
# ce qui, avec pipefail, ajouterait une seconde ligne à la valeur.
taille_base=$(du -sb "$DATA_DIR/postgres" "$DATA_DIR/postgres18" 2> /dev/null | awk '{ s += $1 } END { print s + 0 }' || true)
for v in $(anciens_volumes); do
  case "$v" in *_pgdata) taille_base=$(du -sb "$(docker volume inspect -f '{{.Mountpoint}}' "$v")" | cut -f1) ;; esac
done
besoin=$((2 * ${taille_base:-0} + 2 * 1024 * 1024 * 1024))
libre=$(octets_libres "$DATA_DIR")
info "Espace libre : $((libre / 1048576)) Mo (nécessaire : $((besoin / 1048576)) Mo)"
[ "$libre" -ge "$besoin" ] || arret "espace disque insuffisant (2 × la base + 2 Go pour les images)."
COMPOSANTS='api web'
if git cat-file -e "v$CIBLE:docker/updater.Dockerfile" 2> /dev/null; then COMPOSANTS+=' updater'; fi
if [ "$LOCALES" = 1 ]; then
  for i in $COMPOSANTS; do docker image inspect "$DEPOT_IMAGES-$i:$CIBLE" > /dev/null 2>&1 || arret "image locale $DEPOT_IMAGES-$i:$CIBLE absente."; done
  SIGNATURE='images locales (non vérifiée)'
elif command -v cosign > /dev/null; then
  SIGNATURE='à vérifier'
elif [ "$SANS_SIGNATURE" = 1 ]; then
  avertir "cosign absent : la signature des images ne sera PAS vérifiée (--sans-signature)."
  SIGNATURE='non vérifiée (--sans-signature)'
else
  arret "cosign est nécessaire pour vérifier la signature des images (docs/INSTALLATION.md, étape 12.1) ; à défaut : --sans-signature."
fi
if [ "$VERIFIER" != 1 ]; then
  if declare -F controler_cles_sauvegarde > /dev/null; then
    controler_cles_sauvegarde "$CLE" "$SECOURS"
  else
    # Version installée antérieure au chiffrement age : sa sauvegarde utilise encore la phrase secrète (étape 11.1 de son guide),
    # mais la version cible exige les clés age (montées par son docker-compose.yml) : les contrôler avant toute modification.
    [ -s "$PASS" ] || arret "phrase secrète des sauvegardes introuvable ($PASS) : la sauvegarde chiffrée est obligatoire (étape 11.1)."
    git cat-file -e "v$CIBLE:scripts/generer-cles-sauvegarde.sh" 2> /dev/null \
      && { ( eval "$(git show "v$CIBLE:scripts/lib-commun.sh")"; controler_cles_sauvegarde "$CLE" "$SECOURS" ) \
        || arret "clés de sauvegarde age à préparer avant cette mise à jour (docs/INSTALLATION.md, étape 6.8)."; }
  fi
fi

# ---------------------------------------------------------------- 2. Notes de mise à jour
PHASE=notes
if declare -F progression > /dev/null; then progression; fi
etape "Notes de mise à jour ($ACTUELLE → $CIBLE)"
NOTES=$(git show "v$CIBLE:CHANGELOG.md" | awk -v de="$ACTUELLE" -v a="$CIBLE" '
  function vers(s) { split(s, t, "."); return t[1] * 1000000 + t[2] * 1000 + t[3] }
  /^## \[/ { v = $0; sub(/^## \[/, "", v); sub(/\].*/, "", v);
             garder = (v ~ /^[0-9]+\.[0-9]+\.[0-9]+$/ && vers(v) <= vers(a) && (de !~ /^[0-9]+\.[0-9]+\.[0-9]+$/ || vers(v) > vers(de)));
             notes = 0; if (garder) print "\n" $0; next }
  garder && /^### / { notes = ($0 ~ /Notes de mise à jour/); if (notes) print $0; next }
  garder && notes { print }')
[ -n "$NOTES" ] && printf '%s\n' "$NOTES" || info "(aucune note : voir CHANGELOG.md de la version $CIBLE)"
MIGRATIONS_PREVUES=$(git diff --name-only --diff-filter=A "$REF_AVANT" "v$CIBLE" -- apps/api/migrations | xargs -r -n 1 basename)
etape "Migrations de la base prévues"
[ -n "$MIGRATIONS_PREVUES" ] && printf '  %s\n' $MIGRATIONS_PREVUES || info "  aucune"
VOLS=$(anciens_volumes)
if [ -n "$VOLS" ] && ! donnees_preparees; then
  etape "Données dans des volumes Docker"
  info "Elles seront copiées dans $DATA_DIR (volumes conservés jusqu'à confirmation)."
fi
if [ "$VERIFIER" = 1 ]; then
  etape "Simulation terminée : rien n'a été modifié."
  exit 0
fi
confirmer "Mettre à jour vers $CIBLE ? L'application sera indisponible quelques minutes." || arret "abandon (rien n'a été modifié)."

# Garder l'exclusivité avec le poller automatique jusqu'à la santé et au retour arrière éventuel.
# L'exécutant web transmet déjà ces descripteurs verrouillés ; les réutiliser, sans les rouvrir.
[ -d "$DATA_DIR/etat" ] || arret "Dossier d'état absent."
if [ "${RESTORE_WORKER_LOCK_HELD:-}" != 1 ]; then exec 8> "$DATA_DIR/etat/backup-worker.lock"; fi
flock -w 120 8 || arret "Un exécutant de sauvegarde est actif ; réessayer après son opération."
if [ "${RESTORE_SAUVEGARDE_LOCK_HELD:-}" != 1 ]; then exec 9> "$DATA_DIR/etat/sauvegarde.lock"; fi
flock -w 120 9 || arret "Une sauvegarde ou restauration est active ; réessayer après son opération."
export RESTORE_WORKER_LOCK_HELD=1 RESTORE_SAUVEGARDE_LOCK_HELD=1 UPDATE_SAUVEGARDE_LOCK_HELD=1

# ---------------------------------------------------------------- 3. Sauvegarde chiffrée obligatoire
PHASE=sauvegarde
if declare -F progression > /dev/null; then progression; fi
etape "Sauvegarde chiffrée"
mkdir -p "$SAUV/avant-mise-a-jour"
sortie=$(RETENTION_DAYS=36500 BACKUP_PREFIXE="avant-maj-$ACTUELLE-vers-$CIBLE" BACKUP_KEY_FILE="$CLE" BACKUP_RECIPIENTS_FILE="$SECOURS" BACKUP_PASSPHRASE_FILE="$PASS" \
  "$REPO/scripts/backup.sh" "$SAUV/avant-mise-a-jour" 2>&1) || { printf '%s\n' "$sortie" >&2; arret "échec de la sauvegarde : mise à jour annulée."; }
printf '%s\n' "$sortie"
SAUVEGARDE=$(printf '%s\n' "$sortie" | sed -n 's/^Sauvegarde : //p' | tail -n 1)
case "$SAUVEGARDE" in *.tar.age | *.tar.enc) ;; *) arret "la sauvegarde n'est pas chiffrée : mise à jour annulée." ;; esac
if [ -f "$SAUVEGARDE.sha256" ]; then
  (cd "$(dirname "$SAUVEGARDE")" && sha256sum -c --quiet "$(basename "$SAUVEGARDE").sha256") || arret "empreinte de la sauvegarde incorrecte."
else
  sha256sum "$SAUVEGARDE" > "$SAUVEGARDE.sha256"
fi
# Les 5 dernières sauvegardes « avant mise à jour » sont gardées, hors rotation.
find "$SAUV/avant-mise-a-jour" -maxdepth 1 -name '*.tar*' ! -name '*.sha256' -printf '%T@ %p\n' | sort -rn | tail -n +6 \
  | cut -d' ' -f2- | while read -r f; do rm -f "$f" "$f.sha256"; done
MIGRATIONS_AVANT=$(migrations_appliquees)
CONTROLE_AVANT=$(dc exec -T app suivi controle-donnees 2> /dev/null || true)
# Références logiques entre objets (JSON, état historique) avant : la version précédente peut ne pas connaître la commande.
RELATIONS_AVANT=$(dc exec -T app suivi controle-relations --anomalies 2> /dev/null || true)

# ---------------------------------------------------------------- 4. Version du dépôt et images
PHASE=images
if declare -F progression > /dev/null; then progression; fi
etape "Version $CIBLE du dépôt et images"
cp -p "$REPO/.env" "$REPO/.env.avant-mise-a-jour"
git checkout -q "v$CIBLE"
. "$REPO/scripts/lib-commun.sh"
# ADR 0061 : l'exécutant ne monte plus /root/.ssh ni /root/.docker par défaut. Une installation qui dépend encore d'une
# connexion au registre ou d'une clé de déploiement (dépôt privé) les conserve explicitement ; rien n'est ajouté sinon.
if [ -z "$(valeur_env UPDATER_DOCKER_CONFIG)" ] && grep -qs '"ghcr.io"' /root/.docker/config.json; then
  ecrire_env UPDATER_DOCKER_CONFIG /root/.docker
  info "Connexion au registre conservée pour l'exécutant (UPDATER_DOCKER_CONFIG=/root/.docker dans .env)."
fi
if [ -z "$(valeur_env UPDATER_SSH_DIR)" ] && git remote get-url origin 2> /dev/null | grep -qE '^(git@|ssh://)' \
  && ! git ls-remote --exit-code https://github.com/yousername-ha/suivi-audits.git HEAD > /dev/null 2>&1; then
  ecrire_env UPDATER_SSH_DIR /root/.ssh
  info "Clé de déploiement conservée pour l'exécutant (UPDATER_SSH_DIR=/root/.ssh dans .env) : dépôt non lisible en HTTPS."
fi
if [ "${SUIVI_MAJ_WEB:-}" = 1 ]; then
  ecrire_env GATEWAY_VERSION "$(valeur_env GATEWAY_VERSION "$ACTUELLE")"
  # --images-locales est une option CLI de recette ; jamais exposée dans la demande web.
  if [ "$LOCALES" = 1 ]; then
    sed -i '/^API_IMAGE=/d; /^WEB_IMAGE=/d; /^UPDATER_IMAGE=/d' "$REPO/.env"
  else
  # Images déjà vérifiées par l'exécutant, références immuables validées avant application.
  python3 - <<'PYPINS'
import json, os, re
from pathlib import Path
images=json.loads(os.environ['SUIVI_UPDATE_IMAGES'])
p=Path('.env')
s=p.read_text()
for component,key in [('api','API_IMAGE'),('web','WEB_IMAGE'),('updater','UPDATER_IMAGE')]:
    image=images[component]
    if not re.fullmatch(r'ghcr.io/yousername-ha/suivi-audits-'+component+r'@sha256:[a-f0-9]{64}',image):
        raise ValueError('Image invalide')
    s=re.sub(r'^'+key+r'=.*\n?', '', s, flags=re.M)
    s+='\n'+key+'='+image+'\n'
p.write_text(s)
PYPINS
  fi
fi
if [ "${SUIVI_MAJ_WEB:-}" != 1 ]; then
  sed -i '/^API_IMAGE=/d; /^WEB_IMAGE=/d; /^UPDATER_IMAGE=/d' "$REPO/.env"
  if [ -n "$(valeur_env GATEWAY_VERSION)" ]; then ecrire_env GATEWAY_VERSION "$CIBLE"; fi
fi
if [ "$LOCALES" = 0 ]; then
  APP_VERSION="$CIBLE" dc pull --quiet
  if command -v cosign > /dev/null; then
    for i in $COMPOSANTS; do
      cosign verify "$DEPOT_IMAGES-$i:$CIBLE" --certificate-identity "https://github.com/yousername-ha/suivi-audits/.github/workflows/release.yml@refs/tags/v$CIBLE" \
        --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null \
        || retour_arriere "signature de l'image $i:$CIBLE invalide ou absente"
      # Attestation SBOM signée par la même identité (ADR 0063) : une image publiée hors procédure est refusée.
      cosign verify-attestation "$DEPOT_IMAGES-$i:$CIBLE" --type cyclonedx \
        --certificate-identity "https://github.com/yousername-ha/suivi-audits/.github/workflows/release.yml@refs/tags/v$CIBLE" \
        --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null \
        || retour_arriere "attestation SBOM de l'image $i:$CIBLE invalide ou absente"
    done
    SIGNATURE='vérifiée (cosign, signature et attestation SBOM)'
    info "Signature des images vérifiée."
  fi
fi
ecrire_env APP_VERSION "$CIBLE"

# ---------------------------------------------------------------- 5. Démarrage, migrations, santé
PHASE=demarrage
if declare -F progression > /dev/null; then progression; fi
if [ -n "$VOLS" ] && ! donnees_preparees; then
  MIGRATION_DOSSIER=1
  "$REPO/scripts/migrer-donnees-vers-dossier.sh" --oui --sans-sauvegarde || retour_arriere "échec du passage des données vers $DATA_DIR"
else
  etape "Démarrage de la version $CIBLE (migrations de la base au démarrage, sous verrou)"
  dc up -d --remove-orphans
fi
PHASE=sante
if declare -F progression > /dev/null; then progression; fi
attendre_sante "$DELAI" || retour_arriere "l'application ne devient pas « healthy » en $DELAI s"
pret=$(dc exec -T app node -e "fetch('http://127.0.0.1:8080/api/health/ready').then(r=>r.text()).then(t=>console.log(t)).catch(e=>console.log(e.message))" 2> /dev/null || true)
info "Santé : $pret"
case "$pret" in *'"pret":true'*'"version":"'"$CIBLE"'"'*) ;; *) retour_arriere "santé incomplète : $pret" ;; esac
if [ "${SUIVI_TEST_ECHEC_SANTE:-}" = 1 ]; then retour_arriere "échec simulé (SUIVI_TEST_ECHEC_SANTE=1)"; fi
SITE=$(valeur_env SITE_ADDRESS)
PORT=$(valeur_env HTTPS_PORT 443)
[ "$(curl -sk --resolve "$SITE:$PORT:127.0.0.1" "https://$SITE:$PORT/healthz" || true)" = ok ] \
  || avertir "le site HTTPS ne répond pas encore « ok » depuis le serveur."
CONTROLE_APRES=$(dc exec -T app suivi controle-donnees 2>&1) || retour_arriere "contrôle des données en échec : $CONTROLE_APRES"
if [ -n "$CONTROLE_AVANT" ]; then
  empreinte() { printf '%s' "$1" | grep -A3 '"documents"' | grep '"empreinte"' | head -n 1; }
  [ "$(empreinte "$CONTROLE_AVANT")" = "$(empreinte "$CONTROLE_APRES")" ] || avertir "documents différents avant et après la mise à jour : vérifier le rapport."
fi
# Relations : aucune anomalie nouvelle après la mise à jour (celles qui existaient déjà sont seulement rappelées).
RELATIONS_APRES=$(dc exec -T app suivi controle-relations --anomalies 2> /dev/null || true)
NOUVELLES=$(comm -13 <(printf '%s\n' "$RELATIONS_AVANT" | sort) <(printf '%s\n' "$RELATIONS_APRES" | sort) | sed '/^$/d')
if [ -n "$NOUVELLES" ]; then avertir "relations entre objets : anomalies apparues pendant la mise à jour :"; printf '%s\n' "$NOUVELLES" >&2
elif [ -n "$(printf '%s' "$RELATIONS_APRES" | tr -d '[:space:]')" ]; then info "Relations entre objets : $(printf '%s\n' "$RELATIONS_APRES" | sed '/^$/d' | wc -l) anomalie(s) déjà présente(s) avant la mise à jour (voir : suivi controle-relations)."
else info "Relations entre objets : aucune anomalie."; fi
MIGRATIONS=$(comm -13 <(printf '%s\n' "$MIGRATIONS_AVANT" | sort) <(migrations_appliquees | sort) | tr '\n' ' ')

# ---------------------------------------------------------------- 6. Rapport, journal, ménage
PHASE=termine
if declare -F progression > /dev/null; then progression; fi
etape "Mise à jour terminée : $ACTUELLE → $CIBLE"
[ -n "$MIGRATIONS" ] && info "Migrations appliquées : $MIGRATIONS"
rapport reussie ''
rm -f "$REPO/.env.avant-mise-a-jour"
# Images : on garde la version en service et la précédente (retour rapide).
for i in $COMPOSANTS; do
  garder="$CIBLE|$ACTUELLE"
  # Le frontal stable peut être plus ancien que la version applicative précédente.
  if [ "$i" = web ]; then garder+="|$(valeur_env GATEWAY_VERSION "$CIBLE")"; fi
  docker image ls --format '{{.Repository}}:{{.Tag}}' "$DEPOT_IMAGES-$i" \
    | grep -vE ":($garder)$" | xargs -r docker image rm > /dev/null 2>&1 || true
done
docker image prune -f > /dev/null 2>&1 || true
[ "$MIGRATION_DOSSIER" = 1 ] && info "Anciens volumes Docker conservés : après vérification, sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes"
info "Sauvegarde faite avant la mise à jour : $SAUVEGARDE"
