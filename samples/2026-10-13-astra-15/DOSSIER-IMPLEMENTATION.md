# Dossier d’implémentation consolidé — ASTRA / référence 08

Version du 13 octobre 2026. Dépôt `yousername-ha/suivi-audits`, branche exclusive `legacy`.
Base inspectée : `b8ff86126f70114ba3bb7e32a4552fbefd3b7b04`.

## 1. Source de vérité et décisions

Ce dossier remplace les prescriptions d’implémentation des séries 09, 12 et 13 lorsqu’elles divergent. Leurs fichiers et images sont conservés comme historique. Aucune décision nouvelle ne doit être déduite de leurs anciennes palettes ou de leurs prototypes.

| Sujet | Décision courante |
| --- | --- |
| Référence visuelle principale | [Image originale de la série 08](../2026-10-12-astra-08/02-turquoise-assombri.png), explicitement choisie par l’utilisateur |
| Déclinaison des écrans | [30 vues de la série 14](../2026-10-13-astra-14/README.md), dont six vues des plans d’action et cinq des tâches récurrentes |
| Couverture fonctionnelle | Toutes les destinations du registre réel ; les 30 images sont une sélection, pas une réduction du périmètre |
| Navigation annotée | Conserver les pictogrammes, l’icône active turquoise et les chevrons de dépli/repli à droite, selon la dernière capture annotée |
| Matrice des risques | Cases entièrement colorées selon le niveau, comme la dernière capture fournie ; cette référence remplace le rendu atténué de la vue 03 |
| Tâches récurrentes | Organisation inspirée de Tenacy, intégrée à l’identité visuelle 08 ; ne pas importer une autre palette |
| Deux styles | `sage` = « Référence 08 — Sauge », valeur par défaut ; `clair` = « Clair bleuté », fond alternatif conservé |
| Portée du choix | Globale à l’instance, pour tous les utilisateurs et tous leurs appareils ; seuls les administrateurs la modifient |
| Mode clair/sombre/système | Préférence personnelle existante, distincte du style global |
| Cartographies | Aucun changement de leur interface ni de leur fonctionnement, même par héritage de CSS |

La mention « étape intermédiaire » dans l’ancien README de la série 08 est dépassée par le choix explicite ultérieur de l’utilisateur. L’ancienne obligation d’utiliser `#236B70` comme unique accent est remplacée par les repères de la série 14 ci-dessous. La nouvelle demande porte sur la réalisation conforme à ce dossier ; les captures ne constituent pas une recette logicielle déjà passée.

**État actuel :** les modules métier ASTRA existent sur `legacy`. Les nouveaux habillages et le sélecteur global d’apparence sont à intégrer. Cette livraison documentaire ne les implémente pas. L’API d’apparence décrite ici est à créer : ne pas la considérer disponible au HEAD inspecté.

## 2. Identité visuelle et jetons

La série 08 fournit l’identité ; la série 14 montre sa transposition sur l’application. Les valeurs suivantes fixent un point de départ reproductible issu de cette transposition, sans prétendre extraire une palette officielle de l’image générée.

| Jeton | Référence 08 — Sauge (`sage`) | Clair bleuté (`clair`) |
| --- | --- | --- |
| Fond principal | `#F5F5F0` | `#F7F9FB` |
| Fond secondaire | `#EDF2EE` | `#F0F4F7` |
| Bordure | `#DCE2DB` | `#DCE5E9` |
| Séparateur discret | `#E9EDE7` | `#EEF2F4` |
| Surface / carte / dialogue | `#FFFFFF` | `#FFFFFF` |

Jetons communs : vert de base `#103F33`, barre latérale dégradée `#123E32` → `#0B392E`, élément principal actif `#275647`, sous-menu actif `#315B4B`, texte clair `#F6FAF6`, texte principal `#173F34`, secondaire `#52645E`, sauge `#84A28C`, sauge pâle `#E4EEE6`, marine `#142F61`, turquoise décoratif `#00A8B0`, focus `#326899`.

