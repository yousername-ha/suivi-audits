# Index documentaire et reprise

## Jeu court à lire d'abord (18/10/2026)

0. [Reprise du 29/10/2026](01_REPRISE_IA/REPRISE-2026-10-29.md) : état le plus récent (version 5.2.0 préparée, reste à faire) ;
   [reprise du 27/10/2026](01_REPRISE_IA/REPRISE-2026-10-27.md) : règles de fusion et de travail.

1. [README](../README.md), [PRODUCT](PRODUCT.md), [REFERENTIALS](REFERENTIALS.md) : ce que fait la plateforme.
2. [ARCHITECTURE](ARCHITECTURE.md) et [DAT](03_ARCHITECTURE/DAT.md) : comment elle est construite ; [ADR](adr/README.md) et
   [DECISIONS](DECISIONS.md) : pourquoi.
3. [ROADMAP](ROADMAP.md), [PROJECT_STATUS](../PROJECT_STATUS.md), [CHANGELOG](../CHANGELOG.md) : où on en est et la suite.
4. [INSTALLATION](INSTALLATION.md) (rejoué en CI), [CONTRIBUTING](../CONTRIBUTING.md), [AGENTS](../AGENTS.md), [CLAUDE](../CLAUDE.md).

Le reste (numérotées 01 à 08) sont les registres et la recette, **datés** : à lire avec le journal des modifications. Les
documents de travail terminés (diagnostics, refonte GRC, backlogs de reprise, spécifications d'exploitation, journal de
reprise) sont dans [archive](archive/README.md), rien n'a été supprimé.


2026-10-12T17:00:00+02:00 (Europe/Paris). Référence des registres : `70ab3f09c4937d8445b8c02402956cd835f380d3` (`main`, version 3.1.0 + recette automatisée).
Lire d’abord [AGENTS](../AGENTS.md), [HANDOVER](../HANDOVER.md) et
[PROJECT_STATUS](../PROJECT_STATUS.md).

Les registres (REGISTRES.json, inventaire, cas et exécutions de recette, couverture,
matrice, bugs, tableau de bord, contrat d’API) ont été réévalués le 2026-10-12 sur
`70ab3f0` : CI complète (EXE-015, 898 tests), CodeQL (EXE-016) et recette serveur automatisée en CI (EXE-017) verts. Les autres
documents de cette arborescence (reprise, guides, historique, qualité, plans) portent
encore l’estampille `c704fa6` (3.0.2) : ils restent des sources datées, à lire avec le
[changelog](../CHANGELOG.md) et l’[audit d’unification](unification/L1-AUDIT-ET-CORRESPONDANCE.md).
EXE-001 à EXE-014 sont des constats historiques (`c704fa6`, `f9545c3`), non rejoués. Les tests
réellement vérifiés et les limites sont ceux des registres. Les anciennes documentations/ADR restent disponibles
comme sources datées ; le DAT actuel prévaut pour l’état de la pile. Ne pas
confondre conservation, interface adaptée et migration complète.

Source de référence des chiffres/IDs/états :
[REGISTRES.json](08_PILOTAGE/REGISTRES.json). Preuves anonymisées :
[exécutions](05_RECETTE/preuves/2026-10-11-executions.json). API détaillée :
[contrat généré](03_ARCHITECTURE/API_CONTRAT.json). Contrôles finaux :
[reçu documentaire](05_RECETTE/preuves/2026-10-11-controles-documentaires.json).

## Unification SMSI/GRC (branche `claude-suivi-smsi`)

