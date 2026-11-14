# Refonte Neon, lots 4 et 5 : DdA, Bibliothèque de référentiels et Fournisseurs

14/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), portage mené en
parallèle des autres lots, sur la base `a1d096a` (feuilles de style déclarées). Décision :
[ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md). Référence : dossier de transmission
`docs/transmission-opus-5.5` (sections « DDA — synthèse et mesures en lignes », « Bibliothèque de référentiels et couverture
fusionnées », « Fournisseurs — registre compact Studio »).

## 1. Ce qui est porté

| Module | Présentation reprise de la référence validée | Fichiers |
| --- | --- | --- |
| DdA (clauses ISO, Annexe A, HDS) | Quatre dalles de synthèse sur `statsDda` (anneau des niveaux, barres par niveau, applicabilité, vigilance) ; registre des mesures en lignes compactes ouvrables, filtres comptés, compteur ; choix Applicable et Mise en œuvre remplis, plus foncés, vert / orange / rouge, sans chevron (clavier, nom accessible et effacement conservés) ; fiche regroupée : déclaration, documents, revue, repères, texte de référence | `apps/web/src/dda/Dda.tsx`, `DdaSynthese.tsx`, `DdaIcone.tsx`, `dda-studio.ts` (calculs de présentation), `packages/ui/src/neon-dda.css` |
| Bibliothèque de référentiels | Une dalle par référentiel : identité, version, provenance et catalogue à gauche ; barre SVG et six états des exigences du périmètre affiché, mesures reliées, bandeaux ambre à droite ; recherche à la loupe insensible aux accents ; dalle ouvrable ; catalogue à défilement local ; exigences d'une version en lignes (code, intitulé, domaine) | `apps/web/src/pilotage/Bibliotheque.tsx` (page seule), `BibliothequeStudio.tsx`, `bibliotheque-types.ts`, `packages/ui/src/neon-bibliotheque.css` |
| Fournisseurs de l'organisation | Indicateurs Studio, vue compacte par défaut et vue détaillée (notes, réévaluation), recherche à la loupe, lignes fines ouvrables, colonnes regroupées, puces et sélecteurs colorés modifiables en place sans ouvrir la ligne | `apps/web/src/pilotage/Fournisseurs.tsx` (registre seul), `FournisseursStudio.tsx`, `fournisseurs-types.ts`, `packages/ui/src/neon-fournisseurs.css` |

Aucune modification de l'API, des schémas partagés, des migrations, de `main.tsx`, de `@suivi/ui` hors des trois feuilles
du lot, de `RecordEditor.tsx` ni de `neon-fenetres.css`. Aucun test existant modifié. Aucun besoin d'export ou d'import
supplémentaire.

## 2. Adapté à la cible, et pourquoi

Commun aux trois modules :

- couleurs tirées des jetons existants (`--suivi-*`, `--neon-*`, `--mantine-*`, `--tdb-*`, `--carte-*`), clair et sombre,
  sans couleur codée en dur ; contraste du texte calculé sur les paires utilisées, toutes au-dessus de 4,5:1 ;
- rayons bornés à 12 px (ADR 0093) ; mouvements par `transform` et `opacity` seulement, arrêtés par le mouvement réduit,
  la pause du menu (`data-mouvement='pause'`) et l'impression ; `forced-colors` pris en charge ;
- listes ouvrables avec `ficheCliquable` et défilement local `ListeDefilante` du lot 2, au lieu des cadres à hauteur
  d'écran et des surcharges de `.shell-main` de la référence.

DdA :

- le titre de la page (h1 « Annexe A (DdA) ») reste affiché ; la référence le masquait, mais des parcours le lisent. Le
  titre du module devient un h2 (« Conformité — Annexe A (DdA) », texte de la cible) ;
