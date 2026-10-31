# Maquette F — « Inspiration » (maquette prioritaire)

Maquette statique et cliquable de refonte graphique pour « Suivi des audits SMSI », transposée des cinq images de
référence (`../reference/`, analyse dans `../reference/ANALYSE-INSPIRATION.md`). Aucun logo, aucune marque ni texte
des captures n'est repris : seul le style est transposé, appliqué aux six écrans du brief commun et aux données
`window.FAKE`.

Ouvrir `index.html` (en `file://` ou servi) ; routes par ancre : `#/dashboard`, `#/audits`, `#/audit/AUD-07`,
`#/formulaire`, `#/retex`, `#/composants`. La page répond au `postMessage({ type: 'route', hash })` de la page
comparative.

## 1. Intention

Un fond marine profond, dégradé, sur lequel flottent des cartes très arrondies : **cartes de verre sombres** pour les
KPI et les graphiques (image 04), **cartes blanches** pour les contenus denses — tableau, formulaire, onglets de la
fiche, déroulé du RETEX (image 03). Le dégradé signature **sarcelle → violet** structure toutes les données ; le
corail, l'or et le vert ponctuent les statuts et les actions. Les capsules translucides (images 01 et 02) portent la
navigation, les statuts, les filtres et l'interrupteur d'animations. Hiérarchie typographique : chiffre énorme et fin,
légende minuscule en capitales espacées, titre moyen.

### Pourquoi deux familles de cartes

- Le verre sombre met les chiffres clés et les tracés lumineux en vedette (lueurs, dégradés), mais il pénalise la
  lecture longue : un tableau de 36 lignes ou un formulaire de dix champs y fatiguent l'œil et les contrastes des
  champs de saisie deviennent fragiles.
- La carte claire reprend exactement le rôle de l'image 03 : surface de travail dense, chiffres en encre bleutée,
  filets presque invisibles, badges en teintes pâles avec texte assombri. Le passage sombre → clair signale aussi un
  changement de registre : « je regarde » (verre) vs « je travaille » (clair).

## 2. Palette (hex)

| Rôle | Hex | Note |
| --- | --- | --- |
| Fond de page, haut du dégradé | `#1C2B4A` | référence 03, 04 |
| Fond de page, bas du dégradé | `#0F1A33` | |
| Carte de verre | `#232A48` à 60 %, bord blanc 10 %, flou 20 px | reflet blanc 10 % en haut |
| Carte claire | `#FFFFFF` | ombre `0 20px 60px rgba(10,20,50,.25)` |
| Sarcelle (données, points, chips) | `#2EC4B6` | clair `#7EE0D6` pour le texte sur verre |
| Sarcelle assombri (boutons pleins, texte blanc) | `#157F76` | ajustement AA, voir § 7 |
| Sarcelle encre (texte sur carte claire) | `#0F6B63` | |
| Violet (dégradé signature) | `#6D5BD0` | lumineux `#8F7BFF` (courbe), clair `#B388FF` (texte sur verre), sombre `#5A48B5` (bouton) |
| Corail (alerte, criticité, retard) | `#F0564A` | clair `#FF9A8E`, bouton `#C23A2F`, encre `#B8362B` |
| Or (rapport attendu, échéance proche) | `#F2A33A` | clair `#F7C97A`, encre `#8A5200` |
| Vert (clos, « en direct ») | `#2FD37A` | clair `#7CE7AC`, encre `#1F7F4C` |
| Bleu (information, mineure, en préparation) | `#4C8DFF` | clair `#8FC1FF`, encre `#2457B0` |
| Texte sur fond sombre | `#FFFFFF` · secondaire `#A9B4D0` · tertiaire `#8E9AB8` | |
| Texte sur carte claire | titres `#2B3350` · chiffres `#334066` · légendes `#5F6A8A` | |
| Dégradé signature | `linear-gradient(90deg, #2EC4B6, #6D5BD0)` | barres, arcs, indicateurs d'onglet |
| Dégradé des boutons primaires | `linear-gradient(90deg, #157F76, #5A48B5)` | version assombrie du signature |

Tous les jetons sont dans `tokens.css` (couleurs, typographie, espacements, rayons, ombres, lueurs, durées et courbes).

## 3. Typographie

- **Inter** variable, locale (`../shared/fonts.css`), repli système ; chiffres tabulaires activés.
- Chiffres clés : 44 px (56 px disponibles) en graisse **300**, interlettre −0,03 em ; jamais sous 28 px en 300
  (les valeurs de liste sont en 28 px / 300, les cellules de tableau en 400).
