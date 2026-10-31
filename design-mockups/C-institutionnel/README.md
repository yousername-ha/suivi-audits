# Maquette C — Sobre institutionnel santé

Maquette statique et cliquable de refonte graphique pour « Suivi des audits SMSI ». Direction libre n° 1 :
un ton de **rapport officiel** pour un établissement de santé public, rassurant et lisible, pensé pour une
présentation à un RSSI et à une direction. Test visuel uniquement : HTML, CSS et JS natifs, données
fictives `../shared/fake-data.js`, aucune persistance.

Ouvrir `index.html` (en `file://` ou servi) ; écrans par ancre : `#/dashboard`, `#/audits`, `#/audit/AUD-07`,
`#/formulaire`, `#/retex`, `#/composants`. La page comparative pilote l'écran par `postMessage({ type: 'route', hash })`.

## Intention

L'interface est traitée comme un document institutionnel : en-tête de rapport (organisation en petites
capitales, titre en serif, période de certification, date de situation), navigation en « table des matières »
numérotée sur bandeau bleu, écrans et sections numérotés (01, 1.1, 1.2…), filets fins horizontaux, cartouches
pour les identifiants (`AUD-07`), chiffres tabulaires partout. Le papier ivoire remplace le blanc de page ; les
cartes sont blanches, bordées d'un filet et peu ombrées ; les angles sont presque droits (2 à 4 px). L'accent
terre cuite est réservé aux actions (bouton principal, indicateur d'onglet actif, repère de navigation) pour
qu'il reste rare et lisible.

## Palette (hex)

| Rôle | Hex |
| --- | --- |
| Bleu institutionnel (titres, navigation, graphiques) | `#1F3A5F` |
| Bleu sombre (survol, entrée active) | `#16293F` |
| Bleu clair (graphiques, numéros d'écran) | `#6B86AA` |
| Papier (fond de page) | `#FAF8F3` |
| Surface (cartes) | `#FFFFFF` |
| Surface douce / douce 2 | `#F2EEE5` / `#ECE7DC` |
| Filet / filet léger | `#D8D1C4` / `#E7E1D5` |
| Bordure de champ | `#857D70` |
| Encre (texte) | `#23221E` |
| Texte secondaire / tertiaire | `#5B564D` / `#6F685B` |
| Terre cuite (actions) / sombre | `#A84E24` / `#8F421E` |
| Succès (texte / fond) | `#2F6B46` / `#E4EEE4` |
| Alerte (texte / fond) | `#7F5208` / `#F7ECD2` |
| Erreur (texte / fond) | `#9A3528` / `#F7E2DC` |
| Information (texte / fond) | `#2B5A88` / `#E1EAF3` |
| Reporté (texte / fond) | `#5B4A86` / `#EAE5F2` |
| Graphiques : ocre, sauge, gris chaud | `#A97B26`, `#5C8A6C`, `#8B857A` |
| Halo de focus des champs | `#6B86AA` (bleu clair) |

Tous les couples texte/fond utilisés ont été vérifiés par calcul de luminance (`test/contraste.cjs`) :
≥ 4,5 : 1 pour le texte (minimum obtenu : 4,76 : 1, texte tertiaire sur surface douce), ≥ 3 : 1 pour les bordures de
champ, les anneaux de focus et les remplissages de graphiques, y compris sur la piste douce des barres (minimum 3,16 : 1).
Revue du 31/10 : le texte tertiaire est passé de `#7A7366` (4,06 : 1 sur surface douce) à `#6F685B`, l'ocre de `#B8862B`
(2,80 : 1 sur la piste) à `#A97B26`, le gris chaud de `#8F897E` à `#8B857A`, et le halo de focus des champs du bleu pâle
(1,2 : 1) au bleu clair (3,7 : 1).

## Typographie

- Titres, grands chiffres, numéros de section : serif système — `Georgia, "Iowan Old Style", Palatino,
  Charter, Caladea, "Liberation Serif", serif`, graisse normale, interlignage serré.
- Corps, libellés, tableaux : `Inter` (copie locale via `../shared/fonts.css`) avec repli `system-ui`.
- Identifiants et références : monospace système (`ui-monospace, Menlo, Consolas…`).
- Chiffres tabulaires (`font-variant-numeric: tabular-nums`) sur tout le corps ; petites capitales
  espacées (0,10 à 0,14 em) pour les sur-titres et en-têtes de tableau.
- Échelle : 12 / 13 / 15 / 17 / 22 / 28 / 36 px ; grands chiffres KPI 40 px.

## Animations (transform et opacity uniquement, stroke-dashoffset pour les tracés)

1. Entrée d'écran : fondu + translation de 10 px, 400 ms, décalage de 60 ms par bloc.
2. Repère de navigation et indicateur d'onglet : `scaleX`/`translateX`, 240 ms (l'indicateur glisse sous l'onglet).
3. Barres (statuts, types, barre empilée) : `scaleX` depuis la gauche, 900 ms, décalage de 60 à 80 ms par barre.
4. Anneau : fondu + rotation de −24° à 0°, 900 ms.
5. Jauge, courbe 12 mois, courbe de gravité RETEX : tracé par `stroke-dashoffset`, 1 100 ms, puis points en fondu.
6. Jauges de progression (tableaux, fiche) : `scaleX`, 900 ms.
7. RETEX : chaque point apparaît en fondu + translation de 8 px, le trait vertical s'étire (`scaleY`) ; la
   section « gravité et enseignements » apparaît quand tout est déroulé.
8. Toasts : glissement de 1,5 rem depuis la droite, 240 ms, sortie symétrique ; disparition automatique à 6 s.
9. Modale : fondu + translation de 12 px, 240 ms, fond assombri en fondu.
10. Squelette de chargement : pulsation d'opacité 1,2 s, uniquement pendant les 1,6 s de chargement simulé.

`prefers-reduced-motion: reduce` : toutes les durées passent à 1 ms, les translations et rotations sont
supprimées, seuls des fondus de 150 ms subsistent ; la pulsation du squelette est coupée.

## Accessibilité

- Statuts, criticités, priorités et échéances : couleur + icône ou libellé, jamais la couleur seule
  (badges, échéances « Dépassée de N jours », « J-7 »).
- Focus visible partout (anneau terre cuite à double liseré) ; lien d'évitement ; `aria-current="page"` sur la navigation.
  Les champs de formulaire montrent leur anneau sur `:focus` et `:focus-within` (Chromium ne fait pas correspondre
  `:focus-visible` au champ `date` quand son bouton de calendrier interne est focalisé) ; les éléments SVG survolables
  (barres, segments, points) reçoivent un `outline` terre cuite, un `box-shadow` étant sans effet sur une forme SVG.
- Tableau : `aria-sort` sur la colonne triée, boutons de tri nommés, lignes cliquables doublées d'un lien.
- Onglets : `role="tablist"`/`tab`/`tabpanel`, flèches, Début/Fin, panneaux `hidden`.
- Modale : `role="dialog"`, `aria-modal`, piège de focus, Échap, retour du focus au bouton d'origine.
- Toasts : conteneur `aria-live="polite"`, `role="status"` ou `alert`, bouton de fermeture nommé.
- Formulaire : `aria-required`, `aria-invalid`, `aria-describedby` vers aide et erreur, résumé des erreurs
  focalisable avec liens vers les champs, bouton désactivé pendant l'envoi.
- RETEX : région clavier (`tabindex="0"`, flèches, Début/Fin), annonce `aria-live` de chaque point.
- Graphiques : `figure role="img"` avec libellé, éléments survolables focalisables avec `<title>` et info-bulle.

## Points forts

- Identité éditoriale cohérente sur les six écrans (numérotation, filets, cartouches, serif/sans).
- Palette entièrement nouvelle, conforme AA, avec des statuts désaturés mais discriminables.
- Densité moyenne : lisible en présentation, sans perdre le tableau des 36 audits en 10 lignes par page.
- Graphiques SVG natifs cohérents (mêmes six couleurs, mêmes axes, mêmes info-bulles).

## Limites connues

- Les polices serif effectivement rendues dépendent du poste (Georgia/Iowan sur macOS et Windows,
  Charter ou Liberation Serif sur Linux) : le rendu des titres peut varier légèrement.
- Les champs `type="date"` affichent le format du navigateur (ex. `mm/dd/yyyy` sous Chromium en anglais).
- Pas de mode sombre ni d'écran mural ; les sélecteurs sont stylés par dégradés CSS (pas de composant personnalisé).
- La recherche est plein texte simple (sans accents normalisés), l'export et la modification sont simulés par toast.
- Tablette 1024 px : grille repliée sur deux colonnes, navigation sans icônes ; le tableau des audits est compacté
  (en-têtes sur deux lignes, avatars masqués, jauges plus courtes) pour tenir sans défilement horizontal ; en dessous
  de 760 px la mise en page est fonctionnelle mais non optimisée (hors périmètre du brief).

## Écarts d'accessibilité éventuels

- RETEX : les points non encore déroulés restent à opacité 0 et `aria-hidden="true"` (ils occupent leur place dans la
  chronologie) ; c'est le comportement voulu du déroulé point par point, en mouvement réduit comme en mouvement normal.

- Les filets décoratifs (`#D8D1C4` sur ivoire, 1,4 : 1) sont sous 3 : 1 : ils sont purement décoratifs, mais
  l'en-tête de tableau s'appuie sur une ligne en encre pour la structure.
- La colonne « Tendance » et les sparklines sont redondantes avec les valeurs ; les sparklines portent un
  `aria-label` mais pas de description des valeurs point par point.
- Les info-bulles des graphiques sont en `role="tooltip"` sans `aria-describedby` dynamique ; l'information
  reste disponible via `<title>` SVG et les légendes.
- Le petit texte des axes de graphique (11 px à l'échelle du SVG) peut descendre sous 11 px réels sur une
  carte étroite à 1024 px.

## Tests

`node test/test.cjs` : Playwright (Chromium), parcours des six ancres, onglets, filtre, tri, pagination,
recherche, formulaire (erreurs puis succès), RETEX (bouton, clavier, tout dérouler), modale (piège de
focus, Échap), toasts, chargement, `postMessage`, 1024 px, puis le même parcours avec `reducedMotion: 'reduce'`.
Aucune erreur ni avertissement console. Captures dans `test/captures/`. `node test/contraste.cjs` : contrastes.
Revue complémentaire du 31/10 (Playwright) : six ancres à 1440 et 1024 px sans débordement horizontal ni requête
externe ; en mouvement réduit, aucun élément visible à opacité 0 après 1,5 s et tracés à `stroke-dashoffset: 0` ;
parcours Tab complet sur chaque écran avec indicateur de focus mesurable (outline ou box-shadow) sur chaque élément.
