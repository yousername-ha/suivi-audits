# ASTRA — refonte de l’interface GRC

## Provenance et périmètre

Branche de travail et de livraison : `legacy`, confirmée par l’utilisateur le
12 octobre 2026 après nettoyage des branches distantes. La refonte ASTRA a été
réappliquée sur cette branche, sans merge, rebase ni cherry-pick. Les autres
branches et les fichiers non suivis ne sont pas modifiés ni inclus dans le ZIP.

Base : `4bcdf60c629b50466aa40f1a98d67346a4641359`. La première réalisation avait été
autorisée sur la branche alors nommée `legacy/test-lots-d-f` ; elle est conservée
localement sous `archive/astra-refonte` au commit
`3f711d67d861e791b1ec39e9be8d72a14482f63e`. Lors de l’intégration, la branche distante `legacy` désignait
la même base, permettant de reprendre les modifications ASTRA sans conflit.
Lors de la restauration initiale, les 122 blobs du ZIP fourni, les arbres et le
commit avaient été vérifiés par leurs empreintes Git exactes. L’historique local
reste limité à cette base et aux commits de la refonte.

## Audit de l’application réelle

Application HTML/CSS/JavaScript servie par `demarrer.py` et `legacy_server.py`,
SQLite et pièces privées dans `.legacy-data`. Lanceurs Windows, Linux et macOS
existants ; bibliothèques d’export déjà embarquées dans `lib/`. Python 3.10+
reste nécessaire, sans dépendances Python tierces. Le runtime est directement
exécutable : aucun compilateur, npm, Docker, CDN ou serveur externe requis.

Registres conservés : `findings` et leurs sous-actions, `plans`, `recurring`,
`riskMgmt`, `items`/`dda`, `frameworks`, `evidences`, `perimeters`, `roles`,
incidents/crise, fournisseurs/accès, audits, objectifs/indicateurs, cartographies,
CaRE/HAS, parcours, PCRA, CRRC, investissements, IA et écarts applicatifs.
Les calculs de risque et de conformité, le schéma de stockage et les routes API
Python sont conservés. Le module `risk-core.js` expose désormais le rattachement
à l’Annexe A via les relations `objectRefs` existantes ; le serveur contrôle les
changements de liens, leur réciprocité et les périmètres autorisés.
L’adaptateur JavaScript de sauvegarde conserve les identifiants internes attribués
par le serveur dans les saisies en attente : cela corrige un refus HTTP 422 lors
d’une édition immédiate après création, sans écraser les champs modifiés ou
restaurer les éléments supprimés. Les identifiants déjà renseignés restent soumis
au contrôle d’immutabilité du serveur.
Le pont d’interface expose les calculs existants et le setter de statut commun
extrait du gestionnaire historique. Le changement de statut appelle ce même
setter depuis le registre et le Kanban, puis la persistance serveur existante.

## Navigation

Quatre familles regroupent les 100 destinations réelles ; aucun module métier
supplémentaire n’a été créé pour remplir l’arborescence.

| Famille                  | Rubriques                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pilotage & stratégie     | Cockpit RSSI, objectifs/indicateurs, rapports, investissements                                                                        |
| Gouvernance & GRC        | Risques et études, conformité, CaRE, HAS, audits, preuves, contexte, cartographies, parcours, fournisseurs, PCRA, gouvernance de l’IA |
| Opérations & remédiation | Plans d’action, tâches récurrentes, programmes du SMSI, incidents/crise, écarts applicatifs, CRRC                                     |
| Administration           | Organisations/périmètres, responsabilités, comptes, paramètres, référentiels et journal                                               |

L’IA est séparée des écarts applicatifs ; les récurrences possèdent un accès direct.
Les vues de travail sont intégrées à leur rubrique, sans menu principal par vue.
Le cockpit dirige vers les registres, les fiches et les filtres de retard.
Les responsabilités passent dans l’organisation ; les habilitations restent
celles du serveur. Navigation réductible sur bureau et menu mobile conservé.

## Design system et consultation

`modules/astra.css` définit surfaces, typographie locale embarquée, palette
pétrole/bleu et états verts, jaunes, orange et rouges, tableaux, filtres,
progression, matrice, calendrier, Kanban, chronologie et panneaux latéraux.
Les statuts portent toujours un libellé ; la couleur n’est pas le seul indicateur.
Les politiques de risque conservent leurs couleurs versionnées. Les éléments
interactifs ont un focus visible et des alternatives au déplacement à la souris.
Thèmes clair/sombre, adaptation aux petits écrans et réduction des animations.

