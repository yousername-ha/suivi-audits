# Refonte Neon, lot 3 : Périmètres (graphe compact centré) et Objectifs et indicateurs (compact Studio)

14/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), portage sur la branche
de travail issue de `a1d096a` (`claude/refonte-neon`). Décision : [ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md).
Référence : `docs/transmission-opus-5.5/04-PORTAGE-PAR-MODULE.md`, sections « Périmètres — graphe compact centré » et
« Objectifs et indicateurs — compact Studio » (révisions `495427d`, `eed9f21`, version B).

## 1. Ce qui est porté

### Périmètres

- **Graphe par défaut** (déjà le cas dans la cible), **cartes repliées au chargement**, ensemble centré. Une carte repliée
  montre : type (et fiche du registre reliée, « Critique »), « Affiché », nom complet (jamais tronqué), trois tuiles
  Couverture / Actions / Écarts, la ventilation des écarts ouverts (Majeurs, Mineurs, Sensibles, liens filtrés), le total
  avec sous-périmètres (volet dépliable, sans doublon), l'alerte de couverture (clauses obligatoires, à déterminer), puis le
  pied : commandes, **« + » centré en bas**, « Afficher → ».
- **Dépliage en largeur, carte par carte** (264 → 620 px sur ordinateur) : trois zones (couverture ; activité et
  continuité ; écarts et actions) avec chiffres, jauges de retard et liens, commandes en toutes lettres. « Tout replier ».
- **Disposition sur les dimensions réelles** (`disposition-perimetres.ts`, pur et testé) : hauteurs mesurées
  (`ResizeObserver` et mesure avant affichage), largeurs repliées ou dépliées, chaque sous-arbre réserve sa largeur, parent
  centré sur ses enfants, arbres indépendants répartis en rangées centrées, hiérarchie verticale sous 900 px de large.
  Liaisons recalculées ; fournisseurs extérieurs en colonne, jamais parents, liaisons qui contournent la rangée.
- **Panneau « Détail »** (tiroir) : anneau de couverture, tous les compteurs et la couverture par référentiel avec sa
  provenance (rattaché ici, hérité de…), total avec sous-périmètres.
- Synthèse globale, barre (pause du flux, tout replier, centrer), légende, zoom (−, taille réelle, +, Ajuster), déplacement
  sur le fond et au clavier.
- **Liste** : la ligne s'ouvre au clic, à Entrée ou Espace avec la même action et la même condition que « Afficher »
  (`ficheCliquable`, lot 2).

### Objectifs et indicateurs

- Synthèse en trois cartes (atteints avec anneau, non atteints avec pictogramme et barre, à mesurer ou définir).
- Registre « Les objectifs et leurs indicateurs » : sélecteur des quatre vues, **raccourcis de filtre avec compteurs**
  (le bouton « Filtres » et son panneau restent), légende des états, bouton **Pause animations / Activer les animations**.
- Blocs **Cible à atteindre** (violet), **Valeur mesurée** et **État** de même format, fonds soutenus et contours nets,
  en-têtes de colonnes centrés avec pictogrammes. **« Non atteint »** : contour rouge, triangle d'avertissement et halo
  animé. **Flèches d'évolution** conservées : hausse verte, baisse rouge, stable neutre.
- **Vue compacte par défaut** pour la rubrique Objectifs (comme Indicateurs) ; Objectifs par processus garde « Par
  processus ». Vue compacte regroupée par objectif (processus, responsable, échéance, atteinte), une ligne par indicateur
  avec sa source et sa valeur historique.
- Lignes ouvrables (`ficheCliquable`) : indicateur dans les tableaux, objectif dans l'en-tête de groupe de la vue compacte.
- Fiches processus, objectif et indicateur : rubriques titrées (`fieldset`/`legend`), grilles de champs, actions sous le
  filet commun (`fenetre-actions`). Champs, valeurs, validations, droits et écritures inchangés.
- Téléphone : lignes des tableaux en cartes, blocs sur une ligne ; fiches sur une colonne.

## 2. Adapté à la cible, et pourquoi

