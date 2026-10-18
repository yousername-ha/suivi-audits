# ADR 0039 — Hiérarchie des périmètres et héritage explicite des référentiels

**Statut** : proposée le 18/10/2026 (lot H1). Prolonge les [ADR 0030](0030-perimetre-agnostique-qualite-fournisseurs.md) (périmètres de
management) et [0031](0031-bibliotheque-de-referentiels.md) (bibliothèque de référentiels).

## Contexte

Un périmètre (`grc_smsis`) était à plat : une organisation multi-entités (groupe, établissements, services) ne pouvait ni
exprimer ses rattachements, ni appliquer un référentiel une fois pour toutes ses entités. Chaque référentiel devait être
rattaché périmètre par périmètre.

## Décision

1. **Parent/enfant sur le périmètre existant** : colonnes additives `parent_id`, `entity_kind` (`organisation`, `entite`,
   `perimetre`, simple étiquette de structure) et `inherit_frameworks` (faux par défaut). Pas de nouvelle table d'entités :
   le périmètre reste l'unité de partitionnement des droits, des objets et des liens.
2. **Pas de cycle, profondeur bornée** : contrôle applicatif lisible (422, logique pure partagée avec l'interface) **et**
   déclencheur en base (garde-fou si une écriture contourne l'API). Profondeur maximale 8, simple garde-fou.
3. **Héritage explicite, jamais implicite** : un périmètre reçoit les référentiels de son parent uniquement si
   `inherit_frameworks` est vrai, et la chaîne s'arrête au premier périmètre qui ne l'ouvre pas. Un rattachement local, actif
   ou désactivé, l'emporte sur celui d'un ancêtre pour le même référentiel (le plus proche gagne) : on désactive un
   référentiel hérité en le rattachant localement, désactivé.
4. **Ce qui est hérité** : les référentiels *rattachés* (exigences proposées comme cibles de lien, couverture, propositions de
   rapprochement). **Rien d'autre** : objets, preuves, évaluations, droits et membres ne se propagent pas. Les évaluations d'un
   enfant restent les siennes ; une preuve partagée n'est pas réputée suffisante pour une autre entité.
5. **Droits inchangés** : créer ou rattacher exige `pilotage:administrer` et l'accès en écriture au parent. Un parent restreint
   non accessible n'expose pas son nom (le référentiel hérité s'affiche « hérité d'un périmètre parent non accessible »).
6. **Recalcul** : quand un rattachement, un lien d'héritage ou une correspondance change, les périmètres héritiers sont
   resynchronisés dans la même transaction.
7. **Migration additive** (022) ; les périmètres existants restent à plat et n'héritent de rien. Retour arrière : colonnes
   ignorées par une version antérieure.

## Conséquences

- Le calcul des référentiels effectifs existe en SQL (récursif) et en logique pure (tests croisés, même résultat).
- Hors périmètre de ce lot : organigramme graphique, transfert de preuves entre entités, héritage des mesures ou des risques.
  Ils feront l'objet de décisions séparées.
