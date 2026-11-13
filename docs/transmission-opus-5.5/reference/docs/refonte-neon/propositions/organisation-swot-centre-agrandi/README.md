# SWOT — proposition de centre agrandi

> Mise à jour du 10/11/2026 : **ce modèle est explicitement retenu et [intégré dans l’application](../../SWOT-CENTRE-AGRANDI-INTEGRE.md)** au commit `51d7022`. La description et les contrôles ci-dessous conservent l’état historique de la proposition. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

10/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Maquette indépendante, à évaluer avant toute intégration.** Le demandeur souhaite uniquement une vidéo et deux images. L’application reste au commit `016d69c50c7775a62640e9e2d75d2875e9c85374` et le paquet Docker précédent reste inchangé.

Le cercle du processus passe de 112 à 184 px sur ordinateur et reste exactement au croisement des quatre panneaux. Les angles intérieurs disposent d’une découpe circulaire et les commandes proches du cercle sont décalées pour préserver le texte. Le relief au survol, les couleurs, les pictogrammes et leurs animations sont conservés. Le cercle mesure 134 px sur tablette ; sur mobile, il mesure 120 px et se place au-dessus des panneaux empilés.

## Livrables

- [Image claire HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-centre-agrandi/centre-light-hd.png), matrice complète, 3040 × 1410 px.
- [Image sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-centre-agrandi/centre-dark-hd.png), même cadrage et résolution.
- [Vidéo](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-swot-centre-agrandi/centre-video.mp4), capture native de la maquette animée : processus central puis survol des quatre catégories, environ neuf secondes, H.264, 1522 × 706 px.

Les PNG proviennent directement de Chromium, avec les animations suspendues pour la lecture. La vidéo montre les mouvements actifs ; seul le cadrage de la matrice est recadré, sans retouche graphique. Le manifeste [captures.json](captures.json) contient les tailles et empreintes des trois médias.

## Sources et contrôles de maquette

Ouvrir `index.html` depuis un serveur statique servant le dossier parent `propositions`. Cette variante utilise en lecture seule les styles de `organisation-swot-matrice` et les styles, polices et données fictives de `organisation-contexte-studio`. Son script et sa surcharge CSS restent locaux au présent dossier. Aucun branchement API.

Seize dispositions contrôlées dans les deux thèmes, de 390 à 1920 px, dont les quatre survols : aucun débordement horizontal, aucun défilement vertical intérieur et aucun texte dans la réserve circulaire. Le centre géométrique est vérifié sur la disposition de la grille, indépendamment de la translation visuelle des cartes au survol. Aucun appel externe ni erreur JavaScript détectés. Résultats : [controles-maquette.json](controles-maquette.json). La vidéo a été lue et décodée dans Chromium : [validation-video.json](validation-video.json).

**Non exécutés pour cette nouvelle proposition : modifications applicatives, build, tests applicatifs, ZIP Docker, publication ou déploiement.** L’accord précédent concerne la matrice déjà intégrée, pas cet agrandissement. Après validation explicite de ce nouveau visuel : intégrer les dimensions et les réserves dans le composant existant, contrôler les contenus longs et les droits, puis fournir les captures de l’application.