| Point | Référence | Cible (ce lot) | Raison |
| --- | --- | --- | --- |
| Commandes d'une carte repliée | Absentes (« Modifier », « Ajouter un enfant » seulement dépliée) | Pictogrammes nommés dans le pied (mêmes noms accessibles) ; libellés dans la carte dépliée | Les e2e existants cliquent ces commandes sans déplier ; la spécification demande de préserver les commandes |
| Tuiles Actions / Écarts | Chiffre seul, formule dans le nom du lien | Chiffre puis « ouverte(s) · N en retard » visibles | `cartes-perimetres` vérifie la formule visible ; tests e2e non modifiables |
| Ventilation des écarts | Seulement dépliée | Repliée aussi, si des écarts sont ouverts | Alerte essentielle, cliquée par l'e2e sans dépliage |
| Total avec sous-périmètres | Seulement dépliée | Volet replié visible dans les deux états | Vérifié par l'e2e sans dépliage |
| Largeur repliée | 260 px | 264 px | Le test existant `disposition-perimetres` exige 264 px entre voisines |
| Continuité | BIA et PCRA | « N plan(s) de continuité » | BIA retirée (ADR 0088) ; modèle de la cible |
| Type de périmètre | Niveau et nature | Organisation / fournisseur, fiche reliée, « Critique » | Modèle de la cible (amendement ADR 0039) |
| Échelle par défaut | Ajustée à la largeur (réduction globale) | **Taille réelle** ; la zone défile horizontalement si le graphe déborde ; « Ajuster » fait tenir tout le graphe | Exigence « adapter le gabarit sans réduction globale » ; un arbre large (nombreux enfants) restait illisible une fois réduit |
| Objectifs : modèle | Socle seul (`smsi === SOCLE`) | Tous périmètres (`etatDePerimetre`, ADR 0094) | Évolution de la cible conservée |
| Boîtes de pilotage | Disposition de la référence | Structure de la cible (liste des indicateurs, registre `dl`) restylée | Plus récente que la référence ; sélecteurs e2e |
| Nom du bouton d'un indicateur | Code + nom | Nom accessible inchangé `Ouvrir l’indicateur INDx` ; code et nom visibles | Sélecteurs e2e |
| Couleurs | Palettes locales en hexadécimal | Dérivées des jetons (`--neon-*`, `--suivi-*`, `--carte-*`) par `color-mix` | Charte unique (tokens.ts) ; contrastes recalculés (§ 4) |
| Rayons | 13 à 17 px | 6 à 12 px (`--mantine-radius-*`) | ADR 0093 : rayons bornés à 12 px |
| Animation de « Non atteint » | `box-shadow` animée | Halo porté par un pseudo-élément, `transform` et `opacity` | Règle du projet (transform et opacity seulement) |
| Flèches dans un bloc coloré | Couleur d'état | Vert/rouge de la charte, éclaircis en sombre | Contraste graphique ≥ 3:1 sur tous les fonds de bloc |
| Tables des objectifs | Hauteur naturelle | Hauteur naturelle, en-têtes collés sous l'en-tête de l'application | Les lignes ouvrables du lot 2 bornaient la liste ; noms des colonnes gardés au défilement |

La lecture des **états** reste celle des fonctions partagées (cible et opérateur `≥`, `≤`, `=`) : une baisse vers un
maximum reste « Atteint » avec une flèche rouge descendante, une hausse sous un minimum reste « Non atteint » avec une flèche
verte. Une légende sous le registre distingue les deux lectures. Aucune valeur, aucun état n'est déduit de la flèche.

## 3. Laissé de côté, et pourquoi

- **Entrée du menu « Objectifs et indicateurs » vers `/pilotage/objectifs`** (référence `36a9236`) : navigation simplifiée
  par les ADR 0089/0090 et couverte par `navigation.test.ts` ; hors de ce lot. Seule la vue initiale de la rubrique change
  (`Pilotage.tsx`, une ligne).
