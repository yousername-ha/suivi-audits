# Refonte de densité — reprise et recette du 21 novembre 2026

Date : 21 novembre 2026, Europe/Paris. Session « Codex » (`01a193c1-316c-7677-831f-2f31592aa052`).

**État : implémenté et contrôlé localement après la dernière correction Layout/verre.** Base :
`15dc5a6748f6105b6a1367fa7e3a3c944521efd5`, version 7.5.0, branche `codex/refonte-densite-2026-11-21`.
Le commit contenant ce dossier porte la livraison ; le SHA est consultable dans l’historique Git de la branche.
Aucune fusion, publication de version ou mise en production n’a été effectuée. La validation visuelle par l’utilisateur reste à recueillir.

## Demande et analyse

L’utilisateur a demandé l’analyse de sa vidéo puis a autorisé l’implémentation. L’objectif est d’afficher davantage de données
utiles : **le nouveau normal doit être plus dense que l’ancien compact ; le nouveau compact doit resserrer encore la
présentation**, en conservant lisibilité, parcours métier et réglages d’apparence.

La vidéo privée a été analysée par échantillonnage, complété par des observations en résolution native. **Elle reste hors
dépôt et hors livrable, avec ses images et son lien privé.** Les captures de recette sont produites séparément avec des données
fictives ; elles ne sont pas extraites de cette vidéo.

L’ancien compact réduisait quelques espacements sans agir sur toutes les marges, hauteurs de commandes et lignes. Le mode
automatique agrandissait aussi les écrans de travail 4K comme des écrans muraux. Le planning SVG étirait les textes et les
lignes avec son dessin, et le radar des vulnérabilités pouvait repousser les données sous la zone visible. La correction
porte sur ces causes, avec une source commune de dimensions, sans réduction globale par `zoom` ou `transform`.

Le dernier retour utilisateur est inclus dans le code : retrait visuel de la signature d’organisation et du badge « En
direct », bascule de thème par icônes dans l’en-tête et le pied de menu, onglets et commandes principales d’ajout en verre
transparent. Les couleurs des champs et états métier sont conservées.

## Modifications et fichiers

- **Profils de densité** : `packages/ui/src/tokens.ts` définit `DENSITES.normale`, `compacte` et `confortable`.
  `ESPACEMENTS` reprend le normal ; `variablesDensite()` expose espacements Mantine et variables sémantiques du cadre, des
  commandes, lignes, cartes, titres et fenêtres. Ne pas réintroduire une seconde source de dimensions concurrente.
- **CSS statique et CSP** : `apps/web/scripts/mantine-css-vars.ts` génère les variables de chaque profil ; l’absence d’attribut
  de densité applique le normal. `packages/ui/src/styles.css` retire les anciennes surcharges partielles. Le fichier CSS
  généré se refait au démarrage/build et ne se maintient pas à la main.
- **Application transversale** : `packages/ui/src/neon-densite.css` règle les hauteurs réelles des champs et commandes,
  le cadre, le menu, les onglets, les listes, les registres, les graphiques et les fenêtres. Les textes longs peuvent agrandir
  les lignes et la page ; aucune hauteur ne doit masquer une information. Le radar reçoit une largeur maximale adaptée au
  travail sur PC.
- **Apparence verre** : `packages/ui/src/neon-verre.css` applique fonds translucides, reflets, traits et flou aux onglets
  barre/pastilles et aux commandes d’ajout concernées. Les sélecteurs reprennent les anciens sélecteurs à forte spécificité.
  Les couleurs sémantiques restent disponibles ; le fond reste visible sans prise en charge du flou, et les onglets prévoient
  un repli pour la préférence de transparence réduite.
- **Ordre de chargement** : `packages/ui/package.json` exporte les deux feuilles ; `apps/web/src/main.tsx` importe la densité,
  puis le verre, après les feuilles métier. Cet ordre assure l’application des profils et conserve les formes d’onglets.
