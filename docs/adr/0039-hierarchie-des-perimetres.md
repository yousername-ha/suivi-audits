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

## Amendement du 01/11/2026 — un périmètre est une organisation ou un fournisseur

Demandes et choix du RSSI du 01/11/2026 : les trois étiquettes de structure du point 1 (`organisation`, `entite`, `perimetre`)
ne correspondaient pas à la réalité. **Un périmètre est une organisation ou un fournisseur, rien d'autre.**

1. `entity_kind` ne prend plus que `organisation` (valeur par défaut) ou `fournisseur`. Migration `051` : les périmètres
   existants marqués `entite` ou `perimetre` deviennent `organisation` ; aucune ligne supprimée, la contrainte est remplacée.
   L'API refuse les anciennes valeurs (422).
2. **Rattachement** : mêmes règles qu'au point 2 (pas de boucle, profondeur 8), mêmes droits, même héritage explicite des
   référentiels. Exemple : l'organisation A a pour enfants les organisations B et C et le fournisseur F. **Seule règle
   ajoutée : un fournisseur n'a pour enfants que des fournisseurs** (ses sous-traitants), jamais une organisation. Contrôle
   applicatif lisible (422, logique pure partagée avec l'interface) et déclencheur en base `grc_smsis_types_rattachement`.
   Un périmètre qui a des organisations enfants ne peut donc pas devenir un fournisseur.
3. **Fiche du registre** : un périmètre fournisseur peut être relié à sa fiche du registre des fournisseurs (ADR 0032) par la
   colonne `supplier_id` (identifiant historique, comme `sup_scope_links`). Facultatif, réservé au type fournisseur
   (contrainte `grc_smsis_fiche_fournisseur`), une fiche reliée à un seul périmètre (index unique ; 409 sinon, sans révéler
   le nom de l'autre périmètre). Relier une fiche exige `fournisseurs:lire` et une fiche présente au registre. Un périmètre
   qui redevient une organisation est délié. Dans le graphe, une fiche reliée n'apparaît plus comme « Fournisseur
   extérieur » : elle est représentée par son périmètre.
4. **Criticité** : elle reste une donnée de la fiche du registre (champ `critical`, seule source), désormais cochable dans
   la fiche (« Fournisseur critique »). Le périmètre relié l'affiche (« Fournisseur critique » dans la liste, « Critique »
   sur la carte du graphe) sans la recopier.
5. **Nature retirée de l'écran** : la nature (SMSI, SMQ, SMI…, ADR 0030) n'a pas de sens pour un périmètre, un SMSI ou un
   SMQ étant l'ensemble des éléments qui le constituent. Elle n'est plus proposée ni affichée ; la colonne reste en base,
   la valeur enregistrée est conservée (une modification qui ne la précise pas la laisse inchangée).
6. Le type ne change ni les droits, ni les compteurs, ni les objets du périmètre.
7. Retour arrière : une version antérieure lit `organisation` mais pas `fournisseur` ; il passe par la restauration de la
   sauvegarde prise avant la mise à jour.

## Amendement du 13/11/2026 — les membres descendent aux périmètres enfants

Le point 4 (« droits et membres ne se propagent pas ») ne vaut plus pour les membres : l'accès donné sur un périmètre vaut pour
ses descendants ([ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md), lot 1). Objets, preuves, évaluations et
référentiels gardent les règles ci-dessus.
