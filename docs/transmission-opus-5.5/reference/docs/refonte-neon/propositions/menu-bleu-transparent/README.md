# Menu bleu translucide — dernier essai de comparaison

12/11/2026, Europe/Paris. **Variante rejetée le 13/11/2026 (« C’est non »). Le bleu nuit opaque précédent reste retenu. Proposition et preuves conservées comme historique, aucune intégration.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

[Vue complète HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-bleu-transparent/menu-clair-hd.png) · [Détail du menu](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-bleu-transparent/menu-detail-hd.png) · [Aperçu animé avec comparaison](apercu-autonome.html) · [Bleu nuit retenu](../menu-bleu-sur-clair/README.md).

Le demandeur valide le rendu bleu nuit (« J’adore garde »), puis demande de voir une variante plus transparente et plus claire. Cette proposition conserve la version retenue, l’éclaircit uniquement dans un nouvel essai et permet de revenir instantanément à la référence via « Comparer au bleu retenu ». Le contenu reste en clair, les formes et couleurs des icônes et leurs animations restent identiques.

## Résumé technique pour une IA

- Base documentaire `e100b28`, application toujours à `d9d1478`. Aucun code applicatif, API, droit, route, donnée ou dépendance modifié. Validation du bleu nuit enregistrée dans son README ; la nouvelle transparence n’est pas considérée validée. Le portage du menu retenu attend la fin de cet essai demandée par le demandeur.
- `index.html` importe la proposition bleu nuit et ajoute `transparent.css`. Sous le seul thème clair et tant que `data-menu-glass` n’est pas `off`, fond à alpha 78–80 %, accent pétrole à 12 %, séparateurs plus légers et `backdrop-filter: blur(10px) saturate(115%)`. L’opacité du conteneur reste 1 : textes, pictogrammes et contenus ne sont pas globalement atténués. Les libellés secondaires sont légèrement renforcés pour le contraste sur le fond éclairci.
- `comparaison.js` ajoute seulement le bouton de l’aperçu qui bascule l’attribut `data-menu-glass` entre `on` et `off` ; le fond retenu est retrouvé sans redessiner la navigation. Bouton indisponible dans le vrai thème sombre où cet essai ne s’applique pas. Aucun état métier ni contrôle applicatif ajouté.
- Formes SVG, treize teintes d’icônes, traits, keyframes, pause/reprise et réduction système restent importés à l’identique. Dimensions et texte du menu conservés. `exporter.py` assemble les ressources locales dans un aperçu autonome.
- Pour la future intégration : porter la seule version choisie dans les tokens/composants React existants. Ne pas importer les observateurs, données, couches successives de CSS ni le bouton de comparaison du simulateur. Conserver droits, routes, alertes, préférences d’ordre, accès conditionnels et génération automatique de la cartographie.

## Contrôles de cet essai

Chromium natif : sept analyses Axe ciblées du menu clair, sans violation détectée ; quatre dispositions PC de 1280×720 à 2560×1440 sans débordement de page. Treize couleurs calculées distinctes et traits 1,95, huit mouvements actifs, pause et réduction système contrôlés. Aller-retour clair/sombre et régénération des huit SVG vérifiés. Opacité du conteneur égale à 1 et fond alpha 0,78 vérifiés ; bouton de comparaison restituant la sidebar retenue pixel pour pixel, retour à l’essai transparent et désactivation du comparateur en sombre vérifiés. Sidebar du vrai thème sombre inchangée et contenu Bibliothèque clair identique aux captures de référence à densité égale. Aucune erreur JavaScript de capture. Lint JS ciblé, format HTML/CSS/JS et diff contrôlés. Capture native 3840×2160 et détail ; résultats et empreintes dans `controles.json`.

Non exécutés : intégration, build/tests applicatifs, Docker/API/DB/Mistral, nouvelle vidéo/GIF, ZIP, push, fusion ou déploiement. PR #264 toujours ouverte au même commit ; fichiers lus aux tours précédents sans chevauchement avec ce lot. Entrées documentaires précédentes préservées. Les contrôles historiques des propositions précédentes ne sont pas réattribués à cet essai.

Suite : ne pas porter cette variante rejetée ; utiliser le bleu nuit opaque retenu et les prévisualisations Dashboard demandées ensuite.
