# Responsive — lecture et proportions équilibrées

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Proposition révisée, à valider visuellement avant intégration**, après le retour sur les éléments trop petits de la maquette de commandes. L’exigence d’une adaptation à la taille de l’écran concerne toute l’application et figure désormais dans [la charte commune](../../CHARTE-RESPONSIVE.md) et [AGENTS.md](../../../../AGENTS.md). Cette exigence ne vaut pas validation automatique de ces nouvelles proportions.

**Priorité demandée ensuite : PC, le téléphone n’est pas important.** Les visuels portable/bureau/grand écran et les fichiers de cette proposition sont transmis dans le dossier de reprise Claude. Les premiers rendus mobiles ci-dessous restent des annexes ; aucune nouvelle finition mobile ne bloque la livraison.

Le code applicatif reste à `23b33b5ce4fd4cf5eeee0af97c9638b18852b61a`. La maquette de commandes précédente `d72f05f` reste disponible, avec ses références. **Aucun fichier applicatif, API, base, dépendance ou Docker modifié ; aucun build ni test applicatif et aucun nouveau ZIP.**

## Ce qui change dans la proposition

- Lecture plus confortable : intitulés de 15–16 px, informations usuelles de 14–16 px, métadonnées et graduations autour de 12 px. Titres et chiffres bornés ; aucune réduction globale de la page.
- Icônes d’environ 20 px avec zones de clic de 40–44 px. La recherche et les filtres restent à la demande. Sur mobile, le choix de vue et la période passent dans des menus courts plutôt que d’entasser des commandes minuscules.
- Les registres utilisent la largeur disponible sur grand écran ; leurs textes et cartes conservent des tailles bornées. La largeur des intitulés de Timeline reste limitée pour éviter des cartes énormes.
- La hauteur disponible sert à la liste. Sur portable peu haut, les rubriques rejoignent le bandeau supérieur. Sur mobile, la Timeline place l’intitulé au-dessus de sa période ; les graduations sont abrégées et leur répétition diminue selon l’échelle, sans changer les dates ou les occurrences.
- Menu complet, rail ou volet selon la place ; maintien de la vue lors d’un redimensionnement. Les longues listes défilent dans leur zone. En paysage très peu haut, la page peut défiler pour conserver la lisibilité.

Le prototype reprend les données fictives et les fonctions de démonstration de `commandes-discretes`, via ses fichiers statiques voisins. Les noms complets restent présents dans les textes accessibles et les titres des libellés abrégés. La consultation réelle, les preuves, commentaires, validations, droits et historiques déjà intégrés ne sont pas remplacés par les formulaires illustratifs de la maquette.

## Captures natives

Ces images sont enregistrées à **une taille de pixel par pixel CSS**, sans agrandir artificiellement la résolution. Les ouvrir à 100 % pour évaluer la taille de lecture ; une image large réduite par la messagerie peut donner une impression de texte plus petit.

| Écran | Aperçu |
| --- | --- |
| Portable 1 366 × 768 | [Timeline claire](portable-1366-clair.png), [liste compacte](liste-portable-1366-clair.png) |
| Bureau 1 920 × 1 080 | [Timeline claire](bureau-1920-clair.png), [Kanban](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/responsive-equilibre/kanban-1920-clair.png) |
| Grand écran 2 560 × 1 440 | [Timeline sombre](grand-ecran-2560-sombre.png) |
| Tablette 1 024 × 768 | [Interface claire](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/responsive-equilibre/tablette-1024-clair.png) |
| Mobile 390 × 844 | [Clair](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/responsive-equilibre/mobile-390-clair.png), [sombre](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/responsive-equilibre/mobile-390-sombre.png), [récurrences](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/responsive-equilibre/recurrences-mobile-sombre.png) |
| Commandes mobiles | [Choisir la vue](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/responsive-equilibre/choix-vue-mobile.png), [filtres](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/responsive-equilibre/filtres-mobile-clair.png) |

[Ouvrir la maquette](index.html) depuis un serveur statique à la racine du dépôt. Aucun rendu généré ou retouché. Le défilement de la liste permet d’atteindre les éléments hors cadre ; la capture ne déroule pas artificiellement toute la page.

## Contrôles et limites

Les vérifications concernent uniquement les surfaces représentées dans cette maquette, pas une intégration responsive de tous les menus. [Rapport final](controles.json) et [dimensions et empreintes des médias](medias.json). Node 26.13.0, Chromium système, fichiers statiques locaux, situation fictive au 11 novembre 2026 ; aucun service métier utilisé.

[Contrôle complémentaire PC](controles-pc.json) après l’ajustement des références de liste, codes Kanban et compteurs du menu à une taille et un contraste plus lisibles.

Les essais de rendu couvrent les deux thèmes et des largeurs de 320 à 3 840 px, des hauteurs de 390 à 2 160 px, le défilement propre à la liste, les panneaux, le menu mobile de vues, les échelles, les filtres et le redimensionnement sans rechargement. Le cas d’un écran où toutes les données tiennent ne nécessite aucun défilement. Les journaux et scripts intermédiaires restent privés.

Les zooms du navigateur et les volumes métiers réels n’ont pas été vérifiés sur l’application. La couverture des autres surfaces et graphiques, dont les SVG à géométrie propre, reste à traiter à l’intégration selon la charte, avec les contrôles adaptés. Aucun résultat de ce prototype n’est attribué aux tests applicatifs antérieurs.

**Prochaine étape : avis explicite sur les proportions proposées ; après validation, intégration des composants communs puis revue des écrans concernés, tests et captures réelles.**
