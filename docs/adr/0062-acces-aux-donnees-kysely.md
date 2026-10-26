# ADR 0062 — Accès aux données : migrations SQL comme source unique, requêtes typées avec Kysely

- Statut : acceptée ; remplace la partie « Drizzle » de l'[ADR 0003](0003-postgresql-drizzle-migrations-sql.md)
- Date : 2026-10-26
- Contexte : décision du RSSI du 26/10/2026, après comparaison de Drizzle, Prisma, Slonik, pgTyped, du SQL brut et de
  Kysely (qualité, sécurité, mises à jour, maintenabilité). Constat : l'API compte environ 336 requêtes SQL paramétrées
  écrites à la main sur `pg`, non typées (une colonne renommée par une migration n'était détectée qu'à l'exécution), et
  Drizzle n'était utilisé que dans `routes/documents.ts`, avec un `db/schema.ts` de 1 414 lignes : une **deuxième
  description du schéma**, en concurrence avec les migrations SQL qui font foi. Drizzle 1.0, en préversion, annonce des
  ruptures ; Prisma impose un moteur et un langage de schéma propres ; pgTyped n'est plus entretenu depuis février 2025.

## Décision

1. **Les migrations SQL restent la seule source de vérité du schéma** (inchangé : `apps/api/migrations/NNN_*.sql`,
   relues, jamais modifiées une fois publiées).
2. **Kysely 0.29.7** (aucune dépendance) construit les requêtes typées. Il réutilise le pool `pg` existant (`svc.db.k`) ;
   dans `db.tx(async (c, k) => …)`, `k` s'exécute sur la même connexion, donc dans la même transaction que `c`.
   Les noms de colonnes restent ceux de la base (`created_at`), comme dans le SQL existant.
3. **Types générés de la base réellement migrée** : `pnpm --filter @suivi/api db:types` crée une base temporaire,
   applique les migrations, lit le catalogue (`information_schema`, `pg_enum`) et écrit `src/db/types.generated.ts`
   (générateur propre au projet, `src/db/introspection.ts`, testé ; pas de `kysely-codegen` et de ses 9 dépendances).
   Les types suivent les analyseurs de `pg` du projet : `int8` en nombre, `numeric` en texte, `jsonb` lu analysé et écrit
   en texte JSON, horodatages en `Date`. La CI échoue si le fichier versionné diffère (`db:types --check` et test de
   `migrations.test.ts`) : une migration qui renomme une colonne casse la compilation du code qui l'utilise.
4. **Sécurité** : Kysely lie toujours les valeurs en paramètres. `sql.raw` et `sql.lit`, qui insèrent du texte non
   paramétré, sont interdits dans l'API par ESLint ; l'import de Drizzle aussi.
5. **Adoption progressive** : le nouveau code d'accès aux données s'écrit en Kysely ; le SQL paramétré existant reste
   valide et se convertit **module par module**, dans des PR dédiées, en vérifiant chaque module par ses tests. Une
   requête que Kysely exprimerait mal (récursivité, fonctions de fenêtre complexes, `FOR UPDATE SKIP LOCKED` particulier)
   peut rester en SQL paramétré, ou utiliser le gabarit `sql\`…\`` de Kysely avec valeurs liées.
6. **Drizzle est retiré** : `routes/documents.ts` (liens) est converti, `db/schema.ts` supprimé, `drizzle-orm` retiré.
   Le test qui comparait le schéma Drizzle à la base compare désormais les types générés à la base migrée.

## Conséquences

- Une PR qui ajoute une migration régénère et versionne `types.generated.ts`.
- [ADR 0009](0009-dependances-et-versions.md) : `kysely` remplace `drizzle-orm` dans les dépendances d'exécution.
- Conversion à venir, par module : ordre proposé du moins au plus risqué (lectures simples, puis écritures versionnées
  avec `If-Match`, puis files de travail avec `FOR UPDATE`, `power()`, `LEAST` comme `courriel.ts`).

## Ce qui n'est pas fait

- Les 336 requêtes existantes ne sont pas converties dans cette PR.
- Les vues (`v_documents`) sont typées comme des tables : rien n'empêche à la compilation d'y écrire (PostgreSQL le refuse).
