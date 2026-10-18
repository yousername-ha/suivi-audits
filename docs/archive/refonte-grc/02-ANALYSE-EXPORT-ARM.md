# Analyse de l'archive « Export ARM.zip » (ateliers 1 et 2)

Statut : analyse du 14/10/2026. Cette analyse porte sur **les structures, colonnes, relations et règles** de l'export.
**Les contenus propres à l'organisation (noms de missions, d'événements redoutés, de responsables, de biens, textes de
cadrage) ne sont pas reproduits** : le dépôt est public et ne contient aucune donnée réelle. Les exemples ci-dessous sont
génériques. L'archive décrit une partie du fonctionnement d'un outil EBIOS RM (ateliers 1 et 2) ; elle ne représente pas
l'ensemble de l'outil ni de la présente plateforme.

## 1. Contenu de l'archive

23 classeurs (une feuille chacun), 3 images et un fichier système (`Thumbs.db`, ignoré).

| Atelier | Fichier (type) | Lignes | Colonnes |
| --- | --- | --- | --- |
| 1 | Définir le cadre de l'étude | 1 | nom, objet, objectifs, confidentialité, langue, durée des cycles stratégiques, durée des cycles opérationnels, contraintes |
| 1 | Identifier les missions et l'objet de l'étude | 9 missions (cellules fusionnées) | mission → valeurs métier (nom, nature, propriétaires) → biens supports (nom, catégories, propriétaires), description |
| 1 | Base d'évènements redoutés | 17 | valeurs métier, évènement, abréviation, critère de sécurité, besoin de sécurité, impacts, gravité proposée, gravité retenue, description |
| 1 | Base de catégories d'impact | 4 | nom, abréviation, catégorie parente, description |
| 1 | Impacts | 16 | nom, catégories, niveau d'impact, description |
| 1 | Base de critères de sécurité | 3 | nom, **échelle de besoin de sécurité**, description |
| 1 | Échelles d'intégrité, de confidentialité, de disponibilité | 3, 4, 4 niveaux | niveau, nom, description |
| 1 | Échelle de gravité | 4 niveaux | niveau, nom, couleur, description, valeur indicative |
| 1 | Échelle de niveau d'impact | 4 niveaux | niveau, nom, couleur, **niveau de gravité**, description |
| 1 | Base de responsables | 13 | nom, valeurs métier, biens supports, description |
| 1 | Biens supports | 2 | nom, abréviation, bien support parent, catégories, propriétaires, description |
| 1 | Catégories de bien support | 9 (arbre) | nom, abréviation, catégorie parente, propriétaires, description |
| 2 | Base de sources de risque | 5 | nom, abréviation, catégorie, description |
| 2 | Base d'objectifs visés | 4 | nom, abréviation, catégorie, description |
| 2 | Catégories de source de risque | 12 (arbre) | nom, abréviation, catégorie parente, description |
| 2 | Catégories d'objectif visé | 7 (arbre) | nom, abréviation, catégorie parente, description |
| 2 | Échelles de motivation, de ressources, de pertinence | 3, 3, 3 niveaux | niveau, nom, (couleur), description |
| 2 | Matrice de niveau de pertinence (image) | 3 × 3 | ressources (lignes) × motivation (colonnes) |
| 2 | Couples par SR, Couples par OV (images) | — | représentation radiale des couples SR/OV par pertinence |

