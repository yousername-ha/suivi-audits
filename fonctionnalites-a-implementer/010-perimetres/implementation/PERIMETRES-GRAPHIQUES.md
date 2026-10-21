# 010 — Spécification détaillée v007

**Référence de transmission v007. Source de rendu de maquette, pas code de production.**

Le [dossier courant](DOSSIER-IMPLEMENTATION.md) et le [prompt dédié](PROMPT-IMPLEMENTATION.md) imposent le contrôle de l’existant et complètent cette spécification.

## Objets et source unique

La liste, le graphique et les sélecteurs de la plateforme représentent les mêmes périmètres. Ils n’ont pas deux bases à synchroniser. Chaque création passe par la commande existante `POST /api/grc/smsis`, renvoie un identifiant canonique et l’ajoute au cache partagé. Chaque modification utilise `PATCH /api/grc/smsis/:smsi` avec la version `If-Match` et les champs stricts, dont `confirm: ENREGISTRER`. Réutiliser le client existant et ses conventions, sans créer de route « cartographie périmètres » concurrente.

En production, les adaptateurs liste et graphique consomment la même requête de collection accessible. Après mutation réussie, mettre à jour/invalider les clés réellement utilisées par la liste, le graphique, les détails et les sélecteurs globaux ; ne pas inventer des noms de clés sans lire le frontend cible. La vue suivante doit retrouver l’objet par son UUID, pas par son libellé. Aucun effet réciproque ne doit déclencher une seconde création ou une boucle de mutations.

Un succès serveur rend le périmètre disponible pour les rattachements autorisés de la plateforme. Il ne crée pas automatiquement un registre d’écarts, un risque, une action ou une preuve. Les référentiels suivent `inheritFrameworks` et les exceptions locales du socle. L’héritage ne copie pas les évaluations des parents.

Un échec de création ne laisse pas une carte persistante fictive. Une création en attente est identifiable et ne se soumet pas deux fois. Traiter les erreurs réseau/401/403/412/422 et conserver les saisies utiles. Après rechargement, relire les données serveur ; pour les autres sessions, réutiliser le mécanisme d’événements/refetch existant et définir sa latence attendue.

## Fournisseurs

Le fournisseur est un objet distinct du registre fournisseurs, identifié par son ID existant, associé à un ou plusieurs périmètres. Il n’appartient pas à la collection de périmètres et n’est pas proposé comme parent. Sa carte ouvre la fiche du même fournisseur dans la gestion des fournisseurs, avec le contexte courant si nécessaire. La ligne pointillée représente le rattachement du service. Aucun héritage ou droit implicite n’en découle.

## Conformité

Le contrat de production de l’indicateur doit provenir du domaine métier confirmé. Ne pas substituer un taux de liens documentaires, de couverture de rapprochements, d’actions clôturées ou de preuves à un taux de conformité.

Convention de démonstration : `100 × conformes / évaluées`, arrondie à l’entier ; afficher aussi `évaluées / applicables`. À zéro évaluée, afficher « Non évalué ». Les exclusions/non-applicables sont hors du total applicable ; les états partiels, les pondérations et la consolidation inter-référentiels restent à vérifier avec la politique métier. Le total illustré somme les effectifs des exigences de chaque référentiel, pas les pourcentages. Ne pas présenter cette convention comme une formule officielle ISO/HDS.

Montrer la provenance, la date et le détail par référentiel. Un parent affiche ses résultats propres ; le cumul des descendants doit être un mode explicite, autorisé et dédupliqué selon les objets réellement évalués. Le fournisseur affiche ses critères satisfaits/évalués et sa couverture, distincts d’une certification et des taux du périmètre.

## Composition et interactions

Style 08 : fond clair sauge, menu vert profond fixe, icônes colorées, accents turquoise/bleu. Registres partagés en barre horizontale ; parent centré entre ses enfants, cartes de largeur uniforme, fournisseur dans une colonne externe séparée. Les fenêtres sont centrées avec bordure visible. Liste défilante à en-têtes fixes ; graphique défilant dans sa propre zone ; le contenu principal défile sans déplacer le menu.

La maquette v005 calcule un agencement d’arbre et mesure les dimensions des cartes pour ancrer les liaisons. L’intégration doit adapter l’agencement au nombre de nœuds et aux dimensions des cartes, éviter les collisions, préserver sélection/zoom au rafraîchissement et proposer une liste accessible comme alternative. Les positions de présentation éventuelles ne remplacent jamais les relations métier. Le module historique de cartographie dynamique reste inchangé.

## Recette d’intégration exigée

