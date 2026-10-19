# 010 · Périmètres — v004

**Proposition visuelle à valider · 19 octobre 2026.** Données fictives. Aucun ZIP/BAT, aucune intégration backend.

Cette version reprend v003 et les précisions utilisateur : fournisseur externe rattaché, pourcentage de conformité sur les cartes, composition plus symétrique et création/modification réciproques entre liste et graphique.

## Aperçus

### Graphique symétrique, conformité et fournisseur externe

[Ouvrir l’image](visuels/01-cartes-conformite.png)

![Graphique symétrique, conformité et fournisseur externe](visuels/01-cartes-conformite.png)

### Détail du taux de conformité

[Ouvrir l’image](visuels/02-detail-conformite.png)

![Détail du taux de conformité](visuels/02-detail-conformite.png)

### Fiche du registre des fournisseurs

[Ouvrir l’image](visuels/03-fiche-fournisseur.png)

![Fiche du registre des fournisseurs](visuels/03-fiche-fournisseur.png)

### Liste : les mêmes périmètres que le graphique

[Ouvrir l’image](visuels/04-liste-memes-perimetres.png)

![Liste : les mêmes périmètres que le graphique](visuels/04-liste-memes-perimetres.png)

## Comportements de la maquette

- Un seul tableau de périmètres alimente les cartes, la liste et les sélecteurs. La création et la modification sont disponibles depuis les deux vues ; elles conservent le même identifiant, sans copie.
- Le fournisseur A est une fiche distincte `SUP-001` du registre fournisseurs, rattachée au périmètre A. Il n’est ni enfant, ni choix de parent, ni périmètre du registre. Sa carte et l’entrée de menu ouvrent la même fiche de démonstration.
- Le parent et les deux enfants sont centrés et alignés ; les registres partagés forment une barre horizontale. Menu fixe, fenêtres centrées et zones défilantes sont conservés.
- Chaque carte affiche un taux et une couverture d’évaluation. Le détail distingue les référentiels. « Non évalué » remplace un pourcentage lorsque le dénominateur est nul.
- Les évaluations appartiennent au périmètre : l’héritage d’un référentiel n’hérite pas de son résultat. Le taux parent n’est pas une moyenne implicite des enfants.

## Sens des nombres affichés

Les taux sont **des exemples de rendu**, pas des résultats réels ni une règle normative validée. Pour illustrer la différence entre conformité et couverture, la maquette calcule `conformes / évaluées`, et montre séparément `évaluées / applicables`. Les non-applicables sont hors du dénominateur. Les arrondis se font à l’entier ; le total utilise les effectifs, pas une moyenne des pourcentages.

Exemple A : 70 conformes sur 80 évaluées donne 88 % ; 80 exigences sur 100 applicables sont évaluées. Le fournisseur utilise ses propres critères : 8 satisfaits sur 10 évalués, parmi 12 critères. Il ne s’agit pas d’une certification ISO/HDS. La formule de production, les états partiels et la consolidation inter-référentiels restent à aligner sur la politique métier confirmée.

## Limites

Source HTML/CSS/JS isolée, état en mémoire et remise à zéro au rechargement. Les tests démontrent la réciprocité **dans la maquette**, pas la disponibilité dans les modules réels, ni la synchronisation multi-session. L’intégration doit passer par le service, le cache et les identifiants de périmètres existants.

La cartographie des périmètres est propre à 010 ; le module de cartographie dynamique protégé n’a pas été modifié. Les autres modules sont des repères de navigation. Aucun déplacement de fonctionnalité : la version v004 reste à valider, et aucun marqueur local de livraison n’a été trouvé.

[Spécification technique préparatoire](../../implementation/PERIMETRES-GRAPHIQUES.md) · [Contrats vérifiés](../../implementation/README.md) · [Contrôles exécutés](technique/verification.json).
