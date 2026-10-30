#!/usr/bin/env bash
# CI, job « montée de version » (EXPL-02, EXPL-03, EXPL-04) : serveur simulé dans $SERVEUR, installé avec la version de
# départ (dernière version publiée, 6.0.0 ou ultérieure : ADR 0077), données fictives, puis mises à jour par
# scripts/mettre-a-jour.sh vers le commit testé :
#   1. échec simulé de la santé → retour arrière (ancienne version en service, données identiques) ;
#   2. simulation (--verifier) → rien ne change ;
#   3. mise à jour réelle → nouvelle version, données identiques (comptes, données de suivi, document chiffré relu),
#      passage des volumes Docker vers DATA_DIR si la version de départ les utilisait, puis suppression des anciens volumes ;
#   4. version suivante avec une migration, échec simulé → retour arrière AVEC restauration de la sauvegarde ;
#   5. « docker compose down -v » → données intactes.
# Les images ghcr.io/yousername-ha/suivi-audits-{api,web,updater}:<version> de départ et cible doivent exister localement.
# Variables : DEPART_REF, DEPART_VERSION, CIBLE_REF, CIBLE_VERSION, SOURCE (dépôt à cloner), SERVEUR (défaut /opt/suivi-audits).
set -euo pipefail
: "${DEPART_REF:?}" "${DEPART_VERSION:?}" "${CIBLE_REF:?}" "${CIBLE_VERSION:?}"
SOURCE="${SOURCE:-$GITHUB_WORKSPACE}"
SERVEUR="${SERVEUR:-/opt/suivi-audits}"
OUTILS="$SOURCE/scripts/ci"
export RUNNER_TEMP="${RUNNER_TEMP:-$(mktemp -d)}"
URL=https://localhost
IMG=ghcr.io/yousername-ha/suivi-audits
SUIVANTE=$(echo "$CIBLE_VERSION" | awk -F. '{ print $1 "." $2 "." $3 + 1 }')
groupe() { echo "::group::$*"; }
fin_groupe() { echo "::endgroup::"; }
echec() { echo "::error::Montée de version : $*"; exit 1; }
api() { NODE_EXTRA_CA_CERTS="$SERVEUR/racine.crt" node "$OUTILS/guide-api.mjs" "$@"; }
version_env() { sudo grep -E '^APP_VERSION=' "$SERVEUR/.env" | cut -d= -f2; }
dernier_rapport() { sudo sh -c "ls -1t /srv/suivi-audits/donnees/etat/mises-a-jour/*.json | head -n 1 | xargs cat"; }
maj() {
  # Exercer les outils du vrai conteneur updater, plutôt que ceux de l'hôte Ubuntu.
  (cd "$SERVEUR" && sudo git show "v$CIBLE_VERSION:scripts/mettre-a-jour.sh" | sudo docker run --rm -i --network none \
    -v /var/run/docker.sock:/var/run/docker.sock -v "$SERVEUR:$SERVEUR" -v "$SOURCE:$SOURCE:ro" \
    -v /srv/suivi-audits/donnees:/srv/suivi-audits/donnees \
    -v /srv/sauvegardes/suivi-audits:/srv/sauvegardes/suivi-audits \
    -w "$SERVEUR" -e "PWD=$SERVEUR" \
    -e GIT_CONFIG_COUNT=2 -e GIT_CONFIG_KEY_0=safe.directory -e "GIT_CONFIG_VALUE_0=$SERVEUR" \
    -e GIT_CONFIG_KEY_1=safe.directory -e "GIT_CONFIG_VALUE_1=$SOURCE" \
    "$IMG-updater:$CIBLE_VERSION" env "$@" bash -s -- "$VERS" --auto --images-locales --delai 240)
}
# Trajet réel d'un serveur qui se met à jour depuis l'interface : c'est le script de la version INSTALLÉE (celui du dépôt,
# lancé en fichier par l'exécutant installé) qui s'exécute, dans l'image updater de cette version ; il bascule le dépôt sur
# la cible puis charge les outils de la cible. maj() ci-dessus exerce, lui, le script de la cible.
maj_installee() {
  (cd "$SERVEUR" && sudo docker run --rm --network none \
    -v /var/run/docker.sock:/var/run/docker.sock -v "$SERVEUR:$SERVEUR" -v "$SOURCE:$SOURCE:ro" \
    -v /srv/suivi-audits/donnees:/srv/suivi-audits/donnees \
    -v /srv/sauvegardes/suivi-audits:/srv/sauvegardes/suivi-audits \
    -w "$SERVEUR" -e "PWD=$SERVEUR" \
    -e GIT_CONFIG_COUNT=2 -e GIT_CONFIG_KEY_0=safe.directory -e "GIT_CONFIG_VALUE_0=$SERVEUR" \
    -e GIT_CONFIG_KEY_1=safe.directory -e "GIT_CONFIG_VALUE_1=$SOURCE" \
    "$IMG-updater:$DEPART_VERSION" bash scripts/mettre-a-jour.sh "$VERS" --auto --images-locales --delai 240)
}
attendre() {
  for _ in $(seq 1 100); do
    [ "$(curl -sk "$URL/healthz" || true)" = ok ] && return 0
    sleep 3
  done
  (cd "$SERVEUR" && sudo docker compose ps -a && sudo docker compose logs --tail 80 init db app)
  echec "le site ne répond pas"
}

