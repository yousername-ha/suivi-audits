# ADR 0002 — API Fastify, validation zod, OpenAPI généré

**Statut** : acceptée (phase 0)

## Contexte
Le serveur v2 était écrit sans framework : le routage, la validation et les contrôles d'accès étaient faits à la main, route par route. Le risque est d'oublier un contrôle sur une nouvelle route.

## Décision
- Fastify 5 : performant, journaux pino intégrés, `inject()` pour des tests sans réseau.
- Chaque route est **déclarée** (`apps/api/src/http/route.ts`) avec :
  - son niveau d'accès (`public`, `session`, `any`, `rw`, `admin`) ;
  - l'exigence CSRF ;
  - ses schémas zod (corps, paramètres, réponse).

  Un seul point applique le contrôle d'origine, le jeton CSRF, le rôle et la validation : une route ne peut pas l'oublier.
- La description OpenAPI 3.1 est **générée à partir de ces mêmes déclarations** (`z.toJSONSchema`), servie sur `/api/openapi.json` et publiée en artefact de CI. Le code et la documentation ne peuvent donc pas diverger.
- Aucune extension Fastify supplémentaire (cookies, swagger, multipart) : quelques dizaines de lignes maison remplacent des dépendances.
- Les messages de validation sont en français (`z.config(z.locales.fr())`).

## Conséquences
- Un test (`security.test.ts`) vérifie le niveau d'accès déclaré dans l'OpenAPI.
- Les dépôts de fichiers et les imports utilisent un corps binaire (`application/octet-stream`), avec une limite de taille propre à chaque route.