Toutes les feuilles ont une colonne `#` (numéro stable : la feuille « Biens supports » débute au numéro 3, donc le numéro
n'est pas la position de la ligne) et, sauf le cadre de l'étude, une colonne `✓/❒`.

## 2. Règles et relations observées

1. **Base ≠ sélection.** La colonne `✓/❒` distingue ce qui est *dans la base* de ce qui est *retenu pour l'étude* : par
   exemple 12 catégories de source de risque dont 5 cochées, 7 catégories d'objectif visé dont 4 cochées. Le référentiel
   est donc plus large que l'étude, et la sélection est une donnée de l'étude. (Principe 5 de la refonte.)
2. **Catégories hiérarchiques** : catégories d'impact, de bien support, de source de risque et d'objectif visé portent une
   « catégorie parente » (arbre). La catégorie « Autre » sert de repli.
3. **Critère de sécurité → échelle de besoin** : chaque critère (confidentialité, intégrité, disponibilité) pointe vers sa
   propre échelle. Le « besoin de sécurité » d'un événement redouté est un **niveau de l'échelle du critère choisi** : la
   liste de niveaux proposée dépend du critère (dépendance entre sélecteurs).
4. **Échelles de longueurs différentes** : 3 niveaux (intégrité, motivation, ressources, pertinence) ou 4 (confidentialité,
   disponibilité, gravité, niveau d'impact). Aucun code ne doit supposer une échelle à quatre niveaux.
5. **Grille d'impact** : l'échelle « niveau d'impact » a des niveaux ordonnés et une description qui détaille les critères
   **catégorie par catégorie** (organisation, personnes, image, juridique). Chaque *impact* est un couple (catégorie
   d'impact, niveau d'impact) nommé « Catégorie – qualificatif », où le qualificatif d'un niveau diffère du nom du niveau
   de l'échelle (qualificatifs de catégorie ≠ noms de niveau). Il faut donc un libellé court de catégorie et un
   qualificatif par couple.
6. **Correspondance d'échelles** : chaque niveau d'impact est rattaché à un niveau de **gravité** (échelle de gravité).
   C'est une relation entre deux échelles, pas une saisie.
7. **Gravité proposée = maximum.** Sur les 17 événements redoutés, la « gravité proposée » est exactement la plus forte des
   gravités des impacts sélectionnés (vérifié ligne à ligne). La « gravité retenue » est une colonne distincte,
   modifiable par l'analyste : **le calcul propose, l'humain retient**.
8. **Pertinence** : la matrice (ressources × motivation, 3 × 3) donne un niveau d'une échelle de pertinence à trois niveaux.
   La description de l'échelle porte une **règle** : le niveau le plus bas exclut le couple du reste de l'étude, les
   autres le conservent. Une règle d'effet (« pris en compte / écarté ») est donc attachée à un niveau d'échelle.

   | Ressources \ Motivation | 1 | 2 | 3 |
   | --- | --- | --- | --- |
   | 1 | Faible | Faible | Moyenne |
   | 2 | Faible | Moyenne | Élevée |
   | 3 | Moyenne | Élevée | Élevée |

   Cette matrice (confirmée par l'image et par le texte de votre demande) est symétrique dans l'export. Rien n'autorise à
   supposer qu'elle le soit dans une autre étude : la configuration doit permettre toute cellule.
9. **Codes stables** : les sources de risque et objectifs visés portent un code (SR01…, OV01…) distinct de l'ordre
   d'affichage ; les événements redoutés portent « ER » + numéro non séquentiel dans la liste.
10. **Responsables hétérogènes** : la base de responsables mélange des fonctions internes (direction, RSSI, DPO, pôles) et des
    tiers génériques (hébergeur, éditeur, prestataire télécom). Les tiers sont des **fournisseurs** : ils doivent être
    sélectionnés dans le registre des fournisseurs, pas saisis une seconde fois. Les fonctions internes relèvent des
    responsables/utilisateurs de la plateforme.
11. **Cadre de l'étude** : classification de confidentialité de l'étude (une valeur d'une taxonomie), langue, durées de cycle
    (nombre + unité, vides dans l'export), contraintes en texte libre.
12. **Colonnes vides à l'export** : couleur (échelles de gravité, d'impact et de pertinence), valeur indicative (gravité),
    valeurs métier d'un événement redouté, propriétaires. Les couleurs de la matrice figurent seulement dans l'image
    (faible, moyenne, élevée). La plateforme ne doit pas inventer ces valeurs.

## 3. Classement des éléments (les neuf catégories demandées)

| # | Catégorie | Éléments de l'export |
| --- | --- | --- |
| 1 | Référentiel métier (réutilisable) | bases d'événements redoutés, de sources de risque, d'objectifs visés ; biens supports ; valeurs métier ; responsables ; fournisseurs génériques |
| 2 | Référentiel méthodologique | catégories d'impact, de bien support, de source de risque, d'objectif visé ; critères de sécurité ; impacts (couples catégorie/niveau) |
| 3 | Configuration transversale | échelles de gravité, de niveau d'impact, de confidentialité, d'intégrité, de disponibilité ; classification de confidentialité d'étude |
| 4 | Paramètre propre à une méthode (EBIOS RM) | échelles de motivation, de ressources, de pertinence ; matrice de pertinence ; règle d'effet de la pertinence ; correspondance niveau d'impact → gravité |
| 5 | Donnée propre à une analyse | cadre de l'étude, missions retenues, sélection (`✓/❒`) des éléments de la base, abréviations d'étude |
| 6 | Évaluation | besoin de sécurité, impacts sélectionnés, gravité retenue, motivation et ressources d'un couple, pertinence retenue |
| 7 | Relation entre objets | mission → valeur métier → bien support ; bien support → catégories, propriétaires ; ER → valeur métier, critère, impacts ; SR ↔ OV (couples) ; catégorie → catégorie parente ; critère → échelle ; niveau d'impact → niveau de gravité |
| 8 | Résultat calculé | gravité proposée (maximum des impacts) ; niveau de pertinence (matrice) |
| 9 | Documentaire / restitution | images « Couples par SR », « Couples par OV », matrice de pertinence ; descriptions textuelles |

## 4. Ce que l'archive ne permet pas d'affirmer

- Elle ne couvre ni les ateliers 3, 4 et 5 ni les scénarios, les mesures ou le traitement du risque.
- Les couples SR/OV eux-mêmes (avec motivation, ressources, activité, pertinence) n'y figurent que dans les images
  radiales : il n'existe pas de classeur de couples. Le détail des valeurs par couple n'est donc **pas** disponible.
- Les formules de calcul sont déduites des données (maximum des impacts, matrice de pertinence), pas d'une documentation de
  l'outil d'origine. Elles sont à valider avant publication.
- Le fichier ne dit pas quelle partie de ces bases est livrée avec l'outil et laquelle a été saisie par l'organisation.
  Les catégories de source de risque et d'objectif visé ressemblent aux typologies du guide EBIOS RM de l'ANSSI : à
  vérifier à la source avant de les proposer comme modèle.
