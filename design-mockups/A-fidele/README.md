# Maquette A — FIDÈLE

Maquette statique et cliquable de refonte graphique pour « Suivi des audits SMSI », direction **fidèle** : la palette
de la charte « Sauge » relevée dans [`../AUDIT-VISUEL.md`](../AUDIT-VISUEL.md) est reprise strictement, sans aucune
couleur nouvelle. Ce qui change : la mise en page, la hiérarchie, les espacements, les composants et les graphiques.

Ouvrir `index.html` (en `file://` ou servi) ; routes par ancre : `#/dashboard`, `#/audits`, `#/audit/AUD-07`,
`#/formulaire`, `#/retex`, `#/composants`. La page répond au `postMessage({ type: 'route', hash })` de la page comparative.

## Intention

L'utilisateur actuel doit s'y retrouver immédiatement : même navigation latérale vert sombre avec repère clair et
pastilles de famille, mêmes familles et même vocabulaire (statuts, criticités, référentiels), même police Inter.
La surcharge de l'accueil disparaît au profit d'un tableau de bord tenant en moins de 1 800 px : cinq KPI, trois
graphiques lisibles, les échéances, une rangée d'indicateurs. Les cartes perdent leurs bordures (une ombre très douce
suffit sur le fond `#F5F6F2`), les filets ne servent plus qu'à séparer les lignes de listes, l'air est régulier
(grille 12 colonnes, gouttière 1,5 rem, rayon 12 px).

## Palette (hex)

| Rôle | Hex | Origine (AUDIT-VISUEL) |
| --- | --- | --- |
| Encre (texte, titres) | `#243B34` | `BRAND.encre` |
| Vert de marque (primaire, liens, courbe « clos ») | `#245F4C` | `BRAND.vert` |
| Vert sombre (survol du bouton plein) | `#194B3B` | `VERT[9]` |
| Vert clair (badge, avatar) | `#EDF4EF` | `VERT[0]` |
| Violet accent (courbe « ouverts », sparklines hors cible) | `#5A48B5` | `BRAND.violet` |
| Violet sombre / clair | `#43358B` / `#F2F0FB` | `VIOLET[9]` / `VIOLET[0]` |
| Fond de page | `#F5F6F2` | `BRAND.fond` |
| Surface des cartes | `#FFFFFF` | `BRAND.surface` |
| Surface douce (en-têtes de tableau, tuiles) | `#F8F9F6` | `GRIS[0]` |
| Piste des barres et progressions | `#E7EEE9` | `SOMBRE[0]` |
| Texte secondaire | `#58695F` | `GRIS[6]` |
| Bordure de champ | `#819087` | `GRIS[5]` |
| Filet | `#D5DCD3` | `GRIS[3]` |
| Navigation : fond / texte / texte 2 | `#163E33` / `#F2F6EF` / `#B5CEC0` | nav |
| Navigation : entrée active / survol / repère | `#305A49` / `#244C3E` / `#C5DBAB` | nav |
| Pastilles de famille | `#C5DBAB` `#9CC7E4` `#F2A99B` `#E8D28C` `#BCAAEC` `#84D6C6` `#E6B8D2` | nav |
| États erreur / alerte / jaune / succès / info | `#C92A2A` `#CE440E` `#AC5900` `#29833B` `#1971C2` | `ETATS` fond plein |
| États, survol | `#B12525` `#B53C0C` `#974E00` `#247334` `#1663AB` | `ETATS` survol |
| États, texte sur teinte légère | `#A82424` `#A03E08` `#925500` `#206D2F` `#145B9C` | `ETATS` texte |
| Violet d'état (badge « En préparation ») | `#6741D9` / `#5A2FB0` | `ETATS` |
| Données : vert / bleu / violet / rouge / gris | `#278A58` `#3A66B5` `#6556C2` `#D63A30` `#7A887F` | tableau de bord ADR 0069 |

Les teintes légères des badges et bandeaux sont la couleur d'état à 12 % sur la surface
(`color-mix(in srgb, couleur 12%, surface)`) : aucune nouvelle teinte n'est introduite. L'orange clair `#EA8A1A` et
`#D98A1D` de l'application ne sont **pas** repris pour les remplissages de graphiques (2,6 : 1 sur blanc) ; l'orange
assombri `#CE440E` les remplace.

Correspondances : statuts d'audit Planifié gris, En préparation violet, En cours bleu, Rapport attendu orange, Clos
vert, Reporté jaune ; criticités Critique rouge, Majeure orange, Mineure jaune, Observation gris ; actions Terminée vert,
En cours bleu, À faire gris, Bloquée rouge. Gravités RETEX (0 → 4) : gris, info, jaune, alerte, erreur — la pastille,
la bordure et la barre prennent la couleur d'état pleine (≥ 3 : 1), le libellé prend la variante « texte sur teinte »
(`#58695F` `#145B9C` `#925500` `#A03E08` `#A82424`, ≥ 4,5 : 1 sur blanc, fond de page et surface douce).

