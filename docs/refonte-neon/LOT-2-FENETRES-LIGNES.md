# Refonte Neon, lot 2 : fenêtres « Biseau » à hauteur naturelle et lignes ouvrables

13/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche
`claude/refonte-neon` (suite du [lot 1](LOT-1-MENU-DASHBOARD.md), validé par le RSSI le 13/11/2026). Décision :
[ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md), § « Décision (lot 2) ». Matrice :
[lignes `socle` et `lignes`](MATRICE-COMPATIBILITE.csv).

## 1. Décisions du RSSI pour ce lot (13/11/2026)

| Question                                       | Réponse                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Captures du lot 1                              | Validées, passage au lot 2                                                                    |
| Écart de droits du rôle Contributeur           | Traité dans une autre session : rien dans la refonte                                          |
| Quand ouvrir la PR vers `claude-suivi-smsi`    | En brouillon après le lot 2 ; une seule relecture des captures de référence pour les lots 1 et 2 |
| Lecture distincte des fiches                   | Comme la référence : Contexte, Parties intéressées et Processus seulement, à leurs lots      |
| Fenêtres de la cartographie                    | Même habillage que les autres fenêtres ; canevas, génération et fenêtres RETEX inchangés     |

## 2. Résumé technique

| Sujet                    | Constat dans la cible                                                                     | Décision du lot                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fenêtres                 | Modal/Drawer Mantine, défilement dans la fiche, aucun habillage commun                     | `neon-fenetres.css` : cadre Biseau violet/cyan, en-tête et formulaires harmonisés, **hauteur naturelle**, voile extérieur défilant, titre collant au bord de l'écran      |
| Exclusions               | Fenêtres RETEX à habillage propre (`.retex-modal`, plein écran, chronologie calculée)      | RETEX, plein écran et menu mobile (lot 1) **exclus** ; graphe et chronologie RETEX non touchés                                                                         |
| Fiche des registres      | `RecordEditor` : formulaire seul                                                           | Classes de présentation (`fenetre-fiche`, `fenetre-fiche-corps`, `fenetre-actions`) ; formulaire, champs et droits inchangés                                            |
| Lignes                   | Aucune ligne cliquable ; bouton « Ouvrir » ou lien seulement                               | `ficheCliquable` : clic, Entrée, Espace ; **même ouverture et mêmes droits** que la commande existante, conservée                                                      |
| Retour du focus          | Pas de retour vers la ligne                                                                | `focus-fiche.ts` + défaut `onExitTransitionEnd` des Modal et Drawer : retour à la ligne qui a ouvert la fiche                                                            |
| Longues listes           | `DataTable` : zone bornée à 75 vh                                                         | `ListeDefilante` dans `DataTable` : zone locale à la hauteur disponible, en-têtes visibles, seulement si la liste contient des lignes ouvrables                       |
| Cartographie             | Liste « Ajouter depuis la plateforme » dans une zone défilante de 50 vh                    | Zone retirée : la liste suit la hauteur naturelle de la fenêtre (comme la référence, décision du RSSI)                                                                   |

### Réutilisé, adapté, laissé intact

- **Réutilisé** de la référence : `focus-fiche.ts` (et son test), `fiche-cliquable.ts`, `lignes-fiches.css`, la partie générique
  de `neon-fenetres.css` (fenêtres, Biseau, voile extérieur).
- **Adapté** :
  - toutes les règles de fenêtre sont limitées aux fenêtres hors RETEX, hors plein écran et hors menu mobile ;
  - `ListeDefilante` écrit sa hauteur par le DOM (CSSOM) au lieu d'un `style={}` ;
  - une liste placée sous d'autres blocs prend la hauteur de l'écran sous l'en-tête. Dans la version actuelle, beaucoup de
    listes sont sous des cartes ou des filtres, et la formule de la référence les réduisait à 160 px ;
  - la première colonne collante des tableaux suit le survol, le focus et la ligne choisie, avec un fond opaque. Ce défaut
    existait déjà sur la base, mais la palette Neon le rendait plus visible ;
  - chaque appel de ligne ouvrable reprend l'ouverture de la cible, qui diffère souvent de la référence.
- **Non repris** :
  - le nom accessible par défaut « Fermer la fenêtre » / « Fermer le panneau », parce que plusieurs tests existants cherchent
    un bouton « Fermer » par nom partiel dans des fenêtres qui en ont déjà un ;
  - la présentation du Contexte (cadre SVG, pictogrammes animés), prévue au lot 3 ;
  - la fiche fournisseur en lecture depuis « Fournisseurs du périmètre », qui serait une fonction nouvelle ;
  - les lignes de modules retirés (correspondances, RETEX séparé, applications à intégrer).
- **Reporté à leur lot** : Périmètres et Objectifs (lot 3), Couverture et DDA (lot 4), Actions et Timeline (lot 6).
- **Laissé intact** : listes sans ouverture de fiche existante (journaux, grilles de saisie, matrices, éléments de registre
  sans fiche), canevas de cartographie, graphe et chronologie RETEX, droits, API, données.

