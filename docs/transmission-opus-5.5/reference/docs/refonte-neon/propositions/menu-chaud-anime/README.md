# Menu clair — palette chaude et icônes animées

12/11/2026, Europe/Paris. **Maquette autonome à valider avant intégration.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

[Vue HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-chaud-anime/menu-clair-hd.png) · [Aperçu interactif](apercu-autonome.html) · [Vidéo native du menu](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-chaud-anime/animation.mp4) · [Prévisualisation animée](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-chaud-anime/animation.gif).

Palette plus chaude : cuivre pour Pilotage, ambre pour Risques, terre cuite pour Actions et Résilience, olive pour Organisation, vert sauge pour Conformité, ocre pour Documents et violet chaud pour le tableau de bord. Fond ivoire nuancé de crème et de vert. Le menu sombre conserve ses sources et ses pixels précédents au contrôle.

## Résumé technique pour une IA connaissant le code

- Base documentaire `f2203a1`, application toujours à `d9d1478`. Ce lot ajoute uniquement une proposition et sa documentation : aucun code applicatif, route, droit, donnée, contrat ni dépendance modifié.
- `index.html` réutilise les styles de la variante futuriste et ajoute `chaud.css` ; `icones.js` reprend son décorateur SVG avec des formes séparées pour animer les éléments eux-mêmes. WeakMap/restauration du sombre et observateurs du simulateur conservés. Les états métier et les commandes de navigation restent ceux de la maquette existante.
- Huit mouvements indépendants : tuiles en léger agrandissement, losange Organisation en pulsation, flèche Pilotage en progression diagonale, triangle Risques en fondu clignotant (un cycle/2,8 s, opacité minimale 0,35), coche de Conformité dessinée par trait, flèche Actions en va-et-vient horizontal ±1,5 unité SVG/3,4 s, arc fléché Résilience en rotation autour du centre 16/16 sur 10 s, lignes Documents en léger déplacement vertical/fondu. Les textes restent fixes ; aucun état ou événement métier n’est simulé par ces mouvements décoratifs.
- Ces mouvements sont visibles sur les huit rubriques, pas seulement celle active. Ancien flottement de l’icône complète et clignotement des repères désactivés en clair. Bouton pause existant appliqué à toutes les nouvelles animations ; `prefers-reduced-motion` les supprime, avec coche entièrement visible. Pas de filtre flou ni de nouvelle dépendance.
- Le futur portage devra utiliser des composants React SVG déclaratifs et les tokens de charte. Ne pas importer le simulateur, ses données ou ses MutationObserver. Conserver Layout, droits, préférences d’ordre, routes, alertes et accès conditionnels.

## Contrôles de la proposition

Chromium natif : sept analyses Axe ciblées du menu clair (une famille active chacune) sans violation détectée ; quatre dispositions PC de 1280×720 à 2560×1440 sans débordement de page ; bascule clair/sombre et régénération des huit SVG vérifiées. Comparaison du sombre pixel-identique à la proposition précédente. Huit animations actives vérifiées, variations effectives mesurées sur triangle/flèche Actions/rotation Résilience ; gel après pause et suppression de toutes les animations par réduction système contrôlés. Aucune erreur JavaScript de capture. Lint JS ciblé, format HTML/CSS/JS et diff contrôlés. Résultats et empreintes dans `controles.json`.

Capture HD 3840×2160 à densité 2 ; vidéo assemblée depuis des captures natives successives de Chromium à densité 2 (durées réelles conservées), environ 10 secondes, 496×1240, encodage H.264 à 25 images/s, avec prévisualisation GIF dérivée. Le nombre de captures distinctes et la durée mesurée sont consignés dans les résultats. Le cadrage ne modifie pas le style de la maquette.

Incident d’enregistrement : premier lancement sans le chemin du FFmpeg de Playwright, donc pas de vidéo produite ; relancé avec le runtime média déjà disponible dans `/workspace/work/pw-media`, sans installation ni changement de dépendance du projet. La livraison finale emploie des captures PNG natives à densité 2 assemblées selon leurs durées réelles, pour éviter le flou de la première vidéo agrandie. Vidéo finale inspectée et métadonnées vérifiées.

**Non exécutés :** intégration, build/tests applicatifs, recette Docker/API/DB/Mistral, ZIP, push, fusion ou déploiement. Aucune validation humaine déduite de cette demande d’essai. PR #264 toujours ouverte au même commit ; fichiers relus au tour précédent, aucun chevauchement avec ce lot. Entrées partagées antérieures préservées.

Suite : validation de la palette et des mouvements avant portage ciblé du menu retenu. Cartographie et génération automatique inchangées.