Le turquoise sert aux petits filets, au carré de signature et au repère de sélection. Il ne doit pas servir à du petit texte sur blanc ni à un bouton avec texte blanc sans mesure de contraste. Les boutons primaires peuvent conserver leur fond vert `#173F34` et leur texte blanc. Une sélection combine fond, texte et état ARIA ; la couleur seule ne suffit pas. Conserver les couleurs métier des risques, retards et graphiques. Ne pas appliquer de remplacement global aux SVG/canvas.

La variante `clair` ne remplace que les fonds et bordures définis dans la table. Elle conserve la navigation vert profond et l’identité 08. En mode sombre, préserver les variables sombres existantes : les deux palettes claires sont suspendues, mais le choix global est conservé et réappliqué au retour en mode clair.

## 3. Composition et composants

En-tête de bureau d’environ 78 px : monogramme local S, « Suivi des audits SMSI », « Qualité, sécurité et référentiels », signature typographique Normand’e-Santé marine, petit carré turquoise et sous-titre discret. La signature n’est pas un logo officiel. Aucun logo tiers inventé ni ressource distante chargée automatiquement.

Conserver les vrais contrôles de compte, rôle, déconnexion, recherche, import/export, notifications et état de sauvegarde. Réutiliser leurs nœuds et événements ; aucun doublon factice. Les captures de la série 14 gardent la barre d’outils sous le bandeau. Une fusion est possible uniquement si les fonctions et accès restent complets. Les marqueurs « Démonstration / Prévisualisation » restent réservés aux données fictives.

Lien « Site Normand’e-Santé » : `https://www.normand-esante.fr/`, ouvert par clic explicite avec `target="_blank" rel="noopener noreferrer"`, icône SVG locale. Pas d’iframe, CDN, police distante ou appel automatique au site.

Navigation : 275 px de largeur bureau comme la série 14, modes réduit/mobile existants conservés. Groupes, ordre, recherche, défilement et préférences restent opérationnels. Conserver `data-act`, `data-sec`, `data-sub`, `data-lx-nav-group` et les IDs réels. Le menu simplifié de la série 08 n’autorise aucune suppression de destination.

### Navigation : précision de la capture annotée du 13 octobre

Cette précision de l’utilisateur prévaut sur les différences de navigation visibles dans les captures de la série 14.

- **Pictogrammes conservés** : reprendre les icônes de la référence 08 pour les entrées correspondantes (maison du tableau de bord, bouclier, documents, carte, compte, paramètres, etc.). Réutiliser les SVG locaux quand ils correspondent ; compléter uniquement les destinations absentes de l’image avec la même famille d’icônes en contour. Ne pas les remplacer par des initiales, emojis ou icônes toutes uniformisées au point de perdre leurs repères.
- **Entrée active colorée** : conserver le pictogramme turquoise, le filet vertical turquoise à gauche, le fond vert éclairci et le texte clair. Un simple texte blanc ou un filet sans couleur d’icône est insuffisant. Ne pas imposer `currentColor` blanc à l’icône active. Les autres icônes conservent leurs teintes et distinctions prévues ; les états inactifs de la référence sont clairs et discrets. Ne pas réinterpréter le cercle rouge comme une demande d’icône rouge.
- **Dépli/repli des menus** : garder le petit chevron à droite des entrées à sous-menu, comme « Pilotage » et « Outil de suivi ». Fermé : chevron orienté vers la droite ; ouvert : orienté vers le bas. Conserver les sous-menus, l’indentation, la sélection enfant et les préférences d’ouverture existantes. Ne pas remplacer ces chevrons par les signes +/− de la déclinaison 14 ni par des onglets horizontaux. Appliquer ce vocabulaire visuel aux groupes repliables sans changer leurs IDs ni supprimer de destinations.
- **Interactions** : conserver les gestionnaires de navigation existants et leur distinction ouvrir/naviguer. Le contrôle de dépli/repli est un bouton avec `aria-expanded` et `aria-controls`, utilisable à la souris et au clavier. Une icône décorative est masquée aux technologies d’assistance, son bouton garde un nom accessible. Si un lien et un bouton de dépli sont séparés, ils ne doivent pas être imbriqués. Respecter le comportement de focus et une éventuelle préférence de réduction des animations.
- **Deux styles et routes protégées** : mêmes pictogrammes et chevrons en Sauge et Clair bleuté. Le mode sombre reste lisible. Ces changements sont intégralement suspendus sur les routes cartographiques protégées, enveloppe de navigation comprise.

