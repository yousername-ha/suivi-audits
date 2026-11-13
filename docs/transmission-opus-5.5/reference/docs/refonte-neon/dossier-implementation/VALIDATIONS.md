# Registre des décisions graphiques

État consolidé au 09/11/2026. Les dates ci-dessous sont celles des lots documentés. Les citations proviennent des échanges du demandeur ; elles ne valent pas validation d’autres propositions ou de fonctionnalités nouvelles.

## Décisions retenues

| ID | Demande ou validation explicite | Décision à conserver |
| --- | --- | --- |
| N01 | « que c'est graphique » ; « la copie de la version main » | Refonte de présentation sur copie isolée, conservation du fonctionnel et des données. |
| N02 | « l’image que j’ai fournit au début du projet » ; « n’abuse pas du violet » | Dashboard et références fournies comme direction visuelle ; violet limité, palette diversifiée. |
| N03 | « Biseau très bien » ; « top tu peux int2grer » | Cadre Biseau et animations de la présentation Contexte conservés. |
| N04 | « Le problème c’est qu’on distingue pas les enjeux interne de ce externe , les interfaces et les dépendances » puis « C’est top tu garde » | Quatre catégories explicites et distinctes dans le Contexte. |
| N05 | « Les animer » en réponse à la clarification sur Non atteint et les flèches | Conserver ces éléments, animer l’alerte et les tendances ; avertissement rouge visible. |
| N06 | « Remet juste en violet la cible à atteindre » ; « Oui centre aussi le nom des colonnes » | Cible violette, colonnes Cible / Mesuré / État alignées et en-têtes centrés. |
| N07 | « Version B, tu peux implémenter » | Blocs plus petits sans augmentation des titres d’objectifs ; principe de proportion conservé dans Studio. |
| N08 | « je valide , tu peux intégrer », puis nouvelle direction et « Je valide pour intégration » | Pour la DdA, appliquer la dernière direction Studio du 04/11 ; les anciennes palettes ne priment plus. |
| N09 | « Non je préfère en ligne au vu du nombre » ; « pas de rose ,que du rouge » | Mesures DdA en lignes ; vert/orange/rouge selon l’état, sans rose pour l’état défavorable. |
| N10 | « retire la petit fleche dans mise en euvre et applicable » | Sélecteurs DdA sans chevrons décoratifs ; menus et interactions conservés. |
| N11 | « que les carte soit replier » ; « la vue soit centré » ; « Go intégration » | Graphe Périmètres initial, cartes repliées et graphe centré. |
| N12 | « le plus doit être centré en bas » ; « étend la carte en rectangle » puis « Ok tu peux implémenter les modif précédente et celle-ci » | Dépliage indépendant, bouton centré en pied, élargissement horizontal des cartes et style Studio partagé. |
| N13 | « les objectifs et indicateurs la vue pas défaut devient la vue compact » ; « Met le dans lele style que le périmètre et dda » puis accord d’implémentation | Objectifs compacts par défaut, même famille de surfaces et d’états que Périmètres et DdA. |
| N14 | « trs bien le référentiiel » | Catalogue, exigences, provenance et bibliothèque Studio intégrés au lot du 05/11. |
| N15 | « il ne faut pas scroller dans uune fénétres » | Hauteurs naturelles ; défilement extérieur pour les fiches longues et absence d’ascenseur vertical interne aux dalles. |

## État de réalisation et références

| Ensemble | Dernière référence utile | État et preuve |
| --- | --- | --- |
| Dashboard et graphiques du prototype | [Prototype intégré](../PROTOTYPE-INTEGRE.md), 31/10 | Présentation analytique intégrée ; Dashboard recapturé le 05/11 sans nouveau changement de code. |
| Contexte et quatre catégories | [Catégories](../CONTEXTE-CATEGORIES.md), 01/11, validation consignée à partir de `fede361` | Validé et intégré ; les textes anciens non classés restent dans À préciser. |
| Biseau et pictogrammes | [Cadres et animations](../CADRES-NEON.md), 01/11 | Biseau et cinq pictogrammes explicitement retenus ; variantes de comparaison archivées. |
| Fenêtres communes | [Fenêtres globales](../FENETRES-GLOBALES.md), 01/11 | Habillage commun intégré ; toutes les combinaisons de fenêtres et de droits n’ont pas été exercées individuellement. |
| Objectifs, proportion B | [Version B](../OBJECTIFS-VERSION-B.md), 02/11 | Validée et intégrée ; reprise visuelle ultérieure Studio à conserver. |
| DdA Studio | [Intégration](../DDA-STUDIO-INTEGREE.md), 04/11, `008cc30` | Dernière direction validée et intégrée ; quatre sources du lot, données et calculs conservés. |
| Périmètres horizontaux et Objectifs Studio | [Intégration](../HORIZONTAL-STUDIO-INTEGRE.md), 04/11, `eed9f21` | Deux propositions validées puis intégrées ensemble ; défaut compact inclus. |
| Référentiels Studio | [Intégration](../REFERENTIELS-INTEGRES.md), 05/11, `65bd22f` | Validé et intégré ; bibliothèque distincte des publications locales. |

Les empreintes et chemins complets des références livrées sont consignés dans `sources-validations.json`.

## Choix remplacés ou écartés

- Contexte : Équerres et Halo comparés, puis Biseau retenu. Les compositions précédant les quatre catégories ne sont plus la référence complète du contenu.
- Objectifs : variante A avec titres agrandis écartée au profit de B. Les grandes dalles Biseau des premiers lots n’imposent pas leur forme au tableau Studio final.
- DdA : nombreuses versions gris bleuté, sauge, très transparentes, fortement lumineuses ou inspirées de Bootstrap explorées puis remplacées. Les documents correspondants restent historiques.
- DdA : la proposition de cartes individuelles a été remplacée par les lignes, adaptées au nombre de mesures.
- Périmètres : les grandes cartes toujours dépliées et l’expansion uniquement verticale ont été remplacées par le graphe compact et le rectangle ouvert en largeur.
- Référentiels : les trois publications et leurs activations dans la maquette étaient illustratives. Elles ne deviennent pas un contenu obligatoire dans chaque base ou périmètre.

Une capture conservée dans un ancien dossier de propositions ne constitue donc pas, à elle seule, une décision applicable à la suite.

## Règle de validation pour la suite

La consigne du demandeur est conservée dans [AGENTS.md](../../../AGENTS.md) : proposition visuelle isolée, validation explicite, intégration et contrôles, puis nouvelles captures de l’application réelle.

Une nouvelle variante de couleur, un autre découpage ou un nouvel écran doit être présenté avant intégration. L’accord déjà obtenu pour les éléments décrits ici reste acquis ; il ne faut pas le redemander pour terminer leur intégration ou leur recette autorisée.

L’accord graphique et l’intégration ne valent pas publication sur GitHub, fusion dans main, déploiement ou validation de la recette sur le Docker Desktop du demandeur.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
