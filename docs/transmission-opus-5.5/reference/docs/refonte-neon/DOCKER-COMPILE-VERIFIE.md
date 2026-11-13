# Docker interfaces compilé : reprise et vérification

11 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Après « Continue » puis « Reprend », reprise de la vérification Docker restée incomplète. L’image locale passe d’environ 401 à 206 Mo : l’API et l’interface sont compilées à la construction, puis seuls les modules nécessaires à l’exécution sont copiés. Le frontal statique Node remplace Vite dans le conteneur livré ; le mode Vite reste disponible pour le développement. Les sources applicatives et la refonte validée ne changent pas d’apparence.

## Vérifié dans Docker

- Démarrage du conteneur applicatif et sonde `healthy`, API et interface disponibles.
- Création et initialisation d’une base fictive neuve dans PostgreSQL 18, compte et session générés automatiquement ; navigateur neuf sans formulaire de connexion.
- Recréation du conteneur après reconstruction : même identité, mêmes séries, aucun doublon de chargement.
- Neuf parcours E2E finaux réussis, sans rejeu automatique : périodicités, série en pause, animation renforcée/pause/clavier, ouverture directe, droits d’action, fenêtres/validation/enchaînement/iCalendar, cent actions sur ordinateur et téléphone, filtre par registre, jours de fond.
- 24 dispositions Actions/Récurrences clair/sombre, de 320 à 1920 px, sans débordement détecté ; quatre analyses Axe ciblées sans violation. Les captures HD et la vidéo sont natives et proviennent de l’application compilée exécutée dans Docker.
- Quatre sous-cas Node pour le frontal : fichiers et routes React, HEAD/MIME/refus des fichiers privés, corps/CSRF/versions/session et absence de Set-Cookie, destination API fixe, diffusion des événements et fermeture des flux. Le compte rendu Node comprend aussi leur scénario parent.
- Gardes vérifiées dans l’image : mode absent et nom de base hors périmètre refusés avant connexion, base occupée sans identité de démonstration refusée avant migration. Sa table témoin reste seule.
- TypeScript de l’entrée de recette, TypeScript web, lint et format racine réussis. Les 250 tests web et 243 tests UI de l’intégration précédente sont historiques ; les styles et la logique des composants correspondants n’ont pas été modifiés par cette reprise.

La première recette de l’image compilée a terminé les parcours métier mais a détecté une erreur MIME sur `/update/client.js`, ressource de la passerelle absente de ce profil local. Cette seule référence est retirée par la configuration Vite de test ; la configuration normale conserve le script. Les neuf parcours passent ensuite sans diminuer leurs assertions.

## Isolation et limites

Le cloud utilise le PostgreSQL 18 Docker déjà présent avec une base **nouvelle**, `suivi_interfaces_recette_20261111`, et un réseau bridge de recette. La base précédente `suivi_interfaces` est conservée. Le renommage envisagé a été refusé par le contrôle automatique car il concernait une ressource persistante ; cette action n’a pas été exécutée. Le nettoyage manuel du stockage interne Docker précédemment refusé n’a pas été tenté à nouveau. Seuls les caches de construction de ce lot ont été nettoyés par les commandes Docker prises en charge.

Pour permettre une base de recette distincte, l’entrée dédiée accepte `suivi_interfaces` et le suffixe `_recette_AAAAMMJJ`, uniquement avec `NEON_UI_TEST=1`. Sans son identité locale, une base qui contient déjà des tables est refusée **avant** les migrations. L’identité de démonstration est sauvegardée avant l’initialisation d’une base vide pour qu’un démarrage interrompu puisse être repris.

Le Compose livré utilise son propre service `db`, sa base par défaut `suivi_interfaces` et des volumes séparés ; l’adaptation du réseau et de la base du cloud n’est pas incluse dans le ZIP. La création simultanée de deux nouveaux conteneurs avec ce Compose par défaut n’a pas été rejouée dans le cloud limité en disque. L’essai Docker Desktop Windows reste à réaliser. CI distante et suites API/E2E intégrales non relancées ; aucun push ni déploiement.

[Résultats synthétiques](captures/docker-compile/recette.json) · [Actions clair](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures/docker-compile/actions-clair-hd.png) · [Actions sombre](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures/docker-compile/actions-sombre-hd.png) · [Récurrences clair](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures/docker-compile/recurrences-clair-hd.png) · [Récurrences sombre](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/captures/docker-compile/recurrences-sombre-hd.png).

Les rapports bruts, identités, clés et cookies restent privés hors Git. Les preuves antérieures sont conservées et ne sont pas réattribuées à cette reprise.