Les cercles rouge et violet de la capture utilisateur sont des annotations d’emplacement, **pas des couleurs ou éléments à afficher dans l’application**. Cette demande concerne les menus dépliables, pas un processus technique de déploiement.

Cartes : fond blanc, bordure 1 px, rayon 12 px, ombre légère ; espacement 20–24 px. Polices locales déjà embarquées, repli Arial. Texte 14 px environ, secondaire 12 px, titres 28–34 px. Tables denses, filtres alignés, boutons et champs natifs avec labels, erreurs et focus. Motifs hexagonaux très discrets, décoratifs et sans interception des clics.

**Cockpit :** utiliser l’écran 01 de la série 14 comme référence de déclinaison actuelle : priorités, indicateurs, risques, incidents, récurrences et conformité restent visibles ou accessibles. La grille 2 × 2 de l’image 08 n’est plus une exigence imposant une nouvelle réorganisation ; son identité graphique reste la référence. Préserver tous les calculs et accès détaillés. Aucun chiffre ni date de maquette ne doit être codé en dur.

## 4. Plans d’action et tâches récurrentes

### Plans d’action — images 20 à 25

Conserver les six vues : Liste, Kanban, Planning, Calendrier, Gantt, Synthèse. Même registre, mêmes filtres, détails, sous-actions, preuves, responsables et droits. Le déplacement Kanban conserve son alternative clavier et les validations actuelles. Une durée de Gantt n’est affichée que si une date de début existe ; ne pas inventer une durée pour remplir l’image.

### Tâches récurrentes — images 26 à 30

Le module existe : section `recurring`, destination `pl-rec`, `tab: 'plans'`, `set: {planView: 'rec'}`. Réutiliser `modules/astra-ui.js`, `S().recurring`, `recState`, `recNext`, `recFreq`, les formulaires existants et le toolkit. Ne pas créer un second registre ou une deuxième navigation.

L’inspiration Tenacy concerne la lecture structurée des activités : liste compacte, recherche et filtres visibles, responsable, fréquence, prochaine échéance, statut, historique accessible en fiche latérale. Les ressources publiques https://www.tenacy.io/solutions ont été consultées ; aucun accès à un écran privé Tenacy ni reproduction exacte n’est revendiqué.

| Vue / action | Comportement à conserver ou finaliser |
| --- | --- |
| Liste | Titre et référence, catégorie, responsable, prochaine échéance, fréquence, état calculé ; tri et recherche |
| Kanban | Colonnes issues des états réels des séries ; ne pas transformer un déplacement en réalisation fictive |
| Planning | Échéances et occurrences projetées, échelle temporelle et regroupements actuels ; marqueurs de réalisation distincts |
| Calendrier | Projections selon la série et réalisations à leur date réelle ; consultation d’une occurrence |
| Fiche latérale | Référence, responsable, fréquence, échéance, description, historique avec auteur/date/commentaire/preuve |
| Nouvelle tâche / série | Formulaire existant, validation, responsable/périmètre, fréquence, départ, activation selon le moteur existant |
| Enregistrer une réalisation | Enregistrer via le flux actuel ; conserver l’historique et recalculer la prochaine échéance selon la règle existante |

