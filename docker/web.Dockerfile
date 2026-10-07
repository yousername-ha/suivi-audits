# syntax=docker/dockerfile:1
# Suivi des audits SMSI — frontal HTTPS (Caddy 2) avec l'interface web (React) compilée.
# Caddy s'exécute sans privilège (utilisateur caddy, ports internes 8080 et 8443).
ARG NODE_IMAGE=node:24-alpine
ARG CADDY_IMAGE=caddy:2-alpine

FROM ${NODE_IMAGE} AS build
RUN npm install -g pnpm@10.34.6 --no-audit --no-fund
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@suivi/web..." --ignore-scripts
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @suivi/web build

FROM ${CADDY_IMAGE}
LABEL org.opencontainers.image.title="suivi-audits-web" \
      org.opencontainers.image.description="Suivi des audits SMSI ISO 27001 / HDS — frontal HTTPS et interface web" \
      org.opencontainers.image.source="https://github.com/yousername-ha/suivi-audits" \
      org.opencontainers.image.licenses="UNLICENSED"
RUN apk upgrade --no-cache \
 && addgroup -S -g 1001 caddy && adduser -S -D -H -u 1001 -G caddy caddy \
 && mkdir -p /data /config && chown -R caddy:caddy /data /config \
 # Copie du binaire SANS sa capacité de fichier cap_net_bind_service : inutile sur les ports 8080/8443,
 # et incompatible avec cap_drop: ALL (exécution refusée).
 && cp /usr/bin/caddy /usr/local/bin/caddy && chmod 0555 /usr/local/bin/caddy
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/apps/web/dist /srv
RUN chown -R root:root /srv /etc/caddy && chmod -R a-w,a+rX /srv /etc/caddy
USER caddy
EXPOSE 8080 8443
CMD ["/usr/local/bin/caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
