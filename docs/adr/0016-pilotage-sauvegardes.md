# ADR 0016 — Demandes de sauvegarde et exécutant sur le serveur

Statut : adopté pour le lot A1a (9 octobre 2026).

L'API et ses conteneurs restent sans socket Docker, sans shell de commande et sans accès à la phrase secrète des sauvegardes. La sauvegarde existante inclut base, secrets et autorité Caddy ; elle est exécutée sur le serveur.

## Décision et portée livrée

Le navigateur demande une sauvegarde complète, sans fournir chemin, commande, clé ou option système. L'API exige administration:administrer, MFA, CSRF et origine valide. Une file PostgreSQL conserve une seule demande active, son auteur, son identifiant de requête idempotent, ses versions et son résultat. Annulation possible uniquement avant exécution, avec If-Match. Les transitions et leur audit sont atomiques.

Un script serveur exécuté par cron prend un verrou local exclusif, annonce son état et réclame une demande via la CLI déjà utilisée par l'exploitation. Il appelle exclusivement backup.sh avec destination et phrase secrète définies côté serveur. Le chiffrement est obligatoire dans ce parcours. Les scripts, la destination et la clé restent sous contrôle de l'exploitant, indépendants des paramètres déclaratifs saisis dans l'application.

Un second verrou dans backup.sh évite le chevauchement avec les sauvegardes lancées par les procédures existantes. Un worker redémarré signale une tâche interrompue en échec, sans relance automatique ; le verrou hérité par les processus empêche de récupérer une tâche dont la sauvegarde tourne encore. Un battement récent est requis pour accepter une demande. Son absence est visible dans l'interface.

Le résultat est accepté comme réussi seulement si le rapport correspond au job, indique chiffrement et contrôle SHA-256, et comporte les métadonnées attendues. Aucun contenu d'archive, chemin de clé, mot de passe ou journal système brut ne transite dans l'API. L'historique expose un nom de fichier, une taille, une durée et une empreinte. SHA-256 détecte une corruption ; il ne prouve pas l'authenticité d'une archive fournie par un tiers.

## Compatibilité et suites

Migration additive 006 ; ni données métier ni migrations publiées modifiées. Aucun nouveau service réseau ni dépendance. La planification actuelle des sauvegardes serveur et la rétention RETENTION_DAYS restent opérationnelles. Le poll de la file ne crée pas une nouvelle sauvegarde à chaque passage.

La restauration web, la planification configurable depuis le navigateur, l'export d'archives et la modification de la clé sont hors de ce lot A1a. La restauration existante reste une opération serveur confirmée. Avant une restauration web : contrôle sûr des archives imbriquées, sauvegarde préalable, preuve de restauration isolée, protocole résistant au remplacement de la base/file/identifiants et rollback. Aucun bouton ne prétend restaurer dans ce lot.

## Recette obligatoire

Droits lecture/administration, CSRF/origine, worker absent ou périmé, double clic et requêtes concurrentes, annulation/version/conflit avec prise en charge, interruption sans double exécution, échec système et rapport erroné, absence de secrets dans les réponses. Vérifier sauvegarde chiffrée et SHA-256 avec données fictives, verrouillage et script worker, puis parcours Sauge et CI complète. Aucun essai sur les données de production.
