# Maquette E — DATA-DENSE COMPACT

Maquette statique et cliquable de refonte graphique pour « Suivi des audits SMSI », direction libre n° 3 :
**dense et compacte, pour les experts qui veulent tout voir**. Fond clair neutre, texte presque noir, un seul accent
indigo, statuts en pastilles compactes, base typographique 13 px, lignes de tableau de 32 px, KPI en bandeau avec
sparklines, graphiques petits mais nombreux, panneaux repliables. Style d'outil professionnel moderne (famille
Linear / Datadog), sans copie.

Ouvrir `index.html` (en `file://` ou servi) ; routes par ancre : `#/dashboard`, `#/audits`, `#/audit/AUD-07`,
`#/formulaire`, `#/retex`, `#/composants`. La page répond au `postMessage({ type: 'route', hash })` de la page
comparative. Raccourcis clavier : `1` à `6` pour les écrans, `/` pour la recherche globale.

## Intention

Donner au RSSI et aux pilotes un poste de travail où tout tient à l'écran : six KPI sur une seule rangée avec
tendance 12 mois, sept panneaux repliables sur le dashboard (statuts, NC par criticité, actions, risques, évolution,
échéances, indicateurs), une liste de 36 audits en 10 colonnes sans défilement horizontal à 1440 px, une fiche à
onglets dont chaque tableau garde l'en-tête figé. La hiérarchie repose sur la graisse (620 pour les titres et
chiffres, 530 pour les libellés, 450 pour le corps), les capitales espacées à 11 px et les filets 1 px, plutôt que
sur des aplats de couleur : la couleur est réservée aux statuts et aux données.

## Palette (hex)

| Rôle | Hex |
| --- | --- |
| Fond de page | `#F4F5F7` |
| Surface des panneaux | `#FFFFFF` |
| Surface douce (en-têtes de tableau) / surface grise (survol, compteurs) | `#F8F9FB` / `#EEF0F4` |
| Texte principal | `#15181E` |
| Texte secondaire / libellés en capitales | `#4F5664` / `#5F6675` |
| Filet / filet fort / bordure de champ | `#E1E4EA` / `#C5CAD3` / `#8A92A1` |
| Accent indigo (boutons, liens, onglet actif, focus) | `#3949AB` (survol `#2F3D94`, fond `#E9ECF8`, bordure `#B7C0E9`) |
| Succès (Clos, Terminée) | `#1B7A3E` sur `#E6F4EA` |
| Alerte (Rapport attendu, Majeure, À vérifier) | `#A84E0A` sur `#FBEEE2` |
| Erreur (Critique, Bloquée, Ouvert, retard) | `#BE2E2E` sur `#FCE9E9` |
| Info (En cours) | `#1F62B8` sur `#E7EFFA` |
| Violet (En préparation) | `#6A47C2` sur `#EFEAFB` |
| Ambre (Reporté, Mineure) | `#8A6400` sur `#FBF3DC` |
| Neutre (Planifié, Observation, À faire) | `#5B6270` sur `#EEF0F4` |
| Données : série 1 indigo / série 2 orange / vert / violet | `#3949AB` / `#C85A14` / `#1B7A3E` / `#7C5AE0` |
| Données : Critique / Majeure / Mineure / Observation | `#BE2E2E` / `#C85A14` / `#B98000` / `#8A92A1` |
| Piste des barres / grille des graphiques | `#E1E4EA` / `#EEF0F4` |
| Info-bulle (fond / texte secondaire) | `#15181E` / `#AEB4C0` |

Tous les couples texte/fond ont été vérifiés en Node (`test/contraste.cjs`, 44 couples) : ≥ 4,5 : 1 pour le texte,
y compris les libellés 11 px et les pastilles sur fond teinté ; ≥ 3 : 1 pour les bordures de champ, l'anneau de focus
et les remplissages de graphiques. La paire de séries indigo/orange de la courbe d'évolution a été passée au
validateur daltonisme (ΔE ≥ 26 protan/deutan/tritan). Les couleurs de statut ne sont jamais seules : icône + libellé
dans chaque pastille, icône + « J-n » pour les retards, légende + valeurs pour les graphiques.

## Typographie

