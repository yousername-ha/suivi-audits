#!/bin/sh
# A2 : .env reste l'autorité sauf activation serveur ET couple web sélectionné.
set -eu
if [ "${TLS_WEB_MANAGEMENT:-0}" = 1 ] && [ "${TLS_TERMINATION:-caddy}" = caddy ] && [ "$(cat /certs-web/mode 2>/dev/null || true)" = web ]; then
  CADDY_TLS='/certs-web/cert.pem /certs-web/key.pem'
  export CADDY_TLS
fi
exec /usr/local/bin/caddy run --config /etc/caddy/Caddyfile.gateway --adapter caddyfile
