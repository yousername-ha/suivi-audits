# ADR 0015 — Audit : cycle, référentiels, couverture, écarts et plan d'audit en tables

**Statut** : proposée (phase 1, exigences `AUD-01` à `AUD-16`). Spécification :
[`docs/audit/SPEC-AUDIT-V3.md`](../audit/SPEC-AUDIT-V3.md) ; recette : [`RECETTE.md`](../audit/RECETTE.md).

## Contexte
Le cœur de l'outil historique (préparation de l'audit, couverture, écarts, plan d'audit) vit dans `app_state.data`
sous forme de listes JSON : un enregistrement modifie tout l'état, la préparation d'un cycle écrase celle du
précédent, le plan d'audit n'est rattaché à aucune année, la clôture d'un écart n'est pas tracée. D'autres modules
encore dans l'outil historique (GAP, exercices, incidents, évaluations fournisseurs, programme d'audit interne)
créent des écarts ou cochent la couverture.

## Décision

### 1. Modèle
- Tables : `audit_cycles`, `requirement_groups`, `requirements`, `requirement_guides`, `requirement_coverage`
  (exigence × année), `requirement_preparation` (exigence × année), `findings`, `finding_requirements`,
  `finding_tasks`, `audit_plans` (une par année), `audit_plan_days`, `audit_plan_slots`, `audit_plan_people`,
  `audit_plan_slot_requirements`, `audit_plan_slot_people`, `audit_plan_proofs`, `audit_plan_questions`.
- Chaque table modifiable porte `version`, `created_at/by`, `updated_at/by`, `legacy_id` et `import_batch_id`
  (annulation d'import) ; déclencheurs de notification (ADR 0005).
- Les référentiels (157 exigences, identifiants du schéma 15) et le guide des preuves et questions types sont chargés
  par migration ; un référentiel nouveau ou révisé s'ajoute par une migration, sans toucher aux données existantes.

### 2. Annualisation
- Couverture, préparation et plan d'audit sont **par année du cycle**. À la reprise, la préparation et le plan
  actuels sont rattachés à l'année `N` (`nextYear`) ; l'export legacy les reconstruit depuis l'année `N`.

### 3. Pronostic
- `analyze` est porté en fonction pure partagée (`packages/shared/src/audit/`) et testé en **parité** avec l'outil
  historique exécuté dans un bac à sable (même méthode que la cartographie, ADR 0013). Le serveur et le navigateur
  utilisent la même fonction.

### 4. Concurrence et règles métier
- `If-Match` par enregistrement (écart, ligne de couverture, créneau…) ; une tâche se modifie avec la version de son
  écart. Les règles (statut ↔ tâches, clôture datée et signée, réouverture avec motif) sont des fonctions pures
  partagées, appliquées par le serveur.

### 5. Transition (ADR 0007)
- Mappers pour les clés reprises ; `/legacy` les affiche en lecture seule.
- **Passerelle d'ajout** : un enregistrement de `/legacy` qui ajoute un écart (identifiant nouveau, préfixe d'un
  module non repris) ou coche la couverture interne depuis le programme d'audit est accepté et converti en
  enregistrements des tables, au nom de la personne et journalisé ; toute autre modification de ces clés reste
  refusée (409). La passerelle disparaît avec la reprise des modules concernés (phases 2 et 3).

### 6. Imports et exports Excel sans dépendance
- Écriture : `apps/api/src/export/tabular.ts` étendu au classeur multi-feuilles.
- Lecture (PRM02, Tenacy) : archive ZIP lue avec `node:zlib`, analyseur SpreadsheetML restreint (chaînes partagées,
  cellules en ligne, nombres, dates), bornes de taille, de nombre de fichiers et de cellules, refus des classeurs
  chiffrés ou à macros. Simulation obligatoire puis application exacte (empreinte du fichier), comme l'import
  legacy.

## Conséquences
- Aucune nouvelle dépendance npm ; aucun nouveau module de droits (75 permissions).
- Les graphiques de la synthèse sont des composants SVG de `packages/ui` (`UI-02`), réutilisés par les modules
  suivants.
- Le diaporama et le document Word des comités restent produits par l'outil historique (à partir de l'état
  recomposé) jusqu'à la phase 4.
