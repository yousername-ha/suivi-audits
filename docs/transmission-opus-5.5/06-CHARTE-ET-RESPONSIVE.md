# Charte de portage et adaptation aux écrans

## Famille graphique commune

La refonte combine blanc/lavande clair et bleu nuit, cadres présents et nets, couleurs sémantiques lisibles, SVG précis et relief discret. Le violet reste une couleur d’accent, particulièrement la cible d’indicateur ; il ne doit pas recouvrir toute l’application. Les champs Total/Partiel/Insuffisant et Oui/Non gardent une différenciation explicite verte/orange/rouge et des libellés. La couleur seule ne porte jamais une information utile.

Inter est chargée localement, avec repli système. Les intitulés d’objectifs, d’exigences et de fiches restent des textes de lecture nets ; pas de soulignement ou couleur de lien quand l’élément n’est pas un lien. Les vraies commandes conservent leurs noms accessibles, focus et information de rôle. Les nouvelles valeurs de style doivent résider dans `packages/ui` ou l’équivalent de la charte cible, jamais être disséminées dans les props JSX pour contourner un test de charte.

Les cartes Studio arrondies et légèrement en relief ne sont pas remplacées globalement par le Biseau. Biseau et animations du Contexte restent retenus ; l’identité des lots DDA/Objectifs/Périmètres et SWOT/PESTEL reste distincte mais cohérente. Les fortes lueurs des premiers essais ont été atténuées. Les icônes du menu final n’utilisent ni carré brillant ni raster flou.

## Disposition et densité

La cible est la taille de l’écran en pixels CSS ET sa hauteur, pas une taille physique déduite de la résolution. Réorganiser, répartir les colonnes et déplier les détails, sans `zoom` CSS ni `transform:scale()` de toute l’interface. Sur écran large, afficher davantage d’éléments sans gonfler indéfiniment les cartes. Sur portable, conserver la lisibilité et la hauteur utile.

Références de lecture à traduire dans les tokens existants : corps 14–16 px, lignes principales 15–16 px, métadonnées/graduations utiles autour de 12 px, titres de page bornés autour de 26–36 px. Le menu final garde son gabarit approuvé propre. Les commandes par petites icônes conservent une zone de clic confortable (environ 40 px PC), un nom accessible et un focus visible. Respecter les préférences de taille, densité et le zoom 150 %.

Défauts acquis : Graphe des périmètres avec cartes repliées ; Compact des objectifs ; Timeline des Actions et Récurrences ; compact de Fournisseurs ; cartes Processus ; panorama Parties. Ces défauts ne doivent pas effacer une préférence métier déjà enregistrée ou une disposition personnelle de Dashboard.

## Deux règles de défilement différentes

| Surface                                           | Comportement                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Registres/listes/Timeline avec beaucoup de lignes | Zone de travail locale défilante et en-têtes visibles ; pagination/chargement conservés, pas toute la page allongée                   |
| Fiche de consultation ou formulaire long          | Hauteur naturelle ; voile extérieur défile pour atteindre titre et boutons, pas de second ascenseur du corps de fenêtre               |
| Dalle de graphe Périmètres                        | Pas d’ascenseur intérieur ; repli, dépliage horizontal, mesure des dimensions et recalcul des liens                                   |
| Sélecteurs/textes multiligne/graphes larges       | Garder les interactions et défilements intrinsèques nécessaires ; ne pas cacher les scrollbars pour masquer un problème de dimensions |

## États et données

Prévoir titres longs, une/deux lignes, listes chargées vs totaux serveur, texte ancien non classé, références inconnues, droits partiels et absence de données. Une donnée indisponible n’est ni zéro, ni absence avérée d’objet. Aucun champ ou bouton métier ne disparaît uniquement pour faire rentrer une capture.

Les animations restent décoratives ou reproduisent un état réellement fourni ; pause et préférence de mouvement réduit partout. Conserver accès clavier, retour de focus et gestion des commandes imbriquées. Le retrait d’une grosse barre de recherche signifie une commande discrète accessible, pas la disparition de ses critères.

## Grille minimale de recette PC

1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 1920×800 et 2560×1440 ; clair/sombre et zoom 150 %. Tester la hauteur avant de conclure qu’un écran est adapté. Le téléphone n’est pas prioritaire pour ce lot ; préserver le comportement existant, ne pas bloquer la reprise sur une finition mobile.

Les anciennes captures 390 px sont des preuves historiques disponibles, pas une demande de nouveau chantier mobile.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
