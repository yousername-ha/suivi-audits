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
5. **Premier module : investissements** (`invest_settings`, `invest_lines`, migration 023). Les autres suivront un par un, chacun
   avec sa migration, son mapper, son test de reprise (aller-retour à l'identique) et son test d'API.
6. **Hors périmètre de ce lot** : rattacher ces tables aux objets GRC (écarts, actions, preuves, fournisseurs) par des clés
   étrangères. Les identifiants restent des textes tant que le module cible n'est pas lui-même repris.

## Conséquences

- Les tests qui amorçaient un module par `PUT /api/legacy/state` doivent amorcer via la correspondance du module.
- Retour arrière : les tables sont ignorées par une version antérieure, mais la clé retirée d'`app_state` n'y est plus ;
  restaurer la sauvegarde automatique faite avant la mise à jour.
- Le verrou global d'`app_state` demeure le temps de la transition (il disparaîtra avec le dernier module).
