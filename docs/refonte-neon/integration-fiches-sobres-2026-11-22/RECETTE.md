# Recette du 22/11/2026 — fiches sobres et harmonisation

Branche `claude/fiches-sobres`. Deux natures de contrôle, à ne pas confondre :

- **Tests unitaires et de rendu** (`apps/web`, `packages/ui`) : sans navigateur ni serveur ; ils vérifient les règles
  pures, les feuilles de style et le rendu du thème.
- **Recette sur pile réelle** : images Docker `api`, `web` et `updater` construites depuis la branche, base
  PostgreSQL 18 neuve, HTTPS local, navigateur du conteneur Playwright officiel. **Aucune API simulée** dans cette
  recette, à la différence des preuves de la livraison Codex (interface compilée et API interceptée), qui n'ont pas été
  reprises et ne valent pas pour ce code.

Non fait : recette sur un serveur de l'établissement, annuaire et Tenable réels, navigateurs autres que Chromium.

## 1. Contrôles locaux

| Contrôle | Résultat |
| --- | --- |
| `npx eslint . --max-warnings 0` | Vert |
| `npx prettier --check .` | Vert |
| `tsc --noEmit` (`apps/web`, `packages/ui`, `tests/e2e`) | Vert |
| Tests de l'interface (`apps/web`) | 968 réussis, 104 fichiers |
| Tests de la charte (`packages/ui`) | 285 réussis |
| Construction de l'interface, `scripts/ci/verifier-changelog.mjs` | Verts |

