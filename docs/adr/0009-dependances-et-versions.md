# ADR 0009 — Dépendances retenues et lignes de versions

**Statut** : acceptée (phase 0)

## Contexte
Règle du projet : aucune nouvelle dépendance sans justification. La v2 n'avait qu'une dépendance d'exécution (`pg`).

## Décision : dépendances d'exécution

| Paquet | Où | Justification |
|---|---|---|
| `pg` | API | Pilote PostgreSQL (déjà en v2), y compris pour LISTEN/NOTIFY. |
| `fastify` | API | Socle HTTP (ADR 0002) ; apporte `pino` pour les journaux. |
| `pino` | API | Journaux JSON pour le SIEM, avec masquage des secrets ; même version que celle de Fastify. |
| `drizzle-orm` | API | Typage des requêtes (ADR 0003) ; sans dépendance d'exécution propre. |
| `zod` | API, interface, partagé | Un seul langage de schémas pour la validation, les types et l'OpenAPI. |
| `react`, `react-dom` | Interface | Interface (ADR 0006). |
| `react-router` | Interface | Navigation. |
| `@tanstack/react-query` | Interface | Cache des données, invalidé par le temps réel. |
| `@mantine/core`, `@mantine/hooks`, `@mantine/notifications` | Interface | Composants accessibles en français, sous CSP stricte (ADR 0006). |
| `qrcode-generator` | Interface | QR code d'enrôlement TOTP. Même bibliothèque que la v2 (déjà intégrée sous forme de copie), sans dépendance. |

Outils de développement : TypeScript, ESLint et typescript-eslint, Prettier, Vitest, Playwright, tsx, Vite et `@vitejs/plugin-react`, types Node, pg et React.

Il n'y a **aucune** extension Fastify (cookies, CORS, swagger, multipart) : leur rôle est assuré par quelques fonctions du projet, testées.

## Décision : versions
Le projet utilise les **dernières versions des lignes majeures éprouvées** plutôt que les toutes dernières majeures, sorties récemment :
- TypeScript 5.9, Vite 7, Mantine 8, Vitest 3, ESLint 9, pnpm 10 ;
- React 19, React Router 7, Fastify 5, zod 4 ;
- Node 24 LTS et PostgreSQL 17.

Les versions sont figées (`save-exact`), et le fichier `pnpm-lock.yaml` fait foi. Trivy (CI) bloque toute vulnérabilité critique, ce qui impose de monter de version dès qu'un correctif l'exige.

## Conséquences
- Toute nouvelle dépendance ajoute une ligne à ce tableau, dans la même PR.
- Une montée de version majeure se fait dans une PR dédiée, et l'ADR est mise à jour.
