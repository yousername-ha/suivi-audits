# ADR 0040 — Sortie du JSON plat : modules de l'outil de suivi repris en tables

**Statut** : proposée le 18/10/2026 (lot H2). Prolonge l'[ADR 0007](0007-transition-legacy.md) (modules repris,
un seul propriétaire par donnée) et la décision de direction du 18/10/2026 : plus d’état historique plat
ni de fichier zip comme source de vérité.

## Contexte

Quatorze modules natifs (plans, audit, revues des accès, GAP, IA, investissements, CRRC, incidents, crise, DdA…) lisent et
écrivent des clés de l'état historique `app_state`, un document JSON unique verrouillé en bloc. Seule la cartographie vit en
tables. Conséquences : verrou global, aucune contrainte d'intégrité, aucune requête relationnelle, dépendance au format zip.

## Décision

1. **Un module à la fois, sans réécrire les services.** Le mécanisme existant `ModuleMapper` (lecture : recomposer la forme
   historique depuis les tables ; écriture : enregistrer la forme historique dans les tables) est étendu à l'écriture native :
   `LegacyStore.nativeWrite` enregistre dans les tables les clés des modules repris dont la valeur change, et le reste dans
   `app_state`. Les services natifs existants (`RegistreHistorique.modifier`…) n'ont pas à changer.
2. **/legacy et l'export zip deviennent des vues** recomposées, en lecture seule pour les modules repris (comportement déjà en
   place, « Module géré dans la nouvelle interface »). Le fichier zip n'est plus une source : il reste un import/export de
   compatibilité jusqu'à son retrait, décidé séparément.
3. **Des tables typées, pas un document** : une table de réglages et une table de lignes par module, colonnes pour tout champ
   que l'écran lit ou filtre, `extra jsonb` pour les champs inconnus afin que l'aller-retour ne perde rien (même principe que
   `maps`). L'ordre d'origine est conservé (`position`), les entrées atypiques aussi.
4. **Migration SQL de reprise, non destructive** : la migration copie la clé d'`app_state` dans les tables ; la clé reste en
   place dans `app_state` jusqu'au prochain enregistrement, puis en est retirée. Les snapshots de `state_history` et la
   sauvegarde automatique avant mise à jour permettent le retour arrière. Une base sans la clé n'est pas modifiée.
5. **Collections génériques** (lot H2b, migration 024) : une même correspondance sans perte (`collection.ts`) range une clé tableau
   dans une table à colonnes typées nullables : NULL = champ absent, `extra` = champs inconnus ou de type inattendu, entrée non
   objet conservée telle quelle, ordre conservé, clé vide mais présente mémorisée (`suivi_presence`). Premières clés reprises :
   `incidents`, `plans`, `accessReviews`, `appGaps`, `supEvals`. Un test compare la copie SQL de la migration et l'écriture par
   la correspondance : elles doivent produire la même valeur.
6. **Cœur de l'outil de suivi** (lot H2d, migration 026) : mesures et chapitres, écarts, processus, objectifs, indicateurs,
   fournisseurs, référentiels complémentaires, revues, parties intéressées, SWOT, rôles, tâches récurrentes et preuves passent
   par la même correspondance générique. Les réglages scalaires ou objets (années du cycle, dates d'audit, plan d'audit,
   périmètre, catégorie d'entité…) sont une ligne par clé dans `suivi_reglages`, lue en une seule requête. **`app_state` ne
   contient plus aucune donnée métier** : il ne garde que la version de l'état (concurrence optimiste, verrou) en attendant
   le retrait de l'ancienne interface.
   Limites assumées : les sous-structures (étapes du plan d'audit, valeurs d'indicateurs, tâches d'un écart…) restent des
   colonnes JSON dans leur ligne ; les normaliser en tables liées est l'étape suivante, module par module.
7. **Premier module : investissements** (`invest_settings`, `invest_lines`, migration 023). Les autres suivront un par un, chacun
   avec sa migration, son mapper, son test de reprise (aller-retour à l'identique) et son test d'API.
8. **Aucune copie dans `app_state`, quel que soit l'appelant** : `LegacyStore.save` retire les clés des modules repris ; la
   restauration d'une version, l'amorçage, la cartographie et le jeu de test écrivent par `nativeWrite`.
9. **Hors périmètre de ce lot** : rattacher ces tables aux objets GRC (écarts, actions, preuves, fournisseurs) par des clés
   étrangères. Les identifiants restent des textes tant que le module cible n'est pas lui-même repris. Les dates restent des textes
   (valeurs historiques parfois invalides) jusqu'à la normalisation de chaque module.

10. **Sous-listes en tables liées** (lot H2f, migration 028) : une colonne `json` d'une collection peut déclarer `enfants`, une
   table liée par `parent_seq` (clé étrangère, suppression en cascade) avec les mêmes règles que les collections : colonnes
   typées nullables, `extra`, entrée non objet conservée (`extra.brut`), ordre (`position`). Une liste non vide est rangée dans la
   table liée et la colonne du parent reste NULL ; une liste vide, ou une valeur d'un autre type, reste dans la colonne du parent ;
   à la lecture, les lignes liées l'emportent, sinon la colonne. Les sous-listes peuvent à leur tour porter des sous-listes
   (lecture et écriture récursives). Premières reprises : tâches d'un écart (`suivi_ecarts_taches`) et valeurs d'un indicateur
   (`suivi_indicateurs_valeurs`). La migration copie sans toucher aux colonnes d'origine ; une version antérieure qui réécrit la
   table parente supprime les lignes liées par cascade, donc ne lit jamais de lignes obsolètes. Un test compare la copie SQL et
   l'écriture par la correspondance sur des données atypiques (`reprise-sous-listes.test.ts`).

## Conséquences

- Les tests qui amorçaient un module par `PUT /api/legacy/state` doivent amorcer via la correspondance du module.
- Retour arrière : les tables sont ignorées par une version antérieure, mais la clé retirée d'`app_state` n'y est plus ;
  restaurer la sauvegarde automatique faite avant la mise à jour.
- Le verrou global d'`app_state` demeure le temps de la transition (il disparaîtra avec le dernier module).