Règles de contraste appliquées : texte principal `#243B34` 12 : 1 sur blanc ; texte secondaire `#58695F` 5,8 : 1 sur blanc,
5,4 : 1 sur le fond de page, 4,9 : 1 sur la piste `#E7EEE9` (compteur d'onglet, minimum mesuré dans la page) ; libellés
de navigation `#F2F6EF` 10,8 : 1 sur `#163E33` et 7,2 : 1 sur l'entrée active ; le compteur « 36 » de la navigation passe
en texte principal sur l'entrée active et au survol (5,5 : 1 ; le texte secondaire tombait à 3,6 : 1) ; placeholders
opaques (5,8 : 1) ; texte des boutons pleins blanc sur `#245F4C` 7,5 : 1 et sur `#C92A2A` 5,5 : 1.

## Typographie

Inter variable (locale, `../shared/fonts.css`), repli système. Base fluide `clamp(0.9rem, 0.84rem + 0.25vw, 1rem)`.
Titres 650 / 600 avec `letter-spacing -0.035em` (h1 `clamp(1.65rem, 2.2vw, 2.45rem)`), corps 450 avec
`letter-spacing -0.011em`. Légendes et en-têtes de tableau en capitales 0,74 rem espacées 0,035–0,08 em (relevées par
rapport aux 0,61–0,68 rem actuels). Chiffres tabulaires dans les tableaux, KPI et dates. Monospace système pour les
identifiants et références.

## Animations (transform, opacity, stroke-dashoffset uniquement)

- Entrée d'écran et de panneau : fondu + translation 6 px, 360 ms, `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- Survol : boutons, lignes de tableau, cartes KPI (ombre + translation −2 px), 150–180 ms.
- Repère de navigation : `scaleY` 180 ms ; navigation repliable en largeur 250 ms.
- Indicateur d'onglet : `translateX` + `scaleX` 250 ms.
- Graphiques (≤ 900 ms) : barres `scaleX`/`scaleY` depuis 0, anneaux et jauge par `stroke-dashoffset`, courbes
  tracées par `stroke-dashoffset`, aires et points en fondu.
- Barres de progression : `scaleX` 900 ms.
- Modale : voile en fondu, boîte fondu + translation 12 px / échelle 0,98, 250 ms.
- Toasts : fondu + translation 16 px à l'entrée et à la sortie, 250 ms.
- RETEX : chaque point apparaît en fondu + translation 8 px (360 ms), déroulé complet cadencé à 70 ms.
- Squelette de chargement : pulsation d'opacité 1,4 s, seulement pendant le chargement simulé.
- `prefers-reduced-motion: reduce` : tout est coupé ou réduit à un fondu de 120 ms ; les graphiques s'affichent
  directement dans leur état final ; le défilement devient instantané.

## Points forts

- Palette, navigation, familles et vocabulaire identiques : aucune réacclimatation.
- Tableau de bord resserré et hiérarchisé, graphiques SVG natifs dimensionnés sur la largeur réelle de leur carte
  (texte à taille constante, lisibles à 1 440 et 1 024 px), info-bulles au survol et au clavier.
- Statuts toujours couleur + icône + libellé ; échéances dépassées signalées par icône et texte.
- Liste complète : recherche, trois filtres, tri avec `aria-sort`, pagination, clic de ligne.
- Formulaire validé au blur et à la soumission, résumé d'erreurs relié aux champs, état d'envoi, succès.
- Modale avec piège de focus, Échap, retour du focus ; toasts dans une zone `aria-live`.
- Focus clavier visible partout : `outline` 2 px vert (repère clair dans la navigation), anneau `box-shadow` sur les
  champs (aussi en `:focus-within`, pour que le champ date garde son anneau pendant que Chromium focalise son bouton de
  calendrier interne), `outline` aussi sur les éléments SVG focalisables (barres, arcs, points, colonnes).
- Contrastes vérifiés par `test/contraste.js` (couples issus de `tokens.css`) ; parcours Playwright `test/verifier.cjs`
  (interactions, normal et mouvement réduit) et `test/verifier-complement.cjs` (six ancres à 1 440 et 1 024 px, aucune
  opacité 0 résiduelle en mouvement réduit, parcours Tab avec indicateur de focus, `postMessage`, badges icône + libellé,
  contraste des couples texte/fond calculés dans la page).

## Limites connues

- Données figées (`window.FAKE`), aucune persistance : la clôture, l'enregistrement, les exports sont simulés par
  des toasts ou bandeaux.
- Pas de mode sombre (l'application en a un partiel) ; la maquette ne traite que le thème clair.
- Seuls six écrans sont maquettés ; le registre des échéances, la saisie de constat et les indicateurs complets
  renvoient des notifications explicatives.
- Sous 900 px la mise en page bascule en une colonne mais n'est pas optimisée pour mobile (hors périmètre).
- La navigation repliée (≤ 1 100 px) ne montre que des icônes avec `title` ; pas de sous-menu déroulant.
- Les teintes `color-mix()` exigent un navigateur récent (Chromium ≥ 111, Firefox ≥ 113, Safari ≥ 16.2).

## Écarts éventuels d'accessibilité

- Les cibles tactiles des boutons `--sm` (2 rem) et des badges (1,6 rem) sont sous 44 px : acceptable sur poste de
  travail, à revoir pour une version tactile.
- Les segments d'anneau, barres et colonnes de courbe sont focalisables avec `aria-label`, mais un tableau de données
  équivalent n'est pas fourni sous chaque graphique. Sur un segment d'anneau, l'`outline` de focus entoure la boîte du
  cercle entier (limite des SVG) ; le segment focalisé est signalé en plus par l'info-bulle et l'opacité.
- La carte « Enseignements du RETEX » est retirée du flux (`hidden`) tant que le déroulé n'est pas complet ; elle
  apparaît en fondu à la dernière étape.
- La chronologie RETEX annonce le compteur en `aria-live`, pas le contenu de chaque point révélé.
- Les sparklines des indicateurs sont décoratives (`aria-hidden`), la valeur et la cible étant données en texte.
- Les couleurs des pastilles de famille dans la navigation sont décoratives (le libellé porte l'information).
