# Feuille de route

L'outil historique (fichier unique) est remplacé **module par module** par une application web avec base PostgreSQL normalisée, un enregistrement par élément et une mise à jour en temps réel entre utilisateurs. Pendant toute la transition, l'ancien outil reste servi sous `/legacy`. Un module repris y devient consultable seulement : « Module géré dans la nouvelle interface » ([ADR 0007](adr/0007-transition-legacy.md)).

Chaque phase est livrée par une ou plusieurs pull requests, avec une version publiée (`vX.Y.Z`), et met à jour `docs/INSTALLATION.md` si l'installation ou l'exploitation change.

Les exigences fonctionnelles détaillées sont dans [BACKLOG-FONCTIONNEL.md](BACKLOG-FONCTIONNEL.md). Leur identifiant (`CRRC-01`, `INV-02`, `INC-03`…) est cité dans chaque commit et chaque PR qui les traite.

**Critères communs à chaque module livré** (backlog, « Critères d'acceptation communs ») : charte graphique et adaptation à tous les écrans (phase 0, 9 ter et 9 quater) ; droits RBAC déclarés pour le module (phase 0, 9 bis) ; reprise des données par l'import legacy, documentée dans `MAPPING-LEGACY.md` ; parcours Playwright et captures de référence à 390, 1920 et 3840 px.

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
- [x] **9 bis — Gestion des droits (RBAC)** ([ADR 0010](adr/0010-droits-rbac.md)) : permissions module × action déclarées dans `packages/shared` ; rôles prédéfinis (Administrateur, RSSI, Contributeur, Lecteur, Auditeur externe) et personnalisés ; groupes ; garde `requirePermission` sur chaque route et filtrage du temps réel ; écrans Utilisateurs, Groupes, Rôles, droits effectifs, export de la revue des accès (ISO 27001 A.5.18) ; garde-fous et migration des comptes v2.
- [ ] **9 ter — Charte graphique et page Paramètres** : `packages/ui` (thème Mantine clair et sombre, WCAG AA, composants communs) ; page Paramètres pleine largeur par sections, chacune avec son enregistrement et sa permission ; captures de référence.
- [ ] **9 quater — Adaptation à tous les écrans** (du téléphone au 4K) : points de rupture et container queries, grilles auto-fill, maître-détail, tableaux configurables, typographie fluide, préférences « Taille d'affichage » et « Densité » enregistrées sur le serveur ; mode **écran mural** (`/mur`) ; tests de largeur utile et d'absence de défilement horizontal.

## Phase 1 — Audit

Modules repris : `groups`, `items`, `findings`, `plan`, `years`, et les données de couverture.
- Référentiels : ISO 27001 (clauses 4 à 10), Annexe A, exigences HDS, en tables versionnées. Les mesures et exigences ont un identifiant stable.
- Couverture par exigence : statut AFNOR (audit de certification) et statut interne, par année, préparation, responsable, remarques.
- Écarts et actions : un enregistrement par écart, avec tâches, échéances, preuves, liens aux exigences, clôture et revue.
- Plan d'audit : journées, créneaux, participants, preuves attendues, questions.
- Tableaux de bord : couverture, écarts ouverts, échéances.

## Phase 2 — Pilotage du SMSI

*Backlog : aucune exigence détaillée pour l'instant (section « Pilotage » à compléter).*

Modules repris : `dda`, `processes`, `objectives`, `indicators`, `suppliers`, `accessReviews`, `roles`, `reviews`, `recurring`, `evidences`.
- Processus, objectifs et indicateurs (valeurs, cibles, historique).
- Déclaration d'applicabilité (DdA) liée à l'Annexe A.
- Fournisseurs : contrôles, fréquences, certifications, évaluations.
- Revues d'accès planifiées et tracées.

## Phase 3 — Conformité étendue, risques et crise

Modules repris : `frameworks` (ReCyF et autres), `appGaps`, `ai`, `crrc`, `invest`, `incidents`, `crisis`, `swots`, `interested`, `scope`, `plans`, `supEvals`.
- ReCyF et analyse d'écarts (GAP) multi-référentiels.
- IA : registre des systèmes, évaluations, plan, politiques.
- **CRRC** :
  - `CRRC-01` menu organisé en catalogue d'offres (modèle générique, la sauvegarde étant la première offre) ;
  - `CRRC-02` onglet « Convention et offre » (convention versionnée et échéance, résumé technique, volumes, tarifs, export PDF et Word) ;
  - `CRRC-03` statut unique par établissement et par offre (Non délivré, Non configuré, En run), avec historique, en remplacement du suivi par ressource ;
  - `CRRC-04` carte réelle et zoomable des départements normands, embarquée (données IGN simplifiées, sans service externe), avec export PNG et SVG.
- **Investissements** :
  - `INV-01` filtres cumulables en haut de la liste, sous forme de puces, mémorisés dans l'adresse, et vues enregistrées ;
  - `INV-02` page « Prospection » (tableau, Kanban par étape, conversion en investissement).
- **Incidents, PCA/PRA, événements** :
  - `INC-01` deux menus distincts : Incidents (registre, crise, retours d'expérience, déclarations) et PCA/PRA (plans, RTO et RPO, exercices, échéances) ;
  - `INC-02` suivi mensuel des événements et alertes cyber et IT (grille, import CSV, camemberts, évolution sur 12 mois) ;
  - `INC-03` alimentation automatique du compte rendu COMSEC (Word).
- Cellule de crise et main courante.
- Le moteur d'export Word et PDF, nécessaire à `CRRC-02` et `INC-03`, est avancé de la phase 4 à la phase 3.

## Phase 4 — Exports, SSO, fin de l'outil historique

- Exports Word, Excel et PowerPoint générés par le serveur (rapport d'audit, revue de direction, DdA), sur le moteur introduit en phase 3.
- Authentification unique **OIDC** (Entra ID, Keycloak…), TOTP conservé pour les comptes locaux de secours.
- Suppression de `/legacy` et de `app_state` après la reprise de tous les modules, et un dernier export d'archive.
