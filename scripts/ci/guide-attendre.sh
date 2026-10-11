#!/bin/sh
# CI, job « guide » : attend les états décrits à l'étape 7.3 de docs/INSTALLATION.md
# (init terminé avec le code 0, db et app « healthy », web démarré, site HTTPS qui répond « ok »).
set -eu
cd /opt/suivi-audits
st=''
for _ in $(seq 1 90); do
  st=$(sudo docker inspect -f '{{.State.Health.Status}}' "$(sudo docker compose ps -q app)" 2>/dev/null || true)
  [ "$st" = healthy ] && break
  sleep 2
done
sudo docker compose ps -a
[ "$st" = healthy ] || { echo "::error::Guide, étape 7.3 : app n'est pas « healthy » ($st)"; exit 1; }
[ "$(sudo docker inspect -f '{{.State.ExitCode}}' "$(sudo docker compose ps -aq init)")" = 0 ] || { echo "::error::Guide, étape 7.3 : init n'est pas « Exited (0) »"; exit 1; }
[ "$(sudo docker inspect -f '{{.State.Health.Status}}' "$(sudo docker compose ps -q db)")" = healthy ] || { echo "::error::Guide, étape 7.3 : db n'est pas « healthy »"; exit 1; }
[ "$(sudo docker inspect -f '{{.State.Running}}' "$(sudo docker compose ps -q web)")" = true ] || { echo "::error::Guide, étape 7.3 : web n'est pas démarré"; exit 1; }
for _ in $(seq 1 30); do
  [ "$(curl -sk https://localhost/healthz || true)" = ok ] && { echo "États conformes à l'étape 7.3, site joignable."; exit 0; }
  sleep 2
done
echo "::error::Guide, étape 7.4 : https://localhost/healthz ne répond pas « ok »"
exit 1
