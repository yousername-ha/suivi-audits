# Gestion des risques — refonte (lot U3)

Date : 2026-10-11 (Europe/Paris). Branche `claude-suivi-smsi`. Constat de départ : [audit L1](../unification/L1-AUDIT-ET-CORRESPONDANCE.md),
§ 6. Décisions : [ADR 0027](../adr/0027-risques-ebios-rm-iso27005.md). Exigences : `RISK-01` à `RISK-10`
([backlog](../archive/BACKLOG-FONCTIONNEL.md), section 9).

> **Aucune conformité n'est revendiquée.** L'application outille une démarche *inspirée* d'EBIOS Risk Manager (guide
> de l'ANSSI) et un processus *inspiré* de l'ISO/IEC 27005. Les libellés reprennent le vocabulaire courant des
> méthodes, sans reproduire de texte normatif. Les échelles, les seuils et les critères d'acceptation sont ceux que
> l'organisation publie dans sa méthode (versions immuables existantes).

## 1. Principes

- **Deux démarches distinctes, un registre commun.** Une étude EBIOS RM est un objet à part entière, organisé en
  cinq ateliers dont chaque élément est un objet typé et relié. Le processus ISO/IEC 27005 s'applique fiche par fiche
  dans le registre. Les risques issus d'une étude rejoignent le registre avec leur filiation.
- **Réutiliser l'existant** : objets GRC (`grc_objects`), versions, liens (`grc_links`), méthodes publiées
  (`grc_method_versions`), appréciations immuables (`grc_risk_evaluations`), décisions immuables
  (`pilotage_decisions`), tâches et actions. Aucune table nouvelle n'est nécessaire : les nouveaux types sont des
  valeurs de `grc_objects.kind`, validées par le serveur (schémas zod).
- **Références typées.** Chaque champ de liaison déclare les types d'objets acceptés ; le serveur les vérifie
  (type, périmètre, droit de lecture). L'interface ne propose que ces types.
- **Une action terminée ne modifie jamais un risque** : la réévaluation reste explicite (règle existante).

## 2. Étude EBIOS RM (`risk_study`)

| Atelier | Objets (type) | Champs principaux | Calcul affiché |
|---|---|---|---|
| 1. Cadrage et socle de sécurité | `risk_study` (objet, périmètre, participants, période) ; `business_asset` (valeur métier) ; `support_asset` (bien support) ; `feared_event` (événement redouté) ; socle : écarts au référentiel | valeur métier : nature, responsable, processus ; bien support : valeurs métier soutenues ; événement redouté : valeur métier, impacts, **gravité** (échelle publiée) | gravité maximale par valeur métier |
| 2. Sources de risque | `risk_source` ; `sr_ov` (couple source de risque / objectif visé) | motivation, ressources, activité (1 à 4), **retenu** et justification | couples retenus |
| 3. Scénarios stratégiques | `ecosystem_party` (partie prenante) ; `strategic_scenario` | partie prenante : dépendance, pénétration, maturité, confiance (1 à 4) ; scénario : couple SR/OV, événements redoutés, parties prenantes du chemin d'attaque, **gravité** | indice de menace d'une partie prenante = (dépendance × pénétration) / (maturité × confiance), présenté comme aide à la décision ; gravité proposée = maximum des événements redoutés liés |
| 4. Scénarios opérationnels | `operational_scenario` | scénario stratégique, biens supports visés, mode opératoire, **vraisemblance** (échelle publiée) | — |
| 5. Traitement | `treatment` (mesure de traitement) ; risques du registre ; actions | stratégie, mesures (mesures et DdA), risques résiduels, plan d'amélioration continue (actions) | matrice gravité × vraisemblance des risques de l'étude |

Chaque atelier a un statut (brouillon, revu, validé). La **validation d'un atelier** est une décision immuable
(`pilotage_decisions`, opération `step_validation`), exige `pilotage:administrer` et une justification. Une étude
liste ses objets par atelier ; « Créer le risque » sur un scénario opérationnel crée une fiche du registre reliée à
l'étude, au scénario stratégique, au couple SR/OV et aux événements redoutés.

## 3. Processus ISO/IEC 27005 (fiche de risque du registre)

| Activité | Champs |
|---|---|
| Identification | actifs ou processus concernés (références), menace, vulnérabilité, conséquences |
| Analyse | vraisemblance, impacts par dimension (disponibilité, intégrité, confidentialité, traçabilité, et dimensions de la méthode publiée) — appréciation existante (brut, résiduel) |
| Évaluation | comparaison au critère d'acceptation publié (niveau calculé par la méthode) |
| Traitement | option (réduire, accepter, transférer, éviter), plans de traitement (`treatment`) reliés aux mesures et aux actions |
| Acceptation | **décision formelle immuable** : responsable, date, conditions, échéance de revue (opération `risk_acceptance`) |
| Surveillance | date de prochaine revue ; rappel existant (tâches) ; historique des appréciations |

Une fiche dont l'option est « accepter » est signalée **non acceptée** tant qu'aucune décision d'acceptation
valide n'existe ; une acceptation échue (date de revue dépassée) est signalée.

## 4. Registre commun

Colonnes : code, intitulé, démarche (EBIOS RM, ISO/IEC 27005, autre), niveau brut et résiduel (dernière appréciation
validée), responsable, option de traitement, état d'acceptation, prochaine revue. Filtres serveur (démarche, niveau,
option, acceptation, retard). La carte des risques existante reste la vue graphique.

Risques historiques : les scénarios IA (`ai.evals`) et les risques des comités (`reviews[].cs.risks`) restent dans
l'outil historique ; le registre les **référence en lecture** (lien vers leur source) sans les copier.

## 5. Droits et sécurité

Lecture `pilotage:lire`, modification `pilotage:modifier`, validation d'atelier et acceptation `pilotage:administrer`,
création d'actions `ecarts:modifier`. Contrôles serveur à chaque requête, périmètres respectés, références typées
vérifiées, décisions immuables et idempotentes, journal d'audit. Aucune exécution de règle fournie par l'utilisateur.

## 6. Tests attendus

Vitest `packages/shared` : schémas, indice de menace, gravité proposée, état d'acceptation. Vitest `apps/api` :
création par atelier, références typées refusées (mauvais type, autre périmètre, droit manquant), validation d'atelier
et acceptation réservées à `pilotage:administrer`, décision immuable, aucune réévaluation automatique, absence de fuite
entre périmètres. Playwright : parcours étude EBIOS RM (ateliers 1 à 5 jusqu'au risque du registre) et parcours
ISO/IEC 27005 (identification → acceptation formelle), téléphone et ordinateur, aucune violation de CSP.

## 7. Limites assumées

- Pas de bibliothèque de menaces, de vulnérabilités ou de scénarios préremplie : aucune source sous licence n'est
  reproduite.
- Les échelles par défaut sont celles des modèles de méthode existants ; l'organisation publie les siennes.
- MÉHARI reste un modèle configurable sans barèmes ni services de sécurité.
