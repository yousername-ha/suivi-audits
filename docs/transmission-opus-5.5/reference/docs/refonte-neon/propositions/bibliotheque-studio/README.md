> **Suite du 12/11/2026 : visuels validés par « Top », puis portés dans le frontend existant.** Voir [intégration, tests et captures natives](../../BIBLIOTHEQUE-ASSISTANT-NEON-INTEGRES.md). Le présent dossier conserve la proposition et ses preuves de maquette.

> **Ajustement du 12/11/2026, toujours en maquette :** les panneaux des noms sont foncés en clair (dégradé de couleur à 17 %/10 % sur blanc), sans modifier le thème sombre ni le menu. Le bandeau ambre des clauses non conformes reçoit une pulsation de contour sur 5,5 s et un halo de 3 px/9 %, texte fixe et mouvement réduit respecté. Captures/vidéo et preuves actualisées ; huit parcours, seize dispositions et quatre analyses Axe réussis sur cette version. Suite Assistant : [proposition Neon Studio](../assistant-neon/README.md).

# Bibliothèque de référentiels Studio — proposition corrigée

12/11/2026 (Europe/Paris). **Maquette autonome à valider ; aucun code applicatif modifié.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Clarification du demandeur : « on touche pas au menu », la demande de style SWOT/PESTEL concernait **la bibliothèque de référentiels**. La proposition `menu-swot-pestel` provenait d’une mauvaise interprétation et ne doit pas être portée. Aucun de ces changements de menu n’a été intégré à l’application. Le décor de navigation de cette nouvelle maquette reprend exactement le menu plat du visuel initial fourni par le demandeur ; il ne prescrit aucun changement de menu.

[Image claire HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/bibliotheque-studio/bibliotheque-clair-hd.png) · [Image sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/bibliotheque-studio/bibliotheque-sombre-hd.png) · [Animation réelle](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/bibliotheque-studio/bibliotheque-animation.mp4) · [Aperçu autonome](apercu-autonome.html).

## Proposition

Dalles rectangulaires de hauteur intermédiaire : identité, versions et catalogue à gauche ; couverture du périmètre et états à droite. Contours présents, angles asymétriques, plaque d’icône, filet de couleur et relief léger comme les secteurs SWOT et facteurs PESTEL validés. Bleu pour ISO et turquoise pour HDS dans le jeu fictif ; les couleurs d’état gardent leur sens. Pas de multiplication de violet.

Les six états restent visibles et distincts des liens aux mesures ; fiche/version active, source à vérifier et alerte sur les clauses obligatoires restent affichées. Recherche discrète, clic/clavier sur la dalle, commandes indépendantes et défilement propre à la liste conservés. Un catalogue sans couverture active n’affiche pas de faux zéros. Aucun taux de certification inventé ni nouveau texte normatif.

Au survol/focus : dalle relevée de 2 px, bordure et ombre très modérément accentuées. Au repos : icône flottant entre +0,6 et −0,6 px sur 6 secondes. Ni les chiffres ni les barres ne bougent pour simuler une évolution. Réduction des animations respectée : plus d’animation, de transition ou de déplacement.

## Résumé technique pour une IA connaissant le code

- **Documentation et maquette uniquement** sur `codex/refonte-neon-main`, application inchangée par ce lot. L’intégration Bibliothèque/Couverture existante de `35e700c` demeure ; aucun fichier `apps/` ou `packages/`, API, droit, donnée ou dépendance modifié.
- `index.html` conserve le décor `menus-harmonises` du premier visuel et référence ses `menu.css`/`menu.js` sans modification. Aucun code du menu à plaques de la proposition rejetée n’est repris.
- Seule nouvelle feuille `studio.css`, limitée aux sélecteurs `.bb-*` et `#records` : grille identité/couverture, états en blocs lisibles, bordure 1,25 px, accent de référentiel, mouvement `bs-icon-float` et garde `prefers-reduced-motion`. Elle ne cible ni sidebar, header global, palette racine ni navigation. Les panneaux s’adaptent à la largeur sans miniaturiser toute la page.
- Le JS de bibliothèque et les métadonnées fictives sont réutilisés sans réécriture depuis `bibliotheque-unifiee/`. Jointure par ID, recherche, périmètre, absence de rattachement, versions et dialogues conservent les comportements de la maquette d’origine. Ses écritures restent illustratives, sans API.
- `exporter.py` assemble styles/scripts/police locaux en un HTML autonome. Les images sont deux captures natives 3840×2160 (viewport 1920×1080, densité 2). La vidéo 1440×900 utilise 48 captures natives successives, avec durées réelles préservées, assemblées par FFmpeg existant.
- Après validation : porter le seul habillage de bibliothèque sur `BibliothequeStudio.tsx` et `neon-bibliotheque.css`, avec les formulaires, évaluations, historique, contrôles de droits et `If-Match` existants. **Ne pas porter les changements de menu**, ni supprimer les anciennes fonctions métier cachées. Cartographie/génération et Assistant inchangés.

## Contrôles exécutés sur la maquette

Huit parcours réussis : navigation regroupée et couverture par dalle ; catalogue sans périmètre ; recherche/Échap/critère/remise à zéro ; détail et retour du focus ; référentiel non actif ; versions distinctes ; liste de 30 entrées à défilement local ; clic/clavier et commandes indépendantes.

16 dispositions PC en clair/sombre, de 1024×768 à 2560×1440, avec fenêtres basses : pas de débordement horizontal de page/liste, liste bornée et dialogue de démonstration sans défilement interne. Quatre analyses Axe catalogue/détail dans les deux thèmes sans violation détectée ; pas une certification complète d’accessibilité. Aucun appel API, ressource externe ou erreur JavaScript dans la recette finale.

Animation mesurée dans le navigateur : positions ±0,6 px, cycle 6 s, survol −2 px et désactivation en mouvement réduit. CSS/HTML formatés et vérifiés avec Prettier ciblé `--ignore-path /dev/null` ; aucun nouveau script métier. Dimensions, empreintes des dépendances de navigation conservées et résultats dans [controles.json](controles.json) et [animation.json](animation.json).

**Non exécutés :** build/tests applicatifs, API/DB réelle, Docker/Windows, fusion, push, déploiement ou ZIP. Les tests de l’intégration précédente ne sont pas réattribués à cette proposition. Aucune PR ouverte lors de la vérification avant mise à jour documentaire ; entrées historiques préservées.

Suite : avis sur cette bibliothèque, puis intégration et tests pertinents après validation, conformément à [AGENTS.md](../../../../AGENTS.md) : « Présenter d’abord une proposition visuelle isolée et attendre sa validation explicite. »
