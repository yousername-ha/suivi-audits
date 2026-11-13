# Charte responsive — proportions adaptées à l’écran

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Consigne explicite du demandeur : l’adaptation à la taille de l’écran doit guider **toute l’application**, sans interface minuscule ni blocs géants. Cette exigence est acquise. Les chiffres et dispositions ci-dessous sont proposés pour l’illustrer ; leur validation visuelle reste attendue avant intégration.

**Priorité précisée ensuite : écrans de travail PC.** Le téléphone n’est pas important pour le lot en cours ; ses premiers rendus restent en annexe. La reprise confiée à Claude doit d’abord avancer sur portable, bureau, grand écran et fenêtre redimensionnée, sans bloquer sur une finition mobile.

## Règles communes

- La mise en page répond à la largeur **et à la hauteur** disponibles en pixels CSS. Respecter le zoom du navigateur, sa taille de texte et les appareils à forte densité ; ne pas déduire la taille physique de l’écran de sa seule résolution.
- Les zones de travail utilisent l’espace disponible. Les blocs de lecture longue gardent une largeur de ligne confortable ; les graphiques et registres peuvent s’étendre davantage. Une dalle ne devient pas une énorme surface vide parce qu’il reste de la place.
- Garder une taille de lecture stable : corps autour de 16 px, titres de lignes autour de 15–16 px, informations principales de 14–16 px, métadonnées et graduations lisibles autour de 12 px. Les titres de page sont bornés, autour de 26–36 px. Ces valeurs sont des références de maquette à traduire en unités relatives dans les composants existants ; les seuls petits textes décoratifs redondants, comme le mois dans le cercle de date, ne portent aucune information exclusive.
- Une petite icône garde une zone de clic confortable : environ 40 px sur ordinateur, 44 px sur écran tactile, avec nom accessible, info-bulle, focus et contraste. Le dessin de l’icône reste autour de 20 px. Épurer l’interface ne signifie pas réduire la taille du texte utile.
- Quand la largeur diminue, réorganiser les colonnes, passer des détails sous la ligne et regrouper les commandes secondaires. Ne pas appliquer de réduction globale par `transform: scale()`, de zoom CSS ou de tailles de police proportionnelles uniquement au viewport.
- Sur un grand écran, montrer davantage de données ou de colonnes en conservant des bornes pour les cartes, textes et boutons. Éviter les plafonds de largeur trop étroits pour les registres, tout comme l’étirement excessif d’une fiche de lecture.
- Les listes longues défilent dans leur zone avec leurs repères accessibles. En hauteur très contrainte ou en orientation paysage sur téléphone, autoriser le défilement de la page quand il évite d’écraser le contenu. Les longues fiches conservent la règle validée : hauteur naturelle, défilement du voile extérieur.
- Aucun champ, résultat, preuve, commentaire, filtre ou commande métier ne disparaît pour faire rentrer une vue. Les informations secondaires peuvent être regroupées et rester accessibles à la demande. Préserver les défauts déjà validés : Graphe des périmètres, Compact des objectifs, Timeline des Actions/Récurrences.

## Déclinaison dans les menus

| Surface | Adaptation attendue |
| --- | --- |
| Navigation | Menu complet si l’espace le permet, rail sur largeur intermédiaire, volet sur mobile. Préserver les noms accessibles et les raccourcis vers les rubriques. |
| Recherche / filtres / vues | Icônes lisibles sur ordinateur ; menu court de choix de vue sur mobile. Recherche et critères à la demande, critères actifs visibles. |
| Dashboard et dalles de synthèse | Nombre de colonnes adapté à l’espace, cartes de largeur bornée, chiffres proportionnés ; conserver les scores et indicateurs validés. |
| Périmètres | Cartes compactes avec texte lisible, graphe recentré et navigation dans son canevas ; dépliage en rectangle sans miniaturisation des libellés. |
| Objectifs / référentiels / DdA | Compact lisible, colonnes utiles et contrôles suffisamment larges ; repli des informations secondaires ou défilement local lorsque le registre dense le nécessite. Les dalles DdA restent présentes. |
| SWOT / PESTEL | Recalculer la géométrie avec l’espace disponible et réserver la place des libellés. Réorganiser les panneaux sur mobile en conservant les relations avec les processus. |
| Actions / récurrences | Timeline prioritaire ; rangées côte à côte sur ordinateur, intitulé et période sous forme empilée sur mobile. Réduire la répétition des graduations si nécessaire, jamais les valeurs ou leur précision métier. |
| Fiches et formulaires | Largeur de lecture bornée, champs réorganisés en colonnes selon l’espace ; boutons lisibles, aucune fenêtre géante ou texte réduit pour éviter un défilement nécessaire. |

## Validation et portée actuelle

[Maquette révisée et captures natives](propositions/responsive-equilibre/README.md), après la première [proposition de commandes discrètes](propositions/commandes-discretes/README.md). Les maquettes indépendantes ne démontrent pas une correction responsive de toute l’application.

L’application reste à `23b33b5ce4fd4cf5eeee0af97c9638b18852b61a` ; aucune modification applicative, aucun build/test applicatif et aucun nouveau paquet Docker pour cette proposition. Après validation des proportions, traiter les composants partagés puis chaque surface de la table, contrôler leurs vrais parcours et fournir les nouveaux visuels de l’application. Ne pas déclarer le chantier transversal terminé sur la seule base d’un écran.

La recette applicative devra couvrir portable 1 366 × 768, bureau 1 920 × 1 080, grand écran 2 560 × 1 440, écran très large, tablette, téléphone de 320–390 px et paysage. Ajouter les essais de zoom, clavier, textes longs et listes denses dans les écrans réellement intégrés ; ils ne sont pas présentés ici comme déjà exécutés sur l’application.