Les projections ne sont pas des occurrences persistées indépendantes. Le moteur existant ne permet pas d’éditer une seule occurrence projetée : ne pas afficher une commande qui le prétend. Modifier la série agit sur ses projections futures, sans réécrire les réalisations passées. Une date passée n’atteste pas une réalisation. Préserver auteur, commentaire et preuve. Corriger les défauts purement visuels tels que les doublons de badge « En retard » sans changer la règle métier.

Ne pas ajouter implicitement un moteur de rappels, d’envoi d’emails, de workflows d’approbation ou une récurrence d’un autre produit. Une tâche récurrente reste distincte d’une action corrective, même lorsqu’elle s’y rapporte. L’apparence est commune à tous les modules.

## 4 bis. Matrice des risques : correction explicite de la capture utilisateur

**Cette consigne prévaut sur la vue 03 de la série 14 pour la matrice.** Elle concerne la destination `risk-map`, `tab: 'risks'`, `riskView: 'map'` et sa vue ASTRA `matrix`, pas le module cartographique protégé.

[Aperçu corrigé — matrice et légende](../2026-10-13-astra-16/images/002-matrice-corrigee-detail.png) · [Vue complète](../2026-10-13-astra-16/images/001-matrice-corrigee-vue-complete.png).

### Rendu attendu

- Grille à **cases pleines et colorées**, séparées par un fin espace blanc, avec coins légèrement arrondis. Ne pas remplacer les cases par des cartes blanches ou sauge, des contours colorés seuls ou des pastilles sur fond neutre.
- Pour la palette standard à quatre niveaux de la référence : **Faible vert**, **Modéré jaune**, **Élevé orange**, **Critique rouge**. Valeurs de départ pour reproduire le rendu : `#4DBB69`, `#FFDF45`, `#FF8335`, `#FF293F` ; ce sont des valeurs de transposition visuelle, pas une palette normative ISO/EBIOS.
- Dans chaque case : libellé du niveau en haut, nombre de risques lisible (tiret si aucun), puis références cliquables telles que `RISK-000001`. Les valeurs proviennent des données filtrées, jamais des nombres de la capture.
- Axe vertical « Impact / gravité » : gravité décroissante de haut en bas ; axe horizontal « Probabilité / vraisemblance » : ordre croissant de gauche à droite. Afficher les libellés réels de la politique. La référence montre 4 × 4 ; une autre politique conserve ses propres dimensions.
- Case sélectionnée : contour bleu bien visible, **sans supprimer son fond de niveau**. Réinitialisation de sélection accessible par bouton. Panneau latéral indiquant « Risques sélectionnés · N » et la liste correspondante ; pour une case vide, afficher zéro et « Aucun risque dans cette cellule. ». Sans sélection, afficher les risques de la matrice.
- Conserver titre de politique, méthode, version, total de risques, légende, filtres d’évaluation/périmètre/statut et ouverture de la fiche. Les niveaux restent identifiables par le texte en plus de la couleur.

### Couleurs, politiques et calculs

Le code inspecté utilise déjà `background: var(--cell)` dans `.as-risk-cell`. `matrix()` de `modules/astra-ui.js` calcule `--cell` à partir de `levelColor(level)`, lui-même issu de `policy.levels[].color`. Certaines politiques du jeu de démonstration ont une palette discrète ; d’autres utilisent une appréciation manuelle. Il ne faut donc pas attribuer toute différence à une surcharge CSS, ni forcer une couleur par numéro de ligne/colonne.

Pour la politique standard à quatre niveaux visée par la référence, appliquer une **palette de présentation dédiée**, avec correspondance explicite aux identifiants stables de ses niveaux. Ne pas modifier en place une politique versionnée ou les évaluations historiques pour recolorer l’écran. Les politiques personnalisées conservent leurs couleurs configurées : ne pas déduire arbitrairement le sens d’un niveau de son libellé libre, de son rang ou d’un ID générique partagé entre politiques. Documenter la portée du mapping et tester au moins une politique personnalisée.

