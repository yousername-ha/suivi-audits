# L1 — Audit de l'existant et correspondance ancien / nouveau

Date : 2026-10-11 (Europe/Paris). Branche de travail : `claude-suivi-smsi`, créée depuis
`feature/gpt6-evolution-smsi-grc` au commit `5a3bd0c`. Livrable L1 du cahier de consignes « Unification et évolution
de l'application SMSI/GRC ». Ce document constate l'état **réel du code** ; il ne déclare aucune conformité.

## 1. Documents lus (ordre imposé)

`AGENTS.md` → `HANDOVER.md` → `PROJECT_STATUS.md` → `docs/00_INDEX.md`, puis le DAT, l'inventaire fonctionnel
(FCT-001 à FCT-040), la comparaison ancien / nouveau, les fonctions non reprises, les régressions, la matrice de
traçabilité, le registre des bugs, la dette, les risques, le rapport de recette, le backlog de reprise et ses priorités,
`PILOTAGE.md`, `LOT-C-TACHES-RISQUES-CARTOGRAPHIE.md`, `LOT-G-H-K-DEBUT-E.md`, `BACKLOG-EVOLUTION-SMSI-GRC.md`,
`BASE_DE_DONNEES.md`, `SECURITE.md`, `ARCHITECTURE_APPLICATIVE.md` et le diagnostic `2026-10-09-sauge-smsi-grc.md`.

## 2. Deux lignées de développement