- **En-tête et thème** : `apps/web/src/components/Layout.tsx` retire le rendu `org-signature` et le badge Live. Les icônes
  de thème ont un nom accessible et une infobulle au survol/focus. L’en-tête bascule clair/sombre ; le pied de menu conserve
  le cycle de préférence existant, comprenant l’automatique.
- **Navigation et commandes** : `apps/web/src/components/OngletsRubriques.tsx` utilise des pictogrammes dans la famille
  Risques, donc aussi Vulnérabilités. Le libellé actif et les concepts ambigus restent nommés, avec noms accessibles complets
  et infobulles au focus. `apps/web/src/grc/CommandesRisque.tsx` est appelé par `RegistreRisques.tsx` : ouvrir, plan et
  liens/preuves ont des raccourcis en icônes ; « Évaluer » et « Décider » restent nommés. Les callbacks et gardes métier
  restent ceux du registre.
- **Planning** : `apps/web/src/pilotage/Plans.tsx` mesure la largeur disponible. Les attributs `width`, `height` et `viewBox`
  assurent une correspondance 1:1 entre unité du dessin et pixel. Sur petite fenêtre, le planning peut défiler à sa largeur
  minimale ; les libellés longs restent disponibles dans les titres. L’échelle est mémorisée au départ du glissement et
  l’annulation du pointeur est gérée. Les raccourcis clavier sont conservés. La description de vue passe dans `APropos`.
- **Aides des Vulnérabilités** : `apps/web/src/vulnerabilites/EnteteVulnerabilites.tsx` laisse titre et commandes visibles
  et place la description complète dans une aide fermée au départ. Il est utilisé par `Alertes`, `AnnuaireAd`,
  `DelaisExceptions`, `FaillesDetectees`, `Machines`, `MotsNonMasques`, `Perimetres`, `ProduitsSurveilles`, `Rapport`,
  `SeuilsPriorite`, `SurfaceExterne`, `Tendances`, `Veille` et `VueEnsemble`. La lecture des courbes et la règle de tendance,
  ainsi que la grille de priorité appliquée, restent consultables dans des volets repliés.
- **Tests et assertions adaptés** : `apps/web/test/navigation-dense.test.tsx` et `vulnerabilites-densite.test.tsx` couvrent
  noms, droits, callbacks, aide et cache. Les specs `tests/e2e/specs/parcours.spec.ts`, `recette-cartographie.spec.ts` et
  `zz-grc.spec.ts` suivent les nouveaux sélecteurs. Leur modification ne signifie pas que la suite E2E a été exécutée.

## Collision de cache corrigée

Le parcours Machines → Périmètres pouvait provoquer `e.perimetres is not iterable`. Deux réponses de formes différentes
partageaient la même clé React Query : un objet de bilan contenant `perimetres`, et un tableau d’options d’affectation.
Le cache pouvait fournir le tableau à la page qui attendait le bilan.

Dans `apps/web/src/vulnerabilites/perimetres.ts`, `CLE_PERIMETRES = ['vulnerabilites', 'machines', 'perimetres']` reste
réservée au bilan. `CLE_PERIMETRES_AFFECTABLES = ['vulnerabilites', 'perimetres-affectables']` est utilisée par les sélecteurs
de `Machines.tsx` et `SurfaceExterne.tsx`. Le test de régression remplit le cache dans les deux ordres et vérifie chaque forme
de réponse. Aucun changement de route ou de DTO n’était nécessaire.

## Invariants à préserver

- Sources d’authentification, API, base, migrations, calculs métier et sources de cartographie/génération SMSI inchangés.
  Les feuilles communes peuvent modifier l’espace occupé par des composants sans redessiner leurs canevas.
- Pas de nouvelle dépendance ni de changement de version dans ce lot. Le présent dossier complète les reprises précédentes
  sans réattribuer leurs preuves au nouveau code.
