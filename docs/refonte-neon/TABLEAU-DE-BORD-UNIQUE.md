# Tableau de bord unique au style de la vue analytique (lot 1 : accueil)

Décisions du RSSI du 19/11/2026, sur captures et maquettes ([ADR 0108](../adr/0108-tableau-de-bord-unique.md)).

## Demande

- Le style de la vue analytique Neon partout : tableau de bord personnalisé compris, et chaque onglet qui affiche des
  statistiques (lots 2 à 4).
- Ajouter n'importe quelle dalle, la déplacer avec l'effet magnétique, la redimensionner à la souris en largeur et en
  hauteur.
- Un seul tableau : par défaut la disposition de la vue analytique ; la bascule de présentation disparaît.
- Une même dalle peut figurer plusieurs fois.

## Réalisation

| Élément | Fichiers |
| --- | --- |
| Catalogue unique, copies (`cle`), hauteur, disposition standard, aimant en hauteur | `packages/shared/src/disposition-tableau-de-bord.ts` |
| Cartes Neon devenues dalles du catalogue | `apps/web/src/components/tdb-neon.tsx` |
| Dalles classiques au cadre commun, tableau en lecture, détail d'une dalle | `apps/web/src/components/TableauDeBord.tsx` |
| Éditeur : catalogue, bords droit, bas et coin, listes Largeur et Hauteur, retrait | `apps/web/src/components/DispositionTableauDeBord.tsx` |
| Accueil sans bascule de présentation | `apps/web/src/pages/Home.tsx` |
| Cadre et style graphique communs, grille en lignes de hauteur minimale | `packages/ui/src/neon-analytics.css` |
| Hauteur et commande de détail du composant de dalle | `packages/ui/src/tableau-de-bord.tsx` |

`NeonAnalytics.tsx` est retiré : ses cartes vivent dans `tdb-neon.tsx`.

## Comportements

- **Lecture** : en-tête de la vue analytique (recherche d'une dalle, Exports, Global / ISO / HDS), grille de 12 colonnes ;
  flèche de détail sur chaque dalle (panneau latéral, « Ouvrir le registre » selon les droits).
- **Hauteur** : 2, 3, 4, 5, 6, 8, 10 ou 12 lignes de 3,5 rem au moins ; quatre lignes font une rangée. Une dalle ne
  descend jamais sous son contenu : la hauteur est un minimum, aucun défilement interne.
- **Modification** : poignée, bord droit (largeur), bord bas (hauteur), coin (les deux), étiquette « La moitié · une
  rangée » pendant le geste ; listes Largeur et Hauteur, flèches gauche et droite sur le bord droit, haut et bas sur le
  bord bas ; croix pour masquer (ou retirer une copie) ; « + Ajouter une dalle » : catalogue par famille, « Ajouter » ou
  « Ajouter encore ».
- **Aimant** : au lâcher, une dalle suivante qui se loge plus tôt que la dalle attendue est avancée (fin de rangée ou
  creux à côté d'une dalle haute) ; la dalle posée ne bouge pas.

## Vérifications

- Tests unitaires : ADR 0078 inchangés ; nouveaux tests `packages/shared/test/tableau-de-bord-unique.test.ts`.
- e2e : spec de disposition adaptée à la nouvelle disposition standard, avec hauteur, catalogue et copies ; écran
  « tableau de bord » de la spec des écrans sur l'en-tête de la vue analytique (validation du RSSI avant commit).
- Captures de référence de l'accueil régénérées dans le conteneur Playwright officiel, présentées au RSSI.

## Suite

- Lot 2 : Pilotage (Synthèse, Objectifs et indicateurs, Couverture, Périmètres, DdA).
- Lot 3 : incidents et crise, évaluations des fournisseurs, EBIOS, écran mural.
- Lot 4 : Vulnérabilités, avec la session du module.