groupe "Serveur simulé : version de départ $DEPART_VERSION ($DEPART_REF)"
sudo rm -rf "$SERVEUR" /srv/suivi-audits/donnees /srv/sauvegardes/suivi-audits
sudo git clone -q --no-hardlinks "$SOURCE" "$SERVEUR"
cd "$SERVEUR"
sudo git -c advice.detachedHead=false checkout -q "$DEPART_REF"
sudo git tag -f "v$DEPART_VERSION" "$DEPART_REF" > /dev/null
sudo git tag -f "v$CIBLE_VERSION" "$CIBLE_REF" > /dev/null
sudo cp .env.example .env
sudo sed -i "s/^SITE_ADDRESS=.*/SITE_ADDRESS=localhost/; s/^APP_VERSION=.*/APP_VERSION=$DEPART_VERSION/" .env
sudo chmod 600 .env
[ -x scripts/preparer-donnees.sh ] && sudo ./scripts/preparer-donnees.sh
sudo docker compose up -d
attendre
sudo docker compose cp web:/data/caddy/pki/authorities/local/root.crt "$SERVEUR/racine.crt" > /dev/null
sudo chmod 644 "$SERVEUR/racine.crt"
api administrateur "$URL"
api import "$URL" "$SOURCE/tests/fixtures/legacy-fixture.json"
api document "$URL"
api instantane "$URL" "$RUNNER_TEMP/reference.json"
# Clés age (ADR 0071, ADR 0077) : les versions de départ (6.0.0 et suivantes) et cible les lisent dans le dossier des données.
# Les y déposer avant la montée (le script de la cible ; un serveur réel les obtient de l'exécutant et de l'assistant).
command -v age-keygen > /dev/null || { sudo apt-get update -qq && sudo apt-get install -y -qq age > /dev/null; }
age-keygen -o "$RUNNER_TEMP/cle-secours.key" 2> /dev/null
sudo "$SOURCE/scripts/generer-cles-sauvegarde.sh" --secours "$(age-keygen -y "$RUNNER_TEMP/cle-secours.key")" --confirmer > /dev/null
VOLUMES_DEPART=$(sudo docker volume ls -q | grep -c '^suivi-audits_' || true)
fin_groupe

groupe "1. Échec simulé de la santé : retour arrière"
VERS=$CIBLE_VERSION
if maj SUIVI_TEST_ECHEC_SANTE=1; then echec "la mise à jour aurait dû échouer (échec simulé)"; fi
[ "$(version_env)" = "$DEPART_VERSION" ] || echec "APP_VERSION n'est pas revenu à $DEPART_VERSION"
# Une étiquette annotée désigne un objet tag ; comparer les commits effectivement exécutés.
[ "$(sudo git rev-parse HEAD)" = "$(sudo git rev-parse "$DEPART_REF^{commit}")" ] || echec "le dépôt n'est pas revenu à la version de départ"
attendre
api instantane "$URL" "$RUNNER_TEMP/apres-echec.json" "$RUNNER_TEMP/reference.json"
dernier_rapport | grep -q '"resultat":"retour-arriere"' || echec "rapport « retour-arriere » absent"
[ -z "$(sudo ls /srv/sauvegardes/suivi-audits/avant-mise-a-jour/ | grep -E '\.tar\.age$')" ] && echec "sauvegarde avant mise à jour absente"
fin_groupe

groupe "2. Simulation (--verifier) : rien ne change"
(cd "$SERVEUR" && sudo git show "v$CIBLE_VERSION:scripts/mettre-a-jour.sh" | sudo bash -s -- "$CIBLE_VERSION" --verifier --images-locales)
[ "$(version_env)" = "$DEPART_VERSION" ] || echec "--verifier a modifié APP_VERSION"
fin_groupe

