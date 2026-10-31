# Maquette D — « SOC sombre »

Direction libre n° 2 : un poste de supervision de type SOC (centre opérationnel de sécurité) pour
« Suivi des audits SMSI ». Mode sombre unique, barre d'état permanente, grille dense, cartes fines à
bord faiblement lumineux, chiffres et identifiants en monospace. Maquette statique et cliquable,
sans build ni dépendance, alimentée par `../shared/fake-data.js` (aucune persistance).

## Intention

Donner au RSSI et à la direction une salle de contrôle plutôt qu'un dossier : l'état du SMSI se lit en
un coup d'œil depuis la barre d'état (horloge fixe 31/10/2026 09:41, état « dégradé / vigilance /
nominal », compteurs), puis se détaille dans des cartes denses où la couleur ne sert qu'à signaler
(cyan = actif, vert = conforme, ambre = vigilance, rouge = critique). Les micro-interactions restent
sobres (fondus, tracés qui se dessinent, indicateur d'onglet qui glisse) : les animations poussées
sont réservées à la maquette F.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Coquille : sprite d'icônes SVG, barre d'état, navigation latérale, conteneurs (info-bulle, toasts, modale). |
| `tokens.css` | Jetons uniquement : couleurs, séries de graphiques, typographie, espacements, rayons, ombres/lueurs, durées et courbes. |
| `styles.css` | Styles de la maquette, responsive 1440 / 1024 px, `prefers-reduced-motion`. |
| `app.js` | Routeur par ancre + `postMessage`, six écrans, graphiques SVG natifs, interactions. |
| `test/verifier.cjs` | Scénario Playwright (1440, 1024, mouvement réduit) : six ancres, onglets, filtres, tri, pagination, formulaire, RETEX, modale, toasts, console vide. |
| `test/contraste.cjs` | Calcul de luminance WCAG sur tous les couples texte/fond utilisés. |

Les scripts de test sont en `.cjs` parce que le dépôt déclare `"type": "module"`.

## Palette (hex)

| Rôle | Hex |
| --- | --- |
| Fond de page | `#0B1220` |
| Fond navigation | `#0E1627` |
| Barre d'état | `#0A101C` |
| Surface (cartes) | `#16203A` |
| Surface élevée (boutons, info-bulle, toasts) | `#1C2846` |
| Surface sélection (nav active, pagination) | `#223058` |
| Fond de saisie | `#0F1830` |
| Bordure 1 px | `#2B3A5F` |
| Bordure forte | `#3B4E7C` |
| Bordure de champ | `#5B6E98` |
| Texte | `#E6EDF7` |
| Texte secondaire | `#A9B6CC` |
| Texte atténué | `#8E9DB8` |
| Texte inverse (sur bouton primaire) | `#071019` |
| Cyan (accent, texte) | `#5EE1F0` |
| Cyan plein (bouton primaire) | `#22C8DD` |
| Vert (succès, conforme) | `#4ADE80` |
| Ambre (vigilance) | `#F6B860` |
| Rouge (critique, erreur) | `#FF7B7B` |
| Bleu (information) | `#8DC2FF` |
| Violet (reporté, HDS) | `#C1ABFF` |
| Gris (neutre) | `#B4BED1` |

Séries de graphiques : cyan `#5EE1F0`, violet `#C1ABFF`, ambre `#F6B860`, vert `#4ADE80`, bleu `#8DC2FF`,
gris `#8E9DB8` ; grille à 14 % d'opacité.

Contrastes mesurés (`node test/contraste.cjs`) : texte principal 10,9 à 15,9 : 1 ; texte secondaire
6,3 à 9,1 : 1 ; texte atténué 4,7 à 6,8 : 1 ; accents 5,1 à 12 : 1 sur toutes les surfaces ; texte des
badges ≥ 4,6 : 1 sur leur fond teinté ; texte inverse sur cyan plein 9,5 : 1 ; bordure de champ ≥ 3,2 : 1
sur son fond.

## Typographie

- Inter variable (locale, `../shared/fonts.css`), repli `system-ui`. Corps 13 px, titres 20 px / 600,
  titres de carte 12 px en capitales espacées (0,08 em).
- `ui-monospace, SFMono-Regular, Menlo, Consolas` pour l'horloge, les identifiants (`AUD-07`, `C-13`,
  `INC-2026-014`), les chiffres clés, les dates, les axes des graphiques, les compteurs et le journal.
  Chiffres tabulaires.

## Animations (transform, opacity, stroke-dashoffset uniquement)

