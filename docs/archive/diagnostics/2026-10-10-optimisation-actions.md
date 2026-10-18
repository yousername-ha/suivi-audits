# Optimisation GitHub Actions — 10 octobre 2026

## Diagnostic

Le workflow CI annule déjà une exécution obsolète sur la même référence (`ci-${{ github.ref }}`). CodeQL n'avait pas cette protection : plusieurs analyses d'une même Pull Request pouvaient consommer des minutes simultanément.

La CI exécutait immédiatement deux scans de vulnérabilités identiques pour chacune des trois images API, web et updater. Le premier utilisait `--exit-code 1`, le second précisait `--format table` sans ajouter de contrôle. Trivy affiche déjà ses résultats au format tableau par défaut. Le workflow de publication ne contient qu'un scan de vulnérabilités bloquant par image.

Le patch fourni contient ces deux changements. Son dernier en-tête de hunk annonce un nombre de lignes incorrect : l'application utilise `git apply --recount`, après vérification, sans modifier les changements proposés.

## Modifications

- Dans CI, les scans de vulnérabilités des images passent de six à trois par exécution complète : un par image, avec les mêmes seuils HIGH/CRITICAL et `--exit-code 1`.
- Dans CodeQL, `concurrency.group: codeql-${{ github.ref }}` et `cancel-in-progress: true` annulent seulement une analyse précédente de la même référence. Les analyses de références distinctes restent indépendantes.
- La génération des SBOM, les scans du dépôt et de publication, les tests, les recettes Docker/installation/restauration et les contrôles de signatures sont conservés. Une annulation de CodeQL ne vaut pas réussite pour le garde de publication du commit exact.

Ces changements réduisent les travaux redondants. La baisse de 50 % concerne le nombre de scans de vulnérabilités des images dans CI, pas la durée totale du workflow. Elle ne permet pas, à elle seule, de garantir une consommation inférieure à 2 000 minutes mensuelles ; celle-ci dépend du nombre d'exécutions et des recettes complètes conservées.

Le code applicatif, les images déjà publiées et les procédures serveur ne changent pas. Aucun redéploiement n'est nécessaire pour bénéficier de l'optimisation GitHub. Le dépôt reste privé ; les identités des auteurs sont conservées conformément à la demande. Aucun changement sur `main` ni réécriture d'historique.

## Validation

- Actionlint 1.7.12 : les trois workflows CI, CodeQL et Publication sont valides. L'archive de l'outil local a été vérifiée contre la somme SHA-256 de sa release officielle ; aucune dépendance du projet ajoutée.
- Exécution du bloc Trivy avec un Docker simulé : six appels avant, trois après ; un échec de l'image web renvoie le code d'échec et arrête le job avant le scan updater. Les trois appels conservés comportent les options HIGH/CRITICAL et `--exit-code 1`.
- Comparaison des workflows YAML avant/après : mêmes événements, jobs, permissions et étapes, hors suppression du second scan et ajout de la concurrence CodeQL.
- Contrats existants : 4 tests Node de publication et 15 tests Python de mise à jour réussis ; formatage Prettier, notes de CHANGELOG et `git diff --check` réussis.

La Pull Request existante de la branche de travail reçoit ce lot. Les contrôles GitHub du nouveau commit sont lancés une seule fois automatiquement par la PR ; aucune relance manuelle ni nouvelle publication d'images n'est demandée pour ces changements CI.
