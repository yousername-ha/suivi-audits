# Correspondance du format legacy vers la base (MAPPING-LEGACY)

**B2a** : les nouvelles définitions d’échelles et matrices vivent dans `environment_versions` et `environment_configuration` (migration 010). Aucun champ legacy n’est déplacé ou supprimé ; les méthodes IA/incidents et les évaluations de `app_state` restent inchangées. La configuration n’est pas ajoutée artificiellement au contrat v2 : le JSON historique garde son aller-retour existant et ne remplace pas ce registre. Sauvegarde/restauration PostgreSQL le conserve. Le futur raccordement des évaluations devra fournir son mapper et une référence de version explicite.

Chaque chemin du contrat (`LEGACY-FORMAT.md`, schéma 14) et chaque identifiant ajouté par le schéma 15 est associé :
- à une **colonne** (`table.colonne`) ;
- à **`extra`** (colonne jsonb de la table métier, pour les champs non modélisés : rien n'est perdu) ;
- ou est marqué **« ignoré »**, avec une justification.

Un test (`packages/shared/test/mapping.test.ts`) échoue si un chemin du contrat n'est pas traité ici, si une ligne « ignoré » n'a pas de justification, ou si une ligne ne correspond plus à aucun chemin du contrat.

## État en phase 0

Un seul module est repris dans des tables dédiées : la **cartographie** (`maps`, tables `maps` et `map_versions`, mapper `apps/api/src/carto/maps.ts`, ADR 0013). **Toutes les autres données legacy sont stockées dans `app_state.data`** (jsonb, versionné dans `state_history`), et `/legacy` les modifie comme avant. Chaque phase (1 à 3) reprend ses modules : elle crée les tables indiquées dans la colonne « Tables prévues », remplace ici `app_state.data` par les colonnes réelles (ou `extra`), ajoute son « mapper » (`apps/api/src/legacy/store.ts`, interface `ModuleMapper`) et son test d'aller-retour, puis le module passe en lecture seule dans `/legacy`.

| Chemin | Cible | Phase de reprise | Tables prévues | Justification |
|---|---|---|---|---|
| `$.v` | app_state.data | — | — | Version du format (toujours 1), contrôlée à chaque enregistrement depuis /legacy. |
| `$.updatedAt` | app_state.data | — | — | Horodatage propre à l'outil historique, conservé tel quel. |
| `$.years` | app_state.data | 1 | audit_cycles |  |
| `$.years[]` | app_state.data | 1 | audit_cycles |  |
| `$.yearLabels` | app_state.data | 1 | audit_cycles.label |  |
| `$.yearLabels.{clé}` | app_state.data | 1 | audit_cycles.label |  |
| `$.nextYear` | app_state.data | 1 | audit_cycles |  |
| `$.nextDate` | app_state.data | 1 | audit_cycles |  |
| `$.internalDate` | app_state.data | 1 | audit_cycles |  |
| `$.groups` | app_state.data | 1 | requirement_groups |  |
| `$.groups[]` | app_state.data | 1 | requirement_groups |  |
| `$.groups[].id` | app_state.data | 1 | requirement_groups |  |
| `$.groups[].ref` | app_state.data | 1 | requirement_groups |  |
| `$.groups[].num` | app_state.data | 1 | requirement_groups |  |
| `$.groups[].title` | app_state.data | 1 | requirement_groups |  |
| `$.items` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[]` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].id` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].ref` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].num` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].title` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].group` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].depth` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].afnor` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].afnor.2025` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].afnor.2026` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].afnor.2027` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].interne` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].interne.2025` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].interne.2026` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].interne.2027` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].prep` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].owner` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].notes` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].remInterne` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.items[].remAfnor` | app_state.data | 1 | requirements, requirement_coverage |  |
| `$.findings` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[]` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].id` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].source` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].year` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].type` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].status` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].text` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].desc` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].action` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].tasks` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].tasks[]` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].tasks[].t` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].tasks[].done` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].comment` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].items` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].items[]` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].owner` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].due` | app_state.data | 1 | findings, finding_tasks |  |
| `$.findings[].proof` | app_state.data | 1 | findings, finding_tasks |  |
| `$.source` | app_state.data | 1 | settings |  |
| `$.closeDeadline` | app_state.data | 1 | settings |  |
| `$.findingsRev` | app_state.data | 1 | findings (version) |  |
| `$.dda` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.app` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.just` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.risk` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.level` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.actions` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.docs` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.comment` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.obj` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.req` | app_state.data | 2 | soa_entries |  |
| `$.dda.{clé}.url` | app_state.data | 2 | soa_entries |  |
| `$.processes` | app_state.data | 2 | processes |  |
| `$.processes[]` | app_state.data | 2 | processes |  |
| `$.processes[].id` | app_state.data | 2 | processes |  |
| `$.processes[].name` | app_state.data | 2 | processes |  |
| `$.processes[].owner` | app_state.data | 2 | processes |  |
| `$.processes[].family` | app_state.data | 2 | processes |  |
| `$.processes[].indicators` | app_state.data | 2 | processes |  |
| `$.processes[].parent` | app_state.data | 2 | processes |  |
| `$.objectives` | app_state.data | 2 | objectives |  |
| `$.objectives[]` | app_state.data | 2 | objectives |  |
| `$.objectives[].id` | app_state.data | 2 | objectives |  |
| `$.objectives[].name` | app_state.data | 2 | objectives |  |
| `$.objectives[].due` | app_state.data | 2 | objectives |  |
| `$.objectives[].owner` | app_state.data | 2 | objectives |  |
| `$.objectives[].processes` | app_state.data | 2 | objectives |  |
| `$.objectives[].processes[]` | app_state.data | 2 | objectives |  |
| `$.objectives[].enjeux` | app_state.data | 2 | objectives |  |
| `$.objectives[].enjeux[]` | app_state.data | 2 | objectives |  |
| `$.indicators` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[]` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].id` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].name` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].obj` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].target` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].action` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].lastReview` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].due` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].owner` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].values` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].values[]` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].values[].date` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].values[].v` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].values[].note` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].values[].hist` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].dir` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].freq` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].calc` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].auto` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].actionOwner` | app_state.data | 2 | indicators, indicator_values |  |
| `$.indicators[].actionDue` | app_state.data | 2 | indicators, indicator_values |  |
| `$.suppliers` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[]` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].id` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].name` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].rattachement` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].saas` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].sso` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].mfa` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].critical` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].hds` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].contact` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].lastReview` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].notes` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[]` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].id` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].t` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].ref` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].freq` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].last` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].result` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].comment` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].certs` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].createdAt` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.suppliers[].controls[].createdAt` | app_state.data | 2 | suppliers, supplier_controls |  |
| `$.frameworks` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[]` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].id` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].name` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].version` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].source` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].scopeMode` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[]` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].id` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].os` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].objective` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].theme` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].scope` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].text` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].maps` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].self` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].requirements[].comment` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.title` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.statement` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.prevaloir` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.iso` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.qualified` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.nis2` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.nis2[]` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.pillar` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.prevaloir[]` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.frameworks[].objectives.{clé}.qualified[]` | app_state.data | 3 | frameworks, framework_requirements |  |
| `$.ai` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.context` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[]` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].id` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].usecase` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].owner` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].role` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].type` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].provider` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].purpose` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].dscp` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].data` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].hdsAct` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].hdsCert` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].storage` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].remote` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].training` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].aiact` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].dm` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].human` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].aipd` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].authz` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].golive` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].proof` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].category` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.register[].aiPresence` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[]` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].id` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].domain` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].scenario` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].app` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].dscp` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].c` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].i` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].a` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].audit` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].patient` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].prob` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].maturity` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].effort` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].iso` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].hds` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].measure` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].scope` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.evals[].status` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[]` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].step` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].phase` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].action` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].result` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].owner` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].contrib` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].iso` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].hds` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].proof` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].kpi` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].jStart` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].jEnd` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].priority` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].status` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].progress` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].dep` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.plan[].evals` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[]` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].policy` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].impact` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].change` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].iso` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].annex` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].hds` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].evals` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].steps` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].owner` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].target` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].freq` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].proof` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.policies[].status` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.start` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[]` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[].id` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[].name` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[].version` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[].use` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[].url` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[].checked` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.sources[].note` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.ai.startValidated` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies |  |
| `$.activeFw` | app_state.data | 3 | settings |  |
| `$.entityCategory` | app_state.data | 3 | settings |  |
| `$.schema` | app_state.data | — | — | Version du schéma : portée à 15 par la migration du schéma 15 (import et export). |
| `$.iso27001Certified` | app_state.data | 1 | settings |  |
| `$.accessReviews` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[]` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[].id` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[].app` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[].month` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[].supplier` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[].freq` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[].source` | app_state.data | 2 | access_reviews |  |
| `$.accessReviews[].comment` | app_state.data | 2 | access_reviews |  |
| `$.plan` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.status` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.note` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.days` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.days[]` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.days[].id` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.days[].label` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.days[].date` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[]` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].id` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].day` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].start` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].end` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].type` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].title` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].detail` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].place` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].items` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].people` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].people[]` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].proofs` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].questions` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].items[]` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].proofs[]` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].proofs[].t` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].proofs[].done` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.slots[].questions[]` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.people` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.people[]` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.people[].id` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.people[].name` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.plan.people[].role` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people |  |
| `$.appGaps` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[]` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].id` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].createdAt` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].name` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].supplier` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].dscp` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].cloud` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].status` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].owner` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].target` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].desc` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].lines` | app_state.data | 3 | app_gap_analyses |  |
| `$.appGaps[].custom` | app_state.data | 3 | app_gap_analyses |  |
| `$.reviews` | app_state.data | 2 | management_reviews |  |
| `$.reviews[]` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].id` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].type` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].createdAt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].date` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].title` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].period` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].participants` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].classification` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].sections` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].sections[]` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].inputs` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].decisions` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.open` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.closed` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.total` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.focus` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.focus[]` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.focus[].name` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.focus[].date` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.focus[].time` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.inc.focus[].desc` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.tenable` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.tenable.kpi` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.tenable.txt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.tenable.img` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.ext` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.ext.kpi` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.ext.txt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.ext.img` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.def` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.def.kpi` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.def.txt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.vul.def.img` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.cont` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.cont.kpi` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.cont.txt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.cont.img` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.dispo` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.dispo.kpi` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.dispo.txt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.dispo.img` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.sensi` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.sensi.kpi` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.sensi.txt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.sensi.img` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rc.acces` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.risks` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.withEcarts` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.nr` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.nr.chg` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.nr.vul` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.nr.inc` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.nr.nc` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.sujet` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.sujet[]` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.sujet[].title` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.sujet[].txt` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.sujet[].img` | app_state.data | 2 | management_reviews |  |
| `$.reviews[].cs.rem` | app_state.data | 2 | management_reviews |  |
| `$.branding` | app_state.data | 4 | settings |  |
| `$.plans` | app_state.data | 2 | action_plans |  |
| `$.scope` | app_state.data | 2 | settings |  |
| `$.scope.hds` | app_state.data | 2 | settings |  |
| `$.scope.excl` | app_state.data | 2 | settings |  |
| `$.scope.processes` | app_state.data | 2 | settings |  |
| `$.interested` | app_state.data | 2 | interested_parties |  |
| `$.swots` | app_state.data | 2 | swot_analyses |  |
| `$.swots[]` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].id` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].createdAt` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].process` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].date` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].author` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].version` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].S` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].W` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].O` | app_state.data | 2 | swot_analyses |  |
| `$.swots[].T` | app_state.data | 2 | swot_analyses |  |
| `$.incidents` | app_state.data | 3 | incidents |  |
| `$.supEvals` | app_state.data | 2 | supplier_evaluations |  |
| `$.crisis` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.contacts` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.scenarios` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[]` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].id` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].createdAt` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].title` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].mode` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].scenario` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].plan` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].start` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].end` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].status` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].log` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].log[]` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].log[].ts` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].log[].type` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].log[].author` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].log[].text` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].checks` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.crisis.cells[].deadlines` | app_state.data | 3 | crisis_cells, crisis_log |  |
| `$.roles` | app_state.data | 2 | isms_roles |  |
| `$.roles[]` | app_state.data | 2 | isms_roles |  |
| `$.roles[].createdAt` | app_state.data | 2 | isms_roles |  |
| `$.roles[].name` | app_state.data | 2 | isms_roles |  |
| `$.roles[].holder` | app_state.data | 2 | isms_roles |  |
| `$.roles[].deputy` | app_state.data | 2 | isms_roles |  |
| `$.roles[].email` | app_state.data | 2 | isms_roles |  |
| `$.roles[].phone` | app_state.data | 2 | isms_roles |  |
| `$.roles[].resp` | app_state.data | 2 | isms_roles |  |
| `$.roles[].refs` | app_state.data | 2 | isms_roles |  |
| `$.recurring` | app_state.data | 2 | recurring_tasks |  |
| `$.evidences` | app_state.data | 2 | evidences |  |
| `$.invest` | app_state.data | 3 | investments |  |
| `$.invest.baseYear` | app_state.data | 3 | investments |  |
| `$.invest.lines` | app_state.data | 3 | investments |  |
| `$.invest.lines[]` | app_state.data | 3 | investments |  |
| `$.invest.lines[].id` | app_state.data | 3 | investments |  |
| `$.invest.lines[].createdAt` | app_state.data | 3 | investments |  |
| `$.invest.lines[].company` | app_state.data | 3 | investments |  |
| `$.invest.lines[].priority` | app_state.data | 3 | investments |  |
| `$.invest.lines[].type` | app_state.data | 3 | investments |  |
| `$.invest.lines[].desc` | app_state.data | 3 | investments |  |
| `$.invest.lines[].n0` | app_state.data | 3 | investments |  |
| `$.invest.lines[].n1` | app_state.data | 3 | investments |  |
| `$.invest.lines[].n2` | app_state.data | 3 | investments |  |
| `$.invest.lines[].comment` | app_state.data | 3 | investments |  |
| `$.invest.lines[].alt` | app_state.data | 3 | investments |  |
| `$.invest.lines[].account` | app_state.data | 3 | investments |  |
| `$.invest.lines[].perimeter` | app_state.data | 3 | investments |  |
| `$.invest.lines[].status` | app_state.data | 3 | investments |  |
| `$.invest.lines[].nature` | app_state.data | 3 | investments |  |
| `$.invest.lines[].renewal` | app_state.data | 3 | investments |  |
| `$.invest.lines[].notice` | app_state.data | 3 | investments |  |
| `$.invest.lines[].supplier` | app_state.data | 3 | investments |  |
| `$.invest.source` | app_state.data | 3 | investments |  |
| `$.crrc` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[]` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].id` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].name` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].status` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].partner` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].desc` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].perimeters` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].perimeters[]` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].perimeters[][]` | app_state.data | 3 | crrc_* |  |
| `$.crrc.offers[].perimeters[][][]` | app_state.data | 3 | crrc_* |  |
| `$.crrc.establishments` | app_state.data | 3 | crrc_* |  |
| `$.crrc.resources` | app_state.data | 3 | crrc_* |  |
| `$.crrc.runs` | app_state.data | 3 | crrc_* |  |
| `$.crrc.restores` | app_state.data | 3 | crrc_* |  |
| `$.crrc.alerts` | app_state.data | 3 | crrc_* |  |
| `$.findings[].tasks[].id` | app_state.data | 1 | findings, finding_tasks | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.indicators[].values[].id` | app_state.data | 2 | indicators, indicator_values | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.ai.plan[].id` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.ai.policies[].id` | app_state.data | 3 | ai_systems, ai_evaluations, ai_actions, ai_policies | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.plan.slots[].proofs[].id` | app_state.data | 1 | audit_plan_days, audit_plan_slots, audit_plan_people | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.reviews[].cs.inc.focus[].id` | app_state.data | 2 | management_reviews | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.reviews[].cs.sujet[].id` | app_state.data | 2 | management_reviews | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.crisis.cells[].log[].id` | app_state.data | 3 | crisis_cells, crisis_log | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.roles[].id` | app_state.data | 2 | isms_roles | Identifiant stable ajouté par le schéma 15 (clé de correspondance legacy_id lors de la reprise). |
| `$.maps` | maps.view | 2 | maps, map_versions | Module repris (mapper « maps », ADR 0013) : une ligne par vue. |
| `$.maps.context` | maps.view | 2 | maps, map_versions | |
| `$.maps.context.nodes` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.nodes.{clé}` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.nodes.{clé}.x` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.nodes.{clé}.y` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.nodes.{clé}.w` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.nodes.{clé}.h` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.nodes.{clé}.label` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.nodes.{clé}.hidden` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.edges` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.edges[]` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.edges[].id` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.edges[].s` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.edges[].t` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.edges[].type` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.edges[].gen` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.hide` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.hide.{clé}` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.ignored` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.ignored.{clé}` | maps.layout | 2 | maps, map_versions | |
| `$.maps.context.versions` | map_versions.map_id | 2 | maps, map_versions | Une ligne par version (20 au plus). |
| `$.maps.context.versions[]` | map_versions.map_id | 2 | maps, map_versions | Une ligne par version (20 au plus). |
| `$.maps.context.versions[].id` | map_versions.extra | 2 | maps, map_versions | Identifiant et date d’origine (aller-retour exact). |
| `$.maps.context.versions[].at` | map_versions.extra | 2 | maps, map_versions | Identifiant et date d’origine (aller-retour exact). |
| `$.maps.context.versions[].label` | map_versions.label | 2 | maps, map_versions | |
| `$.maps.context.versions[].map` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes.{clé}` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes.{clé}.x` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes.{clé}.y` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes.{clé}.w` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes.{clé}.h` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes.{clé}.label` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.nodes.{clé}.hidden` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.edges` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.edges[]` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.edges[].id` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.edges[].s` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.edges[].t` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.edges[].type` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.edges[].gen` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.hide` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.hide.{clé}` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.ignored` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.versions[].map.ignored.{clé}` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.context.updatedAt` | maps.extra | 2 | maps, map_versions | Date propre à l’outil historique ; mise à jour à chaque enregistrement. |
| `$.maps.process` | maps.view | 2 | maps, map_versions | |
| `$.maps.process.nodes` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.nodes.{clé}` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.nodes.{clé}.x` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.nodes.{clé}.y` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.nodes.{clé}.w` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.nodes.{clé}.h` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.nodes.{clé}.label` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.nodes.{clé}.hidden` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.edges` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.edges[]` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.edges[].id` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.edges[].s` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.edges[].t` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.edges[].type` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.edges[].gen` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.hide` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.hide.{clé}` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.ignored` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.ignored.{clé}` | maps.layout | 2 | maps, map_versions | |
| `$.maps.process.versions` | map_versions.map_id | 2 | maps, map_versions | Une ligne par version (20 au plus). |
| `$.maps.process.versions[]` | map_versions.map_id | 2 | maps, map_versions | Une ligne par version (20 au plus). |
| `$.maps.process.versions[].id` | map_versions.extra | 2 | maps, map_versions | Identifiant et date d’origine (aller-retour exact). |
| `$.maps.process.versions[].at` | map_versions.extra | 2 | maps, map_versions | Identifiant et date d’origine (aller-retour exact). |
| `$.maps.process.versions[].label` | map_versions.label | 2 | maps, map_versions | |
| `$.maps.process.versions[].map` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes.{clé}` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes.{clé}.x` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes.{clé}.y` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes.{clé}.w` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes.{clé}.h` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes.{clé}.label` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.nodes.{clé}.hidden` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.edges` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.edges[]` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.edges[].id` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.edges[].s` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.edges[].t` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.edges[].type` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.edges[].gen` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.hide` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.hide.{clé}` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.ignored` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.versions[].map.ignored.{clé}` | map_versions.layout | 2 | maps, map_versions | |
| `$.maps.process.updatedAt` | maps.extra | 2 | maps, map_versions | Date propre à l’outil historique ; mise à jour à chaque enregistrement. |
| `$.maps.issueKind` | maps.settings | 2 | maps, map_versions | Nature des enjeux corrigée, dans les réglages de la carte de contexte (CARTO-12). |
| `$.maps.issueKind.{clé}` | maps.settings | 2 | maps, map_versions | Nature des enjeux corrigée, dans les réglages de la carte de contexte (CARTO-12). |
