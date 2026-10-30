#!/usr/bin/env bash
# Installation en une commande (ADR 0077) : après l'installation de Docker et le téléchargement du dépôt,
#   sudo ./installer.sh
# vérifie le serveur, crée la configuration (.env) et le dossier des données, démarre l'application, puis affiche l'adresse
# à ouvrir et le jeton d'installation. Tout le reste se fait dans le navigateur (assistant d'installation). Relancer la
# commande ne change rien à une installation existante : elle redémarre la pile et, tant qu'aucun administrateur n'existe,
# affiche un nouveau jeton (le précédent est annulé).
# Options (aucune n'est nécessaire) :
#   --site NOM        nom DNS du site (défaut : nom complet du serveur, ou son adresse IPv4 s'il n'en a pas)
#   --version X.Y.Z   version à installer (défaut : celle du dépôt téléchargé)
#   --images-locales  images déjà présentes sur le serveur (recette, CI) : aucun téléchargement
#   --construire      construit les images depuis le dépôt (branche non publiée, CI) ; version « test » par défaut
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
. "$REPO/scripts/lib-commun.sh"
cd "$REPO"

SITE=''
VERSION=''
LOCALES=0
CONSTRUIRE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --site) [ $# -ge 2 ] || arret "--site attend un nom DNS."; SITE="$2"; shift 2 ;;
    --version) [ $# -ge 2 ] || arret "--version attend un numéro X.Y.Z."; VERSION="${2#v}"; shift 2 ;;
    --images-locales) LOCALES=1; shift ;;
    --construire) CONSTRUIRE=1; LOCALES=1; shift ;;
    -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) arret "option inconnue : $1 (voir sudo ./installer.sh --help)." ;;
  esac
done
exiger_root "$@"
NOM_VALIDE='^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$'

etape "1. Vérification du serveur"
command -v docker > /dev/null || arret "Docker est absent : l'installer d'abord (docs/INSTALLATION.md, étape 3)."
docker compose version > /dev/null 2>&1 || arret "le module « docker compose » est absent : installer docker-compose-plugin."
docker info > /dev/null 2>&1 || arret "Docker ne répond pas : sudo systemctl enable --now docker, puis relancer."
info "Docker : $(docker version --format '{{.Server.Version}}' 2> /dev/null || echo '?') ; Compose : $(docker compose version --short 2> /dev/null || echo '?')"
# Heure : la double authentification en dépend (codes valables 30 secondes).
if command -v timedatectl > /dev/null; then
  if [ "$(timedatectl show -p NTPSynchronized --value 2> /dev/null || true)" = yes ]; then
    info "Heure du serveur synchronisée."
  else
    timedatectl set-ntp true > /dev/null 2>&1 || true
    avertir "l'heure du serveur n'est pas encore synchronisée (NTP) : la double authentification peut échouer tant qu'elle ne l'est pas. Vérifier l'accès au flux NTP (UDP 123)."
  fi
fi
pile_active() { [ -n "$(dc ps -q gateway 2> /dev/null)" ]; }
if ! pile_active && command -v ss > /dev/null; then
  for port in "$(valeur_env HTTPS_PORT 443)" "$(valeur_env HTTP_PORT 80)"; do
    [ -z "$(ss -ltnH "sport = :$port" 2> /dev/null)" ] || arret "le port $port est déjà utilisé par un autre service : le libérer, puis relancer."
  done
fi

etape "2. Configuration"
if [ -f .env ]; then
  info "Fichier .env existant : conservé."
  [ "$CONSTRUIRE" = 1 ] || [ "$LOCALES" = 1 ] || verifier_version_env
