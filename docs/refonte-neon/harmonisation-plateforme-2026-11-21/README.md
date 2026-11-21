# Harmonisation de la plateforme — reprise du 21 novembre 2026

Date : 21 novembre 2026, Europe/Paris. Session « Codex » (`01a193c1-316c-7677-831f-2f31592aa052`).

**Implémenté et contrôlé localement, à valider visuellement.** Ce lot complète la
[refonte de densité](../densite-2026-11-21/README.md), sans remplacer ses preuves historiques.
Il part de `919ffa8129143e42e536b6e8f6690906ed6c535c`, sur
`codex/refonte-densite-2026-11-21`, dans la [PR brouillon #355](https://github.com/yousername-ha/suivi-audits/pull/355)
vers `claude-suivi-smsi`. Le travail applicatif est dans le dépôt ; ce dossier explique les choix et la recette.
Aucune fusion de PR, publication d’image ou mise en production n’est effectuée.

Le code contrôlé du complément est dans **`e29d6f656e3142b870be0a6f5a05ab99b7cd71b3`**. La branche reprend ensuite la version 7.5.1
(`01130ce47e0e2fa92fb4ef0efc233aff7d965126`) publiée pendant le travail : seuls les numéros de version, le manifeste de publication et le
journal changent par ce raccordement. Les sources frontend/UI et les specs E2E sont identiques au code contrôlé.
Les entrées UI restent **Non publié** ; elles ne font pas partie de la 7.5.1 déjà publiée. Les captures proviennent
du frontend avant ce raccordement de métadonnées. Aucun test serveur de la version amont n’est réattribué au lot UI.

## Demande et références

Le RSSI demande une application entière moins encombrée : même barre de vues/recherche/filtres dans les différents
modules, pictogrammes centrés, fenêtres cohérentes et informations secondaires moins présentes. Le normal doit rester
plus resserré que l’ancien compact ; le compact réduit encore l’encombrement. Les profils du lot précédent sont conservés.

La vidéo du lot précédent, les deux AVIF et les captures jointes ont été examinés. Les références apportent une composition
métier : listes denses, séparation sobre des lignes, statuts courts, filtres regroupés, champs courts en colonnes et actions
en bas des fenêtres. **Leur thème n’est pas copié** : le bleu nuit, le verre, les accents cyan/violet, la police Lexend et
les couleurs métier de la plateforme restent les bases du rendu. Ni les images privées ni leurs données ne sont publiées.
Les captures de ce dossier proviennent uniquement de l’application avec des données fictives.

## Modifications à connaître avant de reprendre le code

| Zone | Source et comportement |
| --- | --- |
| Barre commune | `apps/web/src/components/BarreOutils.tsx` reste la source de `BoiteOutils`, des vues en icônes et du panneau `FiltresAvances`. |
| Raccordement des écrans | Le nouvel adaptateur `apps/web/src/components/BarreFiltres.tsx` compose les contrôles déjà présents dans cette barre, en conservant leurs callbacks et leur formulaire. |
| Aspect transversal | `packages/ui/src/neon-harmonisation.css`, exporté par `packages/ui/package.json`, est importé **en dernier** dans `apps/web/src/main.tsx`, après densité/verre et les styles métier. |
| Anciennes variantes | `neon-ergonomie.css` abandonne la surcharge de boîte claire. `Layout.tsx` ne pose plus l’attribut de variante ; le choix expérimental clair/bleu nuit disparaît d’`Account.tsx`. Le champ de préférence déjà stocké n’est ni migré ni réécrit. |
| Fenêtres | `packages/ui/src/theme.ts` et `neon-fenetres.css` définissent le centrage, les noms de fermeture, le cadre, le corps défilant et les dimensions issues des profils. |
| Formulaires | `pilotage/Fields.tsx`, `RecordEditor.tsx` et `grc/ObjectEditor.tsx` exposent des classes communes pour la grille et les actions. |
| Aide secondaire | `packages/ui/src/components.tsx` permet un libellé spécifique pour `APropos`. Les explications concernées sont repliées, leur contenu reste accessible. |
| Recette | `apps/web/test/harmonisation-outils.test.tsx` vérifie les contrats des contrôles. Les specs E2E suivent les nouveaux emplacements sans suppression de leurs assertions métier. |

### Vues, recherche et filtres

L’inventaire syntaxique trouve **58 points d’intégration dans 50 fichiers consommateurs** : 39 appels à `BarreFiltres` et
19 appels directs à `BoiteOutils`. L’inventaire brut compte 59 appels dans 51 fichiers parce qu’il inclut l’appel interne
de l’adaptateur. Voir [couverture détaillée](preuves/couverture.json), avec fichiers et lignes.

Les raccordements concernent les registres GRC, fournisseurs/critères, périmètres, objectifs, actions/planning, documents,
référentiels/couverture, incidents, décisions, administration/journaux/notifications/archives, configuration, aide,
veille réglementaire et les recherches/filtres des Vulnérabilités. Les contrôles de recherche des cartes adoptent aussi
ce cadre ; les canevas et les algorithmes de cartographie ne sont pas redessinés.

- Une apparence de verre bleu nuit pour les deux thèmes ; contour cyan discret, reflet violet sur la recherche.
  Les hauteurs et espacements viennent des jetons de densité. Aucun agrandissement global par `zoom` ou `transform`.
- Les vues identifiées comme présentations deviennent des boutons d’icônes, avec nom accessible, état pressé, état
  désactivé et infobulle au survol **et au focus**. Les critères sémantiques ambigus gardent leur nom dans les filtres.
- L’adaptateur réutilise le premier `TextInput` textuel : événements, `name`, `form`, contraintes, valeur et référence sont
  conservés. Un champ de date n’est jamais pris pour une recherche. `useMergedRef` préserve les références existantes.
- Une commande « Rechercher/Filtrer » devient une loupe, avec les mêmes `type`, `form`, événements, états de chargement et
  désactivation. Les autres actions métier et les états de lecture restent visibles à côté.
- Les sélecteurs et cases sont regroupés dans le panneau du même entonnoir. Les filtres renseignés sont comptés ; leur
  remise à zéro appelle le code existant. Le tri et les valeurs par défaut restent définis par chaque page.
- Le panneau utilise **`withinPortal={false}`, `keepMounted`, `keepMountedMode="display-none"`**. Les champs restent dans
  leur formulaire et montés à la fermeture ; valeurs, contraintes et références ne sont pas suspendues par React Activity.
  Ne pas supprimer ces propriétés lors d’un nettoyage visuel.
- Le verre crée un contexte d’empilement : la barre est relevée seulement lorsque son entonnoir est ouvert, au-dessus
  des tableaux et sous les listes de choix en portail. La recette vérifie les contrôles au premier plan avec
  `elementFromPoint`, en plus de leurs dimensions.
- Le raccourci `/` ignore uniquement les dialogues **visibles**. Un panneau de filtres fermé, conservé dans le DOM,
  ne doit pas empêcher la recherche. Échap ferme le panneau et rend le focus à l’entonnoir.
- Les commandes de pliage/dépliage de la carte de surface restent des actions visibles via la propriété `actions` ;
  elles ne sont pas rangées parmi les critères.

Les recherches particulières de la navigation et la recherche globale à combobox des Vulnérabilités conservent leur
fonctionnement natif. Cette dernière reçoit les mêmes proportions et contours, sans remplacer sa navigation au clavier
ni ses requêtes. La recherche interne des valeurs d’une colonne reste dans son propre menu.

Pour raccorder un écran, préférer `BoiteOutils` directement si ses paramètres contrôlés sont déjà disponibles. Pour un
formulaire existant, remplacer seulement le conteneur des contrôles par `BarreFiltres`, en gardant le `<form>` extérieur,
les champs, leurs noms et leurs callbacks. Donner un `label` décrivant ce groupe. Ne pas déplacer les opérations métier
dans un panneau de filtres ni convertir une échelle temporelle en icônes ambiguës.

### Fenêtres et formulaires

L’inventaire recense **127 déclarations dans 71 fichiers : 122 Modal et 5 Drawer**. Le tiroir de navigation conserve son
habillage ; les quatre tiroirs métier et les fenêtres partagent le socle. Ce comptage est une couverture statique du style,
**pas une déclaration de test fonctionnel de 127 fenêtres**.

- Cadre commun : titre discret, bande cyan/violet, fermeture nommée « Fermer la fenêtre » ou « Fermer le panneau ».
  Un nom explicitement fourni par un écran reste possible. Centrage par défaut des modales.
- Les en-têtes, corps, champs, onglets et boutons suivent la densité. Les tableaux larges gardent leur défilement interne
  et l’élargissement au contenu, plafonné à 80 rem. Les sept déclarations RETEX rejoignent la typographie et le cadre
  commun tout en conservant leur chronologie spécifique.
- `.fenetre-large` est fourni par le thème aux tailles `lg`, `xl` et plein écran. À partir de 64 em, les formulaires
  concernés placent les champs courts sur deux colonnes ; nom principal, texte long, sélection multiple, sections,
  aides, tableaux et actions gardent la pleine largeur. Sur fenêtre plus étroite, le contenu revient à une colonne.
  L’ordre du DOM et de tabulation n’est pas changé.
- `.fenetre-formulaire` et `.fenetre-champs` désignent ces grilles. Les sélecteurs `:where(:has(...))` gardent une
  spécificité basse afin que le champ de nom principal conserve sa pleine largeur.
- Le titre reste en haut et les actions en bas. Seul le corps défile si le formulaire dépasse l’écran ; aucun champ
  n’est supprimé pour masquer une barre. Le fond du pied couvre également le retrait du corps, pour éviter qu’une ligne
  de texte apparaisse sous les boutons pendant le défilement.
- Dans `ObjectEditor`, l’enregistrement passe dans le dernier groupe `.fenetre-actions`. Son callback, ses droits,
  son chargement et son libellé sont préservés. « Liens et preuves » et l’historique se replient ; l’historique vide ne
  crée pas de bloc. Les avertissements, confirmations et erreurs nécessaires restent visibles.
- Les six aides secondaires ciblées du tableau de bord, de ses dialogues, des processus, du générateur de carte et des
  liens de fiche se replient via `APropos`. Les champs et leurs explications indispensables ne sont pas retirés.

### Centrage des pictogrammes

`.mantine-ActionIcon-icon` et `.nav-icone` centrent leur dessin par grille ; les SVG se rendent en bloc. Les dimensions
suivent la densité. Dans le registre des risques, les 24 pictogrammes des huit lignes fictives ont un écart entre centre
du dessin et centre du bouton inférieur à 1 px dans les configurations contrôlées. Cette mesure porte sur la géométrie
des SVG, sans changer l’action, les liens/preuves ou les décisions.

## Contrôles exécutés et portée

Environnement : Linux, Node 26.13.0, Chromium 151.0.7922.173, vrai frontend Vite, API entièrement interceptée. Les
[commandes et codes retour](preuves/controles-code.json), les [mesures client](preuves/recette-client.json) et les
[empreintes des fichiers applicatifs du lot](preuves/sources-controlees.json) accompagnent cette reprise.

| Contrôle | Résultat |
| --- | --- |
| Vitest web complet | **99 fichiers, 929 tests réussis**, dont 7 tests du nouvel adaptateur. |
| Vitest UI complet | **5 fichiers, 285 tests réussis** ; **1 214 tests distincts** au total avec le web. |
| TypeScript | Web, UI et sources E2E : codes retour 0. Compiler les specs E2E ne les exécute pas. |
| ESLint/Prettier | Fichiers TS/TSX, CSS et JSON du lot : codes retour 0. |
| Build web | Génération des variables CSS et build Vite : code retour 0. Avertissements existants conservés : `/update/client.js` sans `type="module"` et chunks > 900 kB. |
| Présentation | **72 cas de pages** à 1280×720, 1440×900, 1920×1080 et 3840×2100 ; matrice détaillée ci-dessous. |
| Fenêtres | **56 ouvertures de 7 variantes** : création/fiche/liens d’un risque, création/fiche/évaluation d’un fournisseur, création d’un produit. |
| Interactions ciblées | Filtres ouverts/fermés, Échap/retour du focus, recherche `/`, choix P1, propriété du formulaire et soumission Entrée du journal d’audit vérifiés dans les cas concernés. |
| Erreurs | Aucune erreur JavaScript, route API imprévue ou mutation métier dans les campagnes finales ; aucun débordement horizontal du document ou du corps des fenêtres testées. |

Matrice : 1440×900 = 12 pages × 2 thèmes × 2 densités (48 cas) ; 1920×1080 = 8 pages × 2 thèmes en normal (16 cas) ;
3840×2100 = 5 pages sombres en normal, taille automatique PC (5 cas) ; 1280×720 = 3 pages claires en compact (3 cas).
Les 56 ouvertures sont réparties sur ces combinaisons, elles ne désignent pas 56 formulaires différents.

Les pages sont Risques, Fournisseurs, Produits, Planning, Vue Vulnérabilités, Aide, Audit d’administration, Failles,
Machines, Alertes, Documents et Bibliothèque. Les dernières listes utilisent pour certaines des réponses fictives vides,
afin de vérifier les barres et états vides réels, sans prétendre recetter leurs données métier ou leurs calculs.

Dans l’audit d’administration, la recette saisit le filtre Compte, ferme le panneau, puis soumet la recherche par Entrée :
la lecture produite contient **à la fois** `q` et `user`. Cela vérifie que le panneau reste dans le formulaire. Les écritures
métier sont refusées par le harnais ; aucune sauvegarde réelle, session utilisateur ou base n’est utilisée.

Les premiers contrôles ont signalé des libellés absents du rendu serveur du panneau conservé via React Activity : le mode
`display-none` corrige cette régression. La largeur au contenu attendue par le test des tableaux a été conservée. Des
sélecteurs de recette ambigus ont été précisés, sans affaiblir les assertions métier. La relecture des images a ensuite révélé un panneau de filtres recouvert par les tableaux : le contexte d’empilement
du verre est corrigé et un contrôle d’occultation ajouté au harnais. Une réponse fictive d’alerte a aussi été complétée
avec `enCours: 0`, sans changement de contrat serveur. Ces finitions et le fond du pied sont vérifiés par le format,
les tests UI, le build et une nouvelle campagne de captures. Les essais intermédiaires et
rapports bruts restent hors Git. Les références visuelles de CI n’ont pas été mises à jour automatiquement.

**Non exécutés** : suite E2E sur Docker/API réelles, tests API/base, CI complète du commit publié, installation, mise à jour,
déploiement, test d’un fournisseur Mistral réel, audit exhaustif d’accessibilité, test mobile et validation humaine. La
recette client ne remplace pas ces contrôles. Les captures avec animations réduites ne valident pas le mouvement.

## Images pour validation

[Galerie](galerie.html) — PNG natifs, sans retouche ni agrandissement. Les fichiers privés de référence ne sont pas inclus.

- Fournisseurs, normal 1920 : [clair](captures/fournisseurs-clair-1920.png), [sombre](captures/fournisseurs-sombre-1920.png).
- Risques : [normal clair 1440](captures/risques-clair-1440.png), [compact clair 1280](captures/risques-compact-1280.png).
- Panneaux de filtres : [Failles](captures/failles-filtres-clair-1440.png), [Audit](captures/audit-filtres-sombre-1920.png).
- Fenêtres : [fiche risque sombre](captures/risque-fiche-sombre-1920.png), [création produit claire](captures/produit-creation-clair-1920.png),
  [fiche fournisseur sombre](captures/fournisseur-fiche-sombre-1920.png).
- Adaptation grand écran : [planning sombre 4K](captures/planning-sombre-4k.png).

## Reproduction et prochaine action

Depuis un clone isolé, avec Node 26+, pnpm 10.34.6 et les dépendances déjà installées :

```bash
git status --short --branch
pnpm --filter @suivi/web typecheck
pnpm --filter @suivi/ui typecheck
pnpm --filter @suivi/e2e typecheck
pnpm --filter @suivi/web test
pnpm --filter @suivi/ui test
pnpm --filter @suivi/web build
```

Ces commandes sont des instructions de reprise ; les commandes effectivement exécutées sont dans les preuves. Ne pas
confondre `pnpm test` à la racine, qui peut lancer l’API, avec les deux suites web/UI ici concernées.

Pour vérifier la couverture statique sur un autre état du dépôt, avec TypeScript déjà installé :

```bash
node docs/refonte-neon/harmonisation-plateforme-2026-11-21/outils/inventorier.cjs . /tmp/couverture-neon.json
```

Le harnais autonome est fourni dans [outils](outils/) avec ses fixtures entièrement fictives. Il nécessite Python,
Playwright et Chromium (`--chromium` pour choisir l’exécutable). Servir uniquement le frontend de développement puis lancer :

```bash
pnpm --filter @suivi/web exec node scripts/mantine-css-vars.ts
pnpm --filter @suivi/web exec vite --host 127.0.0.1 --port 5173 --strictPort
```

Dans un autre terminal :

```bash
python3 docs/refonte-neon/harmonisation-plateforme-2026-11-21/outils/capturer.py --base http://127.0.0.1:5173 --stage apres --out /tmp/recette-harmonisation --sizes 1440x900 --themes clair,sombre --densities normale,compacte --fenetres
```

Le harnais intercepte les API avant navigation et n’est pas un outil de recette sur données réelles. Ses images et rapports
sont des sorties privées par défaut ; ne pas publier de nouvelles preuves sans en contrôler le contenu.

Pour une IA reprenant une autre version : lire `AGENTS.md`, `HANDOVER.md` et ce dossier, puis comparer les composants
existants avant de reporter le changement. Réutiliser les sources communes ; ne pas créer une seconde barre ni une feuille
concurrente. Préserver permissions, champs, contraintes, callbacks, requêtes, exports, logique de génération SMSI et dessins
des cartes, calculs, SSE, préférences explicites de taille et mode mural. Aucun changement serveur, schéma, dépendance,
licence ou version n’est introduit par le présent lot UI.

**Prochaine action précise** : faire valider les images par le RSSI, puis recetter les formulaires et parcours E2E sur une
pile Docker isolée avec API/base réelles ; examiner les éventuels écarts visuels de CI avant toute approbation des références.
