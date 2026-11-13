# Docker de test des interfaces Neon

11 novembre 2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

La demande « Augmente l’intensité de l’animation. Puis fais-moi le zip qui reprend tout mais enlève l’interface de connexion » autorise l’intégration des propositions Actions / Récurrences / Timeline adaptative et la création de ce profil de test. Les autres propositions Organisation non approuvées restent indépendantes.

## Démarrage sur Docker Desktop

Extraire le ZIP, puis ouvrir PowerShell dans le dossier contenant `docker-compose.ui-test.yml` :

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml up -d --build
```

Ouvrir **http://localhost:5174**. La construction installe les dépendances figées et compile l’application ; le premier démarrage charge les données fictives ; attendre que le conteneur `api` soit prêt. L’interface s’ouvre directement, sans création de compte, identifiant, mot de passe ou second facteur à saisir. Le bandeau « Test interfaces · données fictives » identifie cette instance. Les routes de connexion et d’installation ramènent à l’application.

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml ps
docker compose -p neon-interface-test -f docker-compose.ui-test.yml logs --tail=50 api
```

Pour remplacer les sources par une nouvelle livraison, conserver les données et relancer :

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml up -d --build --force-recreate api
```

Arrêter sans effacer les essais :

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml stop
```

## Contenu

Les sources complètes reprennent les intégrations DdA, périmètres compacts avec dépliage horizontal, objectifs compacts, référentiels, SWOT au centre agrandi et PESTEL, puis Actions / Récurrences Studio. La Timeline devient la vue initiale ; liste compacte, Kanban, calendrier, Gantt, synthèse et fiches métier restent accessibles. Le registre des séries et les modèles proposés sont dans « Séries et réglages ».

Les statuts orange ont un halo renforcé de 2,2 secondes : liseré de 5 px et lumière diffuse, sans déplacer les dates ni faire clignoter les textes. La pause et la réduction des mouvements du navigateur restent prioritaires. En récurrence, Auto suit la série choisie ; journalier, hebdomadaire, mensuel et annuel utilisent leurs vraies bornes calendaires. Les dates hors horizon, les fiches sans échéance et les incohérences restent accessibles. Les repères proches s’étagent sans défilement interne. Les descriptions se déplient en trois zones avant l’ouverture de la fiche complète.

Les séries fictives supplémentaires illustrent les quatre périodicités, dont une annuelle en pause sans occurrence inventée. Le moteur métier existant génère leurs occurrences.

## Isolation du profil

- Seul le port web `127.0.0.1:5174` est publié ; API et PostgreSQL restent à l’intérieur de Docker.
- Projet `neon-interface-test`, base `suivi_interfaces`, volumes nommés propres : aucune utilisation de `.donnees-dev` ni des comptes de l’ancien Docker.
- Un seul conteneur applicatif lance l’API et le frontal compilé Node ; PostgreSQL reste séparé. Les deux processus s’arrêtent ensemble.
- L’entrée spéciale accepte uniquement les noms de base dédiés au test, avec un suffixe de recette daté possible, et refuse une base occupée sans son identité de démonstration. L’identité, les clés et la vraie session sont générées localement au premier lancement, conservées dans les volumes, jamais fournies dans le ZIP.
- Le frontal de ce seul profil présente cette session locale à l’API. CSRF, droits, validations et versions de l’API restent actifs ; aucune garde ni route de `apps/api/src` n’a été modifiée.
- `docker-compose.dev.yml`, le Vite normal et le Docker de production gardent leur authentification habituelle. Le ZIP contient les sources de ces profils pour conserver l’application complète.

Ce profil donne volontairement un accès administrateur local aux données fictives pour parcourir les interfaces. Utiliser le fichier `docker-compose.ui-test.yml` pour cet essai.

La recette cloud, ses contrôles et ses limites sont consignés dans [TIMELINE-STUDIO-INTEGREE.md](TIMELINE-STUDIO-INTEGREE.md). Le lancement sur Docker Desktop Windows reste à réaliser par le demandeur.


Reprise du 11/11/2026 : [image compilée vérifiée dans Docker, recette et limites](DOCKER-COMPILE-VERIFIE.md). L’image d’exécution est réduite à environ 206 Mo ; les commandes ci-dessus restent identiques.


## Mise à jour : listes et résultats de réalisation

La [livraison du 11/11](LIGNES-ET-VALIDATION-RAPIDE.md) ajoute les lignes cliquables et compactes, le défilement des longues listes, et la saisie OK / KO avec preuve et commentaire depuis les repères de Timeline. Budget et CRRC sont retirés de l’interface. Les données des essais existants sont conservées. Après remplacement des sources, reconstruire le service `api` avec la commande de mise à jour ci-dessus pour charger à la fois l’API et le frontal compilés.


## Registres et résultats depuis la Timeline — 11/11/2026

Le paquet des [listes et validations rapides](LIGNES-ET-VALIDATION-RAPIDE.md) reprend les refontes déjà intégrées. Budget et CRRC sont retirés des écrans ; leurs données restent conservées. Cliquer sur une ligne ouvre sa fiche. Les longues listes possèdent leur défilement et leurs en-têtes ; les champs et menus gardent leur action propre. Dans Actions et Tâches récurrentes, cliquer sur un repère ouvre « Résultat de réalisation » avec commentaire et preuve.

Après remplacement des fichiers du paquet, reconstruire le service applicatif :

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml up -d --build --force-recreate api
```

Conserver le même nom de projet et les volumes pour reprendre les essais existants. L’adresse reste **http://localhost:5174**. Aucune migration manuelle ni suppression de volume n’est nécessaire pour ces changements.
