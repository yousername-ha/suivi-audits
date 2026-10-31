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

Chaque maquette a été construite par un agent, puis vérifiée et corrigée par un second agent indépendant
(Playwright Chromium, 1440 × 900 et 1024 × 768), avant un contrôle final global (`scripts/capture.cjs` :
36 écrans, zéro erreur ni avertissement console ; contrôle en `prefers-reduced-motion: reduce` : aucun élément
visible laissé à opacité 0, hormis les points du RETEX non encore déroulés dans F, qui le sont volontairement).

| Vérification | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| Six écrans sans erreur console | oui | oui | oui | oui | oui | oui |
| Onglets, filtres, tri (`aria-sort`), recherche, pagination, ligne → fiche | oui | oui | oui | oui | oui | oui |
| Formulaire : erreurs reliées, `aria-invalid`, succès | oui | oui | oui | oui | oui | oui |
| Modale (`role=dialog`, piège de focus, Échap, retour du focus) ; toasts `aria-live` | oui | oui | oui | oui | oui | oui |
| RETEX déroulable point par point et « Tout dérouler » | oui | oui | oui | oui | oui | oui |
| `postMessage` de la page comparative | oui | oui | oui | oui | oui | oui |
| Mouvement réduit : écrans complets | oui | oui | oui | oui | oui | oui (+ interrupteur) |
| Focus clavier visible, y compris formes SVG et champs date | oui | oui | oui | oui | oui | oui |
| Contraste texte minimum mesuré | 4,94 : 1 | 4,75 : 1 | 4,76 : 1 | 5,19 : 1 | 4,74 : 1 | 4,52 : 1 |
| Contraste composant minimum | 3,08 : 1 | 3,24 : 1 | 3,16 : 1 | 3,17 : 1 | 3,13 : 1 | 3,73 : 1 |
| Aucun `style=` statique, aucune ressource externe | oui | oui | oui | oui | oui | oui |

Corrections apportées par la vérification (détail dans chaque README) : contrastes relevés sur quelques couples
limites (texte tertiaire de C, violet clair de F, compteur de navigation de A, ocre et gris chaud de C), anneau de
focus sur les formes SVG et sur les champs date (Chromium focalise le bouton interne), éléments masqués passés de
`opacity: 0` à `visibility: hidden` (E, F), débordement horizontal du tableau à 1024 px corrigé (C), carte
« Enseignements » du RETEX retirée du flux tant qu'elle n'est pas révélée (A).

Écarts assumés et documentés : cibles tactiles de 28 à 32 px sur poste de travail (A, E), pas de tableau de données
sous les graphiques (valeurs données en texte et en info-bulles), champs `type=date` natifs affichés selon la
locale du navigateur (D), filets et numéros décoratifs sous 3 : 1 (C), `backdrop-filter` coûteux sans accélération
graphique avec repli opaque prêt mais non automatique (F), pas de mode clair pour D et F.

## 4. Recommandation

**Retenir la maquette F (Inspiration) comme direction cible**, puisqu'elle répond à la demande du commanditaire et
qu'elle est la seule à porter le mouvement et l'ambiance des références, et **la déployer en deux temps** :

1. **Socle immédiat (4 à 6 jours) : la mise en page de A.** La grille d'accueil resserrée, les cartes sans bordure,
   les graphiques redimensionnés et les en-têtes de tableau relevés de A sont compatibles avec la charte actuelle et
   résorbent les défauts relevés dans `AUDIT-VISUEL.md` sans dépayser personne. Ce travail reste utile quelle que
   soit la suite (il porte sur `Home.tsx`, `TableauDeBord.tsx`, `graphiques.tsx` et la section cartes de `styles.css`).
2. **Refonte F (15 à 22 jours) par couches**, pour maîtriser le risque technique : d'abord les jetons et le fond
   marine avec les deux familles de cartes (verre pour les KPI et graphiques, blanc pour les tableaux et formulaires),
   puis les graphiques (jauges pointillées, anneaux, courbes à halo), enfin les animations derrière une préférence
   utilisateur « Animations » persistée, `prefers-reduced-motion` restant prioritaire. Points de vigilance : les
   contrastes sur verre (F est conforme mais sans marge sur deux couples, à 4,52 et 4,59 : 1), le coût du flou sur
   une quinzaine de cartes (prévoir le repli opaque automatique) et le devenir du mode clair.

Si la direction préfère une évolution sans rupture, **B (Fidèle épurée)** est la meilleure option de repli : même
vocabulaire que l'application, interface nettement allégée, effort modéré (6 à 9 jours). **D (SOC sombre)** mérite
d'être conservé comme piste pour l'écran mural `/mur`, où un mode sombre dense et une barre d'état sont pertinents.
**C** et **E** sont des directions cohérentes mais éloignées, respectivement, des références et des usages actuels ;
E fournit toutefois de bonnes idées pour la liste des audits (densité réglable, colonnes figées, barre d'outils).

## 5. Remarques sur la livraison

- Le dossier `design-mockups/reference/` n'existait pas dans le dépôt : il a été créé à partir des cinq images jointes
  à la demande (aucune vidéo ni GIF n'était fourni ; la section « Mouvement » de l'analyse est extrapolée).
- La branche de travail est `claude/beautiful-gates-tzd0cd` (branche imposée par l'environnement) ; le même contenu
  est aussi poussé sur `design/refonte-maquettes`, nommée dans la demande. Aucun commit sur `main`.
- `git diff main --stat` ne montre que des fichiers sous `design-mockups/` (vérifié avant la livraison).
- Les captures de travail des scripts de test de chaque maquette (`X-*/test/**/*.png`) sont ignorées par Git ; seules
  les captures de `screenshots/` sont versionnées (environ 30 Mo avec les deux GIF et vidéos de F).
