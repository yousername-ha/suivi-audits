# Feuille de route

L'outil historique (fichier unique) est remplacé **module par module** par une application web avec base PostgreSQL normalisée, un enregistrement par élément et une mise à jour en temps réel entre utilisateurs. Pendant toute la transition, l'ancien outil reste servi sous `/legacy`. Un module repris y devient consultable seulement : « Module géré dans la nouvelle interface » ([ADR 0007](adr/0007-transition-legacy.md)).

Chaque phase est livrée par une ou plusieurs pull requests, avec une version publiée (`vX.Y.Z`), et met à jour `docs/INSTALLATION.md` si l'installation ou l'exploitation change.

## Phase 0 — Fondations (v3.0.0)

- [x] Monorepo TypeScript strict : API Fastify, interface React, paquet partagé zod.
- [x] Sécurité de la v2 portée sans régression : sessions `__Host-`, TOTP obligatoire avec anti-rejeu, jeton d'installation, CSRF et contrôle d'origine, verrouillage, rôles, audit en ajout seul, chiffrement des documents, ClamAV facultatif, commandes d'exploitation.
- [x] Base v2 migrée sans perte (migrations SQL versionnées).
- [x] Concurrence par enregistrement (`If-Match`, 412) et temps réel (SSE, LISTEN/NOTIFY), avec présence.
- [x] Écrans : installation, connexion et double authentification, mon compte, administration (comptes, sessions, journal, versions, système, import), documents et liens.
- [x] Outil historique sous `/legacy` ; schéma 15 (identifiants stables) ; export pour la nouvelle version.
- [x] Import et export legacy : simulation, Initialiser, Fusionner, Remplacer un module, annulation ; contrat `LEGACY-FORMAT.md` couvert à 100 %.
- [x] Qualité et livraison : ESLint, Prettier, Vitest, Playwright, Trivy, SBOM, CodeQL, images signées sur GHCR.
- [x] Guide d'installation pour débutant, rejoué en CI.

## Phase 1 — Audit

Modules repris : `groups`, `items`, `findings`, `plan`, `years`, et les données de couverture.
- Référentiels : ISO 27001 (clauses 4 à 10), Annexe A, exigences HDS, en tables versionnées. Les mesures et exigences ont un identifiant stable.
- Couverture par exigence : statut AFNOR (audit de certification) et statut interne, par année, préparation, responsable, remarques.
- Écarts et actions : un enregistrement par écart, avec tâches, échéances, preuves, liens aux exigences, clôture et revue.
- Plan d'audit : journées, créneaux, participants, preuves attendues, questions.
- Tableaux de bord : couverture, écarts ouverts, échéances.

## Phase 2 — Pilotage du SMSI

Modules repris : `dda`, `processes`, `objectives`, `indicators`, `suppliers`, `accessReviews`, `roles`, `reviews`, `recurring`, `evidences`.
- Processus, objectifs et indicateurs (valeurs, cibles, historique).
- Déclaration d'applicabilité (DdA) liée à l'Annexe A.
- Fournisseurs : contrôles, fréquences, certifications, évaluations.
- Revues d'accès planifiées et tracées.

## Phase 3 — Conformité étendue, risques et crise

Modules repris : `frameworks` (ReCyF et autres), `appGaps`, `ai`, `crrc`, `invest`, `incidents`, `crisis`, `swots`, `interested`, `scope`, `plans`, `supEvals`.
- ReCyF et analyse d'écarts (GAP) multi-référentiels.
- IA : registre des systèmes, évaluations, plan, politiques.
- CRRC, investissements pluriannuels.
- Incidents, cellule de crise et main courante.

## Phase 4 — Exports, SSO, fin de l'outil historique

- Exports Word, Excel et PowerPoint générés par le serveur (rapport d'audit, revue de direction, DdA).
- Authentification unique **OIDC** (Entra ID, Keycloak…), TOTP conservé pour les comptes locaux de secours.
- Suppression de `/legacy` et de `app_state` après la reprise de tous les modules, et un dernier export d'archive.
