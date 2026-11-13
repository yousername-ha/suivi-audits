# Fournisseurs Studio — intégration du registre de l’organisation

12 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Intégration demandée par « Tu peux faire fournisseur », après l’aperçu proposé.** Le registre Fournisseurs de l’organisation est porté dans le code React. La cartographie et son habillage restent de côté ; aucune modification de leur code. Rôles conserve son statut distinct. Branche `codex/refonte-neon-main`, base applicative documentaire `f8734e6`.

[Capture HD du frontend intégré](validations/fournisseurs-studio/fournisseurs-hd.png) · [Reçu des vérifications](validations/fournisseurs-studio/validation.json) · [Proposition historique](propositions/fournisseurs-studio/README.md).

## Comportement obtenu

Le registre ouvre en vue compacte. Lignes fines, en-têtes centrés pour les états, indicateurs SaaS/MFA/SSO, recherche par loupe et filtres discrets. La vue détaillée ajoute les notes, réévaluations et rattachements. Les longues listes défilent dans leur zone, horizontalement si nécessaire sur les fenêtres étroites ; la page ne s’élargit pas.

Un clic sur une ligne ou Entrée/Espace ouvre une **consultation distincte de l’édition**. Informations, certificats, contrôles et évaluation sont séparés par onglets. Certificats et contrôles sont paginés un par un : les longues séries ne créent pas une fenêtre interminable. Les notes longues ont leur zone de lecture. La consultation conserve les dates, références, commentaires, emplacement et périmètre des certificats.

Les sélecteurs SSO/MFA/criticité/HDS restent modifiables directement selon les droits, sans ouvrir la fiche au clic. Le menu de ligne donne accès à la lecture, au formulaire existant, à l’évaluation, à son historique et aux rattachements. Les boutons Modifier/Évaluer ne sont pas proposés au lecteur. La fermeture rend le focus à la ligne ; recherche et filtres restituent le focus à leur commande.

SSO/MFA : Oui vert, Non rouge, En cours ambre, non renseigné/N/A neutres. Une criticité Oui est une attention, pas un succès. HDS reste une déclaration de suivi, distincte d’une certification vérifiée. Évaluation = nombres répond / ne répond pas / non évalué, avec un libellé complet pour les lecteurs d’écran ; aucun score global ni nouveau seuil. Les chiffres de synthèse restent calculés par `partSaas` sur la réponse API. Chargement ou erreur sans données : « — », pas des zéros présentés comme un résultat disponible.

## Résumé technique pour une IA connaissant le code

- **`apps/web/src/pilotage/Fournisseurs.tsx`** garde la requête `['suppliers']`, les permissions et les mutations. Délègue l’affichage à `FournisseursStudio`. La sélection de lecture stocke l’identifiant et retrouve l’objet dans la réponse courante, pour suivre les mises à jour. Recherche rendue insensible aux accents. Les formulaires `FicheFournisseur`, `EvaluationForm`, `HistoriqueEvaluations`, `RattachementPerimetres` et `SuiteEvaluation` conservent leur logique d’écriture.
- **`apps/web/src/pilotage/FournisseursStudio.tsx`** contient le registre, les icônes, les puces et `LectureFournisseur`. Densité et ouverture des popovers sont des états de présentation. Les lignes réutilisent `ficheCliquable` ; les commandes imbriquées et la sélection de texte restent indépendantes. Le menu mémorise la ligne via `retenirFocusFiche`. Les onglets de lecture évitent de réutiliser un formulaire pour présenter les valeurs à l’auditeur.
- **`apps/web/src/pilotage/fournisseurs-types.ts`** reçoit les quatre interfaces existantes sans changer leur contrat. Réexport de `Fournisseur` et `EvaluationCourante` depuis le fichier d’origine pour préserver ses importeurs. Les composants et la fixture de recette partagent les types sans importer le code React de la page.
- **`packages/ui/src/neon-fournisseurs.css`**, chargé par `neon.css`, porte la palette et les dimensions relatives. Styles locaux à Fournisseurs ; aucune couleur ou dimension en ligne introduite. La zone défilante est un bloc contenant positionné : les textes masqués pour l’accessibilité restent confinés au tableau et ne provoquent plus de débordement de page. Les champs colorés visent l’input réel de Mantine, qui reçoit `data-tone`, ainsi que son éventuel wrapper.
- **`tests/e2e/interface/`** et `playwright.interface.config.ts` ajoutent une recette du frontend compilé avec API entièrement interceptée. Le petit serveur statique ne fournit aucune API et refuse les écritures non interceptées. Le jeu `fixtures/fournisseurs-studio.json` est exclusivement fictif. Les sélecteurs de trois parcours Docker existants ont été adaptés au menu et aux colonnes regroupées, sans retirer leurs assertions métier.

### Contrats et données conservés