| Lignée | Origine | Contenu |
|---|---|---|
| `refonte/*`, `docs/*`, `feat/*` (PR #2 à #11, #13) | `main` (`b148c1b`), commits successifs | v3 : socle, droits, charte, écrans, exploitation, cartographie, puis cadrage Audit, édition libre de la carte, socle Audit |
| `feature/gpt6-evolution-smsi-grc` (PR #12, brouillon) | `main`, puis **import en un seul commit** (`7dc4c37`) d'une archive ZIP | archive = `refonte/cartographie` (`bc05bfe`) + direction graphique Sauge (9 fichiers) ; puis 44 commits : exploitation (sauvegardes, restauration, TLS, mises à jour, passerelle), modules, configuration, GRC, Pilotage G/H/K, début E |

Les deux lignées n'ont pas d'historique commun après `main` : un `git merge` est impossible sans conflits massifs.
Travaux de la lignée `refonte/*` **absents** de la référence (vérifié fichier par fichier) :

| Branche | Travaux propres | Sort proposé |
|---|---|---|
| `docs/phase-1-audit` (`a4138c9`) | spécification Audit AUD-01 à 16, recette, ADR Audit et ADR carte libre validées par le RSSI | **intégrés** dans `claude-suivi-smsi` (ADR renumérotées 0025 et 0026) |
| `feat/carto-edition` (`2d7a79d`) | CARTO-15 à 19 : créer depuis la carte, menu contextuel, palette, notes et cadres (14 commits) | à intégrer (lot U0) |
| `refonte/audit-socle` (`b0edd3f`) | socle Audit partagé : modèle, pronostic en parité, règles des écarts (3 commits) | à intégrer (lot U0) |
| `feat/cartographie-beta` (`c11dce9`) | module Cartographie bêta **dans l'outil historique** et ses scripts | remplacé par le module v3 (ADR 0013) ; à archiver par étiquette, pas à intégrer |
| autres (`refonte/phase-0*`, `refonte/exploitation`, `refonte/cartographie`, `docs/cartographie`, `deploiement-v2`) | aucun : contenu inclus dans l'archive importée | suppression possible après validation |

## 3. Vérifications exécutées sur `5a3bd0c` (environnement local isolé)

| Contrôle | Résultat |
|---|---|
| `pnpm lint`, `format:check`, `typecheck`, `build` | réussis (code retour 0) |
| Vitest shared / ui / web | 222 / 102 / 17 réussis |
| Vitest API sur PostgreSQL 17 jetable (port 55433) | 246 réussis (27 fichiers) |
| Playwright | non rejoué à ce stade (pile Docker de la lignée `refonte/*` en cours d'utilisation) |

Total : 587 tests Vitest réussis, conforme au chiffre de `HANDOVER.md`. Aucune minute GitHub Actions consommée.

## 4. Architecture et sécurité constatées

- Services : `init` → `db` → `app` → `web`, derrière `gateway` (seul service exposé), `updater` (socket Docker, hors
  API), `clamav` facultatif. 15 migrations, 42 tables, conforme à `BASE_DE_DONNEES.md`.
- 189 routes, toutes déclarées par `route()`. 75 permissions (15 modules × 5 actions).
- **63 routes** (`grc.ts`, `pilotage.ts`, `legacy.ts`) déclarent l'accès générique `metier` ; la permission
  `module:action` est vérifiée dans les services (`apps/api/src/grc/core.ts`, `pilotage/service.ts`). Fonctionnellement
  gardé (tests `grc-security`), mais contraire à la règle « permission déclarée dans `route()` » de `CLAUDE.md`.
- Validation des sorties : `d.response` ne sert qu'à OpenAPI ; aucune réponse n'est validée par zod (`route.ts`).
- Liens `grc_links` : cible textuelle sans clé étrangère ; lecture filtrée par les droits de l'appelant (extrémité
  inaccessible omise) ; écriture = `modifier` sur la source et `lire` sur la cible. Points à corriger : un périmètre
  restreint peut référencer des fiches communes `legacy:` ; objets archivés toujours visibles par leurs liens ;
  `GET /owners` liste tous les comptes actifs à tout lecteur d'un périmètre commun.
- Dépendance `fflate` (classeur Excel) présente sans mention dans l'ADR 0009.

## 5. Correspondance ancienne interface → nouvelle interface

Menu historique : `navDef()` de `app/public/index.html`. Nouvelle interface : `apps/web/src/main.tsx`,
`components/Layout.tsx`, `pilotage-navigation.ts`, `pages/Pilotage.tsx`.

| Rubrique historique (clés) | Nouvelle interface | État réel | Doublon / incohérence |
|---|---|---|---|
| Tableau de bord, synthèse (toutes) | `/` (Synthese) et `/pilotage/synthese` (Overview) | lecture | **deux tableaux de bord, deux sources** (accueil = état historique, Pilotage = objets GRC) ; pas d'anneau ni d'histogramme empilé (anciens : 2 anneaux, 3 barres empilées, 8 jauges) |
| Carte du SMSI (tuiles) | — | absent | ne pas confondre avec `/cartographie` |
| Pronostic, déroulé, planning, participants, couverture (`items`, `plan`, `years`, `groups`) | — | `/legacy` seulement | spécifié par AUD-01 à 16 |
| Contexte : périmètre, parties intéressées, SWOT, rôles (`scope`, `interested`, `swots`, `roles`) | `/pilotage/contexte`, `parties`, `swot`, `responsabilites` | éditable (adaptateur) | **éditable aussi dans `/legacy`** (deux éditeurs, contrôle d'empreinte) |
| Objectifs par processus, par objectif, vue compacte (`processes`, `objectives`, `indicators`) | `/pilotage/processus`, `objectifs`, `indicateurs` | éditable (adaptateur) | vues « par processus » et « compacte » non reprises |
| Conformité : clauses ISO, Annexe A, HDS (`items`, `dda`) | `/pilotage/applicabilite`, `mesures` | **objets GRC seuls** | la DdA historique n'apparaît pas dans « Applicabilité » |
| ReCyF et référentiels (`frameworks`, `activeFw`) | `/pilotage/referentiels` | socle historique en lecture + référentiels publiés | — |
| Écarts : registre (`findings`) | `/pilotage/amelioration` | éditable (adaptateur + constats GRC) | l'accueil ne compte que les écarts historiques |
| Plan d'actions (`findings.tasks`), récurrentes (`recurring`) | `/pilotage/actions`, `recurrences` | historique : réalisation seulement | — |
| Preuves (`evidences`) | `/pilotage/preuves` | éditable | couverture et « preuves repérées » non reprises |
| Fournisseurs, revues des accès, évaluations sécurité (`suppliers`, `accessReviews`, `supEvals`) | — | `/legacy` seulement | — |
| Plans : calendrier, Gantt, formation, sensibilisation, audit interne, exercices PRA (`plans`) | `/pilotage/audits`, `exercices` (objets GRC) | non repris | **même notion dans deux sources** (`plans` contre objets GRC) |
| GAP applications (`appGaps`), IA (`ai`) | `/ia/evaluations` (réévaluations) | partiel | **`/ia/evaluations` absent du menu** de la nouvelle interface |
| CRRC, investissements, incidents, crise | — | `/legacy` seulement | lots D/J/I/F exclus du périmètre courant |
| COPIL, CODIR (`reviews`) | `/pilotage/revues` | éditable (adaptateur) | exports PowerPoint et Word historiques non repris |
| Cartographie (`maps`) | `/cartographie` | **seul module repris** (mapper, `/legacy` en lecture) | « Cartographie des risques » (`/pilotage/carte`) est un autre écran |

Passage d'une interface à l'autre : liens simples vers `/legacy/` (menu « Modules pas encore repris », accueil,
référentiels, IA, fiche carte) ; en sens inverse, le menu injecté par `legacy-shim/shim.js`. Pas de lien vers une page
précise de l'outil historique.

## 6. Gestion des risques : état réel

- Un risque est un `grc_objects` de type `risk` (données JSON) ; appréciations immuables dans `grc_risk_evaluations`
  (brut, résiduel, version de méthode) ; méthodes versionnées dans `grc_method_versions`.
- Les familles `ebios_rm`, `iso27005`, `mehari`, `custom` partagent **une seule structure** ; seule règle propre :
  EBIOS impose 5 étapes. **Les cinq ateliers EBIOS sont des sections du formulaire d'un risque**, pas des objets
  d'étude : pas de couples sources de risque / objectifs visés, pas d'écosystème ni de niveau de menace des parties
  prenantes, pas de gravité des scénarios stratégiques ni de vraisemblance des scénarios opérationnels cotées, pas de
  chaînage typé. Les types `risk_source`, `feared_event`, `strategic_scenario`… existent mais n'ont que des champs
  texte, sans schéma serveur.
- ISO/IEC 27005 : pas d'actif / menace / vulnérabilité / conséquence structurés, une seule dimension d'impact, pas de
  décision d'acceptation formelle (responsable, date, conditions, échéance), surveillance limitée à une date de revue
  (`reevaluation.triggers` jamais exploité), pas de plan de traitement agrégé ni de lien vers la DdA.
- Trois moteurs de notation coexistent : méthodes de risque, configuration d'environnement (B2a), calcul `aiEval`
  historique. Les risques historiques (`ai.evals`, risques des comités `reviews[].cs.risks`) ne sont pas reliés au
  registre GRC.
- Écrans : registre générique (nom, version, description ; ni niveau, ni responsable, ni statut) ; appréciation avec
  simulation et historique (résultat affiché en JSON brut) ; carte des risques réellement alimentée par le registre
  (graphe, matrices, filtres, comparaison, exports). Aucun écran fictif, mais un modèle générique.
- Tests : environ 15 cas spécifiques aux risques (API, shared) et 1 parcours Playwright.

## 7. Écarts entre documentation et code

1. FCT-022 « EBIOS cinq ateliers, VALIDÉ AUTOMATIQUEMENT » : les ateliers sont des étapes de formulaire (§ 6).
2. FCT-018, 019, 024, 025 « REPRISE ET VALIDÉE » : ces familles ne sont pas déclarées reprises (`takenOver()` ne
   contient que `maps`) et restent modifiables dans `/legacy` ; le texte de l'accueil les dit « en lecture seule ».
3. FCT-028 / FCT-030 : « Applicabilité » n'affiche pas la DdA historique (`dda`, `items`).
4. FCT-038 : « Audits internes » et « Exercices » sont des objets GRC sans lien avec `plans`.
5. LOT-C C8 « reprendre les données et identifiants existants » : non fait pour `ai.evals` ni les risques de comité.
6. `CLAUDE.md` (racine) périmé : web présenté comme seul service exposé (c'est `gateway`), `updater` et `clamav`
   absents, « seul `maps` repris » contredit par les adaptateurs Pilotage, règle de permission dans `route()` non tenue.
7. `docs/ARCHITECTURE.md` : instantané de la phase 0 (deux images, pas de passerelle).
8. `docs/adr/README.md` : lignes vides qui coupent le tableau (ADR 0020 à 0024 hors tableau).
9. ADR 0009 : Trivy « critiques » contre « HIGH/CRITICAL » ailleurs ; `fflate` non mentionnée.
10. `HANDOVER.md` / `PROJECT_STATUS.md` décrivent `c704fa6` alors que la branche est à `5a3bd0c`, et signalent un échec
    de CI documentaire non diagnostiqué.

## 8. Coût GitHub Actions

`ci.yml` et `codeql.yml` se déclenchent sur `push` vers `main` et sur **chaque événement de pull request** (plus une
analyse CodeQL hebdomadaire sur `main`). Pousser une branche **sans PR ouverte ne consomme rien**. Les PR ouvertes
(#1 à #13) relancent la CI à chaque poussée sur leur tête. Le travail sur `claude-suivi-smsi` est donc vérifié
localement ; une PR n'est ouverte qu'à la validation, avec l'accord du RSSI.
