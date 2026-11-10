# Note de cadrage : sortie progressive du modèle historique

- Statut : **note de cadrage, aucune implémentation**. Toute reprise de module exige une décision du RSSI et une ADR (numéro à
  annoncer avant usage, règle 5 d'AGENTS).
- Date : 2026-11-09
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Contexte : [ADR 0007](../adr/0007-transition-legacy.md) (transition), [ADR 0040](../adr/0040-sortie-du-json-plat-modules-en-tables.md)
  (modules en tables), [ADR 0083](../adr/0083-porte-de-lecture-autorisee-entre-modules.md) (porte de lecture).

## 1. État actuel (relevé dans le code)

- **Le JSON plat est sorti** : toutes les clés du format historique sont servies par des tables (collections, cœur, groupes,
  investissements, réglages, cartes, écarts natifs), à travers un mapper par module dans `legacy/store.ts`
  (`ModuleMapper`). L'état « historique » n'est plus qu'une **façade recomposée** (`recompose()`), au format du contrat
  `LEGACY-FORMAT.md`.
- **Deux familles de références** coexistent : `legacy:<clé>:<id>` (fiches des modules repris, identifiants du format historique)
  et `object:<uuid>` (objets GRC natifs, trente-six types, registres, périmètres, droits par ressource).
- **Deux logiques de droits** : les modules repris suivent le droit de module appliqué **clé par clé** (`redactLegacy`,
  `assertLegacyKeys`) ; les objets natifs suivent en plus le périmètre, le registre restreint et le rôle attribué (ADR 0043,
  0067). La porte de lecture (ADR 0083) unifie la lecture de la façade historique ; elle ne supprime pas la dualité.
- **Déjà natifs** : les écarts (`nonconformity`, `legacy_key = findings`), les actions et séries de tâches des registres, le
  catalogue de configuration, les risques et études.

## 2. Problème à résoudre

La dualité impose de maintenir deux modèles, deux jeux de références et deux logiques d'autorisation, de reconvertir les
références à chaque lien transverse (`checkTypedRefs`, `resolve`), et d'éviter qu'une vue lise l'état brut sans le filtrer. Elle
reste justifiée tant que l'**import et l'export au format historique** (invariant d'AGENTS) passent par la façade.

## 3. Cible proposée

Un module repris devient **natif** : ses fiches sont des objets GRC (`object:<uuid>`) rangés dans des registres et des périmètres,
avec les droits par ressource. La façade historique est **conservée en lecture et en écriture d'import/export** par le mapper du
module, qui projette les objets natifs dans le format historique et inversement. Les références `legacy:<clé>:<id>` existantes
restent résolues (alias vers l'objet natif) tant que des données ou des fichiers importés les portent.

Invariants à tenir pour chaque module : import et export au format historique inchangés (test d'aller-retour sur la fixture,
parité avec l'outil historique) ; migration **additive** ; identifiants historiques conservés (`legacy_key`, `legacy_id`) ;
historique et audit conservés ; aucune perte de champ (tests de couverture du contrat).

## 4. Modules concernés (clé historique → équivalent natif probable, à confirmer)

| Module | Clés historiques | Équivalent natif | Remarque |
|---|---|---|---|
| Écarts | `findings` | `nonconformity` | **fait** |
| Plans et séries | `plans`, `recurring` | `action`, `task_series` | en partie natifs (registres) |
| Pilotage | `processes`, `objectives`, `indicators`, `reviews`, `scope`, `interested`, `swots`, `roles`, `evidences` | `process`, `objective`, `indicator`, `management_review`, `context`, `stakeholder`, `swot`, `governance`, `evidence` | plus gros lot, nombreux liens transverses |
| Fournisseurs | `suppliers`, `supEvals` | périmètres de type fournisseur, évaluations | déjà reliés aux périmètres (ADR 0032) |
| Conformité | `frameworks`, `items`, `groups`, `appGaps`, `ai` | `framework`, `requirement`, `measure` | copies de périmètre (ADR 0082) |
| Incidents et crise | `incidents`, `crisis` | `incident`, `continuity_plan`, `continuity_exercise` | RETEX déjà natif (ADR 0080) |
| CRRC, investissements, revues d'accès | `crrc`, `invest`, `accessReviews` | à définir | peu de liens transverses |
| Déclaration d'applicabilité | `dda` | `soa` | règle d'accès décidée (pilotage) |
| Cartes | `maps` | cartes (tables natives) | références `process`, `pi`, `sup`… |
| Réglages | `years`, `plan`, `branding`… | hors périmètre | restent des réglages |

## 5. Ordre proposé (du moins risqué au plus risqué)

1. **Modules à peu de liens transverses** : CRRC, investissements, revues d'accès (valide la méthode sur un module simple).
2. **Incidents et crise** (RETEX natif, périmètre de droits déjà précis).
3. **Fournisseurs** et évaluations.
4. **Pilotage** par sous-ensembles (processus et objectifs, puis indicateurs, puis revue de direction, puis contexte), en
   conservant les alias `legacy:*` pour les liens, preuves et décisions existantes.
5. **Conformité** (cadres, mesures) en dernier : c'est le cœur des évaluations immuables et des rapprochements.

Chaque module = une ADR courte, une migration additive, un mapper, un test d'aller-retour, une PR dédiée.

## 6. Risques

- **Références existantes** : décisions de pilotage, preuves, liens et rapprochements citent des références `legacy:*` ; un alias
  durable est nécessaire, sans réécrire les journaux immuables.
- **Format historique** : l'export doit rester relisible par l'outil historique (schéma 15) ; la fixture et la parité en sont les
  garde-fous.
- **Volume et performances** : la recomposition de la façade pendant la coexistence ; les cibles de volume du dépôt s'appliquent.
- **Droits** : passer d'un droit par clé à un droit par ressource change qui voit quoi ; chaque module doit documenter la
  règle d'accès retenue et la tester (cas administrateur, membre, non-membre, registre restreint, module illisible).

## 7. Décisions attendues du RSSI avant tout code

1. Le principe : poursuivre la sortie du modèle historique module par module (oui / non / à reporter).
2. L'ordre et le premier module (proposition : CRRC, investissements, revues d'accès).
3. Les références `legacy:*` : alias durable ou conversion unique à la migration.
4. La règle d'accès cible par module (par registre et périmètre, ou droit de module conservé).

Rien n'est engagé tant que ces points ne sont pas tranchés.