- périmètre affiché et écriture `PATCH /api/dda/:id?smsi=` conservés (la référence n'avait pas de périmètre) ;
- la fiche garde le cadre « Biseau » et l'en-tête collant du lot 2 (ADR 0093, décision 6) au lieu du cadre arrondi de
  22 px de la référence ; taille `xl` pour les deux colonnes ;
- libellés lus par les parcours conservés : « x % » suivi de « en mise en œuvre totale », le nombre suivi de « exclue(s) »,
  « « Total » avec écart ouvert » (le filtre « Total avec écart ouvert » reste le seul texte exact de ce nom) ;
- l'intitulé de la mesure est un texte (la ligne est ouvrable) et non un second bouton ; le nom accessible de la fiche
  commence par « code — intitulé », le contexte « Annexe A · Fiche mesure » est placé au-dessus par CSS ;
- le lien de document reste souligné (WCAG 1.4.1, thème) ; le fond lavande ne touche que la zone de contenu ; les
  surcharges du menu latéral de la référence ne sont pas reprises (menu commun du lot 1).

Bibliothèque (ADR 0089) :

- pas de sélecteur de périmètre propre : celui de l'application est conservé ; pas de titre Studio en double ; aucune route
  ni redirection ajoutée ;
- le détail exigence par exigence reste affiché sous le catalogue (la référence l'ouvrait dans une fenêtre : les parcours
  de couverture et du plan des écarts attendent une seule fenêtre ouverte, celle de l'évaluation). Il est ramené à l'écran
  à l'ouverture et rattaché au périmètre où il a été ouvert : changer de périmètre ne laisse plus un ancien détail ;
- bibliothèque figée (ADR 0082) : « Nouvelle édition » seule, ni copie ni ajout d'exigence ; jointure de la couverture par
  identifiant, comme la cible ; la mention « rapprochements non comptés » (retirés par l'ADR 0089) n'est pas reprise ;
- standards disponibles et kit IA restent visibles, dans une section dépliée par défaut, sous le catalogue ;
- bandeaux des clauses obligatoires et des applicabilités à déterminer : textes complets de la cible, en ambre, sans
  score ; rôle `note` au lieu d'`alert` (contenu affiché au chargement, pas une alerte) ; pulsation par l'opacité d'un
  liseré superposé, texte immobile ;
- une source `unverified` s'affiche « Source à vérifier » (référence) et non « Repris de l'outil de suivi ».

Fournisseurs :

- pas de consultation distincte de l'édition : la lecture séparée est limitée au Contexte, aux Parties intéressées et aux
  Processus (ADR 0093, décision 7). La ligne ouvre la fiche existante, avec la même ouverture et les mêmes droits que le
  bouton « Fiche » ;
- le menu de ligne de la référence est remplacé par quatre boutons compacts portant les noms accessibles existants
  (« Fiche du fournisseur … », « Évaluer le fournisseur … », « Historique des évaluations de … », « Périmètres de
  rattachement de … ») ; le focus revient au bouton à la fermeture. Le bouton « Filtres » existant est conservé ;
- en-têtes regroupés qui contiennent toujours les libellés de l'outil de suivi (Type, SSO, MFA, Critique, Hébergeur HDS,
  Certificats, Contrôles, Prochain) ; « n répond · n ne répond pas · n non évalué » en texte accessible, « n rattaché(s) »
  visible dans la vue compacte ;
- teintes : SSO et MFA Oui vert, Non rouge, En cours ambre ; criticité Oui en attention ; **HDS Oui en bleu** (déclaré, la
  référence le colorait en vert, contraire à sa propre consigne) ; non renseigné et N/A neutres ; taux « — » sans service
  SaaS ou sans données, jamais « 0 % » inventé ;
- évaluation, critères, historique, suites, rattachements, clausier et fiche (formulaire) inchangés ; types extraits dans
  `fournisseurs-types.ts` et réexportés par `Fournisseurs.tsx`.

## 3. Laissé de côté

- `ReferentielsStudio.tsx` et `neon-referentiels.css` : l'écran « Référentiels et exigences » est retiré (ADR 0089 ;
  `Publication type="frameworks"` n'est plus rendu par aucune page). Seule la présentation « exigences en lignes » est
  reprise, dans la fenêtre « Exigences de … » de la Bibliothèque. La fiche « Source et publication » n'a pas d'écran cible.
- `LectureFournisseur` (onglets, certificats et contrôles paginés) : décision 7 de l'ADR 0093.
- Masquage du titre de page, surcharges du menu et hauteur d'écran forcée de la référence.
- `EtatsCouverture` (`Couverture.tsx`) n'est plus utilisé par la Bibliothèque ; il n'est pas supprimé (fichier hors du lot).

## 4. Sélecteurs des parcours de bout en bout vérifiés

| Parcours | Sélecteurs conservés |
| --- | --- |
| `zzzzzzzzzzzzzzz-dda-evaluations` | « « Total » avec écart ouvert », image « Répartition des mesures applicables… », identifiant d'écart, combobox « Niveau de A.5.19 », textes exacts « Exclues » et « Toutes », bouton « A.5.1 », champ « Commentaire de la revue » |
| `rssi-virtuel` 10, 20, 42 | h1 « Annexe A (DdA) », « 93 mesures » (texte exact), indicateurs « exclue » et « en mise en œuvre totale » (valeur en frère précédent), « Total avec écart ouvert » (unique), ligne `^A.5.x `, combobox « Applicabilité de … », titre de fiche `^A.5.x — `, champs « Applicable », « Mise en œuvre », « Justification » |
| `zzz-pilotage`, `zzzzzzzzzzzzzzzz-couverture-exigences`, `…-plan-ecarts`, `…-kit-ia`, `zzzzzz-jeu-de-test` | h1 « Bibliothèque de référentiels » (unique), dalle `aria-label` « Référentiel … » (exact et préfixe), « Figé », identifiant, « exigences au catalogue », « Voir la couverture de … », une seule fenêtre à l'évaluation, « Fermer » unique, « Standards disponibles », `data-testid="kit-ia"`, « Importer un référentiel » |
| `zzz-pilotage`, `zzzzzz-jeu-de-test`, `rssi-virtuel` 41 | h1 « Fournisseurs de l'organisation », « Ajouter un fournisseur », ligne contenant « Non évalué », « 1 répond », « 2 rattaché(s) », boutons « Évaluer le fournisseur … », « Périmètres de rattachement de … », « Historique des évaluations de … », « Fiche du fournisseur … », en-têtes de colonnes, « SaaS avec MFA » (unique), « Filtres » → « Situation » → « Sans MFA », nom du fournisseur écrit une seule fois |
| `zzzzz-accessibilite` | Bibliothèque et Fournisseurs analysés ci-dessous |

## 5. Contrôles exécutés

Node 22 (contrôle de version relâché pour l'installation), depuis la racine de la copie de travail :

| Contrôle | Résultat |
| --- | --- |
| `pnpm install --frozen-lockfile`, `tsc` de `packages/shared`, `mantine-css-vars.ts` | codes 0 |
| ESLint (fichiers modifiés, puis dépôt entier `eslint . --max-warnings 0`), Prettier (fichiers modifiés) | codes 0 |
| `packages/ui` : `tsc --noEmit`, Vitest | code 0, 284/284 |
| `apps/web` : `tsc --noEmit`, Vitest (dont `charte.test.ts`) | code 0, 279/279, dont 28 ajoutés (`dda-studio`, `bibliotheque-studio`, `fournisseurs-studio`) |
| `apps/web` : `vite build` | réussi ; avertissement existant sur la taille des blocs ; CSS 544,08 ko (87,15 ko compressés), JS principal 1 759,81 ko |

Recette du frontend compilé (`vite preview`), **API entièrement interceptée par Playwright, données fictives**, Chrome,
clair et sombre, 1366×900, mouvement réduit : 29 contrôles réussis sur 29 — titres, indicateurs, choix au clavier et à la souris,
filtres, fiche par le code et par la ligne (clic, Entrée, Échap, retour du focus), couverture puis évaluation avec une seule
fenêtre, exigences en lignes, recherche et retour du focus, import, colonnes et textes des fournisseurs, filtres, fiche,
ligne ouvrable, sélecteur en place sans ouverture, vue détaillée. Aucune erreur JavaScript ni violation CSP. Axe (WCAG 2.0
et 2.1 A/AA, thème clair) : aucune violation sur le registre DdA, la Bibliothèque et les Fournisseurs ; dans la fiche DdA, une
violation `button-name` sur le bouton de fermeture Mantine, **préexistante** dans toutes les fenêtres (aucun nom par défaut,
choix du lot 2) : à traiter globalement, hors de ce lot. Dimensions de 1024×768 à 2560×1440 et 390 px : aucun débordement
de page ; défilement horizontal du seul tableau à 1024 px (DdA, Fournisseurs) et à 390 px (Fournisseurs).

### Non exécutés

- Parcours Playwright réels sur la pile Docker (pas de pile ici) : à rejouer après intégration, avec les sélecteurs
  ci-dessus ;
- captures de référence (aucune ne couvre ces trois écrans), API et PostgreSQL réels, droits serveur, lecteur d'écran.

## 6. Risques pour les parcours de bout en bout

- DdA : la mise en page en grille des lignes (`display: grid` sur `tr`) suit la référence ; la détection des lignes par
  rôle a été vérifiée dans Chrome, pas dans les autres navigateurs. Le registre défile dans sa zone : Playwright y fait
  défiler les éléments visés.
- Bibliothèque : le catalogue défile dans sa zone ; le détail de couverture s'affiche sous la zone (comme avant) et la
  liste se réduit tant qu'il est ouvert.
- Fournisseurs : les commandes de ligne sont des boutons icônes (mêmes noms accessibles) ; un parcours qui chercherait
  leur texte visible (« Évaluer », « Historique ») au lieu de leur nom ne les trouverait plus. Aucun parcours actuel ne le
  fait.