La correspondance cellule → niveau reste issue de `policy.matrix`, sans recalculer les seuils ni transformer le barème en produit impact × probabilité. Légende, fond de case et marqueurs de risque affichent des couleurs cohérentes pour un même niveau dans cette vue. Les politiques à appréciation manuelle n’ont pas de niveau implicite de cellule : conserver leurs cellules neutres et leurs marqueurs évalués ; ne pas leur inventer un barème pour imiter l’image. Pour vérifier la référence, utiliser une fixture **à calcul matriciel explicite**, pas une politique manuelle.

La palette métier reste distincte des fonds globaux `sage` et `clair`. Aucun `opacity`, mélange de couleurs ou token de fond générique ne doit délaver les cases. En mode sombre, conserver les niveaux et adapter les contrastes/contours pour rester lisible. Mesurer le contraste du texte, des références et du focus sur chacune des quatre couleurs.

### Interactions et recette

Réutiliser les événements `risk-cell` et `risk-detail`, les filtres et les règles de périmètre serveur. Boutons accessibles au clavier, `aria-pressed` sur la sélection, nom de case indiquant impact, vraisemblance, niveau et nombre. Conserver le défilement local sur petit écran, sans rogner la grille.

Vérifier : quatre niveaux colorés sur une matrice de test 4 × 4, cellule vide sélectionnée, cellule contenant plusieurs risques, réinitialisation, clic sur une référence, changement d’étape d’évaluation et de périmètre, deux styles, thème sombre, politique personnalisée et politique manuelle. Les totaux, positions et décisions restent identiques avant/après la correction visuelle. Aucun fichier ni rendu du module cartographique dynamique n’est modifié.

## 5. Administration → Apparence : réglage global

Ajouter une seule destination `admin-appearance`, `tab: 'admin'`, `set: {adminView: 'appearance'}`, dans la section Administration. Contrôle administrateur dans `modules/admin-ui.js` et contrôle serveur sur toute écriture. Les autres rôles affichent le style commun sans pouvoir le modifier.

Le panneau propose deux cartes radio : « Référence 08 — Sauge » et « Clair bleuté ». La sélection prévisualise le choix localement dans ce panneau ; bouton **Enregistrer pour tous** pour valider. Afficher portée globale, modification non enregistrée, progression, succès après réponse serveur et erreur récupérable. Le retour au défaut `sage` doit également être enregistré. Annuler, quitter le panneau ou se déconnecter abandonne l’aperçu non enregistré et restaure le dernier style global. Conserver le réglage personnel Système/Clair/Sombre séparément.

### Persistance et API à créer

Le serveur est la source de vérité ; `localStorage` seul ne répond pas au besoin. Ajouter une configuration d’instance SQLite distincte de l’état métier `/api/state`, avec style et révision entière. Aucune modification des schémas de risques, actions ou récurrences. Migration minimale, versionnée et idempotente ; préserver les bases existantes et ne jamais réinitialiser le choix au démarrage. Le HEAD inspecté utilise `PRAGMA user_version=2` et annonce le schéma 2 dans `/api/admin/status` : adapter ces points si la migration fait évoluer la version, sans rétrograder une base plus récente.

Contrat cible, endpoints nouveaux :

| Requête | Autorisation | Données / réponse |
| --- | --- | --- |
| `GET /api/appearance` | Tout compte authentifié actif | `{style: 'sage' ou 'clair', revision: entier}` |
| `PUT /api/admin/appearance` | Administrateur actif, protection CSRF existante | Corps `{style, revision}` ; réponse `{style, revision}` avec révision mise à jour |

Le client transmet la révision lue. Le serveur valide strictement le style, le type et la valeur de révision, puis effectue comparaison et mise à jour atomiques. Pas d’authentification : 401 ; rôle/CSRF refusé : 403 ; valeur invalide : 422 ; révision obsolète : 409 avec relecture explicite et conservation du choix en attente. La révision est indépendante de celle de l’état métier. Utiliser `auth`, `host_check`, les conventions `Problem`, la transaction SQLite et `Store.trace` existants. Journaliser avant/après avec l’acteur, sans secrets. Une erreur ne doit ni afficher « enregistré » ni altérer la valeur globale.