`modules/astra-ui.js` est une couche de présentation enregistrée dans le mécanisme
existant de plugins. Les fiches de risques, actions et séries récurrentes s’ouvrent
en consultation, avec édition explicite. Les champs complets historiques restent
accessibles. Dans les tableaux historiques concernés, les champs de saisie sont
remplacés visuellement par leur valeur jusqu’au choix « Modifier les données » ;
les contrôles et leurs gestionnaires ne sont pas supprimés.

## Vues livrées

- **Risques** : matrice impact/vraisemblance par politique et version, nombre et
  références des risques dans chaque cellule, sélection, fiche contextuelle,
  traitements, mesures, preuves, décisions et historique. Initial, résiduel et
  accepté utilisent exclusivement les références explicites du moteur existant.
- **Cockpit** : risques exigeant un traitement selon leur politique, couverture
  d’évaluation résiduelle, actions et récurrences en retard, incidents ouverts,
  scores déclarés, progression, priorités et dernières évaluations réelles.
- **Conformité** : scores de mise en œuvre, progression par domaine, hiérarchie
  repliable, recherche, filtres d’écarts et de preuves, fiches et évaluation à la
  demande. Déclaration, couverture présumée et état effectif restent distingués
  pour les référentiels complémentaires ; aucune certification n’est déduite.
- **Actions** : Liste, Kanban avec déplacement de statut et alternative clavier,
  Planning jour/semaine/mois, Calendrier, Gantt mois/trimestre/année et Synthèse.
  Recherche, filtres statut/responsable, tri, regroupement domaine/responsable,
  progression des sous-actions, échéances et retards. Sous-actions historiques
  accessibles séparément au sein du même registre.
- **Programmes SMSI** : mêmes représentations sur le registre `plans`, dates de
  début/fin et jalons. Les fiches de formation, sensibilisation, audit et exercice
  conservent leurs champs et actions spécifiques.
- **Récurrences** : Liste, Kanban d’état calculé, Planning et Calendrier avec
  projections, historique et consultation d’une date. Réalisation et édition de
  la série via le formulaire existant ; aucune série supplémentaire créée.
- **Autres modules** : fonctions et routes préservées, navigation et composants
  visuels harmonisés. Les fonctions expertes restent accessibles par les vues
  de saisie détaillée lorsqu’elles ne possèdent pas de nouvelle synthèse.

## Rattachement des risques à l’Annexe A ISO 27001:2022

Depuis la matrice ou le registre, ouvrir la fiche d’un risque puis choisir
**Lier / délier des mesures** dans la section **Mesures liées · Annexe A
ISO 27001:2022**. Rechercher par référence ou titre, filtrer par domaine, cocher
une ou plusieurs mesures puis enregistrer. Décocher retire uniquement le lien
explicite ; cela ne supprime aucune mesure du référentiel.

Le catalogue est celui des 93 mesures de l’Annexe A déjà embarquées, limité aux
objets consultables par le compte connecté. Aucun référentiel dupliqué ni champ
de score ajouté. Les relations sont stockées dans les `objectRefs` bidirectionnels
existants et historisées côté serveur. Une mesure ouvre sa fiche de conformité,
où les risques liés sont également consultables. Le rôle lecteur peut consulter
ces liens, mais ne peut pas les modifier.

Les liens déjà portés par les mesures des plans de traitement sont également
visibles et identifiés comme tels. Ils restent gérés dans leurs plans ; décocher
un lien direct ne les efface pas. Les scores, décisions, niveaux résiduels et
statuts de conformité ne sont pas recalculés par un rattachement.

## Limites explicites du modèle préservé

- Pas d’évaluation cible dans `riskMgmt` : aucun quatrième score fictif ajouté.
  Une référence résiduelle absente reste « Non évalué » ; pas de repli implicite.
- Politique manuelle : cellules neutres et pastilles aux niveaux réellement
  évalués. Seule une politique possédant une matrice explicite colore les cellules.
- Pas de score global de maîtrise mélangeant différentes méthodes, ni de tendance
  numérique artificielle. Les dernières évaluations sont affichées chronologiquement.
- Les actions sans date de début apparaissent comme jalons d’échéance. Aucune
  durée supposée ni nouveau champ métier imposé. Les programmes avec dates ont
  des barres ; les avancements non renseignés ne sont pas estimés depuis un statut.
- Pas de dépendances de planification présentes dans le modèle : aucune flèche
  de dépendance ou édition de lien inventée ; les liens métier existants restent.
- Le moteur de récurrence recalcule à partir de la dernière réalisation. Une
  projection passée n’est ni une preuve d’exécution ni une occurrence persistée
  manquée. Pas de modification isolée ou « à partir de cette occurrence » ; ces
  fonctions nécessiteraient un nouveau modèle métier et n’ont pas été ajoutées.
