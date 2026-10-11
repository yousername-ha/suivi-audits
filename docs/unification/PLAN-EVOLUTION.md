# Plan d'évolution — application SMSI/GRC unifiée

Date : 2026-10-11 (Europe/Paris). Fondé sur l'[audit L1](L1-AUDIT-ET-CORRESPONDANCE.md). Branche : `claude-suivi-smsi`
(base `feature/gpt6-evolution-smsi-grc`, `5a3bd0c`). Chaque lot livre code, migration additive éventuelle, droits
serveur, tests et documentation ; rien n'est déclaré terminé sur la seule foi d'un build.

## Principes

- **Une seule source par donnée.** Les familles historiques restent dans `app_state` tant qu'un remplacement n'est pas
  recetté ; la nouvelle interface les édite par adaptateur (comme Pilotage aujourd'hui), sans copie.
- **Pas de conformité revendiquée.** Les écrans de risques disent « démarche inspirée d'EBIOS Risk Manager (ANSSI) » et
  « processus inspiré de l'ISO/IEC 27005 » ; aucun score ne vaut certification. Aucun texte normatif sous licence
  n'est reproduit.
- **Inspiration fonctionnelle** (CISO Assistant, Oversecure, Tenacy) : principes d'ergonomie et de modèle seulement
  (études de risques distinctes du registre, plan de traitement relié aux mesures, acceptation formelle, graphe des
  liens), jamais de code ni de contenu.
- **Aucune nouvelle dépendance** : graphiques en SVG maison dans `packages/ui`.
- **Coût CI** : vérification locale (lint, typecheck, build, Vitest avec PostgreSQL jetable, Playwright dans le
  conteneur officiel) ; poussées sur `claude-suivi-smsi` sans PR ; une seule PR à la validation.

## Lots

| Lot | Contenu | Exigences | Livrable |
|---|---|---|---|
| U0 | Intégrer les travaux de la lignée `refonte/*` absents de la référence : spécifications Audit et carte libre (fait), édition libre de la carte (CARTO-15 à 19, avec correction du parcours 31), socle Audit partagé (AUD-05, 09, 10) ; adapter à la charte Sauge et à l'inspecteur actuel | CARTO-15..19, AUD-05/09/10 | L1, L2 |
| U1 | **Interface unifiée** : un seul tableau de bord (accueil) avec anneaux et histogrammes SVG (UI-02) calculés sur les deux sources (écarts historiques **et** constats GRC), la Synthèse Pilotage réutilisant les mêmes composants filtrés au périmètre ; « Évaluations IA » dans le menu ; rubriques encore historiques visibles dans le menu Pilotage avec la mention « ancienne interface » et ouverture de la bonne page de `/legacy` ; libellés distincts « Cartographie du SMSI » / « Cartographie des risques » | UI-01, UI-02, FCT-039 | L2 |
| U2 | **Pilotage SMSI** : Applicabilité affiche et édite la DdA historique (`dda`, `items`) par adaptateur à côté des fiches GRC ; vues « par processus » et « compacte » des objectifs ; audits internes et exercices réunis avec les `plans` historiques (adaptateur, sans doublon) ; tableau de bord Pilotage graphique (objectifs atteints, écarts par type, conformité par référentiel, plans par état) | FCT-019, 028, 030, 038 | L3 |
| U3 | **Gestion des risques refondue** (détail ci-dessous) | FCT-022, 023 | L4 |
| U4 | **Liens transverses** : catalogue des relations autorisées (paires de types et sens), panneau « Liens » bidirectionnel sur chaque fiche, liens risque ↔ actif, processus, objectif, exigence, mesure, plan de traitement, action, responsable, preuve, audit, non-conformité, indicateur ; corrections : références `legacy:` refusées hors périmètre commun, objets archivés signalés, liste des comptes réduite aux personnes autorisées | C8, C9 | L5 |
| U5 | Fiabilité : tests unitaires, API (droits, absence de fuite entre périmètres, idempotence, `If-Match`), Playwright des parcours Pilotage ↔ Risques ; migrations additives testées sur base vierge et sur base existante, avec plan de retour arrière | — | L5, L6 |
| U6 | Documentation : `CLAUDE.md` et `ARCHITECTURE.md` remis à jour, ADR (risques, liens), registre des bugs, recette, backlog, synthèse, procédure de retour arrière, `CHANGELOG` | — | L7 |
| U7 | GitHub, après validation : PR unique, puis rationalisation à trois branches | — | L8 |

## U3 — Gestion des risques

Deux démarches **distinctes**, un registre commun.

**Étude EBIOS RM** (nouvel objet `risk_study`, un par périmètre étudié), cinq ateliers qui sont de vrais objets reliés :
1. Cadrage et socle de sécurité : valeurs métier, biens supports, événements redoutés (gravité sur l'échelle de la
   méthode), socle (référentiels appliqués et écarts, reliés aux exigences et à la DdA).
2. Sources de risque : couples source de risque / objectif visé, motivation, ressources, pertinence retenue ou non.
3. Scénarios stratégiques : parties prenantes de l'écosystème (dépendance, pénétration, maturité, confiance → niveau
   de menace), chemins d'attaque, gravité ; mesures sur l'écosystème.
