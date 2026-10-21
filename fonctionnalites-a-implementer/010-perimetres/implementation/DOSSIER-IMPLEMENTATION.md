# 010 — Périmètres graphiques : dossier d’implémentation

Édition du 21 octobre 2026. **Inclus dans la transmission sur accord utilisateur explicite.** Référence : [v007 — fond uni](../maquettes/v007-fond-uni/README.md), avec les corrections cumulées. Ce classement n’atteste aucune intégration backend.

## Contrôle obligatoire de l’existant

Lire les [consignes communes](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md) et l’[ordre de codage](../../_dossiers-transversaux/implementation-ui-2026-10/ORDRE-IMPLEMENTATION.md). Vérifier chaque exigence sur la branche/SHA cible : code, API, permission, preuve de test, état et écart. **Conserver tout ce qui est déjà implémenté et vérifié ; compléter seulement le manque.** Les constats du snapshot historique ne remplacent pas cet audit.

## Demandes, règle retenue et recette

| ID | Demande / sujet | Règle retenue | Critère de recette sur la cible |
| --- | --- | --- | --- |
| 010-01 | Créer et gérer graphiquement les périmètres | Liste, graphe et sélecteurs partagent les objets et commandes existants, un UUID par périmètre. Aucun registre parallèle. | Créer et modifier depuis chaque vue ; retrouver le même ID après navigation et rechargement ; une seule mutation par opération. |
| 010-02 | Hiérarchie parent/enfant et référentiels | Réutiliser parentId et inheritFrameworks, exceptions locales et règles d’applicabilité. Pas de copie des résultats du parent. | Cycles, profondeur, parent inaccessible, arrêt/reprise de l’héritage, exceptions locales et droits testés côté serveur. |
| 010-03 | Fournisseur extérieur rattaché | Carte liée au registre fournisseurs existant, sur un ou plusieurs périmètres ; lien distinct, jamais enfant/parent implicite. | Même fournisseur et même ID depuis la carte et son registre ; impossible de le choisir comme parent. |
| 010-04 | Conformité sur les cartes | Taux issu du service métier avec couverture évaluées/applicables, provenance et détail par référentiel. Aucun taux inventé à partir des liens. | Non évalué, non applicable, partiel, plusieurs référentiels et données indisponibles ; agrégation des descendants explicite et autorisée. |
| 010-05 | Écarts sous la conformité | Section titrée Écarts ouverts : majeurs rouges, mineurs orange foncé, points sensibles violets ; nombre et libellé. | Ordre et couleurs vérifiés ; catégories serveur préservées ; clic vers la liste filtrée autorisée sans doublon. |
| 010-06 | Mini-tableau de bord compact | Quatre tuiles : BIA, PCRA, tâches en retard, actions en retard. Réutiliser les producteurs réels et confirmer la partition actions/occurrences. | Archives, statuts terminaux, échéances/fuseau, droits et objets partagés contrôlés ; accès manquant ≠ zéro ; clic avec le même ID périmètre. |
| 010-07 | Symétrie et dimensions | Parent centré sur ses enfants, cartes homogènes, fournisseur en colonne externe ; tuiles compactes sans agrandir les cartes. | Pas de chevauchement avec libellés longs, grands compteurs et arbre volumineux ; sélection et zoom conservés au rafraîchissement. |
| 010-08 | Liaisons dynamiques parent vers enfant | Flèche et flux SVG orientés ; ancrages recalculés lors des changements. Pause et mouvement réduit sans perte de sens. | Direction, création, redimensionnement, pause/reprise et prefers-reduced-motion ; aucune écriture métier déclenchée par animation. |
| 010-09 | Style et défilement | Style 08, fond uni sans points, icônes colorées ; menu fixe, zone graphique défilante, formulaires centraux avec bordure visible. | Clavier, focus, fenêtre centrale, écran étroit, thèmes et défilement indépendant ; alternative en liste accessible. |
| 010-10 | Registres transversaux | Registre associé à un ou plusieurs périmètres ; éléments hérités, filtres et droits cohérents. Aucun registre créé automatiquement avec le périmètre. | Même registre retrouvé depuis chaque périmètre autorisé ; déduplication et historique conservés ; pas de sélecteur indépendant sur l’élément. |
| 010-11 | Synchronisation et erreurs | Cache et invalidation partagés après succès, version serveur ; états chargement/vide/erreur/refus. Réutiliser le rafraîchissement entre sessions. | Double-clic, panne, 401/403/409/412/422 et concurrence : ni doublon ni fausse carte persistante ; saisie conservée ; deuxième session selon délai contractuel. |
| 010-12 | Protection et livraison | Ne pas modifier la cartographie dynamique historique. Classement implémenté seulement sur confirmation réelle du périmètre livré. | Non-régression du module protégé ; marqueur avec version, SHA et résultats, jamais pour cette seule maquette. |

