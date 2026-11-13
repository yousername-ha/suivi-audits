# Menu final retenu — portage commun dans les deux thèmes

## Référence visuelle définitive

[Dashboard clair](reference/docs/refonte-neon/propositions/dashboard-menu-retenu/dashboard-clair-hd.png) · [Dashboard sombre](reference/docs/refonte-neon/propositions/dashboard-menu-retenu/dashboard-sombre-hd.png) · [Aperçu autonome du menu retenu](reference/docs/refonte-neon/propositions/menu-bleu-sur-clair/apercu-autonome.html).

Le bleu nuit **opaque** est retenu après rejet de la transparence. Les deux projections Dashboard approuvées affichent la même navigation et les mêmes SVG modernes dans les deux thèmes. Le contenu principal conserve son propre thème. L’aperçu historique autonome conservait encore l’ancien jeu de SVG quand on changeait son thème interne : **le portage doit suivre les projections Dashboard finales, sans restaurer ces anciennes icônes en sombre**.

## Géométrie et typographie

Référence PC : sidebar 248 px, padding 26 px 13 px 15 px, Inter locale, libellés 13 px/1,5 en graisse 500, famille active 600. Minimum déclaré des familles 43 px et destinations 39 px ; les contenus/paddings réels peuvent produire davantage. Familles : écart horizontal 6 px, SVG 26×26 en viewBox 32×32, trait 1,95. Compte/admin : SVG 18×18, même trait. Conserver le zoom/taille de texte et adapter rail/volet selon les composants existants, pas un menu miniaturisé.

Pas de plaque brillante autour des icônes, pas de filtre flou sur le logo. Les contours et états restent nets, le relief discret. `annexes/MENU-FINAL.json` fournit les valeurs de référence exactes ; les déclarations CSS des sources citées restent disponibles.

## Fond et couleurs

```css
background:
  radial-gradient(ellipse 115% 40% at 0% 100%, #173f45 0%, transparent 86%),
  linear-gradient(163deg, #14233d 0%, #142c45 56%, #143239 100%);
```

Le fond n’a pas d’alpha global. Textes principaux `#edf4ff`, secondaires `#bdcfe0`, sous-entrées `#c4d5e6`, bordure `#42617b`. Sélection et survol sont des surfaces bleu/pétrole plus présentes, pas un rectangle blanc. Texte des éléments sélectionnés blanc ; accent de famille et liseré de sélection visibles.

| Entrée                | Identité       | Couleur finale sur le bleu |
| --------------------- | -------------- | -------------------------- |
| Tableau de bord       | `dashboard`    | `#bb96f5`                  |
| Organisation          | `organisation` | `#78d69a`                  |
| Pilotage              | `pilotage`     | `#7aafff`                  |
| Risques               | `risques`      | `#f2be57`                  |
| Conformité et audits  | `conformite`   | `#62d4dc`                  |
| Actions               | `actions`      | `#f0a265`                  |
| Résilience            | `resilience`   | `#f37b86`                  |
| Documents             | `documents`    | `#d0b28b`                  |
| Plateforme            | `plateforme`   | `#b5c1d6`                  |
| Configuration système | `parametres`   | `#b6d17d`                  |
| Mon compte            | `compte`       | `#cfb4f4`                  |
| Guide d’utilisation   | `aide`         | `#cab0d7`                  |
| Écran mural           | `mur`          | `#7fc5ef`                  |

Les teintes sont indexées par identité de famille/entrée et non par position dans le menu. Conserver la même identité quand l’utilisateur réordonne les familles. Les treize valeurs servent aux entrées présentes ; leur absence faute de droit ne crée pas une icône vide ni une destination fictive.

## Animations des formes

SVG décoratifs, sans animation de libellé ni signification d’alerte métier ajoutée. Le mouvement est interne au pictogramme ; pas de flottement concurrent de l’icône entière.

| Icône           | Groupe SVG        | Cycle | Mouvement                                               |
| --------------- | ----------------- | ----- | ------------------------------------------------------- |
| Tableau de bord | `mw-tiles`        | 4.8s  | scale 1 → 1,1 → 1                                       |
| Organisation    | `mw-organisation` | 4.6s  | losange scale 1 → 1,15 ; origine 16/9 ; délai −1s       |
| Pilotage        | `mw-pilotage`     | 4.2s  | flèche translate 0/0 → 1/−1 ; délai −0,8s               |
| Risques         | `mw-risque`       | 2.8s  | triangle clignotant par opacité 1 → 0,35 → 1            |
| Conformité      | `mw-check`        | 4.8s  | coche dasharray 20, offset 20 → 0 ; délai −1,6s         |
| Actions         | `mw-action`       | 3.4s  | flèche translateX −1,5 → +1,5                           |
| Résilience      | `mw-resilience`   | 10s   | arc fléché rotation continue 360° autour 16/16          |
| Documents       | `mw-document`     | 5s    | lignes translateY 0 → 1 et opacité 1 → 0,45 ; délai −2s |

Les textes et positions de ligne restent fixes. Le bouton de pause existant arrête tous les mouvements, `prefers-reduced-motion` les désactive et laisse la coche visible. Garder les événements de focus et les zones de clic. Les cinq icônes administratives sont statiques dans la référence. Aucun indicateur de progression ou risque réel n’est déduit de ces mouvements décoratifs.

## Sources à traduire en composants React

- Tracés des huit SVG : `reference/docs/refonte-neon/propositions/menu-chaud-anime/icones.js` ; copie extraite sans script dans [les symboles SVG](annexes/MENU-SYMBOLES.svg).
- Durées et keyframes : `reference/docs/refonte-neon/propositions/menu-chaud-anime/chaud.css`, sections `mw-*`. **Ne pas reprendre son ancien fond jaune**, remplacé ensuite.
- Traits/facettes renforcés et identités de famille : `reference/docs/refonte-neon/propositions/menu-couleurs-franches/couleurs.css`.
- Fond bleu, contraste de textes/sélections et treize couleurs finales : `reference/docs/refonte-neon/propositions/menu-bleu-sur-clair/bleu.css`.
- Données/état de navigation réels : `reference/apps/web/src/components/Layout.tsx`, `navigation.ts`, `pilotage-navigation.ts`, `components/tri-menu.ts` ; trouver les équivalents actuels dans la cible.

Ne pas copier `menu.js`, les tableaux de 7 familles/26 destinations, les MutationObserver, l’iframe ou les fixtures. En production, utiliser un composant SVG déclaratif et la logique de navigation existante. L’inventaire de destinations, leurs badges, droits, alertes et accès conditionnels (dont RETEX si applicable) doit rester celui de la cible.

## Harmonisation et recette spécifique

La référence présente des recolorations de menu conditionnées par certaines pages dans `packages/ui/src/neon-dda.css` autour des blocs `.shell:has(... ) .shell-nav` (DDA/Objectifs/Périmètres/Référentiels). Remplacer **seulement les overrides de sidebar concernés**, sans retirer les styles de contenu ni tous les `:has()` du projet. Tester une navigation à travers chaque famille pour prouver que le menu ne change plus d’habillage selon la rubrique.

Vérifier administrateur et lecteur, ordre personnalisé, alertes, navigation clavier, sous-menu actif/dépliage, destinations cachées/liens directs, taille/zoom, pause/réduction, code couleur par identité, redimensionnement et listes longues. Produire ensuite de nouvelles captures natives de l’application intégrée ; les captures de projection ne satisfont pas cette dernière étape.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
