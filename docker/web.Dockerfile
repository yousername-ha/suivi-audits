# syntax=docker/dockerfile:1
# Suivi des audits SMSI — frontal HTTPS (Caddy 2) avec l'interface web (React) compilée.
# Caddy s'exécute sans privilège (utilisateur caddy, ports internes 8080 et 8443).
ARG NODE_IMAGE=node:24-alpine
ARG CADDY_IMAGE=caddy:2.11.7-alpine
ARG GO_IMAGE=golang:1.26.9-alpine

# Même Caddy et modules standards, compilés avec la bibliothèque Go corrigée.
# Les modules sont vérifiés par Go (sum.golang.org) ; aucune toolchain secondaire téléchargée.
FROM ${GO_IMAGE} AS caddy-build
RUN --mount=type=secret,id=build_ca --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    export CGO_ENABLED=0 GOTOOLCHAIN=local; \
    go mod download github.com/caddyserver/caddy/v2@v2.11.7 \
    && mkdir /src-caddy \
    && cp /go/pkg/mod/github.com/caddyserver/caddy/v2@v2.11.7/cmd/caddy/main.go /src-caddy/main.go \
    && cd /src-caddy && go mod init suivi-caddy \
    && go mod edit -require=github.com/caddyserver/caddy/v2@v2.11.7 -require=golang.org/x/net@v0.60.0 \
    && go build -mod=mod -o /go/bin/caddy .

FROM ${NODE_IMAGE} AS build
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm install -g pnpm@10.34.6 --no-audit --no-fund
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    pnpm install --frozen-lockfile --filter "@suivi/web..." --ignore-scripts
COPY packages/shared packages/shared
COPY packages/ui packages/ui
COPY apps/web apps/web
RUN pnpm --filter @suivi/web build

FROM ${CADDY_IMAGE}
COPY --from=caddy-build /go/bin/caddy /usr/local/bin/caddy
LABEL org.opencontainers.image.title="suivi-audits-web" \
      org.opencontainers.image.description="Suivi des audits SMSI ISO 27001 / HDS — frontal HTTPS et interface web" \
      org.opencontainers.image.source="https://github.com/yousername-ha/suivi-audits" \
      org.opencontainers.image.licenses="UNLICENSED"
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    apk upgrade --no-cache \
 && addgroup -S -g 1001 caddy && adduser -S -D -H -u 1001 -G caddy caddy \
 && mkdir -p /data /config && chown -R caddy:caddy /data /config \
 # Copie du binaire SANS sa capacité de fichier cap_net_bind_service : inutile sur les ports 8080/8443,
 # et incompatible avec cap_drop: ALL (exécution refusée).
 && chmod 0555 /usr/local/bin/caddy && rm /usr/bin/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/Caddyfile.gateway docker/Caddyfile.internal /etc/caddy/
COPY docker/maintenance /maintenance
COPY --from=build /src/apps/web/src/generated/mantine-vars.css /maintenance/theme.css
COPY packages/ui/src/fonts /maintenance/fonts
COPY --chmod=0555 docker/demarrer-web.sh /usr/local/bin/demarrer-web
COPY --chmod=0555 docker/demarrer-gateway.sh /usr/local/bin/demarrer-gateway
COPY --from=build /src/apps/web/dist /srv
RUN chown -R root:root /srv /etc/caddy /maintenance && chmod -R a-w,a+rX /srv /etc/caddy /maintenance \
 && chmod 0555 /usr/local/bin/demarrer-web /usr/local/bin/demarrer-gateway
USER caddy
EXPOSE 8080 8443
CMD ["/usr/local/bin/demarrer-web"]
