# Recette du 22/11/2026 — refonte Neon compacte

Branche `claude/refonte-neon-compacte`. Pile Docker réelle (images `api`, `web` et `updater` construites depuis la
branche, base PostgreSQL 18 neuve, HTTPS local), tests de bout en bout dans le conteneur Playwright officiel
(`tests/e2e/run-in-container.sh`), données fictives. Aucune donnée réelle, aucun secret.

## 1. Contrôles locaux

| Contrôle | Résultat |
| --- | --- |
| `npx eslint . --max-warnings 0` | Vert |
| `npx prettier --check .` | Vert |
| `tsc --noEmit` (`apps/web`, `packages/ui`) | Vert |
| Tests de l'interface (`apps/web`) | 947 réussis, 101 fichiers |
| Tests de la charte (`packages/ui`) | 285 réussis |
| Construction de l'interface, `scripts/ci/verifier-changelog.mjs` | Verts |

Tests ajoutés : `apps/web/test/fiches-parties.test.ts` (intitulés des parties, règles de la feuille de style), trois
cas dans `apps/web/test/harmonisation-outils.test.tsx` (nom de la barre, nom du bouton de soumission, filtre à
segments visible).

## 2. Recette de bout en bout sur pile réelle

| Passage | Code joué | Résultat |
| --- | --- | --- |
| 1 | Import brut de la branche Codex | 13 échecs sur les 192 premiers tests (4 écarts de capture attendus, 9 parcours fonctionnels), puis blocage du lanceur |
| 2 et 3 | Moteur des fiches réécrit, puis accrochage natif | 259 réussis, 8 échecs : barre d'outils (trois défauts de code) et tests à adapter |
| 4 (final, pile neuve) | État livré | **279 réussis, 1 ignoré (jeu de test, ignoré par conception), 0 échec**, 33 minutes |

Parcours que l'import brut mettait en échec et qui passent sans modification de test : changement du poivre, droits
(rôle personnalisé), guide, panneau de la cartographie, pilotage G/H, fournisseur évalué, étude EBIOS RM, atelier 2,
plans, timeline des actions, journal d'audit, RETEX, veille.

Nouveau test : `tests/e2e/specs/…-fiches-parties.spec.ts` (fiche de risque découpée et nommée, aucun champ tronqué ou
recouvert, bouton d'enregistrement visible dans chaque partie, champ et liste d'une autre partie atteints directement,
valeurs conservées, clavier, redimensionnement, réouverture, repli de « Sécurité », aucune alerte CSP).

## 3. Cas obligatoires du dossier

| Cas | Vérification | Constat |
| --- | --- | --- |
| Fiche courte | Captures « ajout d'un fournisseur », « création d'un produit » | Pas de menu, fenêtre centrée à la taille du contenu |
| Risque long | Test de bout en bout, captures 1280 à 3840 | Parties « Informations », « Analyse » ; aucun défilement vertical ; valeurs conservées |
| Fournisseur | Captures avec un certificat et trois contrôles ajoutés | Titres « Certificats », « Contrôles à effectuer » ; la partie du champ ajouté s'affiche ; pied visible |
| Produit | Parcours « produits surveillés » de la recette, captures | Soumission et validation inchangées ; la fiche tient sans menu |
| Tableau long | Parcours des droits (grille des permissions dans une fenêtre) | Cases atteignables et cochables ; une ligne ne se coupe pas |
| Noms longs | Parcours existants des sélecteurs de responsable | Inchangés (lot « proportions » repris tel quel) |
| Erreur | Parcours du poivre (« Ancien poivre incorrect ») et règle du moteur | Message visible ; la partie d'une erreur nouvelle est affichée |
| Clavier | Test de bout en bout (flèches, Début, Fin, tabulation) | Menu navigable ; un champ atteint au clavier affiche sa partie, alignée |
| Redimensionnement | Test de bout en bout (1280 × 720 ↔ 1920 × 1080) | Nombre de parties recalculé, aucun contenu perdu |
| Ouverture, fermeture | Test de bout en bout | Réouverture sur la première partie ; observateurs retirés à la fermeture |
| Couleurs | Captures claires et sombres | Enregistrer en contour bleu/cyan, « Fermer » discret, états métier conservés |

Non vérifié fiche par fiche : les quelque 127 fenêtres de l'application n'ont pas toutes été ouvertes à la main. La
recette complète en traverse une grande partie, et le contrôle après découpage protège les autres (repli sur le
défilement habituel au moindre champ tronqué ou recouvert).

## 4. À valider par le RSSI avant fusion

### 4.1 Captures de référence

Les **68 captures de référence** (`tests/e2e/specs/__captures__/`) sont régénérées : la densité, l'en-tête, les barres
d'outils et les boutons changent tous les écrans. Elles sont dans un commit à part (« captures de référence
régénérées »), à relire dans l'onglet des fichiers modifiés de la PR (comparaison d'images) ; ce commit peut être
retiré seul. Tant qu'elles ne sont pas validées, la PR ne doit pas être fusionnée.

### 4.2 Tests de bout en bout modifiés

Aucune vérification métier n'est retirée ni affaiblie ; les changements suivent le déplacement des éléments à l'écran.

| Fichier | Changement | Auteur |
| --- | --- | --- |
| `helpers.ts` | Nouvelle fonction `ouvrirFiltres` : ouvre le panneau de filtres qui contient un critère | Codex |
| `parcours`, `recette-cartographie` | Temps réel attendu par l'attribut `data-temps-reel` de l'en-tête (pastille « En direct » retirée) | Codex |
| `recette-cartographie`, `plans`, `audit-suivi` | Bouton métier « Fermer » visé par son nom exact (le bouton de fermeture des fenêtres s'appelle désormais « Fermer la fenêtre ») | Codex |
| `zz-grc` | Bouton « Apprécier / réévaluer » visé avec le nom du risque | Codex |
| `journal-audit` et dix fichiers `vulnerabilites-*` | `ouvrirFiltres` avant d'agir sur un critère replié ; vues en boutons (groupe de boutons au lieu de boutons radio) | Codex |
| `recette-cartographie`, parcours 23 | Point de création déplacé (0,82 ; 0,78) : avec la nouvelle densité le canevas est plus large et l'ancien point tombe sur la boîte du SMSI | Coeur |
| `vulnerabilites-produits` | `ouvrirFiltres('Famille')` avant le filtre par famille | Coeur |
| `vulnerabilites-delais` | `ouvrirFiltres('Délai')` avant de lire le filtre repris de l'adresse | Coeur |
| `vulnerabilites-alertes` | Ouverture de l'aide « À propos de cette page » avant de lire l'explication (repliée par le lot) | Coeur |
| `…-fiches-parties` | Nouveau fichier | Coeur |

### 4.3 Choix d'apparence portés par le lot

- Pastille « En direct » et signature d'organisation retirées de l'en-tête ; « Hors ligne » n'apparaît qu'après huit
  secondes de coupure.
- Explications des pages Vulnérabilités repliées dans « À propos de cette page ».
- Critères de filtre repliés dans le panneau de la barre d'outils ; les filtres à segments restent visibles.
- Boîte d'outils bleu nuit dans les deux thèmes (fin de l'essai « claire ou bleu nuit »).

## 5. Captures natives

[Galerie](captures/README.md) : 22 images, clair et sombre, densité normale et compacte, de 1280 × 720 à 3840 × 2160.