4. Scénarios opérationnels : modes opératoires reliés aux biens supports, vraisemblance.
5. Traitement : stratégie, mesures (reliées aux mesures et à la DdA), risques résiduels, plan d'amélioration continue
   de la sécurité (PACS) relié au plan d'actions.

Chaque atelier a son écran, son statut (brouillon, revu, validé) et sa validation tracée ; les risques issus de
l'étude alimentent le registre commun avec leur filiation.

**Processus ISO/IEC 27005** (fiche de risque) : identification (actif ou processus, menace, vulnérabilité,
conséquences), analyse (vraisemblance, impacts par dimension : disponibilité, intégrité, confidentialité, preuve, et
dimensions configurées), évaluation au regard des critères d'acceptation publiés, traitement (option, plan de
traitement relié aux mesures et aux actions), **acceptation formelle** (responsable, date, conditions, échéance), suivi
(dates de réévaluation et déclencheurs exploités par les rappels).

**Commun** : registre avec colonnes utiles (code, niveau brut et résiduel, responsable, stratégie, statut, prochaine
revue), tri et filtres serveur ; plans de traitement reliés aux risques **et** aux mesures ; une action terminée ne
modifie jamais le résiduel (réévaluation explicite) ; carte des risques existante conservée et enrichie (chaînage
EBIOS) ; reprise en lecture des risques historiques (`ai.evals`, risques de comité) avec lien vers leur source, sans
copie. Schémas zod serveur pour chaque type, migration additive si un index ou une contrainte est nécessaire.

## Ordre et validation

U0 → U1 → U2 → U3 → U4, U5 et U6 au fil de l'eau. Fin de chaque lot : contrôles locaux complets, commit et poussée sur
`claude-suivi-smsi` (sans PR, donc sans minute Actions). Validation du RSSI sur son serveur (mise à jour depuis la
branche), puis U7.

## U7 — branches (aucune suppression sans accord explicite)

Avant toute suppression : sauvegarde par étiquette `archive/<branche>` (une étiquette `archive/*` ne déclenche aucun
workflow ; seule `v*.*.*` publie). Fermer d'abord les PR #1 à #11 et #13 (sans fusion), puis supprimer les branches
dont le contenu est inclus ailleurs. `feat/cartographie-beta`, `feat/carto-edition`, `refonte/audit-socle` et
`docs/phase-1-audit` ne sont supprimées qu'après leur intégration vérifiée dans `claude-suivi-smsi`. Cible : `main`,
`feature/gpt6-evolution-smsi-grc`, `claude-suivi-smsi`.

## Retour arrière

Migrations uniquement additives (tables et colonnes nouvelles, aucune suppression ni réécriture) : revenir à l'image
précédente laisse la base compatible ; les nouvelles tables sont ignorées. Sauvegarde automatique avant mise à jour
(`scripts/mettre-a-jour.sh`) et restauration documentée dans `docs/INSTALLATION.md`.

Ce que chaque lot laisse dans la base, et l'effet d'un retour à l'image `3.0.2` (`feature/gpt6-evolution-smsi-grc`) :

| Lot | Données écrites | Retour à 3.0.2 |
| --- | --- | --- |
| U0 | notes et cadres dans la disposition des cartes (`map_versions`) ; objets créés depuis la carte dans `app_state` | cartes lisibles ; 3.0.2 refuse (422) d'enregistrer ou de restaurer une disposition qui contient des notes ou des cadres (références `note:` / `frame:` inconnues de son schéma) : les retirer avant le retour. Objets créés depuis la carte conservés dans l'outil de suivi |
| U1, U2 | aucune nouvelle structure ; la DdA modifiée l'est dans `app_state.data.dda` (format historique) | sans effet |
| U3 | migration `016` : colonne `pilotage_decisions.terms` et index ; objets `risk_study`, `sr_ov`, `ecosystem_party` dans `grc_objects` ; décisions `risk_acceptance` | colonne et index ignorés ; les nouveaux types d'objets et l'opération d'acceptation ne sont pas reconnus par l'interface 3.0.2 (à archiver avant retour si on veut les masquer) |
| U4 | aucune nouvelle structure | sans effet ; le catalogue des relations n'est plus contrôlé |

Procédure : sauvegarde chiffrée (faite par `scripts/mettre-a-jour.sh`), puis retour à l'image précédente par le même
script (`docs/INSTALLATION.md`, section mise à jour et retour arrière). La migration `016` ne se défait pas : elle est
inerte pour une version antérieure. Limite : le retour à `3.0.2` avec des objets des nouveaux types n'a pas été rejoué
sur une pile réelle pendant ce chantier (aucune image `3.0.2` reconstruite localement).
