# Parties intéressées — panorama Studio

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Après la demande de revoir les captures d’adaptabilité puis de poursuivre la refonte, les [visuels PC précédents](../responsive-equilibre/README.md) ont été fournis à nouveau. La suite retenue pour cette proposition est **Parties intéressées**, encore non validée dans le premier lot Organisation, dans la continuité du SWOT et du PESTEL déjà intégrés.

**Nouvelle maquette autonome à valider avant intégration.** Le code applicatif reste à `23b33b5ce4fd4cf5eeee0af97c9638b18852b61a`. Les nouveaux rendus responsive ne sont pas considérés comme approuvés par la seule demande de les revoir. Aucune modification de `apps/`, `packages/`, API, données, droits, dépendances ou Docker ; aucun build/test applicatif pour cette proposition. Le ZIP complet V2 déjà livré est conservé ; pas de nouvelle archive pour ce lot visuel.

## Proposition visuelle

- Panorama avec les acteurs **internes** et **externes** distincts, reliés visuellement au périmètre affiché. Les traits servent à la lecture du regroupement : aucun lien métier, poids, score d’influence ou taux de conformité ajouté.
- Cartes biseautées, état de traitement rempli en vert/orange/rouge, dernière revue lisible et alerte sur une date absente ou ancienne. La sélection d’une carte ouvre une fiche de lecture avec besoins, exigences, prise en compte et revue/suivi dans quatre panneaux.
- Liste compacte accessible par une icône et entièrement ouvrable au clic/clavier. Vue, recherche et filtres restent disponibles ; les critères actifs apparaissent en pastilles, les critères secondaires à la demande.
- Proportions PC : titres de cartes 15–17 px, métadonnées autour de 12 px, cartes de largeur bornée, regroupement centré et liste à défilement propre. Le téléphone reste non prioritaire.
- Survol discret, liaisons et anneau du périmètre animés, pause et réduction des mouvements. Fiche de lecture séparée de l’édition ; fiche longue défilant par le voile extérieur.

La lecture « revue à vérifier » reprend la distinction du calcul existant : date absente ou antérieure à la situation moins 365 jours. Elle ne crée pas une obligation réglementaire de revue annuelle. La synthèse reste calculée sur le jeu du périmètre, hors filtres ; le nombre de fiches filtrées est indiqué dans la vue.

## Captures natives

| Vue | Clair | Sombre |
| --- | --- | --- |
| Panorama bureau 1 920 × 1 080 | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-interessees-studio/panorama-1920-clair.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-interessees-studio/panorama-1920-sombre.png) |
| Fiche de lecture 1 920 × 1 080 | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-interessees-studio/fiche-1920-clair.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-interessees-studio/fiche-1920-sombre.png) |
| Portable 1 366 × 768 | [Panorama](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-interessees-studio/panorama-portable-1366-clair.png) | — |
| Registre compact 1 366 × 768 | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-interessees-studio/registre-portable-1366-clair.png) | — |
| Filtres à la demande | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-interessees-studio/filtres-portable-clair.png) | — |

[Maquette interactive](index.html), à servir depuis la racine du dépôt. Les captures sont natives, sans retouche ni génération d’image, à un pixel de capture par pixel CSS. Les ouvrir à 100 % pour juger la taille de lecture.

## Résumé technique pour la reprise

- **Fichiers nouveaux** : `index.html` compose la page et les fenêtres ; `parties.css` définit le panorama, les cartes, la liste et la fiche ; `parties.js` porte `filtered`, `render`, `panorama`, `wires`, `read` et `editor`, ainsi que les interactions de démonstration.
- **Réutilisation sans modification** : CSS de `commandes-discretes` et `responsive-equilibre` ; données fictives de `organisation-contexte-studio/donnees.js`. Même jeu de six parties, situation au **09/11/2026** : quatre états Oui, un Partiel, un Non ; deux dates de revue anciennes ou absentes. Noms de fonctions et organisations entièrement fictifs.
- **Modèle conservé** : nature, catégorie, besoins/attentes, exigences pertinentes, exigences traitées, traitement, date de revue et contact reprennent les champs existants de `packages/shared/src/pilotage.ts`. La démonstration conserve les noms legacy `type`, `cat`, `needs`, `req`, `how`, `reviewed`. Le responsable reste affiché et préservé pendant l’édition fictive ; sa vraie attribution doit réutiliser le mécanisme commun de l’application.
- **Comportement de maquette** : filtres combinables, recherche, retrait/reset, état vide, nature manquante conservée dans « À préciser », lecture/édition distinctes, sauvegarde en mémoire, navigation clavier et restitution du focus. Recharger restitue le jeu de départ. Aucun appel API ni relation persistée.
- **Portée** : aucune source de données ou fonction applicative remplacée. Les formulaires simplifiés ne remplacent pas `ObjectEditor`, les attributions, droits, versions, preuves, liens et historique réels.

## Vérifications

[Rapport final](controles.json), [dimensions et empreintes](medias.json). Node 26.13.0, Chromium système, serveur statique local dédié ; scripts et journaux intermédiaires privés.

- Dix dispositions PC : 1 024 × 768, 1 280 × 800, 1 366 × 768, 1 920 × 1 080 et 2 560 × 1 440, dans les deux thèmes. Aucun débordement de page détecté ; textes de cartes entre 15 et 17 px, largeur maximale constatée 378 px.
- Sept analyses Axe ciblées, sans violation détectée au passage final : panorama, registre, fiches et filtres. Le premier passage a détecté le menu illustratif défilant non accessible au focus ; ajout de `tabindex` et d’un contour de focus avant les rendus finaux.
- Filtres Nature/État combinés, recherche `/`, entrée et fermeture, pastilles, reset, résultat vide, lecture au clavier, édition fictive et retour du focus contrôlés. Les champs non édités et le responsable ont été conservés.
- Nature absente conservée, défilement du registre indépendant de la page, animations actives/pausées/réduites contrôlés.
- Aucune erreur JavaScript ou HTTP ni appel API métier pendant les parcours finaux. Le premier serveur statique n’était plus disponible ; un serveur local indépendant a été lancé, sans modification d’un service applicatif.

Ces contrôles concernent la maquette, pas l’application. **Suite : validation explicite du nouveau rendu, puis intégration dans les composants réels**, avec les adaptateurs legacy/natifs, les mêmes filtres, droits et écritures ; tests pertinents et nouvelles captures de l’application. Les autres rubriques non revues ne sont pas déclarées terminées.
