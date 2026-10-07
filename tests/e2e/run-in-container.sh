#!/bin/sh
# Tests de bout en bout dans le conteneur Playwright officiel : même navigateur, mêmes polices et même rendu en local
# et en CI (indispensable aux captures de référence). La pile doit être démarrée (docker compose up -d).
#   ./tests/e2e/run-in-container.sh                         tous les tests
#   ./tests/e2e/run-in-container.sh --update-snapshots      régénère les captures de référence (à relire avant commit)
set -eu
cd "$(dirname "$0")/../.."
IMAGE=mcr.microsoft.com/playwright:v1.56.1-noble
# Jeton d'installation lu par le test « installation » (le conteneur n'a pas accès à Docker).
docker compose exec -T app setup-token > tests/e2e/.jeton
docker run --rm --network host --ipc=host \
  -v "$PWD:/work" -w /work/tests/e2e \
  -e CI -e E2E_TOKEN_CMD="cat .jeton" -e E2E_STACK_DIR=/work/tests/e2e \
  "$IMAGE" npx playwright test "$@"
