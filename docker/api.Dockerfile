# syntax=docker/dockerfile:1
# Suivi des audits SMSI — image de l'API (Node 26). Multi-étapes : seule l'étape finale (sans npm ni pnpm) est livrée.
ARG NODE_IMAGE=node:26-alpine

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
    pnpm install --frozen-lockfile --filter "@suivi/api..." --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @suivi/shared build && pnpm --filter @suivi/api build
# Dépendances de production uniquement.
RUN rm -rf node_modules packages/shared/node_modules apps/api/node_modules \
 && pnpm install --frozen-lockfile --prod --filter "@suivi/api..." --ignore-scripts --offline

FROM ${NODE_IMAGE}
LABEL org.opencontainers.image.title="suivi-audits-api" \
      org.opencontainers.image.description="Suivi des audits SMSI ISO 27001 / HDS — API" \
      org.opencontainers.image.source="https://github.com/yousername-ha/suivi-audits" \
      org.opencontainers.image.licenses="UNLICENSED"
# Correctifs de l'OS de base ; npm, npx, yarn et corepack retirés de l'image d'exécution (surface d'attaque réduite).
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /src/package.json ./
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/packages/shared/package.json packages/shared/
COPY --from=build /src/packages/shared/dist packages/shared/dist
COPY --from=build /src/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /src/apps/api/package.json apps/api/
COPY --from=build /src/apps/api/node_modules apps/api/node_modules
COPY --from=build /src/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
COPY apps/api/seed apps/api/seed
COPY apps/api/legacy-shim apps/api/legacy-shim
# Outil historique (fichier unique), servi sous /legacy.
COPY app/public apps/api/legacy
# Outils d'exploitation : docker compose exec app setup-token | suivi <commande>
COPY apps/api/bin/setup-token apps/api/bin/suivi /usr/local/bin/
# Code en lecture seule pour l'utilisateur d'exécution.
RUN chown -R root:root /app /usr/local/bin/setup-token /usr/local/bin/suivi \
 && chmod -R a-w,a+rX /app && chmod 0555 /usr/local/bin/setup-token /usr/local/bin/suivi
USER node
WORKDIR /app/apps/api
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
