# Diagnostic technique — base Sauge et évolution SMSI / GRC

Date : 9 octobre 2026. Lot initial : analyse uniquement, sans changement fonctionnel, graphique ou migration.
Branche exclusive : `feature/gpt6-evolution-smsi-grc`, issue du commit `b148c1ba303954b7023996fce3d0eff2923326b5` (égal au main distant constaté).

## Sources et périmètre

La base d'analyse est `Suivi_SMSI_refonte_Sauge.zip`, SHA-256 `e01d85d2f20eadd7a641e652e0763ec197541a88b17ab409da1b7977741e2697`, racine `suivi-audits-refonte-cartographie/`. L'archive contient 427 entrées et aucun historique Git. Elle a été extraite séparément pour préserver le checkout v2 et les données de son environnement. Les chemins de code ci-dessous désignent le contenu du ZIP, sauf indication contraire.

La demande explicite fixe la branche, la préservation de l'existant, le diagnostic préalable et les PR sans fusion. Le document `Texte collé.txt` constitue une proposition de périmètre A–L à qualifier, pas une autorisation autonome de lancer chaque fonctionnalité, de changer le modèle de l'agent ou d'utiliser la branche `GTP6`. Aucun contenu normatif cité dans ce document n'a été vérifié durant cet audit de code ; aucune conformité réglementaire n'est affirmée.

Le checkout distant est une v2 Node/CommonJS (`app/src`, dépendance pg uniquement). Le ZIP est une v3 TypeScript/React, avec CI, contrats et cartographie. Ce sont des bases distinctes. Une copie destructive du ZIP à la racine n'est pas une évolution incrémentale acceptable. Avant les lots fonctionnels, préparer un lot d'intégration de cette base v3, avec conservation explicite de la v2 et inventaire de chaque remplacement. Ne pas traiter l'archive comme un commit déjà présent sur main.

## Architecture observée

| Élément | Existant dans le ZIP | Évolution proposée | Risque à maîtriser |
|---|---|---|---|
| Stack | Node >=24 ; pnpm 10.34.6 ; TypeScript strict ; six workspaces | Conserver la stack et le lockfile | Différence majeure avec le checkout v2 |
| API | Fastify 5.12.5, pg 8.23.1, Drizzle 0.44.7, zod 4.6.5 | Étendre les routes déclaratives existantes | Ne pas contourner les gardes et la validation |
| Frontend | React 19.3.0, Vite 7.3.7, Mantine 8.3.18, Router, TanStack Query | Réutiliser composants, cache et navigation | Régression CSP, responsive et sessions |
| Interface Sauge | `packages/ui` : tokens, thèmes, composants, styles statiques | Conserver intégralement la charte | Tests statiques insuffisants pour garantir le rendu |
| Base | PostgreSQL 17 ; cinq migrations SQL ; verrou consultatif et transactions | Migrations additives après tests de reprise | Données historiques et objets déjà normalisés |
| Modèle métier | `app_state.data` JSONB pour la majorité du legacy ; `maps` et `map_versions` normalisées | Réutiliser les objets et mappers existants | Création de modèles parallèles et pertes de champs |
| Documents | Documents/versionnement, liens, chiffrement AES-GCM, contrôle de fichiers | Réutiliser les preuves et documents | Préservation de la clé maître et des droits |
| Temps réel | SSE, LISTEN/NOTIFY, présence et invalidation Query | Étendre les événements avec filtrage RBAC | Cache sensible et session révoquée |
| Exploitation | Caddy termine TLS ; données bind dans DATA_DIR ; scripts de sauvegarde et mise à jour | Séparer lecture d'état et commandes privilégiées | Exposer Docker ou une commande arbitraire à l'API |

Flux principal : navigateur → Caddy (React, TLS, CSP) → API Fastify → PostgreSQL. Les réseaux API/base sont internes. ClamAV est facultatif. Le programme historique reste accessible via `/legacy`, avec adaptateur `apps/api/legacy-shim/shim.js`.

Écrans React présents : accueil, connexion, installation, compte, documents, administration, droits, import, paramètres, écrans muraux et cartographie (`apps/web/src/pages`). Les autres modules métier restent pour une grande partie dans le document legacy. La documentation `docs/ARCHITECTURE.md` conserve des formulations « phase 0 » malgré des livraisons ultérieures : vérifier l'état dans le code et les migrations, pas uniquement dans le titre.

## Données, migrations et compatibilité

