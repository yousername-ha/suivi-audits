> 12/11/2026 — **Refonte Neon : [Fournisseurs Studio intégrés — code, contrôles, visuel et reprise IA](refonte-neon/FOURNISSEURS-STUDIO-INTEGRES.md)**.

# Index documentaire et reprise

> Refonte Neon, 12/11/2026 : [Processus Studio et centrage Parties — intégration, contrôles et reprise IA](refonte-neon/PROCESSUS-STUDIO-INTEGRE.md).

> Refonte Neon, 12/11/2026 : [Parties intéressées intégrées — sources, contrôles, captures et reprise IA](refonte-neon/PARTIES-STUDIO-INTEGREES.md).

## Jeu court à lire d'abord (18/10/2026)

0. [Reprise du 29/10/2026](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/REPRISE-2026-10-29.md) : état le plus récent (version 6.0.0 préparée, reste à faire) ;
   [reprise du 27/10/2026](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/REPRISE-2026-10-27.md) : règles de fusion et de travail.

1. [README](../README.md), [PRODUCT](PRODUCT.md), [REFERENTIALS](REFERENTIALS.md) : ce que fait la plateforme.
2. [ARCHITECTURE](ARCHITECTURE.md) et [DAT](03_ARCHITECTURE/DAT.md) : comment elle est construite ; [ADR](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/adr/README.md) et
   [DECISIONS](DECISIONS.md) : pourquoi.
3. [ROADMAP](ROADMAP.md), [PROJECT_STATUS](../PROJECT_STATUS.md), [CHANGELOG](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/CHANGELOG.md) : où on en est et la suite.
4. [INSTALLATION](INSTALLATION.md) (rejoué en CI), [CONTRIBUTING](../CONTRIBUTING.md), [AGENTS](../AGENTS.md), [CLAUDE](../CLAUDE.md).

Le reste (numérotées 01 à 08) sont les registres et la recette, **datés** : à lire avec le journal des modifications. Les
documents de travail terminés (diagnostics, refonte GRC, backlogs de reprise, spécifications d'exploitation, journal de
reprise) sont dans [archive](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/README.md), rien n'a été supprimé.


2026-10-12T17:00:00+02:00 (Europe/Paris). Référence des registres : `70ab3f09c4937d8445b8c02402956cd835f380d3` (`main`, version 3.1.0 + recette automatisée).
Lire d’abord [AGENTS](../AGENTS.md), [HANDOVER](../HANDOVER.md) et
[PROJECT_STATUS](../PROJECT_STATUS.md).

Les registres (REGISTRES.json, inventaire, cas et exécutions de recette, couverture,
matrice, bugs, tableau de bord, contrat d’API) ont été réévalués le 2026-10-12 sur
`70ab3f0` : CI complète (EXE-015, 898 tests), CodeQL (EXE-016) et recette serveur automatisée en CI (EXE-017) verts. Les autres
documents de cette arborescence (reprise, guides, historique, qualité, plans) portent
encore l’estampille `c704fa6` (3.0.2) : ils restent des sources datées, à lire avec le
[changelog](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/CHANGELOG.md) et l’[audit d’unification](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/L1-AUDIT-ET-CORRESPONDANCE.md).
EXE-001 à EXE-014 sont des constats historiques (`c704fa6`, `f9545c3`), non rejoués. Les tests
réellement vérifiés et les limites sont ceux des registres. Les anciennes documentations/ADR restent disponibles
comme sources datées ; le DAT actuel prévaut pour l’état de la pile. Ne pas
confondre conservation, interface adaptée et migration complète.

Source de référence des chiffres/IDs/états :
[REGISTRES.json](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/08_PILOTAGE/REGISTRES.json). Preuves anonymisées :
[exécutions](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/preuves/2026-10-11-executions.json). API détaillée :
[contrat généré](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/API_CONTRAT.json). Contrôles finaux :
[reçu documentaire](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/preuves/2026-10-11-controles-documentaires.json).

## Unification SMSI/GRC (branche `claude-suivi-smsi`)