- [L1 — audit et correspondance ancien / nouveau](unification/L1-AUDIT-ET-CORRESPONDANCE.md)
- [Plan d'évolution](unification/PLAN-EVOLUTION.md)
- [Audit L0 — intégration des interfaces ASTRA (menu, registres, actions, écarts, récurrences)](unification/AUDIT-L0-INTEGRATION-UI-ASTRA.md)
- [Audit ASTRA du 21/10/2026 — relevé d'existant par exigence des dix dossiers](unification/AUDIT-ASTRA-2026-10-21.md)
- [Suivi d'avancement du prompt maître ASTRA du 21/10/2026 (état honnête, décisions en attente)](unification/SUIVI-ASTRA-2026-10-21.md)
- [Recette de l'intégration ASTRA (R01 à R18) et bilan par lot](unification/RECETTE-INTEGRATION-ASTRA.md)
- [Cadrage du module Qualité ISO 9001](unification/CADRAGE-MODULE-QUALITE-9001.md) (réflexion, aucun code)
- [Cadrage du module Intégrations (GLPI, ORADAD, Silène)](unification/CADRAGE-MODULE-INTEGRATIONS.md) et [ADR 0076](adr/0076-module-integrations.md) (proposés, aucun code)
- [Refonte GRC : configuration transversale et multiméthode](archive/refonte-grc/README.md) ([ADR 0038](adr/0038-socle-de-configuration-grc-transversal.md))

## 01_REPRISE_IA

- [Contexte projet](01_REPRISE_IA/CONTEXTE_PROJET.md)
- [Etat actuel](01_REPRISE_IA/ETAT_ACTUEL.md)
- [Travaux realises](01_REPRISE_IA/TRAVAUX_REALISES.md)
- [Travaux en cours](01_REPRISE_IA/TRAVAUX_EN_COURS.md)
- [Reste a faire](01_REPRISE_IA/RESTE_A_FAIRE.md)
- [Plan reprise](01_REPRISE_IA/PLAN_REPRISE.md)
- [Decisions techniques](01_REPRISE_IA/DECISIONS_TECHNIQUES.md)
- [Journal de bord](01_REPRISE_IA/JOURNAL_DE_BORD.md)

## 02_FONCTIONNALITES

- [Inventaire fonctionnel](02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md)
- [Comparaison ancien nouveau](02_FONCTIONNALITES/COMPARAISON_ANCIEN_NOUVEAU.md)
- [Fonctionnalites non reprises](02_FONCTIONNALITES/FONCTIONNALITES_NON_REPRISES.md)
- [Regressions](02_FONCTIONNALITES/REGRESSIONS.md)
- [Matrice tracabilite](02_FONCTIONNALITES/MATRICE_TRACABILITE.md)

## 03_ARCHITECTURE

- [Dat](03_ARCHITECTURE/DAT.md)
- [Architecture applicative](03_ARCHITECTURE/ARCHITECTURE_APPLICATIVE.md)
- [Architecture technique](03_ARCHITECTURE/ARCHITECTURE_TECHNIQUE.md)
- [Base de donnees](03_ARCHITECTURE/BASE_DE_DONNEES.md)
- [Api interfaces](03_ARCHITECTURE/API_INTERFACES.md)
- [Securite](03_ARCHITECTURE/SECURITE.md)
- [Deploiement](03_ARCHITECTURE/DEPLOIEMENT.md)
- [Exploitation maintenance](03_ARCHITECTURE/EXPLOITATION_MAINTENANCE.md)

## 04_QUALITE

- [Registre bugs](04_QUALITE/REGISTRE_BUGS.md)
- [Problemes techniques](04_QUALITE/PROBLEMES_TECHNIQUES.md)
- [Dette technique](04_QUALITE/DETTE_TECHNIQUE.md)
- [Optimisations realisees](04_QUALITE/OPTIMISATIONS_REALISEES.md)
- [Optimisations a faire](04_QUALITE/OPTIMISATIONS_A_FAIRE.md)
- [Risques](04_QUALITE/RISQUES.md)

## 05_RECETTE

- [Strategie recette](05_RECETTE/STRATEGIE_RECETTE.md)
- [Plan de tests](05_RECETTE/PLAN_DE_TESTS.md)
- [Cas de test](05_RECETTE/CAS_DE_TEST.md)
- [Executions recette](05_RECETTE/EXECUTIONS_RECETTE.md)
- [Rapport recette](05_RECETTE/RAPPORT_RECETTE.md)
- [Couverture fonctionnelle](05_RECETTE/COUVERTURE_FONCTIONNELLE.md)
- [Pv recette](05_RECETTE/PV_RECETTE.md)

## 06_GUIDES

- [Guide utilisateur](06_GUIDES/GUIDE_UTILISATEUR.md)
- [Guide administrateur](06_GUIDES/GUIDE_ADMINISTRATEUR.md)
- [Guide installation](06_GUIDES/GUIDE_INSTALLATION.md)
- [Guide depannage](06_GUIDES/GUIDE_DEPANNAGE.md)
- [Faq](06_GUIDES/FAQ.md)

## 07_HISTORIQUE

- [Changelog](07_HISTORIQUE/CHANGELOG.md)
- [Historique migration](07_HISTORIQUE/HISTORIQUE_MIGRATION.md)
- [Historique corrections](07_HISTORIQUE/HISTORIQUE_CORRECTIONS.md)
- [Versions](07_HISTORIQUE/VERSIONS.md)

## 08_PILOTAGE

- [Backlog](08_PILOTAGE/BACKLOG.md)
- [Priorites](08_PILOTAGE/PRIORITES.md)
- [Dependances](08_PILOTAGE/DEPENDANCES.md)
- [Tableau de bord](08_PILOTAGE/TABLEAU_DE_BORD.md)

## Vérification du dossier

Contrôle local sans base ni réseau :

```bash
node docs/08_PILOTAGE/verifier-documentation.mjs
```

Ce contrôle vérifie fichiers, liens locaux, sources, identifiants, statuts et
chiffres. Il ne valide ni contenu métier, ni site externe, ni acceptation humaine.

## Sources antérieures conservées

- [Installation rejouée en CI](INSTALLATION.md), [Contribuer](../CONTRIBUTING.md),
  [CHANGELOG racine](../CHANGELOG.md).
- [ADR](adr/README.md), [diagnostics datés](archive/diagnostics),
  source v2 : historique Git (commit `b148c1ba303954b7023996fce3d0eff2923326b5`).
- [Format legacy](legacy/LEGACY-FORMAT.md), [mapping](legacy/MAPPING-LEGACY.md),
  [import](legacy/IMPORT-LEGACY.md), [inventaire initial](archive/REPRISE-SOCLE-LEGACY.md).
- [Archive de l'ancienne interface](archive/ancienne-interface/README.md) (captures, correspondance avec la nouvelle interface).
- [Pilotage métier](PILOTAGE.md), [lots G/H/K/début E](LOT-G-H-K-DEBUT-E.md),
  [lot C](archive/LOT-C-TACHES-RISQUES-CARTOGRAPHIE.md), [sources officielles connues](sources-lot-c.json).
- [Feuille de route historique](ROADMAP.md), [backlog A–L](archive/BACKLOG-EVOLUTION-SMSI-GRC.md),
  [backlog détaillé](archive/BACKLOG-FONCTIONNEL.md), [cartographie](cartographie/00-LISEZ-MOI.md).

Les chemins sources sont cliquables depuis les matrices. Les IDs FCT/BUG/SEC/
OPT/TEST/DEV/MIG/DOC ne changent pas sans décision tracée. Lors d’une session,
actualiser les lignes touchées et HANDOVER sans réécrire inutilement tout le dossier.

## Entretien du dépôt

- [Nettoyage du 11 octobre](archive/diagnostics/2026-10-11-nettoyage-depot.md) : éléments
  retirés, usages encore nécessaires et limites.
- [Contrôles du nettoyage](05_RECETTE/preuves/2026-10-11-nettoyage.json).
