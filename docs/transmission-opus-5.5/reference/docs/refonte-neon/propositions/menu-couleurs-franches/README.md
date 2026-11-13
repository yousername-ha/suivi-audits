# Menu clair — couleurs franches et différenciées

12/11/2026, Europe/Paris. **Maquette à valider avant intégration.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

[Vue complète HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-couleurs-franches/menu-clair-hd.png) · [Détail HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-couleurs-franches/menu-detail-hd.png) · [Animation native](animation.gif) · [Aperçu interactif](apercu-autonome.html).

Le demandeur apprécie les animations et demande des couleurs plus foncées, avec une teinte identifiable par icône. Le fond blanc reste celui de la proposition précédente. Les huit rubriques principales utilisent violet, vert, bleu, ambre, turquoise, orange, rouge et brun ; les cinq icônes compte/administration ont également chacune leur teinte. Les formes sont maintenant colorées dans leur ensemble plutôt que structurées en brun commun et accent coloré.

## Résumé technique pour une IA

- Base documentaire `6c82975`, application toujours à `d9d1478`. Aucun code applicatif, route, droit, API, donnée ou dépendance modifié. L’appréciation des animations ne vaut pas validation automatique de cette nouvelle palette ni intégration du menu entier.
- `index.html` importe la variante blanche existante et ajoute `couleurs.css`. Cette seule surcharge claire affecte les variables `--mc-tone` par bouton/groupe, les traits et les remplissages. Huit teintes principales et cinq administratives distinctes. États sélectionnés et sous-groupes reprennent la teinte de leur famille ; correction de la divergence précédente entre Pilotage et ses sous-entrées. Aucun changement du gabarit, des libellés, de la disposition ni du fond.
- Traits principaux et administratifs à 1,95 au lieu de 1,65/1,8 ; facettes teintées à 23 % au lieu de 13 %, repères secondaires à 50 % au lieu de 32 % et trait 1,2. Les formes SVG et leurs mouvements restent importés de `menu-chaud-anime/icones.js` et `chaud.css`, sans modification. Le clignotement du triangle, la translation de la flèche Actions, la rotation Résilience et les autres keyframes sont conservés.
- `exporter.py` assemble les ressources locales dans l’HTML autonome. Lors du futur portage React, consolider les teintes retenues dans les tokens de la charte plutôt que recopier l’empilement des feuilles de propositions. Employer des composants SVG déclaratifs ; conserver droits, routes, alertes, préférences et accès conditionnels. Ne pas importer les données ou observateurs du simulateur.

## Contrôles de cette variante

Chromium natif : treize couleurs calculées différentes et trait 1,95 sur les treize icônes ; fond clair calculé identique à la variante blanche ; comparaison de sidebar sombre avant/après pixel-identique. Sept scans Axe ciblés du menu clair (une famille active chacun) sans violation détectée ; quatre dispositions PC de 1280×720 à 2560×1440 sans débordement de page. Bascule des thèmes et régénération des huit SVG vérifiées ; huit animations actives, pause et réduction système vérifiées. Aucune erreur JavaScript de capture. Format HTML/CSS et diff contrôlés. Capture native HD 3840×2160 et détail ; GIF issu de captures natives successives à densité 2 avec durées réelles conservées. Résultats et empreintes dans `controles.json`.

Non exécutés : intégration ou build/tests applicatifs, Docker/API/DB/Mistral, MP4, ZIP, push, fusion ou déploiement. PR #264 toujours ouverte au même commit, fichiers consultés aux tours précédents sans chevauchement avec ce lot. Entrées documentaires antérieures préservées.

Suite : avis sur cette palette avant portage du menu retenu. Les animations appréciées restent inchangées ; le fond jaune rejeté ne doit pas être porté. Cartographie et génération automatique inchangées.