Tests ajoutés : cinq cas dans `apps/web/test/fiches-parties.test.ts` (intitulés par premier champ, section ouverte en
milieu de partie, grille élargie, piles imbriquées) et un dans `apps/web/test/proportions-champs.test.ts` (aide permanente ; le cas
de l'aide repliée vient de la livraison Codex).

## 2. Suite de bout en bout sur pile neuve

| Passage | Résultat |
| --- | --- |
| Suite complète (280 tests, 33 minutes) | **275 réussis, 2 ignorés (par conception), 3 échecs** |
| Les trois échecs, corrigés puis rejoués sur la même pile avec l'image reconstruite | 3 réussis |

Les trois échecs et leur correction :

- Deux parcours « Fréquences » (module Vulnérabilités) lisaient l'avertissement « En dessous de 24 heures… » d'un
  connecteur, replié par l'aide contextuelle. Correction **dans le produit**, pas dans le test : un avertissement reste
  affiché (`ChampFrequence.tsx`).
- Le nouveau test des fiches visait le bouton d'aide par un sélecteur mal ancré. Correction du test (fichier de ce lot).

Il n'y a pas eu de second passage complet après ces deux corrections ; la CI de la PR rejoue toute la suite.

## 3. Balayage de toutes les fenêtres (pile réelle, 1280 × 720, clair, densité normale)

Un script d'exploration (non livré) visite chaque page atteignable depuis le menu et les cartes, ouvre chaque fenêtre
par ses boutons et relève découpage, repli, champs tronqués ou recouverts, sortie de l'écran, erreurs JavaScript et
alertes CSP.

| Mesure | Résultat |
| --- | --- |
| Pages visitées | 128 |
| Fenêtres ouvertes | 134 |
| Tiennent en une seule vue | 79 |
| Découpées en parties | 47 (33 en deux parties, 10 en trois, 4 en quatre) |
| Gardent leur défilement par choix | 8 (5 longs tableaux, 3 fenêtres de consultation déclarées) |
| Retombées sur le défilement faute de découpage sûr | 0 |
| Champ tronqué, à cheval ou recouvert dans une fenêtre découpée | 0 |
| Fenêtre sortant de l'écran, erreur JavaScript, alerte CSP | 0 |

Le balayage a tourné avant les deux derniers changements (boutons neutres des pieds de fenêtre, aides gardées
affichées) ; les fenêtres concernées sont couvertes par les fiches ciblées ci-dessous et par les captures.

## 4. Fiches ciblées, tailles et modes

| Modes | Fiches | Constat |
| --- | --- | --- |
| 1280 × 720 et 1920 × 1080, clair, normal | 28 fenêtres (risque, revue, action, responsabilité, processus, objectif, indicateur, constat, continuité, partie intéressée, fournisseur, produit, périmètre, registre, preuve, étude, sécurité, certificats, import, flux, modules, sauvegardes, courriel…) | Aucun défaut ; journaux en défilement déclaré |
| 1280 × 720 compact ; 1440 × 900 sombre ; 1920 × 1080 sombre compact ; 1024 × 700 | 8 fenêtres longues | Aucun défaut ; à 1024 px pas d'élargissement, découpage seul |
| 1366 × 768 compact | « Sécurité » | Découpée, aucun défaut |
| 2560 × 1440 clair ; 3840 × 2160 sombre compact | Création d'un risque | Une seule vue |

## 5. Cas demandés

| Cas | Vérification | Constat |
| --- | --- | --- |
| Valeurs conservées d'une partie à l'autre | Test de bout en bout | Aucun champ démonté ; valeurs relues après navigation, redimensionnement et aide ouverte |
| Formulaire propriétaire, références, callbacks | Suite complète (enregistrements réels de risques, actions, fournisseurs, produits, comptes) | Inchangés |
| Erreurs | Test de bout en bout (« Ne correspond pas à la fin du poivre. ») et parcours du poivre | Affichées sans action ; la partie d'une erreur nouvelle s'affiche |
| Preuves et liens | Parcours Pilotage G/H et fiche de risque existante | Section « Liens et preuves » inchangée |
| Clavier et focus | Test de bout en bout (flèches, Début, Fin, Entrée et Échap sur l'aide, champ d'une autre partie) | Conformes |
| Redimensionnement | Test de bout en bout (1280 × 720 ↔ 1920 × 1080) | Élargissement réévalué, parties recalculées, valeurs conservées |
| Listes dynamiques | Test de bout en bout (fiche d'un fournisseur : un certificat et trois contrôles ajoutés) | Champs ajoutés visibles dans leur partie, aucun défaut |
| Aides contextuelles | Test de rendu et de bout en bout | Texte et association accessible conservés, aide repliée ou non |
| Sombre | Fiches ciblées et captures | Même composition, palette `FICHES.sombre` |

## 6. À valider par le RSSI avant toute fusion

### 6.1 Validation graphique

[Galerie](captures/README.md) : 44 captures natives de la pile réelle, clair et sombre, normal et compact, de
1280 × 720 à 3840 × 2160. Points où cette livraison s'écarte de la capture validée ou la prolonge :

- la fenêtre d'un formulaire long s'élargit (jusqu'à 76 rem) et passe sur plusieurs colonnes ;
- « Annuler » et « Fermer » sont neutres et sans contour dans **toutes** les fenêtres ;
- dix-sept aides restent affichées sous leur champ (avertissements et formats de saisie) ;
- les journaux et les longs tableaux défilent dans leur fenêtre.

### 6.2 Captures de référence

Six captures de référence changent par rapport à celles de la PR de la refonte (`ecrans-liste-fiche-*` : fiche en
1366, 768 et 390 px, clair et sombre). Elles sont dans un commit à part, à relire dans l'onglet des fichiers de la PR ;
ce commit peut être retiré seul. Les soixante-huit captures régénérées par la refonte restent à valider elles aussi.

### 6.3 Tests de bout en bout modifiés

Un seul fichier, `…-fiches-parties.spec.ts` (créé par la refonte, étendu ici) :

- ajouts : fenêtre élargie, une seule vue en 1920 × 1080, « Sécurité » découpée sans repli, aide d'un champ, liste
  dynamique d'un fournisseur ;
- attente modifiée : la hauteur de la fenêtre est « au plus 90 % de l'écran » (elle était « moins de 90 % ») ; la
  fenêtre « Sécurité » doit être découpée (elle pouvait être découpée ou défiler).

Aucun autre test de bout en bout n'est modifié par cette livraison.
