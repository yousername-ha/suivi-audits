# Audit de la version cible — avant toute modification

## 1. Identifier les trois versions sans les confondre

| Version                         | Ce que l’on sait                                                                               | Ce que doit constater Opus                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Référence de refonte            | Snapshot local `55d43ee`, dernier changement applicatif `d9d1478` ; images et décisions datées | Les fichiers utiles et leurs équivalents dans la cible                                            |
| Références Git distantes        | Révisions lues à la date de conditionnement, dans `annexes/ETAT-GIT-DISTANT.json`              | Les actualiser si nécessaire, lire les PR/sessions qui touchent les mêmes fichiers                |
| Application réellement exécutée | Non identifiée par cette livraison ; aucune inspection du serveur du demandeur                 | Commit/version/image, mode Vite ou compilé, projet Compose, service web et branche de déploiement |

Une branche Git ne prouve pas le code qui tourne. Un log HTTP 200 ancien ne prouve pas qu’un service écoute actuellement. Aucune version de production n’est déduite d’une capture ou d’un nom de ZIP.

Commandes de constat, à adapter à l’environnement (lecture seule) :

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git log -n 12 --oneline
git diff --stat
```

Si Docker est utilisé, choisir d’abord le projet et le fichier Compose réels :

```sh
docker compose ls
docker compose -p <projet-cible> -f <compose-cible> config --services
docker compose -p <projet-cible> -f <compose-cible> ps -a
docker compose -p <projet-cible> -f <compose-cible> images
```

Consulter les labels/version/image publiés par l’installation si disponibles. Ne pas exporter un `docker inspect` complet, un environnement, un cookie, un jeton ou un `.env` dans le rapport. Les anciennes commandes du profil `neon-refonte-test` ou `neon-interface-test` sont historiques : elles ne définissent pas le projet actuel.

## 2. Faire la matrice par capacité, pas seulement par nom de fichier

Pour chaque ligne de `annexes/MATRICE-COMPATIBILITE.csv`, ajouter dans la cible : chemin(s), route, version/commit, composants/services/DTO/tests, droits, origine des données, état constaté, action choisie et preuve de conservation.

États autorisés :

| Constat cible                      | Action                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Existe et déjà conforme            | Réutiliser, vérifier ; pas de réimplémentation                                                                |
| Existe avec un autre composant/nom | Adapter la présentation sur cet équivalent                                                                    |
| Existe partiellement               | Porter uniquement ce qui manque sans remplacer le reste                                                       |
| Différent ou plus récent           | Garder la logique actuelle ; documenter les différences de contrat et porter le visuel                        |
| Absent                             | Confirmer l’absence après recherche, consigner le besoin ; ne pas inventer une fonction dans un lot graphique |
| Retiré volontairement              | Ne pas ressusciter le module au motif qu’une ancienne image le contient                                       |
| Inconnu/inaccessible               | Dire ce qui manque pour conclure ; avancer sur les éléments indépendants                                      |

Rechercher d’abord avec `rg --files` puis `rg` : noms fonctionnels, chemins du routeur, imports, hooks, clés React Query, DTO, permissions, services et tests. Les sources de refonte sont dans `reference/`, les chemins de comparaison dans `annexes/MODULES.json`. Aucun `git checkout` global de ces fichiers n’est une stratégie de portage.

## 3. Vérifier les contrats et invariants

- Formulaires et lecture, données longues/vides, références inconnues, provenance des calculs ; formulaires partagés et vues alternatives.
- Permissions d’affichage ET gardes serveur ; modules activés, périmètres, MFA/session/CSRF, transactions, If-Match, versions, historique et SSE.
- Pagination et total serveur vs fiche chargée ; types archivés et relations non lisibles.
- Préférences de disposition Dashboard, thème, densité, taille et ordre du menu ; une capture de démonstration ne les remplace pas.
- Conditions de navigation vers les anciens écrans cachés ; retrait de Budget/CRRC dans la référence sans suppression de données.
- Évolutions de Risques et retrait des opportunités : une PR distante ouverte lors de cette livraison (#264) traite ce retrait. Vérifier ce qui est déjà fusionné dans la cible, ne pas ramener les anciennes interfaces/types au moyen du snapshot.
- Assistant : service réellement branché, nouveaux DTO et extraction documentaire réelle. La branche distante assistant a évolué depuis le contrat historique examiné pour la refonte.

## 4. Sortie attendue avant de porter les premiers styles

Un rapport court `AUDIT-CIBLE.md` avec : identité de la version courante ; matrice remplie avec preuves ; modules déjà conformes ; différences fonctionnelles à préserver ; changements graphiques nécessaires ; capacités absentes/retirées/inconnues ; ordre de portage et vérifications de chaque lot. Ce diagnostic prépare les travaux autorisés ; il ne doit pas devenir une demande de revalidation des mêmes choix graphiques.

Créer ensuite une branche de travail selon les règles actuelles du dépôt cible. Préserver les changements non committés de l’utilisateur et les PR des autres sessions. Pas de reset, remplacement complet, modification directe de main ou nettoyage de volumes pour simplifier la comparaison.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