- Destinations, droits, noms accessibles et callbacks conservés. La présence ou l’absence d’un lien ne remplace pas une
  permission serveur. Les décisions métier restent explicitement nommées.
- Variables de densité générées statiquement pour respecter la CSP ; aucune injection dynamique de styles requise.
- Le retrait visuel du badge Live ne retire pas le flux temps réel. `Layout` consomme toujours son état et expose
  `data-temps-reel="connecte"` ou `"reconnexion"` sur `.shell-header`. Les parcours de temps réel et de cartographie attendent
  encore explicitement la connexion avant les interactions concernées.
- Densité, taille d’affichage, police, thème et forme des onglets restent distincts. La police ne change pas avec ce lot,
  le confortable reste proposé, et les tailles explicites de 90 à 150 % sont conservées.
- L’agrandissement automatique des très grands écrans vise désormais `html[data-mur][data-taille='auto']` : il sert à lire
  à distance. Un PC 4K offre davantage d’espace de travail et ne justifie pas à lui seul une mise à l’échelle murale.
  Le supplément propre au mode mural est conservé.
- Conserver les retours à la ligne, défilements, fenêtres et aides accessibles au clavier. Ne pas couper leur contenu pour
  atteindre artificiellement une hauteur de ligne ou de page.

## Résultats après la dernière correction

Recette du 21/11/2026, Europe/Paris, Linux, Node 26.13.0, Chromium 151.0.7922.173. Les commandes exactes et leurs codes retour sont dans
[contrôles du code](preuves/controles-code.json). Les dimensions et interactions sont dans [recette client](preuves/recette-client.json).

| Contrôle exécuté | Résultat et portée |
| --- | --- |
| TypeScript web, UI et sources E2E | 3 contrôles, code retour 0. La compilation des specs E2E ne les exécute pas. |
| Vitest web ciblé | 7 fichiers, 67 tests réussis. Navigation, charte, animations, aides, cache, périmètres et tendances. |
| Vitest UI | 5 fichiers, 285 tests réussis ; total avec le web ciblé : **352 tests**, sans compter deux fois les relances. |
| ESLint et Prettier | Fichiers TS/TSX, CSS et JSON du lot vérifiés selon la liste enregistrée ; codes retour 0. |
| Build frontend | Génération CSS statique puis Vite : code retour 0. Avertissements conservés : `/update/client.js` sans `type="module"` et chunks > 900 kB. |
| Matrice de présentation | **60 rendus finaux** : 5 pages × 3 fenêtres × 2 thèmes × 2 densités. 1440×900 et 1920×1080 à 100 %, 3840×2100 en taille automatique. |
| Interactions client | **24 cas** : Risques, Planning et Vue Vulnérabilités, 1440/3840, clair/sombre, normal/compact. Aucun échec ; 24 décalages du planning simulés, aucune écriture serveur. |
| En-tête et thème | Signature/statut absents de l’en-tête, icône nommée et sans texte visible ; bascule aller-retour vérifiée dans les 24 cas. |
| Clavier et affichage | Aides ouvertes/fermées par Entrée, infobulle Surface externe au Tab ; planning à l’échelle 1:1, +1 / −7 jours au clavier, +3 jours au glissement, ouverture de fiche par Entrée. |
| Taille explicite/murale | 4 cas 4K : 16 px en automatique PC, 24 px à 150 %, 30 px en automatique mural. |
| Erreurs et débordements | Aucune erreur JavaScript, route API imprévue ou mutation métier réelle ; aucun débordement horizontal du document dans les 84 rendus après correction. |

La recette utilise **le vrai frontend Vite et Chromium, une API entièrement interceptée et des données entièrement fictives**.
Aucune session réelle, base métier ou production n’est utilisée. Les mutations métier sont refusées ; seuls les décalages
explicitement simulés du planning sont enregistrés par le harnais. Ces vérifications portent sur le client.

Les mêmes fixtures sont appliquées à l’ancienne base et au code modifié. Les mesures comparent l’ancien compact au nouveau
normal puis au nouveau compact, à fenêtre, thème et préférence de taille identiques :

