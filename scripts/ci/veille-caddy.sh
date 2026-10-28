#!/usr/bin/env bash
# Veille quotidienne du correctif Caddy (exception Trivy sur go-jose v3, voir .trivyignore.yaml et ADR 0063).
# Ouvre une demande dans le dépôt quand :
#   - une version de Caddy plus récente que celle de docker/web.Dockerfile n'exige plus go-jose v3 (retirer l'exception) ;
#   - l'exception expire dans moins de 7 jours (la CI échouera ensuite, il faut décider avant).
# N'écrit rien d'autre : aucune modification de fichier ni de branche. Variable GH_TOKEN requise (droit issues: write).
set -euo pipefail
cd "$(dirname "$0")/../.."

DOCKERFILE=docker/web.Dockerfile
EXCEPTIONS=.trivyignore.yaml
BIBLIOTHEQUE='github.com/go-jose/go-jose/v3'

epingle=$(sed -n 's|.*github.com/caddyserver/caddy/v2@v\([0-9][0-9.]*\).*|\1|p' "$DOCKERFILE" | head -n 1)
[ -n "$epingle" ] || { echo "Version de Caddy introuvable dans $DOCKERFILE." >&2; exit 1; }

demande() { # titre corps : une seule demande ouverte par titre
  local titre=$1 corps=$2 existantes
  existantes=$(gh issue list --state open --search "\"$titre\" in:title" --json title --jq "[.[] | select(.title == \"$titre\")] | length")
  if [ "$existantes" -gt 0 ]; then
    echo "Demande déjà ouverte : $titre"
  else
    gh issue create --title "$titre" --body "$corps"
    echo "Demande ouverte : $titre"
  fi
}

derniere=$(gh api repos/caddyserver/caddy/releases/latest --jq .tag_name)
derniere=${derniere#v}
echo "Caddy épinglé : $epingle ; dernière version : $derniere"

if [ "$derniere" != "$epingle" ] && [ "$(printf '%s\n%s\n' "$epingle" "$derniere" | sort -V | tail -n 1)" = "$derniere" ]; then
  gomod=$(gh api "repos/caddyserver/caddy/contents/go.mod?ref=v$derniere" --jq .content | base64 -d)
  if printf '%s\n' "$gomod" | grep -qF "$BIBLIOTHEQUE"; then
    echo "Caddy $derniere exige encore $BIBLIOTHEQUE : pas de correctif."
  else
    demande "Caddy $derniere n'exige plus go-jose v3" \
"La version $derniere de Caddy (épinglée : $epingle) ne liste plus \`$BIBLIOTHEQUE\` dans son go.mod.

À faire : mettre à jour Caddy dans \`docker/web.Dockerfile\`, puis retirer l'exception correspondante de \`.trivyignore.yaml\` et vérifier que le scan des images passe.

Demande ouverte automatiquement par le workflow « Veille Caddy » (scripts/ci/veille-caddy.sh)."
  fi
else
  echo "Aucune version de Caddy plus récente que $epingle."
fi

expiration=$(sed -n 's|^ *expired_at: *\([0-9-]*\).*|\1|p' "$EXCEPTIONS" | sort | head -n 1)
if [ -n "$expiration" ]; then
  reste=$(( ($(date -u -d "$expiration" +%s) - $(date -u +%s)) / 86400 ))
  echo "Exception la plus proche : $expiration (dans $reste jours)"
  if [ "$reste" -lt 7 ]; then
    demande "Exception Trivy à réexaminer avant le $expiration" \
"Une exception de \`$EXCEPTIONS\` expire le $expiration. Passé ce jour, le scan des images échoue.

À faire : constater si un Caddy sans \`$BIBLIOTHEQUE\` est sorti ; sinon, décision du RSSI sur la prolongation (nouvelle date et justification dans le fichier).

Demande ouverte automatiquement par le workflow « Veille Caddy » (scripts/ci/veille-caddy.sh)."
  fi
fi
