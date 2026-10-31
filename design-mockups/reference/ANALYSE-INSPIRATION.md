# Analyse des images de référence (style préféré du commanditaire)

Le dossier `design-mockups/reference/` n'existait pas dans le dépôt : il a été créé à partir des cinq images jointes
à la demande, renommées par contenu. Aucune vidéo ni GIF n'a été fourni ; la section « Mouvement » extrapole donc
le mouvement à partir des images fixes.

| Fichier | Contenu |
| --- | --- |
| `01-pastille-confirmation.jpg` | Pastille translucide « confirmation » sur une photo chaude (cabine beige) : icône de validation, libellé en capitales, identifiant, point vert et heure. |
| `02-pastille-interrupteur.jpg` | Même pastille, en interrupteur à deux positions, la position active étant une capsule plus claire. |
| `03-dashboard-clair-cartes.jpg` | Tableau de bord : cartes blanches très arrondies sur fond marine dégradé, graphiques sarcelle → violet, chiffres fins. |
| `04-dashboard-sombre-jauges.webp` | Tableau de bord sombre : jauges circulaires pointillées, barres translucides, courbe violette lumineuse, boutons capsule colorés. |
| `05-planches-infographie-sombre.webp` | Douze planches sombres : dégradés rose → orange → violet, anneaux, timeline, nuages de points, vagues. |

## 1. Palette extraite (hex approximatifs) et usage

### Fonds

| Usage | Hex | Vu dans |
| --- | --- | --- |
| Fond marine profond (page) | `#1C2B4A` → `#0F1A33` (dégradé vertical) | 03, 04 |
| Fond ardoise sombre (planches) | `#2B2F45` → `#1F2238` | 05 |
| Carte claire | `#FFFFFF` avec ombre portée douce, rayon ~24 px | 03 |
| Carte sombre | `#232A48` à 60 % d'opacité, bord 1 px blanc 8 % | 04, 05 |
| Verre chaud (pastilles) | blanc à 18–28 % sur fond photo, flou arrière, bord blanc 35 % | 01, 02 |
| Beige / sable de la photo | `#C9A878`, `#A8906C`, `#E8D6B8` | 01, 02 |

### Accents

| Usage | Hex |
| --- | --- |
| Sarcelle principale (données, boutons) | `#2EC4B6` → `#1FA89C` ; clair `#7EE0D6` |
| Violet (dégradé de données, courbe lumineuse) | `#6D5BD0` → `#8F7BFF` ; lumineux `#B388FF` |
| Dégradé signature sarcelle → violet | `linear-gradient(90deg, #2EC4B6, #6D5BD0)` |
| Corail / rouge (bouton « Choro », alerte) | `#F0564A` → `#FF7A6B` |
| Orange / or (jauge, bouton « Reset ») | `#F2A33A`, `#E7B548` |
| Rose infographie | `#FF4F8B` → `#FF8A5B` (dégradé rose → orange) | 
| Vert de statut (point « en direct ») | `#2FD37A` |
| Texte sur fond sombre | `#FFFFFF` ; secondaire `#A9B4D0` ; tertiaire `#6E7A99` |
| Texte sur carte claire | titres `#2B3350`, chiffres `#334066`, légendes `#8A93AD` |

### Usage des couleurs

- Le **fond** est toujours sombre et froid (marine, ardoise) ou une **photo chaude** : les contenus flottent dessus.
- Les **accents** servent les données (barres, courbes, jauges) et les actions (boutons capsule). Un seul dégradé
  signature (sarcelle → violet) structure tous les graphiques ; les couleurs chaudes (corail, or, rose) ponctuent.
- Les **statuts** sont portés par un point coloré + libellé (image 01), jamais par la couleur seule.
- Beaucoup de **blanc translucide** : bords, reflets, surfaces de verre, grilles de fond.

## 2. Typographie

