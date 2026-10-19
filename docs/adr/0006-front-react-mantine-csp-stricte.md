# ADR 0006 — Front React, Vite, TanStack Query, Mantine sous CSP stricte

**Statut** : acceptée (phase 0)

## Contexte
L'interface doit être moderne, accessible, utilisable au téléphone, en français, et respecter une CSP stricte : `script-src 'self'; style-src 'self'`, sans aucun script ni style en ligne.

## Décision
- React 19, Vite, React Router, TanStack Query (cache invalidé par le temps réel) et Mantine 9 (composants accessibles ; les listes déroulantes y portent le rôle `combobox`).
- Mantine injecte normalement des balises `<style>`, que la CSP interdit. On le configure donc ainsi :
  - `withCssVariables={false}` et `withGlobalClasses={false}`. Les variables du thème et les classes `hiddenFrom`/`visibleFrom` sont générées dans un **fichier CSS statique** (`apps/web/scripts/mantine-css-vars.ts`) ;
  - pas d'`AppShell` : il injecte des styles de points de rupture. La mise en page est faite en CSS (`app.css`) ;
  - `lockScroll={false}` sur `Modal` et `Drawer`, car `react-remove-scroll` injecte un `<style>` ;
  - pas de propriétés de style « responsives » (`SimpleGrid`, `Grid`, `Flex` avec points de rupture).
- Les tests Playwright échouent sur **toute violation de CSP** dans la console.

## Conséquences
- Les styles propres à l'application vont dans `app.css`, jamais dans un attribut `style=` écrit en HTML. Les styles appliqués par React via le DOM (CSSOM) restent autorisés.
- Toute nouvelle dépendance d'interface doit passer le même test.