groupe "3. Mise à jour $DEPART_VERSION → $CIBLE_VERSION (script de la version installée, comme depuis l'interface)"
sudo git -C "$SERVEUR" rev-parse --verify -q "$DEPART_REF^{commit}" > /dev/null
[ "$(sudo git -C "$SERVEUR" rev-parse HEAD)" = "$(sudo git -C "$SERVEUR" rev-parse "$DEPART_REF^{commit}")" ] || echec "le dépôt n'est pas à la version de départ avant la mise à jour"
maj_installee
[ "$(version_env)" = "$CIBLE_VERSION" ] || echec "APP_VERSION différent de $CIBLE_VERSION"
attendre
# Version de départ antérieure au poivre (ADR 0072) : ses empreintes sont refusées par la cible ; reprise d'une base sans poivre.
api reprise-poivre "$URL"
api instantane "$URL" "$RUNNER_TEMP/apres-maj.json" "$RUNNER_TEMP/reference.json"
grep -q "\"version\": \"$CIBLE_VERSION\"" "$RUNNER_TEMP/apres-maj.json" || echec "/api/version n'indique pas $CIBLE_VERSION"
dernier_rapport | grep -q '"resultat":"reussie"' || echec "rapport « reussie » absent"
sudo docker compose exec -T app suivi controle-donnees > /dev/null || echec "contrôle des données (documents relus) en échec"
sudo test -s /srv/suivi-audits/donnees/postgres18/18/docker/PG_VERSION || echec "la base PostgreSQL 18 n'est pas dans DATA_DIR/postgres18"
# Migration PostgreSQL 17 → 18 (ADR 0035) : seulement si la version de départ était encore en 17.
if sudo test -s /srv/suivi-audits/donnees/postgres/PG_VERSION; then
  [ "$(sudo cat /srv/suivi-audits/donnees/postgres/PG_VERSION)" = 17 ] || echec "l'ancien dossier postgres n'est pas resté en version 17 (il doit rester intact)"
  [ "$(sudo docker compose exec -T -u postgres db psql -d suivi -Atc 'SHOW server_version_num' | cut -c1-2)" = 18 ] || echec "la base en service n'est pas PostgreSQL 18"
  sudo test -s /srv/suivi-audits/donnees/etat/migration-postgresql/migration-17-vers-18.json || echec "rapport de migration PostgreSQL absent"
  sudo test ! -e /srv/suivi-audits/donnees/etat/migration-postgresql/suivi-pg17.dump || echec "l'export non chiffré de la base n'a pas été supprimé"
  echo "Migration PostgreSQL 17 → 18 vérifiée : base 18 en service, ancien dossier intact, export supprimé."
fi
api systeme "$URL" || true
if [ "$VOLUMES_DEPART" -gt 0 ]; then
  sudo docker volume ls -q | grep -q '^suivi-audits_pgdata$' || echec "anciens volumes supprimés sans confirmation"
  sudo ./scripts/migrer-donnees-vers-dossier.sh --supprimer-anciens-volumes --oui
  [ "$(sudo docker volume ls -q | grep -c '^suivi-audits_' || true)" = 0 ] || echec "anciens volumes encore présents"
  api instantane "$URL" "$RUNNER_TEMP/apres-suppression.json" "$RUNNER_TEMP/reference.json"
fi
fin_groupe

groupe "4. Version $SUIVANTE avec migration, échec simulé : retour arrière avec restauration"
sudo git -c user.name=ci -c user.email=ci@example.invalid -c advice.detachedHead=false checkout -q -b essai-montee
printf -- '-- Migration de test (CI, montée de version)\nCREATE TABLE essai_montee (id int);\n' \
  | sudo tee apps/api/migrations/999_essai_montee.sql > /dev/null
sudo git add apps/api/migrations/999_essai_montee.sql
sudo git -c user.name=ci -c user.email=ci@example.invalid commit -qm "test: migration d'essai"
sudo git tag -f "v$SUIVANTE" > /dev/null
sudo git -c advice.detachedHead=false checkout -q "v$CIBLE_VERSION"
CTX=$(mktemp -d)
sudo git -C "$SERVEUR" show "v$SUIVANTE:apps/api/migrations/999_essai_montee.sql" | tee "$CTX/999_essai_montee.sql" > /dev/null
printf 'FROM %s-api:%s\nUSER root\nCOPY 999_essai_montee.sql /app/apps/api/migrations/\nRUN chmod 0444 /app/apps/api/migrations/999_essai_montee.sql\nUSER node\n' "$IMG" "$CIBLE_VERSION" > "$CTX/Dockerfile"
docker build -q -t "$IMG-api:$SUIVANTE" "$CTX" > /dev/null
docker tag "$IMG-web:$CIBLE_VERSION" "$IMG-web:$SUIVANTE"
if sudo git cat-file -e "v$CIBLE_VERSION:docker/updater.Dockerfile" 2> /dev/null; then
  docker tag "$IMG-updater:$CIBLE_VERSION" "$IMG-updater:$SUIVANTE"
fi
VERS=$SUIVANTE
if maj SUIVI_TEST_ECHEC_SANTE=1; then echec "la mise à jour vers $SUIVANTE aurait dû échouer"; fi
[ "$(version_env)" = "$CIBLE_VERSION" ] || echec "APP_VERSION n'est pas revenu à $CIBLE_VERSION"
attendre
sudo docker compose exec -T -u postgres db psql -d suivi -Atc "SELECT count(*) FROM schema_migrations WHERE name = '999_essai_montee.sql'" | grep -qx 0 \
  || echec "la migration d'essai est encore appliquée : sauvegarde non restaurée"
api instantane "$URL" "$RUNNER_TEMP/apres-restauration.json" "$RUNNER_TEMP/reference.json"
dernier_rapport | grep -q '"resultat":"retour-arriere"' || echec "rapport « retour-arriere » absent"
fin_groupe

groupe "5. docker compose down -v : données intactes (EXPL-01)"
sudo docker compose down -v
sudo docker compose up -d
attendre
api instantane "$URL" "$RUNNER_TEMP/apres-down.json" "$RUNNER_TEMP/reference.json"
fin_groupe
echo "Montée de version : tous les contrôles sont conformes."