- Légendes : 11 px, capitales, graisse 600, interlettre 0,14 em, couleur tertiaire `#8E9AB8` (5 : 1 sur le verre).
- Titres de carte 16 px / 600, titres d'écran 22 px / 600, corps 14 px / 400, boutons 13 px / 600 capitales
  interlettre 0,06 em.
- Espace fin insécable pour les milliers (`fmt()`), dates au format français (`FAKE.fr`, `FAKE.frLong`).

## 4. Composants transposés

- Navigation : barre haute, liens dans une capsule de verre, indicateur actif qui glisse (`transform`).
- Interrupteur segmenté « Animations : activées / désactivées » dans l'en-tête (pose `data-animations` sur `<html>`).
- Pastilles translucides (statut, utilisateur), boutons capsule pleins (sarcelle, violet, corail, or), chips de filtre
  à contour 1,5 px dont la sélection devient pleine.
- Jauges circulaires pointillées (40 points + arc), anneaux concentriques, barres arrondies à dégradé vertical,
  courbe lissée à aire dégradée et halo, sparklines (mini-barres et mini-courbes), grille de points de fond, halos
  sarcelle et violet.
- Badges : point ou icône + libellé, teintes « claires » sur verre et « encre » sur carte blanche.
- Tableau sans bordures (séparation par espacement), en-têtes en capitales fines, tri avec `aria-sort`.
- RETEX : chronologie façon cotation (grille, segments à dégradé qui se tracent, points colorés par gravité, bulle
  reliée au point actif).

## 5. Animations

Toutes en `transform` / `opacity` (plus `stroke-dashoffset` pour les tracés SVG) ; 150–420 ms pour les
interactions, ≤ 1,2 s pour les graphiques et compteurs ; courbe `cubic-bezier(.2,.7,.2,1)`.

| Famille | Mise en œuvre |
| --- | --- |
| Chargement d'écran | cartes et KPI en cascade : fondu + glissement 16 px, décalage 60 ms par élément (`--i` posé en JS) ; lignes de tableau 30 ms |
| Compteurs | de 0 à la valeur en 1 100 ms, ease-out cubique, `requestAnimationFrame`, déclenchés à l'apparition |
| Barres | montée depuis la base (`scaleY`, `transform-box: fill-box`), 55 ms de décalage par barre ; valeur en fondu ensuite |
| Courbes | tracé progressif par `stroke-dasharray/offset` (longueur mesurée avec `getTotalLength`), aire révélée en fondu à 600 ms, points qui s'allument un à un |
| Jauges et anneaux | points allumés un à un (22 ms de décalage), arc rempli par `stroke-dashoffset` vers `--cible` |
| Déclenchement | `IntersectionObserver` (seuil 10 %, marge basse 240 px) ; repli après 1,5 s pour ce qui reste hors écran (impression, capture pleine page) |
| Info-bulles | fondu + translation 6 px, suivent le pointeur (`--tx`/`--ty`), accessibles au clavier (focus sur les zones) |
| Navigation | `document.startViewTransition` (nommé `vue`, l'en-tête reste fixe) ; repli fondu + glissement 12 px |
| Onglets / segment | indicateur et capsule qui glissent (`translateX` + `scaleX`, aucune propriété de boîte animée) |
| Micro-interactions | cartes et boutons : `translateY(-4 px / -2 px)` + ombre longue portée par un pseudo-élément dont seule l'opacité varie, lueur colorée ; modale `scale(.96 → 1)` + fondu ; toasts glissés depuis la droite ; squelette balayé par translation d'un reflet ; badge dont le texte bascule (sortie vers le haut, entrée par le bas) |
| RETEX | segments tracés un à un (`stroke-dashoffset`), point actif qui pulse une fois, bulle ouverte par étapes (anneau 0 → 1 avec rebond, trait `scaleX`, en-tête, titre, détail, acteur), aire qui suit la lecture ; « Point suivant / précédent », « Tout dérouler » (260 ms par point), « Recommencer », clavier (flèches, Origine, Fin) sur le graphique, clic sur un point ou une carte |
| Fond | dérive très lente des deux halos (38 s, aller-retour), coupée en mouvement réduit et par l'interrupteur |

Mouvement réduit : `prefers-reduced-motion: reduce` pose automatiquement `data-animations="off"` (et suit les
changements du média) ; l'interrupteur permet de forcer l'un ou l'autre. En mode « off », toutes les animations et
transitions passent à 0,01 ms, les boucles à une itération, les compteurs et le RETEX affichent directement leurs
états finaux, `startViewTransition` n'est pas appelé.

## 6. Points forts et limites

Points forts : fidélité à l'ambiance des références (fond marine, verre, dégradé signature, jauges pointillées,
chiffres fins), lisibilité conservée sur les contenus denses grâce aux cartes claires, chaîne complète d'interactions
(recherche, filtres, tri, pagination, onglets, formulaire validé, modale, toasts, RETEX point par point), accessibilité
vérifiée (contrastes calculés, focus visible, `aria-sort`, `role=tablist`, piège de focus, `aria-live`).