1. Depuis la liste, créer un périmètre : une seule écriture et un seul UUID ; carte, liste et sélecteurs le retrouvent après navigation puis rechargement.
2. Depuis le graphique, créer un enfant : même comportement dans la liste et les autres modules autorisés ; contrôle du parent et des droits côté serveur.
3. Modifier depuis chaque vue : les deux reflètent la même version. Tester conflit de version, saisie invalide et refus d’accès, sans double mutation ni perte silencieuse.
4. Vérifier cycles, profondeur, parent inaccessible, référentiels hérités et exception locale ; aucun héritage de résultats ni de droits non prévu.
5. Ouvrir le fournisseur depuis sa carte puis son registre : même ID, mêmes rattachements ; absent des parents de périmètres.
6. Vérifier les taux avec cas non évalué, non applicable, partiel, référentiels multiples et absence de données. Distinguer résultat de conformité et couverture.
7. Vérifier données volumineuses, disposition sans chevauchement, défilement, mobile, navigation clavier, focus des fenêtres et lecteur d’écran.
8. Tester le mécanisme réel de rafraîchissement dans une seconde session selon le contrat retenu. Les tests de maquette actuels ne couvrent pas cette étape.

## Consignes complémentaires pour l’IA de codage

Travaille uniquement sur ta branche attribuée. Lis les instructions globales et la version validée de 010 sur legacy en lecture seule. Réutilise les services, schémas, permissions et composants existants du commit cible. Implémente les vues Liste et Graphique sur une collection et des mutations communes ; raccorde les cartes fournisseur au registre existant ; n’invente ni moteur de conformité ni doublon de périmètre. Respecte les visuels, états et cas de recette ci-dessus. Documente les contrats manquants et les tests réellement exécutés. À livraison terminée, crée sur ta branche `implementation/IMPLEMENTATION-OK.md`, en identifiant la fonctionnalité, la version livrée, la branche/SHA, les contrôles et les limites. Ne modifie pas legacy ni l’espace Claude. Codex lira ce marqueur pour déplacer le dossier documentaire vers « implémentées ».

## Flux et mini-tableau de bord — incrément v005

Les chemins SVG sont orientés du centre bas de la carte parent vers le centre haut de l’enfant. Une base et une pointe de flèche restent visibles ; une couche à tirets se déplace vers l’extrémité du chemin. Recalculer les ancrages après création, redimensionnement ou changement de dimensions. L’animation ne déclenche aucune mutation métier. Prévoir pause/reprise et `prefers-reduced-motion` ; maintenir les informations de sens sans mouvement. Le lien fournisseur reste distinct de la hiérarchie.

Les quatre compteurs, propres au périmètre, sont cliquables et ouvrent les listes du module concerné filtrées avec le même ID de périmètre. Filtrer les archives et appliquer les autorisations avant de compter. Afficher chargement, erreur ou indisponibilité explicitement ; une absence d’accès ne vaut pas zéro.

- BIA : objets `bia` non archivés, états brouillon/revue/validé compris dans « existants ».
- PCRA : plans `continuity_plan` non archivés de type `pcra`, sans fusion arbitraire avec les autres types de plans.
- Tâches en retard : occurrences récurrentes échues et non terminales ; utiliser la relation de série existante, l’échéance réelle et le statut métier.
- Actions en retard : actions échues non terminales hors occurrences récurrentes, pour éviter le double comptage entre les deux tuiles. Confirmer cette partition au raccordement aux registres réels.

Aucun héritage implicite des comptes, aucun recalcul de conformité à partir des retards. Vérifier les dates aux limites de fenêtre et dans le fuseau métier, les actions terminées en retard, les échéances absentes, l’archivage, les objets partagés et les droits d’accès. Les tests actuels vérifient les filtres sur des données fictives à date fixe ; les contrôles API/permissions et les listes réelles restent à exécuter lors du codage.

## Écarts et compacité — v006

Placer la section titrée « Écarts ouverts » directement sous le taux de conformité et avant les quatre tuiles BIA/PCRA/retards. Conserver les trois catégories métier distinctes : écarts majeurs en rouge `#B4233C`, mineurs en orange foncé `#A34608`, points sensibles en violet `#7040A6`, sur fonds respectifs `#FFEDEF`, `#FFF0E5`, `#F3EBFC`. Afficher nombre et libellé ; ne pas convertir un point sensible en non-conformité mineure. Appliquer ces couleurs aux badges, au détail et à la légende, sans modifier les catégories du backend.

Les quatre tuiles BIA/PCRA/retards sont compactées, icône et valeur alignées avec le libellé, hauteur minimale 36 px. Aucun agrandissement de carte pour ajouter la troisième catégorie. Référence mesurée : cartes de périmètre de 300 px de largeur, 12 px moins hautes que v005 ; fournisseur de 280 × 241 px (1 px moins haut). Préserver les cibles clavier, le focus visible et les libellés accessibles. Tester l’absence de débordement avec les volumes réels de compteurs avant intégration.

## Fond — v007

Fond uni `#FCFDFB`, sans grille de points ni image de fond. Conserver la teinte sauge des zones d’organisation et les traits de liaison.
