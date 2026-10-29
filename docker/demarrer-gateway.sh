#!/bin/sh
# Le mode de certificat se règle dans l'interface (Administration, Système) : .env reste l'autorité seulement si la gestion
# web est désactivée (TLS_WEB_MANAGEMENT=0), si TLS est terminé à l'extérieur, ou tant qu'aucun mode web n'est choisi.
set -eu
if [ "${TLS_WEB_MANAGEMENT:-1}" = 1 ] && [ "${TLS_TERMINATION:-caddy}" = caddy ]; then
  case "$(cat /certs-web/mode 2>/dev/null || true)" in
    web)
      CADDY_TLS='/certs-web/cert.pem /certs-web/key.pem'
      export CADDY_TLS
      ;;
    interne)
      CADDY_TLS=internal
      export CADDY_TLS
      ;;
    acme)
      # Deux lignes validées par l'exécutant hôte ; revalidées ici, sinon .env est conservé.
      courriel=$(sed -n 1p /certs-web/acme 2>/dev/null || true)
      serveur=$(sed -n 2p /certs-web/acme 2>/dev/null || true)
      if printf '%s' "$courriel" | grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$' \
        && printf '%s' "$serveur" | grep -Eq '^https://[A-Za-z0-9._~:/?&=%+-]+$'; then
        CADDY_TLS=$courriel
        ACME_CA=$serveur
        export CADDY_TLS ACME_CA
      fi
      ;;
  esac
fi
# Adresses servies (ADR 0077) : le nom du site, et, avec le certificat interne seulement, les noms et adresses IPv4 du
# serveur relevés par installer.sh (SITE_ADDRESS_EXTRA), pour ouvrir l'assistant avant que le nom DNS soit en place. ACME et
# un certificat fourni ne couvrent que le nom du site. Seuls lettres, chiffres, points et tirets sont acceptés.
noms=${SITE_ADDRESS:?SITE_ADDRESS absent}
[ "${CADDY_TLS:-internal}" != internal ] || noms="$noms ${SITE_ADDRESS_EXTRA:-}"
SITE_HTTPS=''
SITE_HTTP=''
for n in $noms; do
  printf '%s' "$n" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$' || continue
  case " $SITE_HTTPS " in *" $n:8443,"* | *" $n:8443 "*) continue ;; esac
  SITE_HTTPS="${SITE_HTTPS:+$SITE_HTTPS, }$n:8443"
  SITE_HTTP="${SITE_HTTP:+$SITE_HTTP, }http://$n:8080"
done
[ -n "$SITE_HTTPS" ] || { echo "SITE_ADDRESS invalide" >&2; exit 1; }
# Un navigateur qui ouvre https://<adresse IP> n'annonce aucun nom (SNI) : sans nom par défaut, Caddy ne sait pas quel
# certificat présenter et refuse la connexion. Première adresse IPv4 servie, sinon le nom du site.
SITE_DEFAULT_SNI=$SITE_ADDRESS
for n in $noms; do
  if printf '%s' "$n" | grep -Eq '^[0-9]+(\.[0-9]+){3}$'; then SITE_DEFAULT_SNI=$n; break; fi
done
export SITE_HTTP SITE_HTTPS SITE_DEFAULT_SNI
exec /usr/local/bin/caddy run --config /etc/caddy/Caddyfile.gateway --adapter caddyfile
