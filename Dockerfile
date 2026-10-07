# Suivi des audits SMSI ISO 27001 / HDS — image applicative
FROM node:24-alpine AS deps
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM node:24-alpine
LABEL org.opencontainers.image.title="suivi-audits-smsi" \
      org.opencontainers.image.description="Suivi des audits SMSI ISO 27001 / HDS" \
      org.opencontainers.image.version="2.0.0"
# Correctifs de l'OS de base ; npm retiré de l'image d'exécution (surface d'attaque réduite).
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/package.json ./
COPY app/src ./src
COPY app/web ./web
COPY app/public ./public
COPY app/seed ./seed
# Code en lecture seule pour l'utilisateur d'exécution.
RUN chown -R root:root /app && chmod -R a-w,a+rX /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
