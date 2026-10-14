# Contrat technique du prototype v2

Prototype autonome HTML/CSS/JavaScript, sans framework, API, compte réel ou service distant. Il s’ouvre par `index.html`. Les scripts classiques et styles sont des fichiers relatifs ; aucune requête `fetch`, aucun module ES ni CDN n’est requis.

## Fichiers

- `index.html` : structure, menu, modale et chargement des ressources.
- `base.css`, `prototype.css` : style 08, variantes, composants, états sélectionnés et adaptation mobile.
- `seed.js` : données exclusivement fictives et échelles structurelles de démonstration.
- `app.js` : navigation, formulaires, relations, validations simplifiées, journal, stockage et exports.
- `DEMARRER.bat` : ouvre le fichier HTML dans le navigateur Windows.
- `TESTS.json` : contrôles réellement exécutés et limites de vérification.
- `verification/parcours.cjs` : recette navigateur reproductible pour le développeur ; nécessite Node, Playwright et Chromium (`CHROMIUM_EXECUTABLE` si chemin différent).

## Comportements démontrés

Une seule destination principale par fonction, sept familles métier et Administration séparée. Le rôle métier d’un accès contextuel n’est pas transformé en un second registre. Les modules secondaires utilisent un écran générique de fiches et ne démontrent pas leur moteur spécialisé.

Les objets de catalogue sont référencés par identifiant dans les études. Une fiche référencée ne peut pas être archivée depuis ce prototype. Les livrables des cinq ateliers appartiennent à l’étude active. Les changements des livrables amont invalident les validations des étapes dépendantes.

La pertinence des couples utilise les neuf cellules d’une version de matrice épinglée. Les matrices de pertinence et de risque sont séparées ; le barème de risque du prototype est explicitement fictif. Une adoption de configuration est volontaire et conserve le contexte précédent avec ses couples. Les nouvelles versions de configuration ne remplacent pas leurs antécédents.

Les chemins opérationnels sont deux variantes pédagogiques, avec cinq nœuds éditables et quatre colonnes. La topologie n’est pas un éditeur de graphe arbitraire. Les flèches utilisent un marqueur SVG orienté et un décalage de tirets CSS ; `prefers-reduced-motion` conserve flèches et contours sans mouvement.

Les actions et les évaluations résiduelles restent distinctes. L’historique local des évaluations et décisions permet de tester leur séparation ; il ne remplace pas l’immutabilité ou l’audit serveur de l’application réelle.

## Persistance

État métier fictif : `localStorage['astra-grc-prototype-v2']`. Sélection d’étude et atelier : clé séparée terminée par `-ui`. La sauvegarde JSON emporte les données fictives, configurations et historiques. La restauration vérifie la structure, les plages de niveaux et des références essentielles, puis demande confirmation avant remplacement.

En cas de sauvegarde illisible ou de stockage indisponible, le prototype ne remplace pas silencieusement l’ancien état : il signale la situation et propose l’export. Une restauration ou une remise à zéro explicite permet de repartir. La persistance `file://` dépend du navigateur et du chemin : utiliser l’export avant déplacement ou changement de PC.

## Limites à conserver dans le dossier d’implémentation

Aucune sécurité serveur, authentification, isolation inter-organisations ou migration de production n’est implémentée par ce ZIP. Les contrôles sont de démonstration et ne sont pas une validation exhaustive de la méthode. Les imports XLSX ARM, les méthodes autres qu’EBIOS, la topologie libre du graphe et les moteurs spécialisés des modules secondaires restent à concevoir/implémenter selon le dossier technique validé.

La cartographie dynamique est exclue du prototype et ses sources restent inchangées. L’application legacy et les fichiers des autres intervenants n’ont pas été modifiés. Cette version est publiée pour téléchargement et test ; elle reste à valider. La publication du ZIP ne vaut pas validation de la maquette.
