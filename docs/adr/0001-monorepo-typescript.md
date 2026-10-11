# ADR 0001 — Monorepo TypeScript (pnpm workspaces)

**Statut** : acceptée (phase 0)

## Contexte
L'outil historique est un fichier HTML unique de 3 Mo, et le serveur v2 un JavaScript sans typage. La refonte sépare l'API et l'interface, qui partagent les mêmes règles : format du jeton d'installation, rôles, schémas des échanges, format legacy.

## Décision
- Un seul dépôt et des espaces de travail pnpm : `packages/shared` (schémas zod, types, format legacy), `apps/api`, `apps/web`, `tests/e2e`.
- TypeScript en mode strict partout (`strict`, `noUncheckedIndexedAccess`).
- Le paquet partagé expose ses sources TypeScript au développement et aux tests (condition `source`) et son JavaScript compilé en production (`dist/`).
- pnpm plutôt que npm : installation stricte (pas de dépendance fantôme), stockage dédupliqué, filtre par paquet pour les images Docker.

## Conséquences
- Une règle définie une fois (ex. normalisation du jeton) est appliquée à l'identique par l'API et l'interface.
- La version de pnpm est figée (`packageManager`), et Node 24 est imposé (`engines`).
