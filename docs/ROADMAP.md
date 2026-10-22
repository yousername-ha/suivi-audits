# Feuille de route

## État courant et suite (20/10/2026)

**Fait dans la 3.6.1 (étiquette à poser ; elle porte la 3.5.0 et la 3.6.0, jamais publiées)** : l'intégration ASTRA complète ([recette R01 à R18](unification/RECETTE-INTEGRATION-ASTRA.md)) — déplacement entre registres, responsables personne, groupe ou fonction, plans d'actions conteneurs, écart depuis un audit et récidive, récurrences (fenêtres, jours exclus, iCalendar, enchaînement), graphe des périmètres, registres restreints respectés, contexte de retour —, ainsi que : registres, périmètres hérités et droits par ressource ([ADR 0043](adr/0043-registres-perimetres-herites-et-droits-par-ressource.md)), menu à sept familles, contribution, Timeline, validation des occurrences, écarts classés et rouvrables et ainsi que : hiérarchie des périmètres et héritage des référentiels (H1), tous les modules en
tables (H2, migrations 022 à 030), couverture par exigence avec états et versions (H3), exports de revue de direction en
Word, PowerPoint et Excel (H4), exports Excel par rubrique, retrait de l'écran `/legacy` ([ADR 0042](adr/0042-retrait-de-lecran-legacy.md)),
consolidation documentaire (H5, ci-dessous).

**Reste à faire, par ordre de priorité**

1. Recette de l'ensemble sur le serveur du RSSI, puis étiquette de version `v4.2.0` (par le RSSI) portant les migrations 034 et 035 (la 3.6.1, publiée, portait les migrations 022 à 033 ; la 4.1.0 ajoute la 034).
2. Exports de comité à la charte du modèle interne (COPIL). Les exports Excel du pronostic, du clausier fournisseurs et du
   GAP applications sont repris ; ReCyF est couvert par la page Couverture.
3. Normalisation des sous-structures encore en JSON dans des tables liées ([ADR 0040](adr/0040-sortie-du-json-plat-modules-en-tables.md)) :
   tâches des écarts et valeurs d'indicateurs faites (migration 028) ; restent le plan d'audit (jours, personnes, créneaux) puis
   les autres colonnes JSON du cœur (preuves de créneaux, contrôles des fournisseurs, sections des revues…).
4. Décision à prendre : retirer l'import et l'export au format historique, ou les garder comme outil de sauvegarde ;
   retirer ou non `app/public/index.html` (référence de la CI et des tests de parité).
5. Entretien : mise à jour de la pile (actions GitHub, versions majeures, Node 26), module Qualité ISO 9001
   ([cadrage](unification/CADRAGE-MODULE-QUALITE-9001.md)).
6. Stabiliser le test Playwright de déconnexion à deux onglets (échecs intermittents en CI, non reproduits en isolation).

Les phases ci-dessous sont le plan historique.


> Mise en perspective — 11 octobre 2026 : Les phases ci-dessous sont le plan historique, distinct des livraisons A–L. État courant et exclusions : [PROJECT_STATUS](../PROJECT_STATUS.md) et [backlog de reprise](08_PILOTAGE/BACKLOG.md). B2/E complets et toutes les familles v2 ne sont pas clôturés.


L'outil historique (fichier unique) est remplacé **module par module** par une application web avec base PostgreSQL normalisée, un enregistrement par élément et une mise à jour en temps réel entre utilisateurs. Pendant toute la transition, l'ancien outil reste servi sous `/legacy`. Un module repris y devient consultable seulement : « Module géré dans la nouvelle interface » ([ADR 0007](adr/0007-transition-legacy.md)).

Chaque phase est livrée par une ou plusieurs pull requests, avec une version publiée (`vX.Y.Z`), et met à jour `docs/INSTALLATION.md` si l'installation ou l'exploitation change.

