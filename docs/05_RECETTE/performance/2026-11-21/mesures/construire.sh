#!/usr/bin/env bash
# Construit les images api et web de v7.4.0 (version de départ de la mise à jour) puis de v7.5.0 (version testée).
set -euo pipefail
B=$BANC
WT=${DEPOT_750:?arbre de travail du commit testé}
construire() { # dossier etiquette
  local d=$1 e=$2
  for s in api web; do
    echo "== $s $e $(date -Iseconds)"
    # Mandataire de sortie et autorité de certification propres au poste du banc : fournis par l'environnement
    # (BANC_PROXY, BANC_CA), jamais écrits ici.
    docker build -q --network host --secret "id=build_ca,src=${BANC_CA:?autorité de certification du poste}" \
      --build-arg "HTTPS_PROXY=${BANC_PROXY:-}" --build-arg "https_proxy=${BANC_PROXY:-}" \
      --build-arg "HTTP_PROXY=${BANC_PROXY:-}" --build-arg "http_proxy=${BANC_PROXY:-}" \
      --build-arg "NO_PROXY=${NO_PROXY:-}" --build-arg "no_proxy=${NO_PROXY:-}" \
      -f "$d/docker/$s.Dockerfile" -t "ghcr.io/yousername-ha/suivi-audits-$s:$e" "$d"
  done
}
construire "$B/src740" perf740
construire "$WT" perf750
echo "== fin $(date -Iseconds)"
docker images | grep perf7
