# Menu clair — variante futuriste

12/11/2026, Europe/Paris. **Proposition visuelle isolée à valider, application inchangée.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

[Vue HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-futuriste/menu-clair-hd.png) · [Détail HD du menu](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-futuriste/menu-detail-hd.png) · [Aperçu autonome animé](apercu-autonome.html).

Huit pictogrammes principaux redessinés en SVG : géométrie angulaire, deux tons (structure bleu encre et accent de famille), facettes teintées, points de liaison et repères de circuit. Aucun fond carré brillant ni filtre lumineux flou. Emplacement 26×26 et retrait horizontal ajusté pour conserver les textes ; sélection à angles asymétriques. Les icônes compte/admin et le logo restent ceux du menu précédent. Le menu sombre reste celui de la variante précédente.

## Résumé technique pour une IA

- Base documentaire `cae83d1`, application toujours à `d9d1478`. Aucun changement dans `apps/`, `packages/`, backend, données, droits, routes ou dépendances.
- `index.html` réutilise la maquette précédente, ses styles et son simulateur ; ajoute `futuriste.css` et `futuriste.js`. `exporter.py` produit un HTML autonome avec police locale.
- `futuriste.js` contient huit tracés SVG statiques 32×32. Il conserve les contenus/viewBox originaux dans une WeakMap, remplace uniquement les SVG décoratifs des boutons de famille en clair et les restaure en sombre. Deux MutationObserver suivent le remplacement direct des boutons du simulateur et l’attribut `data-theme` ; aucune écriture sur l’état métier. Le futur portage React devra utiliser un composant SVG déclaratif et ne doit pas importer ces observateurs ni les tableaux de navigation du simulateur.
- `futuriste.css` cible seulement le thème clair. Surface de dessin 26×26, pas de padding, structure encre et accent de famille, surfaces teintées à 13 %. Cadres actifs à rayons asymétriques, sans changement des libellés ni du nombre des entrées. Les listes gardent le défilement local.
- Seuls les repères de l’icône active varient en opacité (0,55 à 1, cycle 5,5 s), en plus du mouvement vertical léger déjà présent. Pause/reprise existante et `prefers-reduced-motion` respectés. Aucun texte ou contenu métier animé.

## Contrôles réellement exécutés

Chromium natif, maquette seulement : menu sombre pixel-identique avant/après ; sept analyses Axe du menu clair, une par famille active, sans violation détectée ; quatre dispositions PC de 1280×720 à 2560×1440 sans débordement de page. Bascule clair/sombre aller-retour et régénération des boutons vérifiées, huit SVG personnalisés retrouvés en clair. Mouvement actif, pause et réduction système contrôlés. Capture HD 3840×2160 et détail natif du menu ; aucune erreur JavaScript détectée pendant la capture. Lint JS ciblé, format HTML/CSS/JS et diff contrôlés. Résultats et empreintes dans `controles.json`.

Incident de contrôle : un sélecteur privé `[data-mh-motion]` correspondait au document et au bouton ; corrigé en `button[data-mh-motion]`, puis parcours complet rejoué. Aucune assertion supprimée pour contourner le problème.

**Non exécutés :** portage du menu, build/tests applicatifs, Docker/API/DB/Mistral, vidéo, ZIP, push, fusion ou déploiement. Aucune validation humaine déduite de cette demande d’essai. PR #264 toujours ouverte au même commit, liste des fichiers consultée lors du tour précédent : pas de fichier commun à ce lot.

Suite : avis visuel sur cette proposition avant intégration du menu retenu, conformément au processus demandé. Conserver le cadre React existant, ses droits/alertes, routes, préférences et accès conditionnels lors du portage ; aucune modification de la cartographie ou de sa génération.