### Propagation et cycle de vie

Lire après authentification, avant l’habillage de l’écran ; les comptes de la même instance obtiennent tous la même valeur. Rafraîchir au retour au premier plan. Réutiliser un canal de synchronisation existant s’il convient ; sinon interrogation toutes les 30 secondes pour les sessions visibles, arrêtée après déconnexion. Délai cible : au plus 30 secondes dans une session active en ligne, dès reconnexion pour une session hors ligne. Éviter requêtes concurrentes et réappliquer une réponse plus ancienne ; comparer les révisions.

Ne pas recharger le document ou recréer les formulaires au changement global : préserver saisies, scroll et focus. Un cache par instance peut restituer le dernier style connu lors d’une coupure, sans devenir une préférence personnelle. Si aucune valeur n’est connue, utiliser `sage` comme repli et signaler l’indisponibilité dans le panneau d’administration. Aucune mise en file de cette écriture via la file de sauvegarde métier.

Pendant une prévisualisation locale non enregistrée, une nouvelle révision distante ne remplace pas silencieusement le choix : mettre à jour la référence globale, indiquer le changement distant et gérer le conflit à l’enregistrement. À l’annulation, restaurer la dernière valeur globale reçue. Sur les cartographies, enregistrer seulement la nouvelle valeur en mémoire : aucun effet visuel.

## 6. Architecture et périmètre des modifications

Application HTML/CSS/JavaScript, Python local et SQLite. Conserver les lanceurs et le fonctionnement avec ressources locales ; pas de migration React/Vite/Tailwind, nouveau serveur ou dépendance réseau.

| Point d’intégration | Travail prévu |
| --- | --- |
| `index.html` | Charger l’habillage après les couches existantes, préserver nœuds et fonctions embarqués |
| `modules/nes-sage.css` à créer | Jetons des deux styles, composants et responsive sous attribut dédié |
| `modules/nes-sage-ui.js` à créer | Activation par route, identité, état global/aperçu, lecture et propagation ; montage idempotent |
| `modules/astra-ui.js` | Ajustements ciblés des vues, actions et récurrences ; aucun remplacement de moteur |
| `modules/admin-ui.js` | Panneau Apparence, état d’enregistrement et garde administrateur |
| `modules/navigation-ui.js` | Une destination ajoutée, toutes les destinations actuelles préservées |
| `modules/server-client.js` | Réutiliser `LegacyServer.request` pour sessions et CSRF ; ne modifier le client partagé que si indispensable |
| `legacy_server.py` | Configuration d’apparence, migration, deux endpoints, concurrence et audit |
| Modules métier UI | Corrections locales seulement si les composants partagés ne suffisent pas |
| Moteurs métier | Inchangés pour cette refonte ; toute anomalie constatée doit être distinguée du changement visuel |
| Fichiers cartographiques | Interdiction de modification |

Préférer un attribut dédié tel que `data-nes-style="sage|clair"`, distinct de l’attribut du mode clair/sombre existant. Inspecter les conventions réelles avant montage. Borner **tous** les sélecteurs, y compris ceux de l’en-tête, du body et des motifs décoratifs. Ne pas copier directement la CSS des captures : elle comporte des surcharges historiques et des classes de démonstration. Centraliser les valeurs et retirer les styles de prévisualisation.

Le toolkit est `LegacyIntegrationUI.toolkit` ; la navigation est `api().astra.navigation()` et le changement de vue `api().navigate(tab, set)`. L’inventaire de référence compte 24 rubriques / 100 destinations. Après ajout d’Apparence : 101 destinations si le registre n’a pas évolué. Relever le registre au HEAD réel et réconcilier les écarts, sans supprimer une destination pour satisfaire un nombre.

## 7. Cartographies : exclusion absolue

Ne pas modifier `modules/carto-core.js`, `modules/carto-ui.js`, `modules/carto.css` ou `legacy_cartography.py`.