### Fichiers et contrats touchés

- `packages/ui` :
  - `neon-fenetres.css`, `lignes-fiches.css`, `focus-fiche.ts`, `liste-defilante.tsx` (nouveaux) ;
  - `components.tsx` : `DataTable` garde sa classe, sa région et son libellé ;
  - `theme.ts` : défaut `onExitTransitionEnd` ;
  - `index.ts` et `package.json` : exports.
- `apps/web` :
  - `fiche-cliquable.ts` (nouveau) ;
  - `main.tsx` : imports des feuilles ;
  - `RecordEditor.tsx` : classes ;
  - `Registry.tsx` : `DataTable` et cartes mobiles ouvrables, bouton « Ouvrir » conservé ;
  - `carto/Dialogues.tsx` : zone défilante retirée ;
  - 18 fichiers de listes : ajout de `ficheCliquable` sur la ligne (et `useNavigate` dans `AccesSujets.tsx`), rien d’autre.
- **Hors interface : aucun fichier** dans ce lot. Pas d'API, de migration, de Compose, de CI ni d'authentification. Sur
  l'ensemble de la branche, le seul fichier hors interface reste `packages/shared/src/affichage.ts` (lot 1 bis, préférence
  `accueil`) avec son test.
- **Tests** : deux fichiers ajoutés (`packages/ui/test/focus-fiche.test.ts`, `apps/web/test/fiche-cliquable.test.ts`), aucun
  test existant modifié, aucun sélecteur retiré. Les attributs `id`, `name`, `data-*`, `aria-*`, les rôles et les libellés
  existants sont conservés ; les lignes reçoivent en plus `data-fiche-ouvrable`, `data-fiche-titre`, `aria-description` et
  `tabindex="0"`.

## 3. Poids du bundle (vite build, même machine)

| Ensemble             | Base `967de1d`        | Lot 1 bis             | Lot 2                 | Écart lot 2 / lot 1 bis        |
| -------------------- | --------------------- | --------------------- | --------------------- | ------------------------------ |
| CSS principal        | 436 923 o (67 210 gz) | 462 119 o (72 102 gz) | 473 505 o (74 747 gz) | +11 386 o (+2,5 %), +2 645 gz   |
| JS principal         | 1 660 783 o (493 783) | 1 687 255 o (500 780) | 1 690 457 o (503 096) | +3 202 o (+0,2 %), +2 316 gz    |
| **Total JS + CSS**   | 2 622 235 o (706 705) | 2 673 541 o (718 630) | 2 688 963 o (724 244) | **+15 422 o (+0,6 %), +5 614 gz** |

Depuis la base : +66 728 o (+2,5 %), +17 539 o compressés (+2,5 %).

## 4. Vérifications réellement exécutées

Niveau de preuve : **API et base réelles**. Bundle compilé servi avec la CSP exacte du Caddyfile, API sur les sources
(`tsx`), PostgreSQL 16 local, données entièrement fictives (jeu de test du dépôt, organisation « Organisation de
démonstration »), Chromium de Playwright. Node 22 au lieu de Node 26 : le contrôle de version est relâché pour
l'installation seulement.

| Contrôle                                                                     | Résultat                                                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ESLint du dépôt (`eslint . --max-warnings 0`), Prettier du dépôt             | réussis                                                                                        |
| `tsc --noEmit` `packages/ui`, `apps/web`                                     | réussi                                                                                         |
| Vitest `packages/ui`                                                         | 284/284 (281 + 3 ajoutés)                                                                      |
| Vitest `apps/web` (dont `charte.test.ts`)                                    | 236/236 (230 + 6 ajoutés)                                                                      |
| Vitest `packages/shared`                                                     | 606/606                                                                                        |
| Script de recette du lot 2 (23 contrôles)                                    | 23/23, détail ci-dessous                                                                       |
| Grille : fiche ouverte depuis sa ligne, 11 tailles                           | 11/11 de 1024×768 à 2560×1440, plus 1920×800, zoom 150 %, tablette et 390 px : titre visible, bas atteint par le voile, aucun défilement interne, aucun débordement, aucune erreur |
| E2E concernés (27 suites, 62 tests, captures de référence ignorées)          | 58/62 ; les 4 échecs viennent de l'état de la base (§ 4.1)                                      |

Détail des 23 contrôles du script de recette, sur la page Revues de direction (registre commun) :

- clic sur une cellule de la ligne : la fiche s'ouvre ;
- Entrée et Espace sur la ligne : la fiche s'ouvre ;
- Échap : la fiche se ferme et le focus revient à la ligne ;
- le menu « Autres actions », une sélection de texte et Ctrl+clic n'ouvrent pas la fiche ;
- le bouton « Ouvrir » est conservé et fonctionne ;
- la fiche n'a aucun défilement interne ; elle a le cadre Biseau, le voile défilant et les classes de présentation ;
- la liste est bornée dans sa zone ;
- sur téléphone : cartes ouvrables, bas de la fiche atteint, aucun débordement ;
- cartographie : la fenêtre de génération est habillée, la carte est générée et la liste « Ajouter depuis la plateforme »
  n'a plus de défilement imbriqué ;