Inter variable (locale, `../shared/fonts.css`), repli système. Base **13 px** fixe (pas d'échelle fluide), interligne
1,35 (1,2 pour les titres). Échelle : 11 px (capitales espacées 0,05 em pour les en-têtes de tableau, libellés KPI et
titres de section), 12 px (tableaux, boutons, texte secondaire), 13 px (corps), 15 / 18 px (titres), 22 px (chiffres
KPI). Graisses 450 / 530 / 620, crénage -0,02 em sur les titres. Chiffres tabulaires partout où des nombres
s'alignent (tableaux, KPI, dates, pastilles de niveau). Monospace système pour les identifiants (`AUD-07`, `C-13`,
`A.8.13`) et les horodatages RETEX.

## Composants et densité

- **Coquille** : navigation latérale blanche de 208 px (repliable à 52 px en icônes ; repliée d'office sous 1100 px),
  barre supérieure de 40 px avec fil d'Ariane, recherche globale et date de référence.
- **Bandeau KPI** : six tuiles cliquables, libellé en capitales, valeur 22 px, variation sur fond teinté avec flèche,
  sparkline 12 mois avec ligne de cible pointillée.
- **Panneaux** : en-tête 36 px avec titre, compteur, sous-titre, légende et bouton replier/déplier (`aria-expanded`).
- **Tableaux** : lignes 32 px (28 px en densité « Compact », 40 px en « Confort »), en-tête figé (`position: sticky`),
  tri par colonne avec `aria-sort` et flèche indigo, colonnes tronquées avec info-bulle native, pagination 10 par page,
  clic ligne → fiche.
- **Barre d'outils** : recherche plein texte, trois menus de filtres à cases (compte par valeur, « Tout effacer »,
  fermeture Échap ou clic extérieur), jetons des filtres actifs, sélecteur de densité, compte de résultats
  `aria-live`.
- **Pastilles** : 20 px de haut, icône 11 px + libellé, variante pleine (statuts) et contour (référentiels,
  priorités, statuts de constat).