else
  [ -n "$VERSION" ] || [ "$CONSTRUIRE" = 0 ] || VERSION='test'
  [ -n "$VERSION" ] || VERSION=$(version_du_depot)
  [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || [ "$LOCALES" = 1 ] || arret "version introuvable : préciser --version X.Y.Z."
  # Noms et adresses du serveur : le premier devient le nom du site (modifiable ensuite dans l'assistant), tous sont servis
  # avec le certificat interne pour pouvoir ouvrir l'assistant par l'adresse IP tant que le nom DNS n'est pas en place.
  complet=$(hostname -f 2> /dev/null || true)
  court=$(hostname -s 2> /dev/null || true)
  # Adresses IPv4 du serveur, sans celles de ses réseaux Docker internes (passerelles des ponts docker0, br-…).
  # shellcheck disable=SC2046 # un identifiant de réseau par mot
  internes=$(docker network inspect $(docker network ls -q) --format '{{range .IPAM.Config}}{{.Gateway}} {{end}}' 2> /dev/null | tr ' ' '\n' || true)
  adresses=$(hostname -I 2> /dev/null | tr ' ' '\n' | grep -E '^[0-9]+(\.[0-9]+){3}$' | grep -v '^127\.' | grep -vxF -e "$internes" -e '' || true)
  if [ -z "$SITE" ]; then
    case "$complet" in *.*) SITE=$complet ;; *) SITE=$(printf '%s\n' "$adresses" | head -n 1) ;; esac
  fi
  [ -n "$SITE" ] || SITE=localhost
  [[ "$SITE" =~ $NOM_VALIDE ]] || arret "nom de site invalide : « $SITE » (lettres, chiffres, points et tirets)."
  extra=$(printf '%s\n' "$complet" "$court" $adresses localhost | grep -Ev "^(|$SITE)$" | awk '!vu[$0]++' | while read -r n; do
    [[ "$n" =~ $NOM_VALIDE ]] && printf '%s ' "$n"
  done)
  ( umask 077 && cp .env.example .env )
  ecrire_env SITE_ADDRESS "$SITE"
  ecrire_env SITE_ADDRESS_EXTRA "\"${extra% }\""
  ecrire_env APP_VERSION "${VERSION:-local}"
  chmod 600 .env
  info "Fichier .env créé (droits 0600) : site $SITE, version ${VERSION:-local}."
fi
SITE=$(valeur_env SITE_ADDRESS)
if ! donnees_preparees; then
  ./scripts/preparer-donnees.sh
fi
info "Dossier des données : $(dossier_donnees)"

etape "3. Démarrage de l'application"
if [ "$CONSTRUIRE" = 1 ]; then
  info "Construction des images depuis le dépôt (10 à 20 minutes)…"
  docker compose -f docker-compose.yml -f docker-compose.build.yml build --quiet || arret "construction des images impossible : vérifier l'accès à registry.npmjs.org et dl-cdn.alpinelinux.org (docs/INSTALLATION.md, étape 5)."
elif [ "$LOCALES" = 0 ]; then
  dc pull --quiet || arret "téléchargement des images impossible (version demandée : $(valeur_env APP_VERSION)) : vérifier cette version dans .env, puis l'accès à ghcr.io et à Docker Hub (docs/INSTALLATION.md, étape 0)."
fi
dc up -d
info "Attente de l'application (jusqu'à 5 minutes)…"
attendre_sante 300 || { dc ps -a; arret "l'application n'a pas démarré : docker compose logs app (et docs/INSTALLATION.md, section 13)."; }
for _ in $(seq 1 30); do
  [ "$(dc exec -T gateway wget -qO- http://web:8080/healthz 2> /dev/null || true)" = ok ] && break
  sleep 2
done

etape "4. Ouvrir l'assistant d'installation"
info "Dans le navigateur de votre poste, ouvrez l'une de ces adresses :"
for n in $SITE $(valeur_env SITE_ADDRESS_EXTRA); do
  [ "$n" = localhost ] || info "  https://$n/setup"
done
info "Le certificat est d'abord émis par l'autorité interne du serveur : le navigateur affiche un avertissement,"
info "à accepter pour cette première connexion (le certificat définitif se choisit ensuite dans Administration)."
if dc exec -T app setup-token 2> /dev/null; then
  info "Ce jeton prouve que vous avez la main sur le serveur : il est demandé par l'assistant."
  info "Pour en obtenir un nouveau (il annule le précédent) : relancer sudo ./installer.sh"
else
  info "L'application est déjà installée (un administrateur existe) : connectez-vous normalement."
fi
