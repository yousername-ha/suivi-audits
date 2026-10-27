#!/usr/bin/env bash
# Poste de développement ou session Claude Code : lit le résultat des tests de bout en bout d'une PR, affiche les annotations
# (tests en échec ou instables, voir scripts/ci/rapport-e2e.mjs) et, avec --rejouer, relance uniquement le job en échec.
#   scripts/dev/rejouer-playwright.sh 127            état et annotations
#   scripts/dev/rejouer-playwright.sh 127 --rejouer  relance le job Playwright s'il a échoué
# Les journaux et artefacts de la CI ne se téléchargent pas depuis une session Claude Code : les annotations sont la source.
set -eu
R=repos/yousername-ha/suivi-audits
n=${1:?numéro de PR}
sha=$(gh api "$R/pulls/$n" --jq .head.sha)
job=$(gh api "$R/commits/$sha/check-runs?per_page=50" \
  --jq '[.check_runs[] | select(.name | test("Playwright"))] | sort_by(.started_at) | last')
echo "$job" | jq -r '"Playwright sur \(.head_sha[0:7]) : \(.status) / \(.conclusion // "-") (job \(.id))"'
id=$(echo "$job" | jq -r .id)
gh api "$R/check-runs/$id/annotations" \
  --jq '.[] | select(.message | test("Node.js 20|ubuntu-latest") | not) | "\(.annotation_level) \(.path):\(.start_line) \(.title // "") — \(.message)"'
if [ "${2:-}" = "--rejouer" ] && [ "$(echo "$job" | jq -r .conclusion)" = "failure" ]; then
  run=$(gh api "$R/actions/jobs/$id" --jq .run_id)
  gh api -X POST "$R/actions/runs/$run/rerun-failed-jobs" > /dev/null && echo "Job en échec relancé (exécution $run)."
fi