| Mesure à 1440×900, 100 % (px) | Ancien compact | Nouveau normal | Nouveau compact |
| --- | ---: | ---: | ---: |
| En-tête | 72 | 44 | 40 |
| Largeur de navigation | 263 | 223 | 207 |
| Lien de navigation | 44 | 36 | 34 |
| Onglets, avec le nouveau contour verre | 46,78 | 36 | 32,19 |
| Première ligne Risques | 97 | 39 | 37 |
| Première ligne Fournisseurs | 127,95 | 91,77 | 84,77 |
| Première ligne Produits | 71,59 | 55,30 | 49,72 |

À 1440×900, les lignes entièrement visibles passent de **5 à 8 risques**, de **2 à 4 fournisseurs** en normal (6 en compact),
et de **5 à 8 produits**. À 1920×1080, les 6 fournisseurs sont visibles en normal, contre 4 auparavant.
La police Lexend est conservée ; le texte des tables à 1440 est de 14 px au lieu de 13,12 px. Le gain vient surtout de la composition,
des marges et des commandes. Les textes longs peuvent encore augmenter la hauteur d’une ligne.
Les 30 comparaisons confirment une réduction du nouveau normal, puis du compact, pour l’en-tête, les onglets,
les liens du menu et les premières lignes de données disponibles. Les titres et dessins ne sont pas soumis à une réduction artificielle uniforme.
Voir [mesures 1440/1920](preuves/comparaison-1440-1920.json) et [mesures 4K](preuves/comparaison-4k.json).

Sur PC 4K en automatique, la racine passe de 24 à 16 px ; le planning passe d’environ 1333 à 404 px de haut sans étirer son texte,
et le radar de 1608 à 599 px. Les 7 lignes de vulnérabilités sont visibles au chargement au lieu d’être repoussées sous la zone visible.
À 1440 et 1920, cette longue page reste défilable verticalement. Les listes et le planning conservent leurs défilements internes.

### Captures réelles à examiner

[Galerie complète](galerie.html), images PNG intactes, sans retouche ni agrandissement :

- Risques : [ancien compact clair](captures/avant-risques-clair-compact-1440.png), [nouveau normal clair](captures/apres-risques-clair-normal-1440.png),
  [nouveau compact clair](captures/apres-risques-clair-compact-1440.png), [nouveau normal sombre](captures/apres-risques-sombre-normal-1440.png).
- Fournisseurs, 1920 : [clair](captures/apres-fournisseurs-clair-normal-1920.png) et [sombre](captures/apres-fournisseurs-sombre-normal-1920.png).
- Planning : [clair 1920](captures/apres-planning-clair-normal-1920.png) et [sombre 4K](captures/apres-planning-sombre-normal-4k.png).
- Vulnérabilités : [sombre 4K](captures/apres-vulnerabilites-sombre-normal-4k.png).

### Essais intermédiaires et limites

Les premiers essais ont détecté des attentes trop courtes après changement de taille et un serveur Vite lancé avant
l’ajout du nouvel export CSS. L’attente de taille porte désormais sur la valeur calculée, et le serveur a été redémarré.
Les campagnes finales ci-dessus ont ensuite toutes été rejouées après Layout/verre. Les résultats préliminaires ne sont
pas comptés comme succès ; leurs rapports bruts restent hors dépôt. Une première limite de radar trop basse a aussi été
corrigée avant les campagnes finales pour préserver les libellés.

**Non exécutés** : suite E2E sur Docker/API réelles, tests API/base, CI complète du commit publié, installation ou déploiement.
Les 5 pages et les interactions ciblées ne couvrent pas chaque fenêtre/formulaire de l’application. Aucun audit exhaustif
d’accessibilité, test mobile ou validation humaine n’est revendiqué. Les références visuelles du dépôt ne sont pas approuvées
par cette campagne. Les captures avec animations réduites vérifient la présentation, pas les animations en mouvement.

