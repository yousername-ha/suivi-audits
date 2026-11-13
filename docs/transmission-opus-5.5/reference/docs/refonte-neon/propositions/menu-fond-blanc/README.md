# Menu clair — correction du fond

12/11/2026, Europe/Paris. **Maquette à valider ; application inchangée.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le fond crème/jaune de `menu-chaud-anime` est rejeté par le demandeur. Cette variante revient au blanc, avec deux touches très discrètes bleu glacier et sauge en bordure. Les couleurs chaudes et les mouvements des icônes restent ceux de la proposition précédente ; leur maintien dans cet essai ne signifie pas une validation humaine implicite.

[Vue complète HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-fond-blanc/menu-clair-hd.png) · [Détail HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-fond-blanc/menu-detail-hd.png) · [Aperçu animé autonome](apercu-autonome.html).

## Résumé technique pour une IA

Base documentaire `5c10f80`, application toujours à `d9d1478`. Aucun fichier applicatif, API, donnée, droit, route ou dépendance modifié. `index.html` réutilise intégralement la variante chaude et importe une seule surcharge `fond.css`, ciblée sur `html[data-theme='light'] .mh-sidebar`. Seule la propriété `background` change : blanc dominant et teintes de bordure froides légères à la place de l’ivoire et du crème jaune. `icones.js`, formes SVG, tokens de famille, keyframes, commandes de pause et règle de réduction du mouvement sont importés à l’identique. `exporter.py` assemble les sources et la police locale dans l’HTML autonome.

Contrôles natifs Chromium de cette variante : comparaison de la sidebar sombre avant/après pixel-identique ; sept analyses Axe ciblées claires sans violation détectée ; quatre dispositions PC 1280×720, 1440×900, 1920×1080 et 2560×1440 sans débordement de page ; bascule thème et régénération des huit SVG vérifiées. Les huit animations sont présentes et actives, pause et réduction système contrôlées. Aucune erreur JavaScript de capture ; format HTML/CSS et diff contrôlés. Capture native 3840×2160, détail du menu et résultats/empreintes dans `controles.json`. Les mesures de variation des formes et la vidéo du tour précédent ne sont pas présentées comme de nouvelles preuves de cette variante : aucune nouvelle vidéo/GIF produit, l’aperçu autonome montre les mouvements avec le nouveau fond.

Non exécutés : intégration ou build/tests applicatifs, Docker/API/DB/Mistral, ZIP, push, fusion ou déploiement. PR #264 toujours ouverte au même commit, liste des fichiers consultée aux tours précédents sans chevauchement avec ce lot. Entrées documentaires antérieures préservées.

Suite : avis sur le fond blanc avant intégration du menu retenu. Ne pas porter le fond jaune rejeté ni importer le simulateur dans le composant React. Conserver les droits, routes, préférences, alertes, accès conditionnels et génération automatique de la cartographie.
