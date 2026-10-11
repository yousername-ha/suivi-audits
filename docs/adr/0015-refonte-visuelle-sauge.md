# ADR 0015 — Direction graphique Sauge

Statut : proposée, implémentée dans la copie de travail ; à valider avant intégration.

## Contexte

Améliorer la qualité visuelle de la nouvelle interface et de l’outil historique sans modifier les fonctionnalités, les droits ni les contrats d’API.

## Décision

Palette vert profond / sauge / blanc cassé, Inter variable locale, styles partagés dans `packages/ui`, adaptation mobile et sombre, micro-animations respectant `prefers-reduced-motion`. Conserver les teintes métier de la cartographie et les rayons de 6 à 12 px du thème. Isoler l’habillage historique dans un unique bloc CSS ajouté en fin de `<head>`.

Inter est fournie comme ressource statique, issue de `@fontsource-variable/inter` 5.3.0, sous licence SIL OFL 1.1 incluse dans `packages/ui/src/fonts/LICENSE`. Les fontes sont servies localement dans la nouvelle application et incorporées dans la couche CSS du fichier historique pour préserver son autonomie. Aucun paquet n’est ajouté aux dépendances applicatives et aucun chargement externe n’est introduit.

Les barres de répartition de la synthèse représentent les valeurs déjà affichées, sous forme de SVG décoratif ; les valeurs textuelles restent accessibles. L’illustration de connexion est purement décorative.

## Conséquences

Aucune modification serveur, migration ou changement de comportement métier. Les captures visuelles de référence doivent être relues et régénérées sur la pile officielle après acceptation. La recette de la copie et ses limites sont décrites dans `LIRE-MOI-REFONTE.md`.