- **Graphiques SVG natifs** : barres horizontales (audits par statut, types de constat, acteurs), colonnes (types
  d'audit, criticités, gravité RETEX), donut (NC par criticité, segments espacés de 2 px, valeur au centre), barre
  segmentée (actions), courbe à deux séries avec aire à 10 % et colonnes de survol (évolution), matrice 4 × 4
  (risques), jauges avec repère de cible (indicateurs), sparklines. Toutes les marques sont focusables et portent
  une info-bulle (`role="tooltip"`).
- **Formulaire** : deux colonnes, champs 30 px, validation au blur et à l'envoi, `aria-invalid`, `aria-describedby`
  (aide + erreur), bandeau `role="alert"`, résumé du nombre d'erreurs, bouton désactivé avec roue pendant l'envoi,
  bandeau de succès focalisé.
- **RETEX** : chronologie de 11 points déroulée par « Point suivant », « Tout dérouler », clic sur un point ou clavier
  (flèches, Entrée, Origine, Fin), barre d'avancement, point courant `aria-current="step"`, gravité en pastille icône +
  libellé, colonne latérale (impact, gravité par événement, enseignements, acteurs).
- **Modale** : `role="dialog"`, `aria-modal`, piège de focus (Tab / Maj+Tab), Échap et clic sur le voile, retour du
  focus au déclencheur, récapitulatif chiffré.
- **Toasts** : région `aria-live="polite"`, bouton de fermeture nommé, disparition à 6 s, quatre types avec icône.
- **État vide** et **squelette** `aria-busy` à brillance limitée à deux passages.

## Animations

Toutes en `transform` / `opacity` (et `stroke-dasharray`/`stroke-dashoffset` pour le SVG), courbe
`cubic-bezier(0.2, 0.7, 0.2, 1)`.

| Animation | Durée |
| --- | --- |
| Entrée d'écran et de panneau d'onglet (fondu + 4 px) | 260 / 180 ms |
| Indicateur d'onglet qui glisse (`translateX` + `scaleX`) | 260 ms |
| Barres de progression et barres horizontales (`scaleX` depuis la gauche) | 900 ms |
| Colonnes (`scaleY` depuis la base), segments de donut et jauges (`stroke-dasharray`) | 900 ms |
| Courbe d'évolution tracée (`stroke-dashoffset`) | 900 ms |
| Menu de filtre (fondu + léger `scale`) | 180 ms |
| Modale (fondu + 8 px + `scale 0.98`), voile (fondu) | 260 / 180 ms |
| Toasts : entrée depuis la droite 260 ms, sortie 180 ms | |
| Point RETEX révélé : fondu du point et du détail, puce `scale 0.85 → 1` | 260 ms |
| Squelette : brillance `translateX`, 1,2 s, deux passages | |
| Roue d'envoi du formulaire (rotation, pendant 1,1 s seulement) | |
| Chevron de repli (rotation) | 180 ms |

`prefers-reduced-motion: reduce` : toutes les animations et transitions passent à 1 ms, les tracés SVG s'affichent
complets, le squelette n'a plus de brillance, la roue est immobile, les toasts disparaissent sans glissement, le
défilement vers le point RETEX est instantané.

## Points forts

- Tout le pilotage tient dans un écran de 1440 × 900 avant le premier défilement (KPI + trois panneaux) ; la liste
  complète des 36 audits tient en dix colonnes sans défilement horizontal.
- Un seul accent : les couleurs n'apparaissent que là où elles portent une information (statut, criticité, série).
- Cibles ≥ 32 px malgré la densité (boutons, liens de navigation, onglets, pagination, cases des menus) ; seuls les
  boutons de fermeture des toasts et jetons sont à 28 / 16 px (voir écarts).
- Clavier complet : raccourcis d'écran, onglets avec flèches, RETEX au clavier, menus fermables à Échap, piège de
  focus de la modale, anneau de focus double (blanc + indigo) visible sur toutes les surfaces.

## Limites connues

- Aucune persistance : filtres, densité, état des panneaux et avancement RETEX sont perdus au rechargement (voulu).
- Le choix des colonnes, les périodes « 30 j / Cycle », l'export et les notifications ne sont que des toasts.
- Les sélecteurs de date utilisent le rendu natif du navigateur (affichage `mm/dd/yyyy` sous une locale anglaise).
- Sous 1100 px la navigation se replie en icônes sans libellés visibles (info-bulles natives absentes) ; la
  présentation n'est pas prévue pour mobile.
- Les sparklines des KPI « Audits en cours », « NC ouvertes », « Actions en retard » et « Risques élevés » utilisent
  des séries illustratives (FAKE ne fournit pas leur historique) ; leur dernier point est la valeur réelle.
- Pas de mode sombre.

## Écarts d'accessibilité éventuels

- Bouton de fermeture des toasts 28 × 28 px et croix des jetons de filtre 16 × 16 px (sous la cible de 32 px retenue
  pour le reste ; les toasts se ferment aussi d'eux-mêmes et les filtres se retirent depuis le menu).
- Les points non encore révélés du RETEX sont rendus à 38 % d'opacité : lisibles comme « à venir » mais leur
  contraste est volontairement sous 4,5 : 1 tant qu'ils ne sont pas déroulés (le texte complet apparaît au clic).
- Le voile de la modale (`rgb(21 24 30 / 45 %)`) assombrit le fond sans le rendre inaccessible aux lecteurs d'écran
  autrement que par `aria-modal` (pas d'`inert` sur le reste de la page).
- Les info-bulles de graphique suivent la souris ; au clavier elles s'affichent au focus de chaque marque, mais une
  marque SVG focalisée n'a pas d'anneau de focus dessiné autour d'elle (seule l'info-bulle apparaît).
- Les cellules tronquées exposent le texte complet par `title` (info-bulle native, non accessible au toucher).

## Tests

`node design-mockups/E-data-dense/test/verifier.cjs` : Playwright (Chromium), six ancres, onglets, filtres, tri,
recherche, pagination, densité, clic de ligne, modale (piège de focus, Échap, retour de focus), formulaire (erreurs puis
succès, bouton désactivé), RETEX (clic et clavier), toasts, squelette, `postMessage`, raccourci clavier, cibles
cliquables, vue 1024 px sans débordement horizontal, contexte `reducedMotion: 'reduce'` ; aucune erreur ni
avertissement de console. Captures dans `test/`.
`node design-mockups/E-data-dense/test/contraste.cjs` : 44 couples de couleurs.
