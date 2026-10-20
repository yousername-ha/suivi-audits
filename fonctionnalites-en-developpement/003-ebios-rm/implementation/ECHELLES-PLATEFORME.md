# Échelles communes — Risques et EBIOS RM

Demande du 20 octobre 2026 : utiliser les échelles déclarées dans Paramètres plateforme. Proposition fonctionnelle [v002](../maquettes/v002-echelles-plateforme/README.md), à valider. Le module 002 utilise le même principe ; aucune nouvelle définition d'échelle propre aux risques.

## Règles et parcours

1. Déclarer/modifier une échelle depuis Paramètres plateforme → Échelles d'évaluation. Un brouillon n'est pas proposé aux études. Publier crée une version et ne réécrit pas les précédentes.
2. Associer explicitement les rôles de cotation aux échelles applicables : gravité/impact et vraisemblance/probabilité dans la proposition. Les noms sont des rôles d'interface, pas une équivalence automatique entre méthodes. Le choix d'une échelle de sévérité pour un rôle doit être autorisé par la configuration métier réelle.
3. Afficher niveaux, ordre, libellés, valeurs, couleurs et critères depuis la version choisie. Ne pas imposer quatre niveaux ou recréer des tableaux locaux fixes. La démonstration vérifie le passage 4 × 4 → 5 × 4.
4. Enregistrer identifiant d'échelle, version et identifiant du niveau avec la cotation. La nouvelle publication est disponible pour sélection explicite ; aucune migration silencieuse de l'étude ou de ses évaluations.
5. L'historique restitue les libellés et références de la version utilisée. Un archivage retire les nouveaux usages ; conserver la lecture des références historiques. Un retrait de niveau ne casse pas les évaluations antérieures.
6. Les critères spécifiques d'autres ateliers (par exemple pertinence des couples SR/OV) doivent être raccordés aux configurations réelles de ces objets, sans réutiliser automatiquement la gravité ou imposer une formule. Cette livraison ne construit pas leur formulaire métier.

La vue fournit des accès depuis les étapes de gravité de l'atelier 1 et de vraisemblance de l'atelier 4. Un contexte « Registre des risques » réutilise le même composant de cotation ; ce sélecteur est illustratif, pas une création d'objet serveur. Les échelles de l'étude n'affectent pas les exemples pédagogiques ANSSI, explicitement séparés dans la navigation. Les anciens graphiques et animations restent accessibles ; la cartographie dynamique applicative n'est pas modifiée.

## Matrice et résultats

Les axes reprennent les versions choisies. Les niveaux de criticité et les couleurs des cellules appartiennent à la **matrice/politique publiée** compatible avec ces versions, pas à un produit implicite des scores ni aux couleurs des axes. Dans cette maquette, la grille est volontairement neutre et porte « Criticité non calculée » tant qu'aucune matrice compatible n'est raccordée. La matrice colorée validée de 002 reste la référence graphique lorsque ce contrat existe.

La sélection de niveaux et son enregistrement ne constituent ni une évaluation serveur publiée, ni une acceptation, ni un calcul du risque résiduel. Réutiliser le service d'évaluation et les décisions existantes. Une nouvelle configuration doit déclencher la vérification des correspondances et des matrices avant adoption.

## Contrats existants inspectés en lecture seule

Snapshot Claude : `284cb1e4ffbaee37e0952073db5659c2257c888e`. Fichiers `apps/api/src/routes/config-grc.ts`, `grc.ts`, `risk-assessments.ts`. Ce constat ne décrit pas une branche plus récente ni une intégration testée.

- `GET /api/config-grc/items` : catalogue filtrable par kind/state/scope/smsi/family/category/q. `GET /api/config-grc/items/:id` : brouillon, versions, usages.
- `PUT /api/config-grc/items/:id/draft` : If-Match ; `POST .../:id/preview` : validation et analyse d'impact ; `POST .../:id/publish` : previewId, motif, confirmation PUBLIER et version/If-Match. Réutiliser ce parcours complet en production ; le bouton de publication locale ne le remplace pas.
- Lecture du catalogue et mutations : permissions contrôlées par le service ; notamment publication/archivage/suppression sous `parametres:administrer`. L'utilisateur d'une étude n'obtient aucun droit d'administration parce qu'il peut sélectionner une échelle.
- `GET /api/grc/:smsi/risk-studies/:id` : étude et objets par atelier. Évaluations : `/api/grc/:smsi/risks/:id/preview`, `/evaluate`, `/evaluations`. Conserver politiques, versions et décisions du serveur.

Le binding exact des rôles, la compatibilité méthode/famille, les versions de configuration d'étude et le schéma de publication de cotation doivent être confirmés dans les services partagés avant codage. Ne pas envoyer les structures fictives de cette maquette comme si elles étaient le contrat serveur. Aucun nouvel endpoint concurrent prescrit.

## Limites de la démonstration

Le fichier partagé `_prototype-transversal/catalogue-echelles-v1.js` est un adaptateur **de fixtures uniquement**. Il initialise trois exemples organisationnels, puis partage les versions publiées par localStorage entre 012 v007 et 003 v002. L'origine HTTP doit être identique et autoriser le stockage. Ouvrir des fichiers séparément avec `file://` ne garantit pas ce partage. Le rechargement conserve les publications et l'historique local ; les brouillons et sélections non enregistrés ne sont pas persistés. Les autres paramètres de 012 gardent leur comportement antérieur.

Aucune garantie de concurrence multi-utilisateur, intégrité inviolable, droits serveur ou isolation des organisations n'est fournie par localStorage. En production, remplacer l'adaptateur par le catalogue existant ; ne pas déployer ce stockage comme source métier. Ne pas importer le jeu fictif par défaut dans une organisation réelle. Cas de stockage indisponible : publication/enregistrement signalés comme échoués.

## Recette

[21 contrôles locaux](../maquettes/v002-echelles-plateforme/technique/verification.json) : sélection explicite, catalogue partagé, synchronisation cellule/niveaux, justification, brouillon exclu, publication v2, 5 × 4, historique v1 préservé, archivage, accès ateliers 1/4, scénario existant, mobile et absence d'erreur JavaScript.

Reste à vérifier avec backend : permissions et périmètres, conflits If-Match, compatibilité des configurations, historique réellement immuable, publication d'évaluation, matrices versionnées, données importées et migration explicite des études. Dossier en développement ; aucun marqueur d'implémentation créé.
