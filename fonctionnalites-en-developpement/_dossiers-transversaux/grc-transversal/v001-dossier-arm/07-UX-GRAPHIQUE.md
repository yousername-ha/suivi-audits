# Spécifications graphiques et composants

## Référence conservée

Style 08 : barre latérale forêt, fond clair chaud, cartes blanches, accents sauge et turquoise, signature marine discrète. Garder les pictogrammes colorés et les chevrons de dépliage des menus. Ne pas remplacer les menus par une seconde application. Les vues du dossier sont des illustrations synthétiques de la cible, isolées du runtime.

Tokens proposés : fond `#F5F5F0`, carte `#FFFFFF`, bordure `#DCE2DB`, forêt `#103F33`, sidebar `#123E32`, ligne active `#275647`, texte `#173F34`, secondaire `#52645E`, turquoise `#00A8B0`, marine `#142F61`, focus `#326899`. Le turquoise d’accent n’est pas utilisé comme texte fin sur blanc : utiliser une variante foncée ou une bordure, vérifier les contrastes. La famille claire/sauge s’applique à tous les utilisateurs depuis Administration ; le thème n’altère pas les couleurs métier des niveaux.

Risques et conséquences : rouge ; valeurs métier : violet ; SR : orange ; parties prenantes : bleu ; mesures : vert. Les icônes sont accompagnées d’un libellé ; ni la couleur ni un emoji seuls ne portent une signification. Utiliser les icônes SVG existantes ou une bibliothèque déjà présente, avec étiquette accessible. Hacker/voleur illustrent une source intentionnelle ; incendie représente un événement adapté, pas un objectif d’attaque présumé.

## Navigation cible — affinée au chapitre 12

- Administration → Configuration GRC : échelles, critères, catégories, matrices, profils, méthodes, affectations, versions et dépendances.
- Registres : listes existantes exposées par adaptateurs ; nouveaux registres seulement pour les concepts absents.
- Gestion des risques → Études : assistant, parcours de méthode, suivi, scénarios, traitement et historique.
- Import ARM : préparation locale, rapprochement, anomalies, aperçu et validation ; aucun import automatique depuis une simple capture.

Les vues Administration/Apparence et Configuration sont distinctes. Masquer ou désactiver les actions selon les capacités renvoyées par le serveur ; un masquage UI n’est pas une autorisation.

## Dix vues livrées

[Galerie HTML](graphiques/index.html) ; captures PNG et planche dans [le dossier graphique](graphiques/README.md).

1. Registres partagés : types, source canonique, recherche et usages.
2. Configurations : origine, version, affectation et dépendances.
3. Échelle : niveaux ordonnés, couleurs, valeurs facultatives et publication.
4. Matrice de pertinence : neuf cellules, axes et sources de version visibles.
5. Nouvelle étude : sélection de méthode, périmètres et bundle avant création.
6. Atelier 1 : mission → VM → support, ER et besoins liés.
7. Atelier 2 : suivi en lignes, cercle et matrice coordonnés.
8. Scénario opérationnel : variantes, flux directionnels et nœuds renforcés.
9. Import ARM : comptes observés, anomalies et décisions de rapprochement.
10. Historique : comparaison, études utilisatrices et réévaluation explicite.

Ces vues complètent les maquettes EBIOS des cinq ateliers déjà présentes ; elles ne les remplacent pas et ne marquent aucune proposition « validée » sans décision utilisateur.

## Contrats UI partagés

| Composant | Comportement et états |
|---|---|
| ReferencePicker | Recherche par type/portée ; sélection par ID ; état vide, chargement, interdit, archivé ; création sous droit dédié |
| LevelPicker | Niveaux de la version épinglée ; ordre visible, texte + couleur ; aucune valeur numérique implicite |
| MatrixViewer/Editor | Dimensions variables ; cellule clavier ; liste équivalente ; édition seulement en brouillon ; conflit et cellules manquantes explicites |
| ProvenanceBadge | Global/organisation/méthode/étude, famille, version et date ; lien vers dépendances autorisées |
| AssociationEditor | Relations typées ; signalement des liens manquants ; pas d’auto-déduction par nom |
| JustificationField | Obligatoire selon contrat ; brouillon conservé en cas d’erreur ; échappement du contenu |
| HistoryDiff | Avant/après et auteur/date ; changements de règle séparés des changements de libellé ; anciennes versions lisibles |
| RiskTable + LinkedPanels | Sélection stable par ID ; filtres annoncés ; matrice/cercle synchronisés ; état non évalué distinct |
| ScenarioGraph | Chemins navigables clavier ; sélection sans effacer les autres ; flux orienté ; version textuelle du chemin |
| StudyWizard | Prévisualise bundle et références ; bloque les ambiguïtés ; ne publie pas automatiquement une configuration |

Accessibilité cible : focus visible, navigation clavier, `aria-expanded` sur chevrons, boutons réels, titres structurés, contraste contrôlé WCAG AA, pas de dépendance à la couleur seule, mouvement réduit respecté. À 1280 px, table puis deux panneaux ; sous 900 px, panneaux empilés et défilement horizontal explicite pour tables/graphes. Tester zoom 200 %, contenu long et lecteurs d’écran sur le code intégré. Les captures desktop ne constituent pas cette recette.

La [navigation simplifiée](12-NAVIGATION-SIMPLIFIEE.md), ajoutée après analyse de la vidéo, précise et remplace l’organisation sommaire de cette section. Les dix vues illustrent désormais les sept rubriques métier et Administration séparée.
