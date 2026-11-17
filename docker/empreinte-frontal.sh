#!/bin/sh
# Empreinte du frontal « gateway » (ADR 0103), écrite dans /etc/suivi-frontal.sha256 et comparée par l'exécutant de mise à jour
# à celle du frontal en service : contenu de tout ce qu'il exécute ou sert. Caddy, ses deux configurations, demarrer-gateway, la
# page de maintenance entière (thème et polices compris), et busybox avec le chargeur musl (shell, cat, sed et grep de
# demarrer-gateway, nc et wget des contrôles de santé). Chemins triés et contenus seuls, sans date : deux constructions des mêmes
# fichiers donnent la même empreinte.
# Seul calcul de l'empreinte : lancé par docker/web.Dockerfile après la dernière copie de ces fichiers, et par la recette CI
# (scripts/ci/update-integree.py) pour construire une image web dont le frontal diffère. Monté à la construction, jamais copié
# dans l'image. Fichiers intermédiaires plutôt que tubes : un échec de lecture arrête le calcul (sh POSIX, sans pipefail).
set -eu
SORTIE=/etc/suivi-frontal.sha256
travail=$(mktemp -d)
trap 'rm -rf "$travail"' EXIT
{
  printf '%s\n' /usr/local/bin/caddy /usr/local/bin/demarrer-gateway /etc/caddy/Caddyfile.gateway \
    /etc/caddy/Caddyfile.internal /bin/busybox /lib/ld-musl-*.so.1
  find /maintenance -type f
} > "$travail/liste"
LC_ALL=C sort "$travail/liste" > "$travail/triee"
while IFS= read -r fichier; do sha256sum "$fichier"; done < "$travail/triee" > "$travail/sommes"
sha256sum < "$travail/sommes" > "$travail/total"
cut -d ' ' -f 1 "$travail/total" > "$SORTIE"
grep -Eqx '[a-f0-9]{64}' "$SORTIE"
chown root:root "$SORTIE"
chmod 0444 "$SORTIE"
