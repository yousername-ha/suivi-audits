# Tests — Périmètres

## v003 — exécutés le 19 octobre 2026

[Rapport](../maquettes/v003-gestion-graphique/technique/verification.json) · [Script reproductible](../maquettes/v003-gestion-graphique/technique/verifier.cjs).

Neuf contrôles de la source de rendu ont réussi sous Chromium/Playwright : héritage visible B et gestion locale C, défilement indépendant, union A+B sans doublon de plan, fenêtre centrée, désactivation simulée de l’héritage, création en mémoire et échappement du texte, réinitialisation au rechargement, vue mobile 390 px, absence d’erreur JS. Les cinq captures sont produites en 1600 × 1060.

Il ne s’agit pas d’une recette du backend ou de l’application intégrée. Aucun test n’a été lancé dans Claude. La validation utilisateur reste à recueillir, notamment sur la relation fournisseur.

## Historique

[Contrôles des anciennes captures](../../../references/vues-modules/technique/verification.json), conservés sans leur attribuer la validation de v003.

## À tester lors de l’intégration

Droits serveur et accès refusés, cycles et profondeur, exceptions locales de référentiels, versionnement concurrent, agrégations autorisées, contrats de chaque registre, données volumineuses, navigation clavier et lecteur d’écran, mobile, états de chargement/erreur/vide. Consigner le SHA et l’environnement effectivement testés.
