# Fiches sobres et harmonisation de l'interface Neon — intégration du 22/11/2026

Session Coeur. Branche `claude/fiches-sobres`, posée sur `claude/refonte-neon-compacte` (elle contient donc toute
l'[intégration de la refonte Neon compacte](../integration-2026-11-22/README.md) et la remplace comme branche à relire).
PR de travail vers `claude-suivi-smsi`, **sans fusion, publication ni mise en production**. Aucune migration, aucune
dépendance nouvelle, aucun changement du contrat de l'API, des droits, des calculs, des sauvegardes ou des exports.
Données fictives uniquement.

Sources comparées : branche `codex/refonte-densite-2026-11-21`, référence `0ac9992d` (livraison « fiches sobres » de la
session « Codex »). Direction graphique retenue par le RSSI : fiche claire sobre (fond blanc opaque, champs compacts et
rectangulaires, Lexend, séparateurs discrets, petits boutons en contour bleu pétrole, « Annuler » neutre, actions
sensibles rouges, accent Neon limité au cadre et aux interactions). La palette de fond cyan, bleu et lavande est refusée
et n'est pas dans cette branche. **La validation graphique reste celle du RSSI** : ce dossier fournit les captures, il ne
la déclare pas.

## 1. Comparaison faite avant les modifications

État de la version actuelle (branche de la refonte, `6d32d832`) au regard de la livraison `0ac9992d`.

| Élément de la livraison | État avant | Fichiers | Décision |
| --- | --- | --- | --- |
| Aide contextuelle React d'un champ | Absent | `packages/ui/src/DescriptionChamp.ts` | Repris, complété (aide permanente) |
| Habillage sobre des fenêtres | Absent | `packages/ui/src/neon-fiches-sobres.css` | Repris, complété (pieds de fenêtre) |
| Palette `FICHES`, variables `--fiche-*`, raccord du thème | Absent | `packages/ui/src/tokens.ts`, `theme.ts`, `package.json`, `apps/web/src/main.tsx` | Repris tel quel |
| Bouton « Annuler » de la fiche d'un produit surveillé | Absent | `apps/web/src/vulnerabilites/ProduitsSurveilles.tsx` | Repris tel quel |
| Contrat de rendu de l'aide | Absent | `apps/web/test/proportions-champs.test.ts` | Repris, un cas ajouté |
| Moteur des fiches en parties | Différent : la version actuelle est plus récente (pied réservé, accrochage natif, contrôle après découpage) | `apps/web/src/components/FichesSansDefilement.tsx`, `fiches-parties.ts`, `packages/ui/src/neon-fiches-pages.css` | Version actuelle gardée et terminée (§ 2) ; fichiers Codex non recopiés |
| Flux bloc de la pile principale d'une fiche découpée | Différent | `neon-fiches-pages.css` | Non repris tel quel : remplacé par le flux bloc des piles imbriquées, qui garde les grilles de formulaire |
| Densité, barres d'outils et de filtres (39 écrans), proportions des champs, boutons en contour, en-tête | Présents (PR de la refonte) | `neon-densite.css`, `BarreOutils.tsx`, `BarreFiltres.tsx`, `proportions-champs.ts`, `neon-harmonisation.css` | Réutilisés sans changement |
| Limite « groupes coupés aux frontières » | Présent (corrigé par la refonte) | — | Vérifié de nouveau |
| Limites « intitulés répétés », « parties peu remplies » | Partiel | moteur | Terminé (§ 2) |
| Limite « fenêtre qui retombe sur le défilement » (« Sécurité ») | Partiel | moteur, feuille | Terminé (§ 2) |
| Dossier des propositions (16 Mo, palette refusée, scripts de décoration du DOM) | — | `docs/refonte-neon/propositions/` (branche Codex) | Non importé |
| Captures et preuves Codex (interface compilée, API simulée) | — | `docs/refonte-neon/integration-fiches-sobres-2026-11-22/` (branche Codex) | Non importées : remplacées par ce dossier (pile réelle) |

Les commits de la branche Codex ne sont pas fusionnés : leur contenu est repris par différence, avec l'auteur du dépôt.

## 2. Ce qui est livré

### Habillage et aides

- Fenêtres et panneaux : fond opaque, contour discret, filet cyan et violet d'un trait en tête, titre de 16 px en graisse
  500, libellés de 12 px, champs rectangulaires à contour neutre, focus cyan. Les champs porteurs d'un état métier
  (`data-tone`) gardent leurs couleurs. Même composition en sombre (palette `FICHES.sombre`).
- Aide d'un champ : dans une fenêtre, la description d'un champ est repliée derrière un bouton « Aide sur ce champ »
  (`aria-controls`, `aria-expanded`). Le texte reste dans le composant Mantine d'origine, avec son identifiant : le champ
  garde sa description accessible (`aria-describedby`), aide ouverte ou non. Échap referme l'aide sans fermer la
  fenêtre. Hors fenêtre, rien ne change.
- **Informations indispensables** : une description qui porte un avertissement, un effet irréversible ou un format de
  saisie reste affichée, sans bouton (`descriptionProps={{ 'data-aide-permanente': true }}`). Dix-sept champs sont marqués
  (texte envoyé au fournisseur du modèle, périmètre d'un registre, identifiant et libellés d'une échelle, motifs de
  « 5 caractères au moins », format du poivre, saisies validées par Entrée, adresses du mandataire et du site, durée d'un
  écran mural, avertissement de fréquence d'un connecteur). Les erreurs de champ ne sont jamais repliées.
- Pied de fenêtre : la validation garde le contour bleu pétrole ; « Annuler » et « Fermer » (variante `default`) sont
  neutres et sans contour, dans toutes les fenêtres ; la suppression d'un processus, d'un objectif ou d'un indicateur
  passe en rouge comme les autres suppressions.

### Fiches sans défilement vertical

Le moteur (`FichesSansDefilement.tsx`) procède dans cet ordre quand le contenu dépasse la hauteur disponible :

1. **Élargir** (écran d'au moins 1 200 px, fenêtres de formulaire `lg` et `xl`, au moins quatre champs) : la fenêtre
   passe à 76 rem au plus (`data-fiche-etendue`) et son formulaire sur une grille de douze colonnes — code et nombre sur
   deux colonnes, date, état et liste courte sur trois, responsable sur quatre, zones de texte côte à côte. L'ordre du
   document et du clavier est conservé. L'élargissement n'est gardé que s'il retire au moins 12 % de hauteur ; il est
   réévalué au redimensionnement de l'écran.
2. **Découper en parties** si le contenu dépasse encore : colonnes CSS, aucun champ démonté, pied fixe, mini-menu.
3. **Nommer** : section déclarée (`data-fiche-section`), sinon titre en tête de partie, sinon nom de la section en
   cours (sans « (suite) » si aucune partie ne le porte encore), sinon libellé du premier champ suivi de points de
   suspension (« Échéance… »). « Informations (suite 2) » ne subsiste que sans titre ni champ.
4. **Contrôler** : un champ tronqué, à cheval ou recouvert, et la fenêtre garde son défilement habituel ; la raison est
   lisible sur le cadre (`data-fiche-repli`).

Corrections de fond : une pile placée dans une autre passe en flux bloc dans une fiche découpée (le navigateur faisait se
recouvrir deux champs voisins), un grand encadré se poursuit d'une partie à l'autre, la requête de conteneur des grilles
est portée par le corps de la fenêtre. La fenêtre « Sécurité » se découpe ainsi dans toutes les tailles vérifiées.

**Fenêtres de consultation.** Une fenêtre faite surtout d'un long tableau (plus de 60 % de la hauteur du contenu) n'est
pas une fiche : elle garde son défilement, sans quoi le tableau perdrait ses en-têtes d'une partie à l'autre. Le journal
d'audit, les journaux techniques et les détails techniques le déclarent (`consultation` dans `Administration.tsx`,
classe `fiche-defilement`).

### Résultat mesuré (pile réelle)

| Fenêtre | 1280 × 720, refonte seule | 1280 × 720, cette livraison | 1920 × 1080, cette livraison |
| --- | --- | --- | --- |
| Création d'un risque | 4 parties | 2 parties | une seule vue |
| Revue de direction (23 champs) | 5 parties « Informations (suite N) » | 3 parties nommées | 2 parties |
| Responsabilité | 3 parties | 2 parties | une seule vue |
| Plan de continuité | 3 parties | 2 parties | une seule vue |
| Partie intéressée | 3 parties | 2 parties | une seule vue |
| Action | 2 parties | 2 parties (une vue en compact) | une seule vue |
| « Sécurité » | défilement (repli) | 4 parties nommées | 3 parties nommées |

## 3. Repères pour la prochaine IA

- Ne pas défaire sans rejouer la recette : la réservation du pied et l'accrochage (`neon-fiches-pages.css`), le
  contrôle après découpage et l'ordre élargir, découper, nommer, contrôler (`FichesSansDefilement.tsx`).
- Attributs posés par le moteur sur le cadre : `data-fiche-etendue`, `data-fiche-paginee`, `data-fiche-pied`,
  `data-fiche-repli` ; sur le contenu : `data-fiche-actions-fixes`, `data-fiche-titre`, `data-fiche-entier`. Variables :
  `--fiche-hauteur`, `--fiche-pied`, `--fiche-pas`, `--fiche-defile`. Aucun style en ligne (CSP inchangée).
- Un écran déclare une section par `data-fiche-section="Nom"`, une fenêtre de consultation par la classe
  `fiche-defilement` sur son cadre, une aide indispensable par `data-aide-permanente`.
- Des propriétés de description propres à un champ remplacent celles du thème : le champ rend alors la description
  d'origine, toujours affichée. C'est le mécanisme de l'aide permanente ; ne pas l'utiliser pour autre chose.
- La grille élargie ne s'applique qu'aux piles `fenetre-formulaire`, `fenetre-champs` et à la pile directe d'une fenêtre
  large qui contient au moins trois champs. Les fiches Objectifs, Processus et Indicateurs (refonte retenue) gardent
  leur mise en page ; seule la couleur de leur bouton de suppression change.
- La suite graphique (teintes, forme du mini-menu, position du bouton d'aide) revient à la session Neon.

## 4. Recette

Voir [RECETTE.md](RECETTE.md) et la [galerie des captures](captures/README.md).

## 5. Limites

- Les fiches Processus et Indicateur gardent trois à quatre parties en 1280 × 720 : leur mise en page propre (refonte
  retenue) n'est pas passée sur la grille élargie.
- En 2 560 px de large et au-delà, une fiche qui tient en hauteur reste à sa largeur habituelle (colonne haute et
  étroite) : l'élargissement ne se déclenche que si le contenu dépasse.
- Le bouton d'aide ajoute un arrêt de tabulation avant le champ ; il est placé au bord droit du champ, loin d'une saisie
  étroite sur une ligne entière.
- Une partie sans titre ni champ (liste de cases à cocher) reste nommée « Informations (suite) ».
- Thème et densité des captures et du balayage sont posés par les attributs de la page, comme le fait l'application ;
  l'enregistrement de la préférence dans « Mon compte » n'a pas été rejoué pour chaque capture.