| Élément | Effet | Durée |
| --- | --- | --- |
| Changement d'écran (à partir du second rendu) | fondu + translation 6 px | 360 ms |
| Indicateur d'onglet | translation + mise à l'échelle horizontale | 220 ms |
| Barres (SVG) | `scaleX` depuis la gauche | 900 ms |
| Donut, jauge, courbes, sparklines | tracé par `stroke-dashoffset`, points en fondu différé | 900 ms |
| Barres de progression CSS | `scaleX` par variable `--valeur` | 900 ms |
| Points RETEX | fondu + translation 8 px à la révélation, halo sur le point courant | 360 ms |
| Toasts | glissement latéral à l'entrée, fondu à la sortie | 360 / 220 ms |
| Modale | fondu du voile, fondu + `scale(0.98)` de la boîte | 220 ms |
| Squelette de chargement | scintillement en boucle, uniquement pendant le chargement simulé | 1,4 s |
| Boutons, liens de navigation | fond et bordure | 150 ms |

Sous `prefers-reduced-motion: reduce`, toutes les durées passent à 1 ms, les tracés sont affichés
complets, le squelette devient statique et le défilement automatique du RETEX est désactivé.

## Points forts

- Lecture d'état immédiate : barre d'état, KPI avec icône + libellé, badges capsules contour avec icône.
- Densité maîtrisée : six KPI, six cartes de graphiques et listes sur un seul écran 1440 px.
- Graphiques SVG natifs générés par `app.js` : barres, donut, jauge semi-circulaire, courbe à aire,
  sparklines, courbe de gravité du RETEX ; info-bulles au survol et au focus clavier.
- Liste des 36 audits : recherche plein texte insensible aux accents, trois filtres, tri par colonne avec
  `aria-sort`, pagination 10/page, clic sur la ligne ou lien clavier vers la fiche.
- Fiche : onglets `role="tablist"` avec flèches, Début, Fin ; constats, plan d'actions avec avancement,
  historique en chronologie.
- Formulaire : validation au blur et à l'envoi, `aria-invalid` + `aria-describedby`, récapitulatif des
  erreurs avec liens vers les champs, bouton désactivé pendant l'envoi, bandeau et toast de succès, aperçu
  en direct de la fiche.
- RETEX : déroulé point par point (boutons, flèches, Espace, Début/Fin), compteur `aria-live`, gravité
  icône + libellé, courbe de gravité qui se remplit en parallèle, enseignements à la fin.
- Modale `role="dialog"` avec piège de focus, Échap, clic sur le voile, retour du focus ; toasts dans une
  région `aria-live` (erreurs en `role="alert"`), fermeture manuelle, survol qui suspend la fermeture.

## Limites connues

- Les dates natives (`<input type="date">`) s'affichent selon la locale du navigateur ; la capture
  Chromium headless montre `mm/dd/yyyy`, un navigateur francophone affiche `jj/mm/aaaa`.
- Aucun mode clair (non demandé) ; les captures d'écran de la page comparative ne sont pas produites ici.
- Les toasts persistent lors d'un changement d'écran (choix assumé : l'état « SOC » ne s'efface pas) ;
  ils disparaissent au bout de 6 s.
- En dessous de 1024 px, la mise en page n'est pas optimisée (tablette 1024 px seulement).
- Les données sont recalculées à chaque ouverture ; la création d'un audit (`AUD-37`) est simulée.
- `getTotalLength` n'est pas disponible pour les tracés situés dans un panneau masqué : ils utilisent une
  longueur par défaut (sans effet visible, le tracé est affiché complet).

## Écarts d'accessibilité éventuels

- Les bordures de cartes (1 px, 1,4 à 1,7 : 1) sont décoratives et ne portent aucune information ; les
  bordures de champs respectent 3 : 1 sur leur fond.
- Les éléments de graphiques porteurs d'info-bulle sont focusables (`tabindex="0"`, `role="img"`,
  `aria-label`), ce qui allonge la tabulation sur le dashboard (une trentaine d'arrêts).
- Les sparklines des KPI et des indicateurs sont `aria-hidden` : la valeur et la tendance sont données en
  texte à côté.
- Les lignes du tableau sont cliquables à la souris ; au clavier, c'est le lien sur l'intitulé qui ouvre la
  fiche (une seule cible par ligne, volontairement).
- Les lueurs (`text-shadow`, `drop-shadow`) sont purement décoratives et n'affectent pas le contraste
  mesuré du texte.