Les exigences fonctionnelles détaillées sont dans [BACKLOG-FONCTIONNEL.md](archive/BACKLOG-FONCTIONNEL.md). Leur identifiant (`CRRC-01`, `INV-02`, `INC-03`…) est cité dans chaque commit et chaque PR qui les traite.

**Critères communs à chaque module livré** (backlog, « Critères d'acceptation communs ») : charte graphique et adaptation à tous les écrans (phase 0, 9 ter et 9 quater) ; droits RBAC déclarés pour le module (phase 0, 9 bis) ; reprise des données par l'import legacy, documentée dans `MAPPING-LEGACY.md` ; parcours Playwright et captures de référence à 390, 1920 et 3840 px.

La reprise couvre également **tout le socle v2 encore dans l'ancienne interface**, conformément à la clarification utilisateur du 9 octobre 2026. L'[inventaire de reprise](archive/REPRISE-SOCLE-LEGACY.md) établit la correspondance entre ces familles et le [backlog d'évolution A–L](archive/BACKLOG-EVOLUTION-SMSI-GRC.md). Leur archivage ne clôture pas leur migration ; chaque parcours reste opérationnel jusqu'à la recette de son remplacement Sauge.

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
- [x] **9 ter — Charte graphique et page Paramètres** ([ADR 0011](adr/0011-charte-graphique-et-parametres.md)) : `packages/ui` (thème Mantine clair et sombre, WCAG AA, composants communs) ; page Paramètres pleine largeur par sections, chacune avec son enregistrement et sa permission ; captures de référence.
- [x] **9 quater — Adaptation à tous les écrans** (du téléphone au 4K, [ADR 0012](adr/0012-adaptation-ecrans-et-ecran-mural.md)) : points de rupture et container queries, grilles auto-fill, maître-détail, tableaux configurables, typographie fluide, préférences « Taille d'affichage » et « Densité » enregistrées sur le serveur ; mode **écran mural** (`/mur`) ; tests de largeur utile et d'absence de défilement horizontal.
- [x] **9 quinquies — Données sur le serveur et mises à jour** ([spécification](archive/specs/EXPL-donnees-et-mises-a-jour.md), [ADR 0014](adr/0014-donnees-sur-le-serveur-et-mises-a-jour.md)) :
  - `EXPL-01` toutes les données dans `DATA_DIR` (montages bind, plus de volumes nommés), intactes après `docker compose down -v` ;
  - `EXPL-02` passage des volumes nommés vers `DATA_DIR`, anciens volumes conservés jusqu'à confirmation ;
  - `EXPL-03` script `mettre-a-jour.sh` (sauvegarde obligatoire, signature des images, santé, retour arrière automatique, rapport) ;
  - `EXPL-04` compatibilité des données entre versions, `GET /api/version`, test CI de montée de version avec retour arrière ;
  - `EXPL-05` Administration > Système : version, historique des mises à jour, dernière sauvegarde, espace disque, nouvelle version disponible ;
  - `EXPL-06` à `EXPL-09` outil historique dans l'image, notes de mise à jour dans chaque version, sauvegarde et restauration sur `DATA_DIR`, guide rejoué en CI avec une mise à jour.

## Cartographie du SMSI (après 9 quinquies) — livrée

Éditeur de cartes piloté par les données de la plateforme (vue contexte, vue processus), reprise du module bêta validé dans l'outil historique ([spécification](cartographie/SPEC-CARTOGRAPHIE-V3.md), [recette](cartographie/RECETTE.md)).
- [x] `CARTO-01` module de droits `cartographie` ; `CARTO-02` objets lus par adaptateur (état legacy, puis tables) ; `CARTO-03` tables `maps` et `map_versions` ; `CARTO-04` API, temps réel et présence.
- [x] `CARTO-05` génération assistée ; `CARTO-06` canevas SVG (zoom, recherche, préréglages, filtres) ; `CARTO-07` mode édition ; `CARTO-08` synchronisation ; `CARTO-09` ajout depuis la plateforme ; `CARTO-10` fiche détaillée.
- [x] `CARTO-11` versions ; `CARTO-12` nature des enjeux ; `CARTO-13` exports PNG, SVG, PDF, JSON ; `CARTO-14` reprise legacy de `S.maps` et transition.

## Cartographie : construire une carte de zéro — livrée

Demande du RSSI du 08/10/2026 après le premier essai ([spécification](cartographie/SPEC-EDITION-LIBRE.md), [ADR 0026](adr/0026-cartographie-creation-depuis-la-carte.md), parcours 21 à 32 de la [recette](cartographie/RECETTE.md)). Prévue **avant la phase 1** (chantier court).
- [x] `CARTO-15` créer depuis la carte un objet de la plateforme (enregistré dans son module) ; `CARTO-16` menu contextuel (clic droit, appui long, Maj+F10) ; `CARTO-17` palette en glisser-déposer.
- [x] `CARTO-18` renommer depuis la carte ; `CARTO-19` notes, cadres libres et carte vierge.

## Interface — retours du premier essai

- [ ] `UI-01` affichage plus compact par défaut ; `UI-02` graphiques SVG de la synthèse (anneaux, histogrammes), livrés avec la phase 1 ; `UI-03` revue graphique d'ensemble après la phase 1 ([backlog](archive/BACKLOG-FONCTIONNEL.md), section 8).

## Phase 1 — Audit — cadrage validé

[Spécification](audit/SPEC-AUDIT-V3.md) (`AUD-01` à `AUD-16`, points à arbitrer au § 6), [recette](audit/RECETTE.md) (26 parcours), [ADR 0025](adr/0025-audit.md).
Modules repris : `years`, `yearLabels`, `nextYear`, `nextDate`, `internalDate`, `iso27001Certified`, `groups`, `items`, `hdsChap`, `findings`, `source`, `closeDeadline`, `findingsRev`, `plan`.
- [ ] `AUD-01` droits (modules `audit`, `ecarts`, `plan_audit` existants) ; `AUD-02` cycle de certification ; `AUD-03` référentiels en tables versionnées (ISO 27001 clauses 4 à 10, Annexe A, HDS), guide des preuves et questions.
- [ ] `AUD-04` couverture AFNOR et interne, préparation par année ; `AUD-05` pronostic en parité avec l'outil historique ; `AUD-06` préparation de l'audit ; `AUD-07` couverture du cycle ; `AUD-08` fiche exigence.
- [ ] `AUD-09` registre des écarts (clôture tracée, réouverture) ; `AUD-10` plan d'actions ; `AUD-11` plan d'audit par année.
- [ ] `AUD-12` synthèse et graphiques ; `AUD-13` imports PRM02 et Tenacy (Tenacy repris en 3.6.1, voir le journal des modifications ; PRM02 à faire) ; `AUD-14` exports Excel, CSV, impression.
- [ ] `AUD-15` reprise legacy et passerelle d'ajout des écarts ; `AUD-16` temps réel, journal, performances.

## Phase 2 — Pilotage du SMSI

*Backlog : aucune exigence détaillée pour l'instant (section « Pilotage » à compléter).*

Modules repris : `dda`, `processes`, `objectives`, `indicators`, `suppliers`, `accessReviews`, `roles`, `reviews`, `recurring`, `evidences`.
- Processus, objectifs et indicateurs (valeurs, cibles, historique).
- Déclaration d'applicabilité (DdA) liée à l'Annexe A.
- Fournisseurs : contrôles, fréquences, certifications, évaluations.
- Revues d'accès planifiées et tracées.

## Phase 3 — Conformité étendue, risques et crise

Modules repris : `frameworks` (ReCyF et autres), `appGaps`, `ai`, `crrc`, `invest`, `incidents`, `crisis`, `swots`, `interested`, `scope`, `plans`, `supEvals`. La cartographie passe alors de l'état legacy aux tables pour ces objets, sans changer les cartes (`CARTO-02`), et la nature des enjeux devient un champ de l'enjeu (`CARTO-12`).
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
