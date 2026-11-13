# Bibliothèque et couverture réunies — intégration validée

12/11/2026 · Branche `codex/refonte-neon-main`. Validation : « très bien » après la proposition Bibliothèque/Couverture. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

La bibliothèque présente désormais le catalogue commun à l’organisation et la couverture du périmètre choisi dans chaque dalle. Une seule entrée visible remplace les huit rubriques précédentes. [Capture du frontend compilé](preuves/bibliotheque-unifiee/bibliotheque-integree-hd.png), avec API fictive interceptée ; ce visuel conserve le menu antérieur, son harmonisation étant une proposition séparée.

## Résumé technique pour une IA connaissant le code

- `navigation.ts` conserve l’ID de destination `referentiels` pour les préférences de menu, le renomme « Bibliothèque de référentiels » et n’expose plus que sa rubrique bibliothèque. Les sept anciennes rubriques sont des alias de famille ; leurs définitions métier demeurent dans `PILOTAGE_NAV`.
- `modules-interface.ts` inventorie explicitement ces sept rubriques masquées. `lienBibliotheque` préserve les paramètres de périmètre/retour et retire `ouvrir`, qui désignait un ancien objet et ne doit pas ouvrir une mauvaise fiche du catalogue.
- `Pilotage.tsx` redirige **uniquement** l’ancienne adresse `/pilotage/couverture` vers la bibliothèque. Les six autres adresses retirées du menu restent accessibles directement pour les parcours existants de publication, de correspondances et d’analyse/GAP. C’est un affinement de la proposition qui envisageait davantage de redirections : retirer provisoirement des onglets ne doit pas casser leurs accès guidés ni supprimer leurs services.
- `Bibliotheque.tsx` conserve les formulaires/API d’import, copie, édition et exigences. Il charge aussi le résumé de couverture du périmètre et ouvre le composant métier `Couverture` dans une fenêtre bornée, identifiée par périmètre et référentiel. Changer de périmètre ne laisse pas apparaître un ancien détail. Kit IA et standards restent dans les outils repliés.
- Nouveau `BibliothequeStudio.tsx` : présentation React/Mantine, jointure par ID, catalogue global indépendant du périmètre, versions de fiche/active distinctes, six états d’exigence, liens aux mesures séparés et avertissements conservés. Chargement, erreur et absence de rattachement ne deviennent pas des zéros fictifs. Recherche discrète, critères persistants, remise à zéro, dalle cliquable/clavier et actions imbriquées indépendantes.
- `bibliotheque-types.ts` extrait les deux types frontend existants ; aucun schéma partagé ou contrat serveur modifié.
- `Couverture.tsx` accepte `frameworkId` et `integree`. Le registre détaillé, filtre d’état, historique, évaluation versionnée, `If-Match`, validation métier et `PlanEcarts` sont conservés. Un lecteur sans droit de modification consulte l’historique sans formulaire d’écriture. Les contrôles serveur restent indispensables et ne sont pas remplacés par ces gardes UI.
- `packages/ui/src/neon-bibliotheque.css`, importée par `neon.css` : styles locaux `bb-*`, clair/sombre, SVG sans styles en ligne, liste à défilement local et fenêtre de détail bornée. Aucun style du menu latéral global n’est porté dans ce lot.
- `CorrespondancesBibliotheque.tsx` demeure intact : `CriteresFournisseurs` réutilise encore `ExtremiteChamps`. Aucun composant partagé supprimé.

API existantes : `GET /api/library/frameworks`, `GET /api/grc/:smsi/couverture` et sa variante `?frameworkId=...`, évaluations/historique/publication existants. Aucun backend, migration, dépendance, donnée réelle, Docker ou archive Assistant modifié. Aucun taux de certification créé. PR #260 relue avant l’actualisation des fichiers partagés : désormais fermée ; aucune PR ouverte lors du contrôle final. Entrées historiques conservées.

## Vérifications exécutées

Node 26 local, frontend compilé Vite et navigateur Chromium, données fictives uniquement. Résultats de cette intégration, distincts des recettes historiques :

- 289 tests web dans 36 fichiers et 246 tests UI dans 5 fichiers réussis ; TypeScript web/E2E, ESLint ciblé et format ciblé réussis.
- Build frontend réussi. Avertissements existants sur le script non-module `/update/client.js` et les gros bundles ; seuils inchangés.
- 25 E2E du frontend compilé réussis : 8 Bibliothèque, 7 Fournisseurs et 10 Assistant. API interceptée, aucun moteur Mistral ou serveur de base métier utilisé.
- Bibliothèque : redirection avec contexte, catalogue sans rattachement, recherche/clavier/focus, commandes indépendantes, détail, évaluation/échec/saisie conservée/If-Match, lecture seule, erreurs, copie et import. Les premières erreurs de recette étaient des sélecteurs de champs obligatoires/libellés ou un DTO de prévisualisation fictif incorrect ; corrigés selon les formulaires existants, sans réduire les assertions métier.
- 4 analyses Axe Bibliothèque catalogue/détail dans les deux thèmes sans violation détectée ; les suites Fournisseurs/Assistant rejouent 8 analyses supplémentaires. Cela ne vaut pas certification complète d’accessibilité.
- Contrôle supplémentaire du rendu intégré : 16 dispositions PC, de 1024×768 à 2560×1440, deux thèmes, sans débordement horizontal et avec liste bornée. Une capture native 3840×2160 à densité 2.

Commandes de référence : `vitest run` dans `apps/web` et `packages/ui`, `tsc -p apps/web/tsconfig.json --noEmit`, `tsc -p tests/e2e/tsconfig.json --noEmit`, puis `playwright test --config tests/e2e/playwright.interface.config.ts bibliotheque-unifiee.spec.ts fournisseurs-studio.spec.ts assistant-global.spec.ts` avec `E2E_UI_URL=http://127.0.0.1:5220` et Chromium système. Les fichiers `bibliotheque-fixture.ts` et `bibliotheque-unifiee.json` servent uniquement à cette recette fictive.

Les deux E2E avec base existants (`zzz-pilotage.spec.ts`, `zzzzzzzzzzzzzzzz-couverture-exigences.spec.ts`) sont adaptés à la nouvelle entrée et aux fenêtres imbriquées, **non exécutés** ici. Pas de recette DB/API réelle, droits serveur, Docker Desktop/Windows, CI distante, push, fusion ou déploiement.

## Suite et preuves

[Contrôles et empreintes](preuves/bibliotheque-unifiee/controles.json). L’harmonisation du **menu latéral principal uniquement**, précisée par le demandeur, reste une [maquette à valider](propositions/menus-harmonises/README.md). Les onglets internes sont hors de cette nouvelle modification. Cartographie et génération automatique intactes ; dossier Assistant IA livré inchangé. Après validation du menu : supprimer les seules surcharges conditionnelles de sidebar et porter son habillage commun dans le cadre existant, puis contrôler les pages et droits.
