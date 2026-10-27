#!/usr/bin/env bash
# Poste de développement ou session Claude Code : fusionne dans claude-suivi-smsi chaque PR donnée, dans l'ordre, seulement
# quand ses 7 contrôles sont verts. Arrêt au premier échec (rien n'est fusionné à l'aveugle).
#   scripts/dev/fusionner-apres-ci.sh 130 131 132
# - Passe une PR brouillon en « prête » (route REST ; GraphQL n'est pas disponible dans les sessions Claude Code).
# - Rebase une PR empilée sur claude-suivi-smsi si sa base est une autre branche (la précédente vient d'être fusionnée).
# - Fusion classique (merge commit), empreinte du commit testé imposée : un commit poussé entre-temps fait refuser la fusion.
# Ne fusionne jamais vers main : main n'évolue que par la PR claude-suivi-smsi → main, fusionnée sur accord du RSSI.
set -u
R=repos/yousername-ha/suivi-audits
CIBLE=claude-suivi-smsi
CONTROLES=7
for n in "$@"; do
  sha=$(gh api "$R/pulls/$n" --jq .head.sha)
  while true; do
    etat=$(gh api "$R/commits/$sha/check-runs?per_page=50" \
      --jq '[.check_runs[] | (.conclusion // .status)] | group_by(.) | map("\(.[0])=\(length)") | join(" ")' 2>/dev/null)
    if echo "$etat" | grep -qE "failure|cancelled|timed_out|action_required"; then
      echo "ARRÊT #$n : CI en échec ($etat)"
      gh api "$R/commits/$sha/check-runs?per_page=50" \
        --jq '.check_runs[] | select(.conclusion != "success") | "  \(.conclusion // .status) — \(.name) (job \(.id))"'
      exit 1
    fi
    [ "$etat" = "success=$CONTROLES" ] && break
    sleep 60
  done
  [ "$(gh api "$R/pulls/$n" --jq .draft)" = "true" ] && gh api -X POST "$R/pulls/$n/ccr/ready_for_review" > /dev/null
  if [ "$(gh api "$R/pulls/$n" --jq .base.ref)" != "$CIBLE" ]; then
    gh api -X PATCH "$R/pulls/$n" -f base="$CIBLE" > /dev/null
    sleep 8
  fi
  titre=$(gh api "$R/pulls/$n" --jq .title)
  r=$(gh api -X PUT "$R/pulls/$n/merge" -f merge_method=merge -f sha="$sha" \
    -f commit_title="Merge pull request #$n : $titre" --jq '"\(.merged) \(.sha[0:7])"' 2>&1)
  case "$r" in
    true*) echo "#$n fusionnée ($r)" ;;
    *) echo "ARRÊT #$n : fusion refusée ($r)"; exit 1 ;;
  esac
done
echo "Terminé : $* fusionnées."
