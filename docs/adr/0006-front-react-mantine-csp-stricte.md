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

## Addendum du 24/11/2026 — Trusted Types en observation (décision du RSSI)

Décision du RSSI du 24/11/2026 (lot « sécurité et accessibilité ») : Trusted Types est d'abord mis en **observation**, puis
appliqué strictement après une campagne de bout en bout propre, sur une nouvelle décision du RSSI.

- **En-tête d'observation.** Les frontaux servent, à côté de la CSP appliquée (inchangée), un en-tête
  `Content-Security-Policy-Report-Only` : `require-trusted-types-for 'script'; trusted-types suivi-xml` pour l'interface
  (`docker/Caddyfile` et `docker/Caddyfile.internal`), `require-trusted-types-for 'script'; trusted-types 'none'` pour la
  page de mise à jour (`docker/Caddyfile.gateway`, page servie et page de secours), qui ne crée aucune politique. Une
  violation est signalée dans la console du navigateur sans être bloquée. **Aucun point de collecte** (`report-uri`,
  `report-to`) : toute destination nouvelle des rapports exige une décision écrite du RSSI.
- **Politique de l'interface.** Une seule politique, `suivi-xml` (`apps/web/src/trusted-types.ts`), créée une fois par page
  par `trustedTypes.createPolicy` quand l'API existe (sinon le même contrôle s'applique et le texte passe tel quel). Elle ne
  sert qu'à `analyserXml`, qui analyse un fichier XML choisi par la personne dans un document inerte (`DOMParser`, type
  `application/xml`) : rapport Nessus (`integrations/nessus.ts`) et parties d'un classeur `.xlsx` (`grc/workbook.ts`). Elle
  refuse une déclaration DOCTYPE ou ENTITY, comme les appelants. Une politique nouvelle se déclare dans
  `POLITIQUES_TRUSTED_TYPES` et dans les Caddyfile ; le test `apps/web/test/trusted-types.test.ts` vérifie l'accord des deux.
- **Points d'injection relevés.** Aucun `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`,
  `new Function`, `dangerouslySetInnerHTML` ni minuterie à chaîne dans `apps/web/src`, `packages/ui/src` et
  `docker/maintenance` (garde du même test). Bibliothèques : Mantine écrit un `innerHTML` pour couper les transitions au
  changement de thème, évité par `keepTransitions: true` (`Layout.tsx`, exigé par le même test pour tout appel) ; React
  n'en écrit que pour `dangerouslySetInnerHTML`, un élément `<script>` rendu ou un script préchargé, absents ; fflate ne
  crée un `Worker` que dans ses fonctions asynchrones, non utilisées (`Unzip`, `UnzipInflate` et `zipSync` sont
  synchrones) et absentes du paquet compilé.
- **Zod sans compilation à la volée dans le navigateur.** Zod testait `new Function("")` à la création de chaque schéma
  d'objet : refusé par la CSP appliquée (sans `'unsafe-eval'`), ce test passait inaperçu dans la console mais produisait,
  à chaque page, une violation de la CSP appliquée et, en observation, une violation Trusted Types (« This document
  requires 'TrustedScript' assignment »). `packages/shared/src/zod-navigateur.ts`, importé en premier par chaque point
  d'entrée du paquet, règle `jitless` quand un `document` existe : même résultat d'analyse (la compilation était déjà
  interdite), l'API garde la compilation à la volée.
- **Détection.** `watchPage` (`tests/e2e/helpers.ts`) relève, en plus des violations de la CSP appliquée, les messages
  Trusted Types de Chromium, écrits au niveau « info » (« This document requires 'TrustedHTML' assignment. The policy is
  report-only… », « Creating a TrustedTypePolicy named '…' violates… ») : une violation en observation fait donc échouer
  le test de bout en bout qui la provoque, ce qui sert de détecteur avant l'application stricte. Les contrôles HTTP de la
  CI vérifient la présence des deux en-têtes et l'absence de point de collecte.
- **Application stricte (plus tard).** Après une campagne de bout en bout sans violation, et sur décision du RSSI : passer les
  deux directives dans la CSP appliquée, retirer l'en-tête d'observation, adapter les contrôles HTTP.