- Le Kanban récurrent est consultatif : ses états sont calculés. Enregistrer une
  réalisation fait évoluer les mêmes échéances dans toutes les représentations.
- Les preuves de référentiels complémentaires n’ont pas de métrique autonome
  fiable : compteur non calculé, plutôt qu’un faux taux de couverture.
- Les vues détaillées historiques demeurent nécessaires pour certains parcours
  spécialisés. La refonte ne prétend pas remplacer chaque formulaire expert.

## Validation et distribution

Voir `recette/astra-validation.json` pour les résultats de cette livraison,
distincts des résultats historiques déjà présents dans `recette/`.

Contrôles : syntaxe de tous les modules JS et du script principal, compilation
Python, 55 tests JavaScript (métier, rattachements et file de sauvegarde), 31 tests serveur, recette Chromium
avec données explicitement fictives isolées, 101 destinations de navigation (100 d’origine plus « Apparence »),
quatre résolutions (390, 768, 1440, 1920 px), thème sombre, rôle lecteur,
changement de statut, formulaires, récurrences et rechargement serveur.

Le script `scripts/package_astra.py` prend les seuls fichiers suivis de la branche
autorisée et met à jour le manifeste SHA-256 dans le package. Aucune base SQLite,
pièce utilisateur, session, dépendance de développement ni fichier d’autre branche
n’est livré. Les données de recette et les captures ne sont pas injectées dans
l’interface réelle. Une copie extraite est testée avec les lanceurs d’origine.

Le lancement a été testé sous Linux dans Chromium. Le double-clic `demarrer.bat`
sur Windows n’a pas été exécuté dans cet environnement ; le fichier et la chaîne
de lancement Python d’origine sont conservés. Aucun binaire Windows n’est requis
ni ajouté, puisque la distribution initiale utilise déjà Python.

## Habillage global « Référence 08 » (13 octobre 2026)

Source de vérité : `samples/2026-10-13-astra-15/`. Résultats et limites réels : [`recette/apparence-globale.md`](../recette/apparence-globale.md) ;
captures de l’application intégrée : [`samples/2026-10-13-astra-16/`](../samples/2026-10-13-astra-16/README.md).

- **Fichiers ajoutés** : `modules/nes-sage.css` (jetons et règles, tous bornés par `html[data-nes-style]`) et `modules/nes-sage-ui.js`
  (lecture serveur, aperçu, propagation, bandeau d’identité, pictogrammes et chevrons de navigation, panneau Apparence). Modifications
  ciblées : `index.html` (chargement des deux fichiers, appel `NesStyle.beforeRender(ui)` au début de `render()` et `NesStyle.load()` au
  démarrage), `modules/admin-ui.js` (destination et panneau Apparence), `modules/astra-ui.js` (palette de présentation de la matrice,
  contraste du texte des cases, badge « En retard » en double), `legacy_server.py` (table `appearance`, deux routes, migration,
  schéma 3), `scripts/package_astra.py` (garde de branche).
- **Attributs** : `data-nes-style="sage|clair"` et `data-nes-mode="light|dark"` (dérivé de `data-theme` et de `prefers-color-scheme`) ;
  le mode personnel Clair / Sombre / Système n’est pas modifié, le sombre garde ses variables.
- **Cartographies** (`tab: carto`, `tab: dash` avec `dashView: map`) : l’attribut, le bandeau et les décorations sont retirés
  **avant** le rendu (`beforeRender`) puis à chaque rendu ; `carto-core.js`, `carto-ui.js`, `carto.css` et `legacy_cartography.py` ne sont pas modifiés.
- **Matrice des risques** : la palette vive (Faible `#4DBB69`, Modéré `#FFDF45`, Élevé `#FF8335`, Critique `#E5192F`) ne s’applique
  qu’à une politique **reconnue comme standard** : calcul matriciel, quatre niveaux d’identifiants `L1` à `L4`, de libellés
  Faible / Modéré / Élevé / Critique et de couleurs identiques au gabarit livré (`LegacyRisks.DEFAULT_POLICY`). Une politique dont
  un identifiant, un libellé ou une couleur diffère, ou à appréciation manuelle (cellules neutres, aucun barème inventé), garde ses
  couleurs ; aucune politique ni évaluation versionnée n’est modifiée.
- **Serveur** : `GET /api/appearance` (compte actif) → `{style, revision}` ; `PUT /api/admin/appearance` (administrateur, CSRF) avec
  `{style, revision}` strict → 200 `{style, revision}`, 401, 403, 422, 409 `{error, style, revision}` ; même style = aucun changement ;
  trace `Apparence globale` (avant / après). `PRAGMA user_version` passe de 2 à 3 sans jamais être abaissé.
