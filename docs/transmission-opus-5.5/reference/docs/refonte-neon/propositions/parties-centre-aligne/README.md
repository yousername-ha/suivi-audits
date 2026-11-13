# Parties intéressées — cercle centré et aligné

12 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Demande : « centrer et aligne le rond proprement au milieu », une seule image, puis poursuivre la refonte.

**Proposition isolée, application conservée à `81ea06a`.** Une unique capture native sombre de 3840 × 2160 px est fournie. Aucune nouvelle vidéo, capture Processus ou archive Docker.

## Modification

- `centre.css` sépare la grille en rangée d’en-têtes et rangée de cartes ; le cercle occupe la seconde rangée et sa propre colonne.
- `parties.js` reprend le contrôleur des liaisons alignées, avec une seule modification de structure : les légendes sont regroupées dans `.pi-hub-caption`.
- La légende est positionnée sous le cercle et ne contribue plus à sa hauteur de centrage. Sa largeur reste bornée à la colonne centrale pour ne pas empiéter sur les rails dans une fenêtre étroite.
- Les deux sorties, les rails, les branches et le flux animé de la dernière proposition sont réutilisés. Aucun décalage fixe en pixels pour placer le cercle, aucune donnée ou relation modifiée.

## Vérifications de maquette

Quatre fenêtres PC, 1024×768, 1366×768, 1920×1080 et 2560×1440 : différence de **0 px CSS en horizontal et vertical** entre le centre du cercle et le milieu de la zone de cartes contrôlée ; six branches conservées. Aucune liaison traversant les cartes, la légende ou les en-têtes détectée par échantillonnage des SVG dans ces quatre cas. Aucune erreur JavaScript. Les données sont celles de la maquette fictive précédente, sans accès API.

Le premier contrôle complémentaire a repéré une légende trop large à 1024 px ; la largeur bornée à la colonne corrige cette collision. Aucun test de l’application ni build exécuté pour cet ajustement avant validation visuelle. Le portage futur concerne `Panorama` dans `PartiesInteresseesStudio.tsx` et les styles locaux `neon-parties.css`, en conservant les mesures et animations React intégrées.

[Image unique](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-centre-aligne/apercu-centre-sombre-hd.png) · [Mesures](validation.json).

La suite a également avancé : [Processus Studio](../processus-studio/README.md), sous forme d’aperçu interactif sans capture supplémentaire. Les nouvelles propositions ne sont pas encore intégrées.