- Famille probable : linéale géométrique à grandes chasses (Montserrat / Poppins pour 03 et 05, Inter / SF pour 01, 02).
  Transposition locale : **Inter** (déjà embarquée dans l'application) avec `letter-spacing` élargi sur les légendes.
- **Chiffres clés** : très grands (3 à 4 × le corps), graisse **light à regular (300–400)**, interlignage serré,
  chiffres tabulaires. Un espace fin sépare les milliers (« 7 374 »).
- **Légendes** : capitales, 10–11 px, `letter-spacing 0.12–0.18em`, couleur tertiaire, graisse 500–600.
- **Titres de carte** : 14–16 px, graisse 600, couleur du texte principal, sans soulignement.
- **Boutons et interrupteurs** : capitales ou titre, graisse 600, `letter-spacing 0.06em`.
- Hiérarchie : *chiffre énorme → légende minuscule → titre moyen*. Peu de niveaux, fort contraste de taille.

## 3. Structure

- **Navigation** : absente des images (ce sont des planches de widgets). Le style suggère une barre latérale sombre
  très étroite (icônes) ou une barre haute, pour laisser la grille respirer.
- **Grille** : 3 à 4 colonnes, cartes de hauteurs différentes qui s'emboîtent (bento) ; gouttières de 20–24 px ;
  marge extérieure large (40–56 px).
- **Densité** : moyenne à forte à l'intérieur des cartes (plusieurs micro-graphiques par carte), mais le fond sombre et
  les rayons généreux donnent une impression d'air. Rapport vide / contenu d'environ 40 / 60.
- **Alignement** : contenu centré dans les cartes de KPI, aligné à gauche dans les listes ; les chiffres sont
  systématiquement au-dessus de leur légende.

## 4. Composants caractéristiques

- **Cartes** : rayon 20–28 px ; claires avec ombre `0 20px 60px rgba(10,20,50,.25)` ; sombres en verre
  (fond 10–15 % blanc, bord 1 px blanc 8–12 %).
- **Pastilles / capsules** (01, 02) : hauteur 56–72 px, rayon total, fond blanc translucide flouté, bord blanc 30 %,
  texte blanc, icône à gauche, métadonnées à droite séparées par un point coloré.
- **Interrupteur segmenté** (02) : capsule contenant deux options, l'option active est une capsule interne plus claire
  qui glisse.
- **Boutons capsule** (03, 04) : fond plein coloré (sarcelle, corail, or, violet), texte blanc en capitales, hauteur 28–32 px,
  ombre colorée douce.
- **Jauges circulaires pointillées** (04) : anneau de points, chiffre au centre, arc actif coloré.
- **Anneaux concentriques** (03) : plusieurs arcs imbriqués, un par série.
- **Barres** : arrondies aux extrémités, dégradé vertical, fond de piste gris clair ou blanc 8 %.
- **Sparklines** : mini-histogrammes et mini-courbes alignés à droite des libellés.
- **Courbe aire** : remplissage dégradé vers transparent, ligne 2–3 px avec halo lumineux (04).
- **Matrice de points** (03) : grille de pastilles, couleur = valeur ; **grille à points** de fond (04).
- **Tableaux** : lignes sans bordures, séparation par espacement ; valeurs chiffrées alignées à droite.
- **Chips de filtres** (03, 04) : capsules contour 1,5 px, texte en capitales, la sélection devient pleine.

## 5. Effets

- **Rayons** : grands (20–28 px cartes, total pour pastilles et boutons).
- **Ombres** : portées, longues, colorées par le fond (`rgba(10,20,50,.3)`), jamais noires et dures.
- **Bordures** : 1 px blanc à faible opacité sur le sombre ; aucune sur le clair.
- **Dégradés** : signature sarcelle → violet sur les données ; rose → orange sur les infographies ; fond marine
  dégradé vertical ; légers reflets blancs en haut des pastilles.
- **Transparence et flou** : `backdrop-filter: blur(16–24px)` sur les pastilles, surfaces blanc 10–25 %.
- **Lueur** : halo coloré derrière les courbes (`drop-shadow(0 0 8px couleur)`), points lumineux sur les jauges.
- **Iconographie** : traits fins (1,5 px), monochromes blancs, cercles de validation ; rare.
- **Textures** : grille de points fine en fond (04), traits de repère verticaux pâles.

## 6. Mouvement (extrapolé des images fixes)

| Famille | Animation suggérée | Rythme | Intensité |
| --- | --- | --- | --- |
| Apparition | cartes en cascade : opacité 0 → 1 et translation 16 px vers le haut, 40–80 ms entre cartes | 400–600 ms, courbe `cubic-bezier(.2,.7,.2,1)` | moyenne |
| KPI | compteur de 0 à la valeur (ease-out), chiffre qui « se pose » | 900–1 200 ms | forte |
| Barres | montée depuis la base (scaleY) avec décalage par barre | 600–900 ms | moyenne |
| Courbes | tracé progressif (`stroke-dashoffset`), aire qui se révèle ensuite | 1 000–1 200 ms | forte |
| Jauges / anneaux | remplissage de l'arc, points qui s'allument un à un | 800–1 200 ms | forte |
| Pastilles de statut | point qui pulse une fois à l'apparition, coche qui se dessine | 300–400 ms | faible |
| Interrupteur | la capsule active glisse (transform), texte qui change de contraste | 200–250 ms | faible |
| Survol | carte qui s'élève (translateY −4 px, ombre plus longue), lueur accentuée | 150–200 ms | faible |
| Info-bulle | apparition par fondu + translation 6 px, suit le pointeur | 120–160 ms | faible |
| Fond | dérive très lente du dégradé ou des halos (facultatif, coupé en mouvement réduit) | 20–40 s | très faible |
| Navigation | transition entre écrans : fondu croisé + glissement 12 px | 250–350 ms | faible |
| RETEX | courbe qui se trace point par point, bulle d'information qui s'ouvre près du point actif, grille qui défile façon cotation | 150–300 ms par point | forte |

Le style appelle un mouvement **fluide, directionnel et court** : rien ne tourne en boucle, tout « arrive » une fois
puis se stabilise. Les éléments de données (barres, arcs, courbes) sont les vedettes ; le reste reste sobre.

## 7. Traits qui rendent ce style reconnaissable

1. Fond marine ou ardoise profond, dégradé, sur lequel flottent des cartes très arrondies.
2. Dégradé signature **sarcelle → violet** appliqué aux données.
3. Chiffres clés énormes et fins au-dessus de légendes minuscules en capitales espacées.
4. Capsules translucides (verre flouté, bord blanc léger) pour les statuts, filtres et interrupteurs.
5. Jauges circulaires pointillées et anneaux concentriques plutôt que camemberts.
6. Lueur douce derrière les courbes et les points actifs.
7. Boutons capsule pleins aux couleurs franches (sarcelle, corail, or) avec texte en capitales.
8. Grilles de points et filets blancs très pâles comme seule « bordure ».

## 8. Points de vigilance accessibilité (à traiter dans la maquette F)

- Les légendes tertiaires (`#6E7A99` sur `#1C2B4A`) atteignent ~3,2 : 1 ; les remonter à `#A9B4D0` (≥ 7 : 1) ou
  les réserver aux textes décoratifs de plus de 18 px.
- Le texte blanc sur sarcelle `#2EC4B6` n'atteint que ~2,1 : 1 : utiliser un sarcelle assombri (`#157F76`) pour les
  boutons pleins, ou un texte marine sur sarcelle clair.
- Les pastilles en verre sur photo dépendent du fond : prévoir un fond de repli uni à 85 % d'opacité.
- Les chiffres en graisse 300 : ne pas descendre sous 28 px, ou passer en 400.
