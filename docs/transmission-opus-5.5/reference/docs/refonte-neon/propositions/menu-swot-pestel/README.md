> **Correction du 12/11/2026 : menu mis de côté, ne pas intégrer.** Le demandeur précise « on touche pas au menu » : le style SWOT/PESTEL concernait [la bibliothèque de référentiels](../bibliotheque-studio/README.md). Les propositions de menu restent un historique uniquement ; aucun portage du menu effectué.

# Menu latéral Studio — inspiration SWOT / PESTEL

12/11/2026 (Europe/Paris). **Nouvelle proposition autonome à valider, non intégrée.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur souhaite rapprocher le menu du style SWOT/PESTEL avec une animation très légère et des lignes de taille intermédiaire. Cette variante conserve la navigation simplifiée de la proposition précédente et remplace son habillage par des plaques d’icônes, angles asymétriques, accents de famille et relief discret. Le contenu Bibliothèque sert de contexte ; aucune autre page métier n’est remaniée.

[Image claire HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-swot-pestel/menu-clair-hd.png) · [Image sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-swot-pestel/menu-sombre-hd.png) · [Vidéo réelle du navigateur](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-swot-pestel/menu-animation.mp4) · [Aperçu autonome interactif](apercu-autonome.html).

## Dimensions et mouvement

Largeur principale 256 px, 212 px en fenêtre étroite. Familles de 44 px minimum sur une ligne, libellés longs sur deux lignes au besoin ; destinations 38 px minimum. En fenêtre basse : minimum 38 px pour les familles et 33 px pour les destinations, texte non miniaturisé. Contour ordinaire 1 px, actif 1,25–1,5 px, repère vertical 3 px. Le défilement appartient au menu, pas à toute la page.

Au survol/focus : translation de 2 px vers la droite et 1 px vers le haut, transition 220 ms et ombre légère. Au repos : seule l’icône de la famille active se déplace de 1 px sur un cycle de 6 secondes, avec halo très limité. Aucun texte ni ligne entière en mouvement permanent. `prefers-reduced-motion: reduce` désactive transition, déplacement et animation. La couleur de famille sert de repère de navigation, pas de statut métier.

## Résumé technique pour une IA connaissant le code

- **Maquette/documentation uniquement** depuis l’application `35e700c`. Aucun fichier sous `apps/`, `packages/`, aucun contrat API, droit, préférence, donnée, backend ou Docker modifié ; aucun build/test applicatif exécuté dans ce lot.
- `index.html`, `menu.js`, `menu.css` et `exporter.py` reprennent la proposition `menus-harmonises/`, conservée intacte comme historique. CSS réécrit uniquement pour le menu ; un attribut `data-mh-group` transmet la couleur de famille aux destinations. Palette claire/sombre commune indépendante de la page.
- `menu.css` : bordures et rayons asymétriques comme les secteurs SWOT/facteurs PESTEL, petites plaques d’icônes, compteurs, filet supérieur coloré et sélection. Animation `mh-icon-breathe`, gardes de réduction du mouvement et dimensions PC. Le décor de la page n’est pas une spécification de refonte supplémentaire.
- `exporter.py` assemble les styles, scripts et police locale dans `apercu-autonome.html`. Aucun appel API ni ressource distante ; pas d’injection de ces scripts dans l’application.
- Après validation : porter seulement cet habillage dans le menu existant de `Layout` en gardant sa navigation, permissions, ordre mémorisé et modules. Retirer les seules surcharges conditionnelles de sidebar de `neon-dda.css` identifiées dans [le diagnostic précédent](../menus-harmonises/README.md). Les onglets internes restent hors du périmètre, comme précisé par le demandeur.
- Cartographie : aucun changement de son canevas, disposition ou génération. Assistant IA et archive livrée inchangés.

## Vérifications réellement exécutées

18 comparaisons (9 contextes × 2 thèmes) : mêmes fond, texte, largeur, bordure et police du menu. 16 dispositions PC dans les deux thèmes, de 1024×768 à 2560×1440, y compris fenêtre 1920×800 : aucun débordement de page/menu. Six analyses Axe sans violation détectée sur Bibliothèque/DDA/Objectifs en clair/sombre ; pas une certification d’accessibilité exhaustive. Aucun appel API, requête distante ou erreur JavaScript dans le contrôle final de la maquette.

Mouvement contrôlé par les styles calculés et les animations du navigateur : positions à 0 et 3 secondes, amplitude du survol et suppression en mode mouvement réduit. Deux captures natives 3840×2160 (viewport 1920×1080, densité 2), vidéo de 144 captures natives successives à 1440×900, avec durées réelles préservées. ESLint du script et Prettier ciblé avec `--ignore-path /dev/null` réussis ; les docs sont ignorées par défaut dans ce dépôt.

Incidents de capture corrigés : le binaire FFmpeg attendu par Playwright était absent ; le FFmpeg système existant est exposé dans un dossier de recette privé via `PLAYWRIGHT_BROWSERS_PATH`, sans installation ni changement de dépendance. La livraison finale utilise les captures PNG natives assemblées par FFmpeg, avec leurs durées réelles, pour maîtriser le rendu colorimétrique. Le sélecteur de la destination Bibliothèque correspondait aussi à `body` ; ciblage du bouton corrigé. Les parcours et assertions restent conservés. Les preuves finales sont dans [controles.json](controles.json) et [animation.json](animation.json).

**Suite :** avis visuel avant toute intégration, conformément à [AGENTS.md](../../../../AGENTS.md) : « Présenter d’abord une proposition visuelle isolée et attendre sa validation explicite. » Le menu applicatif actuel n’est pas encore harmonisé. Pas de tests applicatifs/DB/API réels, Docker/Windows, ZIP, push, fusion ou déploiement dans ce lot. Les 289 web/246 UI/25 E2E du lot précédent restent des résultats historiques distincts.
