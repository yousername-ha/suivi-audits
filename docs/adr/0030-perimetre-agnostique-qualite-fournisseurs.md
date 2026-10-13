# ADR 0030 — Périmètres gérés à part, groupe « Qualité » et fournisseurs transverses du Pilotage

**Statut** : proposée le 13/10/2026, après les décisions D1 à D13 du RSSI (voir le
[cadrage](../unification/CADRAGE-MODULE-QUALITE-9001.md), §1 bis). Aucun code n'est écrit. Cette ADR fixe l'orientation des
lots M1 (page « Périmètres ») et M4 (fournisseurs) ; la bibliothèque de référentiels (M2 et M3) a la sienne : [ADR 0031](0031-bibliotheque-de-referentiels.md).

## Contexte

Le RSSI veut ajouter un volet qualité fondé sur l'ISO 9001:2015 (texte fourni, aucun passage reproduit ici) à côté de
l'ISO/IEC 27001:2022 et de l'HDS. Il demande :

- une solution **agnostique au démarrage** : si le système de management qualité et le SMSI ont le même périmètre, ils le
  partagent au sein d'un système de management intégré (SMI) ;
- une **gestion des périmètres à part**, à laquelle on attache un référentiel, une méthode de risque, etc., pour créer un
  SMSI, un SMQ ou un SMI ;
- une **gestion des fournisseurs à part** : un fournisseur évalué peut être rattaché à plusieurs périmètres et **son
  évaluation ne change pas selon le périmètre** ; pas de grille d'évaluation pour le moment.

Constats de lecture du code (état `78ba57e`) :

- un périmètre est une ligne de `grc_smsis` ; l'API liste et crée (`/api/grc/smsis`), l'interface web ne fait que lire ;
- chaque objet du registre commun (dont `control`, `action`, `task_series`) porte un périmètre **obligatoire**
  (`grc_objects.smsi_id`) ; les référentiels sont **publiés dans chaque périmètre** (`frameworks.publish`, versions et
  correspondances par périmètre) ;
- le registre des fournisseurs existe dans l'outil historique, **à l'échelle de l'instance** ; le registre commun résout déjà
  ses références et le Pilotage sait afficher et modifier une donnée historique sans la copier (DdA, FCT-030) ;
- le module de droits `fournisseurs` existe.

## Décision

1. **Page « Périmètres »** au niveau de l'organisation (lot M1, droit `pilotage:administrer`, décision D12) : créer et modifier un périmètre, lui donner une **nature**
   libre (SMSI, SMQ, SMI, autre : une étiquette, sans règle de comportement) et lui rattacher méthode de risque, politique
   métier et membres (déjà existants), puis référentiels et fournisseurs. Aucun référentiel ni aucune nature n'est requis au
   démarrage ; une vue propre à un référentiel n'apparaît que s'il est rattaché au périmètre courant.
2. **Le SMI n'est pas un nouvel objet** : c'est un périmètre où plusieurs référentiels sont rattachés ; un SMQ et un SMSI
   distincts sont deux périmètres.
3. **Groupe « Qualité » dans le Pilotage, sans nouveau module de droits** ; un module `qualite` pourra être ajouté plus tard
   sans migration de données.
4. **Fournisseurs et évaluations au niveau de l'organisation**, hors périmètre : registre historique présenté par adaptateur
   (sans copie), sur le module de droits `fournisseurs` existant ; critères et **évaluations immuables et datées** dans une
   structure propre **sans périmètre** (migration additive) ; rattachement fournisseur ↔ périmètres (plusieurs à la fois) sans
   donnée d'évaluation. Un périmètre lit l'évaluation, il n'en détient pas de copie.
5. **Critères reliés aux exigences** par (référentiel, édition, identifiant d'exigence), sans dépendre d'un périmètre ; un
   périmètre n'affiche que les critères reliés aux référentiels qui lui sont rattachés.
6. **Aucune grille d'évaluation n'est livrée** : aucun critère, fréquence ou seuil par défaut ; l'organisme les saisit.
7. **Les référentiels sont des publications importées, livrées vides, sans texte normatif** ; l'édition est une donnée de la
   publication, jamais une constante du code, ce qui absorbera l'édition 2026 de l'ISO 9001 sans refonte. Aucune
   correspondance entre référentiels n'est livrée : elles sont rédigées et validées par le RSSI.
8. **Granularité des exigences 9001** : article et alinéas énumérés. **PESTEL** ajouté comme nomenclature organisationnelle,
   avec la mention que la norme ne l'exige pas.

## Conséquences

- **Migration additive** (lot M4) : tables des critères, des évaluations et des rattachements, sans `smsi_id` pour les deux
  premières ; rien n'est supprimé ni copié. Cela remplace ma première proposition (critères en plan de contrôle, sans
  migration), incompatible avec une évaluation hors périmètre.
- **Écarts, actions et rappels** nés d'une évaluation sont des objets de périmètre : le périmètre est choisi à la création,
  par défaut le périmètre courant, et l'objet garde un lien vers l'évaluation (décision D11).
- **Bibliothèque de référentiels au niveau organisation** (décision D10, le « cœur » du chantier) : décidée ; elle est traitée
  par l'[ADR 0031](0031-bibliotheque-de-referentiels.md) et les lots M2 et M3, **avant** les fournisseurs, dont les critères
  désignent leurs exigences dans la bibliothèque. D'ici là, l'import par périmètre actuel fonctionne sans changement.
- Le libellé « SMSI » du conteneur devient neutre dans l'interface avec le design ; les noms techniques (`grc_smsis`,
  `/api/grc/smsis`) ne changent pas.
- **Non traité ici** : opportunités de 6.1 (Q8, ouverte). La révision 2026 n'est pas attendue (D9) et le style graphique est
  fourni ensuite (D13).
- Les états « existant » ci-dessus sont des constats de lecture, vérifiés lot par lot par des tests ; ils ne prouvent ni la
  conformité à l'ISO 9001 ni à aucun autre référentiel.
- Retour arrière par lot : M1 supprime la page sans toucher aux périmètres ; M4 supprime les nouvelles tables et l'adaptateur,
  le registre historique n'ayant pas été copié, aucune donnée de fournisseur n'est à restaurer (les évaluations saisies
  seraient perdues, d'où une sauvegarde avant mise à jour, déjà automatique).
