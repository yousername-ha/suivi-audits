# Synthèse des maquettes de refonte graphique

Six maquettes statiques et cliquables (HTML/CSS/JS natifs, données fictives partagées), sur les six mêmes écrans :
dashboard de pilotage SMSI, liste des audits, fiche d'un audit, formulaire, RETEX, composants transverses.
Rien n'a été appliqué à l'application ; cette synthèse estime seulement l'effort pour le faire.

- Ouvrir `design-mockups/index.html` (page comparative), ou chaque `X-*/index.html` directement, en `file://` ou avec
  `npx serve design-mockups`.
- Captures : `screenshots/<maquette>/<écran>.png`, planche `screenshots/planche-comparative.png`, animations de F :
  `screenshots/F-inspiration-dashboard.gif` et `screenshots/F-inspiration-retex.gif` (et `.webm`).
- Documents : `AUDIT-VISUEL.md` (état des lieux), `reference/ANALYSE-INSPIRATION.md` (analyse des références),
  `shared/BRIEF-COMMUN.md` (règles communes), un `README.md` par maquette.

## 1. Tableau comparatif

| Critère | A · Fidèle | B · Fidèle épurée | C · Institutionnel santé | D · SOC sombre | E · Data-dense compact | F · Inspiration |
| --- | --- | --- | --- | --- | --- | --- |
| Direction | charte Sauge actuelle, mise en page modernisée | Sauge adoucie, blanc, sans bordures | papier ivoire, bleu institutionnel, serif | sombre natif, cyan/ambre/rouge, monospace | clair neutre, 13 px, indigo unique | marine dégradé, verre, sarcelle → violet |
| Fonds / surfaces | `#F5F6F2` / blanc | `#FBFCFB` / sauge `#F3F7F4` | `#FAF8F3` / blanc | `#0B1220` / `#16203A` | `#F4F5F7` / blanc | `#1C2B4A` → `#0F1A33` / verre + blanc |
| Primaire | vert `#245F4C` | vert `#245F4C` | bleu `#1F3A5F`, terre `#A84E24` | cyan `#5EE1F0` | indigo `#3949AB` | sarcelle `#2EC4B6`, violet `#6D5BD0` |
| Typographie | Inter, titres 650 | Inter, chiffres 2,75 rem | serif système + sans système | Inter + monospace | Inter 13 px, graisses 450–620 | Inter, chiffres 44 px graisse 300 |
| Densité | moyenne | faible | moyenne | forte | très forte | moyenne |
| Mode sombre | non | non | non | natif (seul mode) | non | natif (seul mode) |
| Animations | sobres (150–360 ms) | sobres | sobres | sobres | sobres | complètes + interrupteur on/off |
| Dépaysement pour l'utilisateur actuel | nul | faible | moyen | fort | moyen | fort |
| Lisibilité des contenus denses | bonne | bonne | bonne | bonne (contrastes élevés) | très bonne | bonne (cartes claires) |
| Adéquation aux références du commanditaire | faible | faible | nulle | partielle (sombre) | faible | forte |
| Risque technique à l'application | faible | faible | faible | moyen (mode sombre complet) | moyen (densité Mantine) | élevé (verre, animations, sombre) |
| Vérification Playwright (6 écrans, console, mouvement réduit, clavier) | voir § 3 | voir § 3 | voir § 3 | voir § 3 | voir § 3 | voir § 3 |

Toutes les maquettes : contraste AA vérifié par calcul (texte ≥ 4,5 : 1, composants ≥ 3 : 1), focus visible, statuts
toujours couleur + icône ou libellé, `prefers-reduced-motion` respecté, animations limitées à `transform` /
`opacity` (et `stroke-dashoffset`), aucune dépendance externe.

## 2. Estimation de l'effort pour appliquer chaque maquette à l'application

### Ce que toute transposition touche (socle commun)

| Fichier ou zone | Rôle aujourd'hui | Travail commun |
| --- | --- | --- |
| `packages/ui/src/tokens.ts` | source unique des couleurs, rayons, espacements, couples de contraste | reporter les `tokens.css` de la maquette retenue (gammes à 10 nuances, `ETATS`, `FONDS`), étendre `COUPLES_CONTRASTE` |
| `packages/ui/src/theme.ts` | thème Mantine, variantes de composants, résolveur de variables CSS | rayons, ombres, variantes par défaut (Card, Button, Badge, Tabs, Modal) |
| `apps/web/scripts/mantine-css-vars.ts` → `src/generated/mantine-vars.css` | variables CSS statiques (CSP) | régénérer ; ajouter les nouvelles variables (`--suivi-*`) |
| `packages/ui/src/styles.css` (2 883 lignes) | coquille, navigation, cartes, tableaux, formulaires, tableau de bord « verre », identités 08 / Clair | réécrire les sections coquille, navigation, cartes, boutons, badges, tableaux, onglets, modales ; retirer les identités concurrentes |
| `apps/web/src/app.css` (4 415 lignes) | cartographie, parcours ISO, RETEX, revue de direction | adapter les variables consommées ; RETEX selon la maquette |
| `packages/ui/src/graphiques.tsx`, `tableau-de-bord.tsx` | graphiques SVG et dalles du tableau de bord | reprendre les formes (anneaux, barres, courbes) et les couleurs |
| `apps/web/src/components/Layout.tsx`, `TableauDeBord.tsx`, `pages/Home.tsx` | coquille, accueil | réorganiser l'accueil selon la maquette (KPI, graphiques, échéances) |
| Tests | `packages/ui/test` (contraste), captures Playwright, recette | mettre à jour les couples de contraste et les captures de référence |