- [L1 — audit et correspondance ancien / nouveau](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/L1-AUDIT-ET-CORRESPONDANCE.md)
- [Plan d'évolution](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/PLAN-EVOLUTION.md)
- [Audit L0 — intégration des interfaces ASTRA (menu, registres, actions, écarts, récurrences)](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/AUDIT-L0-INTEGRATION-UI-ASTRA.md)
- [Audit ASTRA du 21/10/2026 — relevé d'existant par exigence des dix dossiers](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/AUDIT-ASTRA-2026-10-21.md)
- [Suivi d'avancement du prompt maître ASTRA du 21/10/2026 (état honnête, décisions en attente)](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/SUIVI-ASTRA-2026-10-21.md)
- [Recette de l'intégration ASTRA (R01 à R18) et bilan par lot](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/RECETTE-INTEGRATION-ASTRA.md)
- [Cadrage du module Qualité ISO 9001](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/CADRAGE-MODULE-QUALITE-9001.md) (réflexion, aucun code)
- [Cadrage du module Intégrations (GLPI, ORADAD, Silène)](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/unification/CADRAGE-MODULE-INTEGRATIONS.md) et [ADR 0076](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/adr/0076-module-integrations.md) (ADR acceptée le 29/10/2026, aucun code)
- [Refonte GRC : configuration transversale et multiméthode](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/refonte-grc/README.md) ([ADR 0038](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/adr/0038-socle-de-configuration-grc-transversal.md))

## 01_REPRISE_IA

- [Contexte projet](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/CONTEXTE_PROJET.md)
- [Etat actuel](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/ETAT_ACTUEL.md)
- [Travaux realises](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/TRAVAUX_REALISES.md)
- [Travaux en cours](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/TRAVAUX_EN_COURS.md)
- [Reste a faire](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/RESTE_A_FAIRE.md)
- [Plan reprise](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/PLAN_REPRISE.md)
- [Decisions techniques](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/DECISIONS_TECHNIQUES.md)
- [Journal de bord](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/01_REPRISE_IA/JOURNAL_DE_BORD.md)

## 02_FONCTIONNALITES

- [Inventaire fonctionnel](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md)
- [Comparaison ancien nouveau](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/02_FONCTIONNALITES/COMPARAISON_ANCIEN_NOUVEAU.md)
- [Fonctionnalites non reprises](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/02_FONCTIONNALITES/FONCTIONNALITES_NON_REPRISES.md)
- [Regressions](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/02_FONCTIONNALITES/REGRESSIONS.md)
- [Matrice tracabilite](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/02_FONCTIONNALITES/MATRICE_TRACABILITE.md)

## 03_ARCHITECTURE

- [Dat](03_ARCHITECTURE/DAT.md)
- [Architecture applicative](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/ARCHITECTURE_APPLICATIVE.md)
- [Architecture technique](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/ARCHITECTURE_TECHNIQUE.md)
- [Base de donnees](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/BASE_DE_DONNEES.md)
- [Api interfaces](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/API_INTERFACES.md)
- [Securite](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/SECURITE.md)
- [Deploiement](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/DEPLOIEMENT.md)
- [Exploitation maintenance](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/03_ARCHITECTURE/EXPLOITATION_MAINTENANCE.md)

## 04_QUALITE

- [Registre bugs](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/04_QUALITE/REGISTRE_BUGS.md)
- [Problemes techniques](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/04_QUALITE/PROBLEMES_TECHNIQUES.md)
- [Dette technique](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/04_QUALITE/DETTE_TECHNIQUE.md)
- [Optimisations realisees](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/04_QUALITE/OPTIMISATIONS_REALISEES.md)
- [Optimisations a faire](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/04_QUALITE/OPTIMISATIONS_A_FAIRE.md)
- [Risques](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/04_QUALITE/RISQUES.md)

## 05_RECETTE

- [Strategie recette](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/STRATEGIE_RECETTE.md)
- [Plan de tests](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/PLAN_DE_TESTS.md)
- [Cas de test](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/CAS_DE_TEST.md)
- [Executions recette](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/EXECUTIONS_RECETTE.md)
- [Rapport recette](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/RAPPORT_RECETTE.md)
- [Couverture fonctionnelle](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/COUVERTURE_FONCTIONNELLE.md)
- [Pv recette](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/PV_RECETTE.md)
- [Recette manuelle des clés de sécurité FIDO2](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/CHECKLIST-FIDO2.md) ([ADR 0079](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/adr/0079-authentification-fido2-webauthn.md), non exécutée)

## 06_GUIDES

- [Guide utilisateur](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/06_GUIDES/GUIDE_UTILISATEUR.md)
- [Guide administrateur](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/06_GUIDES/GUIDE_ADMINISTRATEUR.md)
- [Guide installation](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/06_GUIDES/GUIDE_INSTALLATION.md)
- [Guide depannage](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/06_GUIDES/GUIDE_DEPANNAGE.md)
- [Faq](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/06_GUIDES/FAQ.md)

## 07_HISTORIQUE

- [Changelog](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/07_HISTORIQUE/CHANGELOG.md)
- [Historique migration](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/07_HISTORIQUE/HISTORIQUE_MIGRATION.md)
- [Historique corrections](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/07_HISTORIQUE/HISTORIQUE_CORRECTIONS.md)
- [Versions](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/07_HISTORIQUE/VERSIONS.md)

## 08_PILOTAGE

- [Backlog](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/08_PILOTAGE/BACKLOG.md)
- [Priorites](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/08_PILOTAGE/PRIORITES.md)
- [Dependances](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/08_PILOTAGE/DEPENDANCES.md)
- [Tableau de bord](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/08_PILOTAGE/TABLEAU_DE_BORD.md)

## Vérification du dossier

Contrôle local sans base ni réseau :

```bash
node docs/08_PILOTAGE/verifier-documentation.mjs
```

Ce contrôle vérifie fichiers, liens locaux, sources, identifiants, statuts et
chiffres. Il ne valide ni contenu métier, ni site externe, ni acceptation humaine.

## Sources antérieures conservées

- [Installation rejouée en CI](INSTALLATION.md), [Contribuer](../CONTRIBUTING.md),
  [CHANGELOG racine](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/CHANGELOG.md).
- [ADR](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/adr/README.md), [diagnostics datés](https://github.com/yousername-ha/suivi-audits/tree/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/diagnostics),
  source v2 : historique Git (commit `b148c1ba303954b7023996fce3d0eff2923326b5`).
- [Format legacy](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/legacy/LEGACY-FORMAT.md), [mapping](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/legacy/MAPPING-LEGACY.md),
  [import](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/legacy/IMPORT-LEGACY.md), [inventaire initial](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/REPRISE-SOCLE-LEGACY.md).
- [Archive de l'ancienne interface](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/ancienne-interface/README.md) (captures, correspondance avec la nouvelle interface).
- [Pilotage métier](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/PILOTAGE.md), [lots G/H/K/début E](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/LOT-G-H-K-DEBUT-E.md),
  [lot C](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/LOT-C-TACHES-RISQUES-CARTOGRAPHIE.md), [sources officielles connues](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/sources-lot-c.json).
- [Feuille de route historique](ROADMAP.md), [backlog A–L](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/BACKLOG-EVOLUTION-SMSI-GRC.md),
  [backlog détaillé](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/BACKLOG-FONCTIONNEL.md), [cartographie](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/cartographie/00-LISEZ-MOI.md).

Les chemins sources sont cliquables depuis les matrices. Les IDs FCT/BUG/SEC/
OPT/TEST/DEV/MIG/DOC ne changent pas sans décision tracée. Lors d’une session,
actualiser les lignes touchées et HANDOVER sans réécrire inutilement tout le dossier.

## Entretien du dépôt

- [Nettoyage du 11 octobre](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/archive/diagnostics/2026-10-11-nettoyage-depot.md) : éléments
  retirés, usages encore nécessaires et limites.
- [Contrôles du nettoyage](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/05_RECETTE/preuves/2026-10-11-nettoyage.json).


### Livraison locale Refonte Neon du 11/11/2026

[Actions / Récurrences / Timeline Studio : intégration et recette](refonte-neon/TIMELINE-STUDIO-INTEGREE.md) · [Docker interfaces sans connexion](refonte-neon/DOCKER-INTERFACES.md). Sources sur la branche isolée `codex/refonte-neon-main`, sans publication ; limites cloud et essai Windows explicités.


### Listes et Timeline — 11/11/2026

[Retrait Budget / CRRC, lignes cliquables, défilement et résultats OK / KO](refonte-neon/LIGNES-ET-VALIDATION-RAPIDE.md) : intégration, couverture des menus, invariants et contrôles locaux de la branche Neon.


### Registres Neon et validation depuis les repères — 11/11/2026

[Implémentation et recette locale](refonte-neon/LIGNES-ET-VALIDATION-RAPIDE.md) : modules retirés des écrans, ouverture par ligne, densité et défilement, résultats Actions / Récurrences. [Profil Docker interfaces](refonte-neon/DOCKER-INTERFACES.md).
