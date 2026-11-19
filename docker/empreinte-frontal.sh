#!/bin/sh
# Empreinte du frontal « gateway » (ADR 0103), écrite dans /etc/suivi-frontal.sha256 et comparée par l'exécutant de mise à jour
# à celle du frontal en service : contenu de tout ce qu'il exécute ou sert. Caddy, ses deux configurations, demarrer-gateway, la
# page de maintenance entière (thème et polices compris), busybox avec le chargeur musl (shell, cat, sed et grep de
# demarrer-gateway, nc et wget des contrôles de santé) et le magasin des autorités de certification racines (lu par Caddy pour
# ACME). S'y ajoute l'identité épinglée de l'image de base Caddy (SUIVI_IMAGE_DE_BASE, valeur de CADDY_IMAGE du Dockerfile,
# obligatoire) : une nouvelle image de base, par exemple un correctif de sécurité, change l'empreinte et le frontal est mis à
# jour à la mise à jour suivante (ADR 0103, addendum du 19/11/2026). Chemins triés et contenus seuls, sans date : deux
# constructions des mêmes fichiers sur la même image de base donnent la même empreinte.
# Seul calcul de l'empreinte : lancé par docker/web.Dockerfile après la dernière copie de ces fichiers, et par la recette CI
# (scripts/ci/update-integree.py) pour construire une image web dont le frontal diffère. Monté à la construction, jamais copié
# dans l'image. Fichiers intermédiaires plutôt que tubes : un échec de lecture arrête le calcul (sh POSIX, sans pipefail).
set -eu
SORTIE=/etc/suivi-frontal.sha256
IMAGE_DE_BASE=${SUIVI_IMAGE_DE_BASE:-}
# Image de base désignée par son empreinte (nom:étiquette@sha256:…), comme CADDY_IMAGE : jamais une étiquette seule.
printf '%s\n' "$IMAGE_DE_BASE" | grep -Eqx '[a-z0-9][a-z0-9./_-]*(:[A-Za-z0-9._-]+)?@sha256:[a-f0-9]{64}' \
  || { echo "SUIVI_IMAGE_DE_BASE absente ou non épinglée par empreinte." >&2; exit 1; }
travail=$(mktemp -d)
trap 'rm -rf "$travail"' EXIT
{
  printf '%s\n' /usr/local/bin/caddy /usr/local/bin/demarrer-gateway /etc/caddy/Caddyfile.gateway \
    /etc/caddy/Caddyfile.internal /bin/busybox /lib/ld-musl-*.so.1 /etc/ssl/certs/ca-certificates.crt
  find /maintenance -type f
} > "$travail/liste"
LC_ALL=C sort "$travail/liste" > "$travail/triee"
{
  printf 'image-de-base %s\n' "$IMAGE_DE_BASE"
  while IFS= read -r fichier; do sha256sum "$fichier"; done < "$travail/triee"
} > "$travail/sommes"
sha256sum < "$travail/sommes" > "$travail/total"
cut -d ' ' -f 1 "$travail/total" > "$SORTIE"
grep -Eqx '[a-f0-9]{64}' "$SORTIE"
chown root:root "$SORTIE"
chmod 0444 "$SORTIE"