## Commandes de reprise

Ces commandes sont des indications de reproduction, pas une déclaration d’exécution. Depuis la racine d’un clone isolé,
avec Node 26+ et pnpm 10.34.6, dépendances déjà installées :

```bash
git status --short --branch
node --version
pnpm --version
pnpm --filter @suivi/web typecheck
pnpm --filter @suivi/ui typecheck
pnpm --filter @suivi/e2e typecheck
pnpm --filter @suivi/web exec vitest run test/navigation-dense.test.tsx test/charte.test.ts test/navigation.test.ts test/animations-continues.test.ts test/vulnerabilites-densite.test.tsx test/vulnerabilites-perimetres.test.ts test/vulnerabilites-tendances.test.ts
pnpm --filter @suivi/ui test
pnpm lint
pnpm format:check
pnpm --filter @suivi/web build
```

Le build web régénère le CSS statique. Les contrôles globaux de lint et de format sont plus larges que les contrôles ciblés
des étapes intermédiaires. Ne pas déduire de cette liste l’autorisation de lancer une suite API ou Docker contre une base
partagée.

Les outils `capturer.py`, `comparer.py` et les données entièrement fictives `fixtures.json` sont fournis dans [outils](outils/). Ils exigent Python,
Playwright et un Chromium disponible (chemin configurable par `--chromium`). Ils ne sont pas chargés par l’application.
Les rapports bruts et les essais intermédiaires restent hors dépôt ; seules les synthèses anonymisées sont publiées. Pour servir le frontend isolé :

```bash
pnpm --filter @suivi/web exec node scripts/mantine-css-vars.ts
pnpm --filter @suivi/web exec vite --host 127.0.0.1 --port 5173 --strictPort
```

Après adaptation de `RECETTE_DIR` et du port vers l’instance locale à mesurer :

```bash
RECETTE_DIR=docs/refonte-neon/densite-2026-11-21/outils
python3 "$RECETTE_DIR/capturer.py" --base http://127.0.0.1:5173 --stage apres --out "$RECETTE_DIR/captures-finales" --sizes 1440x900,1920x1080 --themes clair,sombre --densities normale,compacte --taille 100
python3 "$RECETTE_DIR/capturer.py" --base http://127.0.0.1:5173 --stage apres --out "$RECETTE_DIR/captures-auto-finales" --sizes 3840x2100 --themes clair,sombre --densities normale,compacte --taille auto
python3 "$RECETTE_DIR/capturer.py" --base http://127.0.0.1:5173 --stage apres --out "$RECETTE_DIR/interactions-finales" --sizes 1440x900,3840x2100 --pages planning,vulnerabilites --themes clair --densities normale,compacte --taille auto --interactions
python3 "$RECETTE_DIR/comparer.py" --avant "$RECETTE_DIR/captures/avant/rapport.json" --apres "$RECETTE_DIR/captures-finales/apres/rapport.json" --out "$RECETTE_DIR/comparaison-finale.json"
```

Pour un nouvel avant/après, servir l’ancienne base dans un autre checkout ou sur un autre port avec le même harnais et
`--stage avant`. Ne pas remettre le checkout de travail à zéro. Le comparateur produit des mesures sans inventer un seuil
d’acceptation humaine.

## Prochaine action

Consulter les captures, puis tester la branche dans un Docker de test avec l’API réelle : navigation, fenêtres de lecture/modification,
permissions, réception SSE et glissement du planning. Faire exécuter les contrôles CI requis avant une éventuelle fusion vers
`claude-suivi-smsi`. Ne pas fusionner vers `main` ni déployer par déduction. Pour reprendre le code, lire d’abord ce document,
puis le diff du commit et les deux feuilles CSS communes ; vérifier ce qui existe dans la branche cible avant tout report.
La vidéo privée et ses images restent exclues de ce dossier et de tout livrable.