- **Nom accessible du bouton de fermeture des fiches** (axe `button-name` à l'ouverture d'une fiche d'objectif) : défaut
  existant de toutes les fenêtres, laissé en l'état comme décidé au lot 2 (des tests cherchent « Fermer » par nom partiel).
  Le nouveau tiroir « Détail » a, lui, un bouton nommé (« Fermer le panneau Détail »).
- Aucune donnée ni fonction nouvelle : pas de score, pas d'historique inventé ; un compteur absent reste « indisponible ».

## 4. Vérifications

Node 22 (le projet demande Node 26 ; `engine-strict` relâché pour l'installation seulement).

| Contrôle | Résultat |
| --- | --- |
| `pnpm install --frozen-lockfile`, `tsc` de `packages/shared`, variables Mantine | réussis |
| ESLint (fichiers modifiés, `--max-warnings 0`), Prettier (fichiers modifiés) | réussis |
| `tsc --noEmit` `packages/ui` et `apps/web` | réussis |
| Vitest `packages/ui` | 284/284 |
| Vitest `apps/web` (dont `charte.test.ts`, `disposition-perimetres.test.ts` inchangé) | 274/274 (251 + 23 ajoutés, 2 fichiers) |
| `vite build` | réussi (avertissement de taille de bundle déjà connu) |
| Variables CSS employées par les deux feuilles | 81, toutes définies dans la cible |

Tests ajoutés : `apps/web/test/graphe-perimetres-compact.test.ts` (16 : cartes dépliées sans chevauchement, parent centré,
hauteurs mesurées par niveau, rangées centrées, hiérarchie verticale, liaisons, fournisseurs, cadrage à taille réelle,
« Ajuster », couverture jamais à 0 % fictif, jauge) et `apps/web/test/objectifs-presentation.test.ts` (7 : flèche et état
distincts sur des données fictives passées par `objectifsPilotage`, pire état, compteurs des raccourcis, dates).

**Recette locale** (hors dépôt) : bundle compilé servi avec la CSP exacte du Caddyfile, **API simulée** par le navigateur
(données fictives : « Mon organisation », filiale, fournisseurs fictifs), Chrome 153, clair et sombre. Niveau de preuve
inférieur à une API réelle : la forme des réponses suit les types partagés.

- 92 contrôles, 90 réussis ; les 2 échecs sont le défaut préexistant du bouton de fermeture des fiches (§ 3).
- Périmètres, 1024, 1440, 1920 et 390 px, clair et sombre : aucun chevauchement, aucun défilement interne de carte,
  aucune carte coupée, aucun titre tronqué, aucun débordement de page, centrage nul ; carte dépliée à 620 px, voisines
  repositionnées ; axe (WCAG 2.0/2.1 A et AA) sans violation sur le graphe replié, déplié, la liste et le panneau Détail.
- Sélecteurs des e2e rejoués : groupe `Périmètre <nom>`, texte `1 ouverte(s) · 1 en retard`, `indisponible` unique dans une
  carte sans référentiel, boutons `Modifier le périmètre …` et `Ajouter un périmètre enfant à …` visibles repliés, groupe
  `Écarts ouverts par classification` et lien `Majeurs 1`, groupe `Total de … avec ses sous-périmètres` (texte
  « Total avec N sous-périmètre(s) »), fournisseur extérieur et son lien, `path.graphe-lien` (`marker-end`, classe
  `graphe-lien--flux`), pause et reprise du flux, mouvement réduit (flux arrêté), `Liste`/`Graphe` exacts, ligne
  `Organisation · rattachée à …`.
- Lecteur seul : gestion absente, dépliage et Détail permis, axe sans violation (32/32).
- Objectifs, 1440, 1024 et 390 px, clair et sombre : vue compacte par défaut, région `Objectifs, vue compacte` avec les
  objectifs, `Ouvrir l’indicateur IND1` unique, « Processus de management », `Ouvrir le processus PR2`, boîtes
  (`Registre du processus …`, `Indicateurs du processus …`), fiche (`Quand surveiller`, « Surveillance et mesure (ISO
  9001:2015, 9.1.1) », « Fermer »), filtre « Non atteints », pause du halo, mouvement réduit (aucune animation) ; aucun
  défilement interne, aucun débordement, en-têtes centrés ; axe sans violation sur les quatre vues.
- Aucune erreur JavaScript ni CSP.

### Non exécutés

- Suite e2e Playwright sur la pile Docker (rejouée après intégration), captures de référence (aucune ne couvre ces écrans),
  API et base réelles, Node 26, lecteur d'écran.

## 5. Risques pour les e2e

- `zzzzzzzzzzzzzzzzzzzzzzzzzz-cartes-perimetres` : sélecteurs conservés (carte repliée, § 4). Avec beaucoup de périmètres
  (base de CI), un arbre plus large que la zone fait défiler la zone horizontalement : Playwright y fait défiler la cible.
- `zzzzz-accessibilite` (`/pilotage/perimetres`, `/pilotage/objectifs` : la seconde ouvre désormais la vue compacte) : axe
  sans violation en recette ; contrastes vérifiés par le calcul pour chaque couple ajouté.
- `zzzz-pilotage`, `zzz-pilotage`, `zzzzzz-jeu-de-test` : sélecteurs vérifiés ci-dessus.

## 6. Fichiers

- `apps/web/src/pilotage/CartesPerimetres.tsx`, `disposition-perimetres.ts` (nouveau, réexporte `disposer` par
  `CartesPerimetres`), `Perimetres.tsx` (ligne ouvrable).
- `apps/web/src/pilotage/ObjectifsProcessus.tsx`, `FichesObjectifs.tsx`, `objectifs-presentation.ts` (nouveau).
- `apps/web/src/pages/Pilotage.tsx` : vue initiale de la rubrique Objectifs (une ligne).
- `packages/ui/src/neon-perimetres.css`, `packages/ui/src/neon-objectifs.css` (déjà déclarées et importées).
- Aucun fichier serveur, partagé, d'ADR ni de test existant modifié ; aucun export ni import supplémentaire nécessaire.
