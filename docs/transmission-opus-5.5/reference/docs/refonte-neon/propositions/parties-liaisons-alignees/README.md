# Parties intéressées — liaisons alignées

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Révision demandée après le signalement des liens chaotiques sur la capture sombre. La [proposition précédente](../parties-interessees-studio/README.md), ses sources et ses captures restent conservées. Cette variante corrige le tracé dans une **maquette indépendante à valider avant intégration**. L’application reste à `23b33b5`, sans changement de code applicatif, build/test applicatif, dépendance, donnée ou API. Aucun nouveau ZIP ni push.

## Changement visuel

- Une seule sortie de chaque côté du cercle pour chaque nature présente.
- Branches horizontales et verticales partagées, points d’attache sur les bords des cartes ; les courbes individuelles depuis le centre sont remplacées.
- Passage vers la seconde colonne dans l’espace libre entre les rangées ; avec une seule rangée, passage sous le titre du groupe et au-dessus des cartes.
- Espaces réservés aux traits : 26 px entre rangées, 34 px entre colonnes et 22 px sous les titres de groupe. Tracés continus et fixes, avec de petits points de jonction ; l’anneau du cercle conserve son animation et sa pause.
- Même disposition générale, champs, couleurs, cartes, filtres, liste et fiches que dans la proposition précédente. Les acteurs sans nature restent visibles dans « À préciser », sans leur inventer une liaison de catégorie.

## Visuels natifs

| Vue | Clair | Sombre |
| --- | --- | --- |
| Détail du panorama et des liaisons | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-alignees/detail-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-alignees/detail-dark.png) |
| Écran complet 1 920 × 1 080 | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-alignees/complet-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-alignees/complet-dark.png) |
| Portable 1 366 × 768 | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-alignees/portable-clair.png) | — |

[Maquette](index.html), servie depuis la racine du dépôt. Les détails sont des captures directes du bloc dans Chromium, sans retouche ni image générée. Le reste des données illustratives est identique au jeu précédent, daté du 09/11/2026.

## Résumé technique pour une reprise IA

Nouveau dossier `parties-liaisons-alignees` :

- `index.html` reprend la page et charge la feuille `parties-interessees-studio/parties.css`, puis les ajustements `liaisons.css` ; les styles communs et données fictives restent réutilisés sans modification.
- `parties.js` reprend le contrôleur de la première maquette. Seule la construction des liaisons dans `wires()` est remplacée, avec observation des dimensions et du chargement des polices. Les fonctions de filtrage, lecture, édition fictive et sauvegarde en mémoire restent celles de la proposition précédente.
- `wires()` mesure le cercle et les cartes, regroupe les cartes externes par colonne et rangée, construit des segments orthogonaux et réserve le passage vers la colonne éloignée. Une colonne utilise un tronc commun ; les segments sont partagés au lieu d’être superposés pour chaque acteur. Les ports du cercle sont positionnés sur l’anneau extérieur.
- Un `ResizeObserver` suit le panorama, les groupes, les cartes et le cercle. La liaison est aussi recalculée après `document.fonts.ready` / `loadingdone` pour éviter les points d’attache périmés après le chargement d’Inter. Les éléments sont observés une seule fois par nouveau panorama, afin d’éviter une boucle d’observation.
- `liaisons.css` réserve les gouttières et supprime le mouvement des traits. Aucune relation métier n’est créée ; ce sont toujours des liaisons de lecture entre acteurs du périmètre et regroupements par nature.

## Vérifications de la variante

[Rapport](controles.json), [dimensions et empreintes](medias.json). Node 26.13.0, Chromium système et serveur statique indépendant ; scripts privés, aucun service métier sollicité.

- Dix dispositions PC, de 1 024 à 2 560 px, deux thèmes : aucune traversée de carte, titre de groupe, libellé du cercle ou intérieur du cercle détectée dans les échantillons des tracés SVG réellement rendus ; aucun débordement de page détecté.
- Huit cas complémentaires : internes seuls, externes en deux rangées, externes en une rangée, carte unique, trois redimensionnements sans rechargement et repli des titres après agrandissement diagnostique du texte. Segments orthogonaux, six branches dans le jeu complet, une branche par carte de nature connue, deux sorties au maximum et absence de tronçon déconnecté contrôlés.
- Deux analyses Axe ciblées sans violation détectée, aucune erreur JavaScript ni appel API métier pendant ces parcours.

Ces contrôles concernent la nouvelle géométrie de maquette. Les sept analyses Axe et autres contrôles de la première proposition restent historiques ; ils ne sont pas réattribués à cette variante. Les parcours applicatifs, droits et écritures restent à vérifier après validation et intégration. **Suite : retour du demandeur sur le nouveau tracé, puis intégration du lot explicitement validé.**
