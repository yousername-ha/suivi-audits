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
exec /usr/local/bin/caddy run --config /etc/caddy/Caddyfile.gateway --adapter caddyfile