```js
const isProtectedCartography = ui =>
  ui.tab === 'carto' || (ui.tab === 'dash' && ui.dashView === 'map');
```

Cela couvre `dmap`, `mb-ctx`, `mb-proc`. Retirer avant rendu le nouvel attribut de style, la signature ajoutée et tous les effets du nouvel habillage : couleurs héritées, polices, offsets, tailles et géométrie. Restaurer exactement l’enveloppe précédente ; réappliquer le style courant en quittant la carte. Une réponse API ou une notification reçue pendant l’affichage d’une carte ne doit pas modifier son rendu.

La matrice du registre des risques (`tab: 'risks'`, vue `map`) n’est pas le module cartographique protégé. Elle reçoit l’enveloppe visuelle 08 et conserve les cellules métier pleines et colorées exigées au § 4 bis, qui remplace le rendu atténué de l’image 03.

Comparer les trois routes avant/après avec même jeu fictif, même fenêtre et même mode historique : captures, dimensions, zoom/pan/sélection, nœuds, liens, filtres, exports et droits. Vérifier entrée/sortie, accès direct, changement global depuis une autre session et thème sombre. L’absence de diff dans `carto.css` seule ne suffit pas.

## 8. Invariants et accessibilité

Préserver sessions, rôles, périmètres serveur, droits lecteurs, identifiants internes, file d’écriture et conflits 409/422. Les liens risque ↔ mesures Annexe A **ISO 27001:2022** restent bidirectionnels via `objectRefs` ; préserver également les liens de traitement. Un rattachement ne valide ni la conformité ni la réduction du risque. Évaluations, décisions et politiques conservent leur immutabilité.

Préserver CaRE/HAS, PCRA, preuves/versionnement, pièces financières, restrictions du dossier auditeur et validation humaine. Aucune donnée réelle, base locale, session ou secret dans les exemples et livrables.

Recette à 390, 768, 1440 et 1920 px, zoom 200 %, clavier, focus visible, dialogues, erreurs, mode sombre/système, contraste WCAG AA et grandes tables à défilement local. Les icônes et statuts ont un libellé accessible ; aucun contrôle interactif purement décoratif. Le changement global ne perturbe pas une saisie en cours.

## 9. Ordre de réalisation

1. Vérifier branche, HEAD, instructions et modifications locales ; préserver notamment les dossiers non suivis `apps/`, `packages/`, `tests/e2e/`. Inventorier navigation, initialisation du thème et points serveur. Capturer les cartes de référence.
2. Créer les jetons et la couche d’habillage avec exclusion cartographique dès le début. Monter l’identité et conserver les vrais contrôles.
3. Décliner les composants sur les destinations, puis traiter explicitement les six vues Actions et les cinq vues Récurrences. Utiliser les captures comme référence de rendu, pas comme données métier.
4. Ajouter configuration serveur, migration, API et tests de permissions/persistance/conflit. Ajouter Administration → Apparence et synchronisation globale sans perte de saisie.
5. Exécuter la recette détaillée dans [RECETTE.md](RECETTE.md), corriger les régressions introduites, mesurer les différences visuelles et publier une nouvelle série de captures de l’application effectivement intégrée.
6. Livrer diff, résultats réels, limites, SHA et ZIP via `scripts/package_astra.py`. Si commit/push dans le cadre autorisé : `legacy` seulement, identité anonyme prévue et `[skip ci]`. Pas de fusion, force-push, CI déclenchée, release ni déploiement.

## 10. Limites de cette livraison documentaire

Le dossier consolide des choix et inspecte des points de code ; il ne prouve pas l’intégration des fonctions futures. La série 14 contient des rendus de bureau injectés en mémoire sur base fictive, certains états vides et le premier écran des contenus défilants. Le prototype d’administration de la série 13 simule l’enregistrement local : il ne remplace pas le backend global décrit ici. Aucune nouvelle recette métier n’est revendiquée pour la rédaction de ce dossier.
