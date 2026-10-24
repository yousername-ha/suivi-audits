# 024 · Arbre de progression avec filigrane Gondor — v010

**Maquette fonctionnelle à valider, sans intégration backend.**

Cette version conserve le parcours interactif et son graphisme de référence, en ajoutant derrière l’arbre un motif Gondor isolé, transparent et discret. Le motif ne recouvre ni les textes, ni les cercles, ni les contrôles et ne capte aucun clic. Les animations, les sous-branches, les cartes et les attendus restent interactifs.

- `index.html` est autonome : styles, scripts, SVG et motif graphique sont intégrés au fichier.
- `app.js` et `style.css` sont les sources lisibles de la maquette.
- `assets/gondor.png` est le motif décoratif transparent.
- `construire.py` régénère la page autonome à partir des sources et de l’image.

La progression et les contenus restent des données de démonstration conservées localement dans le navigateur. Cette maquette ne modifie pas la plateforme et n’est pas raccordée au backend.

## Aperçu

La maquette v010 est publiée sur le [site public ASTRA](https://astra-parcours-apercu.earlycedar65.chatgpt.site), version 6. Accès vérifié en mode public.

## Historique et validation

v010 est la proposition courante à valider. Déploiement Sites réussi le 23 octobre 2026 (commit source `e7868951b1ffccbd49c7e2861b96cd075d43484b`). Voir [v009](../v009-tronc-cartes/README.md) pour les interactions et corrections antérieures. Aucun ZIP/BAT n’est fourni.
