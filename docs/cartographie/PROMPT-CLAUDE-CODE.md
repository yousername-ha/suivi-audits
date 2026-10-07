# Prompt à donner à Claude Code

Copier le texte ci-dessous dans Claude Code, ouvert sur le dépôt `yousername-ha/suivi-audits`. Le dossier est déjà
dans le dépôt : `docs/cartographie/` sur la branche `docs/cartographie` (PR vers `refonte/phase-0-ecrans`).

---

Tu travailles sur le dépôt `suivi-audits` (refonte v3 : monorepo pnpm, Fastify, React/Mantine, PostgreSQL).
Lis d'abord `CLAUDE.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, les ADR 0004, 0005, 0006, 0007, 0010, 0011, 0012,
puis le dossier `docs/cartographie/` (branche `docs/cartographie`) :
`SPEC-CARTOGRAPHIE-V3.md` (exigences CARTO-01 à CARTO-14, elle l'emporte sur la maquette), `RECETTE.md`,
`reference-beta-legacy/` (module bêta validé par le RSSI dans l'outil historique : comportement, règles de
disposition et contrat `S.maps` à reproduire) et `maquette/` (intention fonctionnelle et visuels 01 à 03).

**Objectif** : implémenter la Cartographie du SMSI (Vue contexte, Vue processus) dans la nouvelle application.

**Étape 0 — préparer les branches**
1. Pars de la branche `docs/cartographie` (basée sur `refonte/phase-0-ecrans`, sommet de la pile des PR #2 à #5 ;
   ou de `main` si tout est déjà fusionné) et crée `refonte/cartographie`.
2. Le dossier est dans `docs/cartographie/` (déjà exclu d'ESLint et de Prettier) ; ajoute CARTO-01 à CARTO-14 dans
   `docs/BACKLOG-FONCTIONNEL.md` et un chantier « Cartographie » dans `docs/ROADMAP.md`.
3. La branche `feat/cartographie-beta` (module bêta dans `app/public/index.html` + `scripts/carto/`) est basée sur
   `main` : rebase-la sur `refonte/phase-0-ecrans` en **deux commits** (1. `app/public/index.html` seul, comme l'exige
   CLAUDE.md ; 2. `scripts/carto/` et docs), (`scripts/carto/` est déjà exclu d'ESLint et de Prettier
   depuis la branche `docs/cartographie`). Le conflit attendu sur
   `CLAUDE.md` se résout en gardant la version de la refonte et en y ajoutant la ligne `scripts/carto/`.
   Ouvre une PR « Cartographie bêta dans l'outil historique » vers `refonte/phase-0-ecrans`.

**Étape 1 — ADR 0013 « Cartographie »** : moteur SVG maison sans nouvelle dépendance, stockage `maps` /
`map_versions`, source d'objets par adaptateur (legacy puis tables), relations graphiques vs métier, choix par défaut
des points à arbitrer (§ 6 de la spec). Soumets l'ADR dans la PR avant le gros du code.

**Étape 2 — implémentation**, dans cet ordre, chaque étape testée :
1. `packages/shared/src/carto/` : types, `MapLayoutSchema` (zod), relations dérivées, dispositions, génération,
   synchronisation, géométrie des liens — fonctions pures portées de `reference-beta-legacy/carto.js`
   (`mbObjects`, `mbRelations`, `mbLayoutContext`, `mbLayoutProcess`, `mbProcessGenEdges`, `mbAnch`, `mbPath`,
   `mbSyncInfo`, `mbPlace`), tests Vitest de parité avec la bêta.
2. Permissions `cartographie` (CARTO-01) et mise à jour des rôles, tests de la matrice.
3. Migration SQL + Drizzle, routes API, temps réel, journal d'audit, mapper legacy `maps` (CARTO-03, 04, 14).
4. Front `apps/web` : page Cartographie (deux vues), canevas SVG, barre d'outils, assistant, ajout, inspecteur,
   versions, exports, préférences de viewport (CARTO-05 à 13) ; jetons « carte » dans `packages/ui`.
5. Playwright : parcours de `RECETTE.md`, captures 390 / 1920 / 3840.
6. `docs/INSTALLATION.md` si l'exploitation change, `CHANGELOG.md`, `MAPPING-LEGACY.md`, `LEGACY-FORMAT.md`.

**Règles** : français partout ; aucune donnée réelle (fixtures fictives uniquement) ; aucun secret ; CSP stricte
(pas de `style=`, y compris dans le SVG) ; aucune couleur codée en dur dans `apps/web` ; pas de nouvelle dépendance
npm sans ADR et accord ; ne jamais modifier une migration publiée ; travailler sur la branche et ouvrir une PR vers
`refonte/phase-0-ecrans` (ou `main` si la pile est fusionnée) — ne jamais pousser sur `main`. Cite les identifiants CARTO-xx dans les commits.
Termine par un résumé de PR listant la couverture de chaque exigence et les points à arbitrer restants.
