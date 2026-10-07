# Décisions d'architecture (ADR)

Une ADR courte par décision structurante : contexte, décision, conséquences. Une décision remplacée n'est pas effacée : elle passe au statut « Remplacée par ADR-NNNN ».

| N° | Décision | Statut |
|---|---|---|
| [0001](0001-monorepo-typescript.md) | Monorepo TypeScript (pnpm workspaces) | Acceptée |
| [0002](0002-api-fastify-zod-openapi.md) | API Fastify, validation zod, OpenAPI généré depuis les mêmes schémas | Acceptée |
| [0003](0003-postgresql-drizzle-migrations-sql.md) | PostgreSQL, Drizzle ORM, migrations SQL versionnées compatibles v2 | Acceptée |
| [0004](0004-concurrence-par-enregistrement.md) | Concurrence optimiste par enregistrement (If-Match, 412) | Acceptée |
| [0005](0005-temps-reel-sse-listen-notify.md) | Temps réel : SSE alimenté par LISTEN/NOTIFY | Acceptée |
| [0006](0006-front-react-mantine-csp-stricte.md) | Front React, Vite, TanStack Query, Mantine sous CSP stricte | Acceptée |
| [0007](0007-transition-legacy.md) | Transition depuis l'outil historique : une seule source modifiable par module | Acceptée |
| [0008](0008-images-ghcr-cosign-caddy-non-root.md) | Images GHCR signées (cosign), frontal Caddy sans privilège | Acceptée |
| [0009](0009-dependances-et-versions.md) | Dépendances retenues et lignes de versions | Acceptée |
