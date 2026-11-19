# ADR 0108 — Tableau de bord unique de l'accueil, au style de la vue analytique

- Statut : acceptée (lot 1 : accueil)
- Date : 2026-11-19
- Rédaction : session « Ergonomie et refonte Neon »
- Contexte : l'[ADR 0093](0093-refonte-neon-charte-menu-et-accueil.md) a ajouté une seconde présentation de l'accueil,
  la **vue analytique Neon**, choisie au-dessus du **tableau personnalisable** de l'[ADR 0078](0078-disposition-et-partage-du-tableau-de-bord.md)
  par une préférence du compte. Décisions du RSSI du 19/11/2026 : le style de la vue analytique devient celui de toutes
  les statistiques de la plateforme, y compris du tableau de bord personnalisé et de chaque onglet qui affiche des
  statistiques ; on peut ajouter **n'importe quelle dalle**, la déplacer avec l'aimant et la redimensionner à la souris en
  largeur et en hauteur ; il n'y a plus qu'**un seul tableau** (choix « Un seul tableau ») : par défaut la disposition
  de la vue analytique, modifiable comme l'était le tableau personnalisable ; une même dalle peut figurer **plusieurs
  fois** (choix « Oui, doublons permis »). Maquettes de l'éditeur et du catalogue validées le même jour.

## Décision

1. **Un seul catalogue.** Les onze cartes de la vue analytique (bandeau ISO 27001 / HDS, conformité, applicabilité et
   mesures, niveau de risque, incidents de sécurité, audits et constats, plan d'action, indicateurs et maturité, plan
   d'action par état, journal d'audit technique, vue consolidée) rejoignent les dix-sept dalles de l'ADR 0069 dans
   `DALLES_TABLEAU_DE_BORD` (`packages/shared/src/disposition-tableau-de-bord.ts`). Chaque dalle a un titre, une ligne
   de description et une famille (Pilotage, Conformité, Écarts et actions, Risques et incidents) pour le catalogue
   « Ajouter une dalle ». Une dalle n'est proposée que si les données lisibles par la personne la permettent (incidents :
   droit de lecture des incidents ; journal : droit de lecture de l'administration ; les autres : la synthèse filtrée,
   ADR 0069).
2. **Un seul cadre et un seul style graphique.** Toutes les dalles prennent le cadre des cartes de la vue analytique
   (surface claire, filet fin, titre court et sous-titre gris, flèche de détail ouvrant la dalle en grand avec « Ouvrir le
   registre ») et ses chiffres (gras sur petit libellé). Le verre et relief de l'ADR 0069 est abandonné ; les jauges,
   barres, anneaux et histogrammes des dalles classiques gardent leur balisage et leurs teintes de seuils, redessinés
   sans contour ni reflet (`neon-analytics.css`).
3. **Disposition standard : celle de la vue analytique.** Sans disposition enregistrée, l'accueil affiche les onze cartes
   dans l'ordre de la vue analytique, un quart de largeur chacune ; les autres dalles y sont masquées et s'ajoutent
   depuis le catalogue. La bascule « Vue analytique Neon / Tableau personnalisable » est retirée ; la préférence
   `accueil` du compte reste lisible (compatibilité) mais n'a plus d'effet. L'en-tête de la vue analytique (recherche
   d'une dalle, exports, référentiels affichés Global, ISO ou HDS) surmonte le tableau unique.
4. **Copies d'une dalle.** Une dalle déjà affichée s'ajoute encore : la copie porte une clé `id~n` (n à partir de 2),
   ses propres largeur, hauteur et réglages. Une disposition compte au plus 64 dalles, copies comprises ; deux entrées de
   même clé ou une clé qui ne désigne pas sa dalle sont refusées (422). Retirer une copie la supprime ; retirer la
   première dalle d'un type la masque (elle reste au catalogue avec ses réglages).
5. **Hauteur réglable.** Chaque dalle a une hauteur en lignes de grille (2, 3, 4, 5, 6, 8, 10 ou 12 ; quatre lignes font
   une rangée, la hauteur d'une carte de la vue analytique), absente quand elle vaut la hauteur standard. Aux grands
   écrans, la grille a des lignes de hauteur **minimale** : une dalle couvre ses lignes et ne descend jamais sous son
   contenu, qui reste entièrement visible (aucun défilement interne). Aux écrans moyens et petits, les hauteurs
   naturelles s'appliquent.
6. **Éditeur.** En mode « Modifier la disposition » : poignée pour déplacer (souris, doigt, clavier), bord droit pour la
   largeur, bord bas pour la hauteur, coin pour les deux, aimantés sur les tailles proposées avec une étiquette « La
   moitié · une rangée » pendant le geste ; listes « Largeur » et « Hauteur » et flèches du clavier sur les bords comme
   alternatives ; croix pour retirer ; bouton « + Ajouter une dalle » ouvrant le catalogue par famille (« Ajouter », ou
   « Ajouter encore » pour une copie). L'aimant comble, au lâcher, les places libres en largeur comme en hauteur : une
   dalle suivante qui se loge plus tôt que la dalle attendue (fin de rangée, creux à côté d'une dalle haute) est
   avancée, la dalle qu'on vient de poser jamais ; à hauteurs égales, c'est le comblement des fins de rangée de
   l'ADR 0078.
7. **Ce qui ne change pas.** Une disposition ne contient toujours aucune donnée ; les droits, le stockage (aucune
   migration : le JSON gagne les champs facultatifs `cle` et `hauteur`), le partage, le choix du tableau affiché, la
   disposition par défaut de l'organisation et la lecture tolérante restent ceux de l'ADR 0078. Une disposition
   enregistrée avant cette version garde ses dalles ; les cartes de la vue analytique, absentes, s'y ajoutent à la fin
   (règle de l'ADR 0078 pour une dalle nouvelle).

## Conséquences

- Les lots suivants appliquent le même style aux statistiques du Pilotage (Synthèse, Objectifs et indicateurs,
  Couverture, Périmètres, DdA), puis des incidents et de la crise, des évaluations des fournisseurs, d'EBIOS et de
  l'écran mural, puis du module Vulnérabilités avec sa session.
- La spec e2e de disposition suit la nouvelle disposition standard (bandeau en tête, carte « Plan d'action » pour la
  taille) et couvre en plus la hauteur, le catalogue et les copies ; l'écran « tableau de bord » de la spec des écrans
  attend l'en-tête de la vue analytique. Modifications validées par le RSSI avant le commit.
- Tests unitaires : les tests de l'ADR 0078 sont inchangés ; `packages/shared/test/tableau-de-bord-unique.test.ts`
  couvre la disposition standard, les copies, la hauteur et l'aimant en hauteur.