GET/POST `/api/suppliers`, PATCH `/api/suppliers/:id`, critères `/api/suppliers/criteria`, GET/POST des évaluations, PUT/DELETE `/api/grc/:smsi/suppliers/:id` et suites d’évaluation restent ceux du code existant. Aucune nouvelle route, migration, permission, dépendance ou copie locale de la donnée métier. Pas de recalcul client des états de certificats/contrôles : ils viennent du serveur. Les évaluations restent celles de l’organisation, les rattachements ne les dupliquent pas.

## Vérifications réellement exécutées

Node **26.13.0**, Chromium local. Frontend compilé avec Vite ; génération des variables Mantine existante. Typecheck web, UI et E2E, ESLint ciblé, format et diff contrôlés. **279 tests web et 246 tests UI réussis**.

La recette navigateur couvre sept parcours : lecture clavier/onglets/focus sans écriture ; édition directe puis formulaire sans perte des certificats/contrôles ; création/évaluation/historique/rattachement ; profil lecteur ; recherche/filtres/densité et soixante lignes ; indisponibilité sans faux zéros ; dimensions et accessibilité. Les assertions de conservation comparent le corps envoyé au jeu initial, pas seulement à la réponse simulée après mutation.

Huit dispositions : 1024×768, 1366×768, 1920×1080, 2560×1440 × clair/sombre. Aucun débordement de page dans les cas contrôlés ; titres de lignes à 14 px minimum avec l’échelle automatique de l’application. Consultation dans l’écran et sans défilement de son conteneur principal aux huit tailles. Quatre analyses Axe (registre/lecture, deux thèmes), sans violation détectée ; pas une certification complète d’accessibilité.

La capture unique montre **le frontend fraîchement compilé, avec des réponses API fictives interceptées**, pas la maquette HTML ni une recette d’une base PostgreSQL. Les mutations des parcours restent en mémoire dans le simulateur de réponses. Le mode « Hors ligne » du bandeau correspond au flux temps réel simulé, pas à un diagnostic du Docker de l’utilisateur.

### Commandes exécutées dans cet environnement

Depuis la racine du dépôt, avec les dépendances déjà installées :

```bash
/workspace/work/runtime/bin/node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
/workspace/work/runtime/bin/node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.json --noEmit
/workspace/work/runtime/bin/node node_modules/typescript/bin/tsc -p tests/e2e/tsconfig.json --noEmit
/workspace/work/runtime/bin/node apps/web/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts apps/web
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium NEON_SUPPLIERS_SCREENSHOT=/workspace/exports/neon-fournisseurs-studio-integre-hd.png /workspace/work/runtime/bin/node tests/e2e/node_modules/@playwright/test/cli.js test --config tests/e2e/playwright.interface.config.ts
```

Les suites Vitest ont été exécutées depuis `apps/web` et `packages/ui` avec `node node_modules/vitest/vitest.mjs run --maxWorkers=2`, sous le même Node 26. Variables Mantine générées avec `apps/web/scripts/mantine-css-vars.ts` depuis `apps/web`. Les noms de chemins Node/Chromium ci-dessus sont propres à cette session ; la recette n’ajoute pas de dépendance à ces emplacements dans l’application. Le serveur statique se lance et s’arrête avec la configuration Playwright. `E2E_UI_URL` permet de viser un frontend de test déjà servi, en gardant l’interception des API.

### Limites et incidents résolus pendant la recette

Pas de recette API/DB réelle, de serveur utilisateur, de nouvelle image Docker ni de ZIP dans ce lot. Les trois parcours Docker dont les sélecteurs ont été actualisés n’ont pas été rejoués sur une pile Docker ; leur typage a été vérifié. Les onglets Critères, Fournisseurs du périmètre et Clausier ne sont pas refondus par ce lot. Leurs fonctions demeurent disponibles. Les formulaires métier existants restent complets ; leur comportement pour de très grandes collections n’a pas été remanié.

La recette a corrigé le débordement de textes masqués hors du tableau, les intitulés sous 14 px avec l’échelle automatique sur petit PC et le raccordement des couleurs à l’input Mantine. Les premières tentatives de tests ont aussi été corrigées pour les rôles `combobox`, l’astérisque du champ requis et l’attente de fermeture d’un dialogue en transition ; Axe utilise désormais un contexte de navigateur explicite. Aucune assertion de lisibilité ou de géométrie abaissée, aucune référence visuelle approuvée automatiquement.

Le lanceur pnpm fourni par l’environnement a tenté une installation avec Node 24 et a échoué avant les contrôles ; aucun paquet ajouté. Les contrôles ont ensuite utilisé directement les outils déjà installés sous Node 26. Vite signale les gros chunks et le script de mise à jour externe comme précédemment ; cela n’a pas empêché la compilation. Ces avertissements ne sont pas une validation du mécanisme de mise à jour.

Suite : examiner la capture intégrée, puis essayer le lot dans le Docker de test de l’utilisateur lors d’une prochaine livraison demandée. La cartographie reste inchangée. Aucun push, fusion ou déploiement.