## Références techniques et graphiques

Lire [les contrats inspectés](README.md), la [spécification détaillée](PERIMETRES-GRAPHIQUES.md), les [visuels et sources v007](../maquettes/v007-fond-uni/README.md) et les [tests historiques et limites](../tests/README.md). Les versions anciennes sont conservées pour l’historique ; la référence courante et les exigences ci-dessus prévalent.

Réutiliser les schémas SmsiCreate/SmsiUpdate, hiérarchie, services fournisseurs, annuaires, preuves, conformité et registres. Le snapshot 284cb1e4ffbaee37e0952073db5659c2257c888e expose GET/POST `/api/grc/smsis`, PATCH `/api/grc/smsis/:smsi` et If-Match ; recontrôler chemins, corps stricts, permissions et versionnement sur la cible avant toute mutation. Employer les queries, cache et composants du frontend réel. Pas d’API, de base de périmètres ou de moteur de conformité concurrent.

Les résultats de conformité, d’écarts, de BIA/PCRA et de retard sont des projections métier autorisées ; ni une formule dans le navigateur ni des compteurs fictifs ne prouvent leur disponibilité. Exclure toute donnée inaccessible avant agrégation. Le socle doit contrôler les accès et conflits indépendamment des boutons visibles.

## Dépendances et découpage

Réaliser d’abord liste/graphe, création et édition réciproques, hiérarchie, rattachements et états. Leurs contrats servent aux registres 017/021/018 et aux droits 022. La visualisation complète des compteurs vient après disponibilité des producteurs ; leur absence n’oblige pas à reconstruire BIA, PCRA ou la conformité. L’[ordre commun](../../_dossiers-transversaux/implementation-ui-2026-10/ORDRE-IMPLEMENTATION.md) est la seule référence pour les lots.

## Points à confirmer au SHA d’intégration

- Formule de conformité, pondérations, agrégations et traitement des états partiels : respecter la politique réelle ; la formule de démonstration n’est pas une règle ISO/HDS.
- Agrégat par périmètre et partition des retards : contrat complet non vérifié. Afficher indisponible si nécessaire et transmettre précisément le contrat manquant au responsable métier.
- Responsable de suivi : non présent dans le schéma strict inspecté ; ne pas envoyer de champ inconnu.
- Héritage d’applicabilité, droits et agrégations sont distincts. Ne pas déduire l’un de l’autre.
- L’agencement du prototype ne vaut pas un moteur de graphe validé pour les grands volumes ; vérifier lisibilité et performances sur la cible.

## Validation et remise

Exécuter chaque critère 010-01 à 010-12, les scénarios détaillés de la spécification et les contrôles adaptés du dépôt cible : build, typage, lint, tests, parcours de création/modification et refus, clavier/mobile, non-régression et synchronisation réelle. Les anciens contrôles Chromium portent sur des fixtures et ne sont pas des tests serveur.

Livrer le relevé d’existant par exigence, les seuls écarts corrigés, branche/SHA, commandes et résultats, captures et blocages. Suivre le [prompt dédié](PROMPT-IMPLEMENTATION.md). Un marqueur « implémentation ok » doit confirmer le périmètre réellement intégré et vérifié ; aucun marqueur n’est créé par cette transmission. Pas de ZIP/BAT, ni modification de Claude ou de la cartographie dynamique historique.