- aucune erreur JavaScript ni CSP.

### 4.1 Tests e2e

Les 27 suites ont été choisies parce qu'elles passent par les fenêtres, les listes ou les fichiers modifiés : pilotage,
risques, EBIOS, accessibilité (axe), configuration GRC, plans, audit, incidents et crise, registres, responsables, accès,
administration, calendriers, kit IA, plan des écarts, RETEX, menu clavier, coque, fiabilisation… Elles ont été jouées
avec `--ignore-snapshots`, sur le bundle du lot 2.

**58 tests sur 62 réussis**, dont les trois tests RETEX (« générer et diffuser la chronologie » compris), axe sur les
écrans, menu au clavier et coque. Aucun des quatre échecs n'est une régression de l'interface : tous viennent de l'état de
la base de recette, qui contient le jeu de démonstration et les traces des passages précédents. Chaque échec a été rejoué
pour le prouver.

| Test en échec                                                     | Cause                                                                                                   | Rejeu                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `z-fiabilisation` A6 (panneau droit de la cartographie)          | Une liaison de la carte, générée pendant la recette, recouvre le premier nœud que le test veut cliquer | même échec sur la base `967de1d`                            |
| `zzz-pilotage` bibliothèque de référentiels                        | Le jeu de démonstration a déjà attribué des référentiels au périmètre ; le test attend une installation neuve | même échec sur la base `967de1d`                            |
| `acces-sujets` vue des accès                                       | Le test cherche le compte « Responsable SSI » de l'installation de la CI ; ici, le compte s'appelle « Démonstration » | même échec sur la base `967de1d`                            |
| `zzz-pilotage` fournisseur évalué une fois                         | Le nouveau fournisseur a reçu l'identifiant SUP-001, puis SUP-003. Le jeu de démonstration avait laissé une évaluation sur ces identifiants après une restauration | **réussi sur le lot 2** dès que l'identifiant est libre (SUP-004) ; réussi sur la base avec SUP-002 |

### Non exécutés

- Captures de référence Playwright : elles changent par construction (menu, palette, fenêtres). Comme décidé par le RSSI,
  elles seront régénérées dans le conteneur officiel (CI de la PR en brouillon) et relues image par image avant tout commit.
- Suite e2e complète dans l'ordre de la CI, à partir d'une installation neuve : elle sera exécutée par la CI de la PR.
- Pile Docker complète, Caddy, Node 26, PostgreSQL 18, lecteur d'écran, recette sur le serveur du RSSI.

## 5. Captures

Captures de l'application intégrée, prises avec la même pile que les vérifications :

- version 6.3.0 de la branche `claude/refonte-neon` ;
- bundle compilé, CSP, API et base réelles ;
- données fictives ;
- thème clair et thème sombre.

Vues capturées :

- registre (Revues de direction) avec la fiche ouverte depuis sa ligne, en 1440×900 ;
- bas de la fiche sur téléphone (390 px) ;
- registre des risques, liste et fiche, en 1440×900 à densité 2 ;
- Documents (ligne choisie et sa fiche) ;
- administration des accès (fenêtre des droits effectifs) ;
- fenêtre de génération de la cartographie.

Elles sont transmises dans la conversation et ne sont pas versionnées (poids).

## 6. Incidents et limites

- La formule de hauteur des listes de la référence réduisait à 160 px les listes placées bas dans la page. C'est corrigé
  (voir § 2) et revérifié.
- Les tests e2e tournent sur une base qui contient déjà le jeu de démonstration et les traces des passages précédents. Des
  tests qui attendent une installation neuve échouent pour cette raison (§ 4.1) ; la CI de la PR les rejouera sur une base
  neuve.
- Observation hors périmètre : sur cette base, une évaluation de fournisseur peut rester attachée à un identifiant
  (`SUP-00n`) quand le fournisseur a été remplacé par une restauration partielle. Un nouveau fournisseur qui reprend
  l'identifiant hérite alors de l'évaluation. C'est un état de données de la recette, sans lien avec l'interface ; à
  vérifier côté serveur si la situation peut se produire en exploitation.
- Les décisions ont été vérifiées sur un échantillon de fenêtres (registre, risques, documents, administration,
  cartographie) et de tailles. Toutes les fenêtres n'ont pas été vérifiées individuellement, ni toutes les combinaisons de
  droits.

Prochaine action : PR en brouillon vers `claude-suivi-smsi` (décision du RSSI). La CI régénère les captures de référence,
puis le RSSI les relit image par image avant tout commit de captures. Le lot 3 (Contexte, Périmètres, Objectifs) vient
ensuite.