Limites connues :

- Maquette statique : aucune persistance, données déterministes de `FAKE` ; le formulaire simule l'enregistrement.
- `backdrop-filter` sur les cartes de verre et les capsules : coûteux sur machines sans accélération graphique ; un
  repli opaque (`--verre-fort`) est prêt mais non branché automatiquement.
- La capture pleine page d'un outil automatique (Playwright `fullPage`) rend l'en-tête collant et le lien
  d'évitement à la position du défilement : artefact de capture, pas de la page.
- Le compteur de gravité du RETEX est positionné en pourcentage du SVG ; la bulle peut recouvrir les étiquettes d'axe
  sur les points extrêmes à 1024 px.
- `color-mix()` est utilisé pour le fond des icônes de toast (navigateurs 2023+) ; sans prise en charge, l'icône reste
  lisible sur le verre.
- Pas de mode clair global : le style de référence est intrinsèquement sombre.

## 7. Écarts d'accessibilité et ajustements par rapport aux références

Vérification par `node test/contraste.cjs` (luminance relative WCAG 2.1) : tous les couples texte/fond atteignent
4,5 : 1 et les composants 3 : 1.

| Trait des références | Problème | Ajustement retenu |
| --- | --- | --- |
| Texte blanc sur sarcelle `#2EC4B6` (boutons, chips actives) | ~2,1 : 1 | Boutons pleins en sarcelle assombri `#157F76` (4,85 : 1) ou dégradé `#157F76 → #5A48B5` ; chips actives sur verre en sarcelle avec texte marine `#0F1A33` (7,97 : 1) |
| Légendes tertiaires `#6E7A99` | ~3,2 : 1 | Remontées à `#8E9AB8` (5 : 1 sur le verre) ; secondaire `#A9B4D0` (6,8 : 1) |
| Légendes `#8A93AD` sur carte blanche | ~3,2 : 1 | Remplacées par `#5F6A8A` (5,36 : 1) |
| Chiffres en graisse 300 | fins | Jamais sous 28 px ; 44 px pour les KPI, 400 dans les tableaux |
| Bordures 1 px blanc 8–12 % | décoratives | Conservées, mais les champs de saisie utilisent `#7A84A0` (clair) ou blanc 48 % (sombre) ≥ 3 : 1 |
| Couleur seule pour les séries et statuts | repérage | Point ou icône + libellé partout ; échéances dépassées : icône alerte + « Dépassée de n jours » |
| Pastilles de verre sur photo | dépend du fond | Pas de photo : capsules sur marine, fond de repli `--verre-fort` à 82 % |

Écarts résiduels : les sparklines des KPI et indicateurs sont décoratives (`aria-hidden`), la valeur et la tendance
étant données en texte ; la bulle du RETEX est annoncée via `aria-live`, le graphique est un `role="application"`
commandé au clavier, et chaque point révélé est aussi une carte dans le « Déroulé » (lecture séquentielle possible
sans le graphique).

## 8. Tests

- `node test/contraste.cjs` : couples de couleurs.
- `node test/verifier.cjs` : Playwright (Chromium) — six ancres, `postMessage`, recherche, filtre, tri, pagination,
  ligne cliquable, onglets (souris et clavier), formulaire (erreurs, blur, envoi, succès), RETEX (bouton, clavier,
  tout dérouler), modale (piège de focus, Échap, retour du focus), toasts, badge animé, squelette, interrupteur
  d'animations, absence de `style=` hors variables, libellés des boutons, absence de débordement horizontal, zéro
  erreur ou avertissement console ; exécuté avec animations à 1440 px, en `reducedMotion: 'reduce'` à 1440 px, et
  à 1024 px. Captures dans `test/captures/`.