- `001_init.sql` correspond octet pour octet à la migration du checkout v2 : SHA-256 `8812f0ed1290a6916e676be9a5f85a1a3e669512585417367175608490df56ae`.
- `002_v3_fondations.sql` ajoute traçabilité des imports, versions, champs de conservation legacy et notifications.
- `003_droits.sql` introduit groupes, rôles et attributions et reprend les rôles v2.
- `004_affichage_et_ecrans_muraux.sql` ajoute préférences et écrans muraux.
- `005_cartographie.sql` normalise les cartes et leur historique.
- `apps/api/src/db/db.ts` applique chaque migration en transaction sous verrou. Les migrations sont suivies par nom ; ce mécanisme ne constitue pas un contrôle général d'empreinte de toutes les migrations déjà appliquées.
- Les imports legacy disposent de simulation, historique, source chiffrée et annulation. L'export recomposé et les champs `extra` doivent rester des contrats de non-régression.
- Les tests existants vérifient la migration d'une base v2 avec authentification, documents chiffrés et état historique. Ils ont été exécutés sur une base de test isolée ; aucune migration n'a été appliquée aux données de l'environnement v2.

## Sécurité et dettes ciblées

Les contrôles centraux sont réutilisables : routes déclarées par `route()`, permissions module/action côté serveur, CSRF + origine, session opaque, TOTP, scrypt, concurrence `If-Match`, audit SQL en ajout seul. Les paramètres de sécurité imposent notamment une MFA obligatoire. Les écritures de nouveaux modules doivent reprendre ces mécanismes et leurs tests.

Constats à distinguer des hypothèses :

1. **Déconnexion : défaut de gestion d'erreur confirmé dans le code**, sans reproduction navigateur du bug signalé. `apps/web/src/components/Layout.tsx` ignore toute erreur du POST logout avec `.catch(() => {})`, puis vide le cache et navigue. Un échec réseau ou CSRF peut donc être présenté comme une réussite locale alors que la session serveur demeure. L'API détruit la session et efface le cookie lorsque la requête aboutit. Le flux SSE invalide `ME_KEY` sur logout, mais ne démontre pas à lui seul la purge de tous les caches des autres onglets. Ajouter des cas succès, réseau indisponible, CSRF invalide, session expirée et multi-onglets avant correction.
2. **Validation des réponses : écart documentation/code observé.** `apps/api/src/http/route.ts` utilise `response` pour OpenAPI ; le résultat du handler est envoyé sans `d.response.parse(out)`. Ne pas présenter la validation des sorties comme universellement appliquée. Évaluer les contrats existants et la compatibilité avant de la rendre effective.
3. **Audit : garanties différentes selon le contexte.** `Db.audit()` relance une erreur dans une transaction lorsqu'un client SQL est fourni ; hors transaction, elle journalise l'échec sans interrompre l'opération. Examiner les opérations sensibles au cas par cas ; ne pas déduire une atomicité systématique métier/audit.
4. **Moteur de référentiels : extension nécessaire, pas création depuis zéro.** `frameworks`, `activeFw`, `items` et les droits conformité existent. `routes/settings.ts` contient encore des catégories ISO/Annexe A/HDS fixes. Un mode ISO 9001 seul exige un modèle d'applicabilité et une activation générique, tout en conservant import/export legacy et les identifiants des mesures.
5. **Sauvegardes : capacités réelles limitées côté web.** Les scripts assurent pg_dump, secrets, autorité Caddy, chiffrement optionnel, empreinte et rétention ; le web lit des rapports et des paramètres de suivi. Il n'existe pas, dans les routes examinées, de moteur web de lancement/planification/restauration. Une interface ne suffit pas à en créer un.
6. **Restauration : frontière de confiance à formaliser.** `restore.sh` extrait l'archive avant la confirmation, et vérifie l'empreinte seulement si le fichier associé existe. Les archives attendues sont celles de l'exploitation, pas des fichiers publics non fiables. Toute restauration web nécessite validation des chemins/membres, intégrité, permissions, isolation et contrôle du périmètre avant exécution.
7. **TLS : Caddy est l'autorité d'exécution.** L'API applicative n'est pas le terminateur TLS. Commencer par métadonnées/expiration ; remplacement et renouvellement nécessitent une interface d'exploitation restreinte, une priorité explicite avec `.env` et un retour arrière. Ne pas monter le socket Docker dans l'application.
8. **Build frontend : avertissement de taille.** Le bundle principal vaut environ 1 045 kB minifié (323 kB gzip). Le build passe ; mesurer chargement et mémoire avant de proposer du découpage. L'avertissement Rollup sur les annotations zod est non bloquant.

Ces constats ne constituent pas un audit de sécurité exhaustif ni la preuve d'une exploitation.

## Validation de la base ZIP