Hypothèses : un développeur front connaissant le dépôt ; CSP stricte conservée (aucun style en ligne, variables CSS
posées en JS) ; pas de nouvelle dépendance ; mode sombre existant à conserver sauf mention.

| Maquette | Effort estimé | Détail des zones spécifiques |
| --- | --- | --- |
| **A · Fidèle** | **4 à 6 jours** | jetons inchangés ; `styles.css` : cartes sans bordure, grille d'accueil, en-têtes de tableau relevés ; `Home.tsx` et `TableauDeBord.tsx` : réduction à 5 KPI + 3 graphiques + échéances ; `graphiques.tsx` : anneaux et courbes redimensionnés. Aucun impact sur la cartographie ni le RETEX. |
| **B · Fidèle épurée** | **6 à 9 jours** | nouvelles nuances dans `tokens.ts` (sauge clair, encre 80/60 %) ; navigation claire dans `Layout.tsx` + section coquille de `styles.css` (la nav sombre est référencée par ~40 règles) ; suppression des bordures des `Card` et `Table` (variantes Mantine) ; mode sombre à revoir car la hiérarchie repose sur des fonds très clairs. |
| **C · Institutionnel santé** | **8 à 12 jours** | palette complète à remplacer (`VERT`, `ENCRE`, `GRIS`, `ETATS`, fonds) et couples de contraste à recalculer ; serif pour les titres (`headings.fontFamily`) ; numérotation des sections et cartouches = nouveaux composants dans `components.tsx` ; filets et angles droits dans toutes les sections de `styles.css` ; cartographie (`CARTE`) et tableau de bord verre à réaccorder. |
| **D · SOC sombre** | **10 à 14 jours** | mode sombre devient le mode principal : `FONDS.sombre`, `SOMBRE`, `ETATS` et `CARTE.sombre` à refondre ; barre d'état = nouveau composant dans `Layout.tsx` ; monospace pour identifiants (`POLICE_MONO`) dans les tableaux ; densité des `Table` ; le mode clair devrait être retiré ou redessiné (coût supplémentaire de 3 à 5 jours si conservé) ; vérification 1.4.11 sur tous les graphiques sombres. |
| **E · Data-dense compact** | **9 à 13 jours** | base 13 px et échelle fluide (`html { font-size }`) à revoir avec les préférences de taille existantes ; `Table` : hauteur de ligne 32 px, en-têtes figés déjà présents (`.data-table`) ; panneaux repliables = nouveau composant ; barre d'outils compacte à la place de `Filtres.tsx` ; palette neutre + indigo dans `tokens.ts` ; cibles tactiles à préserver (préférence de densité). |
| **F · Inspiration** | **15 à 22 jours** | fond marine dégradé et cartes de verre (`backdrop-filter`) : généraliser et optimiser la dalle existante (`.tdb-dalle`) à toutes les cartes, avec repli opaque ; deux familles de cartes (verre / claire) = variantes `Card` ; palette complète + sarcelle assombri pour AA ; navigation haute en capsule à la place de la nav latérale (`Layout.tsx`, ~300 lignes) ; animations : cascade, compteurs, tracés, `IntersectionObserver`, View Transitions, interrupteur global (préférence utilisateur à stocker dans `settings.ts`) ; `graphiques.tsx` : jauges pointillées, anneaux concentriques, courbes à halo ; RETEX déjà proche (courbe néon) mais à réaligner ; audit de performance (flou + ombres sur 15 cartes) et accessibilité (contraste sur verre). Mode clair à redessiner ou à retirer. |

Les fourchettes couvrent la mise en œuvre, les tests de contraste et la mise à jour des captures de recette ; elles
n'incluent ni la recette utilisateur ni la documentation (ADR, inventaire fonctionnel).

## 3. Résultats des vérifications

Voir § 3 complété ci-dessous après les vérifications Playwright.

## 4. Recommandation

Voir § 4 complété ci-dessous.
