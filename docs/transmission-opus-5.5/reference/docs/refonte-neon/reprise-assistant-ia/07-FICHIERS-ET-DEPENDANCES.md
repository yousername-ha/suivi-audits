# Fichiers, dépendances et périmètre

## Fichiers à ajouter/réconcilier

| Fichier du dépôt cible | Origine dans le paquet | Rôle |
| --- | --- | --- |
| `apps/web/src/assistant/AssistantGlobal.tsx` | `sources/` | Hôte et panneau global, cache, API, navigation et formulaires. |
| `apps/web/src/assistant/IdentiteAssistant.tsx` | `sources/` | Avatar et icônes SVG. |
| `apps/web/src/assistant/contrats.ts` | `sources/` | Pont DTO et fonctions de contexte/disponibilité/comptage. À réconcilier avec les types partagés déjà présents. |
| `packages/ui/src/neon-assistant.css` | `sources/` | Habillage statique clair/sombre et dimensions du dock. |
| `apps/web/test/assistant-global.test.ts` | `tests/` | Huit cas unitaires de régression. |

Raccordements à adapter dans `apps/web/src/components/Layout.tsx`, `apps/web/src/main.tsx` et `packages/ui/src/neon.css`. Aucun de ces trois fichiers complets n’est à remplacer.

## Dépendances du dépôt hôte

React, `@mantine/hooks`, `@tanstack/react-query`, `react-router`, client `apps/web/src/api.ts` (`api/get/ApiError/errorMessage`), `useMe`, navigation `localiser`, `ConfirmButton` existant, styles/police/jetons partagés. La référence utilise notamment `--suivi-entete-h`, `--suivi-marge-page` et la police Inter fournis par la charte du dépôt ; les palettes `--as-*` sont définies dans la feuille livrée. Vérifier ces contrats plutôt que copier les autres feuilles de refonte.

Le host doit conserver `SessionProvider`, le client Query et sa purge à la déconnexion, le cadre authentifié et l’administration. Le service doit exposer les endpoints décrits dans le guide API, avec les droits et périmètres correspondants. La visibilité client seule ne donne pas un droit serveur.

Les tests unitaires utilisent Vitest déjà prévu par le dépôt. Les E2E de référence utilisent Playwright/Axe et deux supports d’arrière-plan non livrés : `tests/e2e/interface/fournisseurs-fixture.ts` et `tests/e2e/fixtures/fournisseurs-studio.json`, ainsi que la configuration/serveur de test du dépôt de refonte. Les remplacer par le support hôte pour une recette Assistant isolée ; ne pas porter Fournisseurs pour satisfaire une dépendance de test.

## Exclusions intentionnelles

Aucun backend, migration, schéma partagé complet, réglage de modèle, secret, base de données, donnée réelle, `node_modules`, build compilé ou fichier `.env`. Aucun code de module Dashboard/Fournisseurs/Périmètres/DDA/SWOT/PESTEL/Cartographie, Budget ou CRRC. Les noms de pages et données fictives d’arrière-plan des captures/fixtures n’en font pas des composants à implémenter.

Ce paquet est un **dossier de portage**, pas une application indépendante ou un ZIP Docker. Ses imports visent le dépôt hôte. La branche cible peut avoir évolué depuis la référence de lecture : adapter le raccordement en conservant ses fonctionnalités.
