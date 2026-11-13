# Recette de la future intégration

**Cette liste décrit les vérifications à faire après validation visuelle et intégration. Elle n’est pas un résultat de test.** Priorité PC ; ne pas bloquer sur une finition téléphone.

## Proportions

| Fenêtre | Contrôle principal |
| --- | --- |
| 1366 × 768 | Texte lisible sur portable, hauteur de liste utile, accès aux commandes sans empilement disproportionné |
| 1920 × 1080 | Équilibre habituel, zone de travail suffisamment large, cartes et boutons bornés |
| 2560 × 1440 | Davantage d’espace pour les données ; pas de petites cartes isolées au centre ni de blocs démesurés |
| 3840 × 2160 en pixels CSS | Vérifier l’automatique, les limites de taille et les cas où toutes les lignes tiennent sans défilement |
| Fenêtre 1024 / 1280 px, redimensionnement continu | Menu et colonnes se réorganisent, pas de perte de filtre, sélection ou vue |

Tester les deux thèmes, les réglages explicites de taille et densité ainsi que l’automatique. Vérifier séparément le mode mural. Préserver le zoom du navigateur ; couvrir au moins 100 %, 125 %, 150 % et un contrôle de lecture à 200 %.

## Registres et commandes

- Vues initiales : Graphe des périmètres, Compact des objectifs, Timeline des actions/occurrences.
- Icônes avec nom accessible, info-bulle et focus visible ; recherche clavier, filtres combinables et pastilles supprimables.
- Tous les critères existants restent disponibles ; reset réellement complet, états vides compréhensibles, choix de série et d’échelle préservés.
- Liste longue : défilement dans sa zone, en-tête utilisable, dernière ligne accessible, pagination / chargement suivants fonctionnels.
- Ligne ouvrable avec Entrée/Espace, retour du focus, liens / menus / champs indépendants et sélection de texte possible.
- Texte long, titre sur plusieurs lignes, responsables longs, peu et beaucoup d’éléments, données sans date et erreurs de chargement.

## Graphiques, fiches et écritures

- Périmètres centrés, dépliage en rectangle, « + » en bas au centre ; aucune barre intérieure sur une carte.
- DdA : dalles et scores conservés, mesures denses mais lisibles, menus Applicable/Mise en œuvre et écritures réelles.
- SWOT/PESTEL : textes et centre sans chevauchement ; rattachements aux processus conservés.
- Timeline : dates réelles, périodes, échelles calendaires, hors période et retards ; mêmes animations avec pause et réduction.
- Résultat de réalisation : OK/KO, NA pour les occurrences, preuve et commentaire, refus de droits, journal et réouverture motivée.
- Fenêtres : consultation distincte de modification ; largeur et hauteur cohérentes, fermeture clavier et défilement extérieur des fiches longues.

## Contrôles techniques

Utiliser les scripts et tests déjà présents dans les `package.json` et le guide de contribution, avec la version Node attendue. Exécuter les vérifications adaptées aux composants modifiés, TypeScript/lint/format/build et les parcours concernés ; ne pas réécrire les tests pour refléter uniquement l’implémentation.

Les tests API ou Docker qui écrivent utilisent un environnement fictif isolé. Ne pas employer une base réelle ni supprimer des volumes de l’utilisateur. Garder les contraintes de versions, CSRF, droits et historique.

Fournir les commandes, codes retour, commit, date et limites, puis des captures **de l’application intégrée** aux tailles PC retenues. Les contrôles de maquette et résultats historiques ne remplacent pas cette recette.
