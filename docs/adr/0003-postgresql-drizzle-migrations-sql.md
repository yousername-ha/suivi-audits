# ADR 0003 — PostgreSQL, Drizzle ORM, migrations SQL versionnées

**Statut** : acceptée (phase 0) ; la partie Drizzle est remplacée par l'[ADR 0062](0062-acces-aux-donnees-kysely.md) (Kysely, types générés de la base migrée).

## Contexte
Une base v2 existante doit être migrée **sans perte**. La v2 enregistrait ses migrations dans `schema_migrations`, et `001_init.sql` est publié.

## Décision
- Migrations **écrites en SQL** et versionnées (`apps/api/migrations/NNN_*.sql`). Elles sont appliquées au démarrage, sous verrou consultatif, dans la même table `schema_migrations` que la v2. Une base v2 n'exécute donc que les migrations 002 et suivantes.
- `001_init.sql` est conservé à l'octet près (un test vérifie son empreinte) : une migration publiée ne change jamais.
- Drizzle ORM sert au **typage des requêtes** (`src/db/schema.ts`). Un test compare ce schéma à la base réellement migrée, colonne par colonne. On n'utilise pas drizzle-kit pour générer les migrations : un SQL relu reste plus sûr pour les données de production (déclencheurs, `IF EXISTS`, reprise de l'existant).
- Les requêtes complexes (jointures, recherche plein texte) restent en SQL paramétré.

## Conséquences
- Le test `migrations.test.ts` crée une vraie base v2 (schéma, comptes, TOTP, document chiffré, état), la migre et vérifie qu'elle reste utilisable.
- Les migrations s'exécutent avec le rôle applicatif, non superutilisateur : aucune extension privilégiée n'est requise.
