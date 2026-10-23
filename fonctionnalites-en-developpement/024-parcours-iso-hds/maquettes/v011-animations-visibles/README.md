# 024 · Arbre Gondor — branche continue et animations visibles — v011

**Maquette fonctionnelle à valider, sans intégration backend.**

Cette version corrige le raccord de la branche jaune « Maîtriser » et rend les animations perceptibles sur téléphone : le flux coloré suit chaque branche et deux nappes de brume remontent du bas vers le haut. Les animations sont activées par défaut, conformément à la demande. Au premier chargement de v011, l’ancien réglage mémorisé est migré une seule fois vers « Animées » ; elles restent ensuite réglables dans les options et peuvent être arrêtées. Le mode « Automatiques » continue de respecter le réglage de mouvement réduit du téléphone. Les cercles, sous-branches et cartes restent interactifs.

- `index.html` est autonome : styles, scripts, SVG et motif graphique sont intégrés au fichier.
- `app.js` et `style.css` sont les sources lisibles de la maquette.
- `assets/gondor.png` est le motif décoratif transparent.
- `construire.py` régénère la page autonome à partir des sources et de l’image.

La progression et les contenus restent des données de démonstration conservées localement dans le navigateur. Cette maquette ne modifie pas la plateforme et n’est pas raccordée au backend.

## Aperçu

La maquette v011 est publiée sur le [site public ASTRA](https://astra-parcours-apercu.earlycedar65.chatgpt.site), version 8. L’accès public et l’état actif du Site ont été revérifiés.

## Historique et validation

v011 est la proposition courante à valider. Déploiement réussi le 23 octobre 2026 (commit source Site `a599e521a538bbbfaad41f5ad65476311234f214`). Le JavaScript a été vérifié par `node --check`, le HTML autonome régénéré et `git diff --check` exécuté ; aucune recette automatisée d’interaction n’a été lancée sur téléphone. Voir [v010](../v010-gondor-public/README.md) et [v009](../v009-tronc-cartes/README.md) pour l’historique. Aucun ZIP/BAT n’est fourni.