Machine actuelle : Node 24.19.0, pnpm utilisé pour les contrôles 10.34.6, PostgreSQL 17.11 en conteneur de test dédié, port local 55432. Installation gelée sans changement de dépendance. Un premier essai avec le pnpm global 11 a ajouté un champ à `pnpm-workspace.yaml` ; ce changement a été restauré depuis le ZIP et l'installation rejouée avec la version prévue. Aucun fichier source du ZIP ne reste modifié.

Commandes lancées depuis la racine extraite ; pnpm 10.34.6 a été invoqué via `npm exec --package pnpm@10.34.6` pour respecter la version fixée :

| Contrôle | Résultat |
|---|---|
| `pnpm install --frozen-lockfile` | Réussi avec pnpm 10.34.6 |
| `pnpm lint` | Réussi, zéro avertissement ESLint |
| `pnpm format:check` | Réussi |
| `pnpm typecheck` | Réussi sur les workspaces concernés, y compris types E2E |
| `pnpm build` | Réussi, avertissements de bundle et annotations zod |
| Tests shared | 192 réussis, 8 fichiers |
| Tests UI | 102 réussis, 1 fichier, contrastes inclus |
| Tests API sur PostgreSQL | 113 réussis, 11 fichiers, migrations/RBAC/import/documents/cartographie/SSE inclus |
| Tests web | 3 réussis, 1 fichier de charte |
| Total Vitest | **410 tests réussis, 21 fichiers** |
| Playwright, captures responsive/visuelles, pile Docker v3 | Non exécutés ; le typage E2E ne vaut pas leur exécution |
| Trivy, CodeQL, SBOM, signatures, restauration complète en conditions de déploiement | Présents dans la CI du ZIP mais non exécutés ici |

Les tests ont été limités à deux workers et exécutés séquentiellement par workspace. La suite API utilise des bases temporaires dédiées. Les résultats de l'ancien onboarding v2 ne valident pas la v3. Les 410 tests ne prouvent pas l'absence de régression visuelle ou le bon fonctionnement du logout navigateur.

## Plan priorisé et critères de passage

| Lot | Nature | Contenu | Validation minimale avant PR |
|---|---|---|---|
| 0 — présent diagnostic | Analyse | Provenance, architecture, état mesuré et risques | Contrôles ci-dessus ; aucun code métier modifié |
| 1 — intégration de la base Sauge | Intégration | Inventaire v2/v3, conservation explicite de la v2, import contrôlé du ZIP sur cette branche | Comparaison complète des fichiers, migrations v2→v3, imports aller-retour, pile v3, captures Sauge |
| 2 — déconnexion | Correction | Reproduire A4 puis gérer erreurs, session, caches et onglets | Tests API et Playwright couvrant succès et échecs ; aucune simple redirection de façade |
| 3 — mire et guide utilisateur | Amélioration UI | Qualifier A3 : illustration ou stepper concerné ; guide A5 avec composants actuels | Desktop/tablette/mobile, clavier, CSP, captures et contrats de charte |
| 4 — sauvegarde/TLS | Extension exploitation | A1/A2 : observation d'abord, ADR pour commandes privilégiées et reprise | RBAC, audit, intégrité, concurrence des tâches, restauration isolée et retour arrière |
| 5 — modularité et référentiels | Extension du socle | B/C : activation distincte des permissions, applicabilité générique et références versionnées | Mode ISO 9001 seul, coexistence ISO/HDS, mappers/imports et permissions serveur |
| 6 — programmes et continuité | Extensions métier | D/E/F/G/K : CaRE, BIA/PCRA, HAS, contrôles et parcours guidé sur les objets communs | Sources officielles/versionnées identifiées ; aucune obligation ou règle financière supposée |
| 7 — automatisations | Extensions | H/I/J : amélioration continue, email et MCP avec périmètre restreint | Files de tâches, contrôle d'accès, gestion des secrets, traçabilité et tests d'intégration |
| 8 — étude comparative | Analyse | L : comparer les parcours sans copier de contenu ni remplacer la charte | Rapport distinguant propositions et exigences vérifiées |

Pour chaque lot : diagnostic ciblé, petit diff, tests appropriés, Conventional Commit en français, notes de changement selon les conventions de la base, et PR vers main sans fusion automatique. Aucune migration publiée n'est réécrite ; les transitions destructives doivent être étalées. Les écrans réutilisent `packages/ui`, et les changements visuels voulus sont explicitement revus plutôt que couverts par un renouvellement aveugle des captures.

La lecture des sources officielles ISO/ANS/HAS devient un prérequis au lot métier correspondant, pas une validation déjà obtenue par cet audit. Les références payantes ou inaccessibles restent signalées comme telles.
